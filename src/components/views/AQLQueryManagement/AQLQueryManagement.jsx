// src/components/views/AQLQueryManagement/AQLQueryManagement.jsx
"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus, FolderTree, Tag, RefreshCw, Database, AlertTriangle, FileText, Upload } from "lucide-react";
import AQLQueryEditor from "./AQLQueryEditor";
import useMetadataManager from "@/hooks/useMetadata";
import AQLQueryExplorer from "./AQLQueryExplorer";
import AQLQuerySearch from "./AQLQuerySearch";
import { getTagColors } from "@/lib/utils";
// Added by Gio
import { useAQLQueries } from "@/providers/AQLQueryProvider";
import { useDataModels } from "@/providers/DataModelProvider";
import TagFilter from "@/components/views/settings/dataOrganization/TagFilter";
import QueryExportButton from "./QueryExportButton";
import { extractPortableQueryConfig, preparePortableQueryForImport } from "@/lib/aqlQueries/portableQuery";

function formatTemplateLabel(templateName = '') {
  const text = String(templateName || '').trim();
  if (text.length <= 52) {
    return text;
  }

  const versionSuffixMatch = text.match(/(_v[\d.]+_[A-Za-z0-9-]+)$/);
  if (versionSuffixMatch) {
    const suffix = versionSuffixMatch[1];
    const prefixLength = Math.max(18, 48 - suffix.length);
    return `${text.slice(0, prefixLength)}…${suffix}`;
  }

  return `${text.slice(0, 28)}…${text.slice(-18)}`;
}

