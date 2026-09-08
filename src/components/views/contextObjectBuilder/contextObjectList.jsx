"use client";

import React from 'react';
import {
  FileCode,
  Box,
  Layers,
  Package,
  Tag,
  Clock
} from 'lucide-react';

const ContextObjectList = ({ definitions, selectedId, onSelect, total }) => {
  // Get icon based on kind
  const getKindIcon = (kind) => {
    switch (kind) {
      case 'context_object':
      case 'archetype':
      case 'template':
      case 'resource-definition':
        return <Layers size={16} className="text-purple-400" />;
      case 'block':
      case 'fragment':
        return <Package size={16} className="text-cyan-400" />;
      default:
        return <FileCode size={16} className="text-slate-400" />;
    }
  };

  const getKindLabel = (kind) => {
    switch (kind) {
      case 'context_object':
      case 'archetype':
      case 'template':
      case 'resource-definition':
        return 'context object';
      case 'block':
      case 'fragment':
        return 'block';
      default: return kind || 'unknown';
    }
  };

  // Get status badge style
  const getStatusBadge = (status) => {
    switch (status) {
      case 'draft':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-400';
      case 'active':
        return 'bg-green-500/20 text-green-400 border-green-400';
      case 'deprecated':
        return 'bg-red-500/20 text-red-400 border-red-400';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-400';
    }
  };

  // Get origin badge style
  const getOriginBadge = (origin) => {
    switch (origin) {
      case 'custom':
        return 'bg-blue-500/20 text-blue-400';
      case 'standard':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'vendor':
        return 'bg-orange-500/20 text-orange-300';
      case 'openehr':
        return 'bg-emerald-500/20 text-emerald-300';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getOriginLabel = (origin) => {
    switch (origin) {
      case 'openehr':
        return 'openEHR';
      default:
        return origin || 'unknown';
    }
  };

  // Format date
  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    const date = new Date(isoString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (definitions.length === 0) {
    return (
      <div className="p-8 text-center text-theme-secondary">
        <Box size={48} className="mx-auto mb-4 opacity-50" />
        <p className="text-lg">No ContextObjects found</p>
        <p className="text-sm mt-2">
          Create a new ContextObject or adjust your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-theme">
      {/* Total count */}
      <div className="px-4 py-2 bg-background text-xs text-theme-secondary">
        Showing {definitions.length} of {total} object{total !== 1 ? 's' : ''}
      </div>

      {/* Definition list */}
      {definitions.map((def) => (
        <div
          key={def.id}
          onClick={() => onSelect(def)}
          className={`
            p-4 cursor-pointer transition-all duration-150
            hover:bg-background/50
            ${selectedId === def.id ? 'bg-primary/10 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}
          `}
        >
          {/* Header row */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {getKindIcon(def.kind)}
              <h3 className="font-medium text-theme-primary truncate max-w-[200px]">
                {def.name}
              </h3>
            </div>
            <span className={`px-2 py-0.5 text-[10px] font-medium rounded border ${getStatusBadge(def.status)}`}>
              {def.status?.toUpperCase()}
            </span>
          </div>

          {/* Description */}
          {def.description && (
            <p className="text-sm text-theme-secondary mb-2 line-clamp-2">
              {def.description}
            </p>
          )}

          {/* Metadata row */}
          <div className="flex items-center gap-3 text-xs">
            {/* Origin */}
            <span className={`px-2 py-0.5 rounded ${getOriginBadge(def.origin)}`}>
              {getOriginLabel(def.origin)}
            </span>

            {/* Kind */}
            <span className="text-theme-secondary">
              {getKindLabel(def.kind)}
            </span>

            {/* Version */}
            <span className="text-theme-secondary font-mono">
              v{def.version}
            </span>

            {/* RM Type */}
            {def.rmType && (
              <span className="text-theme-secondary">
                {def.rmType}
              </span>
            )}
          </div>

          {/* Tags and date */}
          <div className="flex items-center justify-between mt-2">
            {/* Tags */}
            <div className="flex items-center gap-1 flex-wrap">
              {def.metadata?.tags?.slice(0, 3).map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-600/30 text-slate-400 text-[10px] rounded"
                >
                  <Tag size={10} />
                  {tag}
                </span>
              ))}
              {def.metadata?.tags?.length > 3 && (
                <span className="text-[10px] text-theme-secondary">
                  +{def.metadata.tags.length - 3} more
                </span>
              )}
            </div>

            {/* Updated date */}
            <div className="flex items-center gap-1 text-[10px] text-theme-secondary">
              <Clock size={10} />
              {formatDate(def.metadata?.updatedAt)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ContextObjectList;
