//src/components/views/lab/MQLPreviewTab.jsx 
'use client';

import React, { useState } from 'react';
import Editor from "@monaco-editor/react";
import PropTypes from 'prop-types';
import { Copy, Check, Download, Minimize, Maximize, Loader2 } from 'lucide-react';
import { stringifyMongoShell } from '@/lib/kehrnel/mongoShellFormatter';

const MQLPreviewTab = ({ mqlOutput, onGenerateMQL, isGenerating, error }) => {
  const [copiedStates, setCopiedStates] = useState({});
  const [expandedStates, setExpandedStates] = useState({});
  const [copyAllSuccess, setCopyAllSuccess] = useState(false);
  const [viewMode, setViewMode] = useState('stages');

  let pipeline = [];

  try {
    if (mqlOutput) {
      pipeline = JSON.parse(mqlOutput);
    }
  } catch (error) {
    console.error('Failed to parse MQL output:', error);
  }

  // Helper function to check if mqlOutput is a valid pipeline array
  const isParsedPipeline = () => {
    try {
      const parsed = JSON.parse(mqlOutput);
      return Array.isArray(parsed);
    } catch (error) {
      return false;
    }
  };

  const formattedPipeline = isParsedPipeline()
    ? stringifyMongoShell(pipeline, 2)
    : (mqlOutput || 'No MQL generated yet. Click "Generate MQL" to create MongoDB query language from your AQL.');

  // Handle copy for individual stage
  const handleCopyStage = (index, content) => {
    navigator.clipboard.writeText(stringifyMongoShell(content, 2));

    // Update copied state for this specific stage
    setCopiedStates(prev => ({
      ...prev,
      [index]: true
    }));

    // Reset copied state after 2 seconds
    setTimeout(() => {
      setCopiedStates(prev => ({
        ...prev,
        [index]: false
      }));
    }, 2000);
  };

  // Handle copy entire pipeline
  const handleCopyPipeline = () => {
    navigator.clipboard.writeText(formattedPipeline);
    setCopyAllSuccess(true);

    setTimeout(() => {
      setCopyAllSuccess(false);
    }, 2000);
  };

  // Handle export pipeline as Mongo shell file
  const handleExportPipeline = () => {
    const blob = new Blob([formattedPipeline], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mongodb-pipeline.mongodb.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Toggle expanded state for a specific stage
  const toggleExpanded = (index) => {
    setExpandedStates(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Get stage label based on its content
  const getStageLabel = (stage) => {
    const stageKey = Object.keys(stage)[0];
    switch (stageKey) {
      case '$match':
        return 'Match Stage (FROM CONTAINS + WHERE)';
      case '$project':
        return 'Project Stage (SELECT)';
      case '$addFields':
        return 'Add Fields Stage';
      case '$sort':
        return 'Sort Stage (ORDER BY)';
      case '$limit':
        return 'Limit Stage';
      case '$skip':
        return 'Skip Stage';
      default:
        return `Stage: ${stageKey}`;
    }
  };

  // Get corresponding AQL part for a stage
  const getAqlPart = (stage) => {
    const stageKey = Object.keys(stage)[0];
    if (stageKey === '$match') {
      return (
        <div className="text-xs text-slate-400 mt-1 border-l-2 border-blue-500 pl-2">
          <div>FROM EHR e...</div>
          <div>CONTAINS...</div>
          <div>WHERE...</div>
        </div>
      );
    } else if (stageKey === '$project') {
      return (
        <div className="text-xs text-slate-400 mt-1 border-l-2 border-green-500 pl-2">
          <div>SELECT...</div>
        </div>
      );
    } else if (stageKey === '$sort') {
      return (
        <div className="text-xs text-slate-400 mt-1 border-l-2 border-yellow-500 pl-2">
          <div>ORDER BY...</div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-slate-800 p-6 rounded-lg">
      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-900/30 border border-red-700/40 text-red-200 text-sm">
          {error}
        </div>
      )}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-slate-200">MongoDB MQL Output</h3>
        <div className="flex space-x-2">
          {isParsedPipeline() && (
            <>
              <div className="flex rounded-md overflow-hidden border border-slate-600">
                <button
                  className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${
                    viewMode === 'pipeline'
                      ? 'bg-slate-600 text-slate-100'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                  onClick={() => setViewMode('pipeline')}
                  title="Show the full pipeline as a single MongoDB aggregation array"
                >
                  Full Pipeline
                </button>
                <button
                  className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${
                    viewMode === 'stages'
                      ? 'bg-slate-600 text-slate-100'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                  onClick={() => setViewMode('stages')}
                  title="Inspect the pipeline stage by stage"
                >
                  Stage by Stage
                </button>
              </div>
              <button
                className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 flex items-center gap-1"
                onClick={handleCopyPipeline}
                title="Copy entire pipeline"
              >
                {copyAllSuccess ? <Check size={14} /> : <Copy size={14} />}
                <span>{copyAllSuccess ? 'Copied!' : 'Copy All'}</span>
              </button>
              <button
                className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 flex items-center gap-1"
                onClick={handleExportPipeline}
                title="Export pipeline as Mongo shell file"
              >
                <Download size={14} />
                <span>Export</span>
              </button>
            </>
          )}
          <button
            className="px-4 py-2 bg-primary text-primary-text rounded-md hover:bg-primary-hover transition-colors"
            onClick={onGenerateMQL}
            disabled={!!isGenerating}
          >
            {isGenerating ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Generating MQL...
              </span>
            ) : (
              'Generate MQL'
            )}
          </button>
        </div>
      </div>

      {isParsedPipeline() && viewMode === 'stages' ? (
        <div className="space-y-4">
          {pipeline.map((stage, index) => (
            <div key={index} className="bg-slate-700 p-4 rounded-lg border border-slate-600">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-md font-semibold text-slate-300">
                  {getStageLabel(stage)}
                </h4>
                <div className="flex space-x-2">
                  <button
                    className="p-1.5 bg-slate-600 text-slate-300 rounded-md hover:bg-slate-500 flex items-center"
                    onClick={() => toggleExpanded(index)}
                    title={expandedStates[index] ? "Collapse" : "Expand"}
                  >
                    {expandedStates[index] ? <Minimize size={14} /> : <Maximize size={14} />}
                  </button>
                  <button
                    className="p-1.5 bg-slate-600 text-slate-300 rounded-md hover:bg-slate-500 flex items-center"
                    onClick={() => handleCopyStage(index, stage)}
                    title="Copy this stage"
                  >
                    {copiedStates[index] ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>

              {getAqlPart(stage, index)}
              <div className="mt-2">
                <Editor
                  height={expandedStates[index] ? "300px" : "150px"}
                  theme="vs-dark"
                  defaultLanguage="javascript"
                  value={stringifyMongoShell(stage, 2)}
                  options={{
                    minimap: { enabled: false },
                    wordWrap: "off",
                    fontSize: 12,
                    readOnly: true,
                    padding: { top: 10 },
                    stickyScroll: { enabled: false },
                    scrollBeyondLastLine: false
                  }}
                  className="resize-y overflow-auto"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Editor
          height="500px"
          theme="vs-dark"
          defaultLanguage="javascript"
          value={formattedPipeline}
          options={{
            minimap: { enabled: false },
            wordWrap: "off",
            fontSize: 12,
            readOnly: true,
            padding: { top: 10 },
            stickyScroll: { enabled: false },
            scrollBeyondLastLine: false
          }}
        />
      )}
    </div>
  );
};

MQLPreviewTab.propTypes = {
  mqlOutput: PropTypes.string,
  onGenerateMQL: PropTypes.func.isRequired,
  isGenerating: PropTypes.bool,
  error: PropTypes.string,
  transformationStatus: PropTypes.string,
  onUpdateStatus: PropTypes.func
};

export default MQLPreviewTab;
