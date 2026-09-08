// src/components/views/mappingStudio/components/MappingYamlConfigurator.jsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Save, Upload, Eye, Loader2, FileText, AlertCircle, ExternalLink } from 'lucide-react';
import yaml from 'js-yaml';
import { validateFileBasics } from '@/lib/uploads/validation';
import { findDisallowedTemplateMarker } from '@/lib/mappings/security';
import { rewriteTemplateSyntax } from '@/lib/mappings/templateSyntaxRewrite';
import { useDataModels } from '@/providers/DataModelProvider';

const DEFAULT_YAML = `input:
  kind: csv
  columns: []

group_by: []

compose:
  header:
    language: en
    territory: ES
  content: []
`;

const KEHRNEL_DOCS_BASE_URL = (process.env.NEXT_PUBLIC_KEHRNEL_DOCS_URL || '/api/kehrnel/docs/guide').replace(/\/$/, '');
const MAPPING_DOC_LINKS = [
  {
    label: 'Mapping Identification',
    href: `${KEHRNEL_DOCS_BASE_URL}/docs/common/mapping/identification`
  },
  {
    label: 'Mapping Language',
    href: `${KEHRNEL_DOCS_BASE_URL}/docs/common/mapping/language`
  }
];

const MappingYamlConfigurator = ({
  documentType,
  documentGroup,
  mappingRecord,
  onSaved,
  onTransform
}) => {
  const { dataModelsByName } = useDataModels();
  const [yamlValue, setYamlValue] = useState(DEFAULT_YAML);
  const [description, setDescription] = useState('');
  const [targetTemplate, setTargetTemplate] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [samples, setSamples] = useState([]);
  const [selectedSample, setSelectedSample] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [templateRewriteInfo, setTemplateRewriteInfo] = useState(null);
  const uploadInputRef = useRef(null);
  const SAMPLE_MAX_BYTES = 10 * 1024 * 1024; // 10MB
  const SAMPLE_EXTENSIONS = ['.xml', '.cda', '.csv', '.json', '.txt', '.hl7'];
  const SAMPLE_MIME_TYPES = [
    'application/xml',
    'text/xml',
    'application/json',
    'text/json',
    'text/plain',
    'text/csv',
    'application/csv',
    'application/hl7-v2',
    'application/octet-stream'
  ];

  const parseApiResponse = async (res) => {
    const contentType = res.headers.get('content-type') || '';
    const raw = await res.text();
    if (!raw) return {};
    if (contentType.includes('application/json')) {
      try {
        return JSON.parse(raw);
      } catch {
        return { error: `Invalid JSON response (${res.status})`, details: raw.slice(0, 400) };
      }
    }
    // HTML/plain fallback (e.g. Next.js error page, proxy error, auth redirect)
    return { error: `Unexpected non-JSON response (${res.status})`, details: raw.slice(0, 400) };
  };

  const disallowedTemplateMarker = useMemo(
    () => findDisallowedTemplateMarker(yamlValue),
    [yamlValue]
  );

  const disallowedTemplateMessage = useMemo(() => {
    if (!disallowedTemplateMarker) return '';
    const marker = disallowedTemplateMarker.marker || 'template marker';
    return `Jinja/template syntax is disabled (${marker} at line ${disallowedTemplateMarker.line}, column ${disallowedTemplateMarker.column}).`;
  }, [disallowedTemplateMarker]);

  const targetTemplateDisplayName = useMemo(() => {
    const templateId = String(targetTemplate || '').trim();
    if (!templateId) return '';
    const template = dataModelsByName?.[templateId];
    if (!template) return templateId;
    return String(
      template?.name
      || template?.metadata?.templateId
      || template?._id
      || templateId
    );
  }, [targetTemplate, dataModelsByName]);

  useEffect(() => {
    const sourceYaml = mappingRecord?.yaml || DEFAULT_YAML;
    const rewritten = rewriteTemplateSyntax(sourceYaml);
    setYamlValue(rewritten.yaml);
    setDescription(mappingRecord?.description || '');
    setTargetTemplate(mappingRecord?.targetTemplate || documentGroup?.selectedTemplate || '');
    setStatus(null);
    setTemplateRewriteInfo(
      rewritten.convertedCount > 0 || rewritten.unresolvedCount > 0
        ? rewritten
        : null
    );
    setPreview(null);
    setSamples([]);
    setSelectedSample(null);
    if (mappingRecord?._id) {
      fetchSamples(mappingRecord._id);
    }
  }, [
    mappingRecord?._id,
    mappingRecord?.yaml,
    mappingRecord?.description,
    mappingRecord?.targetTemplate,
    documentGroup?.selectedTemplate,
    documentType
  ]);

  const applyTemplateSyntaxRewrite = () => {
    const rewritten = rewriteTemplateSyntax(yamlValue);
    if (rewritten.convertedCount === 0) {
      setTemplateRewriteInfo(rewritten);
      setStatus({
        type: rewritten.unresolvedCount > 0 ? 'error' : 'success',
        message: rewritten.unresolvedCount > 0
          ? 'No auto-convertible template expressions found.'
          : 'No unsupported template syntax found.'
      });
      return;
    }

    setYamlValue(rewritten.yaml);
    setTemplateRewriteInfo(rewritten);
    if (rewritten.unresolvedCount > 0) {
      setStatus({
        type: 'error',
        message: `Converted ${rewritten.convertedCount} template expression(s), ${rewritten.unresolvedCount} still need manual rewrite.`
      });
    } else {
      setStatus({
        type: 'success',
        message: `Converted ${rewritten.convertedCount} template expression(s).`
      });
    }
  };

  const fetchSamples = async (mappingId) => {
    try {
      const res = await fetch(`/api/mappings/${mappingId}/samples`);
      if (res.ok) {
        const data = await res.json();
        setSamples(data);
        if (data.length) setSelectedSample(data[0]._id);
      }
    } catch (error) {
      console.error('Failed to load samples', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const rewritten = rewriteTemplateSyntax(yamlValue);
      const candidateYaml = rewritten.convertedCount > 0 ? rewritten.yaml : yamlValue;
      if (rewritten.convertedCount > 0) {
        setYamlValue(candidateYaml);
        setTemplateRewriteInfo(rewritten);
      }

      const disallowedMarkerAfterRewrite = findDisallowedTemplateMarker(candidateYaml);
      if (disallowedMarkerAfterRewrite) {
        const marker = disallowedMarkerAfterRewrite.marker || 'template marker';
        throw new Error(
          `Jinja/template syntax is disabled (${marker} at line ${disallowedMarkerAfterRewrite.line}, column ${disallowedMarkerAfterRewrite.column}).`
        );
      }

      // Validate YAML client-side first to avoid sending broken content.
      try {
        yaml.load(candidateYaml, { json: true });
      } catch (yamlErr) {
        throw new Error(`Invalid YAML: ${yamlErr.message}`);
      }

      const payload = {
        name: mappingRecord?.name || documentType,
        documentType,
        description,
        targetTemplate,
        yaml: candidateYaml
      };

      const res = mappingRecord?._id
        ? await fetch(`/api/mappings/${mappingRecord._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
        : await fetch('/api/mappings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

      if (!res.ok) {
        const data = await parseApiResponse(res);
        throw new Error(data.error || 'Failed to save mapping');
      }

      const saved = await parseApiResponse(res);
      onSaved(documentType, saved);
      setStatus({ type: 'success', message: 'Mapping saved' });
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleAttachSample = async (file) => {
    if (!file || !mappingRecord?._id) {
      setStatus({ type: 'error', message: 'Save the mapping before attaching samples' });
      return;
    }
    const error = validateFileBasics(file, {
      allowedExtensions: SAMPLE_EXTENSIONS,
      allowedMimeTypes: SAMPLE_MIME_TYPES,
      maxBytes: SAMPLE_MAX_BYTES,
      allowMissingType: true
    });
    if (error) {
      setStatus({ type: 'error', message: error });
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/mappings/${mappingRecord._id}/samples`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to upload sample');
      }
      const uploaded = await res.json();
      setSamples(prev => [uploaded, ...prev]);
      setSelectedSample(uploaded._id);
      setStatus({ type: 'success', message: 'Sample uploaded' });
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: error.message });
    } finally {
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  const handleUseDocumentAsSample = (doc) => {
    if (!doc?.file) return;
    handleAttachSample(doc.file);
  };

  const handlePreview = async () => {
    if (!mappingRecord?._id || !selectedSample) {
      setStatus({ type: 'error', message: 'Select a saved sample to preview' });
      return;
    }
    setPreviewLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/mappings/${mappingRecord._id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleId: selectedSample })
      });
      if (!res.ok) {
        const data = await parseApiResponse(res);
        throw new Error(data.error || 'Preview failed');
      }
      const data = await parseApiResponse(res);
      setPreview(data);
      if (data.yamlError) {
        setStatus({ type: 'error', message: data.yamlError });
      }
    } catch (error) {
      console.error(error);
      setStatus({ type: 'error', message: error.message });
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-theme-primary">
            {documentGroup?.displayName || documentType}
          </h3>
          <p className="text-sm text-theme-secondary">
            Configure the mapping using YAML definitions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {MAPPING_DOC_LINKS.map((docLink) => (
            <a
              key={docLink.href}
              href={docLink.href}
              target="_blank"
              rel="noreferrer"
              className="px-2 py-1.5 text-xs rounded border border-theme text-theme-secondary hover:text-theme-primary hover:surface-hover inline-flex items-center gap-1"
            >
              {docLink.label}
              <ExternalLink size={12} />
            </a>
          ))}
          <button
            onClick={onTransform}
            disabled={!mappingRecord?._id || saving || Boolean(disallowedTemplateMarker)}
            className="btn-primary"
            title={disallowedTemplateMarker ? disallowedTemplateMessage : undefined}
          >
            Go to Transform Stage
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase text-theme-secondary">Target Template</label>
          <input
            value={targetTemplateDisplayName}
            readOnly
            className="mt-1 input w-full"
            placeholder="Select a template in Identify stage"
          />
        </div>
        <div>
          <label className="text-xs uppercase text-theme-secondary">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 input w-full"
          />
        </div>
      </div>

      <div className="border border-theme rounded-lg overflow-hidden">
        <Editor
          height="360px"
          language="yaml"
          value={yamlValue}
          theme="vs-dark"
          onChange={(value) => setYamlValue(value ?? '')}
          options={{ minimap: { enabled: false } }}
        />
      </div>

      {disallowedTemplateMarker && (
        <div className="flex items-start gap-2 rounded-md border border-amber-600/40 bg-amber-950/30 px-3 py-2 text-sm text-amber-200">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Unsupported template syntax detected</p>
            <p className="text-xs text-amber-200/90 mt-0.5">
              {disallowedTemplateMessage} Replace template blocks with supported YAML mapping expressions (`xpath`, `constant`, `map`, `when`).
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={applyTemplateSyntaxRewrite}
                  className="px-2 py-1 rounded bg-amber-600/30 text-amber-100 border border-amber-500/40 hover:bg-amber-600/40 text-xs"
                >
                  Convert Template Syntax
                </button>
              {templateRewriteInfo?.convertedCount > 0 && (
                <span className="text-[11px] text-amber-100/90">
                  Converted: {templateRewriteInfo.convertedCount}
                  {templateRewriteInfo.unresolvedCount > 0 ? ` • Remaining: ${templateRewriteInfo.unresolvedCount}` : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-primary text-primary-text rounded-md flex items-center gap-2 disabled:opacity-60"
          disabled={saving}
        >
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Save YAML
        </button>
        <button
          onClick={handlePreview}
          className="px-3 py-2 bg-slate-700 text-slate-200 rounded-md flex items-center gap-2 disabled:opacity-60"
          disabled={!selectedSample || previewLoading}
        >
          {previewLoading ? <Loader2 className="animate-spin" size={16} /> : <Eye size={16} />}
          Preview Sample
        </button>
        {status && (
          <span className={`text-sm ${status.type === 'error' ? 'text-error' : 'text-success'}`}>
            {status.message}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-theme rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-theme-primary">Attached Samples</h4>
            <button
              onClick={() => uploadInputRef.current?.click()}
              className="px-2 py-1 text-xs bg-slate-700 text-slate-200 rounded flex items-center gap-1"
              disabled={!mappingRecord?._id}
            >
              <Upload size={12} />
              Add sample
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              accept={SAMPLE_EXTENSIONS.join(',')}
              className="hidden"
              onChange={(e) => handleAttachSample(e.target.files?.[0])}
            />
          </div>
          {samples.length === 0 ? (
            <p className="text-sm text-theme-secondary">
              Attach one of the uploaded documents as a reference sample.
            </p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-auto">
              {samples.map(sample => (
                <label
                  key={sample._id}
                  className={`flex items-center justify-between text-sm px-3 py-2 rounded border ${
                    selectedSample === sample._id
                      ? 'border-primary text-primary'
                      : 'border-theme text-theme-primary'
                  }`}
                >
                  <span className="truncate">{sample.filename}</span>
                  <input
                    type="radio"
                    checked={selectedSample === sample._id}
                    onChange={() => setSelectedSample(sample._id)}
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="border border-theme rounded-lg p-4 space-y-3">
          <h4 className="text-sm font-medium text-theme-primary flex items-center gap-2">
            <FileText size={14} />
            Use Uploaded Document
          </h4>
          {documentGroup?.documents && documentGroup.documents.length > 0 ? (
            <div className="space-y-2 max-h-40 overflow-auto">
              {documentGroup.documents.map(doc => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between px-3 py-2 border border-theme rounded text-sm"
                >
                  <span className="truncate">{doc.fileName}</span>
                  <button
                    onClick={() => handleUseDocumentAsSample(doc)}
                    className="text-xs text-primary hover:underline"
                    disabled={!mappingRecord?._id}
                  >
                    Attach
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-theme-secondary">
              Upload documents in the first stage to use them as live samples.
            </p>
          )}
        </div>
      </div>

      {preview && (
        <div className="border border-theme rounded-lg p-4 space-y-2">
          <h4 className="text-sm font-medium text-theme-primary flex items-center gap-2">
            <Eye size={14} />
            Preview Summary
          </h4>
          {preview.outline ? (
            <div className="text-sm space-y-1">
              <div>Input kind: <span className="font-mono">{preview.outline.inputKind || 'n/a'}</span></div>
              <div>Columns: {preview.outline.columnCount}</div>
              <div>Group by: {preview.outline.groupBy?.join(', ') || '—'}</div>
              <div>Compose blocks: {preview.outline.composeBlocks || 0}</div>
            </div>
          ) : (
            <div className="text-sm text-error flex items-center gap-2">
              <AlertCircle size={14} />
              Unable to parse YAML definition.
            </div>
          )}
          {preview.sample && (
            <div>
              <p className="text-xs uppercase text-theme-secondary">Sample snippet</p>
              <pre className="mt-1 bg-slate-900/60 rounded p-2 text-xs max-h-48 overflow-auto whitespace-pre-wrap">
                {preview.sample.preview || 'Empty sample'}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MappingYamlConfigurator;
