'use client';

import React, { useState, useEffect } from 'react';
import {
  FileCode,
  FileText,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Database,
  Search,
  Info,
  Link,
  Save,
  Settings,
  Layers,
  FileSearch,
  ChevronDown,
  ArrowRight,
  Package
} from 'lucide-react';

const DocumentTypeIdentifier = ({
  documentGroups,
  templates,
  onTemplateSelect,
  onGroupSelect,
  onContinue,
  typeTemplateAssociations = {}
}) => {
  const [templateSearch, setTemplateSearch] = useState({});
  const [showHelp, setShowHelp] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [selectedForMapping, setSelectedForMapping] = useState(new Set());
  const [showTemplateSelector, setShowTemplateSelector] = useState({});

  // Initialize selected items based on existing mappings and associations
  useEffect(() => {
    const preSelected = new Set();
    const preExpanded = {};
    const preShowTemplateSelector = {};
    Object.entries(documentGroups).forEach(([type, group]) => {
      // Auto-select if has mapping or template association
      if (group.hasMapping || typeTemplateAssociations[type]) {
        preSelected.add(type);
        preExpanded[type] = true;
        preShowTemplateSelector[type] = true;
      }
    });
    setSelectedForMapping(preSelected);
    setExpandedGroups((prev) => ({ ...prev, ...preExpanded }));
    setShowTemplateSelector((prev) => ({ ...prev, ...preShowTemplateSelector }));

    // Auto-expand single document type
    if (Object.keys(documentGroups).length === 1) {
      const singleType = Object.keys(documentGroups)[0];
      setExpandedGroups({ [singleType]: true });
      setShowTemplateSelector({ [singleType]: true });
    }
  }, [documentGroups, typeTemplateAssociations]);

  // Toggle group expansion
  const toggleGroupExpansion = (groupType) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupType]: !prev[groupType]
    }));
  };

  const getHandlerIcon = (handler) => {
    switch (handler) {
      case 'xml':
        return <FileCode className="text-warning" size={24} />;
      case 'csv':
        return <FileText className="text-success" size={24} />;
      case 'json':
        return <FileCode className="text-primary" size={24} />;
      default:
        return <FileText className="text-theme-secondary" size={24} />;
    }
  };

  const handleSelectForMapping = (groupType) => {
    setSelectedForMapping(prev => {
      const newSet = new Set(prev);
      newSet.add(groupType);
      return newSet;
    });
    setShowTemplateSelector(prev => ({
      ...prev,
      [groupType]: true
    }));
    
    // Call original onGroupSelect if provided
    if (onGroupSelect) {
      onGroupSelect(groupType);
    }
  };

  const canContinue = () => {
    // Check if at least one document type is selected AND has a template
    return Array.from(selectedForMapping).some(type => {
      const group = documentGroups[type];
      return group && group.selectedTemplate;
    });
  };

  const getFilteredTemplates = (groupType) => {
    const search = templateSearch[groupType]?.toLowerCase() || '';
    if (!search) return templates || [];
    return (templates || []).filter(t => {
      const n = (t?.name || '').toLowerCase();
      const d = (t?.metadata?.description || '').toLowerCase();
      return n.includes(search) || d.includes(search);
    });
  };

  // Template card component
  const TemplateCard = ({ template, isSelected, onSelect, groupType }) => {
    return (
      <div
        className={`
          p-3 rounded-lg border cursor-pointer transition-all
          ${isSelected 
            ? 'border-success bg-success/10' 
            : 'border-theme hover:border-primary bg-background hover:bg-surface'
          }
        `}
        onClick={() => onSelect(groupType, template._id)}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <h5 className={`font-medium ${isSelected ? 'text-success' : 'text-theme-primary'}`}>
              {template.name}
            </h5>
            {template.templateVersion && (
              <span className="text-xs text-theme-secondary">
                Version {template.templateVersion}
              </span>
            )}
          </div>
          {isSelected && (
            <CheckCircle className="text-success" size={20} />
          )}
        </div>
        
        {template.metadata?.description && (
          <p className="text-xs text-theme-secondary line-clamp-2">
            {template.metadata.description}
          </p>
        )}
      </div>
    );
  };

  const documentGroupsArray = Object.entries(documentGroups);
  const isSingleDocument = documentGroupsArray.length === 1;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-medium text-theme-primary mb-2">
            Document Type Identification
          </h3>
          <p className="text-theme-secondary text-sm">
            {isSingleDocument 
              ? 'Your document has been identified. Select a template to configure the mapping.'
              : 'Your documents have been grouped by type. Configure templates for each type you want to map.'}
          </p>
        </div>

        <button
          onClick={() => setShowHelp(!showHelp)}
          className="p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
        >
          <Info size={20} />
        </button>
      </div>

      {showHelp && (
        <div className="surface rounded-lg p-4 border border-primary bg-primary/5">
          <h4 className="font-medium text-primary mb-2">How Document Mapping Works</h4>
          <ol className="text-sm text-theme-secondary space-y-2 list-decimal pl-5">
            <li>Documents are automatically identified using pattern recognition</li>
            <li>Select "Configure Mapping" to set up field transformations</li>
            <li>Choose a target openEHR template for the document type</li>
            <li>Templates are saved for future use with similar documents</li>
          </ol>
        </div>
      )}

      {/* Document Groups */}
      <div className={`space-y-4 ${isSingleDocument ? '' : 'max-h-[600px] overflow-y-auto'}`}>
        {documentGroupsArray.map(([type, group]) => {
          const filteredTemplates = getFilteredTemplates(type);
          const isSelected = selectedForMapping.has(type);
          const hasTemplate = !!group.selectedTemplate;
          const hasMapping = !!group.hasMapping;
          const isExpanded = isSingleDocument || expandedGroups[type];
          const showTemplates = showTemplateSelector[type];

          return (
            <div
              key={type}
              className={`surface rounded-xl border-2 transition-all ${
                isSelected && hasTemplate 
                  ? 'border-success shadow-lg shadow-success/10' 
                  : isSelected
                  ? 'border-primary shadow-lg shadow-primary/10'
                  : 'border-theme'
              }`}
            >
              {/* Document Group Header - More prominent for single document */}
              <div className={`${isSingleDocument ? 'p-6' : 'p-4'}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    {getHandlerIcon(group.handler)}
                    
                    <div className="flex-1">
                      <h4 className={`${isSingleDocument ? 'text-xl' : 'text-lg'} font-semibold text-theme-primary mb-1`}>
                        {group.displayName || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </h4>
                      
                      <div className="flex items-center gap-3 text-sm text-theme-secondary mb-3">
                        <span className="flex items-center gap-1">
                          <Package size={14} />
                          {group.documents?.length || 0} document{(group.documents?.length || 0) !== 1 ? 's' : ''}
                        </span>
                        <span>•</span>
                        <span>Handler: {(group.handler || '').toUpperCase()}</span>
                        {type !== group.displayName && (
                          <>
                            <span>•</span>
                            <span>Type ID: {type}</span>
                          </>
                        )}
                      </div>

                      {/* Status badges */}
                      <div className="flex items-center gap-2 mb-3">
                        {hasMapping && (
                          <span className="flex items-center gap-1 text-xs bg-success/20 text-success px-3 py-1 rounded-full">
                            <CheckCircle size={12} />
                            Has existing mapping
                          </span>
                        )}
                        {typeTemplateAssociations[type] && (
                          <span className="flex items-center gap-1 text-xs bg-primary/20 text-primary px-3 py-1 rounded-full">
                            <Save size={12} />
                            Template auto-selected
                          </span>
                        )}
                        {hasTemplate && (
                          <span className="flex items-center gap-1 text-xs bg-success/20 text-success px-3 py-1 rounded-full">
                            <Link size={12} />
                            Template assigned
                          </span>
                        )}
                      </div>

                      {/* Action button - more prominent */}
                      {!isSelected ? (
                        <button
                          onClick={() => handleSelectForMapping(type)}
                          className="px-6 py-2.5 bg-primary text-primary-text rounded-lg hover:opacity-90 transition-all flex items-center gap-2 font-medium"
                        >
                          <Settings size={18} />
                          Configure Mapping
                          <ArrowRight size={18} />
                        </button>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-success font-medium flex items-center gap-2">
                            <CheckCircle size={16} />
                            Selected for mapping configuration
                          </div>
                          <button
                            onClick={() => {
                              setExpandedGroups(prev => ({ ...prev, [type]: true }));
                              setShowTemplateSelector(prev => ({ ...prev, [type]: true }));
                            }}
                            className="px-3 py-1.5 rounded bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
                          >
                            Select / Change OPT
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {!isSingleDocument && (
                    <button
                      onClick={() => toggleGroupExpansion(type)}
                      className="p-2 hover:bg-surface-hover rounded transition-colors"
                    >
                      <ChevronRight 
                        className={`text-theme-secondary transition-transform ${
                          isExpanded ? 'rotate-90' : ''
                        }`} 
                        size={20} 
                      />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t-2 border-theme p-6 space-y-4 bg-background/50">
                  {/* Document List */}
                  <div className="bg-background rounded-lg p-4 border border-theme">
                    <h5 className="text-sm font-semibold text-theme-primary mb-3 flex items-center gap-2">
                      <FileText size={16} />
                      Identified Documents
                    </h5>
                    <div className="space-y-2">
                      {(group.documents || []).map(doc => (
                        <div key={doc.id} className="flex items-center justify-between p-2 rounded hover:bg-surface transition-colors">
                          <span className="text-sm text-theme-primary flex items-center gap-2">
                            <FileText size={14} className="text-theme-secondary" />
                            {doc.fileName}
                          </span>
                          {doc.debugInfo?.matchedPattern && (
                            <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">
                              Pattern: {doc.debugInfo.matchedPattern}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Template Selection - Only show if selected for mapping */}
                  {showTemplates && (
                    <div className="bg-surface rounded-lg p-4 border border-theme">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="text-sm font-semibold text-theme-primary flex items-center gap-2">
                          <Layers size={16} />
                          Select Target Template
                        </h5>
                        {typeTemplateAssociations[type] && (
                          <span className="text-xs text-primary">
                            Auto-selected from saved association
                          </span>
                        )}
                      </div>

                      {/* Search Input */}
                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-theme-secondary" size={16} />
                        <input
                          type="text"
                          placeholder="Search templates by name or description..."
                          value={templateSearch[type] || ''}
                          onChange={(e) => setTemplateSearch(prev => ({
                            ...prev,
                            [type]: e.target.value
                          }))}
                          className="w-full pl-9 pr-3 py-2 input"
                        />
                      </div>

                      {/* Template Grid */}
                      <div className={`grid ${isSingleDocument ? 'grid-cols-3' : 'grid-cols-2'} gap-3 max-h-96 overflow-y-auto`}>
                        {filteredTemplates.length > 0 ? (
                          filteredTemplates.map(template => (
                            <TemplateCard
                              key={template._id}
                              template={template}
                              isSelected={group.selectedTemplate === template._id}
                              onSelect={onTemplateSelect}
                              groupType={type}
                            />
                          ))
                        ) : (
                          <div className="col-span-full text-center py-8 text-theme-secondary">
                            <FileSearch size={32} className="mx-auto mb-2 opacity-50" />
                            No templates found matching your search
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Continue Button - Only show when conditions are met */}
      {canContinue() && (
        <div className="flex items-center justify-between p-4 bg-success/10 rounded-lg border border-success/30">
          <div className="text-sm text-theme-primary">
            <span className="flex items-center gap-2">
              <CheckCircle className="text-success" size={16} />
              Ready to configure mapping for {Array.from(selectedForMapping).filter(type => 
                documentGroups[type]?.selectedTemplate
              ).length} document type{Array.from(selectedForMapping).length > 1 ? 's' : ''}
            </span>
          </div>

          <button
            onClick={onContinue}
            className="px-6 py-2.5 bg-success text-success-text rounded-lg hover:opacity-90 transition-all flex items-center gap-2 font-medium"
          >
            Continue to Mapping Configuration
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default DocumentTypeIdentifier;
