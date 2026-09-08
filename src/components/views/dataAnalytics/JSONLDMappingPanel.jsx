//src/components/views/openEhrAnalytics/JSONLDMappingsPanel.jsx 
"use client";

import React, { useState } from 'react';
import { Save, Copy, RefreshCcw } from 'lucide-react';
import CollapsibleSection from '../../common/CollapsibleSection';
import TreeView from '../../common/TreeView';
import { useMemo, useCallback } from 'react';
import { collectTargetFields } from '@/lib/templates/webtemplate-fields';
import { Loader2 } from 'lucide-react';


// Make a safe segment for dot paths
const seg = (s) => String(s || '')
  .replace(/[^a-zA-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

// Build a dot path from the field’s ancestor labels
const toDotPath = (field) => {
  const chain = (field.ancestors || [])
    .map(n => n.localizedNames?.en ?? n.name ?? n.localizedName ?? n.nodeId ?? n.id)
    .concat(field.field);
  return chain.map(seg).join('.');
};

const JSONLDMappingPanel = ({
  template,
  mappingConfig,
  onMappingChange,
  jsonLdPreview,
  mqlPipeline,
  onSaveMapping,
  loading
}) => {
  const [activePropertyIndex, setActivePropertyIndex] = useState(null);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);

  // pick the real tree root (support .webTemplate or .tree or pass-through)
  const templateTree = useMemo(
    () => template?.webTemplate || template?.tree || template || null,
    [template]
  );

  // Collect DV_* leaf fields with rich metadata (aqlPath, mappingKey, ancestors, etc.)
  const fields = useMemo(
    () => (templateTree ? collectTargetFields(templateTree) : []),
    [templateTree]
  );

  // Map nodeId/id -> field for fast lookup when a TreeView node is clicked
  const fieldByKey = useMemo(() => {
    const m = new Map();
    fields.forEach(f => {
      const key = f?.node?.nodeId || f?.node?.id;
      if (key) m.set(key, f);
    });
    return m;
  }, [fields]);

  // Only DV_* leaves are selectable
  const isSelectable = useCallback((node) => {
    const key = node?.nodeId || node?.id;
    return key && fieldByKey.has(key);
  }, [fieldByKey]);

  const handleContextChange = (e) => {
    onMappingChange({
      ...mappingConfig,
      context: e.target.value
    });
  };

  const handleTypeChange = (e) => {
    onMappingChange({
      ...mappingConfig,
      type: e.target.value
    });
  };

  const handleIdPathChange = (e) => {
    onMappingChange({
      ...mappingConfig,
      idPath: e.target.value
    });
  };

  const handleNodeSelect = (node) => {
    const key = node?.nodeId || node?.id;
    const f = key ? fieldByKey.get(key) : null;
    if (!f) return;

    // Choose the path representation you prefer:
    //  - dot path for document projection:
    const chosenPath = toDotPath(f);
    //  - OR switch to AQL-ish key by using: const chosenPath = f.mappingKey || f.aqlPath;

    if (activePropertyIndex !== null) {
      const updated = [...mappingConfig.properties];
      updated[activePropertyIndex] = { ...updated[activePropertyIndex], path: chosenPath };
      onMappingChange({ ...mappingConfig, properties: updated });
      setActivePropertyIndex(null);
    } else {
      onMappingChange({ ...mappingConfig, idPath: chosenPath });
    }
  };

  const handleIdNodeSelect = () => {
    // This is a placeholder - the actual selection happens in handleNodeSelect
    // This just signals that we're selecting for the @id
    setActivePropertyIndex(null);
  };

  const handleAddProperty = () => {
    onMappingChange({
      ...mappingConfig,
      properties: [...mappingConfig.properties, { name: '', path: '' }]
    });
    // Set the newly added property as active
    setActivePropertyIndex(mappingConfig.properties.length);
  };

  const handleRemoveProperty = (index) => {
    const updatedProperties = mappingConfig.properties.filter((_, i) => i !== index);
    onMappingChange({
      ...mappingConfig,
      properties: updatedProperties
    });

    // Reset active property if the removed one was active
    if (activePropertyIndex === index) {
      setActivePropertyIndex(null);
    } else if (activePropertyIndex > index) {
      // Adjust index if we removed a property before the active one
      setActivePropertyIndex(activePropertyIndex - 1);
    }
  };

  const handlePropertyNameChange = (index, value) => {
    const updatedProperties = [...mappingConfig.properties];
    updatedProperties[index] = {
      ...updatedProperties[index],
      name: value
    };

    onMappingChange({
      ...mappingConfig,
      properties: updatedProperties
    });
  };

  const handlePropertyPathChange = (index, value) => {
    const updatedProperties = [...mappingConfig.properties];
    updatedProperties[index] = {
      ...updatedProperties[index],
      path: value
    };

    onMappingChange({
      ...mappingConfig,
      properties: updatedProperties
    });
  };

  const handleSetActiveProperty = (index) => {
    setActivePropertyIndex(index);
  };

  const copyMqlToClipboard = () => {
    if (mqlPipeline) {
      navigator.clipboard.writeText(JSON.stringify(mqlPipeline, null, 2));
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 2000);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Left Panel - Tree View */}
      <div className="lg:col-span-2 space-y-4">
        <CollapsibleSection
          title={`Template Structure: ${template.name}`}
          isExpanded={true}
          onToggle={() => { }}
        >
          <div className="bg-surface rounded-lg p-2 max-h-[calc(100vh-300px)] overflow-y-auto border border-theme">
            {templateTree && (
              <TreeView
                node={templateTree}
                onSelect={handleNodeSelect}
                isSelectable={isSelectable}
                defaultExpanded={false}
              />
            )}
            <div className="mt-2 text-xs text-theme-secondary">
              Selected path target:&nbsp;
              <code className="text-theme-primary">
                {activePropertyIndex !== null
                  ? (mappingConfig.properties[activePropertyIndex]?.path || '(none)')
                  : (mappingConfig.idPath || '(none)')}
              </code>
            </div>
          </div>
        </CollapsibleSection>
      </div>

      {/* Right Panel - Mapping Configuration */}
      <div className="lg:col-span-3 space-y-4">
        {/* Basic Configuration */}
        <CollapsibleSection
          title="JSON-LD Configuration"
          isExpanded={true}
          onToggle={() => { }}
        >
          <div className="space-y-4">
            {/* @context */}
            <div>
              <label className="block mb-2 text-sm font-medium text-theme-primary">
                @context <span className="text-theme-secondary">(URI for vocabulary)</span>
              </label>
              <input
                type="text"
                value={mappingConfig.context}
                onChange={handleContextChange}
                className="w-full px-3 py-2 surface border border-theme rounded-md 
                         text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="https://schema.org/"
              />
            </div>

            {/* @type */}
            <div>
              <label className="block mb-2 text-sm font-medium text-theme-primary">
                @type <span className="text-theme-secondary">(Type of entity)</span>
              </label>
              <input
                type="text"
                value={mappingConfig.type}
                onChange={handleTypeChange}
                className="w-full px-3 py-2 surface border border-theme rounded-md 
                         text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="MedicalImmunization"
              />
            </div>

            {/* @id */}
            <div>
              <label className="block mb-2 text-sm font-medium text-theme-primary">
                @id Path
                <span className="text-theme-secondary ml-2">(OpenEHR path to use as identifier)</span>
                <button
                  onClick={handleIdNodeSelect}
                  className={`ml-2 px-2 py-1 text-xs rounded-md ${activePropertyIndex === null
                      ? 'bg-primary text-primary-text'
                      : 'surface text-theme-primary'
                    }`}
                >
                  {activePropertyIndex === null ? 'Selecting...' : 'Select from tree'}
                </button>
              </label>
              <input
                type="text"
                value={mappingConfig.idPath}
                onChange={handleIdPathChange}
                className="w-full px-3 py-2 surface border border-theme rounded-md 
                         text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="canonicalJSON.uid.value"
              />
            </div>
          </div>
        </CollapsibleSection>

        {/* Properties */}
        <CollapsibleSection
          title="Properties"
          isExpanded={true}
          onToggle={() => { }}
        >
          <div className="space-y-4">
            {mappingConfig.properties.map((property, index) => (
              <div
                key={index}
                className={`grid grid-cols-6 gap-3 p-3 rounded-md ${activePropertyIndex === index
                    ? 'bg-primary/10 border border-primary'
                    : 'surface border border-theme'
                  }`}
              >
                <div className="col-span-2">
                  <label className="block mb-1 text-xs font-medium text-theme-secondary">
                    Property Name
                  </label>
                  <input
                    type="text"
                    value={property.name}
                    onChange={(e) => handlePropertyNameChange(index, e.target.value)}
                    className="w-full px-2 py-1 surface border border-theme rounded-md 
                             text-theme-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="name"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block mb-1 text-xs font-medium text-theme-secondary">
                    Property Path
                  </label>
                  <input
                    type="text"
                    value={property.path}
                    onChange={(e) => handlePropertyPathChange(index, e.target.value)}
                    className="w-full px-2 py-1 surface border border-theme rounded-md 
                             text-theme-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="canonicalJSON.property.path"
                  />
                </div>
                <div className="col-span-1 flex flex-col justify-end">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSetActiveProperty(index)}
                      className={`px-2 py-1 text-xs rounded-md ${activePropertyIndex === index
                          ? 'bg-primary text-primary-text'
                          : 'surface-hover text-theme-primary'
                        }`}
                    >
                      {activePropertyIndex === index ? 'Selecting...' : 'Select'}
                    </button>
                    <button
                      onClick={() => handleRemoveProperty(index)}
                      className="px-2 py-1 text-xs bg-error/20 text-error rounded-md 
                               hover:bg-error/30"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}

            <button
              onClick={handleAddProperty}
              className="w-full py-2 surface border border-dashed border-theme 
                       text-theme-secondary rounded-md hover:surface-hover hover:text-theme-primary"
            >
              + Add Property
            </button>
          </div>
        </CollapsibleSection>

        {/* Preview */}
        <CollapsibleSection
          title="JSON-LD Preview"
          isExpanded={true}
          onToggle={() => { }}
        >
          <div className="surface p-4 rounded-md border border-theme">
            {jsonLdPreview ? (
              <pre className="text-sm text-success whitespace-pre-wrap">
                {JSON.stringify(jsonLdPreview, null, 2)}
              </pre>
            ) : (
              <p className="text-theme-secondary italic">
                Configure your mapping to see the JSON-LD preview.
              </p>
            )}
          </div>
        </CollapsibleSection>

        {/* MongoDB Query */}
        <CollapsibleSection
          title="MongoDB Aggregation Pipeline"
          isExpanded={true}
          onToggle={() => { }}
          helpText="Copy this pipeline to use in your MongoDB Atlas to transform your data."
        >
          <div className="space-y-4">
            <div className="surface p-4 rounded-md relative border border-theme">
              {mqlPipeline ? (
                <>
                  <button
                    onClick={copyMqlToClipboard}
                    className="absolute top-2 right-2 p-2 surface-hover rounded-md 
                             text-theme-primary"
                    title="Copy to clipboard"
                  >
                    {copiedToClipboard ? <RefreshCcw size={16} /> : <Copy size={16} />}
                  </button>
                  <pre className="text-sm text-primary whitespace-pre-wrap pr-8">
                    {JSON.stringify(mqlPipeline, null, 2)}
                  </pre>
                </>
              ) : (
                <p className="text-theme-secondary italic">
                  Configure your mapping to see the MongoDB aggregation pipeline.
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={onSaveMapping}
                disabled={loading || !mappingConfig.type}
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-primary-text
                          ${loading || !mappingConfig.type
                    ? 'surface text-theme-secondary cursor-not-allowed'
                    : 'btn-primary'}`}
              >
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Save Mapping
              </button>
            </div>
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
};

export default JSONLDMappingPanel;