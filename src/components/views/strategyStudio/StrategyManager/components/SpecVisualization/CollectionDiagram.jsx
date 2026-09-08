// src/components/views/strategyStudio/StrategyManager/components/SpecVisualization/CollectionDiagram.jsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  Database, ChevronDown, ChevronRight, Hash, Search, Key,
  Fingerprint, Route, Box, GitBranch, Link, Copy, Eye, EyeOff
} from 'lucide-react';

/**
 * CollectionDiagram - Visual representation of storage collections
 *
 * Features:
 * - Entity cards with expandable nested fields
 * - Role badges (canonical, projection, dictionary)
 * - Join lines between collections
 * - Index chips (btree, search, vector)
 * - Field-level annotations (identity, path, workload hints)
 */
const CollectionDiagram = ({
  stores,
  joins,
  encodingProfile,
  expandedStores,
  toggleStoreExpanded,
  showMetaOnly,
  compact = false
}) => {
  const containerRef = useRef(null);
  const [storeRefs, setStoreRefs] = useState({});

  // Calculate join line positions
  const [joinLines, setJoinLines] = useState([]);

  useEffect(() => {
    if (!containerRef.current || !joins?.length) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    const lines = joins.map(join => {
      const fromEl = container.querySelector(`[data-store-id="${join.from}"]`);
      const toEl = container.querySelector(`[data-store-id="${join.to}"]`);

      if (!fromEl || !toEl) return null;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      return {
        from: {
          x: fromRect.right - containerRect.left,
          y: fromRect.top - containerRect.top + fromRect.height / 2
        },
        to: {
          x: toRect.left - containerRect.left,
          y: toRect.top - containerRect.top + toRect.height / 2
        },
        join
      };
    }).filter(Boolean);

    setJoinLines(lines);
  }, [joins, expandedStores, stores]);

  return (
    <div ref={containerRef} className="relative">
      {/* SVG for join lines */}
      <svg className="absolute inset-0 pointer-events-none z-0" style={{ width: '100%', height: '100%' }}>
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#4ade80" />
          </marker>
        </defs>
        {joinLines.map((line, idx) => (
          <g key={idx}>
            <path
              d={`M ${line.from.x} ${line.from.y} C ${line.from.x + 50} ${line.from.y}, ${line.to.x - 50} ${line.to.y}, ${line.to.x} ${line.to.y}`}
              stroke="#4ade8040"
              strokeWidth="2"
              fill="none"
              strokeDasharray="5,5"
              markerEnd="url(#arrowhead)"
            />
            <text
              x={(line.from.x + line.to.x) / 2}
              y={(line.from.y + line.to.y) / 2 - 8}
              fill="#4ade80"
              fontSize="10"
              textAnchor="middle"
            >
              {line.join.key}
            </text>
          </g>
        ))}
      </svg>

      {/* Store Cards */}
      <div className={`relative z-10 ${compact ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}`}>
        {stores.map(store => (
          <StoreCard
            key={store.id}
            store={store}
            expanded={expandedStores.has(store.id)}
            onToggle={() => toggleStoreExpanded(store.id)}
            showMetaOnly={showMetaOnly}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
};

// Store Card Component
const StoreCard = ({ store, expanded, onToggle, showMetaOnly, compact }) => {
  const [copiedField, setCopiedField] = useState(null);

  const copyFieldPath = (path) => {
    navigator.clipboard.writeText(path);
    setCopiedField(path);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const roleColors = {
    canonical: { bg: 'bg-blue-900/20', border: 'border-blue-600/40', text: 'text-blue-400', badge: 'bg-blue-900/40 text-blue-300' },
    projection: { bg: 'bg-purple-900/20', border: 'border-purple-600/40', text: 'text-purple-400', badge: 'bg-purple-900/40 text-purple-300' },
    dictionary: { bg: 'bg-amber-900/20', border: 'border-amber-600/40', text: 'text-amber-400', badge: 'bg-amber-900/40 text-amber-300' },
    index: { bg: 'bg-emerald-900/20', border: 'border-emerald-600/40', text: 'text-emerald-400', badge: 'bg-emerald-900/40 text-emerald-300' }
  };

  const colors = roleColors[store.role] || roleColors.canonical;

  // Filter fields based on showMetaOnly
  const displayFields = showMetaOnly
    ? store.fields?.filter(f => ['identity', 'path', 'archetype'].includes(f.logicalKey))
    : store.fields;

  // Count fields by category for summary
  const fieldStats = store.fields?.reduce((acc, f) => {
    acc.total++;
    if (f.indexed) acc.indexed++;
    if (f.logicalKey) acc.annotated++;
    return acc;
  }, { total: 0, indexed: 0, annotated: 0 }) || { total: 0, indexed: 0, annotated: 0 };

  return (
    <div
      data-store-id={store.id}
      className={`rounded-xl border overflow-hidden transition-all ${colors.bg} ${colors.border}`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-800/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={`p-1.5 rounded-lg bg-slate-900/60 ${colors.text}`}>
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">{store.name}</span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors.badge}`}>
                {store.role}
              </span>
            </div>
            {!compact && (
              <p className="text-xs text-slate-500">{store.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Config badge showing collection name comes from config */}
          {store.badgeFromConfig && (
            <span className="px-2 py-0.5 text-xs bg-slate-700/60 text-slate-400 rounded font-mono">
              ${'{'}config.{store.badgeFromConfig}{'}'}
            </span>
          )}
          {store.atlasSearch && (
            <span className="px-2 py-0.5 text-xs bg-purple-900/40 text-purple-300 rounded flex items-center gap-1">
              <Search className="w-3 h-3" />
              Atlas
            </span>
          )}
          {store.indexes?.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">
              {store.indexes.length} idx
            </span>
          )}
          {fieldStats.total > 0 && (
            <span className="px-2 py-0.5 text-xs bg-slate-700/50 text-slate-400 rounded">
              {fieldStats.total} fields
            </span>
          )}
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-slate-700/50">
          {/* Fields */}
          <div className="p-3 space-y-1">
            {displayFields?.map((field, idx) => (
              <FieldRow
                key={idx}
                field={field}
                depth={0}
                onCopy={copyFieldPath}
                copiedField={copiedField}
                compact={compact}
              />
            ))}
          </div>

          {/* Join Keys */}
          {store.joinKeys?.length > 0 && (
            <div className="px-3 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500">Join keys:</span>
                {store.joinKeys.map(key => (
                  <span key={key} className="px-2 py-0.5 text-xs font-mono bg-emerald-900/30 text-emerald-300 rounded border border-emerald-600/40">
                    {key}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Field Row Component
const FieldRow = ({ field, depth, onCopy, copiedField, compact }) => {
  const [expanded, setExpanded] = useState(depth < 1);

  const hasNested = field.type === 'object' && field.nested;
  const hasItems = field.type === 'array' && field.items;
  const isExpandable = hasNested || hasItems;

  const getLogicalKeyIcon = (key) => {
    const icons = {
      identity: Key,
      path: Route,
      archetype: Fingerprint,
      node: Box,
      data: Database,
      ancestors: GitBranch
    };
    return icons[key];
  };

  const getIndexBadge = (field) => {
    if (!field.indexed) return null;
    const colors = {
      btree: 'bg-blue-900/40 text-blue-300 border-blue-600/40',
      search: 'bg-purple-900/40 text-purple-300 border-purple-600/40',
      vector: 'bg-emerald-900/40 text-emerald-300 border-emerald-600/40'
    };
    return (
      <span className={`px-1.5 py-0.5 text-[10px] rounded border ${colors[field.indexType] || colors.btree}`}>
        {field.indexType || 'idx'}
      </span>
    );
  };

  // Workload hint badge styling
  const getWorkloadBadge = (hint) => {
    if (!hint) return null;
    const colors = {
      filter: 'bg-cyan-900/40 text-cyan-300 border-cyan-600/40',
      sort: 'bg-orange-900/40 text-orange-300 border-orange-600/40',
      lookup: 'bg-pink-900/40 text-pink-300 border-pink-600/40',
      aggregate: 'bg-indigo-900/40 text-indigo-300 border-indigo-600/40'
    };
    return (
      <span className={`px-1.5 py-0.5 text-[10px] rounded border ${colors[hint] || 'bg-slate-700 text-slate-400'}`}>
        {hint}
      </span>
    );
  };

  // Field-specific badge (like "code/terminology")
  const getFieldBadge = (badge) => {
    if (!badge) return null;
    return (
      <span className="px-1.5 py-0.5 text-[10px] bg-amber-900/40 text-amber-300 border border-amber-600/40 rounded">
        {badge}
      </span>
    );
  };

  const Icon = getLogicalKeyIcon(field.logicalKey);
  const paddingLeft = depth * 16;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 px-2 rounded hover:bg-slate-800/50 group"
        style={{ paddingLeft }}
      >
        {/* Expand toggle */}
        {isExpandable ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-300"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Logical key icon */}
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-500" />}

        {/* Field name */}
        <span className="font-mono text-xs text-slate-300">{field.name}</span>

        {/* Type badge */}
        <span className="px-1.5 py-0.5 text-[10px] bg-slate-700/50 text-slate-400 rounded">
          {field.type}
          {field.type === 'array' && '[]'}
        </span>

        {/* Index badge */}
        {getIndexBadge(field)}

        {/* Workload hint badge */}
        {getWorkloadBadge(field.workloadHint)}

        {/* Field-specific badge (code/terminology, etc.) */}
        {getFieldBadge(field.badge)}

        {/* Description (on hover) */}
        {!compact && field.description && (
          <span className="text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity truncate max-w-[200px]">
            {field.description}
          </span>
        )}

        {/* Copy button */}
        <button
          onClick={(e) => { e.stopPropagation(); onCopy(field.name); }}
          className="ml-auto opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700 rounded transition-all"
        >
          {copiedField === field.name ? (
            <span className="text-[10px] text-emerald-400">Copied!</span>
          ) : (
            <Copy className="w-3 h-3 text-slate-500" />
          )}
        </button>
      </div>

      {/* Nested fields */}
      {expanded && hasNested && (
        <div className="border-l border-slate-700/50 ml-4">
          {Object.entries(field.nested).map(([key, nestedField]) => (
            <FieldRow
              key={key}
              field={{ name: nestedField.name || key, ...nestedField }}
              depth={depth + 1}
              onCopy={onCopy}
              copiedField={copiedField}
              compact={compact}
            />
          ))}
        </div>
      )}

      {/* Array items */}
      {expanded && hasItems && field.items?.nested && (
        <div className="border-l border-slate-700/50 ml-4">
          <div className="py-1 px-2 text-[10px] text-slate-500" style={{ paddingLeft: paddingLeft + 16 }}>
            [ items ]
          </div>
          {Object.entries(field.items.nested).map(([key, nestedField]) => (
            <FieldRow
              key={key}
              field={{ name: nestedField.name || key, ...nestedField }}
              depth={depth + 1}
              onCopy={onCopy}
              copiedField={copiedField}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default CollectionDiagram;
