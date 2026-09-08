//src/components/views/lab/strategies/SingleCollectionStrategyPanel.jsx
'use client';

import React from 'react';
import { ChevronRight, Database, CheckCircle, AlertCircle, Info } from 'lucide-react';

/**
 * Single Collection strategy overview panel
 */
const SingleCollectionStrategyPanel = ({
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
        <span className="text-slate-200">Single Collection</span>
      </div>

      {/* Main Content */}
      <div className="dark-banner bg-slate-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Database className="w-8 h-8 text-blue-400" />
          <h2 className="text-2xl font-bold text-slate-100">Single Collection Strategy</h2>
        </div>

        <p className="text-slate-300 mb-6 text-lg">
          The simplest persistence strategy that stores all openEHR compositions in a single MongoDB collection
          with minimal transformation.
        </p>

        {/* When to Use */}
        <div className="bg-slate-700 rounded-lg p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-5 h-5 text-blue-400" />
            <h3 className="text-xl font-semibold text-slate-200">When to Use This Strategy</h3>
          </div>
          <ul className="space-y-2 text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <span><strong>Small to medium-sized repositories</strong> - Works well when you have fewer than 100,000 compositions</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <span><strong>EHR-ID based queries</strong> - Optimal when queries are typically scoped to a specific patient (ehr_id)</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <span><strong>Simple deployment</strong> - Easiest to set up and maintain with minimal configuration</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <span><strong>Development and testing</strong> - Great for prototyping and development environments</span>
            </li>
          </ul>
        </div>

        {/* How It Works */}
        <div className="bg-slate-700 rounded-lg p-5 mb-6">
          <h3 className="text-xl font-semibold text-slate-200 mb-4">How It Works</h3>

          <div className="space-y-4">
            <div className="bg-slate-800 p-4 rounded-lg">
              <h4 className="text-blue-400 font-medium mb-2">1. Document Structure</h4>
              <p className="text-slate-300 mb-3">
                Each openEHR COMPOSITION is stored as a single MongoDB document with its natural hierarchical structure preserved.
              </p>
              <div className="bg-slate-900 p-3 rounded font-mono text-sm text-slate-300">
                <pre>{`{
  "_id": ObjectId("..."),
  "ehr_id": "patient-123",
  "composition": {
    "name": { "value": "Vital Signs" },
    "content": [
      {
        "name": { "value": "Blood Pressure" },
        "items": [...]
      }
    ]
  }
}`}</pre>
              </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg">
              <h4 className="text-blue-400 font-medium mb-2">2. Query Pattern</h4>
              <p className="text-slate-300 mb-3">
                Queries use MongoDB's dot notation to traverse the nested structure directly.
              </p>
              <div className="bg-slate-900 p-3 rounded font-mono text-sm text-slate-300">
                <pre>{`db.compositions.find({
  "ehr_id": "patient-123",
  "composition.content.items.value.magnitude": { $gt: 140 }
})`}</pre>
              </div>
            </div>

            <div className="bg-slate-800 p-4 rounded-lg">
              <h4 className="text-blue-400 font-medium mb-2">3. Indexing</h4>
              <p className="text-slate-300 mb-2">
                Simple indexes on frequently queried fields:
              </p>
              <ul className="list-disc list-inside text-slate-300 space-y-1 ml-2">
                <li><code className="text-blue-300">ehr_id</code> - Primary patient identifier</li>
                <li><code className="text-blue-300">composition_id</code> - Unique composition identifier</li>
                <li><code className="text-blue-300">composition.context.start_time</code> - Temporal queries</li>
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
                <span><strong>Simplicity:</strong> Straightforward to understand and implement</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span><strong>Data Integrity:</strong> Original structure is preserved completely</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span><strong>Fast Lookups:</strong> Excellent performance for ehr_id-based queries</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span><strong>Low Overhead:</strong> Minimal storage overhead and preprocessing</span>
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
                <span><strong>Scalability:</strong> Performance degrades with very large datasets</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-1">•</span>
                <span><strong>Population Queries:</strong> Cross-patient queries can be slower</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-1">•</span>
                <span><strong>Complex Paths:</strong> Deeply nested queries can be verbose</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400 mt-1">•</span>
                <span><strong>Limited Search:</strong> No full-text search capabilities</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Best Practices */}
        <div className="bg-slate-700 rounded-lg p-5">
          <h3 className="text-xl font-semibold text-slate-200 mb-4">Best Practices</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-slate-200">Create targeted indexes</strong>
                  <p className="text-slate-400 text-sm">Index only the paths you frequently query to avoid index overhead</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-slate-200">Use projection</strong>
                  <p className="text-slate-400 text-sm">Return only necessary fields to reduce network transfer</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-slate-200">Monitor collection size</strong>
                  <p className="text-slate-400 text-sm">Consider migration to other strategies if growth is rapid</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-slate-200">Always filter by ehr_id</strong>
                  <p className="text-slate-400 text-sm">Take advantage of the primary index for best performance</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SingleCollectionStrategyPanel;
