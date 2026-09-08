// src/components/views/mappingStudio/components/ValidationResults.jsx
"use client";

import React from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Download,
  RefreshCw,
  FileText,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ValidationResults = ({ 
  documentGroups, 
  validationResults, 
  transformedCompositions,
  onRevalidate, 
  onDownload,
  onIngest,
  ingestResults
}) => {
  const [expandedGroups, setExpandedGroups] = React.useState({});
  const [expandedDocuments, setExpandedDocuments] = React.useState({});

  const toggleGroupExpansion = (groupType) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupType]: !prev[groupType]
    }));
  };

  const toggleDocumentExpansion = (docId) => {
    setExpandedDocuments(prev => ({
      ...prev,
      [docId]: !prev[docId]
    }));
  };

  const getValidationStats = (groupType) => {
    const results = validationResults[groupType];
    if (!results) return { valid: 0, invalid: 0, warnings: 0, total: 0 };
    
    const entries = Object.values(results);
    return {
      valid: entries.filter(r => r.valid).length,
      invalid: entries.filter(r => !r.valid).length,
      warnings: entries.reduce((acc, r) => acc + (r.warnings?.length || 0), 0),
      total: entries.length
    };
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'error':
        return <XCircle className="text-error" size={14} />;
      case 'warning':
        return <AlertTriangle className="text-warning" size={14} />;
      default:
        return <AlertTriangle className="text-primary" size={14} />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-medium text-theme-primary mb-2">
          Validation Results
        </h3>
        <p className="text-theme-secondary text-sm">
          Review the validation results for your transformed compositions.
        </p>
      </div>

      <div className="space-y-4">
        {Object.entries(documentGroups).map(([type, group]) => {
          const stats = getValidationStats(type);
          const hasResults = stats.total > 0;
          const transformedForType = transformedCompositions[type] || {};
          const canValidate = Object.values(transformedForType).some(
            (item) => item?.status === 'transformed'
          );
          const isExpanded = expandedGroups[type] !== false;
          
          return (
            <div 
              key={type}
              className="surface rounded-lg border border-theme overflow-hidden"
            >
              {/* Group Header */}
              <div 
                className="p-4 cursor-pointer hover:surface-hover transition-colors"
                onClick={() => toggleGroupExpansion(type)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button className="text-theme-secondary">
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </button>
                    <h4 className="font-medium text-theme-primary">
                      {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </h4>
                    <span className="text-sm text-theme-secondary">
                      ({hasResults ? stats.total : group.documents.length} {hasResults ? 'outputs' : 'documents'})
                    </span>
                  </div>
                  
                  {hasResults && (
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle size={16} />
                        {stats.valid} valid
                      </span>
                      {stats.invalid > 0 && (
                        <span className="flex items-center gap-1 text-error">
                          <XCircle size={16} />
                          {stats.invalid} invalid
                        </span>
                      )}
                      {stats.warnings > 0 && (
                        <span className="flex items-center gap-1 text-warning">
                          <AlertTriangle size={16} />
                          {stats.warnings} warnings
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-theme">
                  {hasResults ? (
                    <div className="p-4 space-y-3">
                      {Object.entries(validationResults[type] || {}).map(([entryId, validation]) => {
                        const composition = transformedCompositions[type]?.[entryId];
                        const fileName = composition?.fileName || composition?.sourceFileName || entryId;
                        const isDocExpanded = expandedDocuments[entryId];

                        if (!validation || !composition) return null;
                        
                        return (
                          <div 
                            key={entryId}
                            className="bg-background rounded border border-theme"
                          >
                            {/* Document Header */}
                            <div 
                              className="p-3 cursor-pointer hover:surface-hover transition-colors"
                              onClick={() => toggleDocumentExpansion(entryId)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FileText className="text-theme-secondary" size={16} />
                                  <span className="text-sm text-theme-primary font-medium">
                                    {fileName}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  {validation.valid ? (
                                    <CheckCircle className="text-success" size={18} />
                                  ) : (
                                    <XCircle className="text-error" size={18} />
                                  )}
                                  {(validation.errors?.length > 0 || validation.warnings?.length > 0) && (
                                    <button className="text-theme-secondary">
                                      {isDocExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {/* Validation Details */}
                            {isDocExpanded && (validation.errors?.length > 0 || validation.warnings?.length > 0) && (
                              <div className="border-t border-theme p-3 space-y-2">
                                {validation.errors?.map((error, idx) => (
                                  <div 
                                    key={`error-${idx}`}
                                    className="flex items-start gap-2 text-xs"
                                  >
                                    {getSeverityIcon('error')}
                                    <div className="flex-1">
                                      <span className="text-error">{error.message}</span>
                                      {error.path && (
                                        <span className="text-theme-secondary ml-2">at {error.path}</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {validation.warnings?.map((warning, idx) => (
                                  <div 
                                    key={`warning-${idx}`}
                                    className="flex items-start gap-2 text-xs"
                                  >
                                    {getSeverityIcon('warning')}
                                    <div className="flex-1">
                                      <span className="text-warning">{warning.message}</span>
                                      {warning.path && (
                                        <span className="text-theme-secondary ml-2">at {warning.path}</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-theme-secondary">
                      No validation results yet. Click Revalidate to run checks on transformed documents.
                    </div>
                  )}

                  {/* Actions */}
                  <div className="p-4 border-t border-theme flex gap-2">
                    <button
                      onClick={() => onRevalidate(type)}
                      disabled={!canValidate}
                      className={cn(
                        "flex-1 px-4 py-2 rounded flex items-center justify-center gap-2",
                        canValidate
                          ? "btn-primary"
                          : "surface text-theme-secondary cursor-not-allowed"
                      )}
                    >
                      <RefreshCw size={16} />
                      Revalidate
                    </button>
                    
                    <button
                      onClick={() => onDownload(type)}
                      disabled={stats.valid === 0}
                      className={cn(
                        "flex-1 px-4 py-2 rounded flex items-center justify-center gap-2",
                        stats.valid > 0
                          ? "bg-success text-success-text hover:opacity-80"
                          : "surface text-theme-secondary cursor-not-allowed"
                      )}
                    >
                      <Download size={16} />
                      Download Valid ({stats.valid})
                    </button>

                    <button
                      onClick={() => onIngest?.(type)}
                      disabled={stats.valid === 0 || typeof onIngest !== 'function'}
                      className={cn(
                        "flex-1 px-4 py-2 rounded flex items-center justify-center gap-2",
                        stats.valid > 0 && typeof onIngest === 'function'
                          ? "bg-primary text-primary-text hover:opacity-80"
                          : "surface text-theme-secondary cursor-not-allowed"
                      )}
                    >
                      Ingest Valid ({stats.valid})
                    </button>
                  </div>

                  {ingestResults?.[type]?.message && (
                    <div className={cn(
                      "px-4 pb-4 text-sm",
                      ingestResults[type].ok ? "text-success" : "text-error"
                    )}>
                      {ingestResults[type].message}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      {Object.keys(documentGroups).length > 0 && (
        <div className="surface rounded-lg p-4 border border-theme">
          <h4 className="text-sm font-medium text-theme-primary mb-3">Validation Summary</h4>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(documentGroups).map(([type, group]) => {
              const stats = getValidationStats(type);
              if (stats.total === 0) return null;
              
              return (
                <div key={type} className="text-center">
                  <p className="text-xs text-theme-secondary mb-1">
                    {type.replace(/_/g, ' ').toLowerCase()}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-success font-medium">{stats.valid}</span>
                    <span className="text-theme-secondary">/</span>
                    <span className="text-theme-primary">{stats.total}</span>
                  </div>
                  <div className="w-full bg-background rounded-full h-1 mt-2">
                    <div 
                      className="bg-success h-1 rounded-full"
                      style={{ width: `${(stats.valid / stats.total) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidationResults;
