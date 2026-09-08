// src/components/views/dataModelManagement/DataModelUpload.jsx
"use client";

import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import { Plus, Upload, FileUp, Loader2, Save, FileText, Eye, X, HelpCircle, FileJson, FileCode, Check } from 'lucide-react';
import PropTypes from 'prop-types';
import { cn } from '@/lib/utils';
import { DomainIcon, DOMAIN_CONFIG } from '@/components/views/catalog/DomainTabs';
import { computeWebTemplateMetadata, saveWebTemplateAsJSON } from '@/lib/templates';
import { validateFileBasics } from '@/lib/uploads/validation';

// Supported data models configuration (text chips, no logos for branding consistency)
const SUPPORTED_MODELS = [
  {
    id: 'openehr',
    domain: 'openEHR®',
    chipColor: '#00a99d',
    borderColor: 'border-l-[#00a99d]',
    formats: '.json, .opt',
    description: 'Clinical templates based on openEHR archetypes',
    instructions: 'Create templates in Archetype Designer, then export as Web Template (.json) or OPT (.opt)',
    helpLink: { url: 'https://tools.openehr.org/designer/', label: 'Open Designer' },
    hasConverter: true
  },
  {
    id: 'fhir',
    domain: 'FHIR®',
    chipColor: '#e44e37',
    borderColor: 'border-l-[#e44e37]',
    formats: '.json',
    description: 'HL7 FHIR R4 StructureDefinitions and terminology',
    instructions: 'Upload FHIR profiles (StructureDefinition), ValueSets, or CodeSystems as JSON',
    helpLink: { url: 'https://simplifier.net/', label: 'Browse Simplifier' }
  },
  {
    id: 'context',
    domain: 'ContextObjects',
    chipColor: '#00ED64',
    borderColor: 'border-l-[#00ED64]',
    formats: '.json',
    description: 'Custom semantic objects for your application',
    instructions: 'Use the Builder to create ContextObjects visually, or upload existing JSON exports',
    helpLink: { url: null, label: 'ContextObjects Builder', isInternal: true }
  }
];

const MODEL_FILE_MAX_BYTES = 10 * 1024 * 1024; // 10MB
const JSON_MIME_TYPES = [
  'application/json',
  'text/json',
  'application/x-ndjson',
  'application/jsonl',
  'text/plain'
];
const XML_MIME_TYPES = [
  'application/xml',
  'text/xml',
  'application/x-xml',
  'application/octet-stream'
];

