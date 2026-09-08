// src/components/views/syntheticData/ImportDocumentation.jsx
"use client";

import React from 'react';
import { Code, FileText, BookOpen, AlertTriangle } from 'lucide-react';

const ImportDocumentation = () => {
  return (
    <div className="bg-slate-800 rounded-lg p-4 space-y-4">
      <h3 className="text-lg font-medium text-slate-200 flex items-center">
        <BookOpen className="mr-2" size={20} />
        Import Format Documentation
      </h3>

      <div className="text-sm text-slate-300 space-y-3">
        <p>
          The synthetic data generator accepts JSON files containing patient composition data.
          Each file should contain composition data for a single patient, with the following format:
        </p>

        <div className="bg-slate-900 p-3 rounded-md border border-slate-700 overflow-x-auto">
          <pre className="text-xs text-slate-300 whitespace-pre">
            {`{
  "ehr_id": "patient-identifier-uuid",
  "compositions": [
    {
      "_id": "composition-uuid-1",
      "ehr_id": "patient-identifier-uuid",
      "template_id": "template-identifier",
      "template_name": "Template Name",
      "archetype_node_id": "openEHR-EHR-COMPOSITION.archetype.vX",
      "composition_date": { "$date": "YYYY-MM-DDThh:mm:ss.sssZ" },
      "canonicalJSON": {
        // The complete openEHR composition in canonical JSON format
      }
    },
    {
      // Additional compositions for this patient...
    }
  ]
}`}
          </pre>
        </div>

        <div className="bg-blue-900/20 p-3 rounded-md border border-blue-800/50 flex items-start">
          <AlertTriangle size={16} className="text-blue-400 mt-1 mr-2 flex-shrink-0" />
          <div>
            <p className="font-medium text-blue-300 mb-1">Important Requirements</p>
            <ul className="list-disc list-inside text-slate-300 space-y-1">
              <li>Upload one JSON file per patient</li>
              <li>Each file must contain an <span className="text-blue-300 font-mono">ehr_id</span> and an array of <span className="text-blue-300 font-mono">compositions</span></li>
              <li>All compositions must be valid openEHR compositions.</li>
              <li>You will only be able to generate synthetic data for those for which you already uploaded its corresponding template</li>
              <li>You can select and upload multiple patient files at once</li>
              <li>Maximum file size: 100MB per file</li>
            </ul>
          </div>
        </div>

        <p>
          After uploading, the system will analyze each file to extract available templates
          and archetypes that can be used for synthetic data generation.
        </p>
      </div>
    </div>
  );
};

export default ImportDocumentation;