//src/components/views/lab/strategies/IndexingTab.jsx 
'use client';

import React from 'react';
import { Fingerprint, Search, FileText } from 'lucide-react';
import CollapsibleSection from '../../../common/CollapsibleSection';

/**
 * Indexing tab for the Semi-Flattened strategy panel
 * This component explains the indexing strategies for the semi-flattened structure
 */
const IndexingTab = () => {
  return (
    <div className="dark-banner bg-slate-800 rounded-lg p-6">
      <h2 className="text-xl font-bold text-slate-100 mb-4">Indexing Strategy</h2>
      
      <p className="text-slate-300 mb-6">
        Effective indexing is critical for performance with the Semi-Flattened strategy. The indexes are 
        designed to optimize query patterns common in AQL translations.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-700 p-4 rounded-lg">
          <h3 className="text-slate-200 font-semibold mb-3 flex items-center">
            <Fingerprint className="w-4 h-4 mr-2" />
            Standard Indexes
          </h3>
          
          <div className="space-y-3">
            <div className="bg-slate-800 p-3 rounded-lg">
              <h4 className="text-blue-400 font-medium mb-1">Document-Level Indexes</h4>
              <ul className="list-disc pl-5 text-slate-300 text-sm space-y-1">
                <li><span className="text-green-400">_id</span>: Default unique index</li>
                <li><span className="text-green-400">ehr_id</span>: For patient-level queries</li>
                <li><span className="text-green-400">comp_id</span>: For direct composition access</li>
                <li><span className="text-green-400">composition_date</span>: For temporal queries</li>
                <li><span className="text-green-400">archetype_node_id</span>: For composition type filtering</li>
              </ul>
            </div>
            
            <div className="bg-slate-800 p-3 rounded-lg">
              <h4 className="text-blue-400 font-medium mb-1">Nodes Array Indexes</h4>
              <ul className="list-disc pl-5 text-slate-300 text-sm space-y-1">
                <li><span className="text-green-400">nodes.node_data._type</span>: For RM type queries</li>
                <li><span className="text-green-400">nodes.node_data.archetype_details.archetype_id.value</span>: For archetype-based queries</li>
                <li><span className="text-green-400">nodes.archetype_path</span>: For path-based lookups</li>
                <li><span className="text-green-400">nodes.ancestors</span>: For hierarchical traversal</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="bg-slate-700 p-4 rounded-lg">
          <h3 className="text-slate-200 font-semibold mb-3 flex items-center">
            <Search className="w-4 h-4 mr-2" />
            Atlas Search Indexes
          </h3>
          
          <div className="space-y-3">
            <div className="bg-slate-800 p-3 rounded-lg">
              <h4 className="text-blue-400 font-medium mb-1">Full-Text Search</h4>
              <p className="text-slate-300 text-sm mb-2">
                Atlas Search indexes can be created for text fields to enable advanced text search capabilities:
              </p>
              <ul className="list-disc pl-5 text-slate-300 text-sm space-y-1">
                <li>Text values (DV_TEXT, DV_CODED_TEXT)</li>
                <li>Clinical notes and descriptions</li>
                <li>Support for wildcards, fuzzy matching, and synonyms</li>
              </ul>
            </div>
            
            <div className="bg-slate-800 p-3 rounded-lg">
              <h4 className="text-blue-400 font-medium mb-1">Vector Search</h4>
              <p className="text-slate-300 text-sm mb-2">
                Vector embeddings can be stored and indexed for semantic search capabilities:
              </p>
              <ul className="list-disc pl-5 text-slate-300 text-sm space-y-1">
                <li>Text embeddings for semantic similarity</li>
                <li>Similar clinical concept finding</li>
                <li>Support for kNN and hybrid searches</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-slate-900 p-4 rounded-lg mb-6">
        <h3 className="text-lg font-semibold text-slate-200 mb-3">Compound Indexes</h3>
        
        <p className="text-slate-300 mb-4">
          Compound indexes are essential for optimizing complex queries that combine multiple conditions.
          Here are the key compound indexes for the semi-flattened structure:
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-slate-800 p-3 rounded-lg">
            <h4 className="text-blue-400 font-medium mb-1">Type + Archetype Index</h4>
            <pre className="bg-slate-900 p-2 rounded-lg text-xs text-slate-300 whitespace-pre-wrap">
              {`{
  "nodes.node_data._type": 1,
  "nodes.node_data.archetype_details.archetype_id.value": 1
}`}
            </pre>
            <p className="text-sm text-slate-400 mt-2">
              Optimizes CONTAINS clauses in AQL
            </p>
          </div>
          
          <div className="bg-slate-800 p-3 rounded-lg">
            <h4 className="text-blue-400 font-medium mb-1">Path + Ancestors Index</h4>
            <pre className="bg-slate-900 p-2 rounded-lg text-xs text-slate-300 whitespace-pre-wrap">
              {`{
  "nodes.archetype_path": 1,
  "nodes.ancestors": 1
}`}
            </pre>
            <p className="text-sm text-slate-400 mt-2">
              Optimizes path-based queries with context
            </p>
          </div>
          
          <div className="bg-slate-800 p-3 rounded-lg">
            <h4 className="text-blue-400 font-medium mb-1">EHR + Date + Type Index</h4>
            <pre className="bg-slate-900 p-2 rounded-lg text-xs text-slate-300 whitespace-pre-wrap">
              {`{
  "ehr_id": 1,
  "composition_date": -1,
  "nodes.node_data._type": 1
}`}
            </pre>
            <p className="text-sm text-slate-400 mt-2">
              Optimizes patient timeline queries
            </p>
          </div>
        </div>
      </div>
      
      <div className="bg-slate-700 p-4 rounded-lg">
        <h3 className="text-slate-200 font-semibold mb-3 flex items-center">
          <FileText className="w-4 h-4 mr-2" />
          Performance Considerations
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-800 p-3 rounded-lg">
            <h4 className="text-blue-400 font-medium mb-1">Covered Queries</h4>
            <p className="text-slate-300 text-sm mb-2">
              The indexing strategy ensures these queries are efficient:
            </p>
            <ul className="list-disc pl-5 text-slate-300 text-sm space-y-1">
              <li>Finding compositions by archetype</li>
              <li>Finding specific RM types within documents</li>
              <li>Path-based value retrieval</li>
              <li>Hierarchical path traversal</li>
              <li>Temporal and patient-specific filtering</li>
            </ul>
          </div>
          
          <div className="bg-slate-800 p-3 rounded-lg">
            <h4 className="text-blue-400 font-medium mb-1">Index Size Management</h4>
            <p className="text-slate-300 text-sm mb-2">
              Be mindful of these index optimization strategies:
            </p>
            <ul className="list-disc pl-5 text-slate-300 text-sm space-y-1">
              <li>Use partial indexes for selective indexing</li>
              <li>Consider TTL indexes for temporal data</li>
              <li>Monitor index sizes and usage patterns</li>
              <li>Use sparse indexes for optional fields</li>
              <li>Prune unused indexes periodically</li>
            </ul>
          </div>
        </div>
      </div>
      
      <CollapsibleSection
        title="Advanced Index Usage"
        isExpanded={false}
        onToggle={() => {}}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 p-3 rounded-lg">
            <h4 className="text-blue-400 font-medium mb-2">Index Hints</h4>
            <p className="text-slate-300 text-sm mb-3">
              For complex queries, you can provide index hints to guide the MongoDB query optimizer:
            </p>
            <pre className="bg-slate-900 p-2 rounded-lg text-xs text-slate-300 whitespace-pre-wrap">
              {`db.compositions.find(
  { "nodes.ancestors": "openEHR-EHR-OBSERVATION.blood_pressure.v1" },
  { hint: { "nodes.ancestors": 1 } }
)`}
            </pre>
          </div>
          
          <div className="bg-slate-900 p-3 rounded-lg">
            <h4 className="text-blue-400 font-medium mb-2">Partial Indexes</h4>
            <p className="text-slate-300 text-sm mb-3">
              Create selective indexes for specific document subsets to reduce index size:
            </p>
            <pre className="bg-slate-900 p-2 rounded-lg text-xs text-slate-300 whitespace-pre-wrap">
              {`db.compositions.createIndex(
  { "nodes.node_data.value.magnitude": 1 },
  { 
    partialFilterExpression: { 
      "nodes.node_data._type": "ELEMENT", 
      "nodes.node_data.value._type": "DV_QUANTITY" 
    } 
  }
)`}
            </pre>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  );
};

export default IndexingTab;