const DataModelUpload = ({ onUpload, onError, onNavigate }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isConverterOpen, setIsConverterOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [convertedTemplates, setConvertedTemplates] = useState([]);
  const [activeTab, setActiveTab] = useState('file');
  const [optFile, setOptFile] = useState(null);
  const [optContent, setOptContent] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [visualizeActive, setVisualizeActive] = useState(false);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
  const [currentUploadDomain, setCurrentUploadDomain] = useState('openehr');
  const allowedFhirTypes = new Set(['StructureDefinition', 'ValueSet', 'CodeSystem']);

  const handleFileUpload = async (event) => {
    const files = event.target.files;
    if (!files?.length) return;

    setIsUploading(true);
    const newTemplates = [];
    const errors = [];

    // Process each file based on the current domain
    for (const file of Array.from(files)) {
      try {
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const baseOptions = {
          maxBytes: MODEL_FILE_MAX_BYTES,
          allowMissingType: true
        };

        let templateData;
        if (currentUploadDomain === 'openehr') {
          // OpenEHR: process as Web Template or OPT
          if (fileExtension === 'json') {
            const error = validateFileBasics(file, {
              ...baseOptions,
              allowedExtensions: ['.json'],
              allowedMimeTypes: JSON_MIME_TYPES
            });
            if (error) throw new Error(error);
            templateData = await processWebTemplateFile(file);
          } else if (fileExtension === 'opt') {
            const error = validateFileBasics(file, {
              ...baseOptions,
              allowedExtensions: ['.opt'],
              allowedMimeTypes: XML_MIME_TYPES
            });
            if (error) throw new Error(error);
            templateData = await processOPTFile(file);
          } else if (fileExtension === 'xml') {
            const error = validateFileBasics(file, {
              ...baseOptions,
              allowedExtensions: ['.xml'],
              allowedMimeTypes: XML_MIME_TYPES
            });
            if (error) throw new Error(error);
            templateData = await processOPTFile(file);
          } else {
            throw new Error(`Unsupported file type for OpenEHR: ${fileExtension}. Please upload .json or .opt files.`);
          }
          templateData.domain = 'openehr';
        } else if (currentUploadDomain === 'fhir') {
          // FHIR: process as FHIR resource JSON
          if (fileExtension !== 'json') {
            throw new Error(`Unsupported file type for FHIR: ${fileExtension}. Please upload .json files.`);
          }
          {
            const error = validateFileBasics(file, {
              ...baseOptions,
              allowedExtensions: ['.json'],
              allowedMimeTypes: JSON_MIME_TYPES
            });
            if (error) throw new Error(error);
          }
          templateData = await processFHIRFile(file);
        } else if (currentUploadDomain === 'context') {
          // Context Objects: process as context schema JSON
          if (fileExtension !== 'json') {
            throw new Error(`Unsupported file type for ContextObjects: ${fileExtension}. Please upload .json files.`);
          }
          {
            const error = validateFileBasics(file, {
              ...baseOptions,
              allowedExtensions: ['.json'],
              allowedMimeTypes: JSON_MIME_TYPES
            });
            if (error) throw new Error(error);
          }
          templateData = await processContextObjectFile(file);
        } else {
          throw new Error(`Unknown domain: ${currentUploadDomain}`);
        }

        newTemplates.push(templateData);
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        errors.push(error.message || `Failed to process file: ${file.name}`);
      }
    }

    try {
      if (errors.length > 0) {
        // Report errors if any
        onError(errors.join('. '));
      } else if (newTemplates.length > 0) {
        console.log("Uploading data models:", newTemplates);
        const maybePromise = onUpload(newTemplates);
        if (maybePromise && typeof maybePromise.then === 'function') {
          await maybePromise; // keep spinner visible until parent finishes
        }
      }
    } catch (error) {
      console.error(error);
      onError(error.message || "Failed to upload data models");
    } finally {
      setIsUploading(false);
    }
  };


  const processWebTemplateFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const payload = JSON.parse(reader.result);
          // Support only the new schema; if a legacy file slips in, normalize once.
          const tree = payload?.rmType ? payload : payload?.tree;

          if (!tree || !tree.rmType || !Array.isArray(tree.children)) {
            reject(`Invalid Web Template JSON in ${file.name}: expected a root node with rmType and children`);
            return;
          }

          const name =
            payload?.templateId ||
            tree?.localizedNames?.en ||
            tree?.name ||
            file.name.replace(/\.json$/i, '');

          const metadata = computeWebTemplateMetadata(tree, {
            templateId: payload?.templateId || name
          });

          resolve({
            name,
            metadata,
            domain: 'openehr',
            domainData: {
              webTemplate: tree,
              source: {
                type: 'web',
                fileName: file.name,
                contentType: file.type || 'application/json',
                size: file.size
              }
            }
          });
        } catch {
          reject(`Invalid JSON in file: ${file.name}`);
        }
      };
      reader.onerror = () => reject(`Error reading file: ${file.name}`);
      reader.readAsText(file);
    });
  };

  const processOPTFile = async (file) => {
    setIsConverting(true);
    try {
      const optXml = await file.text();

      const formData = new FormData();
      formData.append('optFile', file);

      const response = await fetch('/api/convert-opt-json', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to convert OPT file: ${file.name}`);
      }

      const payload = await response.json();
      // API may return either { tree, templateId, ... } or the tree directly
      const tree = payload?.tree || payload;

      if (!tree || !tree.rmType || !Array.isArray(tree.children)) {
        throw new Error(`Converter returned invalid web template for ${file.name}`);
      }

      const localizedName =
        tree?.localizedNames?.en ||
        (tree?.localizedNames && Object.values(tree.localizedNames)[0]);

      const name =
        payload?.templateId ||
        localizedName ||
        tree?.name ||
        file.name.replace(/\.(opt|xml)$/i, '');

      const metadata = computeWebTemplateMetadata(tree, {
        templateId: payload?.templateId || name,
        defaultLanguage: payload?.defaultLanguage
      });


      return {
        name,
        metadata,
        domain: 'openehr',
        domainData: {
          webTemplate: tree,
          source: {
            type: 'opt',
            fileName: file.name,
            contentType: file.type || 'application/xml',
            size: file.size,
            xml: optXml
          }
        }
      };
    } catch (error) {
      console.error('Error converting OPT:', error);
      throw error;
    } finally {
      setIsConverting(false);
    }
  };

  // Process FHIR resource JSON file
  const processFHIRFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);

          // FHIR artifacts must be profile/terminology resources
          const resourceType = data.resourceType || 'Unknown';
          if (!allowedFhirTypes.has(resourceType)) {
            reject(
              `Unsupported FHIR resourceType in ${file.name}: ${resourceType}. Allowed: StructureDefinition, ValueSet, CodeSystem.`
            );
            return;
          }
          const name = data.name || data.title || data.id || file.name.replace(/\.json$/i, '');
          const description = data.description || data.purpose || '';

          resolve({
            name,
            domain: 'fhir',
            description,
            domainData: {
              resourceType,
              resource: data,
              source: {
                type: 'json',
                fileName: file.name,
                size: file.size
              }
            }
          });
        } catch {
          reject(`Invalid JSON in file: ${file.name}`);
        }
      };
      reader.onerror = () => reject(`Error reading file: ${file.name}`);
      reader.readAsText(file);
    });
  };

  // Process Context Object JSON file
  const processContextObjectFile = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);

          // Context objects are custom schemas - extract name/description from common locations
          const name = data.name || data.title || data.$id || file.name.replace(/\.json$/i, '');
          const description = data.description || '';

          resolve({
            name,
            domain: 'contextobject',
            description,
            domainData: {
              schema: data,
              source: {
                type: 'json',
                fileName: file.name,
                size: file.size
              }
            }
          });
        } catch {
          reject(`Invalid JSON in file: ${file.name}`);
        }
      };
      reader.onerror = () => reject(`Error reading file: ${file.name}`);
      reader.readAsText(file);
    });
  };

  // Handler for opening the converter modal
  const handleOpenConverter = () => {
    setIsConverterOpen(true);
    setError(null);
    setConvertedTemplates([]);
    setOptFile(null);
    setOptContent('');
    setActiveTab('file');
  };

  // Handler for closing the converter modal
  const handleCloseConverter = () => {
    setIsConverterOpen(false);
  };

  // File conversion handlers for the modal
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const error = validateFileBasics(file, {
        allowedExtensions: ['.opt', '.xml'],
        allowedMimeTypes: XML_MIME_TYPES,
        maxBytes: MODEL_FILE_MAX_BYTES,
        allowMissingType: true
      });
      if (error) {
        setError(error);
        e.target.value = '';
        return;
      }
      setOptFile(file);
      setError(null);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const error = validateFileBasics(file, {
        allowedExtensions: ['.opt', '.xml'],
        allowedMimeTypes: XML_MIME_TYPES,
        maxBytes: MODEL_FILE_MAX_BYTES,
        allowMissingType: true
      });
      if (error) {
        setError(error);
        return;
      }
      setOptFile(file);
      setError(null);
    }
  };

  const handleTextChange = (e) => {
    setOptContent(e.target.value);
    setError(null);
  };

  const handleTabChange = (value) => {
    setActiveTab(value);
    setError(null);
  };

  const handleConvertFile = async () => {
    if (!optFile) { setError("Please select an OPT file to convert"); return; }
    setIsConverting(true); setError(null);
    try {
      const optXml = await optFile.text();
      const fd = new FormData();
      fd.append('optFile', optFile);
      const resp = await fetch('/api/convert-opt-json', { method: 'POST', body: fd });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || 'Failed to convert OPT file');
      }
      const payload = await resp.json();
      const tree = payload?.tree || payload;
      const localizedName = tree?.localizedNames?.en || (tree?.localizedNames && Object.values(tree.localizedNames)[0]);
      const name = payload?.templateId || localizedName || tree?.name || optFile.name.replace(/\.(opt|xml)$/i, '');
      const metadata = computeWebTemplateMetadata(tree, {
        templateId: payload?.templateId || name,
        defaultLanguage: payload?.defaultLanguage
      });
      const templateData = {
        name,
        domain: 'openehr',
        webTemplate: tree,
        metadata,
        domainData: {
          webTemplate: tree,
          source: { type: 'opt', fileName: optFile.name, contentType: optFile.type || 'application/xml', size: optFile.size, xml: optXml }
        }
      };
      setConvertedTemplates(prev => {
        const next = [...prev, templateData];
        setSelectedTemplateIndex(next.length - 1);
        return next;
      });
      setActiveTab('result');
    } catch (err) {
      console.error('Conversion error:', err);
      setError(err.message || 'Failed to convert OPT file');
    } finally {
      setIsConverting(false);
    }
  };

  // Convert pasted text in the modal
  const handleConvertText = async () => {
    if (!optContent.trim()) {
      setError("Please paste OPT XML content to convert");
      return;
    }

    setIsConverting(true);
    setError(null);

    try {
      const blob = new Blob([optContent], { type: 'application/xml' });
      const fd = new FormData();
      fd.append('optFile', blob, 'pasted-content.xml');

      const resp = await fetch('/api/convert-opt-json', { method: 'POST', body: fd });
      if (!resp.ok) {
        const e = await resp.json().catch(() => ({}));
        throw new Error(e.error || 'Failed to convert OPT content');
      }

      const payload = await resp.json();           // either { tree, templateId, defaultLanguage, ... } OR just the tree
      const tree = payload?.tree || payload;       // robust to either shape

      // best-effort name
      const localizedName =
        tree?.localizedNames?.en ||
        (tree?.localizedNames && Object.values(tree.localizedNames)[0]);
      const name = payload?.templateId || localizedName || tree?.name || 'pasted-template';
      const metadata = computeWebTemplateMetadata(tree, {
        templateId: payload?.templateId || name,
        defaultLanguage: payload?.defaultLanguage
      });

      const templateData = {
        name,
        domain: 'openehr',
        webTemplate: tree,
        metadata,
        domainData: {
          webTemplate: tree,
          source: { type: 'opt', fileName: 'pasted-content.xml', contentType: 'application/xml', size: blob.size, xml: optContent }
        }
      };

      setConvertedTemplates(prev => {
        const next = [...prev, templateData];
        setSelectedTemplateIndex(next.length - 1);
        return next;
      });
      setActiveTab('result');
    } catch (err) {
      console.error('Conversion error:', err);
      setError(err.message || 'Failed to convert OPT content');
    } finally {
      setIsConverting(false);
    }
  };

  const handleSaveJSON = () => {
    const t = convertedTemplates[selectedTemplateIndex];
    if (!t) return;
    const filename = (t?.source?.fileName || `${t.name}.json`).replace(/\.[^/.]+$/, '.json');
    saveWebTemplateAsJSON(t.webTemplate, filename);
  };

  const handleUploadConverted = async () => {
    if (!convertedTemplates.length) return;

    // 1) Close the Radix portal immediately (commit this render)
    flushSync(() => setIsConverterOpen(false));

    // 2) Let React fully unmount the portalled nodes
    await new Promise(r => requestAnimationFrame(r));

    // 3) Now do heavier work / set other state
    try {
      const p = onUpload(convertedTemplates);
      if (p && typeof p.then === 'function') await p;
    } catch (e) {
      console.error(e);
      onError(e.message || 'Failed to upload converted data models');
    }
  };

  const toggleVisualize = () => {
    setVisualizeActive(!visualizeActive);
  };

  // Handle upload for specific domain
  const handleDomainUpload = (domainId) => {
    // Set the current domain before triggering file input
    setCurrentUploadDomain(domainId);
    const input = document.getElementById(`upload-${domainId}`);
    if (input) {
      input.click();
    }
  };

  return (
    <div className="space-y-4">
      {/* Hidden file inputs for each domain */}
      <input
        type="file"
        accept=".json,.opt,.xml"
        onChange={handleFileUpload}
        multiple
        className="hidden"
        id="upload-openehr"
        disabled={isUploading || isConverting}
      />
      <input
        type="file"
        accept=".json"
        onChange={handleFileUpload}
        multiple
        className="hidden"
        id="upload-fhir"
        disabled={isUploading || isConverting}
      />
      <input
        type="file"
        accept=".json"
        onChange={handleFileUpload}
        multiple
        className="hidden"
        id="upload-context"
        disabled={isUploading || isConverting}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setIsInfoModalOpen(true)}
          disabled={isUploading || isConverting}
          className={cn(
            "px-4 py-2 btn-primary flex items-center gap-2",
            (isUploading || isConverting) ? "opacity-60 cursor-not-allowed" : ""
          )}
        >
          {isUploading || isConverting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {isConverting ? "Converting..." : "Uploading..."}
            </>
          ) : (
            <>
              <Plus size={16} />
              Add Data Models
            </>
          )}
        </button>
      </div>

      {/* Supported Formats Info Modal */}
      <Dialog.Root open={isInfoModalOpen} onOpenChange={setIsInfoModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl surface border border-theme rounded-xl shadow-2xl z-50 max-h-[85vh] overflow-auto">
            {/* Header */}
            <div className="px-6 py-5 border-b border-theme">
              <Dialog.Title className="text-lg font-semibold text-theme-primary">
                Add Data Models
              </Dialog.Title>
              <Dialog.Description className="text-sm text-theme-secondary mt-1">
                Select a data model type to upload
              </Dialog.Description>
            </div>

            {/* Content */}
            <div className="p-4 space-y-2">
              {SUPPORTED_MODELS.map((model) => {
                return (
                  <div
                    key={model.id}
                    className="group relative rounded-lg border border-theme hover:border-theme-hover surface hover:surface-hover transition-all"
                  >
                    <div className="flex items-start p-4 gap-4">
                      {/* Column 1: Domain icon */}
                      <div className="shrink-0 pt-1">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${model.chipColor}15 0%, ${model.chipColor}08 100%)`,
                            border: `1.5px solid ${model.chipColor}30`
                          }}
                        >
                          <DomainIcon domain={model.id} size={30} />
                        </div>
                      </div>

                      {/* Column 2: Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap"
                            style={{
                              backgroundColor: `${model.chipColor}20`,
                              color: model.chipColor,
                              border: `1px solid ${model.chipColor}40`
                            }}
                          >
                            {model.domain}
                          </span>
                          <span className="text-xs text-theme-secondary font-mono">{model.formats}</span>
                        </div>
                        <p className="text-sm text-theme-primary font-medium mt-1">{model.description}</p>
                        <p className="text-xs text-theme-secondary mt-1">{model.instructions}</p>
                        {model.helpLink && (
                          model.helpLink.isInternal ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsInfoModalOpen(false);
                                if (onNavigate) {
                                  onNavigate('contextBuilder');
                                }
                              }}
                              className="text-xs text-primary hover:underline mt-2 inline-block"
                            >
                              {model.helpLink.label} →
                            </button>
                          ) : (
                            <a
                              href={model.helpLink.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline mt-2 inline-block"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {model.helpLink.label} →
                            </a>
                          )
                        )}
                      </div>

                      {/* Column 3: Actions - fixed width for alignment */}
                      <div className="w-[180px] shrink-0 flex items-start justify-end gap-2 pt-1">
                        {model.hasConverter && (
                          <button
                            onClick={() => {
                              setIsInfoModalOpen(false);
                              setTimeout(() => handleOpenConverter(), 100);
                            }}
                            className="px-3 py-2 text-sm rounded-md border border-theme hover:surface-hover text-theme-secondary hover:text-theme-primary transition-colors whitespace-nowrap"
                          >
                            Convert OPT
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setIsInfoModalOpen(false);
                            setTimeout(() => handleDomainUpload(model.id), 100);
                          }}
                          className="px-4 py-2 text-sm font-medium rounded-md btn-primary flex items-center gap-2"
                        >
                          <Upload size={14} />
                          Upload
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-theme bg-background/50">
              <p className="text-xs text-theme-secondary text-center">
                You can select multiple files at once. Drag & drop is also supported.
              </p>
            </div>

            <Dialog.Close asChild>
              <button
                className="absolute top-4 right-4 p-1.5 rounded-md hover:surface-hover focus:outline-none transition-colors"
                aria-label="Close"
              >
                <X size={16} className="text-theme-secondary" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Converter Modal */}
      <Dialog.Root
        open={isConverterOpen}
        onOpenChange={(open) => {
          if (isConverting) return;
          setIsConverterOpen(open);
        }}
        onEscapeKeyDown={e => isConverting && e.preventDefault()}
        onPointerDownOutside={e => isConverting && e.preventDefault()}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl surface border border-theme rounded-lg shadow-lg p-6 z-50 max-h-[90vh] overflow-auto">
            <Dialog.Title className="text-xl font-bold text-theme-primary mb-4">
              Convert OPT to Web Template
            </Dialog.Title>

            <Tabs.Root value={activeTab} onValueChange={handleTabChange}>
              <Tabs.List className="flex mb-6 border-b border-theme">
                <Tabs.Trigger
                  value="file"
                  className={cn(
                    "px-4 py-2 text-sm font-medium",
                    activeTab === "file"
                      ? "text-primary border-b-2 border-primary"
                      : "text-theme-secondary hover:text-theme-primary"
                  )}
                >
                  Upload File
                </Tabs.Trigger>
                <Tabs.Trigger
                  value="paste"
                  className={cn(
                    "px-4 py-2 text-sm font-medium",
                    activeTab === "paste"
                      ? "text-primary border-b-2 border-primary"
                      : "text-theme-secondary hover:text-theme-primary"
                  )}
                >
                  Paste XML
                </Tabs.Trigger>
                {convertedTemplates.length > 0 && (
                  <Tabs.Trigger
                    value="result"
                    className={cn(
                      "px-4 py-2 text-sm font-medium",
                      activeTab === "result"
                        ? "text-primary border-b-2 border-primary"
                        : "text-theme-secondary hover:text-theme-primary"
                    )}
                  >
                    Result
                  </Tabs.Trigger>
                )}
              </Tabs.List>

              {error && (
                <div className="mb-4 p-3 bg-error/20 border border-error rounded text-error text-sm">
                  {error}
                </div>
              )}

              <Tabs.Content value="file" className="focus:outline-none">
                <div
                  className={cn(
                    "border-2 border-dashed rounded-md p-8 text-center cursor-pointer mb-4 transition-colors",
                    dragActive ? "border-primary bg-primary/10" : "border-theme hover:border-primary",
                    isConverting && "opacity-60 pointer-events-none"
                  )}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('opt-file-input').click()}
                >
                  <input
                    id="opt-file-input"
                    type="file"
                    accept=".opt,.xml"
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isConverting}
                  />

                  <FileUp className="mx-auto h-12 w-12 text-theme-secondary mb-2" />

                  <p className="text-theme-primary mb-1 font-medium">
                    {optFile ? optFile.name : "Drag and drop your OPT file here"}
                  </p>
                  <p className="text-theme-secondary text-sm">
                    {optFile ? `${(optFile.size / 1024).toFixed(2)} KB` : "or click to browse files"}
                  </p>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseConverter}
                    className="px-4 py-2 rounded-md text-theme-primary hover:surface-hover focus:outline-none"
                    disabled={isConverting}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleConvertFile}
                    disabled={isConverting || !optFile}
                    className={cn(
                      "px-4 py-2 rounded-md btn-primary font-medium flex items-center gap-2",
                      (isConverting || !optFile) ? "opacity-60 cursor-not-allowed" : ""
                    )}
                  >
                    {isConverting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Converting...
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        Convert
                      </>
                    )}
                  </button>
                </div>
              </Tabs.Content>

              <Tabs.Content value="paste" className="focus:outline-none">
                <div className="mb-4">
                  <label htmlFor="opt-content" className="block text-sm font-medium text-theme-primary mb-2">
                    Paste OPT XML Content
                  </label>
                  <textarea
                    id="opt-content"
                    rows={10}
                    value={optContent}
                    onChange={handleTextChange}
                    placeholder="<template xmlns:xsi=...>"
                    className="w-full px-3 py-2 bg-background border border-theme rounded-md text-theme-primary placeholder-theme-secondary focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isConverting}
                  />
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseConverter}
                    className="px-4 py-2 rounded-md text-theme-primary hover:surface-hover focus:outline-none"
                    disabled={isConverting}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={handleConvertText}
                    disabled={isConverting || !optContent.trim()}
                    className={cn(
                      "px-4 py-2 rounded-md btn-primary font-medium flex items-center gap-2",
                      (isConverting || !optContent.trim()) ? "opacity-60 cursor-not-allowed" : ""
                    )}
                  >
                    {isConverting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Converting...
                      </>
                    ) : (
                      <>
                        <FileText size={16} />
                        Convert
                      </>
                    )}
                  </button>
                </div>
              </Tabs.Content>

              {convertedTemplates.length > 0 && (
                <Tabs.Content value="result" className="focus:outline-none">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-theme-primary">
                        Web Template Conversion Result
                      </h3>
                      <p className="text-sm text-theme-secondary">
                        Template ID: {convertedTemplates[selectedTemplateIndex]?.metadata?.templateId || 'Unknown'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveJSON}
                        className="px-3 py-2 rounded-md bg-success text-success-text text-sm font-medium flex items-center gap-1 hover:opacity-80"
                      >
                        <Save size={14} />
                        Save JSON
                      </button>
                      <button
                        type="button"
                        onClick={toggleVisualize}
                        className={cn(
                          "px-3 py-2 rounded-md text-white text-sm font-medium flex items-center gap-1",
                          visualizeActive ? "bg-primary hover:bg-primary-hover" : "btn-primary"
                        )}
                      >
                        <Eye size={14} />
                        {visualizeActive ? "Hide Visualization" : "Visualize"}
                      </button>
                    </div>
                  </div>

                  {visualizeActive ? (
                    <div className="bg-background border border-theme rounded-md p-4 mb-4">
                      <TemplateVisualizer template={convertedTemplates[selectedTemplateIndex]?.webTemplate} />
                    </div>
                  ) : (
                    <pre className="bg-background border border-theme rounded-md p-4 overflow-auto text-theme-primary text-sm">
                      {JSON.stringify(convertedTemplates[selectedTemplateIndex]?.webTemplate, null, 2)}
                    </pre>
                  )}

                  <div className="flex justify-between mt-6">
                    <div>
                      {convertedTemplates.length > 1 && (
                        <div className="flex items-center text-theme-primary text-sm">
                          <span>Model {selectedTemplateIndex + 1} of {convertedTemplates.length}</span>
                          <button
                            onClick={() => setSelectedTemplateIndex(Math.max(0, selectedTemplateIndex - 1))}
                            disabled={selectedTemplateIndex === 0}
                            className={cn(
                              "ml-2 p-1 rounded",
                              selectedTemplateIndex === 0 ? "text-theme-secondary" : "text-theme-primary hover:surface-hover"
                            )}
                          >
                            Prev
                          </button>
                          <button
                            onClick={() => setSelectedTemplateIndex(Math.min(convertedTemplates.length - 1, selectedTemplateIndex + 1))}
                            disabled={selectedTemplateIndex === convertedTemplates.length - 1}
                            className={cn(
                              "ml-2 p-1 rounded",
                              selectedTemplateIndex === convertedTemplates.length - 1 ? "text-theme-secondary" : "text-theme-primary hover:surface-hover"
                            )}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCloseConverter}
                        className="px-4 py-2 rounded-md text-theme-primary hover:surface-hover focus:outline-none"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleUploadConverted}
                        className="px-4 py-2 rounded-md bg-success text-success-text font-medium flex items-center gap-2 hover:opacity-80"
                      >
                        <Upload size={16} />
                        Upload Data Models
                      </button>
                    </div>
                  </div>
                </Tabs.Content>
              )}
            </Tabs.Root>

            <Dialog.Close asChild>
              <button
                className="absolute top-4 right-4 p-1 rounded-full hover:surface-hover focus:outline-none"
                aria-label="Close"
                disabled={isConverting}
              >
                <X size={18} className="text-theme-secondary" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
};

