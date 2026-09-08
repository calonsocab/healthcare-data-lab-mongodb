// src/components/views/strategyStudio/StrategyManager/components/SpecVisualization/SchemaDiagram.jsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Database, Search, Link } from 'lucide-react';
import SchemaCard from './SchemaCard';

/**
 * SchemaDiagram - Side-by-side collection schema visualization with join lines
 *
 * Features:
 * - Multiple collection cards in a horizontal layout
 * - SVG join lines connecting related collections
 * - Role badges (canonical, projection)
 * - Join keys display
 * - Atlas Search indicator
 */
const SchemaDiagram = ({
  stores,
  joins,
  compact = false
}) => {
  const containerRef = useRef(null);
  const [expandedCards, setExpandedCards] = useState(() => {
    // Start with all cards expanded
    const initial = new Set();
    stores.forEach(store => initial.add(store.id));
    return initial;
  });
  const [cardPositions, setCardPositions] = useState({});

  // Calculate join line positions when cards change
  useEffect(() => {
    if (!containerRef.current || !joins?.length) return;

    const updatePositions = () => {
      const container = containerRef.current;
      const containerRect = container.getBoundingClientRect();
      const positions = {};

      stores.forEach(store => {
        const cardEl = container.querySelector(`[data-schema-id="${store.id}"]`);
        if (cardEl) {
          const rect = cardEl.getBoundingClientRect();
          positions[store.id] = {
            left: rect.left - containerRect.left,
            right: rect.right - containerRect.left,
            top: rect.top - containerRect.top,
            bottom: rect.bottom - containerRect.top,
            centerY: rect.top - containerRect.top + rect.height / 2
          };
        }
      });

      setCardPositions(positions);
    };

    // Update positions after render
    requestAnimationFrame(updatePositions);

    // Also update on resize
    window.addEventListener('resize', updatePositions);
    return () => window.removeEventListener('resize', updatePositions);
  }, [stores, joins, expandedCards]);

  const toggleCard = (storeId) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(storeId)) {
        next.delete(storeId);
      } else {
        next.add(storeId);
      }
      return next;
    });
  };

  // Role badge colors
  const getRoleStyle = (role) => {
    const styles = {
      canonical: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700',
      projection: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-700',
      dictionary: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700',
      index: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700'
    };
    return styles[role] || styles.canonical;
  };

  return (
    <div className="space-y-6">
      {/* Schema Cards Container */}
      <div
        ref={containerRef}
        className="relative"
      >
        {/* SVG for join lines */}
        <svg
          className="absolute inset-0 pointer-events-none z-10"
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          <defs>
            <marker
              id="schema-arrow"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#10b981" />
            </marker>
          </defs>

          {joins.map((join, idx) => {
            const fromPos = cardPositions[join.from];
            const toPos = cardPositions[join.to];

            if (!fromPos || !toPos) return null;

            // Draw curved line from right edge of "from" to left edge of "to"
            const startX = fromPos.right;
            const startY = fromPos.centerY;
            const endX = toPos.left;
            const endY = toPos.centerY;

            const midX = (startX + endX) / 2;

            const pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

            return (
              <g key={idx}>
                <path
                  d={pathD}
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  markerEnd="url(#schema-arrow)"
                />
                {/* Join key label */}
                <text
                  x={midX}
                  y={Math.min(startY, endY) - 8}
                  fill="#10b981"
                  fontSize="11"
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {join.key}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Cards Grid */}
        <div className={`grid gap-6 ${
          stores.length === 1 ? 'grid-cols-1' :
          stores.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
          'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        }`}>
          {stores.map(store => (
            <div
              key={store.id}
              data-schema-id={store.id}
              className="relative"
            >
              {/* Collection Header Card */}
              <div className="bg-slate-900 dark:bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-700">
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-slate-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-lg">
                          {store.name}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getRoleStyle(store.role)}`}>
                          {store.role}
                        </span>
                      </div>
                      {store.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{store.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {store.atlasSearch && (
                      <span className="flex items-center gap-1 px-2 py-1 text-xs bg-purple-900/40 text-purple-300 rounded border border-purple-700">
                        <Search className="w-3 h-3" />
                        Atlas
                      </span>
                    )}
                    <button
                      onClick={() => toggleCard(store.id)}
                      className="text-slate-400 hover:text-white"
                    >
                      {expandedCards.has(store.id) ? '−' : '+'}
                    </button>
                  </div>
                </div>

                {/* Schema Card */}
                {expandedCards.has(store.id) && store.fields?.length > 0 && (
                  <div className="p-4">
                    <SchemaCard
                      collection={store}
                      expanded={true}
                      showHeader={false}
                    />
                  </div>
                )}

                {/* Join Keys Footer */}
                {store.joinKeys?.length > 0 && (
                  <div className="px-4 py-3 border-t border-slate-700/50 bg-slate-800/30">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-500">Join keys:</span>
                      {store.joinKeys.map(key => (
                        <span
                          key={key}
                          className="px-2 py-0.5 text-xs font-mono bg-emerald-900/30 text-emerald-300 rounded border border-emerald-600/40"
                        >
                          {key}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Join Relationships */}
      {joins?.length > 0 && (
        <div className="bg-slate-900 dark:bg-slate-800 rounded-xl border border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Link className="w-4 h-4 text-emerald-400" />
            Join Relationships
          </h3>
          <div className="space-y-2">
            {joins.map((join, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 p-3 bg-slate-800/60 rounded-lg border border-slate-700"
              >
                <span className="px-3 py-1.5 text-sm font-mono bg-blue-900/30 text-blue-300 rounded border border-blue-600/40">
                  {join.from}
                </span>
                <div className="flex items-center gap-2 text-slate-500">
                  <span className="text-xs">{join.cardinality || join.type || 'one-to-one'}</span>
                  <span>→</span>
                </div>
                <span className="px-3 py-1.5 text-sm font-mono bg-purple-900/30 text-purple-300 rounded border border-purple-600/40">
                  {join.to}
                </span>
                <span className="ml-auto text-sm text-slate-400">
                  on: <span className="font-mono text-emerald-400">{join.key}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SchemaDiagram;
