// src/app/components/views/AQLQueryManagement/AQLQueryExplorer.jsx
"use client";

import React, { useState, useEffect } from 'react';
import { FolderTree, ChevronRight, ChevronDown, Edit, Trash, Copy, ExternalLink, Plus, Tag as TagIcon } from 'lucide-react';
import PropTypes from 'prop-types';
import useMetadataManager from '@/hooks/useMetadata';
import { getTagColors } from '@/lib/utils';
import QueryExportButton from './QueryExportButton';

// Function to build folder tree structure from flat queries list
const buildFolderTree = (queries, folders) => {
  // Sort folders to ensure parents come before children
  const sortedFolders = [...folders].sort((a, b) => {
    // Root level folders first
    const aDepth = a.name.split('/').length;
    const bDepth = b.name.split('/').length;
    if (aDepth !== bDepth) return aDepth - bDepth;
    // Then alphabetically
    return a.name.localeCompare(b.name);
  });

  // Create a map of folder ID to folder object with children array
  const folderMap = {};

  // First create the root node
  const tree = {
    _id: 'root',
    name: 'root',
    isFolder: true,
    children: [],
    path: '',
    queries: []
  };
  folderMap['root'] = tree;

  // Add all folders to the map
  sortedFolders.forEach(folder => {
    folderMap[folder._id] = {
      ...folder,
      isFolder: true,
      children: [],
      queries: []
    };
  });

  // Build folder hierarchy
  sortedFolders.forEach(folder => {
    // Skip if this folder is already processed or doesn't exist in map
    if (!folderMap[folder._id]) return;

    const folderPath = folder.name;
    const pathParts = folderPath.split('/');

    if (pathParts.length === 1) {
      // Top level folder, add directly to root
      tree.children.push(folderMap[folder._id]);
    } else {
      // This is a subfolder
      const parentPath = pathParts.slice(0, -1).join('/');
      // Find parent folder by path
      const parentFolder = sortedFolders.find(f => f.name === parentPath);

      if (parentFolder && folderMap[parentFolder._id]) {
        // Add as child to parent folder
        folderMap[parentFolder._id].children.push(folderMap[folder._id]);
      } else {
        // Parent not found, add to root
        tree.children.push(folderMap[folder._id]);
      }
    }
  });

  // Add queries to their respective folders
  queries.forEach(query => {
    if (query.folderId && folderMap[query.folderId]) {
      folderMap[query.folderId].queries.push({
        ...query,
        isFolder: false
      });
    } else {
      // If no folder or folder not found, add to root
      tree.queries.push({
        ...query,
        isFolder: false
      });
    }
  });

  return tree;
};

// Query tags component
const QueryTags = ({ tags, metadata, onTagSelect, activeTags = [] }) => {
  if (!tags || !tags.length) return null;

  // Only show up to 3 tags in tree view to save space
  const visibleTags = tags.slice(0, 3);
  const hasMoreTags = tags.length > 3;

  return (
    <div className="flex flex-wrap gap-1 ml-6 mt-1 mb-1">
      {visibleTags.map((tag, index) => {
        const tagName = typeof tag === 'string' ? tag : tag.name;
        const tagObj = metadata.tags.find(t => t.name === tagName) || { name: tagName };
        const colors = getTagColors(tagName, tagObj.color);
        const isActive = activeTags.includes(tagName);

        return (
          <div
            key={tagName}
            className={`flex items-center ${isActive ? 'bg-primary text-white' : 'bg-surface-hover text-theme-primary'} px-1.5 py-0.5 rounded text-xs cursor-pointer hover:bg-surface`}
            onClick={(e) => {
              e.stopPropagation();
              onTagSelect(tagName, e);
            }}
            title="Filter by this tag (Ctrl+click to select multiple)"
          >
            <TagIcon size={9} className={`mr-1 ${!isActive ? colors.text : 'text-white'}`} />
            <span>{tagName}</span>
          </div>
        );
      })}
      {hasMoreTags && (
        <div className="text-xs text-theme-secondary">
          +{tags.length - 3} more
        </div>
      )}
    </div>
  );
};

