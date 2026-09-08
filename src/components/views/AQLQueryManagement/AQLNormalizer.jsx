// src/app/components/views/AQLQueryManagement/AQLNormalizer.jsx
"use client";

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, RefreshCw, FileText, X } from 'lucide-react';
import PropTypes from 'prop-types';
import { analyzeAffectedTemplates, normalizeAQL } from '@/lib/aql-normalizer';
import AQLEditor from "@/components/common/AQLEditor";
import { cn } from '@/lib/utils';

const AQLNormalizer = ({ 
  aqlText, 
  templates, 
  onClose, 
  onSaveNormalized,
  isOpen
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [affectedTemplates, setAffectedTemplates] = useState([]);
  const [normalizedAQL, setNormalizedAQL] = useState('');
  const [error, setError] = useState(null);
  const [expandedTemplates, setExpandedTemplates] = useState({});
  
  useEffect(() => {
    if (isOpen && aqlText && templates?.length > 0) {
      startAnalysis();
    }
  }, [isOpen, aqlText, templates]);
  
  const startAnalysis = async () => {
    if (!aqlText) {
      setError("No AQL query provided");
      return;
    }
    
    if (!templates || templates.length === 0) {
      setError("No templates available for analysis");
      return;
    }
    
    try {
      setIsAnalyzing(true);
      setProgress(0);
      setStatus('Analyzing templates...');
      setError(null);
      
      // Start the analysis
      const result = await analyzeAffectedTemplates(aqlText, templates);
      
      // Update state with results
      setAffectedTemplates(result.affectedTemplates);
      setStatus(result.status);
      setProgress(result.progress);
      
      if (result.error) {
        setError(result.error);
      } else if (result.affectedTemplates.length > 0) {
        // Generate normalized AQL
        const normalized = normalizeAQL(aqlText, result.affectedTemplates);
        setNormalizedAQL(normalized);
      }
    } catch (err) {
      console.error("Error during AQL analysis:", err);
      setError(err.message || "An error occurred during analysis");
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const handleToggleTemplate = (templateId) => {
    setExpandedTemplates(prev => ({
      ...prev,
      [templateId]: !prev[templateId]
    }));
  };
  
  const handleSave = () => {
    onSaveNormalized({
      normalizedAQL,
      affectedTemplates: affectedTemplates.map(template => ({
        id: template._id,
        name: template.name
      }))
    });
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center overflow-y-auto p-4">
      <div className="bg-surface rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-surface-hover px-6 py-4 rounded-t-lg flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center">
            <FileText className="mr-2" size={20} />
            AQL Normalization
          </h2>
          <button
            onClick={onClose}
            className="text-theme-secondary hover:text-white focus:outline-none"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {/* Status & Progress */}
          <div className="mb-4">
            {isAnalyzing ? (
              <div className="space-y-2">
                <div className="flex items-center text-theme-primary">
                  <RefreshCw size={16} className="mr-2 animate-spin" />
                  <span>{status}</span>
                </div>
                <div className="w-full bg-surface-hover rounded-full h-2.5">
                  <div
                    className="bg-primary h-2.5 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center text-red-400">
                <AlertTriangle size={16} className="mr-2" />
                <span>{error}</span>
              </div>
            ) : (
              <div className="flex items-center text-theme-primary">
                <Check size={16} className="mr-2 text-green-500" />
                <span>{status}</span>
              </div>
            )}
          </div>
          
          {/* Results */}
          <div className="space-y-4">
            {/* Affected Templates */}
            <div className="border border-theme rounded-lg">
              <div className="bg-surface-hover px-4 py-2 rounded-t-lg">
                <h3 className="font-medium text-theme-primary">
                  Affected Templates ({affectedTemplates.length})
                </h3>
              </div>
              <div className="p-4 max-h-48 overflow-y-auto">
                {affectedTemplates.length === 0 ? (
                  <p className="text-theme-secondary text-sm">
                    {isAnalyzing 
                      ? "Analyzing templates..." 
                      : error 
                        ? "Error analyzing templates" 
                        : "No affected templates found"}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {affectedTemplates.map(template => (
                      <li key={template._id} className="border-b border-theme pb-2 last:border-0 last:pb-0">
                        <div 
                          className="flex items-center cursor-pointer hover:bg-surface-hover p-1 rounded"
                          onClick={() => handleToggleTemplate(template._id)}
                        >
                          {expandedTemplates[template._id] ? (
                            <ChevronDown size={16} className="text-theme-secondary mr-2" />
                          ) : (
                            <ChevronRight size={16} className="text-theme-secondary mr-2" />
                          )}
                          <span className="font-medium text-theme-primary">{template.name}</span>
                        </div>
                        
                        {/* Template Details */}
                        {expandedTemplates[template._id] && (
                          <div className="mt-2 pl-6 text-sm text-theme-secondary">
                            <p>Type: {template.webTemplate?.rmType || "Unknown"}</p>
                            <p>NodeID: {template.webTemplate?.nodeId || "Unknown"}</p>
                            <p>Sections: {countSections(template)}</p>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            
            {/* Normalized AQL */}
            <div className="border border-theme rounded-lg">
              <div className="bg-surface-hover px-4 py-2 rounded-t-lg">
                <h3 className="font-medium text-theme-primary">
                  Normalized AQL
                </h3>
              </div>
              <div className="p-2">
                <AQLEditor
                  initialValue={normalizedAQL || aqlText}
                  readOnly={true}
                  height="200px"
                />
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="bg-surface-hover px-6 py-4 rounded-b-lg flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface text-white rounded-md hover:bg-surface-hover 
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={startAnalysis}
              disabled={isAnalyzing}
              className={cn(
                "px-4 py-2 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                isAnalyzing 
                  ? "bg-surface cursor-not-allowed" 
                  : "bg-primary hover:opacity-90"
              )}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw size={16} className="inline-block mr-1 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Re-analyze"
              )}
            </button>
            
            <button
              onClick={handleSave}
              disabled={isAnalyzing || affectedTemplates.length === 0}
              className={cn(
                "px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                isAnalyzing || affectedTemplates.length === 0
                  ? "bg-green-700/50 text-green-200/70 cursor-not-allowed" 
                  : "bg-green-700 text-white hover:bg-green-800"
              )}
            >
              Save Results
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to count sections in a template
function countSections(template) {
  if (!template.webTemplate?.tree) return 0;
  
  let count = 0;
  
  const countSectionsRecursive = (node) => {
    if (!node) return;
    
    if (node.rmType && node.rmType.toLowerCase().includes('section')) {
      count++;
    }
    
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach(countSectionsRecursive);
    }
  };
  
  countSectionsRecursive(template.webTemplate);
  return count;
}

AQLNormalizer.propTypes = {
  aqlText: PropTypes.string.isRequired,
  templates: PropTypes.array.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaveNormalized: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired
};

export default AQLNormalizer;