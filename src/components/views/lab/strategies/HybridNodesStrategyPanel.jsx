//src/components/views/lab/strategies/HybridNodesStrategyPanel.jsx
'use client';

import React, { useState } from 'react';
import { Database, Search, Cpu, ChevronRight } from 'lucide-react';
import CodeViewer from '../../../common/CodeViewer';

/**
 * Simplified Hybrid-Nodes strategy configuration panel
 */
const HybridNodesStrategyPanel = ({
  selectedQuery,
  strategyConfig,
  setStrategyConfig,
  metadata,
  setSelectedStrategy
}) => {
  const [useSearchForPopulation, setUseSearchForPopulation] = useState(
    strategyConfig?.atlasSearch?.index_name !== undefined
  );
  
  // Default configuration
  const defaultConfig = {
    rmType: "COMPOSITION",
    collection: "hybrid_nodes",
    description: "Hybrid strategy using search_nodes for population queries and comp_nodes for ehr_id-based queries",
    fields: [
      { name: "_id", type: "ObjectId", index: "unique" },
      { name: "ehr_id", type: "string", index: true },
      { name: "comp_id", type: "string", index: true },
      { name: "composition_date", type: "ISODate", index: true },
      { name: "comp_nodes", type: "array", description: "Complete nodes for precise querying" },
      { name: "search_nodes", type: "array", description: "Optimized subset of nodes for search" }
    ],
    atlasSearch: {
      index_name: "default",
      fullTextFields: [
        "search_nodes.data.value.value",
        "search_nodes.data.value.defining_code.code_string"
      ],
      searchOptions: {
        wildcardTextFields: true,
        caseInsensitive: true,
        fuzzySearch: true
      }
    }
  };
  
  // Handle configuration changes
  const handleConfigChange = (key, value) => {
    const newConfig = {...(strategyConfig || defaultConfig)};
    
    if (key === 'useSearch') {
      setUseSearchForPopulation(value);
      if (!newConfig.atlasSearch) {
        newConfig.atlasSearch = defaultConfig.atlasSearch;
      }
      
      if (!value) {
        // Disable search by removing the index_name
        delete newConfig.atlasSearch.index_name;
      } else {
        // Enable search by adding the index_name
        newConfig.atlasSearch.index_name = "default";
      }
    }
    
    setStrategyConfig(newConfig);
  };
  
  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <button
          onClick={() => setSelectedStrategy(null)}
          className="hover:text-slate-200 transition-colors"
        >
          Strategy Selection
        </button>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-200">Hybrid-Nodes Strategy</span>
      </div>

      <div className="dark-banner bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-slate-100 mb-4">Hybrid-Nodes Strategy</h2>

        <p className="text-slate-300 mb-6">
          This strategy intelligently uses <span className="text-blue-400">search_nodes</span> for
          population-based queries and <span className="text-green-400">comp_nodes</span> for
          ehr_id-based queries.
        </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-slate-700 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <Cpu className="w-4 h-4 mr-2 text-green-400" />
            <h3 className="text-slate-200 font-semibold">Query Type Detection</h3>
          </div>
          
          <div className="space-y-3">
            <div className="bg-slate-800 p-3 rounded-lg">
              <h4 className="text-green-400 font-medium mb-1">EHR-ID Based</h4>
              <ul className="list-disc list-inside text-sm text-slate-300">
                <li>Uses <code>$match</code> with <code>$elemMatch</code></li>
                <li>Works with <code>comp_nodes</code> field</li>
                <li>Optimized for specific patient queries</li>
              </ul>
            </div>
            
            <div className="bg-slate-800 p-3 rounded-lg">
              <h4 className="text-blue-400 font-medium mb-1">Population-Based</h4>
              <ul className="list-disc list-inside text-sm text-slate-300">
                <li>Uses Atlas <code>$search</code></li>
                <li>Works with <code>search_nodes</code> field</li>
                <li>Optimized for querying across patients</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-700 p-4 rounded-lg">
          <div className="flex items-center mb-2">
            <Search className="w-4 h-4 mr-2 text-blue-400" />
            <h3 className="text-slate-200 font-semibold">Atlas Search Settings</h3>
          </div>
          
          <div className="flex items-center mb-4">
            <input
              id="useSearch"
              type="checkbox"
              checked={useSearchForPopulation}
              onChange={(e) => handleConfigChange('useSearch', e.target.checked)}
              className="mr-2 h-4 w-4"
            />
            <label htmlFor="useSearch" className="text-sm font-medium text-slate-300">
              Enable Atlas Search for population queries
            </label>
          </div>
          
          <div className={`transition-opacity duration-300 ${useSearchForPopulation ? 'opacity-100' : 'opacity-50'}`}>
            <div className="bg-slate-800 p-3 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-blue-400 font-medium">Search Index Name</h4>
                <input
                  type="text"
                  value={strategyConfig?.atlasSearch?.index_name || "default"}
                  onChange={(e) => {
                    const newConfig = {...(strategyConfig || defaultConfig)};
                    if (!newConfig.atlasSearch) newConfig.atlasSearch = {};
                    newConfig.atlasSearch.index_name = e.target.value;
                    setStrategyConfig(newConfig);
                  }}
                  disabled={!useSearchForPopulation}
                  className="px-2 py-1 text-sm bg-slate-900 border border-slate-600 rounded text-slate-300 w-32"
                />
              </div>
              
              <div className="space-y-2 mt-3">
                <div className="flex items-center">
                  <input
                    id="fuzzySearch"
                    type="checkbox"
                    checked={strategyConfig?.atlasSearch?.searchOptions?.fuzzySearch !== false}
                    onChange={(e) => {
                      const newConfig = {...(strategyConfig || defaultConfig)};
                      if (!newConfig.atlasSearch) newConfig.atlasSearch = {};
                      if (!newConfig.atlasSearch.searchOptions) newConfig.atlasSearch.searchOptions = {};
                      newConfig.atlasSearch.searchOptions.fuzzySearch = e.target.checked;
                      setStrategyConfig(newConfig);
                    }}
                    disabled={!useSearchForPopulation}
                    className="mr-2 h-4 w-4"
                  />
                  <label htmlFor="fuzzySearch" className="text-sm text-slate-300">
                    Enable fuzzy matching
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    id="caseInsensitive"
                    type="checkbox"
                    checked={strategyConfig?.atlasSearch?.searchOptions?.caseInsensitive !== false}
                    onChange={(e) => {
                      const newConfig = {...(strategyConfig || defaultConfig)};
                      if (!newConfig.atlasSearch) newConfig.atlasSearch = {};
                      if (!newConfig.atlasSearch.searchOptions) newConfig.atlasSearch.searchOptions = {};
                      newConfig.atlasSearch.searchOptions.caseInsensitive = e.target.checked;
                      setStrategyConfig(newConfig);
                    }}
                    disabled={!useSearchForPopulation}
                    className="mr-2 h-4 w-4"
                  />
                  <label htmlFor="caseInsensitive" className="text-sm text-slate-300">
                    Case-insensitive search
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-slate-700 p-4 rounded-lg">
        <div className="flex items-center mb-4 justify-between">
          <div className="flex items-center">
            <Database className="w-4 h-4 mr-2 text-yellow-400" />
            <h3 className="text-slate-200 font-semibold">Configuration</h3>
          </div>
          <button
            onClick={() => setStrategyConfig(defaultConfig)}
            className="text-xs bg-slate-600 hover:bg-slate-500 text-slate-300 px-2 py-1 rounded"
          >
            Reset to Default
          </button>
        </div>

        <CodeViewer
          initialValue={JSON.stringify(strategyConfig || defaultConfig, null, 2)}
          onChange={(value) => {
            try {
              const parsed = JSON.parse(value);
              setStrategyConfig(parsed);
              setUseSearchForPopulation(parsed?.atlasSearch?.index_name !== undefined);
            } catch (e) {
              // Handle parsing error if needed
            }
          }}
          height="300px"
        />
      </div>
      </div>
    </div>
  );
};

export default HybridNodesStrategyPanel;