// Recursive folder node component
const FolderNode = ({
  node,
  level = 0,
  onEditQuery,
  onDeleteQuery,
  onDuplicateQuery,
  onCreateFolder,
  onFolderSelect,
  activeFolder,
  onTagSelect,
  activeTags = [],
  metadata,
  onLoadInBuilder
}) => {
  const [isExpanded, setIsExpanded] = useState(level === 0 || node._id === activeFolder);

  // Auto-expand if this folder or any child is active
  useEffect(() => {
    const checkIfActive = (folder) => {
      if (folder._id === activeFolder) return true;
      if (folder.children) {
        return folder.children.some(child => child.isFolder && checkIfActive(child));
      }
      return false;
    };

    if (activeFolder && checkIfActive(node)) {
      setIsExpanded(true);
    }
  }, [activeFolder, node]);

  const handleToggle = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleFolderClick = (e) => {
    e.stopPropagation();
    onFolderSelect(node._id === 'root' ? null : node._id);
  };

  // If this is a folder
  return (
    <div>
      {/* Folder header (only show if not root or if root has direct queries) */}
      {(node.name !== 'root' || node.queries.length > 0) && (
        <div
          className={`flex items-center py-1 px-2 hover:bg-surface-hover cursor-pointer rounded ${activeFolder === node._id ? 'bg-primary/20 text-primary' : ''
            }`}
          onClick={handleFolderClick}
        >
          <div className="w-4 mr-1">
            {node.children.length > 0 || node.queries.length > 0 ? (
              isExpanded ?
                <ChevronDown
                  className="text-theme-secondary"
                  size={16}
                  onClick={handleToggle}
                /> :
                <ChevronRight
                  className="text-theme-secondary"
                  size={16}
                  onClick={handleToggle}
                />
            ) : <span className="w-4" />}
          </div>
          <FolderTree size={16} className="text-yellow-500 mr-2" />
          <div className="text-theme-primary font-medium">
            {node.name === 'root' ? '(Root)' : node.name.split('/').pop()}
          </div>
          <div className="ml-2 text-xs text-theme-secondary">
            ({node.queries.length})
          </div>
        </div>
      )}

      {/* Folder children & queries */}
      {isExpanded && (
        <div className={node.name !== 'root' ? "ml-6" : ""}>
          {/* Nested folders first */}
          {[...node.children]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((child) => (
              <FolderNode
                key={`folder-${child._id}`}
                node={child}
                level={level + 1}
                onEditQuery={onEditQuery}
                onDeleteQuery={onDeleteQuery}
                onDuplicateQuery={onDuplicateQuery}
                onCreateFolder={onCreateFolder}
                onFolderSelect={onFolderSelect}
                activeFolder={activeFolder}
                onTagSelect={onTagSelect}
                activeTags={activeTags}
                metadata={metadata}
                onLoadInBuilder={onLoadInBuilder}
              />
            ))}

          {/* Queries in this folder */}
          {node.queries.length > 0 && (
            <div className="space-y-1 mt-1">
              {[...node.queries]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(query => (
                  <div key={`query-${query._id}`}>
                    <div
                      className="pl-6 py-2 hover:bg-surface-hover rounded flex items-center group"
                      onClick={() => onEditQuery(query)}
                    >
                      <div className="flex-1 text-theme-primary truncate" title={query.description || query.name}>
                        {query.name}
                      </div>
                      <div className="hidden group-hover:flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditQuery(query);
                          }}
                          className="p-1 text-theme-secondary hover:text-primary"
                          title="Edit query"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDuplicateQuery(query);
                          }}
                          className="p-1 text-theme-secondary hover:text-success"
                          title="Duplicate query"
                        >
                          <Copy size={16} />
                        </button>
                        <QueryExportButton
                          query={query}
                          folders={metadata?.folders ?? []}
                          className="text-theme-secondary hover:text-primary"
                          title="Export query"
                        />
                        {onLoadInBuilder && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onLoadInBuilder(query);
                            }}
                            className="p-1 text-theme-secondary hover:text-success"
                            title="Load in AQL Builder"
                          >
                            <ExternalLink size={16} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Are you sure you want to delete "${query.name}"?`)) {
                              onDeleteQuery(query._id);
                            }
                          }}
                          className="p-1 text-theme-secondary hover:text-error"
                          title="Delete query"
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Display tags underneath the query */}
                    {query.tags && query.tags.length > 0 && (
                      <QueryTags
                        tags={query.tags}
                        metadata={metadata}
                        onTagSelect={onTagSelect}
                        activeTags={activeTags}
                      />
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AQLQueryExplorer = ({
  queries,
  onEditQuery,
  onDeleteQuery,
  onDuplicateQuery,
  onFolderSelect,
  activeFolder,
  activeTags = [],
  onTagSelect,
  onLoadInBuilder,
  onCreateFolder
}) => {
  const { metadata } = useMetadataManager();
  const [folderTree, setFolderTree] = useState(null);

  // Build folder tree whenever queries or folders change
  useEffect(() => {
    if (queries.length) {
      // Build folder tree structure
      const tree = buildFolderTree(queries, metadata?.folders ?? []);
      setFolderTree(tree);
    }
  }, [queries, metadata.folders]);

  if (!folderTree) {
    return (
      <div className="p-4 bg-surface rounded-lg text-theme-secondary">
        Loading folder structure...
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg p-4 min-h-[400px]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-medium text-theme-primary">Query Library</h3>
        <button
          onClick={() => onCreateFolder('New Folder')}
          className="p-1 px-2 text-sm bg-surface-hover text-theme-primary rounded hover:bg-surface flex items-center gap-1"
          title="Create new folder"
        >
          <Plus size={14} />
          New Folder
        </button>
      </div>

      <div className="border border-theme rounded-lg p-2 bg-surface">
        <FolderNode
          node={folderTree}
          onEditQuery={onEditQuery}
          onDeleteQuery={onDeleteQuery}
          onDuplicateQuery={onDuplicateQuery}
          onCreateFolder={onCreateFolder}
          onFolderSelect={onFolderSelect}
          activeFolder={activeFolder}
          onTagSelect={onTagSelect}
          activeTags={activeTags}
          metadata={metadata}
          onLoadInBuilder={onLoadInBuilder}
        />
      </div>
    </div>
  );
};

// PropTypes definitions
AQLQueryExplorer.propTypes = {
  queries: PropTypes.array.isRequired,
  onEditQuery: PropTypes.func.isRequired,
  onDeleteQuery: PropTypes.func.isRequired,
  onDuplicateQuery: PropTypes.func.isRequired,
  onFolderSelect: PropTypes.func,
  activeFolder: PropTypes.string,
  activeTags: PropTypes.array,
  onTagSelect: PropTypes.func,
  onLoadInBuilder: PropTypes.func,
  onCreateFolder: PropTypes.func
};

QueryTags.propTypes = {
  tags: PropTypes.array.isRequired,
  metadata: PropTypes.object.isRequired,
  onTagSelect: PropTypes.func.isRequired,
  activeTags: PropTypes.array
};

FolderNode.propTypes = {
  node: PropTypes.object.isRequired,
  level: PropTypes.number,
  onEditQuery: PropTypes.func.isRequired,
  onDeleteQuery: PropTypes.func.isRequired,
  onDuplicateQuery: PropTypes.func.isRequired,
  onCreateFolder: PropTypes.func.isRequired,
  onFolderSelect: PropTypes.func.isRequired,
  activeFolder: PropTypes.string,
  onTagSelect: PropTypes.func,
  activeTags: PropTypes.array,
  metadata: PropTypes.object.isRequired,
  onLoadInBuilder: PropTypes.func
};

export default AQLQueryExplorer;