const TemplateVisualizer = ({ template }) => {
  if (!template) {
    return <div className="text-theme-secondary">No data model structure to visualize</div>;
  }
  return (
    <div className="template-visualizer">
      <h3 className="text-lg font-medium text-theme-primary mb-2">

        {template.name}
      </h3>
      <p className="text-sm text-theme-secondary mb-4">

        {template.localizedDescriptions && Object.values(template.localizedDescriptions)[0] || 'No description available'}
      </p>

      <TreeNode node={template} depth={0} />
    </div>
  );
};

// Component to render each node in the tree
const TreeNode = ({ node, depth }) => {
  const [expanded, setExpanded] = useState(depth < 2);

  const hasChildren = node.children && node.children.length > 0;
  const paddingLeft = `${depth * 20}px`;
  const archetypeNodeId = node.nodeId || node.archetypeNodeId;

  const toggleExpanded = (e) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div className="mb-1">
      <div
        className="flex items-start py-1 px-2 rounded hover:surface-hover cursor-pointer"
        style={{ paddingLeft }}
        onClick={toggleExpanded}
      >
        {hasChildren && (
          <span className="mr-2 text-theme-secondary">
            {expanded ? '▼' : '►'}
          </span>
        )}
        <div className="flex-1">
          <div className="flex items-start">
            <span className="font-medium text-theme-primary">{node.name}</span>
            <span className="ml-2 text-xs px-1.5 py-0.5 rounded surface text-theme-primary">
              {node.rmType}
            </span>
            {archetypeNodeId && (
              <span className="ml-2 text-xs font-mono text-theme-secondary">
                {archetypeNodeId}
              </span>
            )}
            <span className="ml-2 text-xs text-theme-secondary">
              {node.min}-{node.max === -1 ? '*' : node.max}
            </span>
          </div>
          {node.inputs && (
            <div className="text-xs text-theme-secondary mt-1">
              Inputs: {node.inputs.map(input => input.type).join(', ')}
            </div>
          )}
          {node.aqlPath && (
            <div className="text-xs text-theme-secondary mt-1 break-all">
              Path: {node.aqlPath}
            </div>
          )}
        </div>
      </div>

      {expanded && hasChildren && (
        <div className="mt-1">
          {node.children.map((child, index) => (
            <TreeNode
              key={`${child.id}-${index}`}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

DataModelUpload.propTypes = {
  onUpload: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
  onNavigate: PropTypes.func
};

export default DataModelUpload;
