//src/components/views/openEhrAnalytics/OpenEhrAnalyticsPanel.jsx 
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
import { Loader2, AlertCircle } from 'lucide-react';
import { useDataModels } from '@/providers/DataModelProvider';

// Import components
import JSONLDMappingPanel from './JSONLDMappingPanel';
import JSONLDQueryExplorer from './JSONLDQueryExplorer';
import MappingTemplateSelector from './MappingTemplateSelector';

const OpenEHRAnalyticsPanel = () => {
  const [activeTab, setActiveTab] = useState('mapping');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [mappingConfig, setMappingConfig] = useState({
    context: "https://schema.org/",
    type: "",
    idPath: "",
    properties: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [jsonLdPreview, setJsonLdPreview] = useState(null);
  const [mqlPipeline, setMqlPipeline] = useState(null);
  const [savedMappings, setSavedMappings] = useState([]);


  const { dataModelsByName: templatesByName, isLoading: templatesLoading } = useDataModels();
  const templates = useMemo(
    () => Object.values(templatesByName || {}),
    [templatesByName]
  );


  // Fetch saved mappings
  const fetchSavedMappings = useCallback(async () => {
    try {
      const response = await fetch('/api/jsonld-mappings');
      if (!response.ok) throw new Error('Failed to fetch saved mappings');
      const raw = await response.json();
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.results)
            ? raw.results
            : (raw && typeof raw === 'object' ? Object.values(raw) : []);
      setSavedMappings(list);
    } catch (err) {
      console.error("Error in fetchSavedMappings:", err);
      // Non-fatal: keep UI usable
    }
  }, []);

  useEffect(() => {
    fetchSavedMappings();
  }, [fetchSavedMappings]);

  const handleTemplateSelect = (templateName) => {
    const template = templates.find(t => t.name === templateName);
    setSelectedTemplate(template || null);
    setMappingConfig({
      context: "https://schema.org/",
      type: "",
      idPath: "",
      properties: []
    });
  };

  const handleSaveMapping = async () => {
    if (!selectedTemplate || !mappingConfig.type) {
      setError("Please select a template and set a type for your mapping");
      return;
    }

    try {
      setLoading(true);
      const mappingToSave = {
        templateName: selectedTemplate.name,
        templateId: selectedTemplate._id,
        config: mappingConfig,
        name: `${selectedTemplate.name} - ${mappingConfig.type} Mapping`
      };

      // Replace with your actual API endpoint for saving mappings
      const response = await fetch('/api/jsonld-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappingToSave)
      });

      if (!response.ok) {
        throw new Error('Failed to save mapping');
      }

      // Refresh saved mappings
      await fetchSavedMappings();

      // Show success message
      setError(null);
    } catch (err) {
      console.error("Error saving mapping:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMappingChange = (newConfig) => {
    setMappingConfig(newConfig);

    // Generate preview and MQL pipeline
    generateJsonLdPreview(newConfig);
    generateMqlPipeline(newConfig);
  };

  const generateJsonLdPreview = (config) => {
    if (!config?.type) {
      setJsonLdPreview(null);
      return;
    }

    const preview = {
      "@context": config.context,
      "@type": config.type,
    };

    if (config.idPath) {
      preview["@id"] = `$${config.idPath}`;
    }

    config.properties.forEach(prop => {
      if (prop.name && prop.path) {
        preview[prop.name] = `$${prop.path}`;
      }
    });

    setJsonLdPreview(preview);
  };

  const generateMqlPipeline = (config) => {
    if (!config?.type) {
      setMqlPipeline(null);
      return;
    }

    const pipeline = [
      {
        "$project": {
          "_id": 1,
          "ehr_id": 1,
          "composition_id": 1,
          "json_ld": {
            "@context": config.context,
            "@type": config.type,
          }
        }
      }
    ];

    if (config.idPath) {
      pipeline[0].$project.json_ld["@id"] = `$${config.idPath}`;
    }

    config.properties.forEach(prop => {
      if (prop.name && prop.path) {
        pipeline[0].$project.json_ld[prop.name] = `$${prop.path}`;
      }
    });

    setMqlPipeline(pipeline);
  };

  const handleLoadMapping = (mapping) => {
    setSelectedTemplate(templatesByName?.[mapping.templateName] || null);
    setMappingConfig(mapping.config);
    generateJsonLdPreview(mapping.config);
    generateMqlPipeline(mapping.config);
  };

  const handleDeleteMapping = async (mappingId) => {
    try {
      setLoading(true);
      // Replace with your actual API endpoint for deleting mappings
      const response = await fetch(`/api/jsonld-mappings/${mappingId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete mapping');
      }

      // Refresh saved mappings
      await fetchSavedMappings();
    } catch (err) {
      console.error("Error deleting mapping:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-background">
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-6 text-theme-primary text-center">
          OpenEHR Analytics with JSON-LD
        </h1>

        <Tabs.Root
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <Tabs.List className="flex border-b border-theme mb-4">
            <Tabs.Trigger
              value="mapping"
              className={cn(
                "px-4 py-2 -mb-px text-sm font-medium text-theme-secondary",
                "hover:text-theme-primary focus:outline-none",
                "data-[state=active]:text-primary data-[state=active]:border-b-2",
                "data-[state=active]:border-primary"
              )}
            >
              JSON-LD Mapping
            </Tabs.Trigger>
            <Tabs.Trigger
              value="explorer"
              className={cn(
                "px-4 py-2 -mb-px text-sm font-medium text-theme-secondary",
                "hover:text-theme-primary focus:outline-none",
                "data-[state=active]:text-primary data-[state=active]:border-b-2",
                "data-[state=active]:border-primary"
              )}
            >
              Query Explorer
            </Tabs.Trigger>
          </Tabs.List>

          {error && (
            <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-md flex items-start gap-2">
              <AlertCircle className="text-error mt-0.5" size={16} />
              <p className="text-error text-sm">{error}</p>
            </div>
          )}

          <Tabs.Content value="mapping" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Left Panel - Template Selection */}
              <div className="lg:col-span-1 space-y-4">
                <div className="surface rounded-lg p-4 border border-theme">
                  <h2 className="text-lg font-medium text-theme-primary mb-4">Templates</h2>
                  {templatesLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="animate-spin text-primary" size={24} />
                    </div>
                  ) : (
                    <MappingTemplateSelector
                      templates={templates}
                      savedMappings={Array.isArray(savedMappings) ? savedMappings : []}
                      onSelectTemplate={handleTemplateSelect}
                      onLoadMapping={handleLoadMapping}
                      onDeleteMapping={handleDeleteMapping}
                    />
                  )}
                </div>
              </div>

              {/* Right Panel - Mapping Interface */}
              <div className="lg:col-span-3 space-y-4">
                {selectedTemplate ? (
                  <JSONLDMappingPanel
                    template={selectedTemplate}
                    mappingConfig={mappingConfig}
                    onMappingChange={handleMappingChange}
                    jsonLdPreview={jsonLdPreview}
                    mqlPipeline={mqlPipeline}
                    onSaveMapping={handleSaveMapping}
                    loading={loading}
                  />
                ) : (
                  <div className="surface rounded-lg p-8 text-center border border-theme">
                    <h3 className="text-lg font-medium text-theme-primary mb-2">No Template Selected</h3>
                    <p className="text-theme-secondary">
                      Please select a template from the left panel to start creating your JSON-LD mapping.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="explorer" className="space-y-6">
            <JSONLDQueryExplorer
              savedMappings={savedMappings}
              loading={loading}
            />
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </div>
  );
};

export default OpenEHRAnalyticsPanel;
