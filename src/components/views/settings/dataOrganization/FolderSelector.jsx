// src/components/views/settings/dataOrganization/FolderSelector.jsx
"use client";

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, FolderTree, Plus, Check, X } from 'lucide-react';

const FolderSelector = ({ value, availableFolders, onChange, onCreateFolder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderPath, setNewFolderPath] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setNewFolderMode(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when entering new folder mode
  useEffect(() => {
    if (newFolderMode && inputRef.current) {
      inputRef.current.focus();
    }
  }, [newFolderMode]);

  const handleCreateFolder = async () => {
    if (!newFolderPath.trim()) {
      setErrorMessage('Folder name cannot be empty');
      return;
    }

    // Validate folder path: should only contain alphanumeric characters, spaces, hyphens, underscores, and forward slashes
    const validPattern = /^[a-zA-Z0-9\s\-_\/]+$/;
    if (!validPattern.test(newFolderPath)) {
      setErrorMessage('Folder name contains invalid characters');
      return;
    }

    // Check if folder already exists
    const folderExists = availableFolders.some(
      folder => folder.name.toLowerCase() === newFolderPath.toLowerCase()
    );
    
    if (folderExists) {
      setErrorMessage('Folder already exists');
      return;
    }

    try {
      setErrorMessage('');
      const newFolder = await onCreateFolder(newFolderPath);
      if (newFolder) {
        onChange(newFolder._id);
        setNewFolderMode(false);
        setNewFolderPath('');
        setIsOpen(false);
      }
    } catch (error) {
      console.error("Error creating folder:", error);
      setErrorMessage('Failed to create folder');
    }
  };

  // Helper for identifying nested folder structure
  const buildFolderTree = (folders) => {
    const tree = {};
    
    if (!folders || !Array.isArray(folders)) {
      return tree;
    }
    
    folders.forEach(folder => {
      if (!folder || !folder.name) return;
      
      const parts = folder.name.split('/');
      let current = tree;
      
      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = {
            children: {},
            isLeaf: index === parts.length - 1,
            path: parts.slice(0, index + 1).join('/'),
            folder: index === parts.length - 1 ? folder : null
          };
        }
        current = current[part].children;
      });
    });
    
    return tree;
  };

  // Memoize the folder tree for performance
  const folderTree = useMemo(() => {
    return buildFolderTree(availableFolders);
  }, [availableFolders]);

  // Render the folder tree recursively
  const renderFolderTree = (node, level = 0) => {
    if (!node) return null;

    return Object.keys(node)
      .sort((a, b) => a.localeCompare(b))
      .map(key => {
        const item = node[key];
        if (!item) return null;

        const displayId = item.folder ? item.folder._id : null;
        const isSelected = displayId && value === displayId;

        return (
          <div key={item.path || key}>
            <div
              className={`px-3 py-2 text-sm hover:bg-surface-hover cursor-pointer flex items-center ${
                isSelected ? 'bg-primary/20 text-primary' : 'text-theme-primary'
              }`}
              style={{ paddingLeft: `${(level * 12) + 12}px` }}
              onClick={() => {
                if (item.folder) {
                  onChange(item.folder._id);
                  setIsOpen(false);
                }
              }}
            >
              <FolderTree size={14} className="mr-2 text-warning" />
              {key}
            </div>
            {item.children && Object.keys(item.children).length > 0 &&
              renderFolderTree(item.children, level + 1)}
          </div>
        );
      });
  };

  // Find the currently selected folder for display
  const selectedFolder = useMemo(() => {
    return availableFolders?.find(folder => folder._id === value) || null;
  }, [availableFolders, value]);

  return (
    <div className="space-y-2 relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-theme-primary">
        Folder
      </label>
      <div
        className="p-2 bg-background/50 border border-theme/50 rounded-md text-theme-primary flex items-center justify-between cursor-pointer hover:border-theme transition-colors"
        onClick={() => {
          if (!availableFolders || availableFolders.length === 0) return;
          setIsOpen(!isOpen);
          setNewFolderMode(false);
          setErrorMessage('');
        }}
      >
        <div className="flex items-center">
          {selectedFolder ? (
            <>
              <FolderTree size={16} className="mr-2 text-warning" />
              <span>{selectedFolder.name}</span>
            </>
          ) : (
            <span className="text-theme-secondary">
              {!availableFolders ? "Loading folders..." :
               availableFolders.length === 0 ? "No folders available" :
               "Select a folder..."}
            </span>
          )}
        </div>
        <ChevronDown size={16} className={`text-theme-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      {isOpen && availableFolders && availableFolders.length >= 0 && (
        <div className="fixed inset-0 z-40 bg-black/20"
             onClick={(e) => {
               if (e.target === e.currentTarget) {
                 setIsOpen(false);
                 setNewFolderMode(false);
               }
             }}>
          <div className="absolute z-50 bg-surface border border-theme rounded-md shadow-lg max-h-96 overflow-auto"
               style={{
                 top: dropdownRef.current?.getBoundingClientRect().bottom + window.scrollY + 5 || '0',
                 left: dropdownRef.current?.getBoundingClientRect().left + window.scrollX || '0',
                 width: dropdownRef.current?.offsetWidth || 'auto',
                 maxWidth: '100vw',
               }}>
            {newFolderMode ? (
              <div className="p-3 border-b border-theme">
                <div className="mb-2 text-sm text-theme-primary font-medium">Create New Folder</div>
                <div className="flex">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newFolderPath}
                    onChange={e => {
                      setNewFolderPath(e.target.value);
                      setErrorMessage('');
                    }}
                    placeholder="Folder/Subfolder"
                    className={`flex-1 p-2 bg-background/50 border ${
                      errorMessage ? 'border-error' : 'border-theme/50'
                    } rounded-l-md text-theme-primary focus:outline-none focus:ring-1 focus:ring-primary`}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleCreateFolder();
                      if (e.key === 'Escape') {
                        setNewFolderMode(false);
                        setErrorMessage('');
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCreateFolder}
                    className="px-3 py-2 bg-primary text-primary-text rounded-r-md hover:opacity-90"
                  >
                    <Check size={16} />
                  </button>
                </div>
                {errorMessage && (
                  <div className="mt-1 text-xs text-error">{errorMessage}</div>
                )}
                <div className="mt-2 text-xs text-theme-secondary">
                  Use / to create nested folders (e.g. "Clinical/Vital Signs")
                </div>
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setNewFolderMode(false);
                      setErrorMessage('');
                    }}
                    className="px-3 py-1 text-xs bg-surface-hover text-theme-primary rounded-md hover:bg-surface"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div
                  className="px-3 py-2 text-sm border-b border-theme hover:bg-surface-hover cursor-pointer flex items-center text-primary"
                  onClick={() => {
                    setNewFolderMode(true);
                    setErrorMessage('');
                  }}
                >
                  <Plus size={14} className="mr-2" />
                  Create new folder
                </div>
                <div
                  className={`px-3 py-2 text-sm hover:bg-surface-hover cursor-pointer flex items-center ${!value ? 'bg-primary/20 text-primary' : 'text-theme-primary'}`}
                  onClick={() => {
                    onChange(null);
                    setIsOpen(false);
                  }}
                >
                  <FolderTree size={14} className="mr-2 text-warning" />
                  (Root)
                </div>
                {renderFolderTree(folderTree)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FolderSelector;