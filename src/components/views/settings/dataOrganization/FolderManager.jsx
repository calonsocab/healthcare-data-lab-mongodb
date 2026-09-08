// src/components/views/settings/dataOrganization/FolderManager.jsx
"use client";

import React, { useState } from 'react';
import { FolderTree, Edit2, Trash2, Check, X, Search, Plus, AlertCircle } from 'lucide-react';

const FolderManager = ({ folders, actions, loading, error }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemInput, setNewItemInput] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});

  // Filter items based on search term
  const filteredItems = folders.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Create new folder
  const handleCreateItem = async () => {
    if (!newItemInput.trim()) return;

    try {
      setStatusMessage({ type: 'info', text: `Creating folder...` });

      await actions.createFolder(newItemInput);

      setStatusMessage({
        type: 'success',
        text: `Folder created successfully`
      });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: `Error creating folder: ${err.message}`
      });
    }

    setNewItemInput('');
  };

  // Update existing folder
  const handleUpdateItem = async (item) => {
    if (!newItemName.trim() || newItemName === item.name) {
      setEditItem(null);
      return;
    }

    try {
      setStatusMessage({
        type: 'info',
        text: `Updating folder...`
      });

      // Rename the existing folder instead of creating a new one
      await actions.updateFolder({ ...item, name: newItemName });

      setStatusMessage({
        type: 'success',
        text: `Folder updated successfully`
      });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: `Error updating folder: ${err.message}`
      });
    }

    setEditItem(null);
    setNewItemName('');
  };

  // Delete folder
  const handleDeleteItem = async (item) => {
    try {
      setStatusMessage({
        type: 'info',
        text: `Checking if folder is in use...`
      });

      // Check if any queries use this folder
      const queriesUsingItem = await actions.getQueriesUsingMetadata(item._id, 'folders');

      if (queriesUsingItem.length > 0) {
        setStatusMessage({
          type: 'warning',
          text: `Removing folder reference from ${queriesUsingItem.length} queries before deleting...`,
        });

        // Remove folder references in queries
        await actions.updateMetadataReferences(item._id, null, 'folders'); // Null means remove the reference

        setStatusMessage({
          type: 'success',
          text: `Folder references removed. Proceeding with deletion...`,
        });
        setTimeout(() => setStatusMessage(null), 3000);
      }

      // Now delete the folder
      await actions.deleteFolder(item._id);

      setStatusMessage({
        type: 'success',
        text: `Folder deleted successfully.`
      });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: `Error deleting folder: ${err.message}`
      });
    }

    setShowConfirmDelete(null);
  };

  // Toggle folder expansion
  const toggleFolderExpansion = (folderId) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  // Helper to get folder hierarchy
  const getFolderHierarchy = () => {
    const folderMap = {};
    const rootFolders = [];

    // First pass: create folder objects
    filteredItems.forEach(folder => {
      folderMap[folder._id] = {
        ...folder,
        children: []
      };
    });

    // Second pass: build hierarchy
    filteredItems.forEach(folder => {
      const folderPath = folder.name;
      const pathParts = folderPath.split('/');

      if (pathParts.length === 1) {
        // Root level folder
        rootFolders.push(folderMap[folder._id]);
      } else {
        // This is a child folder
        const parentPath = pathParts.slice(0, -1).join('/');
        const parentFolder = filteredItems.find(f => f.name === parentPath);

        if (parentFolder && folderMap[parentFolder._id]) {
          folderMap[parentFolder._id].children.push(folderMap[folder._id]);
        } else {
          // Parent doesn't exist, treat as root
          rootFolders.push(folderMap[folder._id]);
        }
      }
    });

    return rootFolders;
  };

  // Render a folder item (recursive for hierarchy)
  const renderFolderItem = (folder, depth = 0) => {
    const hasChildren = folder.children && folder.children.length > 0;
    const isExpanded = expandedFolders[folder._id];

    return (
      <div key={folder._id} className="folder-container">
        <div
          className={`p-2 rounded-md flex items-center justify-between ${editItem?._id === folder._id
              ? 'bg-slate-700'
              : 'bg-slate-800 hover:bg-slate-700'
            }`}
          style={{ marginLeft: `${depth * 16}px` }}
        >
          {editItem?._id === folder._id ? (
            // Edit mode
            <div className="flex-1 flex gap-2">
              <div className="flex-shrink-0 mr-1">
                <FolderTree size={16} className="text-yellow-500" />
              </div>
              <input
                type="text"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
                className="flex-1 p-1 bg-slate-800 border border-slate-600 rounded text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') handleUpdateItem(folder);
                  if (e.key === 'Escape') setEditItem(null);
                }}
              />
              <button
                onClick={() => handleUpdateItem(folder)}
                className="p-1 text-green-400 hover:text-green-300"
                title="Save changes"
              >
                <Check size={16} />
              </button>
              <button
                onClick={() => setEditItem(null)}
                className="p-1 text-red-400 hover:text-red-300"
                title="Cancel"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            // View mode
            <>
              <div
                className="flex items-center overflow-hidden cursor-pointer"
                onClick={() => hasChildren && toggleFolderExpansion(folder._id)}
              >
                <FolderTree size={16} className="text-yellow-500 mr-2 flex-shrink-0" />
                <span className="text-slate-300 truncate">{folder.name.split('/').pop()}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditItem(folder);
                    setNewItemName(folder.name);
                  }}
                  className="p-1 text-slate-400 hover:text-blue-400"
                  title="Edit folder"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => setShowConfirmDelete(folder._id)}
                  className="p-1 text-slate-400 hover:text-red-400"
                  title="Delete folder"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Render children if expanded */}
        {hasChildren && isExpanded && (
          <div className="children-container">
            {folder.children.map(child => renderFolderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Status Messages */}
      {statusMessage && (
        <div className={`mb-4 p-3 rounded-md flex items-center ${statusMessage.type === 'error' ? 'bg-red-900/30 text-red-300' :
            statusMessage.type === 'warning' ? 'bg-yellow-900/30 text-yellow-300' :
              statusMessage.type === 'success' ? 'bg-green-900/30 text-green-300' :
                'bg-blue-900/30 text-blue-300'
          }`}>
          {statusMessage.type === 'error' && <AlertCircle size={16} className="mr-2 flex-shrink-0" />}
          {statusMessage.type === 'warning' && <AlertCircle size={16} className="mr-2 flex-shrink-0" />}
          {statusMessage.type === 'success' && <Check size={16} className="mr-2 flex-shrink-0" />}
          <span className="text-sm">{statusMessage.text}</span>
        </div>
      )}

      {/* Create New Folder Input */}
      <div className="mb-4">
        <div className="flex">
          <input
            type="text"
            value={newItemInput}
            onChange={e => setNewItemInput(e.target.value)}
            placeholder="Add new folder (use / for subfolders)..."
            className="flex-1 p-2 bg-slate-700 border border-slate-600 rounded-l-md text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={e => e.key === 'Enter' && handleCreateItem()}
          />
          <button
            onClick={handleCreateItem}
            className="px-3 py-2 bg-primary text-primary-text rounded-r-md hover:bg-primary-hover"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="mt-1 text-xs text-slate-500">
          Use / to create subfolders (e.g. "Projects/Frontend")
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={16} className="text-slate-500" />
        </div>
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search folders..."
          className="w-full p-2 pl-10 bg-slate-700 border border-slate-600 rounded-md text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="text-slate-400 text-center p-6">Loading folders...</div>
      ) : error ? (
        <div className="bg-red-900/30 text-red-300 p-4 rounded-md">
          <h3 className="font-medium mb-2">Error loading folders</h3>
          <p>{error}</p>
        </div>
      ) : (
        /* Folders List */
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="text-slate-500 text-center p-4">
              {searchTerm
                ? `No folders found matching "${searchTerm}"`
                : 'No folders found. Add one above.'}
            </div>
          ) : (
            getFolderHierarchy().map(folder => renderFolderItem(folder))
          )}
        </div>
      )}

      {/* Confirm Delete Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-medium text-red-400 mb-4">Confirm Delete</h3>
            <p className="text-slate-300 mb-6">
              Are you sure you want to delete this folder?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowConfirmDelete(null)}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteItem(filteredItems.find(item => item._id === showConfirmDelete))}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FolderManager;
