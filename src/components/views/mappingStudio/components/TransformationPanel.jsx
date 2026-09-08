// src/components/views/mappingStudio/components/TransformationPanel.jsx
"use client";

import React from 'react';
import { 
  Play, 
  Download, 
  Eye,
  CheckCircle, 
  AlertCircle,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const TransformationPanel = ({ 
  documentGroups, 
  transformedCompositions, 
  onTransform, 
  onDownload,
  onPreviewGroup,
  onGoMap,
  onValidate 
}) => {
  const formatErrorForDisplay = (value) => {
    if (typeof value === 'string') return value;
    if (value == null) return 'Unknown transformation error';
    if (value instanceof Error) return value.message || 'Unknown transformation error';
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const getGroupStatus = (groupType) => {
    const compositions = transformedCompositions[groupType];
    if (!compositions) return 'pending';
    
    const statuses = Object.values(compositions);
    if (statuses.every(s => s.status === 'transformed')) return 'success';
    if (statuses.some(s => s.status === 'error')) return 'error';
    return 'processing';
  };

  const getTransformationStats = (groupType) => {
    const compositions = transformedCompositions[groupType];
    if (!compositions) return { transformed: 0, errors: 0, total: 0 };
    
    const values = Object.values(compositions);
    return {
      transformed: values.filter(v => v.status === 'transformed').length,
      errors: values.filter(v => v.status === 'error').length,
      total: values.length
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-medium text-theme-primary mb-2">
          Transform Documents
        </h3>
        <p className="text-theme-secondary text-sm">
          Transform your documents to openEHR compositions using the defined mappings.
        </p>
      </div>

      <div className="space-y-4">
        {Object.entries(documentGroups).map(([type, group]) => {
          const status = getGroupStatus(type);
          const stats = getTransformationStats(type);
          const hasMapping = !!group?.hasMapping;
          const hasTemplate = !!group?.selectedTemplate;
          const isReady = hasMapping && hasTemplate;
          const missingReasons = [];
          if (!hasMapping) missingReasons.push('missing mapping');
          if (!hasTemplate) missingReasons.push('missing target template');
          
          return (
            <div 
              key={type}
              className="surface rounded-lg p-4 border border-theme"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-theme-primary">
                    {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </h4>
                  <p className="text-sm text-theme-secondary">
                    {stats.total > 0
                      ? `${stats.total} output${stats.total > 1 ? 's' : ''} from ${group.documents.length} source document${group.documents.length > 1 ? 's' : ''}`
                      : `${group.documents.length} source document${group.documents.length > 1 ? 's' : ''}`}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  {status === 'success' && (
                    <div className="flex items-center gap-1 text-success">
                      <CheckCircle size={20} />
                      <span className="text-sm">{stats.transformed} transformed</span>
                    </div>
                  )}
                  {status === 'error' && (
                    <div className="flex items-center gap-1 text-error">
                      <AlertCircle size={20} />
                      <span className="text-sm">{stats.errors} errors</span>
                    </div>
                  )}
                  {status === 'processing' && (
                    <Loader2 className="animate-spin text-primary" size={20} />
                  )}
                </div>
              </div>

              {/* Progress bar if transformation is in progress */}
              {stats.total > 0 && (
                <div className="mb-3">
                  <div className="w-full bg-background rounded-full h-2">
                    <div 
                      className={cn(
                        "h-2 rounded-full transition-all",
                        stats.errors > 0 ? "bg-error" : "bg-success"
                      )}
                      style={{ width: `${(stats.transformed / stats.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-theme-secondary mt-1">
                    {stats.transformed} of {stats.total} documents transformed
                  </p>
                </div>
              )}

              {/* Error details if any */}
              {status === 'error' && transformedCompositions[type] && (
                <div className="mb-3 bg-error/20 border border-error rounded p-3">
                  <p className="text-sm text-error mb-2">Transformation errors:</p>
                  <div className="space-y-1">
                    {Object.entries(transformedCompositions[type])
                      .filter(([_, data]) => data.status === 'error')
                      .slice(0, 3)
                      .map(([docId, data]) => {
                        const doc = group.documents.find(d => d.id === docId);
                        return (
                          <div key={docId} className="text-xs text-error">
                            • {doc?.fileName || docId}: {formatErrorForDisplay(data.error)}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => onTransform(type)}
                  disabled={!isReady}
                  className={cn(
                    "flex-1 px-4 py-2 rounded flex items-center justify-center gap-2",
                    isReady
                      ? "btn-primary"
                      : "surface text-theme-secondary cursor-not-allowed"
                  )}
                >
                  <Play size={16} />
                  {stats.total > 0 ? 'Re-transform' : 'Transform'}
                </button>
                
                {transformedCompositions[type] && stats.transformed > 0 && (
                  <button
                    onClick={() => onPreviewGroup && onPreviewGroup(type)}
                    className="px-4 py-2 bg-slate-700 text-slate-100 rounded hover:bg-slate-600 flex items-center gap-2"
                  >
                    <Eye size={16} />
                    View ({stats.transformed})
                  </button>
                )}

                {transformedCompositions[type] && stats.transformed > 0 && (
                  <button
                    onClick={() => onDownload(type)}
                    className="px-4 py-2 bg-success text-success-text rounded hover:opacity-80 flex items-center gap-2"
                  >
                    <Download size={16} />
                    Download ({stats.transformed})
                  </button>
                )}
              </div>

              {!isReady && (
                <p className="text-xs text-theme-secondary mt-2">
                  Not ready to transform: {missingReasons.join(', ')}.
                </p>
              )}

              {!isReady && (
                <div className="mt-2">
                  <button
                    onClick={() => onGoMap && onGoMap(type)}
                    className="px-3 py-1.5 bg-slate-700 text-slate-100 rounded text-sm hover:bg-slate-600"
                  >
                    Configure in Map
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {Object.keys(documentGroups).length === 0 && (
        <div className="text-center py-8 text-theme-secondary">
          <p>No document groups available yet.</p>
          <p className="text-sm mt-2">Upload and identify documents first.</p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={onValidate}
          disabled={Object.keys(transformedCompositions).length === 0}
          className={cn(
            "px-6 py-2 rounded flex items-center gap-2",
            Object.keys(transformedCompositions).length > 0
              ? "bg-success text-success-text hover:opacity-80"
              : "surface text-theme-secondary cursor-not-allowed"
          )}
        >
          Continue to Validation
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default TransformationPanel;
