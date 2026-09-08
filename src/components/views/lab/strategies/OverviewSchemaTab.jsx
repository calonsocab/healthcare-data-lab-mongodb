//src/components/views/lab/strategies/OverviewSchemaTab.jsx
'use client';

import React from 'react';
import { Database, Code } from 'lucide-react';

/**
 * Combined Overview & Schema tab for the Semi-Flattened strategy panel
 * This component merges the overview and schema information into a single simplified view
 */
const OverviewSchemaTab = () => {
  return (
    <div className="space-y-6">
      {/* Overview Section */}
      <div className="dark-banner bg-slate-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-slate-100 mb-4">Semi-Flattened Nodes Strategy</h2>

        <p className="text-slate-300 mb-6">
          The Semi-Flattened Nodes strategy transforms openEHR compositions into a structure that balances
          the original hierarchical format with efficient query capabilities. It flattens the composition
          nodes into an array while maintaining their relationships and paths.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-700 p-4 rounded-lg">
            <h3 className="text-slate-200 font-semibold mb-3">Key Benefits</h3>
            <ul className="list-disc pl-5 text-slate-300 space-y-1 text-sm">
              <li>Efficient querying of deeply nested structures</li>
              <li>Maintains path-based relationships between nodes</li>
              <li>Supports powerful MongoDB array operators</li>
              <li>Optimizes for complex AQL query patterns</li>
              <li>Balances storage and query performance</li>
            </ul>
          </div>

          <div className="bg-slate-700 p-4 rounded-lg">
            <h3 className="text-slate-200 font-semibold mb-3">Ideal Use Cases</h3>
            <ul className="list-disc pl-5 text-slate-300 space-y-1 text-sm">
              <li>Complex clinical queries across multiple archetypes</li>
              <li>When path-based querying is a priority</li>
              <li>Large compositions with deep nesting</li>
              <li>Mixed query patterns (some deep, some shallow)</li>
              <li>When you need both data integrity and performance</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Schema Section */}
      <div className="dark-banner bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Data Model & Schema
        </h2>

        <p className="text-slate-300 mb-6">
          The Semi-Flattened schema transforms the deeply nested openEHR composition structure into a document
          with a flattened nodes array. Each node maintains its context through path information.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Document Structure */}
          <div className="bg-slate-700 p-5 rounded-lg">
            <h3 className="text-slate-200 font-semibold mb-4 flex items-center">
              <Database className="w-4 h-4 mr-2 text-blue-400" />
              Document Structure
            </h3>

            <div className="space-y-4">
              <div className="bg-slate-800 p-3 rounded-lg">
                <h4 className="text-blue-400 font-medium mb-2 text-sm">Main Document Fields</h4>
                <ul className="list-none space-y-2 text-sm">
                  <li className="flex items-start">
                    <span className="text-green-400 font-mono mr-2">_id:</span>
                    <span className="text-slate-300">Unique document identifier</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 font-mono mr-2">ehr_id:</span>
                    <span className="text-slate-300">EHR identifier</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 font-mono mr-2">comp_id:</span>
                    <span className="text-slate-300">Composition identifier</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 font-mono mr-2">nodes:</span>
                    <span className="text-slate-300">Array of flattened nodes</span>
                  </li>
                </ul>
              </div>

              <div className="bg-slate-800 p-3 rounded-lg">
                <h4 className="text-blue-400 font-medium mb-2 text-sm">Node Structure</h4>
                <ul className="list-none space-y-2 text-sm">
                  <li className="flex items-start">
                    <span className="text-green-400 font-mono mr-2">path:</span>
                    <span className="text-slate-300">Absolute path in composition</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 font-mono mr-2">archetype_path:</span>
                    <span className="text-slate-300">Path using archetype IDs</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 font-mono mr-2">ancestors:</span>
                    <span className="text-slate-300">Array of parent archetypes</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-400 font-mono mr-2">node_data:</span>
                    <span className="text-slate-300">Original node content</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Example Document */}
          <div className="bg-slate-700 p-5 rounded-lg">
            <h3 className="text-slate-200 font-semibold mb-4 flex items-center">
              <Code className="w-4 h-4 mr-2 text-blue-400" />
              Example Document
            </h3>

            <div className="bg-slate-900 p-3 rounded-lg overflow-auto max-h-96">
              <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                {`{
  "_id": ObjectId("5f9e4c5b2c4d7e3a1b0e8d7a"),
  "ehr_id": "029c57f-fcf8-4c66-aae9-b4d7bb5c1cc",
  "comp_id": ObjectId("6762a570f384ceb8faaf8cb7"),
  "archetype_node_id":
    "openEHR-EHR-COMPOSITION.vaccination_list.v0",
  "nodes": [
    {
      "path": "CanonicalJSON",
      "archetype_path": "CanonicalJSON",
      "ancestors": [
        "openEHR-EHR-COMPOSITION.vaccination_list.v0"
      ],
      "node_data": {
        "_type": "COMPOSITION",
        "name": {
          "_type": "DV_TEXT",
          "value": "HC3 Immunization List"
        },
        "uid": {
          "_type": "OBJECT_VERSION_ID",
          "value": "00c33737-7a1f-4d7f..."
        }
      }
    },
    {
      "path": "content[0]",
      "archetype_path": "content[openEHR-EHR-ACTION.medication.v1]",
      "ancestors": [
        "openEHR-EHR-COMPOSITION.vaccination_list.v0"
      ],
      "node_data": {
        "_type": "ACTION",
        "description": {
          "_type": "ITEM_TREE",
          "items": [...]
        }
      }
    }
    // More nodes...
  ]
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="bg-slate-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-slate-100 mb-4">How It Works</h2>

        <div className="space-y-4">
          <div className="bg-slate-900 p-4 rounded-lg">
            <h4 className="text-blue-400 font-medium mb-2">Flattening Process</h4>
            <p className="text-slate-300 text-sm">
              The composition is transformed by extracting each node from the hierarchical structure into a flat array.
              Each node maintains references to its original context through path information and ancestor arrays.
            </p>
          </div>

          <div className="bg-slate-900 p-4 rounded-lg">
            <h4 className="text-blue-400 font-medium mb-2">Query Processing</h4>
            <p className="text-slate-300 text-sm mb-3">
              AQL queries are translated to MongoDB queries that leverage the array structure using $elemMatch
              operators. This allows efficient filtering based on paths, archetypes, and ancestors.
            </p>

            <div className="bg-slate-800 p-3 rounded-lg">
              <h5 className="text-yellow-400 font-medium mb-2 text-sm">AQL Path Resolution</h5>
              <ul className="list-disc pl-5 text-slate-300 text-xs space-y-1">
                <li><span className="text-green-400">Absolute paths</span> (e.g., c/uid/value) → node lookups by path</li>
                <li><span className="text-green-400">Relative paths</span> (e.g., items[at0001]/value) → resolved using archetype_path</li>
                <li><span className="text-green-400">Mixed paths</span> → combine both approaches for flexibility</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OverviewSchemaTab;
