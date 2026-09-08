//src/components/views/lab/StrategyConfigTab.jsx
'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/common/Tabs";
import SemiFlattendedStrategyPanel from './strategies/SemiFlattenedStrategyPanel';
import HybridNodesStrategyPanel from './strategies/HybridNodesStrategyPanel';
import SingleCollectionStrategyPanel from './strategies/SingleCollectionStrategyPanel';
import DistributedCollectionsStrategyPanel from './strategies/DistributedCollectionsStrategyPanel';
import { dataModels } from '@/lib/aqlToMql/schema/dataModels';

/**
 * Integration component for the improved strategy configuration UI
 * This brings together all strategy components
 */
const StrategyConfigTab = ({ 
  selectedQuery, 
  selectedStrategy, 
  setSelectedStrategy, 
  strategyConfig, 
  setStrategyConfig,
  metadata
}) => {
  // Check if we're viewing a specific strategy
  const isViewingSingleCollection = selectedStrategy === 'SingleCollection';
  const isViewingDistributedCollections = selectedStrategy === 'DistributedCollections';
  const isViewingSemiFlattened = selectedStrategy === 'SemiFlattened';
  const isViewingHybridNodes = selectedStrategy === 'HybridNodes';

  // If the single collection strategy is selected, render its panel
  if (isViewingSingleCollection) {
    return (
      <SingleCollectionStrategyPanel
        setSelectedStrategy={setSelectedStrategy}
      />
    );
  }

  // If the distributed collections strategy is selected, render its panel
  if (isViewingDistributedCollections) {
    return (
      <DistributedCollectionsStrategyPanel
        setSelectedStrategy={setSelectedStrategy}
      />
    );
  }

  // If the semi-flattened strategy is selected, render the specialized panel
  if (isViewingSemiFlattened) {
    return (
      <SemiFlattendedStrategyPanel
        selectedQuery={selectedQuery}
        selectedTemplate={metadata?.templates?.find(t => t.name === selectedQuery?.templateName)}
        strategyConfig={strategyConfig || dataModels.semiflattened}
        setStrategyConfig={setStrategyConfig}
        metadata={metadata}
        setSelectedStrategy={setSelectedStrategy}
      />
    );
  }
  
  // If the hybrid-nodes strategy is selected, render its specialized panel
  if (isViewingHybridNodes) {
    return (
      <HybridNodesStrategyPanel
        selectedQuery={selectedQuery}
        strategyConfig={strategyConfig || dataModels.hybridNodes}
        setStrategyConfig={setStrategyConfig}
        metadata={metadata}
        setSelectedStrategy={setSelectedStrategy}
      />
    );
  }
  
  // Otherwise, render the original strategy selection panel
  const strategies = [
    {
      id: 'SingleCollection',
      title: 'Single Collection',
      description: 'Use when: Not large repositories or queries based on an ehr_id.',
    },
    {
      id: 'DistributedCollections',
      title: 'Distributed Collections',
      description: 'Use when: Handling large repositories with complex queries.'
    },
    {
      id: 'SemiFlattened',
      title: 'Semi-Flattened Nodes',
      description: 'Use when: Complex path-based queries with efficient node access.'
    },
    {
      id: 'HybridNodes',
      title: 'Hybrid-Nodes Strategy',
      description: 'Use when: Need both fast search and precise filtering capabilities.'
    }
  ];

  return (
    <div className="grid grid-cols-1 gap-6">
      <div className="bg-slate-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-slate-200 mb-4">Select Strategy</h3>
        
        {/* Strategy selection cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {strategies.map(strategy => (
            <div 
              key={strategy.id} 
              className={`p-4 flex flex-col justify-between cursor-pointer rounded-lg h-full ${
                selectedStrategy === strategy.id 
                  ? 'bg-blue-900/30 border border-blue-500' 
                  : 'bg-slate-700 hover:bg-slate-600'
              }`}
              onClick={() => setSelectedStrategy(strategy.id)}
            >
              <div>
                <h4 className="text-md font-medium text-slate-200">{strategy.title}</h4>
                <p className="text-sm text-slate-400 mt-1">{strategy.description}</p>
              </div>
              
              <div className="mt-4 text-center">
                <button 
                  className={`px-4 py-2 rounded-md text-sm ${
                    selectedStrategy === strategy.id
                      ? 'bg-primary text-primary-text'
                      : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                  }`}
                >
                  {selectedStrategy === strategy.id ? 'Selected' : 'Select Strategy'}
                </button>
              </div>
            </div>
          ))}
        </div>
        
        {/* Hybrid-Nodes strategy description section */}
        <div className="mt-6 p-4 bg-slate-700 rounded-lg">
          <h3 className="text-slate-200 font-semibold mb-2">About the Hybrid-Nodes Strategy</h3>
          
          <p className="text-slate-300 mb-4">
            The Hybrid-Nodes strategy automatically chooses between using Atlas Search for population-based 
            queries and traditional MongoDB querying for ehr_id-based queries. This provides the best of both 
            worlds: high performance for broad searches and precise filtering for specific patient data.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800 p-3 rounded-lg">
              <h4 className="text-blue-400 font-medium mb-2">Key Features</h4>
              <ul className="list-disc pl-5 text-slate-300 space-y-1">
                <li>Automatic detection of query type (ehr_id vs. population)</li>
                <li>Uses <code>search_nodes</code> for Atlas Search operations</li>
                <li>Uses <code>comp_nodes</code> for precise $match/$elemMatch queries</li>
                <li>Optimized for both performance and precision</li>
                <li>Simple configuration with minimal settings</li>
              </ul>
            </div>
            
            <div className="bg-slate-800 p-3 rounded-lg">
              <h4 className="text-blue-400 font-medium mb-2">Benefits</h4>
              <ul className="list-disc pl-5 text-slate-300 space-y-1">
                <li>Fast full-text search for population-level analytics</li>
                <li>Precise element matching for ehr_id-based queries</li>
                <li>Fuzzy matching and text analysis capabilities</li>
                <li>Efficient storage with targeted search indexes</li>
                <li>No need to manually choose between query strategies</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 text-center">
            <button 
              className="px-6 py-2 bg-primary text-primary-text rounded-md hover:bg-primary-hover"
              onClick={() => setSelectedStrategy('HybridNodes')}
            >
              Select Hybrid-Nodes Strategy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyConfigTab;