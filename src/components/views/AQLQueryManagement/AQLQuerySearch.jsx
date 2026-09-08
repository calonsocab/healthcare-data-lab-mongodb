// src/app/components/views/AQLQueryManagement/AQLQuerySearch.jsx
"use client";

import React, { useState, useEffect } from 'react';
import { Search, FileText, Filter, X, CheckSquare, Square } from 'lucide-react';
import PropTypes from 'prop-types';
import { cn } from '@/lib/utils';

const AQLQuerySearch = ({ onSearch, onTemplateFilter }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isTemplateFilterOpen, setIsTemplateFilterOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplates, setSelectedTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');

  useEffect(() => {
    if (isTemplateFilterOpen && templates.length === 0) {
      fetchTemplates();
    }
  }, [isTemplateFilterOpen]);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/data-model-catalog');
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    onSearch(value);
  };

  const handleSelectTemplate = (templateId) => {
    const template = templates.find(t => t._id === templateId);
    if (!template) return;

    if (selectedTemplates.some(t => t._id === templateId)) {
      setSelectedTemplates(prev => prev.filter(t => t._id !== templateId));
    } else {
      setSelectedTemplates(prev => [...prev, {
        _id: template._id,
        name: template.name
      }]);
    }
  };

  const handleApplyTemplateFilter = () => {
    onTemplateFilter(selectedTemplates.length > 0 ? selectedTemplates : null);
    setIsTemplateFilterOpen(false);
  };

  const handleClearTemplateFilter = () => {
    setSelectedTemplates([]);
    onTemplateFilter(null);
  };

  // Filter templates based on search term
  const filteredTemplates = templates.filter(template => 
    template.name.toLowerCase().includes(templateSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-theme-secondary" />
          <input
            type="text"
            placeholder="Search queries by name, description, tags or content..."
            value={searchTerm}
            onChange={handleSearch}
            className="w-full pl-9 p-2 bg-surface border border-theme
              text-theme-primary rounded-md focus:outline-none focus:ring-2
              focus:ring-primary focus:border-transparent"
          />
        </div>
        <button
          onClick={() => setIsTemplateFilterOpen(!isTemplateFilterOpen)}
          className={cn(
            "px-3 py-2 rounded-md flex items-center gap-1.5",
            selectedTemplates.length > 0
              ? "bg-primary text-primary-text"
              : "bg-surface-hover text-theme-primary hover:bg-surface border border-theme"
          )}
        >
          <Filter size={16} />
          Filter by Templates
          {selectedTemplates.length > 0 && (
            <span className="bg-primary/80 text-primary-text text-xs rounded-full px-1.5 py-0.5 ml-1">
              {selectedTemplates.length}
            </span>
          )}
        </button>
      </div>

      {/* Template filter dropdown */}
      {isTemplateFilterOpen && (
        <div className="bg-surface-hover border border-theme rounded-md shadow-lg p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium text-theme-primary flex items-center gap-1.5">
              <FileText size={16} />
              Filter by Templates
            </h3>
            <button
              onClick={() => setIsTemplateFilterOpen(false)}
              className="text-theme-secondary hover:text-theme-primary"
            >
              <X size={16} />
            </button>
          </div>

          {/* Template search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-theme-secondary" />
            <input
              type="text"
              placeholder="Search templates..."
              value={templateSearchTerm}
              onChange={(e) => setTemplateSearchTerm(e.target.value)}
              className="w-full pl-9 p-2 bg-surface border border-theme
                text-theme-primary rounded-md focus:outline-none focus:ring-2
                focus:ring-primary focus:border-transparent"
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <span className="text-theme-secondary">Loading templates...</span>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-theme-secondary py-4 text-center">
              No templates available
            </div>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {filteredTemplates.length === 0 ? (
                  <div className="text-theme-secondary py-4 text-center">
                    No templates match your search
                  </div>
                ) : (
                  filteredTemplates.map(template => (
                    <div
                      key={template._id}
                      className="flex items-center p-2 hover:bg-surface rounded cursor-pointer"
                      onClick={() => handleSelectTemplate(template._id)}
                    >
                      {selectedTemplates.some(t => t._id === template._id) ? (
                        <CheckSquare size={16} className="text-primary mr-2 flex-shrink-0" />
                      ) : (
                        <Square size={16} className="text-theme-secondary mr-2 flex-shrink-0" />
                      )}
                      <span className="text-theme-primary truncate">{template.name}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="flex justify-between pt-2 border-t border-theme">
                <button
                  onClick={handleClearTemplateFilter}
                  className="text-theme-primary text-sm hover:text-primary"
                >
                  Clear Selection
                </button>
                <button
                  onClick={handleApplyTemplateFilter}
                  className="px-3 py-1 bg-primary text-primary-text text-sm rounded hover:opacity-90"
                >
                  Apply Filter
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Display selected template filters */}
      {selectedTemplates.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center py-2">
          <span className="text-xs text-theme-secondary">Filtering by templates:</span>
          {selectedTemplates.map(template => (
            <div
              key={template._id}
              className="bg-primary/30 text-primary px-2 py-1 rounded-md text-xs flex items-center"
            >
              <FileText size={10} className="mr-1" />
              <span>{template.name}</span>
              <button
                onClick={() => {
                  setSelectedTemplates(prev => prev.filter(t => t._id !== template._id));
                  if (selectedTemplates.length === 1) {
                    // If this is the last template, clear the filter entirely
                    onTemplateFilter(null);
                  } else {
                    // Otherwise update the filter with the remaining templates
                    onTemplateFilter(selectedTemplates.filter(t => t._id !== template._id));
                  }
                }}
                className="ml-1 text-primary hover:opacity-80"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              setSelectedTemplates([]);
              onTemplateFilter(null);
            }}
            className="text-xs text-primary hover:opacity-80"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
};

AQLQuerySearch.propTypes = {
  onSearch: PropTypes.func.isRequired,
  onTemplateFilter: PropTypes.func.isRequired,
};

export default AQLQuerySearch;