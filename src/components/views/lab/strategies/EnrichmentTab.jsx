//src/components/views/lab/strategies/EnrichementTab.jsx 
'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { AlignLeft, Cog, Layers } from 'lucide-react';
import TreeView from '@/components/common/TreeView';
import { collectTargetFields } from '@/lib/templates/webtemplate-fields';

// small helper: stable key segment from any node/label
const seg = (s) => String(s || '')
  .replace(/[^a-zA-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

// build the dot path under "nodes." using ancestors we already have
const toDotPath = (field) => {
  // ancestors include SECTION/ENTRY/ELEMENT chain ending at the DV_* leaf node
  const chain = (field.ancestors || [])
    .map(n => n.localizedNames?.en ?? n.name ?? n.localizedName ?? n.nodeId ?? n.id)
    .concat(field.field); // leaf label
  return chain.map(seg).join('.');
};

const EnrichmentTab = ({ selectedTemplate, strategyConfig, setStrategyConfig }) => {
  const [enrichmentType, setEnrichmentType] = useState('fulltext');
  const [enrichmentPath, setEnrichmentPath] = useState('');

  // accept either .tree (server) or .webTemplate (client) as the root
  const templateTree = useMemo(
    () => selectedTemplate?.webTemplate || selectedTemplate?.tree || null,
    [selectedTemplate]
  );

  // Precompute all selectable DV_* leaves with rich metadata
  const fields = useMemo(
    () => (templateTree ? collectTargetFields(templateTree) : []),
    [templateTree]
  );

  // fast lookup: nodeId/id -> field
  const fieldByNodeKey = useMemo(() => {
    const m = new Map();
    fields.forEach(f => {
      const node = f.node || {};
      const key = node.nodeId || node.id;
      if (key) m.set(key, f);
    });
    return m;
  }, [fields]);

  const isSelectable = useCallback((node) => {
    if (!node) return false;
    const key = node.nodeId || node.id;
    return key && fieldByNodeKey.has(key); // only DV_* leaves
  }, [fieldByNodeKey]);

  const handleTreeNodeSelect = useCallback((node) => {
    const key = node?.nodeId || node?.id;
    const f = key ? fieldByNodeKey.get(key) : null;
    if (!f) return;
    // choose the path representation you want to store:
    // 1) dot path for Atlas Search field: nodes.<dot path>
    // 2) or f.mappingKey if you prefer the normalized AQL path key
    const dot = toDotPath(f);
    setEnrichmentPath(dot);
  }, [fieldByNodeKey]);

  // Add an enrichment to the configuration
  const addEnrichment = () => {
    if (!enrichmentPath) return;

    const updatedConfig = { ...strategyConfig };

    if (enrichmentType === 'fulltext') {
      // Add a new fulltext field to Atlas Search
      if (!updatedConfig.atlasSearch) {
        updatedConfig.atlasSearch = {
          enabled: true,
          indexes: []
        };
      }

      if (!updatedConfig.atlasSearch.indexes) {
        updatedConfig.atlasSearch.indexes = [];
      }

      // Check if we already have a fulltext index
      let fulltextIndex = updatedConfig.atlasSearch.indexes.find(idx => idx.name === "fulltext_nodes");

      if (!fulltextIndex) {
        fulltextIndex = {
          name: "fulltext_nodes",
          definition: {
            mappings: {
              dynamic: false,
              fields: {}
            }
          }
        };
        updatedConfig.atlasSearch.indexes.push(fulltextIndex);
      }

      // Add the field to the index
      fulltextIndex.definition.mappings.fields[`nodes.${enrichmentPath}`] = {
        type: "string"
      };

      updatedConfig.atlasSearch.enabled = true;
    }
    else if (enrichmentType === 'calculated') {
      // Add a calculated field
      if (!updatedConfig.enrichment) {
        updatedConfig.enrichment = { calculatedFields: [], vectorEmbeddings: [] };
      }

      updatedConfig.enrichment.calculatedFields.push({
        name: enrichmentPath.split('.').pop(),
        path: enrichmentPath,
        expression: `${enrichmentPath}`
      });
    }
    else if (enrichmentType === 'vector') {
      // Add a vector embedding field
      if (!updatedConfig.enrichment) {
        updatedConfig.enrichment = { calculatedFields: [], vectorEmbeddings: [] };
      }

      updatedConfig.enrichment.vectorEmbeddings.push({
        name: `${enrichmentPath.split('.').pop()}_embedding`,
        path: enrichmentPath,
        dimensions: 768,
        model: "default"
      });

      // Make sure Atlas Search is enabled
      if (!updatedConfig.atlasSearch) {
        updatedConfig.atlasSearch = { enabled: true, indexes: [] };
      }

      // Add vector search index if not exists
      let vectorIndex = updatedConfig.atlasSearch.indexes.find(idx => idx.name === "vector_search");

      if (!vectorIndex) {
        vectorIndex = {
          name: "vector_search",
          definition: {
            mappings: {
              dynamic: false,
              fields: {}
            }
          }
        };
        updatedConfig.atlasSearch.indexes.push(vectorIndex);
      }

      // Add vector field to index
      vectorIndex.definition.mappings.fields[`${enrichmentPath.split('.').pop()}_embedding`] = {
        type: "vector",
        dimensions: 768,
        similarity: "cosine"
      };
    }

    setStrategyConfig(updatedConfig);
    setEnrichmentPath('');
  };

  return (
    <div className="dark-banner bg-slate-800 rounded-lg p-6">
      <h2 className="text-xl font-bold text-slate-100 mb-4">Data Enrichment</h2>

      <p className="text-slate-300 mb-6">
        The Semi-Flattened strategy allows for powerful data enrichment options that can enhance your
        openEHR data with additional capabilities for analytics, search, and AI applications.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-slate-700 p-4 rounded-lg">
          <h3 className="text-slate-200 font-semibold mb-3 flex items-center">
            <AlignLeft className="w-4 h-4 mr-2" />
            Full-Text Search
          </h3>

          <p className="text-slate-300 text-sm mb-3">
            Enable advanced text search capabilities with Atlas Search indexes for openEHR text fields.
          </p>

          <div className="bg-slate-800 p-3 rounded-lg">
            <h4 className="text-blue-400 font-medium mb-1">Features</h4>
            <ul className="list-disc pl-5 text-slate-300 text-sm space-y-1">
              <li>Language-aware text analysis</li>
              <li>Fuzzy matching for typo tolerance</li>
              <li>Synonyms and medical terminology support</li>
              <li>Wildcards and regular expressions</li>
              <li>Phrase and proximity searches</li>
            </ul>
          </div>
        </div>

        <div className="bg-slate-700 p-4 rounded-lg">
          <h3 className="text-slate-200 font-semibold mb-3 flex items-center">
            <Cog className="w-4 h-4 mr-2" />
            Calculated Fields
          </h3>

          <p className="text-slate-300 text-sm mb-3">
            Add computed fields to your documents for analytics, unit conversions, or derived metrics.
          </p>

          <div className="bg-slate-800 p-3 rounded-lg">
            <h4 className="text-blue-400 font-medium mb-1">Examples</h4>
            <ul className="list-disc pl-5 text-slate-300 text-sm space-y-1">
              <li>BMI calculation from height and weight</li>
              <li>Age derivation from birth date</li>
              <li>Unit conversions (mmol/L to mg/dL)</li>
              <li>Risk scores and clinical calculations</li>
              <li>Aggregated values across observations</li>
            </ul>
          </div>
        </div>

        <div className="bg-slate-700 p-4 rounded-lg">
          <h3 className="text-slate-200 font-semibold mb-3 flex items-center">
            <Layers className="w-4 h-4 mr-2" />
            Vector Embeddings
          </h3>

          <p className="text-slate-300 text-sm mb-3">
            Add vector embeddings to enable semantic search and AI-powered analytics.
          </p>

          <div className="bg-slate-800 p-3 rounded-lg">
            <h4 className="text-blue-400 font-medium mb-1">Capabilities</h4>
            <ul className="list-disc pl-5 text-slate-300 text-sm space-y-1">
              <li>Semantic similarity search</li>
              <li>Natural language querying</li>
              <li>Finding related clinical concepts</li>
              <li>Multi-modal search (text + structured data)</li>
              <li>Integration with ML/AI workflows</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 bg-slate-700 rounded-lg p-4">
          <h3 className="text-slate-200 font-semibold mb-3">Template Structure</h3>

          {templateTree ? (
            <div className="bg-slate-800 rounded-lg p-2 max-h-[400px] overflow-y-auto">
              <TreeView
                node={templateTree}
                onSelect={handleTreeNodeSelect}
                isSelectable={isSelectable}
                defaultExpanded={false}
              />
              {enrichmentPath && (
                <div className="mt-2 text-xs text-slate-400">
                  Selected path:&nbsp;
                  <code className="text-slate-300">{enrichmentPath}</code>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-800 rounded-lg p-4 text-center">
              <p className="text-slate-400">Select a template to see its structure</p>
            </div>
          )}
        </div>

        <div className="md:col-span-2 bg-slate-700 rounded-lg p-4">
          <h3 className="text-slate-200 font-semibold mb-3">Add Enrichment</h3>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-300">
                  Enrichment Type
                </label>
                <select
                  value={enrichmentType}
                  onChange={(e) => setEnrichmentType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-md 
                            text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="fulltext">Full-Text Search</option>
                  <option value="calculated">Calculated Field</option>
                  <option value="vector">Vector Embedding</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block mb-2 text-sm font-medium text-slate-300">
                  Field Path
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={enrichmentPath}
                    onChange={(e) => setEnrichmentPath(e.target.value)}
                    placeholder="Select a path from the template or enter manually"
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-md 
                             text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={addEnrichment}
                    disabled={!enrichmentPath}
                    className="px-4 py-2 bg-primary text-primary-text rounded-md hover:bg-primary-hover
                             disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            {enrichmentType === 'fulltext' && (
              <div className="bg-slate-800 p-3 rounded-lg">
                <h4 className="text-blue-400 font-medium mb-2">Full-Text Search Configuration</h4>
                <p className="text-slate-300 text-sm">
                  This will add the selected field to the Atlas Search index, enabling advanced text search
                  capabilities including fuzzy matching and language support.
                </p>
              </div>
            )}

            {enrichmentType === 'calculated' && (
              <div className="bg-slate-800 p-3 rounded-lg">
                <h4 className="text-blue-400 font-medium mb-2">Calculated Field</h4>
                <p className="text-slate-300 text-sm mb-3">
                  This will add a calculated field derived from the selected path. You can specify
                  MongoDB&apos;s aggregation expressions to transform the data.
                </p>

                <div>
                  <label className="block mb-2 text-sm font-medium text-slate-300">
                    Expression
                  </label>
                  <input
                    type="text"
                    placeholder="$nodes.path.to.field"
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md 
                             text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {enrichmentType === 'vector' && (
              <div className="bg-slate-800 p-3 rounded-lg">
                <h4 className="text-blue-400 font-medium mb-2">Vector Embedding</h4>
                <p className="text-slate-300 text-sm mb-3">
                  This will configure the field for vector embeddings, enabling semantic search capabilities.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-slate-300">
                      Dimensions
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md 
                               text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="768">768</option>
                      <option value="1024">1024</option>
                      <option value="1536">1536</option>
                    </select>
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium text-slate-300">
                      Similarity Metric
                    </label>
                    <select
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-md 
                               text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="cosine">Cosine</option>
                      <option value="euclidean">Euclidean</option>
                      <option value="dotProduct">Dot Product</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            <h4 className="text-slate-200 font-medium mb-2">Current Enrichments</h4>

            {strategyConfig?.enrichment?.calculatedFields?.length > 0 ||
              strategyConfig?.enrichment?.vectorEmbeddings?.length > 0 ||
              (strategyConfig?.atlasSearch?.indexes?.length > 0 && strategyConfig?.atlasSearch?.enabled) ? (
              <div className="space-y-2">
                {strategyConfig?.enrichment?.calculatedFields?.map((field, index) => (
                  <div key={`calc-${index}`} className="bg-slate-800 p-2 rounded-lg flex justify-between items-center">
                    <div>
                      <span className="text-green-400 text-sm mr-2">Calculated:</span>
                      <span className="text-slate-300 text-sm">{field.name} ({field.path})</span>
                    </div>
                    <button
                      className="text-red-400 hover:text-red-300 p-1"
                      onClick={() => {
                        const updated = { ...strategyConfig };
                        updated.enrichment.calculatedFields.splice(index, 1);
                        setStrategyConfig(updated);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {strategyConfig?.enrichment?.vectorEmbeddings?.map((field, index) => (
                  <div key={`vec-${index}`} className="bg-slate-800 p-2 rounded-lg flex justify-between items-center">
                    <div>
                      <span className="text-blue-400 text-sm mr-2">Vector:</span>
                      <span className="text-slate-300 text-sm">{field.name} ({field.dimensions}d)</span>
                    </div>
                    <button
                      className="text-red-400 hover:text-red-300 p-1"
                      onClick={() => {
                        const updated = { ...strategyConfig };
                        updated.enrichment.vectorEmbeddings.splice(index, 1);
                        setStrategyConfig(updated);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {strategyConfig?.atlasSearch?.indexes?.map((index, idx) => (
                  <React.Fragment key={`idx-${idx}`}>
                    {index.definition?.mappings?.fields && Object.keys(index.definition.mappings.fields).map((field, fieldIdx) => (
                      <div key={`field-${fieldIdx}`} className="bg-slate-800 p-2 rounded-lg flex justify-between items-center">
                        <div>
                          <span className="text-yellow-400 text-sm mr-2">Search Index:</span>
                          <span className="text-slate-300 text-sm">{field}</span>
                        </div>
                        <button
                          className="text-red-400 hover:text-red-300 p-1"
                          onClick={() => {
                            const updated = { ...strategyConfig };
                            delete updated.atlasSearch.indexes[idx].definition.mappings.fields[field];
                            setStrategyConfig(updated);
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <div className="bg-slate-800 p-3 rounded-lg text-center">
                <p className="text-slate-400 text-sm">
                  No enrichments configured yet
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div >
  );
};

export default EnrichmentTab;