const AQLQueryManagement = () => {
  const { queries, loading, error, saveQuery, deleteQuery, refetchQueries } = useAQLQueries();
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // Initialize with tags as an array and templates as null
  const [activeFilters, setActiveFilters] = useState({ 
    folder: null, 
    tags: [],
    templates: null
  });
  const { metadata, actions } = useMetadataManager();
  const { dataModelsByName } = useDataModels();
  const [viewMode, setViewMode] = useState("grid");
  const [uniqueTags, setUniqueTags] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState(null);
  const importInputRef = useRef(null);

  // Extract unique tags from queries
  useEffect(() => {
    if (queries.length && metadata.tags) {
      // Build a set of unique tag names
      const tagNames = new Set();

      queries.forEach(query => {
        if (query.tags && Array.isArray(query.tags)) {
          query.tags.forEach(tag => {
            const tagName = typeof tag === 'string' ? tag : tag.name;
            tagNames.add(tagName);
          });
        }
      });

      // Convert to tag objects with metadata info
      const tagsWithMetadata = Array.from(tagNames).map(name => {
        // Find tag metadata if it exists
        const metaTag = metadata.tags.find(t => t.name === name);
        return metaTag || { _id: `temp-${name}`, name };
      });

      setUniqueTags(tagsWithMetadata);
    }
  }, [queries, metadata.tags]);

  // Filter queries based on active filters
  const filteredQueries = useMemo(() => {
    return queries.filter(query => {
      // NEW: Apply search term filter here on the cached data
      const searchMatch = searchTerm ? 
        query.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (query.description || '').toLowerCase().includes(searchTerm.toLowerCase())
        : true;
    
      const folderMatch = !activeFilters.folder || query.folderId === activeFilters.folder;
    
      // Filter by tags if any tag filters are active
      let tagMatch = true;
      if (activeFilters.tags && activeFilters.tags.length > 0) {
        tagMatch = query.tags && activeFilters.tags.every(activeTag => 
          query.tags.some(tag => {
            const tagName = typeof tag === 'string' ? tag : tag.name;
            return tagName === activeTag;
          })
        );
      }
      
      // Filter by templates if template filters are active
      let templateMatch = true;
      if (activeFilters.templates && activeFilters.templates.length > 0) {
        templateMatch = query.affectedTemplates && query.affectedTemplates.some(template => 
          activeFilters.templates.some(activeTemplate => 
            activeTemplate._id === template.id || activeTemplate._id === template._id
          )
        );
      }
      
      return searchMatch && folderMatch && tagMatch && templateMatch;
    });
  }, [queries, searchTerm, activeFilters]);

  // const handleSaveQuery = async (queryData) => {
  //   try {
  //     const method = queryData._id ? "PUT" : "POST";
  //     const response = await fetch("/api/aql-queries", {
  //       method,
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify(queryData),
  //     });

  //     if (!response.ok) throw new Error((await response.json()).error || "Failed to save query");

  //     const savedQuery = await response.json();

  //     // Update queries list with the new/updated query
  //     if (queryData._id) {
  //       setQueries((prev) => prev.map(q => (q._id === queryData._id ? savedQuery : q)));
  //     } else {
  //       setQueries((prev) => [...prev, savedQuery]);
  //     }

  //     setSelectedQuery(null);
  //     setIsCreatingNew(false);
  //     return true;
  //   } catch (err) {
  //     console.error("Error saving query:", err);
  //     return false;
  //   }
  // };

  // const handleDeleteQuery = async (queryId) => {
  //   if (!window.confirm("Are you sure you want to delete this query?")) return;
  //   try {
  //     const response = await fetch("/api/aql-queries", {
  //       method: "DELETE",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ id: queryId }),
  //     });

  //     if (!response.ok) throw new Error((await response.json()).error || "Failed to delete query");

  //     setQueries((prev) => prev.filter(q => q._id !== queryId));
  //     if (selectedQuery?._id === queryId) setSelectedQuery(null);
  //   } catch (err) {
  //     console.error("Error deleting query:", err);
  //     alert(`Error: ${err.message}`);
  //   }
  // };

  // Reset all filters to their default state
  const handleResetFilters = () => setActiveFilters({ folder: null, tags: [], templates: null });

  const handleDuplicateQuery = (query) => {
    const duplicateQuery = {
      ...query,
      _id: null,
      name: `${query.name} (Copy)`,
      createdAt: null,
      updatedAt: null
    };

    setSelectedQuery(duplicateQuery);
    setIsCreatingNew(true);
  };

  // Apply folder filter when clicked in Explorer
  const handleFolderFilter = (folderId) => {
    setActiveFilters(prev => ({
      ...prev,
      folder: prev.folder === folderId ? null : folderId
    }));
  };

  // Handle tag selection for the filter
  const handleTagFilter = (tags) => {
    setActiveFilters(prev => ({
      ...prev,
      tags: Array.isArray(tags) ? tags : [tags] // Ensure it's always an array
    }));
  };

  // Handle template selection for the filter
  const handleTemplateFilter = (templates) => {
    setActiveFilters(prev => ({
      ...prev,
      templates
    }));
  };

  // Get folder name from id
  const getFolderName = (folderId) => {
    if (!folderId) return '(Root)';
    const folder = metadata.folders.find(f => f._id === folderId);
    return folder ? folder.name : 'Unknown Folder';
  };

  const handleOpenImportDialog = () => {
    importInputRef.current?.click();
  };

  const handleCreateFolder = async (suggestedName = '') => {
    const initialValue = suggestedName === 'New Folder' ? '' : suggestedName;
    const folderPath = window.prompt('Enter folder path', initialValue);

    if (!folderPath?.trim()) {
      return;
    }

    try {
      await actions.createFolder(folderPath.trim());
    } catch (folderError) {
      window.alert(folderError.message || 'Failed to create folder.');
    }
  };

  const handleImportFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    setIsImporting(true);
    setImportFeedback(null);

    const parsedFiles = [];
    const issues = [];
    const warnings = [];
    const importedNames = [];

    try {
      for (const file of files) {
        try {
          const text = await file.text();
          const raw = JSON.parse(text);
          const config = extractPortableQueryConfig(raw);
          parsedFiles.push({ file, raw, config });
        } catch (importError) {
          issues.push(`${file.name}: ${importError.message || 'Invalid query file.'}`);
        }
      }

      if (parsedFiles.length === 0) {
        setImportFeedback({
          type: 'error',
          message: 'No valid query files were imported.',
          details: issues,
        });
        return;
      }

      const availableFolders = [...(metadata.folders || [])];
      const folderByName = new Map(
        availableFolders.map((folder) => [`${folder.name || ''}`.trim().toLowerCase(), folder])
      );

      const folderPaths = Array.from(
        new Set(parsedFiles.map(({ config }) => config.folderPath).filter(Boolean))
      ).sort((left, right) => {
        const depthDiff = left.split('/').length - right.split('/').length;
        return depthDiff || left.localeCompare(right);
      });

      for (const folderPath of folderPaths) {
        const key = folderPath.toLowerCase();
        if (folderByName.has(key)) {
          continue;
        }

        try {
          const createdFolder = await actions.createFolder(folderPath);
          const resolvedFolder = createdFolder?._id ? createdFolder : createdFolder?.item || null;

          if (resolvedFolder?._id) {
            folderByName.set(key, resolvedFolder);
            availableFolders.push(resolvedFolder);
          } else {
            warnings.push(`Created folder "${folderPath}", but it could not be resolved immediately.`);
          }
        } catch (folderError) {
          warnings.push(`Could not create folder "${folderPath}". Imported queries will fall back to the root.`);
          console.error('Folder import error:', folderError);
        }
      }

      const existingTagNames = new Set(
        (metadata.tags || []).map((tag) => `${tag?.name || ''}`.trim().toLowerCase()).filter(Boolean)
      );

      for (const tagName of Array.from(new Set(parsedFiles.flatMap(({ config }) => config.tags)))) {
        const key = tagName.toLowerCase();
        if (!key || existingTagNames.has(key)) {
          continue;
        }

        try {
          const createdTag = await actions.createTag(tagName);
          if (createdTag) {
            existingTagNames.add(key);
          } else {
            warnings.push(`Tag "${tagName}" could not be registered in metadata, but the query tag was preserved.`);
          }
        } catch (tagError) {
          warnings.push(`Tag "${tagName}" could not be registered in metadata, but the query tag was preserved.`);
          console.error('Tag import error:', tagError);
        }
      }

      const usedNames = new Set(
        queries
          .map((query) => `${query?.name || ''}`.trim().toLowerCase())
          .filter(Boolean)
      );

      for (const { file, raw } of parsedFiles) {
        try {
          const { payload, warnings: fileWarnings } = preparePortableQueryForImport(raw, {
            folders: availableFolders,
            dataModelsByName,
            usedNames,
          });

          const savedQuery = await saveQuery(payload, { throwOnError: true });
          importedNames.push(savedQuery.name);
          fileWarnings.forEach((warning) => warnings.push(`${file.name}: ${warning}`));
        } catch (saveError) {
          issues.push(`${file.name}: ${saveError.message || 'Import failed.'}`);
        }
      }

      const successCount = importedNames.length;
      const issueCount = issues.length;
      const warningCount = warnings.length;

      if (successCount === 0) {
        setImportFeedback({
          type: 'error',
          message: 'The selected files could not be imported.',
          details: [...issues, ...warnings],
        });
        return;
      }

      setImportFeedback({
        type: issueCount > 0 || warningCount > 0 ? 'warning' : 'success',
        message:
          issueCount > 0
            ? `Imported ${successCount} ${successCount === 1 ? 'query' : 'queries'} with ${issueCount} issue${issueCount === 1 ? '' : 's'}.`
            : `Imported ${successCount} ${successCount === 1 ? 'query' : 'queries'} successfully${warningCount > 0 ? ` with ${warningCount} note${warningCount === 1 ? '' : 's'}` : ''}.`,
        details: [...issues, ...warnings],
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Render query list or editing interface
  return (
    <div className="space-y-4">
      {selectedQuery || isCreatingNew ? (
        <AQLQueryEditor
          query={selectedQuery}
          onSave={async (queryData) => {
            const success = await saveQuery(queryData);
            if (success) {
              setSelectedQuery(null);
              setIsCreatingNew(false);
            }
            return success;
          }}
          onCancel={() => {
            setSelectedQuery(null);
            setIsCreatingNew(false);
          }}
        />
      ) : (
        <div className="space-y-4">
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            multiple
            className="hidden"
            onChange={handleImportFiles}
          />

          {/* Header & Actions */}
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-medium text-theme-primary">Query Library</h2>
              <p className="text-sm text-theme-secondary">
                After testing your queries in the Lab, you can record them here for reuse across strategies
              </p>
            </div>
            <div className="flex gap-2">

              <button
                onClick={() => refetchQueries()}
                className="px-3 py-2 bg-surface-hover text-theme-primary rounded-md hover:bg-surface border border-theme flex items-center gap-2"
                title="Refresh Queries"
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={handleOpenImportDialog}
                disabled={isImporting}
                className="px-3 py-2 bg-surface-hover text-theme-primary rounded-md hover:bg-surface border border-theme flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Import one or more query JSON files"
              >
                <Upload size={16} />
                {isImporting ? 'Importing...' : 'Import'}
              </button>
              <button
                onClick={() => setIsCreatingNew(true)}
                className="px-3 py-2 bg-primary text-primary-text rounded-md hover:opacity-90 flex items-center gap-2"
              >
                <Plus size={16} />
                New Query
              </button>
            </div>
          </div>

          {importFeedback && (
            <div
              className={`rounded-md border p-4 ${importFeedback.type === 'error'
                ? 'border-error bg-error/10 text-error'
                : importFeedback.type === 'warning'
                  ? 'border-warning bg-warning/10 text-warning'
                  : 'border-success bg-success/10 text-success'
                }`}
            >
              <div className="font-medium">{importFeedback.message}</div>
              {importFeedback.details?.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm">
                  {importFeedback.details.slice(0, 6).map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                  {importFeedback.details.length > 6 && (
                    <li>{importFeedback.details.length - 6} more notes were omitted.</li>
                  )}
                </ul>
              )}
            </div>
          )}

          {/* View Mode Toggle & Search */}
          <div className="flex flex-wrap gap-4">
            <div className="flex-1">
              <AQLQuerySearch
                onSearch={setSearchTerm}
                onTemplateFilter={handleTemplateFilter}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 rounded-md flex items-center gap-2 ${viewMode === 'grid'
                  ? 'bg-primary text-primary-text'
                  : 'bg-surface-hover text-theme-primary hover:bg-surface border border-theme'
                  }`}
              >
                <Database size={16} />
                Grid
              </button>
              <button
                onClick={() => setViewMode('tree')}
                className={`px-3 py-2 rounded-md flex items-center gap-2 ${viewMode === 'tree'
                  ? 'bg-primary text-primary-text'
                  : 'bg-surface-hover text-theme-primary hover:bg-surface border border-theme'
                  }`}
              >
                <FolderTree size={16} />
                Tree
              </button>
            </div>
          </div>

          {/* Tag Filter */}
          <TagFilter
            availableTags={uniqueTags}
            activeTags={activeFilters.tags}
            onTagSelect={handleTagFilter}
          />

          {/* Active Filters Display */}
          {(activeFilters.folder || activeFilters.tags.length > 0 || activeFilters.templates || searchTerm) && (
            <div className="flex flex-wrap items-center gap-2 py-2">
              <span className="text-sm text-theme-secondary">Active Filters:</span>

              {activeFilters.folder && (
                <div className="bg-surface-hover px-2 py-1 rounded-md text-sm flex items-center gap-1 text-theme-primary">
                  <FolderTree size={12} className="text-warning" />
                  <span>{getFolderName(activeFilters.folder)}</span>
                  <button
                    onClick={() => setActiveFilters(prev => ({ ...prev, folder: null }))}
                    className="ml-2 text-theme-secondary hover:text-error"
                  >
                    ×
                  </button>
                </div>
              )}

              {activeFilters.tags && activeFilters.tags.length > 0 && (
                <div className="bg-surface-hover px-2 py-1 rounded-md text-sm flex items-center gap-1 text-theme-primary">
                  <Tag size={12} className="text-primary" />
                  <span>
                    {activeFilters.tags.length === 1
                      ? activeFilters.tags[0]
                      : `${activeFilters.tags.length} tags selected`}
                  </span>
                  <button
                    onClick={() => setActiveFilters(prev => ({ ...prev, tags: [] }))}
                    className="ml-2 text-theme-secondary hover:text-error"
                  >
                    ×
                  </button>
                </div>
              )}

              {activeFilters.templates && activeFilters.templates.length > 0 && (
                <div className="bg-surface-hover px-2 py-1 rounded-md text-sm flex items-center gap-1 text-theme-primary">
                  <FileText size={12} className="text-success" />
                  <span>
                    {activeFilters.templates.length === 1
                      ? activeFilters.templates[0].name
                      : `${activeFilters.templates.length} templates selected`}
                  </span>
                  <button
                    onClick={() => setActiveFilters(prev => ({ ...prev, templates: null }))}
                    className="ml-2 text-theme-secondary hover:text-error"
                  >
                    ×
                  </button>
                </div>
              )}

              {searchTerm && (
                <div className="bg-surface-hover px-2 py-1 rounded-md text-sm flex items-center gap-1 text-theme-primary">
                  <span>Search: {searchTerm}</span>
                  <button
                    onClick={() => setSearchTerm('')}
                    className="ml-2 text-theme-secondary hover:text-error"
                  >
                    ×
                  </button>
                </div>
              )}

              <button
                onClick={handleResetFilters}
                className="text-sm text-primary hover:opacity-80"
              >
                Clear All
              </button>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-error/20 text-error p-4 rounded-md border border-error">
              <div className="flex items-center mb-2">
                <AlertTriangle size={16} className="mr-2" />
                <h3 className="font-medium">Error Loading Queries</h3>
              </div>
              <p>{error}</p>
              <button
                onClick={() => refetchQueries()}
                className="mt-4 px-4 py-2 bg-surface-hover text-theme-primary rounded hover:bg-surface border border-theme"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="p-8 flex justify-center">
              <div className="flex flex-col items-center text-theme-secondary">
                <RefreshCw size={32} className="animate-spin mb-2" />
                <span>Loading queries...</span>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredQueries.length === 0 && (
            <div className="p-8 flex justify-center">
              <div className="text-center text-theme-secondary max-w-md">
                <Database size={48} className="mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2 text-theme-primary">No queries found</h3>
                <p className="mb-4">
                  {activeFilters.folder || activeFilters.tags.length > 0 || activeFilters.templates || searchTerm
                    ? "No queries match your search filters. Try adjusting your search criteria or clearing filters."
                    : "Get started by creating your first AQL query."}
                </p>
                {activeFilters.folder || activeFilters.tags.length > 0 || activeFilters.templates || searchTerm ? (
                  <button
                    onClick={handleResetFilters}
                    className="px-4 py-2 bg-surface-hover text-theme-primary rounded-md hover:bg-surface border border-theme"
                  >
                    Clear Filters
                  </button>
                ) : (
                  <button
                    onClick={() => setIsCreatingNew(true)}
                    className="px-4 py-2 bg-primary text-primary-text rounded-md hover:opacity-90"
                  >
                    Create Your First Query
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Query List/Tree */}
          {!loading && !error && filteredQueries.length > 0 && (
            <>
		              {viewMode === 'tree' ? (
		                <AQLQueryExplorer
		                  queries={filteredQueries}
	                  onEditQuery={setSelectedQuery}
	                  onDeleteQuery={deleteQuery}
	                  onDuplicateQuery={handleDuplicateQuery}
	                  onFolderSelect={handleFolderFilter}
	                  activeFolder={activeFilters.folder}
	                  activeTags={activeFilters.tags}
	                  onTagSelect={handleTagFilter}
                    onCreateFolder={handleCreateFolder}
	                />
		              ) : (
	                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
	                  {filteredQueries.map(query => (
                    <div
                      key={query._id}
                      className="bg-surface border border-theme rounded-lg p-4 hover:border-primary transition-colors cursor-pointer"
                      onClick={() => setSelectedQuery(query)}
                    >
                      <h3 className="font-medium text-theme-primary mb-1 line-clamp-2" title={query.name}>{query.name}</h3>
                      {query.description && (
                        <p className="text-sm text-theme-secondary mb-2 line-clamp-1" title={query.description}>{query.description}</p>
                      )}
                      <div className="flex items-center text-xs text-theme-secondary mb-2">
                        <FolderTree
                          size={12}
                          className="mr-1 text-warning cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFolderFilter(query.folderId);
                          }}
                        />
                        <span
                          className="truncate hover:text-warning cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFolderFilter(query.folderId);
                          }}
                        >
                          {getFolderName(query.folderId)}
                        </span>
                      </div>

                      {/* Tags */}
                      {query.tags && query.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {query.tags.map((tag, i) => {
                            const tagName = typeof tag === 'string' ? tag : tag.name;
                            const tagObj = metadata.tags.find(t => t.name === tagName) || { name: tagName };
                            const colors = getTagColors(tagName, tagObj.color);
                            // Remove interactive features from tag display in grid view
                            return (
                              <div
                                key={i}
                                className="flex items-center bg-surface-hover text-theme-primary px-2 py-0.5 rounded-md text-xs"
                              >
                                <Tag size={10} className={`mr-1 ${colors.text}`} />
                                <span>{tagName}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Affected Templates */}
	                      {query.affectedTemplates && query.affectedTemplates.length > 0 && (
	                        <div className="mb-2">
	                          <div className="text-xs text-theme-secondary mb-1">Templates: {query.affectedTemplates.length}</div>
	                          <div className="space-y-1">
	                            {query.affectedTemplates.slice(0, 2).map((template, i) => (
	                              <div
	                                key={i}
	                                className="w-full min-w-0 flex items-center gap-1.5 bg-surface-hover text-theme-primary px-2 py-1 rounded-md text-xs hover:bg-primary/10 transition-colors"
	                                title={template.name || 'Filter by this template'}
	                                onClick={(e) => {
	                                  e.stopPropagation();
	                                  handleTemplateFilter([template]);
	                                }}
	                              >
	                                <FileText size={10} className="text-success flex-shrink-0" />
	                                <span className="min-w-0 flex-1 truncate font-mono text-[11px]">
                                    {formatTemplateLabel(template.name)}
                                  </span>
	                              </div>
	                            ))}
	                            {query.affectedTemplates.length > 2 && (
                              <div className="text-xs text-theme-secondary">
                                +{query.affectedTemplates.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      )}

	                      <div className="flex justify-between text-xs text-theme-secondary pt-2 mt-2 border-t border-theme">
	                        <span>
	                          Updated: {new Date(query.updatedAt).toLocaleDateString()}
	                        </span>
	                        <div className="flex gap-2">
                              <QueryExportButton
                                query={query}
                                folders={metadata?.folders ?? []}
                                label="Export"
                                className="text-theme-secondary hover:text-primary"
                              />
	                          <button
	                            onClick={(e) => {
	                              e.stopPropagation();
	                              handleDuplicateQuery(query);
                            }}
                            className="text-theme-secondary hover:text-success"
                            title="Duplicate query"
                          >
                            Duplicate
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteQuery(query._id);
                            }}
                            className="text-theme-secondary hover:text-error"
                            title="Delete query"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AQLQueryManagement;
