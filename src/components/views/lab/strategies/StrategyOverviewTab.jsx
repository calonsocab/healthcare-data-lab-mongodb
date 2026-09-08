//src/components/views/lab/strategies/StrategyOverview.jsx 
'use client';

import React from 'react';
import { Database } from 'lucide-react';

/**
 * Overview tab for the Semi-Flattened strategy panel
 * This component explains the core concepts and benefits of the strategy
 */
const StrategyOverviewTab = () => {
  return (
    <div className="dark-banner bg-slate-800 rounded-lg p-6">
      <h2 className="text-xl font-bold text-slate-100 mb-4">Semi-Flattened Nodes Strategy</h2>
      
      <p className="text-slate-300 mb-4">
        The Semi-Flattened Nodes strategy transforms openEHR compositions into a structure that balances 
        the original hierarchical format with efficient query capabilities. It flattens the composition 
        nodes into an array while maintaining their relationships and paths.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-700 p-4 rounded-lg">
          <h3 className="text-slate-200 font-semibold mb-2">Key Benefits</h3>
          <ul className="list-disc pl-5 text-slate-300 space-y-1">
            <li>Efficient querying of deeply nested structures</li>
            <li>Maintains path-based relationships between nodes</li>
            <li>Supports powerful MongoDB array operators</li>
            <li>Optimizes for complex AQL query patterns</li>
            <li>Balances storage and query performance</li>
          </ul>
        </div>
        
        <div className="bg-slate-700 p-4 rounded-lg">
          <h3 className="text-slate-200 font-semibold mb-2">Ideal Use Cases</h3>
          <ul className="list-disc pl-5 text-slate-300 space-y-1">
            <li>Complex clinical queries across multiple archetypes</li>
            <li>When path-based querying is a priority</li>
            <li>Large compositions with deep nesting</li>
            <li>Mixed query patterns (some deep, some shallow)</li>
            <li>When you need both data integrity and performance</li>
          </ul>
        </div>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-200 mb-3">How It Works</h3>
        
        <div className="bg-slate-900 p-4 rounded-lg mb-4">
          <h4 className="text-blue-400 font-medium mb-2">1. Flattening Process</h4>
          <p className="text-slate-300 mb-3">
            The composition is transformed by extracting each node from the hierarchical structure into a flat array. 
            Each node maintains references to its original context through path information and ancestor arrays.
          </p>
          
          <div className="flex justify-center mb-4">
            <img 
              src="/images/semiflattened-transform.svg" 
              alt="Semi-flattened transformation diagram" 
              className="max-w-full h-auto rounded-lg border border-slate-700"
            />
          </div>
        </div>
        
        <div className="bg-slate-900 p-4 rounded-lg mb-4">
          <h4 className="text-blue-400 font-medium mb-2">2. Node Structure</h4>
          <p className="text-slate-300 mb-3">
            Each node in the array contains four critical components that enable efficient querying while 
            preserving the original hierarchical relationships:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <div className="bg-slate-800 p-3 rounded-lg">
              <h5 className="text-green-400 font-medium mb-1">path</h5>
              <p className="text-slate-300 text-sm">
                Absolute dot-notation path to the node in the composition. 
                Enables direct access to specific nodes.
              </p>
            </div>
            
            <div className="bg-slate-800 p-3 rounded-lg">
              <h5 className="text-green-400 font-medium mb-1">archetype_path</h5>
              <p className="text-slate-300 text-sm">
                Archetype-specific path using at-codes. 
                Critical for archetype-based queries.
              </p>
            </div>
            
            <div className="bg-slate-800 p-3 rounded-lg">
              <h5 className="text-green-400 font-medium mb-1">ancestors</h5>
              <p className="text-slate-300 text-sm">
                Array of parent archetypes and node ids.
                Enables traversing up the hierarchy.
              </p>
            </div>
            
            <div className="bg-slate-800 p-3 rounded-lg">
              <h5 className="text-green-400 font-medium mb-1">node_data</h5>
              <p className="text-slate-300 text-sm">
                The actual node content from the original structure.
                Contains all the node's attributes and values.
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-900 p-4 rounded-lg">
          <h4 className="text-blue-400 font-medium mb-2">3. Query Processing</h4>
          <p className="text-slate-300 mb-3">
            AQL queries are translated to MongoDB queries that leverage the array structure using $elemMatch 
            operators. This allows efficient filtering based on paths, archetypes, and ancestors.
          </p>
          
          <div className="bg-slate-800 p-3 rounded-lg mb-3">
            <h5 className="text-yellow-400 font-medium mb-1">AQL Path Resolution</h5>
            <ul className="list-disc pl-5 text-slate-300 text-sm space-y-1">
              <li><span className="text-green-400">Absolute paths</span> (e.g., <code>c/uid/value</code>) are converted to node lookups by path</li>
              <li><span className="text-green-400">Relative paths</span> (e.g., <code>items[at0001]/value</code>) are resolved using archetype_path and ancestors</li>
              <li><span className="text-green-400">Mixed paths</span> combine both approaches for maximum flexibility</li>
            </ul>
          </div>
          
          <div className="bg-slate-700 p-3 rounded-lg">
            <h5 className="text-slate-200 font-medium mb-1">Example: AQL to MongoDB Conversion</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-blue-400 text-xs mb-1">AQL Query:</div>
                <pre className="bg-slate-900 p-2 rounded-lg text-xs text-slate-300 whitespace-pre-wrap">
                  {`SELECT 
  c/uid/value as id,
  o/data[at0001]/value as temp
FROM EHR e
  CONTAINS COMPOSITION c
  CONTAINS OBSERVATION o[openEHR-EHR-OBSERVATION.body_temperature.v1]
WHERE
  o/data[at0001]/value > 38.0`}
                </pre>
              </div>
              
              <div>
                <div className="text-green-400 text-xs mb-1">MongoDB Query:</div>
                <pre className="bg-slate-900 p-2 rounded-lg text-xs text-slate-300 whitespace-pre-wrap">
                  {`{
  $match: {
    "nodes": {
      $elemMatch: {
        "node_data._type": "OBSERVATION",
        "node_data.archetype_details.archetype_id.value": 
          "openEHR-EHR-OBSERVATION.body_temperature.v1"
      }
    },
    "nodes": {
      $elemMatch: {
        "archetype_path": {$regex: "data\\[at0001\\]/value"},
        "ancestors": {$in: ["openEHR-EHR-OBSERVATION.body_temperature.v1"]},
        "node_data.value.magnitude": {$gt: 38.0}
      }
    }
  }
}`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategyOverviewTab;