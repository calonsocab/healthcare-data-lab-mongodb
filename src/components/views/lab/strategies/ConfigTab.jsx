//src/components/views/lab/strategies/ConfigTab.jsx 
'use client';

import React, { useState } from 'react';
import CodeViewer from '../../../common/CodeViewer';

/**
 * Configuration tab for the Semi-Flattened strategy panel
 * This component allows customizing the strategy configuration
 */
const ConfigTab = ({ strategyConfig, setStrategyConfig }) => {
  const [useShortNames, setUseShortNames] = useState(strategyConfig?.namingConvention?.useShortNames || true);
  
  // Default strategy configuration with semi-flattened model
  const defaultStrategyConfig = {
    model: "semiflattened",
    collection: "compositions",
    description: "Semi-flattened node structure for efficient querying of composition data",
    namingConvention: {
      useShortNames: true,
      archetypeIdPrefix: "openEHR-EHR-" // Can be removed for short names
    },
    fields: [
      { name: "_id", type: "ObjectId", index: "unique" },
      { name: "ehr_id", type: "string", index: true },
      { name: "comp_id", type: "ObjectId", index: true },
      { name: "composition_date", type: "ISODate", index: true },
      { name: "archetype_node_id", type: "string", index: true },
      { name: "nodes", type: "array" }
    ],
    indexes: [
      { 
        name: "nodes_type_archetype", 
        fields: { "nodes.node_data._type": 1, "nodes.node_data.archetype_details.archetype_id.value": 1 },
        description: "Index for searching by RM type and archetype ID" 
      },
      { 
        name: "nodes_archetype_path", 
        fields: { "nodes.archetype_path": 1 },
        description: "Index for archetype path searches" 
      },
      { 
        name: "nodes_ancestors", 
        fields: { "nodes.ancestors": 1 },
        description: "Index for ancestor traversal searches" 
      }
    ],
    atlasSearch: {
      enabled: false,
      indexes: [
        {
          name: "fulltext_nodes",
          definition: {
            mappings: {
              dynamic: false,
              fields: {
                "nodes.node_data.value.value": {
                  type: "string"
                }
              }
            }
          }
        }
      ]
    },
    enrichment: {
      calculatedFields: [],
      vectorEmbeddings: []
    }
  };
  
  // Toggle naming convention settings
  const toggleNamingConvention = () => {
    const newUseShortNames = !useShortNames;
    setUseShortNames(newUseShortNames);
    
    const updatedConfig = {...strategyConfig};
    if (!updatedConfig.namingConvention) {
      updatedConfig.namingConvention = {};
    }
    
    updatedConfig.namingConvention.useShortNames = newUseShortNames;
    setStrategyConfig(updatedConfig);
  };
  
  return (
    <div className="dark-banner bg-slate-800 rounded-lg p-6">
      <h2 className="text-xl font-bold text-slate-100 mb-4">Strategy Configuration</h2>
      
      <p className="text-slate-300 mb-6">
        Customize your Semi-Flattened strategy with these configuration options. The changes will
        be reflected in the JSON configuration below.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-700 p-4 rounded-lg">
          <h3 className="text-slate-200 font-semibold mb-3">Naming Convention</h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center mb-2">
                <input
                  id="useShortNames"
                  type="checkbox"
                  checked={useShortNames}
                  onChange={toggleNamingConvention}
                  className="mr-2 h-4 w-4"
                />
                <label htmlFor="useShortNames" className="text-sm font-medium text-slate-300">
                  Use short names for archetypes
                </label>
              </div>
              <p className="text-slate-400 text-xs">
                When enabled, archetypes will use shorter names (e.g., &quot;OBSERVATION.blood_pressure.v1&quot; 
                instead of &quot;openEHR-EHR-OBSERVATION.blood_pressure.v1&quot;)
              </p>
            </div>
            
            <div className="bg-slate-800 p-3 rounded-lg">
              <h4 className="text-blue-400 font-medium mb-2">Example Naming</h4>
              <div className="space-y-2">
                <div>
                  <div className="text-xs text-slate-400">Long format:</div>
                  <div className="text-sm text-slate-300">openEHR-EHR-OBSERVATION.blood_pressure.v1</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Short format:</div>
                  <div className="text-sm text-slate-300">OBSERVATION.blood_pressure.v1</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-700 p-4 rounded-lg">
          <h3 className="text-slate-200 font-semibold mb-3">Search Configuration</h3>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center mb-2">
                <input
                  id="enableAtlasSearch"
                  type="checkbox"
                  checked={strategyConfig?.atlasSearch?.enabled || false}
                  onChange={() => {
                    const updated = {...strategyConfig};
                    if (!updated.atlasSearch) {
                      updated.atlasSearch = { enabled: true, indexes: [] };
                    } else {
                      updated.atlasSearch.enabled = !updated.atlasSearch.enabled;
                    }
                    setStrategyConfig(updated);
                  }}
                  className="mr-2 h-4 w-4"
                />
                <label htmlFor="enableAtlasSearch" className="text-sm font-medium text-slate-300">
                  Enable Atlas Search
                </label>
              </div>
              <p className="text-slate-400 text-xs">
                When enabled, Atlas Search indexes will be included in the configuration for
                advanced text search and vector search capabilities.
              </p>
            </div>
            
            <div className="bg-slate-800 p-3 rounded-lg">
              <h4 className="text-blue-400 font-medium mb-2">Atlas Search Benefits</h4>
              <ul className="list-disc pl-5 text-slate-300 text-xs space-y-1">
                <li>Advanced text search across clinical documents</li>
                <li>Fuzzy matching for handling typos and variations</li>
                <li>Support for medical terminology and synonyms</li>
                <li>Vector search for semantic similarity</li>
                <li>Faceting and filters for analytics</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-slate-700 p-4 rounded-lg mb-6">
        <h3 className="text-slate-200 font-semibold mb-3 flex justify-between">
          <span>Configuration JSON</span>
          <button
            onClick={() => setStrategyConfig(defaultStrategyConfig)}
            className="text-xs bg-slate-600 hover:bg-slate-500 text-slate-300 px-2 py-1 rounded"
          >
            Reset to Default
          </button>
        </h3>
        
        <CodeViewer
          initialValue={JSON.stringify(strategyConfig || defaultStrategyConfig, null, 2)}
          onChange={(value) => {
            try {
              const parsed = JSON.parse(value);
              setStrategyConfig(parsed);
            } catch (e) {
              // Handle parsing error if needed
            }
          }}
          height="400px"
        />
      </div>
      
      <div className="flex justify-end">
        <button
          className="px-4 py-2 bg-primary text-primary-text rounded-md hover:bg-primary-hover"
        >
          Apply Configuration
        </button>
      </div>
    </div>
  );
};

export default ConfigTab;