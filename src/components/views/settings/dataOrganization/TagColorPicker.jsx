// src/components/views/settings/dataOrganization/TagColorPicker.jsx
"use client";

import React, { useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';

// Predefined color options
const COLOR_OPTIONS = [
  // Blues
  { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/50', name: 'blue' },
  { bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-500/50', name: 'sky' },
  { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/50', name: 'cyan' },
  { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/50', name: 'indigo' },

  // Greens
  { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/50', name: 'green' },
  { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/50', name: 'emerald' },
  { bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/50', name: 'teal' },

  // Reds/Pinks
  { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/50', name: 'red' },
  { bg: 'bg-pink-500/20', text: 'text-pink-300', border: 'border-pink-500/50', name: 'pink' },
  { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/50', name: 'rose' },

  // Yellows/Oranges
  { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/50', name: 'yellow' },
  { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/50', name: 'amber' },
  { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/50', name: 'orange' },

  // Purples
  { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/50', name: 'purple' },
  { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/50', name: 'violet' },
  { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-300', border: 'border-fuchsia-500/50', name: 'fuchsia' },

  // Grays
  { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-500/50', name: 'slate' },
  { bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/50', name: 'gray' },
  { bg: 'bg-zinc-500/20', text: 'text-zinc-300', border: 'border-zinc-500/50', name: 'zinc' },

  // Reset to default
  { bg: 'bg-slate-600', text: 'text-slate-300', border: 'border-slate-500', name: 'default' }
];

const TagColorPicker = ({ tag, onSelectColor, onClose, position = {} }) => {
  const pickerRef = useRef(null);

  useEffect(() => {
    // Close when clicking outside
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Extract current color name from tag if it exists
  const currentColorName = tag.color || 'default';

  return (
    <div
      ref={pickerRef}
      className="absolute z-50 bg-slate-800 border border-slate-700 rounded-md shadow-xl p-3"
      style={{
        top: position.top || '0px',
        left: position.left || '0px',
        width: '280px'
      }}
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-slate-300">Select Tag Color</h3>
        <div className="text-xs text-slate-400 flex items-center">
          <Palette size={12} className="mr-1" />
          <span>Tag: {tag.name}</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {COLOR_OPTIONS.map((color) => (
          <button
            key={color.name}
            onClick={() => onSelectColor(tag._id, color.name)}
            className={`h-8 w-full rounded-md flex items-center justify-center ${color.bg} ${color.text} ${color.border} transition-all hover:scale-105`}
            title={color.name}
          >
            {currentColorName === color.name && <Check size={14} />}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <h4 className="text-sm font-medium text-slate-400 mb-1">Color Legend:</h4>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div> General Information
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500"></div> Clinical Data
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500"></div> Critical Issues
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500"></div> Alerts & Warnings
          </div>
        </div>
      </div>

      <div className="mt-3 text-xs text-slate-400">
        {currentColorName === 'default' ?
          'Using default color' :
          `Current color: ${currentColorName}`}
      </div>
    </div>
  );
};

export default TagColorPicker;