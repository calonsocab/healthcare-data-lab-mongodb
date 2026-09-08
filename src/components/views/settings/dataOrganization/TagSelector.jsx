// src/components/views/settings/dataOrganization/TagSelector.jsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Tag, Palette } from 'lucide-react';
import { getTagColors } from '@/lib/utils';
import TagColorPicker from './TagColorPicker';
import { createPortal } from 'react-dom';

function normalizeTagName(tag) {
    if (typeof tag === 'string') return tag.trim();
    if (tag && typeof tag === 'object') {
        if (typeof tag.name === 'string') return tag.name.trim();
        if (typeof tag.label === 'string') return tag.label.trim();
    }
    return '';
}

const TagSelector = ({ selectedTags, availableTags, onAddTag, onRemoveTag, onCreateTag, onUpdateTag }) => {
    const [tagInput, setTagInput] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [colorPickerTag, setColorPickerTag] = useState(null);
    const [colorPickerPosition, setColorPickerPosition] = useState({ top: 0, left: 0 });

    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    // Sort available tags alphanumerically
    const sortedAvailableTags = (availableTags || [])
        .filter(tag => normalizeTagName(tag))
        .slice()
        .sort((a, b) => normalizeTagName(a).localeCompare(normalizeTagName(b)));

    // Normalize selectedTags to always be objects with _id and name
    const normalizedSelectedTags = (selectedTags || []).map((tag, index) => {
        if (typeof tag === 'string') {
            const normalizedName = normalizeTagName(tag);
            const matchingTag = sortedAvailableTags.find(
                t => normalizeTagName(t).toLowerCase() === normalizedName.toLowerCase()
            );
            return matchingTag || { _id: `temp-${tag}`, name: tag };
        }

        const normalizedName = normalizeTagName(tag);
        return {
            ...(tag || {}),
            _id: tag?._id || `temp-selected-${index}`,
            name: normalizedName || 'Unnamed tag'
        };
    });

    // Filter available tags based on input and already selected tags
    const filteredTags = sortedAvailableTags.filter(tag =>
        normalizeTagName(tag).toLowerCase().includes(tagInput.toLowerCase()) &&
        !normalizedSelectedTags.some(selected => 
            selected._id === tag._id || 
            normalizeTagName(selected).toLowerCase() === normalizeTagName(tag).toLowerCase()
        )
    );

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current && !dropdownRef.current.contains(event.target) &&
                inputRef.current && !inputRef.current.contains(event.target)
            ) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
        } else if (e.key === 'Escape') {
            setShowDropdown(false);
        }
    };

    const handleAddTag = async () => {
        const trimmedTag = tagInput.trim();
        if (!trimmedTag) return;

        // Check if this tag is already selected (case insensitive)
        const isAlreadySelected = normalizedSelectedTags.some(
            tag => normalizeTagName(tag).toLowerCase() === trimmedTag.toLowerCase()
        );

        if (isAlreadySelected) {
            // Tag already exists in selection, don't add it again
            setTagInput('');
            setShowDropdown(false);
            return;
        }

        // Check if this tag already exists in available tags
        const existingTag = sortedAvailableTags.find(
            tag => normalizeTagName(tag).toLowerCase() === trimmedTag.toLowerCase()
        );

        if (existingTag) {
            onAddTag(existingTag);
        } else {
            try {
                const newTag = await onCreateTag(trimmedTag);
                if (newTag) {
                    onAddTag(newTag);
                }
            } catch (error) {
                console.error("Error creating tag:", error);
                onAddTag({ _id: `temp-${trimmedTag}`, name: trimmedTag });
            }
        }

        setTagInput('');
        setShowDropdown(false);
    };

    const handleTagClick = (tag, event) => {
        if (!onUpdateTag) return;

        if (event.target.closest('button')) return; // Prevent opening on "X" click

        const rect = event.currentTarget.getBoundingClientRect();
        setColorPickerPosition({
            top: rect.bottom + window.scrollY + 5,
            left: rect.left + window.scrollX
        });

        setColorPickerTag(tag);
        event.stopPropagation();
    };

    return (
        <div className="relative space-y-2">
            <label className="block text-sm font-medium text-slate-300">Tags</label>

            {/* Selected Tags */}
            <div className="flex flex-wrap gap-2 mb-2 min-h-8">
                {normalizedSelectedTags.length > 0 ? (
                    normalizedSelectedTags.map(tag => {
                        const colors = getTagColors(tag.name, tag.color);
                        return (
                            <div
                                key={tag._id || `tag-${tag.name}`}
                                className={`flex items-center cursor-pointer ${colors.bg} ${colors.text} px-2 py-1 rounded-md border ${colors.border} group`}
                                onClick={(e) => handleTagClick(tag, e)}
                            >
                                <Tag size={12} className="mr-1 text-current" />
                                <span className="text-sm">{tag.name}</span>

                                <button
                                    type="button"
                                    className="ml-1 text-current hover:text-red-400"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveTag(tag);
                                    }}
                                    aria-label={`Remove tag ${tag.name}`}
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-sm text-slate-500 italic">No tags selected</div>
                )}
            </div>

            {/* Tag Input */}
            <div className="relative">
                <div className="flex">
                    <input
                        ref={inputRef}
                        type="text"
                        value={tagInput}
                        onChange={e => {
                            setTagInput(e.target.value);
                            setShowDropdown(Boolean(e.target.value));
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="Add or create a tag..."
                        className="flex-1 p-2 bg-slate-700 border border-slate-600 rounded-l-md text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="button"
                        onClick={handleAddTag}
                        className="px-3 py-2 bg-primary text-primary-text rounded-r-md hover:bg-primary-hover"
                        aria-label="Add tag"
                    >
                        <Plus size={16} />
                    </button>
                </div>

                {/* Dropdown */}
                {showDropdown && tagInput && filteredTags.length > 0 &&
                    createPortal(
                        <div
                            ref={dropdownRef}
                            className="absolute z-50 bg-slate-800 border border-slate-700 rounded-md shadow-lg max-h-60 overflow-auto"
                            style={{
                                top: inputRef.current?.getBoundingClientRect().bottom + window.scrollY + 5,
                                left: inputRef.current?.getBoundingClientRect().left + window.scrollX,
                                width: inputRef.current?.offsetWidth
                            }}
                        >
                            {filteredTags.map(tag => {
                                const colors = getTagColors(tag.name, tag.color);
                                return (
                                    <div
                                        key={tag._id}
                                        className={`px-3 py-2 cursor-pointer hover:bg-slate-700 flex items-center ${colors.text}`}
                                        onClick={() => {
                                            onAddTag(tag);
                                            setTagInput('');
                                            setShowDropdown(false);
                                        }}
                                    >
                                        <div className={`w-3 h-3 rounded-full mr-2 ${colors.bg} ${colors.border}`}></div>
                                        <span className="text-slate-300">{tag.name}</span>
                                    </div>
                                );
                            })}
                        </div>,
                        document.body
                    )}
            </div>

            {/* Color Picker */}
            {colorPickerTag && onUpdateTag && (
                <TagColorPicker
                    tag={colorPickerTag}
                    onSelectColor={(tagId, colorName) => {
                        // Call the parent's update function
                        onUpdateTag(tagId, colorName);
                        // Close color picker
                        setColorPickerTag(null);
                    }}
                    onClose={() => setColorPickerTag(null)}
                    position={colorPickerPosition}
                    showLegendInside
                />
            )}
        </div>
    );
};

export default TagSelector;
