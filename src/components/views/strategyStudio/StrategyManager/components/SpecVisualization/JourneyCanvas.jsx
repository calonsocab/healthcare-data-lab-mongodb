// src/components/views/strategyStudio/StrategyManager/components/SpecVisualization/JourneyCanvas.jsx
"use client";

import React, { useMemo, useState } from 'react';
import {
  FileJson, Layers, Database, Filter, Box, Search
} from 'lucide-react';

/**
 * JourneyCanvas - Renders the transformGraph from pack_spec.visualization
 *
 * Uses the graph directly from the spec - no reconstruction needed.
 * The spec defines:
 * - nodes: [{ id, kind, label, typeRef?, stepRef?, entityRef? }]
 * - edges: [{ from, to }]
 */
const JourneyCanvas = ({
  data,
  selectedNode,
  onNodeSelect,
  encodingProfile
}) => {
  const [hoveredNode, setHoveredNode] = useState(null);

  // Get transform graph directly from viz data
  const transformGraph = data.transformGraph;

  // Calculate layout positions
  const layout = useMemo(() => {
    if (!transformGraph?.nodes?.length) {
      return { nodes: [], edges: [], width: 600, height: 300 };
    }

    const padding = 40;
    const nodeWidth = 180;
    const nodeHeight = 50;
    const horizontalGap = 80;
    const verticalGap = 30;

    // Group nodes by kind for column layout
    const sources = transformGraph.nodes.filter(n => n.kind === 'source');
    const transforms = transformGraph.nodes.filter(n => n.kind === 'transform');
    const sinks = transformGraph.nodes.filter(n => n.kind === 'sink');

    // Calculate positions (3-column layout)
    const positionedNodes = [];
    const nodePositions = {};

    // Column 1: Sources
    sources.forEach((node, i) => {
      const pos = {
        x: padding,
        y: padding + i * (nodeHeight + verticalGap)
      };
      nodePositions[node.id] = pos;
      positionedNodes.push({
        ...node,
        nodeType: 'source',
        ...pos,
        width: nodeWidth,
        height: nodeHeight
      });
    });

    // Column 2: Transforms
    transforms.forEach((node, i) => {
      const pos = {
        x: padding + nodeWidth + horizontalGap,
        y: padding + i * (nodeHeight + verticalGap)
      };
      nodePositions[node.id] = pos;
      positionedNodes.push({
        ...node,
        nodeType: 'transform',
        ...pos,
        width: nodeWidth,
        height: nodeHeight
      });
    });

    // Column 3: Sinks
    sinks.forEach((node, i) => {
      const pos = {
        x: padding + (nodeWidth + horizontalGap) * 2,
        y: padding + i * (nodeHeight + verticalGap)
      };
      nodePositions[node.id] = pos;
      positionedNodes.push({
        ...node,
        nodeType: 'store',
        ...pos,
        width: nodeWidth,
        height: nodeHeight
      });
    });

    // Calculate edges with positions
    const edges = (transformGraph.edges || []).map(edge => {
      const fromPos = nodePositions[edge.from];
      const toPos = nodePositions[edge.to];
      return {
        ...edge,
        fromPos,
        toPos
      };
    }).filter(e => e.fromPos && e.toPos);

    // Calculate canvas size
    const maxX = Math.max(...positionedNodes.map(n => n.x + n.width), 600);
    const maxY = Math.max(...positionedNodes.map(n => n.y + n.height), 200);

    return {
      nodes: positionedNodes,
      edges,
      nodePositions,
      width: maxX + padding,
      height: maxY + padding
    };
  }, [transformGraph]);

  // Node colors based on kind
  const getNodeColors = (node) => {
    const isSelected = selectedNode?.id === node.id;
    const isHovered = hoveredNode === node.id;

    const colorMap = {
      source: {
        bg: '#3b82f620',
        border: isSelected ? '#3b82f6' : '#3b82f660',
        text: '#60a5fa',
        label: '#93c5fd'
      },
      transform: {
        bg: '#8b5cf620',
        border: isSelected ? '#8b5cf6' : '#8b5cf660',
        text: '#a78bfa',
        label: '#c4b5fd'
      },
      store: {
        bg: '#10b98120',
        border: isSelected ? '#10b981' : '#10b98160',
        text: '#34d399',
        label: '#6ee7b7'
      }
    };

    return {
      ...(colorMap[node.nodeType] || colorMap.transform),
      strokeWidth: isSelected ? 2 : (isHovered ? 1.5 : 1)
    };
  };

  const getIcon = (node) => {
    switch (node.kind) {
      case 'source': return FileJson;
      case 'transform': return node.label?.toLowerCase().includes('project') ? Filter : Layers;
      case 'sink': return node.entityRef?.includes('search') ? Search : Database;
      default: return Box;
    }
  };

  const renderEdge = (edge, idx) => {
    if (!edge.fromPos || !edge.toPos) return null;

    const startX = edge.fromPos.x + layout.nodes.find(n => n.id === edge.from)?.width || 0;
    const startY = edge.fromPos.y + 25; // Center of node
    const endX = edge.toPos.x;
    const endY = edge.toPos.y + 25;

    // Bezier curve
    const midX = (startX + endX) / 2;
    const pathD = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

    return (
      <path
        key={idx}
        d={pathD}
        fill="none"
        stroke="#6b728060"
        strokeWidth={1.5}
        markerEnd="url(#arrow)"
      />
    );
  };

  const renderNode = (node) => {
    const colors = getNodeColors(node);
    const Icon = getIcon(node);
    const isSelected = selectedNode?.id === node.id;

    return (
      <g
        key={node.id}
        transform={`translate(${node.x}, ${node.y})`}
        onClick={() => onNodeSelect(node)}
        onMouseEnter={() => setHoveredNode(node.id)}
        onMouseLeave={() => setHoveredNode(null)}
        style={{ cursor: 'pointer' }}
      >
        {/* Node background */}
        <rect
          width={node.width}
          height={node.height}
          rx="8"
          fill={colors.bg}
          stroke={colors.border}
          strokeWidth={colors.strokeWidth}
        />

        {/* Node content */}
        <foreignObject width={node.width} height={node.height}>
          <div className="flex items-center h-full px-3 gap-2">
            <Icon
              className="flex-shrink-0"
              style={{ color: colors.text, width: 18, height: 18 }}
            />
            <div className="min-w-0 flex-1">
              <p
                className="font-medium truncate text-sm"
                style={{ color: colors.label }}
              >
                {node.label}
              </p>
              <p className="text-[10px] truncate" style={{ color: colors.text }}>
                {node.kind}
              </p>
            </div>
          </div>
        </foreignObject>

        {/* Selection indicator */}
        {isSelected && (
          <rect
            x="-3"
            y="-3"
            width={node.width + 6}
            height={node.height + 6}
            rx="10"
            fill="none"
            stroke={colors.border}
            strokeWidth="1"
            strokeDasharray="4,2"
            opacity="0.5"
          />
        )}
      </g>
    );
  };

  // Empty state
  if (layout.nodes.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center p-8">
        <p className="text-sm text-slate-500">
          No transformGraph defined in spec.visualization
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto">
      <svg
        width={layout.width}
        height={layout.height}
        className="min-w-full"
      >
        <defs>
          <marker
            id="arrow"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
          </marker>
        </defs>

        {/* Column labels */}
        <text x={layout.nodes.find(n => n.kind === 'source')?.x + 90 || 130} y="20"
              fill="#64748b" fontSize="11" textAnchor="middle" fontWeight="500">
          SOURCE
        </text>
        <text x={layout.nodes.find(n => n.kind === 'transform')?.x + 90 || 350} y="20"
              fill="#64748b" fontSize="11" textAnchor="middle" fontWeight="500">
          TRANSFORM
        </text>
        <text x={layout.nodes.find(n => n.kind === 'sink')?.x + 90 || 570} y="20"
              fill="#64748b" fontSize="11" textAnchor="middle" fontWeight="500">
          SINK
        </text>

        {/* Edges */}
        <g className="edges">
          {layout.edges.map((edge, idx) => renderEdge(edge, idx))}
        </g>

        {/* Nodes */}
        <g className="nodes">
          {layout.nodes.map(node => renderNode(node))}
        </g>
      </svg>
    </div>
  );
};

export default JourneyCanvas;
