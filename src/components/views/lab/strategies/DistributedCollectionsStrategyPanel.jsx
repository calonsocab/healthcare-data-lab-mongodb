//src/components/views/lab/strategies/DistributedCollectionsStrategyPanel.jsx
'use client';

import React from 'react';
import { ChevronRight, Database, CheckCircle, AlertCircle, Info, Layers } from 'lucide-react';

/**
 * Distributed Collections strategy overview panel
 */
const DistributedCollectionsStrategyPanel = ({
  setSelectedStrategy
}) => {
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
        <span className="text-slate-200">Distributed Collections</span>
      </div>

      {/* Main Content */}
      <div className="dark-banner bg-slate-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Layers className="w-8 h-8 text-purple-400" />
          <h2 className="text-2xl font-bold text-slate-100">Distributed Collections Strategy</h2>
        </div>

        <p className="text-slate-300 mb-6 text-lg">
          A scalable persistence strategy that distributes openEHR compositions across multiple MongoDB collections
          based on archetype type, enabling better performance for large repositories.
        </p>

        {/* When to Use */}
        <div className="bg-slate-700 rounded-lg p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-5 h-5 text-purple-400" />
            <h3 className="text-xl font-semibold text-slate-200">When to Use This Strategy</h3>
          </div>
          <ul className="space-y-2 text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <span><strong>Large repositories</strong> - Ideal when handling millions of compositions</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <span><strong>Complex queries</strong> - Better performance for archetype-specific queries</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <span><strong>Distributed workloads</strong> - Allows horizontal scaling across different collection types</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <span><strong>Type-based access patterns</strong> - When queries typically focus on specific composition types</span>
            </li>
          </ul>
        </div>

        {/* How It Works */}
        <div className="bg-slate-700 rounded-lg p-5 mb-6">
          <h3 className="text-xl font-semibold text-slate-200 mb-4">How It Works</h3>

          <div className="space-y-4">
            <div className="bg-slate-800 p-4 rounded-lg">
              <h4 className="text-purple-400 font-medium mb-2">1. Collection Distribution</h4>
              <p className="text-slate-300 mb-3">
                Compositions are distributed across multiple collections based on their archetype type:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-900 p-3 rounded">
                  <code className="text-blue-300">vital_signs</code>
                  <p className="text-slate-400 mt-1">Blood pressure, heart rate, temperature</p>
                </div>
                <div className="bg-slate-900 p-3 rounded">
                  <code className="text-blue-300">lab_results</code>
                  <p className="text-slate-400 mt-1">Laboratory test results</p>
                </div>
                <div className="bg-slate-900 p-3 rounded">
                  <code className="text-blue-300">medications</code>
                  <p className="text-slate-400 mt-1">Medication orders and administrations</p>
                </div>
                <div className="bg-slate-900 p-3 rounded">
                  <code className="text-blue-300">procedures</code>
                  <p className="text-slate-400 mt-1">Surgical and diagnostic procedures</p>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg">
              <h4 className="text-purple-400 font-medium mb-2">2. Query Routing</h4>
              <p className="text-slate-300 mb-3">
                The AQL translator automatically determines which collection(s) to query based on the archetype in the AQL FROM clause:
              </p>
              <div className="bg-slate-900 p-3 rounded font-mono text-sm text-slate-300">
                <pre>{`SELECT o/data[at0001]/events[at0006]/data[at0003]/items[at0004]
FROM EHR[ehr_id/value='123']
  CONTAINS COMPOSITION c
  CONTAINS OBSERVATION o[openEHR-EHR-OBSERVATION.blood_pressure.v2]

→ Routes to: vital_signs collection`}</pre>
              </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg">
              <h4 className="text-purple-400 font-medium mb-2">3. Cross-Collection Queries</h4>
              <p className="text-slate-300 mb-3">
                When queries span multiple archetypes, the system uses MongoDB&apos;s <code className="text-blue-300">$lookup</code> or
                performs union operations across collections:
              </p>
              <div className="bg-slate-900 p-3 rounded font-mono text-sm text-slate-300">
                <pre>{`// Query vital signs and lab results together
db.vital_signs.aggregate([
  { $match: { "ehr_id": "patient-123" } },
  { $unionWith: {
      coll: "lab_results",
      pipeline: [{ $match: { "ehr_id": "patient-123" } }]
    }
  }
])`}</pre>
              </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg">
              <h4 className="text-purple-400 font-medium mb-2">4. Indexing Strategy</h4>
              <p className="text-slate-300 mb-2">
                Each collection has specialized indexes optimized for its data type:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2 text-sm">
                <li>Common indexes: <code className="text-blue-300">ehr_id</code>, <code className="text-blue-300">composition_id</code></li>
                <li>Type-specific indexes for frequently queried paths in that archetype</li>
                <li>Compound indexes tailored to common query patterns per type</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Advantages */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-700 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <h3 className="text-lg font-semibold text-slate-200">Advantages</h3>
            </div>
            <ul className="space-y-2 text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span><strong>Scalability:</strong> Better performance with millions of documents</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span><strong>Optimized Indexes:</strong> Smaller, more focused indexes per collection</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span><strong>Parallel Queries:</strong> Can query multiple collections simultaneously</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span><strong>Resource Isolation:</strong> Heavy queries on one type don&apos;t affect others</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span><strong>Selective Caching:</strong> Frequently accessed types can be cached separately</span>
              </li>
            </ul>
          </div>

          <div className="bg-slate-700 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-semibold text-slate-200">Limitations</h3>
            </div>
            <ul className="space-y-2 text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-1">•</span>
                <span><strong>Complexity:</strong> More complex to set up and maintain than single collection</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-1">•</span>
                <span><strong>Cross-Type Queries:</strong> Queries spanning multiple types require union operations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-1">•</span>
                <span><strong>Schema Management:</strong> Need to manage schemas for each collection type</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-1">•</span>
                <span><strong>Collection Mapping:</strong> Must maintain archetype-to-collection mappings</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Architecture Diagram */}
        <div className="bg-slate-700 rounded-lg p-5 mb-6">
          <h3 className="text-xl font-semibold text-slate-200 mb-4">Architecture Overview</h3>
          <div className="bg-slate-800 p-4 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="border-2 border-blue-400 rounded-lg p-4">
                <Database className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                <h4 className="text-blue-400 font-semibold mb-1">vital_signs</h4>
                <p className="text-xs text-slate-400">Observations</p>
                <p className="text-xs text-slate-500 mt-2">~1M docs</p>
              </div>
              <div className="border-2 border-green-400 rounded-lg p-4">
                <Database className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <h4 className="text-green-400 font-semibold mb-1">lab_results</h4>
                <p className="text-xs text-slate-400">Laboratory</p>
                <p className="text-xs text-slate-500 mt-2">~500K docs</p>
              </div>
              <div className="border-2 border-purple-400 rounded-lg p-4">
                <Database className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <h4 className="text-purple-400 font-semibold mb-1">medications</h4>
                <p className="text-xs text-slate-400">Instructions</p>
                <p className="text-xs text-slate-500 mt-2">~750K docs</p>
              </div>
            </div>
            <div className="mt-4 text-center text-slate-400 text-sm">
              ↑ Each collection optimized for its specific archetype type
            </div>
          </div>
        </div>

        {/* Best Practices */}
        <div className="bg-slate-700 rounded-lg p-5">
          <h3 className="text-xl font-semibold text-slate-200 mb-4">Best Practices</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-slate-200">Group by access patterns</strong>
                  <p className="text-slate-400 text-sm">Distribute collections based on how data is queried, not just archetype type</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-slate-200">Monitor collection sizes</strong>
                  <p className="text-slate-400 text-sm">Rebalance if one collection grows disproportionately</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-slate-200">Use consistent naming</strong>
                  <p className="text-slate-400 text-sm">Follow a clear naming convention for collection organization</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-slate-200">Optimize cross-collection queries</strong>
                  <p className="text-slate-400 text-sm">Use $unionWith efficiently and consider denormalization for hot paths</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-slate-200">Plan for new archetypes</strong>
                  <p className="text-slate-400 text-sm">Design collection strategy that can accommodate new composition types</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-slate-200">Document mappings</strong>
                  <p className="text-slate-400 text-sm">Maintain clear documentation of archetype-to-collection mappings</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DistributedCollectionsStrategyPanel;
