// src/components/views/mappingStudio/components/MappingContextPanel.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  ChevronRight, 
  FileText, 
  Database, 
  Type, 
  List, 
  Calendar, 
  Hash,
  ToggleLeft,
  Code,
  Layers
} from 'lucide-react';

const MappingContextPanel = ({ 
  field, 
  type, 
  document, 
  onClose 
}) => {
  const [xmlContent, setXmlContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({});

  useEffect(() => {
    if (document && document.file && type === 'source') {
      loadDocumentContent();
    } else {
      setLoading(false);
    }
  }, [document, field, type]);

  // Load document content for context visualization
  const loadDocumentContent = async () => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        setXmlContent(e.target.result);
        setLoading(false);
      };
      reader.onerror = () => {
        setLoading(false);
      };
      reader.readAsText(document.file);
    } catch (error) {
      console.error('Error loading document:', error);
      setLoading(false);
    }
  };

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Get icon for data type
  const getDataTypeIcon = (dataType) => {
    switch (dataType) {
      case 'TEXT':
      case 'DV_TEXT':
        return <Type size={14} className="text-blue-400" />;
      case 'CODED_TEXT':
      case 'DV_CODED_TEXT':
        return <List size={14} className="text-purple-400" />;
      case 'DATETIME':
      case 'DV_DATE_TIME':
        return <Calendar size={14} className="text-green-400" />;
      case 'QUANTITY':
      case 'DV_QUANTITY':
        return <Hash size={14} className="text-orange-400" />;
      case 'BOOLEAN':
      case 'DV_BOOLEAN':
        return <ToggleLeft size={14} className="text-pink-400" />;
      default:
        return <Database size={14} className="text-slate-400" />;
    }
  };

  // Find XML context
  const getXmlContext = () => {
    if (!xmlContent || !field || !field.path) return null;
    
    try {
      // This is a simplified version - in a real implementation,
      // you'd want to use a proper XML parser
      const lines = xmlContent.split('\n');
      const matches = [];
      
      // For simple field.path like '//fieldName'
      const fieldName = field.path.replace('//', '');
      const regex = new RegExp(`<${fieldName}[^>]*>(.*?)</${fieldName}>`, 'g');
      
      let match;
      while ((match = regex.exec(xmlContent)) !== null) {
        matches.push({
          element: match[0],
          value: match[1],
          position: match.index
        });
      }
      
      if (matches.length === 0) return null;
      
      // Get surrounding context (a few lines before and after)
      const contextMatch = matches[0];
      const startPos = Math.max(0, xmlContent.lastIndexOf('<', contextMatch.position));
      const endPos = Math.min(xmlContent.length, xmlContent.indexOf('>', contextMatch.position + contextMatch.element.length) + 1);
      
      const startLineIndex = xmlContent.substring(0, startPos).split('\n').length - 1;
      const endLineIndex = xmlContent.substring(0, endPos).split('\n').length - 1;
      
      // Get lines with context
      const contextLines = lines.slice(
        Math.max(0, startLineIndex - 5),
        Math.min(lines.length, endLineIndex + 5)
      );
      
      return contextLines.join('\n');
    } catch (error) {
      console.error('Error getting XML context:', error);
      return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="dark-banner bg-slate-800 rounded-lg p-4 max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-theme-primary">
            {type === 'source' ? 'Source Field Context' : 'Target Field Hierarchy'}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>
        
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-theme-secondary">Loading...</div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {type === 'source' ? (
              // Source Field Context
              <div className="space-y-4">
                <div className="bg-slate-700 p-3 rounded">
                  <h4 className="text-sm font-medium text-theme-primary mb-2">Field Information</h4>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="text-sm text-theme-secondary w-24">Name:</span>
                      <span className="text-sm text-theme-primary font-mono">{field?.name}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm text-theme-secondary w-24">Path:</span>
                      <span className="text-sm text-theme-primary font-mono">{field?.path}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm text-theme-secondary w-24">Type:</span>
                      <span className="text-sm text-theme-primary">{field?.type}</span>
                    </div>
                  </div>
                </div>
                
                {field?.context && (
                  <div className="bg-slate-700 p-3 rounded">
                    <h4 className="text-sm font-medium text-theme-primary mb-2">Element Context</h4>
                    <div className="text-sm text-theme-primary">
                      <pre className="font-mono text-xs whitespace-pre-wrap">
                        {JSON.stringify(field.context, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
                
                {field?.samples?.length > 0 && (
                  <div className="bg-slate-700 p-3 rounded">
                    <h4 className="text-sm font-medium text-theme-primary mb-2">Sample Values</h4>
                    <div className="space-y-2">
                      {field.samples.map((sample, idx) => (
                        <div key={idx} className="bg-primary/10 p-2 rounded">
                          <span className="text-sm text-primary font-mono">{String(sample)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {xmlContent && (
                  <div className="bg-slate-700 p-3 rounded">
                    <h4 className="text-sm font-medium text-theme-primary mb-2">XML Context</h4>
                    <div className="bg-slate-900 p-2 rounded">
                      <pre className="font-mono text-xs text-theme-primary whitespace-pre-wrap overflow-auto max-h-64">
                        {getXmlContext() || 'No context found'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Target Field Hierarchy
              <div className="space-y-4">
                <div className="bg-slate-700 p-3 rounded">
                  <h4 className="text-sm font-medium text-theme-primary mb-2">Field Information</h4>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <span className="text-sm text-theme-secondary w-24">Name:</span>
                      <span className="text-sm text-theme-primary">{field?.name}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm text-theme-secondary w-24">Path:</span>
                      <span className="text-sm text-theme-primary font-mono">{field?.path}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm text-theme-secondary w-24">Type:</span>
                      <span className="text-sm text-theme-primary">{field?.type}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm text-theme-secondary w-24">Data Type:</span>
                      <span className="text-sm text-theme-primary">{field?.dataType}</span>
                    </div>
                    {field?.required && (
                      <div className="flex items-center">
                        <span className="text-sm text-theme-secondary w-24">Required:</span>
                        <span className="text-sm text-error">Yes</span>
                      </div>
                    )}
                    {field?.multiple && (
                      <div className="flex items-center">
                        <span className="text-sm text-theme-secondary w-24">Cardinality:</span>
                        <span className="text-sm text-primary">Multiple (0..*)</span>
                      </div>
                    )}
                  </div>
                </div>
                
                {field?.ancestors && (
                  <div className="bg-slate-700 p-3 rounded">
                    <h4 className="text-sm font-medium text-theme-primary mb-2">Element Hierarchy</h4>
                    <div className="space-y-2">
                      {field.ancestors.map((ancestor, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-center"
                          style={{ marginLeft: `${idx * 16}px` }}
                        >
                          {idx < field.ancestors.length - 1 ? (
                            <ChevronRight size={14} className="text-theme-secondary mr-1" />
                          ) : (
                            <div className="w-5"></div>
                          )}
                          <span className={`text-sm ${
                            idx === field.ancestors.length - 1 
                              ? "text-primary font-medium" 
                              : "text-theme-secondary"
                          }`}>
                            {ancestor.name || ancestor.id}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {field?.constraints?.allowedValues && (
                  <div className="bg-slate-700 p-3 rounded">
                    <h4 className="text-sm font-medium text-theme-primary mb-2">Allowed Values</h4>
                    <div className="flex flex-wrap gap-2">
                      {field.constraints.allowedValues.map((value, idx) => (
                        <span key={idx} className="text-xs bg-purple-900/20 text-purple-300 px-2 py-1 rounded">
                          {value}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {field?.description && (
                  <div className="bg-slate-700 p-3 rounded">
                    <h4 className="text-sm font-medium text-theme-primary mb-2">Description</h4>
                    <div className="text-sm text-theme-primary">
                      {field.description}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 text-theme-secondary rounded hover:bg-slate-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default MappingContextPanel;