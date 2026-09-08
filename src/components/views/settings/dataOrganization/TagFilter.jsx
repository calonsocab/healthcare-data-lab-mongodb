// src/components/views/settings/dataOrganization/TagFilter.jsx
"use client";

import React, { useState, useEffect } from 'react';
import { Tag as TagIcon, X } from 'lucide-react';
import { getTagColors } from '@/lib/utils';
import PropTypes from 'prop-types';

const TagFilter = ({ availableTags, activeTags, onTagSelect }) => {
  const [allTags, setAllTags] = useState([]);

  // Sort and prepare tags when they become available
  useEffect(() => {
    if (availableTags && availableTags.length) {
      // Sort alphabetically
      const sorted = [...availableTags].sort((a, b) => 
        a.name.localeCompare(b.name)
      );
      setAllTags(sorted);
    }
  }, [availableTags]);

  if (!allTags.length) return null;

  // Handle tag click - toggles tag selection
  const handleTagClick = (tagName) => {
    // If already selected, remove it from selection, otherwise add it
    if (activeTags.includes(tagName)) {
      onTagSelect(activeTags.filter(tag => tag !== tagName));
    } else {
      onTagSelect([...activeTags, tagName]);
    }
  };

  // Clear all selected tags
  const clearAllTags = () => {
    onTagSelect([]);
  };

  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs text-slate-400 mb-2">
        <div className="flex items-center">
          <TagIcon size={12} className="mr-1" />
          FILTER BY TAG
        </div>
        {activeTags.length > 0 && (
          <button
            onClick={clearAllTags}
            className="text-blue-400 hover:text-blue-300"
          >
            Clear all ({activeTags.length})
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {allTags.map(tag => {
          const colors = getTagColors(tag.name, tag.color);
          const isActive = activeTags.includes(tag.name);
          
          return (
            <div 
              key={tag._id || `tag-${tag.name}`} 
              className={`flex items-center px-2 py-0.5 rounded-md text-xs cursor-pointer transition-colors ${
                isActive
                  ? 'bg-primary text-primary-text'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              onClick={() => handleTagClick(tag.name)}
            >
              <TagIcon size={10} className={`mr-1 ${!isActive ? colors.text : 'text-white'}`} />
              <span>{tag.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

TagFilter.propTypes = {
  availableTags: PropTypes.array.isRequired,
  activeTags: PropTypes.array.isRequired,
  onTagSelect: PropTypes.func.isRequired,
};

export default TagFilter;