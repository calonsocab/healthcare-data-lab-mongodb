//src/components/views/lab/QuerySelectorModal.jsx
'use client';

import React, { useState, useMemo } from 'react';
import { Search, RefreshCw, Tag as TagIcon, FolderTree, X, List, ChevronLeft, Server, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import useMetadataManager from '@/hooks/useMetadata';
import { useAQLQueries } from '@/providers/AQLQueryProvider';
import { getTagColors } from '@/lib/utils';

const QuerySelectorModal = ({ isOpen, onClose, onSelectQuery, selectedQuery, activeStrategyDoc }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({ folder: null, tags: [], showOnlyValidated: false });
  const { metadata } = useMetadataManager();
  const { queries: allQueries, loading, error, refetchQueries } = useAQLQueries();

  // Search filtering happens client-side against the cached list.
  const queries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return allQueries;
    return allQueries.filter(q => {
      const hay = [
        q.name,
        q.description,
        q.aqlText,
        ...(Array.isArray(q.tags) ? q.tags.map(t => typeof t === 'string' ? t : t?.name) : [])
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(term);
    });
  }, [allQueries, searchTerm]);

  const fetchQueries = refetchQueries;

  // Get current strategy info
  const currentStrategyId = activeStrategyDoc?._id;
  const currentProtocol = activeStrategyDoc?.blueprint?.protocol?.standard ||
                         activeStrategyDoc?.blueprint?.domain?.[0] || null;
  const currentStrategyName = activeStrategyDoc?.name || null;

  // Get validation status for a query and strategy
  const getQueryStrategyStatus = (query) => {
    if (!currentStrategyId) return null;
    const validation = query.strategyValidations?.[currentStrategyId];
    return validation?.status || null;
  };

  // Filter queries based on active filters
  const filteredQueries = queries.filter((query) => {
    const { folderId, tags, strategyValidations, conversionStrategy } = query;

    // Filter by folder if a folder filter is active
    const folderMatch = !activeFilters.folder || folderId === activeFilters.folder;

    // Filter by tags if any tag filters are active
    let tagMatch = true;
    if (activeFilters.tags && activeFilters.tags.length > 0) {
      tagMatch = tags && activeFilters.tags.every(activeTag =>
        tags.some(tag => {
          const tagName = typeof tag === 'string' ? tag : tag.name;
          return tagName === activeTag;
        })
      );
    }

    // Filter by strategy validation if toggle is enabled
    let strategyMatch = true;
    if (activeFilters.showOnlyValidated && currentStrategyId) {
      // Show only queries that have been validated for the current strategy
      strategyMatch = strategyValidations?.[currentStrategyId]?.status === 'done';
    }

    return folderMatch && tagMatch && strategyMatch;
  });

  // Handle folder filter
  const handleFolderFilter = (folderId) => {
    setActiveFilters(prev => ({
      ...prev,
      folder: prev.folder === folderId ? null : folderId
    }));
  };

  // Handle tag filter
  const handleTagFilter = (tagName) => {
    setActiveFilters(prev => {
      const tags = [...prev.tags];
      const index = tags.indexOf(tagName);
      
      if (index >= 0) {
        tags.splice(index, 1);
      } else {
        tags.push(tagName);
      }
      
      return {
        ...prev,
        tags
      };
    });
  };

  // Get folder name from id
  const getFolderName = (folderId) => {
    if (!folderId) return '(Root)';
    const folder = metadata.folders.find(f => f._id === folderId);
    return folder ? folder.name : 'Unknown Folder';
  };

  // Reset all filters
  const handleResetFilters = () => {
    setActiveFilters({ folder: null, tags: [], showOnlyValidated: false });
    setSearchTerm('');
  };

  // Toggle validated-only filter
  const toggleValidatedFilter = () => {
    setActiveFilters(prev => ({
      ...prev,
      showOnlyValidated: !prev.showOnlyValidated
    }));
  };

  // Get strategy-specific status display
  const getStrategyStatusDisplay = (query) => {
    const status = getQueryStrategyStatus(query);
    if (status === 'done') {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 bg-success-muted text-success text-xs rounded-full">
          <CheckCircle size={10} />
          Validated
        </span>
      );
    }
    if (status === 'needs_improvement') {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 bg-warning-muted text-warning text-xs rounded-full">
          <AlertTriangle size={10} />
          Needs Work
        </span>
      );
    }
    if (status === 'pending') {
      return (
        <span className="flex items-center gap-1 px-2 py-0.5 bg-surface text-theme-secondary text-xs rounded-full">
          <Clock size={10} />
          Pending
        </span>
      );
    }
    // No validation for this strategy yet
    return (
      <span className="flex items-center gap-1 px-2 py-0.5 bg-surface-hover text-theme-muted text-xs rounded-full">
        <Clock size={10} />
        Not tested
      </span>
    );
  };

  // Get transformation status display
  const getStatusDisplay = (status) => {
    switch(status) {
      case 'done':
        return (
          <span className="px-2 py-0.5 bg-success-muted text-success text-xs rounded-full">
            Done
          </span>
        );
      case 'needs_improvement':
        return (
          <span className="px-2 py-0.5 bg-warning-muted text-warning text-xs rounded-full">
            Needs Improvement
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="px-2 py-0.5 bg-surface text-theme-secondary text-xs rounded-full">
            Pending
          </span>
        );
    }
  };

  // Handle query selection
  const handleSelectQuery = (query) => {
    onSelectQuery(query);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-lg w-full max-w-3xl max-h-[80vh] flex flex-col border border-theme">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-theme">
          <div>
            <h3 className="text-lg font-medium text-theme-primary">Select AQL Query</h3>
            {currentStrategyName && (
              <div className="flex items-center gap-2 mt-1">
                <Server size={12} className="text-theme-secondary" />
                <span className="text-xs text-theme-secondary">Strategy:</span>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-surface-hover border border-theme text-primary">
                  {currentProtocol}
                </span>
                <span className="text-xs text-theme-secondary">{currentStrategyName}</span>
              </div>
            )}
          </div>
          <button
            className="p-1 hover:bg-surface-hover rounded-md text-theme-secondary"
            onClick={onClose}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search and filters */}
        <div className="p-4 border-b border-theme">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-theme-muted" />
            <input
              type="text"
              placeholder="Search queries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 p-2 bg-surface-hover border border-theme rounded-md text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Strategy filter toggle */}
          {currentStrategyId && (
            <div className="flex items-center justify-between mb-4 py-2 px-3 bg-background rounded-lg border border-theme">
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className={activeFilters.showOnlyValidated ? 'text-success' : 'text-theme-muted'} />
                <span className="text-sm text-theme-secondary">Show only validated for current strategy</span>
              </div>
              <button
                onClick={toggleValidatedFilter}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                  activeFilters.showOnlyValidated ? 'bg-success' : 'bg-surface-hover'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    activeFilters.showOnlyValidated ? 'translate-x-4.5' : 'translate-x-1'
                  }`}
                  style={{ transform: activeFilters.showOnlyValidated ? 'translateX(18px)' : 'translateX(2px)' }}
                />
              </button>
            </div>
          )}

          {/* Active filters display */}
          {(activeFilters.folder || activeFilters.tags.length > 0 || activeFilters.showOnlyValidated) && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-sm text-theme-secondary">Filters:</span>

              {activeFilters.showOnlyValidated && (
                <div className="bg-success-muted px-2 py-1 rounded-md text-sm flex items-center gap-1 border border-success/30">
                  <CheckCircle size={12} className="text-success" />
                  <span className="text-success">Validated only</span>
                  <button
                    onClick={() => setActiveFilters(prev => ({ ...prev, showOnlyValidated: false }))}
                    className="ml-2 text-success hover:text-error"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {activeFilters.folder && (
                <div className="bg-surface-hover px-2 py-1 rounded-md text-sm flex items-center gap-1">
                  <FolderTree size={12} className="text-warning" />
                  <span className="text-theme-secondary">{getFolderName(activeFilters.folder)}</span>
                  <button
                    onClick={() => setActiveFilters(prev => ({ ...prev, folder: null }))}
                    className="ml-2 text-theme-secondary hover:text-error"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {activeFilters.tags.map(tag => (
                <div key={tag} className="bg-surface-hover px-2 py-1 rounded-md text-sm flex items-center gap-1">
                  <TagIcon size={12} className="text-info" />
                  <span className="text-theme-secondary">{tag}</span>
                  <button
                    onClick={() => handleTagFilter(tag)}
                    className="ml-2 text-theme-secondary hover:text-error"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}

              <button
                onClick={handleResetFilters}
                className="text-sm text-info hover:text-primary"
              >
                Clear All
              </button>
            </div>
          )}

          {/* Filter by popular tags */}
          {metadata.tags.length > 0 && (
            <div className="mb-2">
              <h4 className="text-sm font-medium text-theme-secondary mb-2">Filter by Tag</h4>
              <div className="flex flex-wrap gap-2">
                {metadata.tags.slice(0, 10).map(tag => {
                  const colors = getTagColors(tag.name, tag.color);
                  const isActive = activeFilters.tags.includes(tag.name);

                  return (
                    <button
                      key={tag._id}
                      onClick={() => handleTagFilter(tag.name)}
                      className={`px-2 py-1 rounded-md text-xs flex items-center gap-1 transition-colors ${
                        isActive ? 'bg-primary text-primary-text' : 'bg-surface-hover hover:bg-surface border border-theme'
                      }`}
                    >
                      <TagIcon
                        size={10}
                        className={isActive ? 'text-primary-text' : colors.text}
                      />
                      <span className={isActive ? 'text-primary-text' : 'text-theme-secondary'}>
                        {tag.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        
        {/* Query list */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center h-32 text-theme-secondary">
              <RefreshCw size={20} className="animate-spin mr-2" />
              <span>Loading queries...</span>
            </div>
          ) : error ? (
            <div className="bg-error-muted text-error p-4 rounded-md border border-error/30">
              <h4 className="font-medium mb-2">Error loading queries</h4>
              <p>{error}</p>
              <button
                onClick={fetchQueries}
                className="mt-4 px-4 py-2 bg-surface-hover text-theme-secondary rounded hover:bg-surface border border-theme"
              >
                Try Again
              </button>
            </div>
          ) : filteredQueries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-theme-secondary">
              <TagIcon size={32} className="mb-4 opacity-50" />
              <p className="text-center mb-2">No queries found</p>
              <p className="text-sm text-center text-theme-muted">
                {activeFilters.folder || activeFilters.tags.length > 0 || searchTerm
                  ? "Try adjusting your search filters"
                  : "Create your first AQL query to get started"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredQueries.map(query => (
                <div
                  key={query._id}
                  className={`bg-background border p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedQuery?._id === query._id
                      ? 'bg-primary/10 border-primary'
                      : 'border-theme hover:border-primary/50'
                  }`}
                  onClick={() => handleSelectQuery(query)}
                >
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium text-theme-primary truncate">{query.name}</h4>
                    <div className="flex items-center gap-2">
                      {/* Show strategy-specific status if strategy is active */}
                      {currentStrategyId ? (
                        getStrategyStatusDisplay(query)
                      ) : (
                        getStatusDisplay(query.status || 'pending')
                      )}
                    </div>
                  </div>

                  {query.description && (
                    <p className="text-sm text-theme-secondary mt-1 line-clamp-2">{query.description}</p>
                  )}

                  <div className="flex items-center mt-2 text-xs text-theme-muted">
                    <FolderTree
                      size={12}
                      className="mr-1 text-warning cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFolderFilter(query.folderId);
                      }}
                    />
                    <span
                      className="truncate hover:text-warning cursor-pointer mr-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFolderFilter(query.folderId);
                      }}
                    >
                      {getFolderName(query.folderId)}
                    </span>

                    <span>
                      Updated: {new Date(query.updatedAt).toLocaleDateString()}
                    </span>
                  </div>

                  {query.tags && query.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {query.tags.map((tag, i) => {
                        const tagName = typeof tag === 'string' ? tag : tag.name;
                        const tagObj = metadata.tags.find(t => t.name === tagName);
                        const colors = getTagColors(tagName, tagObj?.color);

                        return (
                          <div
                            key={i}
                            className="flex items-center bg-surface-hover px-1.5 py-0.5 rounded-md text-xs cursor-pointer hover:bg-surface"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTagFilter(tagName);
                            }}
                          >
                            <TagIcon size={9} className={`mr-1 ${colors.text}`} />
                            <span className="text-theme-secondary">{tagName}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuerySelectorModal;
