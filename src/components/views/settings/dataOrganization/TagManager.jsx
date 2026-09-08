// src/components/AQLQueryManagement/MetadataManagement/TagManager.jsx
"use client";

import React, { useState } from 'react';
import { Tag as TagIcon, Edit2, Trash2, Check, X, Search, Plus, AlertCircle, Palette } from 'lucide-react';
import { getTagColors } from '@/lib/utils';
import TagColorPicker from './TagColorPicker';
import { useAQLQueries } from '@/providers/AQLQueryProvider';

const TagManager = ({ tags, actions, loading, error }) => {
  const { getQueriesByTag } = useAQLQueries();
  const [searchTerm, setSearchTerm] = useState('');
  const [editItem, setEditItem] = useState(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemInput, setNewItemInput] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [colorPickerTag, setColorPickerTag] = useState(null);
  const [colorPickerPosition, setColorPickerPosition] = useState({ top: 0, left: 0 });

  // Filter items based on search term
  const filteredItems = tags.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Create new tag
  const handleCreateItem = async () => {
    if (!newItemInput.trim()) return;
  
    try {
      setStatusMessage({ type: 'info', text: `Creating tag...` });
  
      const newTag = await actions.createTag(newItemInput); 
  
      if (newTag) {        
        setStatusMessage({
          type: 'success',
          text: `Tag created successfully`
        });
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: `Error creating tag: ${err.message}`
      });
    }
  
    setNewItemInput('');
  };

  // Update existing tag
  const handleUpdateItem = async (item) => {
    if (!newItemName.trim() || newItemName === item.name) {
      setEditItem(null);
      return;
    }

    try {
      setStatusMessage({
        type: 'info',
        text: `Updating tag...`
      });

      // Preserve the color when updating the name
      const colorToKeep = item.color;

      // Create new tag with updated name
      const newTag = await actions.createTag(newItemName);
      if (newTag) {
        // If the original tag had a color, update the new tag with the same color
        if (colorToKeep && actions.updateTag) {
          await actions.updateTag({
            ...newTag,
            color: colorToKeep
          });
        }

        // Update any queries using the old tag
        await actions.updateMetadataReferences(item._id, newTag._id, 'tags');
        // Delete old tag
        await actions.deleteTag(item._id);
      }

      if (newTag) {
        setStatusMessage({
          type: 'success',
          text: `Tag updated successfully`
        });
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: `Error updating tag: ${err.message}`
      });
    }

    setEditItem(null);
    setNewItemName('');
  };

  // Delete tag
  const handleDeleteItem = async (item) => {
    try {
      setStatusMessage({ 
        type: 'info', 
        text: `Checking if tag is in use...` 
      });
  
      // Check tag usage from the shared provider cache (no extra fetch).
      const queriesUsingTag = getQueriesByTag(item.name);
  
      if (queriesUsingTag.length > 0) {
        setStatusMessage({ 
          type: 'warning', 
          text: `Warning: ${queriesUsingTag.length} queries use this tag. Deleting will remove it from those queries.` 
        });
  
        // Wait for 2 seconds to allow user to read the warning, then proceed
        setTimeout(async () => {
          await actions.deleteTag(item._id);
          setStatusMessage({ 
            type: 'success', 
            text: `Tag deleted successfully.` 
          });
  
          setTimeout(() => setStatusMessage(null), 3000);
        }, 2000);
      } else {
        // Directly delete if not in use
        await actions.deleteTag(item._id);
        setStatusMessage({ 
          type: 'success', 
          text: `Tag deleted successfully.` 
        });
  
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err) {
      setStatusMessage({ 
        type: 'error', 
        text: `Error deleting tag: ${err.message}` 
      });
    }
    
    setShowConfirmDelete(null);
  };

  // Handle opening color picker
  const handleOpenColorPicker = (tag, event) => {
    // Only show color picker if updateTag is available
    if (!actions.updateTag) return;

    const rect = event.currentTarget.getBoundingClientRect();

    setColorPickerPosition({
      top: `${rect.bottom + window.scrollY + 5}px`,
      left: `${rect.left + window.scrollX}px`
    });

    setColorPickerTag(tag);
    event.stopPropagation();
  };

  // Handle color selection
  const handleSelectColor = async (tagId, colorName) => {
    // Only process if updateTag is available
    if (!actions.updateTag) {
      setColorPickerTag(null);
      return;
    }

    try {
      const tag = filteredItems.find(item => item._id === tagId);
      if (!tag) return;

      setStatusMessage({ type: 'info', text: `Updating tag color...` });

      // Create updated tag with new color
      const updatedTag = {
        ...tag,
        color: colorName === 'default' ? null : colorName // Remove color if default
      };

      // Update tag in the system
      await actions.updateTag(updatedTag);

      setStatusMessage({
        type: 'success',
        text: `Tag color updated successfully`
      });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: `Error updating tag color: ${err.message}`
      });
    }

    // Close the color picker
    setColorPickerTag(null);
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

      {/* Create New Tag Input */}
      <div className="mb-4">
        <div className="flex">
          <input
            type="text"
            value={newItemInput}
            onChange={e => setNewItemInput(e.target.value)}
            placeholder="Add new tag..."
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
          placeholder="Search tags..."
          className="w-full p-2 pl-10 bg-slate-700 border border-slate-600 rounded-md text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="text-slate-400 text-center p-6">Loading tags...</div>
      ) : error ? (
        <div className="bg-red-900/30 text-red-300 p-4 rounded-md">
          <h3 className="font-medium mb-2">Error loading tags</h3>
          <p>{error}</p>
        </div>
      ) : (
        /* Tags List */
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="text-slate-500 text-center p-4">
              {searchTerm
                ? `No tags found matching "${searchTerm}"`
                : 'No tags found. Add one above.'}
            </div>
          ) : (
            filteredItems.map(item => {
              // Get colors for this tag (uses custom color if set)
              const colors = getTagColors(item.name, item.color);

              return (
                <div
                  key={item._id}
                  className={`p-2 rounded-md flex items-center justify-between ${editItem?._id === item._id
                      ? 'bg-slate-700'
                      : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                >
                  {editItem?._id === item._id ? (
                    // Edit mode
                    <div className="flex-1 flex gap-2">
                      <div className="flex-shrink-0 mr-1">
                        <TagIcon size={16} className="text-blue-400" />
                      </div>
                      <input
                        type="text"
                        value={newItemName}
                        onChange={e => setNewItemName(e.target.value)}
                        className="flex-1 p-1 bg-slate-800 border border-slate-600 rounded text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleUpdateItem(item);
                          if (e.key === 'Escape') setEditItem(null);
                        }}
                      />
                      <button
                        onClick={() => handleUpdateItem(item)}
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
                      <div className="flex items-center overflow-hidden">
                        <TagIcon size={16} className={`${colors.text} mr-2 flex-shrink-0`} />
                        <span className="text-slate-300 truncate">{item.name}</span>
                      </div>
                      <div className="flex gap-2">
                        {actions.updateTag && (
                          <button
                            onClick={(e) => handleOpenColorPicker(item, e)}
                            className="p-1 text-slate-400 hover:text-blue-400"
                            title="Change tag color"
                          >
                            <Palette size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setEditItem(item);
                            setNewItemName(item.name);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-400"
                          title="Edit tag"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setShowConfirmDelete(item._id)}
                          className="p-1 text-slate-400 hover:text-red-400"
                          title="Delete tag"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Confirm Delete Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-6 rounded-lg max-w-md w-full">
            <h3 className="text-lg font-medium text-red-400 mb-4">Confirm Delete</h3>
            <p className="text-slate-300 mb-6">
              Are you sure you want to delete this tag?
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

      {/* Color Picker Modal */}
      {colorPickerTag && (
        <TagColorPicker
          tag={colorPickerTag}
          onSelectColor={handleSelectColor}
          onClose={() => setColorPickerTag(null)}
          position={colorPickerPosition}
        />
      )}
    </div>
  );
};

export default TagManager;