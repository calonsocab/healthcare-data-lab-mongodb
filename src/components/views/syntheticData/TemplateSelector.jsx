// src/components/views/syntheticData/TemplateSelector.jsx
"use client";

import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, Check, FileText, Database, Filter } from 'lucide-react';
import PropTypes from 'prop-types';
import { cn } from '@/lib/utils';

const TemplateSelector = ({ availableTemplates, selectedTemplates, setSelectedTemplates }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showDetails, setShowDetails] = useState({});
  const [combinedTemplates, setCombinedTemplates] = useState([]);
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'user', 'synthetic'
  const [syntheticMetadata, setSyntheticMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  // Fetch synthetic data metadata
  useEffect(() => {
    const fetchSyntheticMetadata = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/synthetic-data/metadata');
        if (response.ok) {
          const data = await response.json();
          setSyntheticMetadata(data);
        }
      } catch (error) {
        console.error('Error fetching synthetic data metadata:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSyntheticMetadata();
  }, []);
  
  // Combine and process templates when metadata or available templates change
  useEffect(() => {
    if (!syntheticMetadata || !availableTemplates) return;

    const templatesMeta = syntheticMetadata.templates || {};
    const resolveMetadataEntry = (template) => {
      const templateId = (template.id || '').toString();
      const templateName = (template.name || '').trim();
      const templateNameLc = templateName.toLowerCase();
      const templateMetaId = (template.templateId || template.metadata?.templateId || '').toString();
      const archetypeId = template.archetypeId || '';

      return Object.entries(templatesMeta).find(([id, entry]) => {
        const entryName = (entry.name || '').trim();
        const entryNameLc = entryName.toLowerCase();
        return (
          id === templateId ||
          id === templateName ||
          id === templateMetaId ||
          entryName === templateName ||
          entryNameLc === templateNameLc ||
          (archetypeId && entry.archetype_node_id === archetypeId)
        );
      });
    };

    // Process user templates to check which ones have synthetic data
    const processedUserTemplates = availableTemplates.map(template => {
      const metadataEntry = resolveMetadataEntry(template);
      return {
        ...template,
        isSynthetic: false,
        hasSyntheticData: !!metadataEntry,
        compositionCount: metadataEntry ? metadataEntry[1].count : 0
      };
    });

    // Only surface templates that exist in the tenant DB and have sample compositions
    const filteredUserTemplates = processedUserTemplates.filter(
      template => template.hasSyntheticData
    );
    setCombinedTemplates(filteredUserTemplates);
  }, [syntheticMetadata, availableTemplates]);
  
  // Apply filters to combined templates
  const filteredTemplates = combinedTemplates.filter(template => {
    // Apply search filter
    const matchesSearch = 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (template.archetypeId && template.archetypeId.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Apply source filter
    const matchesSourceFilter = 
      filterMode === 'all' ||
      (filterMode === 'user' && !template.isSynthetic) ||
      (filterMode === 'synthetic' && template.isSynthetic);
    
    // Only show templates with synthetic data
    const hasSyntheticData = template.hasSyntheticData;
    
    return matchesSearch && matchesSourceFilter && hasSyntheticData;
  });
  
  // Toggle template selection
  const toggleTemplateSelection = (template) => {
    if (!template.hasSyntheticData) return; // Don't allow selection if no synthetic data
    
    if (isSelected(template.id)) {
      setSelectedTemplates(selectedTemplates.filter(t => t.id !== template.id));
    } else {
      setSelectedTemplates([...selectedTemplates, template]);
    }
  };
  
  // Check if a template is selected
  const isSelected = (templateId) => {
    return selectedTemplates.some(t => t.id === templateId);
  };
  
  // Toggle details view for a template
  const toggleDetails = (templateId) => {
    setShowDetails(prev => ({
      ...prev,
      [templateId]: !prev[templateId]
    }));
  };
  
  // Select all templates with synthetic data
  const selectAllTemplates = () => {
    const templatesWithData = combinedTemplates.filter(t => t.hasSyntheticData);
    setSelectedTemplates(templatesWithData);
  };
  
  // Clear all selections
  const clearSelections = () => {
    setSelectedTemplates([]);
  };
  
  // Toggle filter dropdown visibility
  const toggleFilterDropdown = () => {
    setShowFilterDropdown(!showFilterDropdown);
  };
  
  // Handle filter selection
  const selectFilter = (mode) => {
    setFilterMode(mode);
    setShowFilterDropdown(false); // Close dropdown after selection
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        <span className="ml-2 text-theme-secondary">Loading templates...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and filter controls */}
      <div className="flex gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-theme-secondary" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 p-2 bg-surface-hover border border-theme/50 rounded-md text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Filter dropdown - now collapsible */}
        <div className="relative">
          <button
            onClick={toggleFilterDropdown}
            className="flex items-center px-3 py-2 bg-surface-hover border border-theme/50 rounded-md text-theme-primary hover:bg-surface"
          >
            <Filter size={16} className="mr-1" />
            <span className="text-sm">
              {filterMode === 'all' ? 'All templates' :
               filterMode === 'user' ? 'User templates' :
               'Synthetic templates'}
            </span>
            {showFilterDropdown ? <ChevronUp size={16} className="ml-1" /> : <ChevronDown size={16} className="ml-1" />}
          </button>

          {/* Dropdown menu - only shown when showFilterDropdown is true */}
          {showFilterDropdown && (
            <div className="absolute right-0 mt-1 w-48 bg-surface border border-theme rounded-md shadow-lg z-10">
              <div className="py-1">
                <button
                  className="block w-full text-left px-4 py-2 text-theme-primary hover:bg-surface-hover"
                  onClick={() => selectFilter('all')}
                >
                  <Check size={16} className={`inline mr-1 ${filterMode === 'all' ? 'opacity-100' : 'opacity-0'}`} />
                  All templates
                </button>
                <button
                  className="block w-full text-left px-4 py-2 text-theme-primary hover:bg-surface-hover"
                  onClick={() => selectFilter('user')}
                >
                  <Check size={16} className={`inline mr-1 ${filterMode === 'user' ? 'opacity-100' : 'opacity-0'}`} />
                  User templates
                </button>
                <button
                  className="block w-full text-left px-4 py-2 text-theme-primary hover:bg-surface-hover"
                  onClick={() => selectFilter('synthetic')}
                >
                  <Check size={16} className={`inline mr-1 ${filterMode === 'synthetic' ? 'opacity-100' : 'opacity-0'}`} />
                  Synthetic templates
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selection actions */}
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm text-theme-secondary">
          {selectedTemplates.length} of {filteredTemplates.length} templates selected
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={selectAllTemplates}
            className="text-sm text-primary hover:text-primary/80"
          >
            Select All
          </button>
          <button
            onClick={clearSelections}
            className="text-sm text-error hover:text-error/80"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Templates table with better visibility */}
      <div className="border border-theme/50 rounded-lg overflow-hidden">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-surface-hover sticky top-0 z-10">
              <tr className="text-left text-xs text-theme-secondary">
                <th className="px-3 py-2 w-10">
                  <input
                    type="checkbox"
                    checked={selectedTemplates.length === filteredTemplates.length && filteredTemplates.length > 0}
                    onChange={() => {
                      if (selectedTemplates.length === filteredTemplates.length) {
                        clearSelections();
                      } else {
                        selectAllTemplates();
                      }
                    }}
                    className="h-4 w-4 rounded text-primary border-theme/50 bg-surface"
                  />
                </th>
                <th className="px-3 py-2 font-medium">Template Name</th>
                <th className="px-3 py-2 font-medium hidden md:table-cell">Archetype</th>
                <th className="px-3 py-2 font-medium text-right">Compositions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme/50">
              {filteredTemplates.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-3 py-8 text-center text-theme-secondary">
                    No templates match your search or have synthetic data available.
                  </td>
                </tr>
              ) : (
                filteredTemplates.map(template => (
                  <tr
                    key={template.id}
                    onClick={() => toggleTemplateSelection(template)}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isSelected(template.id)
                        ? "bg-primary/20 hover:bg-primary/30"
                        : "hover:bg-surface-hover/50"
                    )}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={isSelected(template.id)}
                        onChange={() => toggleTemplateSelection(template)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded text-primary border-theme/50 bg-surface focus:ring-primary"
                        disabled={!template.hasSyntheticData}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className={isSelected(template.id) ? "text-primary" : "text-theme-secondary"} />
                        <div>
                          <div className="text-sm font-medium text-theme-primary">{template.name}</div>
                          {template.description && (
                            <div className="text-xs text-theme-secondary truncate max-w-md">{template.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 hidden md:table-cell">
                      <span className="text-xs text-theme-secondary font-mono truncate block max-w-xs">
                        {template.archetypeId || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center gap-1 text-sm text-success">
                        <Database size={12} />
                        {template.compositionCount.toLocaleString()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected templates summary */}
      {selectedTemplates.length > 0 && (
        <div className="mt-4 p-3 bg-surface-hover rounded-md">
          <h4 className="text-sm font-medium text-theme-primary mb-2">Selected Templates:</h4>
          <div className="flex flex-wrap gap-2">
            {selectedTemplates.map(template => (
              <div
                key={template.id}
                className="px-2 py-1 bg-primary/20 border border-primary/50 rounded-md text-xs text-theme-primary flex items-center"
              >
                <FileText size={12} className="mr-1 text-primary" />
                {template.name}
                <button
                  onClick={() => toggleTemplateSelection(template)}
                  className="ml-1 text-theme-secondary hover:text-error"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

TemplateSelector.propTypes = {
  availableTemplates: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    archetypeId: PropTypes.string
  })).isRequired,
  selectedTemplates: PropTypes.array.isRequired,
  setSelectedTemplates: PropTypes.func.isRequired
};

export default TemplateSelector;
