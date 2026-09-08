//src/components/views/lab/strategies/SchemaTab.jsx 
'use client';

import React from 'react';
import { Database, Code, FileJson } from 'lucide-react';
import ReactFlow, { Background, Controls } from 'reactflow';
import SchemaVisualization from './SchemaVisualization';
import 'reactflow/dist/style.css';

// Custom node component for data model visualization
const DataModelNode = ({ data }) => {
  if (!data) return null;

  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-slate-800 border border-slate-700 hover:border-blue-500">
      <div className="flex items-center">
        <div className="rounded-full w-3 h-3 bg-blue-500 flex-shrink-0" />
        <p className="ml-2 text-lg font-bold text-slate-200">{data.label || 'Unnamed Node'}</p>
      </div>
      <p className="text-slate-400 text-sm mt-2">{data.description || ''}</p>
      {data.fields && (
        <ul className="text-xs text-slate-400 mt-2">
          {data.fields.map((field, index) => (
            <li key={index} className="ml-4 list-disc">{field.name}: {field.type}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

/**
 * Schema tab for the Semi-Flattened strategy panel
 * This component shows the document and node structure
 */
const SchemaTab = () => {
  // Data model for visualization
  const dataModel = {
    nodes: [
      {
        id: 'compositions',
        type: 'dataModel',
        position: { x: 150, y: 50 },
        data: {
          label: 'Composition Document', 
          description: 'The main composition document', 
          fields: [
            { name: "_id", type: "ObjectId()" },
            { name: "ehr_id", type: "string" },
            { name: "comp_id", type: "ObjectId()" },
            { name: "composition_date", type: "ISODate" },
            { name: "archetype_node_id", type: "string" },
            { name: "nodes", type: "Array<Node>" }
          ]
        }
      },
      {
        id: 'nodes',
        type: 'dataModel',
        position: { x: 360, y: 180 },
        data: {
          label: 'Node Structure', 
          description: 'Structure of each node in the nodes array', 
          fields: [
            { name: "path", type: "string" },
            { name: "archetype_path", type: "string" },
            { name: "ancestors", type: "Array<string>" },
            { name: "node_data", type: "object" }
          ]
        }
      }
    ],
    edges: [{
      id: 'composition-nodes',
      source: 'compositions',
      target: 'nodes',
      label: 'contains',
      type: 'smoothstep'
    }]
  };

  // Node types for ReactFlow
  const nodeTypes = { dataModel: DataModelNode };

  return (
    <div className="dark-banner bg-slate-800 rounded-lg p-6">
      <h2 className="text-xl font-bold text-slate-100 mb-4">Semi-Flattened Data Model</h2>
      
      <p className="text-slate-300 mb-6">
        The Semi-Flattened schema transforms the deeply nested openEHR composition structure into a document 
        with a flattened nodes array. This visualization shows how the data is organized.
      </p>
      
      <div className="h-96 bg-slate-900 rounded-lg overflow-hidden mb-6">
        <ReactFlow
          nodes={dataModel.nodes}
          edges={dataModel.edges}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-700 p-4 rounded-lg">
          <h3 className="text-slate-200 font-semibold mb-3 flex items-center">
            <Database className="w-4 h-4 mr-2" />
            Document Structure
          </h3>
          
          <div className="bg-slate-800 p-3 rounded-lg mb-3">
            <h4 className="text-blue-400 font-medium mb-2">Main Document Fields</h4>
            <ul className="list-disc pl-5 text-slate-300 space-y-1">
              <li><span className="text-green-400">_id</span>: Unique document identifier</li>
              <li><span className="text-green-400">ehr_id</span>: EHR identifier</li>
              <li><span className="text-green-400">comp_id</span>: Composition identifier</li>
              <li><span className="text-green-400">composition_date</span>: Date of composition</li>
              <li><span className="text-green-400">archetype_node_id</span>: Main composition archetype ID</li>
              <li><span className="text-green-400">nodes</span>: Array of flattened nodes from the composition</li>
            </ul>
          </div>
          
          <div className="bg-slate-800 p-3 rounded-lg">
            <h4 className="text-blue-400 font-medium mb-2">Node Structure</h4>
            <ul className="list-disc pl-5 text-slate-300 space-y-1">
              <li><span className="text-green-400">path</span>: Absolute path in the composition</li>
              <li><span className="text-green-400">archetype_path</span>: Path using archetype node IDs</li>
              <li><span className="text-green-400">ancestors</span>: Array of parent archetypes and nodes</li>
              <li><span className="text-green-400">node_data</span>: Original node content</li>
            </ul>
          </div>
        </div>
        
        <div className="bg-slate-700 p-4 rounded-lg">
          <h3 className="text-slate-200 font-semibold mb-3 flex items-center">
            <Code className="w-4 h-4 mr-2" />
            Example Document
          </h3>
          
          <div className="bg-slate-900 p-3 rounded-lg overflow-auto max-h-80">
            <pre className="text-xs text-slate-300 whitespace-pre-wrap">
              {`{
  "_id": ObjectId("5f9e4c5b2c4d7e3a1b0e8d7a"),
  "ehr_id": "029c57f-fcf8-4c66-aae9-b4d7bb5c1cc",
  "comp_id": ObjectId("6762a570f384ceb8faaf8cb7"),
  "composition_date": ISODate("2016-07-04T06:02:19.000Z"),
  "archetype_node_id": "openEHR-EHR-COMPOSITION.vaccination_list.v0",
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
        "archetype_details": {
          "archetype_id": {
            "value": "openEHR-EHR-COMPOSITION.vaccination_list.v0"
          }
        },
        "uid": {
          "_type": "OBJECT_VERSION_ID",
          "value": "00c33737-7a1f-4d7f-b247-5e15dad946ee::ehrbase.ehrbase.org::1"
        }
      }
    },
    // More nodes...
  ]
}`}
            </pre>
          </div>
        </div>
      </div>
      
      {/* Add full SchemaVisualization component for detailed exploration */}
      <div className="mt-6">
        <SchemaVisualization />
      </div>
    </div>
  );
};

export default SchemaTab;