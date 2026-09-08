// src/components/views/strategyStudio/StrategyManager/components/SpecVisualization/TransformDAG.jsx
"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import dagre from 'dagre';
import {
  Layers, Database, Hash, Filter, Box, Search, AlertCircle,
  BookOpen, Play, ChevronRight
} from 'lucide-react';

/**
 * TransformDAG - Directed Acyclic Graph visualization of transform pipeline
 *
 * Features:
 * - DAG layout using dagre
 * - Node types: source, transform, sink, dictionary
 * - Clickable steps with detail panel
 * - Edge labels showing artifact names
 * - Group coloring by step type
 * - Uses visualization.transformGraph when available for rich node/edge definitions
 */
const TransformDAG = ({
  artifacts,
  pipeline,
  dictionaries,
  visualization,
  vizGraph,
  compact = false,
  onStepSelect,
  selectedStep
}) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [hoveredNode, setHoveredNode] = useState(null);

  // Calculate layout using dagre
  const layout = useMemo(() => {
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: vizGraph?.layout || visualization?.layout || 'LR',
      nodesep: compact ? 40 : 60,
      ranksep: compact ? 60 : 100,
      marginx: 20,
      marginy: 20
    });
    g.setDefaultEdgeLabel(() => ({}));

    // Build a node lookup from vizGraph nodes if available
    const vizNodeLookup = {};
    if (vizGraph?.nodes) {
      vizGraph.nodes.forEach(node => {
        vizNodeLookup[node.ref || node.id] = node;
      });
    }

    // Add artifact nodes
    artifacts.forEach(art => {
      const width = compact ? 120 : 160;
      const height = compact ? 40 : 50;
      const vizNode = vizNodeLookup[art.id];
      g.setNode(art.id, {
        width,
        height,
        ...art,
        name: vizNode?.label || art.name,
        icon: vizNode?.icon || art.icon,
        group: vizNode?.group || art.group,
        notes: vizNode?.notes,
        nodeType: 'artifact'
      });
    });

    // Add step nodes
    pipeline.forEach(step => {
      const width = compact ? 100 : 140;
      const height = compact ? 50 : 60;
      const vizNode = vizNodeLookup[step.id];
      g.setNode(step.id, {
        width,
        height,
        ...step,
        name: vizNode?.label || step.name,
        icon: vizNode?.icon || step.icon,
        group: vizNode?.group || step.group,
        notes: vizNode?.notes || step.notes,
        nodeType: 'step'
      });
    });

    // Add dictionary nodes
    dictionaries.forEach(dict => {
      const width = compact ? 100 : 120;
      const height = compact ? 40 : 50;
      const vizNode = vizNodeLookup[dict.id];
      g.setNode(dict.id, {
        width,
        height,
        ...dict,
        name: vizNode?.label || dict.name,
        nodeType: 'dictionary'
      });
    });

    // Use vizGraph edges if available, otherwise infer from pipeline
    if (vizGraph?.edges?.length > 0) {
      vizGraph.edges.forEach(edge => {
        if (g.hasNode(edge.from) && g.hasNode(edge.to)) {
          g.setEdge(edge.from, edge.to, {
            label: edge.artifactRef || '',
            style: edge.style || 'solid'
          });
        }
      });
    } else {
      // Add edges from pipeline
      pipeline.forEach(step => {
        // Input edges (artifact -> step)
        step.inputs?.forEach(inputId => {
          if (g.hasNode(inputId)) {
            g.setEdge(inputId, step.id, { label: '' });
          }
        });

        // Output edges (step -> artifact)
        step.outputs?.forEach(outputId => {
          if (g.hasNode(outputId)) {
            g.setEdge(step.id, outputId, { label: '' });
          }
        });
      });

      // Add dictionary edges (for encoding steps)
      pipeline.forEach(step => {
        if (step.type === 'normalize' || step.id.includes('encode')) {
          dictionaries.forEach(dict => {
            g.setEdge(dict.id, step.id, { label: '', style: 'dashed' });
          });
        }
      });
    }

    dagre.layout(g);

    // Extract positions
    const nodes = [];
    const edges = [];

    g.nodes().forEach(id => {
      const node = g.node(id);
      if (node) {
        nodes.push({ id, ...node });
      }
    });

    g.edges().forEach(e => {
      const edge = g.edge(e);
      const vizEdge = vizGraph?.edges?.find(ve => ve.from === e.v && ve.to === e.w);
      edges.push({
        from: e.v,
        to: e.w,
        points: edge.points,
        label: edge.label,
        style: vizEdge?.style || edge.style
      });
    });

    // Calculate bounds
    const bounds = nodes.reduce((acc, node) => ({
      minX: Math.min(acc.minX, node.x - node.width / 2),
      maxX: Math.max(acc.maxX, node.x + node.width / 2),
      minY: Math.min(acc.minY, node.y - node.height / 2),
      maxY: Math.max(acc.maxY, node.y + node.height / 2)
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

    return { nodes, edges, bounds };
  }, [artifacts, pipeline, dictionaries, visualization, vizGraph, compact]);

  // Update dimensions based on layout
  useEffect(() => {
    if (layout.bounds.maxX > -Infinity) {
      setDimensions({
        width: Math.max(layout.bounds.maxX + 40, 600),
        height: Math.max(layout.bounds.maxY + 40, 300)
      });
    }
  }, [layout]);

  const getNodeColors = (node) => {
    if (node.nodeType === 'dictionary') {
      return { bg: '#f59e0b20', border: '#f59e0b60', text: '#fbbf24' };
    }

    if (node.nodeType === 'artifact') {
      const colors = {
        source: { bg: '#3b82f620', border: '#3b82f660', text: '#60a5fa' },
        intermediate: { bg: '#8b5cf620', border: '#8b5cf660', text: '#a78bfa' },
        sink: { bg: '#10b98120', border: '#10b98160', text: '#34d399' }
      };
      return colors[node.type] || colors.intermediate;
    }

    // Step node - color by group
    const groupColors = visualization?.grouping || {
      extraction: { bg: '#3b82f620', border: '#3b82f660', text: '#60a5fa' },
      encoding: { bg: '#8b5cf620', border: '#8b5cf660', text: '#a78bfa' },
      projection: { bg: '#f59e0b20', border: '#f59e0b60', text: '#fbbf24' },
      storage: { bg: '#10b98120', border: '#10b98160', text: '#34d399' }
    };

    const group = node.group || 'extraction';
    return groupColors[group] || groupColors.extraction;
  };

  const getNodeIcon = (node) => {
    if (node.nodeType === 'dictionary') return BookOpen;
    if (node.nodeType === 'artifact') {
      return node.type === 'source' ? Play : node.type === 'sink' ? Database : Box;
    }

    const stepIcons = {
      flatten: Layers,
      normalize: Hash,
      validate: AlertCircle,
      project: Filter,
      vectorize: Box,
      materialize: Database
    };
    return stepIcons[node.type] || Box;
  };

  const handleNodeClick = (node) => {
    if (node.nodeType === 'step' && onStepSelect) {
      onStepSelect(selectedStep?.id === node.id ? null : node);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`bg-slate-900/40 rounded-xl border border-slate-700 overflow-auto ${
        compact ? 'max-h-[300px]' : 'max-h-[500px]'
      }`}
    >
      <svg
        width={dimensions.width}
        height={dimensions.height}
        className="min-w-full"
      >
        <defs>
          {/* Arrow marker */}
          <marker
            id="dag-arrow"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
          </marker>
          <marker
            id="dag-arrow-dashed"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
          </marker>

          {/* Drop shadow filter */}
          <filter id="node-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Edges */}
        <g className="edges">
          {layout.edges.map((edge, idx) => {
            const isDictEdge = dictionaries.some(d => d.id === edge.from);
            const isDashed = edge.style === 'dashed' || isDictEdge;
            const pathD = edge.points
              ? `M ${edge.points.map(p => `${p.x},${p.y}`).join(' L ')}`
              : '';

            return (
              <g key={idx}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={isDictEdge ? '#f59e0b60' : '#6b728080'}
                  strokeWidth="2"
                  strokeDasharray={isDashed ? '5,5' : undefined}
                  markerEnd={isDictEdge ? 'url(#dag-arrow-dashed)' : 'url(#dag-arrow)'}
                />
                {/* Edge label for artifact references */}
                {edge.label && !compact && edge.points?.length > 1 && (
                  <text
                    x={(edge.points[0].x + edge.points[edge.points.length - 1].x) / 2}
                    y={(edge.points[0].y + edge.points[edge.points.length - 1].y) / 2 - 8}
                    fill="#94a3b8"
                    fontSize="9"
                    textAnchor="middle"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {layout.nodes.map(node => {
            const colors = getNodeColors(node);
            const Icon = getNodeIcon(node);
            const isSelected = selectedStep?.id === node.id;
            const isHovered = hoveredNode === node.id;
            const isClickable = node.nodeType === 'step';

            return (
              <g
                key={node.id}
                transform={`translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`}
                onClick={() => handleNodeClick(node)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                style={{ cursor: isClickable ? 'pointer' : 'default' }}
              >
                {/* Node background */}
                <rect
                  width={node.width}
                  height={node.height}
                  rx="8"
                  fill={colors.bg}
                  stroke={isSelected ? colors.text : colors.border}
                  strokeWidth={isSelected ? 2 : 1}
                  filter={isHovered ? 'url(#node-shadow)' : undefined}
                />

                {/* Node content */}
                <foreignObject width={node.width} height={node.height}>
                  <div className="flex items-center justify-center h-full p-2 gap-2">
                    <Icon
                      className="flex-shrink-0"
                      style={{ color: colors.text, width: compact ? 14 : 18, height: compact ? 14 : 18 }}
                    />
                    <div className="min-w-0">
                      <p
                        className="font-medium truncate"
                        style={{ color: colors.text, fontSize: compact ? 10 : 12 }}
                      >
                        {node.name}
                      </p>
                      {!compact && node.type && node.nodeType === 'step' && (
                        <p className="text-[10px] text-slate-500 truncate">{node.type}</p>
                      )}
                    </div>
                    {isClickable && !compact && (
                      <ChevronRight
                        className="flex-shrink-0 text-slate-500"
                        style={{ width: 12, height: 12 }}
                      />
                    )}
                  </div>
                </foreignObject>

                {/* Store badge for sink artifacts */}
                {node.nodeType === 'artifact' && node.store && (
                  <g transform={`translate(${node.width - 24}, -8)`}>
                    <rect width="28" height="16" rx="4" fill="#10b981" />
                    <text
                      x="14"
                      y="12"
                      fill="white"
                      fontSize="8"
                      textAnchor="middle"
                    >
                      sink
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Legend */}
      {!compact && (
        <div className="p-3 border-t border-slate-700/50 flex items-center gap-4 flex-wrap">
          <span className="text-xs text-slate-500">Legend:</span>
          <LegendItem color="#3b82f6" label="Source / Extraction" />
          <LegendItem color="#8b5cf6" label="Transform / Encoding" />
          <LegendItem color="#f59e0b" label="Dictionary / Projection" />
          <LegendItem color="#10b981" label="Sink / Storage" />
        </div>
      )}
    </div>
  );
};

const LegendItem = ({ color, label }) => (
  <div className="flex items-center gap-1.5">
    <div className="w-3 h-3 rounded" style={{ backgroundColor: `${color}40`, border: `1px solid ${color}` }} />
    <span className="text-xs text-slate-400">{label}</span>
  </div>
);

export default TransformDAG;
