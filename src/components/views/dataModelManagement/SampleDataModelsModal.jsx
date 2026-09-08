// src/components/views/dataModelManagement/SampleDataModelsModal.jsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { X, Loader2, AlertTriangle, Download, Search, CheckCircle, Code, Globe, Database, ChevronDown, ChevronUp, Hash, Layers, Tag, Box, List } from 'lucide-react';
import { cn } from '@/lib/utils';

// Domain configuration (text-only, no icons for branding consistency)
const DOMAINS = [
  { id: 'openehr', label: 'openEHR®', description: 'Clinical templates and archetypes' },
  { id: 'fhir', label: 'FHIR®', description: 'HL7 FHIR resources' },
  { id: 'context', label: 'ContextObjects', description: 'Pre-built context schemas' },
];

const SampleDataModelsModal = ({ templates, isLoading, onClose, onImport, isImporting }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [expandedTemplate, setExpandedTemplate] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'
  const [activeDomain, setActiveDomain] = useState('openehr');
  const [domainSamples, setDomainSamples] = useState({ openehr: [], fhir: [], context: [] });
  const [loadingDomain, setLoadingDomain] = useState(false);
  const [domainCounts, setDomainCounts] = useState({ openehr: 0, fhir: 0, context: 0 });

  const templatesWithOpt = useMemo(() => {
    return (templates || []).filter(t => t?.source?.type === 'opt');
  }, [templates]);

  // Fetch samples for non-OpenEHR domains
  useEffect(() => {
    const fetchDomainSamples = async () => {
      if (activeDomain === 'openehr') return;

      setLoadingDomain(true);
      try {
        const res = await fetch(`/api/sample-data-models?domain=${activeDomain}&limit=100`);
        if (res.ok) {
          const data = await res.json();
          setDomainSamples(prev => ({
            ...prev,
            [activeDomain]: data.items || data || []
          }));
        }
      } catch (e) {
        console.error(`Failed to fetch ${activeDomain} samples:`, e);
      } finally {
        setLoadingDomain(false);
      }
    };
    fetchDomainSamples();
  }, [activeDomain]);

  // Fetch domain counts on mount
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        setDomainCounts(prev => ({ ...prev, openehr: templatesWithOpt.length }));

        const res = await fetch('/api/sample-data-models?summary=true');
        if (res.ok) {
          const data = await res.json();
          if (data.counts?.byDomain) {
            setDomainCounts(prev => ({
              ...prev,
              fhir: data.counts.byDomain.fhir || 0,
              context: data.counts.byDomain.context || 0,
            }));
          }
        }
      } catch (e) {
        console.warn('Failed to fetch sample counts:', e);
      }
    };
    fetchCounts();
  }, [templatesWithOpt.length]);

  // Get current domain's samples
  const currentDomainSamples = useMemo(() => {
    if (activeDomain === 'openehr') return templatesWithOpt;
    return domainSamples[activeDomain] || [];
  }, [activeDomain, templatesWithOpt, domainSamples]);

  const fetchTemplateById = async (id) => {
    // All domains now use the unified sample-data-models API
    const res = await fetch(`/api/sample-data-models/${id}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Failed to fetch sample ${id}`);
    return res.json();
  };

  // Filter samples based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredTemplates(currentDomainSamples);
    } else {
      const q = searchTerm.toLowerCase();
      setFilteredTemplates(
        currentDomainSamples.filter(sample => {
          const md = sample.metadata || {};
          // Common fields
          const matchesCommon = (
            sample.name?.toLowerCase().includes(q) ||
            (md.description || sample.description || '').toLowerCase().includes(q)
          );

          // OpenEHR-specific fields
          if (activeDomain === 'openehr') {
            return matchesCommon ||
              (md.templateId || '').toLowerCase().includes(q) ||
              (md.compositionKind || '').toLowerCase().includes(q) ||
              (Array.isArray(md.languages) && md.languages.some(l => (l || '').toLowerCase().includes(q))) ||
              (Array.isArray(md.terminologies) && md.terminologies.some(t => (t || '').toLowerCase().includes(q))) ||
              (Array.isArray(md.entryTypes) && md.entryTypes.some(e => (e.name || '').toLowerCase().includes(q) || (e.nodeId || '').toLowerCase().includes(q)));
          }

          // FHIR-specific fields
          if (activeDomain === 'fhir') {
            return matchesCommon ||
              (sample.modelType || '').toLowerCase().includes(q) ||
              (sample.domainData?.resourceType || '').toLowerCase().includes(q);
          }

          // Context-specific fields
          if (activeDomain === 'context') {
            return matchesCommon ||
              (sample.modelType || '').toLowerCase().includes(q);
          }

          return matchesCommon;
        })
      );
    }
  }, [currentDomainSamples, searchTerm, activeDomain]);

  // Toggle template selection
  const toggleTemplateSelection = (template) => {
    setSelectedTemplates(prev => {
      const isSelected = prev.some(t => t._id === template._id);
      if (isSelected) {
        return prev.filter(t => t._id !== template._id);
      } else {
        return [...prev, template];
      }
    });
  };

  // Select all filtered templates
  const selectAll = () => {
    setSelectedTemplates(filteredTemplates);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedTemplates([]);
  };

  // Import selected templates
  const importSelectedTemplates = async () => {
    if (selectedTemplates.length === 0) return;
    try {
      const fullDocs = await Promise.all(
        selectedTemplates.map(t => fetchTemplateById(t._id))
      );
      onImport(fullDocs);
      setSelectedTemplates([]);
    } catch (e) {
      console.error(e);
    }
  };

  // Check if a template is selected
  const isTemplateSelected = (templateId) => {
    return selectedTemplates.some(t => t._id === templateId);
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return null;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  // Get metadata stats
  const getTemplateStats = (template) => {
    const md = template.metadata || {};
    const stats = [];
    
    if (md.entryTypes?.length) {
      stats.push({ 
        icon: Layers, 
        label: 'Entry Types', 
        value: md.entryTypes.length,
        color: 'text-blue-500'
      });
    }
    
    if (md.archetypes?.length) {
      stats.push({ 
        icon: Box, 
        label: 'Archetypes', 
        value: md.archetypes.length,
        color: 'text-purple-500'
      });
    }
    
    if (md.datatypes?.length) {
      stats.push({ 
        icon: Code, 
        label: 'Data Types', 
        value: md.datatypes.length,
        color: 'text-green-500'
      });
    }
    
    if (md.counts?.nodeCount) {
      stats.push({ 
        icon: Hash, 
        label: 'Nodes', 
        value: md.counts.nodeCount,
        color: 'text-orange-500'
      });
    }
    
    return stats;
  };

  // Get template metadata for expanded view
  const getExpandedMetadata = (template) => {
    const md = template.metadata || {};
    const sections = [];
    
    // Entry Types with names and nodeIds
    if (md.entryTypes?.length) {
      sections.push({
        title: 'Entry Types',
        icon: Layers,
        items: md.entryTypes.map(et => ({
          main: et.name || et.nodeId,
          sub: et.rmType,
          full: et
        })),
        color: 'blue',
        type: 'detailed'
      });
    }
    
    // Archetypes with names and nodeIds
    if (md.archetypes?.length) {
      const displayArchetypes = md.archetypes.slice(0, 5);
      sections.push({
        title: 'Archetypes',
        icon: Box,
        items: displayArchetypes.map(arch => ({
          main: arch.name || arch.nodeId,
          sub: arch.rmType,
          full: arch
        })),
        hasMore: md.archetypes.length > 5,
        totalCount: md.archetypes.length,
        color: 'purple',
        type: 'detailed'
      });
    }
    
    // Data Types (simple strings)
    if (md.datatypes?.length) {
      sections.push({
        title: 'Data Types',
        icon: Code,
        items: md.datatypes.slice(0, 8),
        hasMore: md.datatypes.length > 8,
        totalCount: md.datatypes.length,
        color: 'green',
        type: 'simple'
      });
    }
    
    // Languages
    if (md.languages?.length) {
      sections.push({
        title: 'Languages',
        icon: Globe,
        items: md.languages,
        color: 'indigo',
        type: 'simple'
      });
    }
    
    // Terminologies
    if (md.terminologies?.length) {
      sections.push({
        title: 'Terminologies',
        icon: Database,
        items: md.terminologies,
        color: 'purple',
        type: 'simple'
      });
    }
    
    return sections;
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="surface rounded-xl max-w-7xl w-full max-h-[92vh] flex flex-col border border-theme shadow-2xl">
        {/* Header */}
        <div className="px-8 py-6 border-b border-theme bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-3xl font-bold text-theme-primary flex items-center gap-3">
                <div className="p-2 bg-primary rounded-lg">
                  <Database className="text-primary-text" size={28} />
                </div>
                Sample Data Models Library
              </h2>
              <p className="text-theme-secondary mt-2 text-base">
                Browse and import pre-built data models from the community
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-theme-secondary hover:text-theme-primary transition-colors p-2 hover:bg-surface-hover rounded-lg"
            >
              <X size={24} />
            </button>
          </div>

          {/* Domain Tabs - text-only for branding consistency */}
          <div className="flex rounded-md border border-theme overflow-hidden w-fit mt-4">
            {DOMAINS.map((domain) => {
              const count = domainCounts[domain.id] || 0;
              const isActive = activeDomain === domain.id;
              return (
                <button
                  key={domain.id}
                  onClick={() => {
                    setActiveDomain(domain.id);
                    setSelectedTemplates([]);
                    setSearchTerm('');
                  }}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-r border-theme last:border-r-0",
                    isActive
                      ? "bg-primary text-primary-text"
                      : "surface hover:surface-hover text-theme-primary"
                  )}
                >
                  <span>{domain.label}</span>
                  {count > 0 && (
                    <span className={cn(
                      "text-xs rounded-full px-1.5 min-w-[20px] text-center",
                      isActive ? "bg-primary-hover" : "bg-surface-hover"
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Controls Bar */}
        <div className="px-6 py-4 border-b border-theme bg-surface">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 h-5 w-5 text-theme-secondary" />
              <input
                type="text"
                placeholder="Search by name, type, language, terminology..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 input"
              />
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-2 surface p-1 rounded-lg border border-theme">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-4 py-2 rounded-lg transition-all font-medium ${
                  viewMode === 'grid'
                    ? 'bg-primary text-primary-text shadow-md'
                    : 'text-theme-secondary hover:text-theme-primary hover:bg-surface-hover'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg transition-all font-medium ${
                  viewMode === 'list'
                    ? 'bg-primary text-primary-text shadow-md'
                    : 'text-theme-secondary hover:text-theme-primary hover:bg-surface-hover'
                }`}
              >
                List
              </button>
            </div>
          </div>

          {/* Selection controls */}
          {filteredTemplates.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-4">
                <button
                  onClick={selectAll}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  Select all ({filteredTemplates.length})
                </button>
                {selectedTemplates.length > 0 && (
                  <>
                    <span className="text-theme-secondary">|</span>
                    <button
                      onClick={clearSelection}
                      className="text-sm text-theme-secondary hover:text-theme-primary font-medium"
                    >
                      Clear selection
                    </button>
                  </>
                )}
              </div>

              {selectedTemplates.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-lg">
                    <span className="text-sm font-semibold text-primary">
                      {selectedTemplates.length} selected
                    </span>
                  </div>
                  <button
                    onClick={importSelectedTemplates}
                    disabled={isImporting}
                    className={`px-5 py-2.5 rounded-lg flex items-center gap-2 font-semibold transition-all ${
                      isImporting
                        ? "surface text-theme-secondary cursor-not-allowed opacity-50"
                        : "bg-success text-success-text hover:opacity-90 shadow-md"
                    }`}
                  >
                    {isImporting ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Download size={18} />
                        Import Selected
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-background">
          {(isLoading || loadingDomain) ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative mb-6">
                <Loader2 className="animate-spin text-primary" size={48} />
              </div>
              <h3 className="text-xl font-semibold text-theme-primary">
                Loading {activeDomain === 'openehr' ? 'OpenEHR Templates' : activeDomain === 'fhir' ? 'FHIR Data Models' : 'ContextObject Data Models'}
              </h3>
              <p className="text-theme-secondary mt-2">Fetching available samples from the library...</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-warning/10 border-2 border-warning/30 rounded-xl mb-6">
                <AlertTriangle size={40} className="text-warning" />
              </div>
              <h3 className="text-2xl font-semibold text-theme-primary mb-3">
                No {activeDomain === 'openehr' ? 'OpenEHR Templates' : activeDomain === 'fhir' ? 'FHIR Data Models' : 'ContextObject Data Models'} Found
              </h3>
              <p className="text-theme-secondary text-lg max-w-md mx-auto">
                {searchTerm
                  ? "No samples match your search. Try different keywords."
                  : `No sample ${activeDomain === 'openehr' ? 'OpenEHR templates' : activeDomain === 'fhir' ? 'FHIR data models' : 'ContextObject data models'} are available at the moment.`}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTemplates.map(template => {
                const isSelected = isTemplateSelected(template._id);
                const isExpanded = expandedTemplate === template._id;
                const stats = getTemplateStats(template);
                const expandedMetadata = isExpanded ? getExpandedMetadata(template) : [];
                const fileSize = formatFileSize(template.opt?.size);

                return (
                  <div
                    key={template._id}
                    className={`group card transition-all duration-300 overflow-hidden ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-lg'
                        : 'hover:shadow-xl'
                    }`}
                  >
                    <div
                      className="p-5 cursor-pointer"
                      onClick={() => toggleTemplateSelection(template)}
                    >
                      {/* Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 pr-2">
                          <div className="flex items-start gap-2 mb-1">
                            <h3 className="text-lg font-bold text-theme-primary line-clamp-1 flex-1">
                              {template.name}
                            </h3>
                            {template.metadata?.compositionKind && (
                              <span className="px-2 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary border border-primary/30 rounded uppercase tracking-wide">
                                {template.metadata.compositionKind}
                              </span>
                            )}
                          </div>
                          {template.metadata?.templateId && (
                            <p className="text-xs text-theme-secondary mt-1 font-mono truncate">
                              {template.metadata.templateId}
                            </p>
                          )}
                        </div>
                        <div className={`ml-2 transition-all duration-300 ${isSelected ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
                          <div className="p-1 bg-primary rounded-full">
                            <CheckCircle size={18} className="text-primary-text" />
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <p className="text-sm text-theme-secondary mb-4 line-clamp-2 min-h-[2.5rem] leading-relaxed">
                        {template.metadata?.description || "No description available"}
                      </p>

                      {/* Stats Grid */}
                      {stats.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          {stats.map((stat, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-background border border-theme rounded-lg px-3 py-2">
                              <stat.icon size={16} className={stat.color} />
                              <span className="text-xs text-theme-secondary">
                                <span className="font-bold text-theme-primary">{stat.value}</span>
                                <span className="ml-1">{stat.label}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* File info */}
                      {fileSize && (
                        <div className="flex items-center gap-2 text-xs text-theme-secondary mb-4">
                          <Database size={12} />
                          <span>Size: <span className="text-theme-primary font-medium">{fileSize}</span></span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="px-5 pb-4 flex justify-between items-center border-t border-theme pt-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedTemplate(isExpanded ? null : template._id);
                        }}
                        className="text-sm text-primary hover:underline font-medium flex items-center gap-1.5 transition-colors"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp size={16} />
                            Less Details
                          </>
                        ) : (
                          <>
                            <ChevronDown size={16} />
                            More Details
                          </>
                        )}
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const full = await fetchTemplateById(template._id);
                            onImport([full]);
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        disabled={isImporting}
                        className={`btn-primary flex items-center gap-2 ${
                          isImporting ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        <Download size={14} />
                        Quick Import
                      </button>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && expandedMetadata.length > 0 && (
                      <div className="px-5 pb-5 pt-0 bg-surface border-t border-theme">
                        <div className="mt-4 space-y-4">
                          {expandedMetadata.map((section, idx) => (
                            <div key={idx}>
                              <div className="flex items-center gap-2 mb-2">
                                <section.icon size={15} className={`text-${section.color}-500`} />
                                <span className="text-sm font-semibold text-theme-primary">{section.title}</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {section.type === 'detailed' ? (
                                  // For entry types and archetypes with objects
                                  <>
                                    {section.items.map((item, itemIdx) => (
                                      <div
                                        key={itemIdx}
                                        className={`inline-block px-3 py-1.5 text-xs rounded-lg bg-${section.color}-50 border border-${section.color}-200`}
                                      >
                                        <span className={`font-semibold text-${section.color}-700`}>{item.main}</span>
                                        {item.sub && (
                                          <span className={`text-${section.color}-600 ml-1.5 text-[10px]`}>({item.sub})</span>
                                        )}
                                      </div>
                                    ))}
                                  </>
                                ) : (
                                  // For simple string arrays
                                  <>
                                    {section.items.map((item, itemIdx) => (
                                      <span
                                        key={itemIdx}
                                        className={`inline-block px-2.5 py-1 text-xs rounded-full bg-${section.color}-50 text-${section.color}-700 border border-${section.color}-200 font-medium`}
                                      >
                                        {item}
                                      </span>
                                    ))}
                                  </>
                                )}
                                {section.hasMore && (
                                  <span className="inline-block px-2.5 py-1 text-xs text-theme-secondary font-medium">
                                    +{section.totalCount - section.items.length} more
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}

                          {/* Additional metadata info */}
                          {template.metadata?.counts && (
                            <div className="pt-3 border-t border-theme">
                              <div className="grid grid-cols-3 gap-3 text-xs">
                                {template.metadata.counts.valueNodeCount && (
                                  <div className="text-theme-secondary">
                                    <span className="font-bold text-theme-primary">{template.metadata.counts.valueNodeCount}</span> value nodes
                                  </div>
                                )}
                                {template.metadata.counts.repeatingNodeCount !== undefined && (
                                  <div className="text-theme-secondary">
                                    <span className="font-bold text-theme-primary">{template.metadata.counts.repeatingNodeCount}</span> repeating
                                  </div>
                                )}
                                {template.metadata?.sourceType && (
                                  <div className="text-theme-secondary">
                                    Source: <span className="font-bold text-theme-primary uppercase">{template.metadata.sourceType}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTemplates.map(template => {
                const isSelected = isTemplateSelected(template._id);
                const stats = getTemplateStats(template);

                return (
                  <div
                    key={template._id}
                    className={`card transition-all duration-300 cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-lg'
                        : 'hover:shadow-lg'
                    }`}
                    onClick={() => toggleTemplateSelection(template)}
                  >
                    <div className="p-5 flex items-center justify-between gap-4">
                      <div className="flex-1 flex items-center gap-4">
                        <div className={`transition-all duration-300 ${isSelected ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}>
                          <div className="p-1 bg-primary rounded-full">
                            <CheckCircle size={18} className="text-primary-text" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-theme-primary">{template.name}</h3>
                            {template.metadata?.compositionKind && (
                              <span className="px-2 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary border border-primary/30 rounded uppercase tracking-wide">
                                {template.metadata.compositionKind}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-theme-secondary mb-2">
                            {template.metadata?.description || "No description"}
                          </p>
                          {stats.length > 0 && (
                            <div className="flex gap-5 mt-2">
                              {stats.map((stat, idx) => (
                                <div key={idx} className="flex items-center gap-1.5">
                                  <stat.icon size={14} className={stat.color} />
                                  <span className="text-xs text-theme-secondary">
                                    <span className="font-bold text-theme-primary">{stat.value}</span> {stat.label}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Show first entry type if available */}
                          {template.metadata?.entryTypes?.[0] && (
                            <div className="mt-2">
                              <span className="text-xs text-theme-secondary">
                                Main entry: <span className="font-semibold text-theme-primary">
                                  {template.metadata.entryTypes[0].name || template.metadata.entryTypes[0].nodeId}
                                </span>
                                {template.metadata.entryTypes.length > 1 && (
                                  <span className="text-theme-secondary"> (+{template.metadata.entryTypes.length - 1} more)</span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const full = await fetchTemplateById(template._id);
                            onImport([full]);
                          } catch (e) {
                            console.error(e);
                          }
                        }}
                        disabled={isImporting}
                        className={`btn-primary flex items-center gap-2 ${
                          isImporting ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        <Download size={16} />
                        Import
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-theme bg-surface">
          <div className="flex justify-between items-center">
            <div className="text-sm text-theme-secondary">
              Showing <span className="font-semibold text-theme-primary">{filteredTemplates.length}</span> of{' '}
              <span className="font-semibold text-theme-primary">{currentDomainSamples.length}</span>{' '}
              {activeDomain === 'openehr' ? 'OpenEHR templates' : activeDomain === 'fhir' ? 'FHIR data models' : 'context object data models'}
            </div>
            <button
              onClick={onClose}
              className="btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SampleDataModelsModal;
