"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  Hash,
  Type,
  ToggleLeft,
  Calendar,
  Box,
  List,
  Code,
  Gauge,
  Link2
} from 'lucide-react';

const NodeMindMap = ({ nodes, title = 'Structure Visualization' }) => {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [collapsedNodes, setCollapsedNodes] = useState(new Set());
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodePositions, setNodePositions] = useState({});
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Node sizing
  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 60;
  const HORIZONTAL_GAP = 80;
  const VERTICAL_GAP = 30;

  // Get root node
  const getRootNode = () => nodes.find(n => n.parentNodeId === null);

  // Get children of a node
  const getChildren = useCallback((nodeId) => {
    const parent = nodes.find(n => n.nodeId === nodeId);
    if (!parent) return [];
    return parent.childrenNodeIds
      .map(id => nodes.find(n => n.nodeId === id))
      .filter(Boolean);
  }, [nodes]);

  // Calculate tree layout
  const calculateLayout = useCallback(() => {
    const root = getRootNode();
    if (!root) return {};

    const positions = {};
    let maxY = 0;

    const calculateSubtree = (node, x, y, depth = 0) => {
      const isCollapsed = collapsedNodes.has(node.nodeId);
      const children = isCollapsed ? [] : getChildren(node.nodeId);

      if (children.length === 0) {
        // Leaf node
        positions[node.nodeId] = { x, y, depth };
        maxY = Math.max(maxY, y);
        return y + NODE_HEIGHT + VERTICAL_GAP;
      }

      // Node with children
      const childX = x + NODE_WIDTH + HORIZONTAL_GAP;
      let currentY = y;
      const childYs = [];

      children.forEach(child => {
        childYs.push(currentY + NODE_HEIGHT / 2);
        currentY = calculateSubtree(child, childX, currentY, depth + 1);
      });

      // Position parent in the middle of its children
      const firstChildCenter = childYs[0];
      const lastChildCenter = childYs[childYs.length - 1];
      const parentY = (firstChildCenter + lastChildCenter) / 2 - NODE_HEIGHT / 2;

      positions[node.nodeId] = { x, y: parentY, depth };

      return currentY;
    };

    calculateSubtree(root, 50, 50);

    return positions;
  }, [nodes, collapsedNodes, getChildren]);

  // Update layout when nodes or collapsed state changes
  useEffect(() => {
    const positions = calculateLayout();
    setNodePositions(positions);

    // Calculate content bounds for centering
    if (Object.keys(positions).length > 0) {
      const xs = Object.values(positions).map(p => p.x);
      const ys = Object.values(positions).map(p => p.y);
      const maxX = Math.max(...xs) + NODE_WIDTH + 100;
      const maxY = Math.max(...ys) + NODE_HEIGHT + 100;
      setDimensions({ width: maxX, height: maxY });
    }
  }, [calculateLayout]);

  // Update container size
  useEffect(() => {
    if (containerRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        // Could adjust zoom based on container size
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  // Generate curved path between nodes
  const generateCurvedPath = (startX, startY, endX, endY) => {
    const controlPointOffset = (endX - startX) * 0.5;
    return `M ${startX} ${startY} C ${startX + controlPointOffset} ${startY}, ${endX - controlPointOffset} ${endY}, ${endX} ${endY}`;
  };

  // Get icon for data type
  const getDataTypeIcon = (dataType) => {
    switch (dataType) {
      case 'string': return <Type size={14} />;
      case 'number': return <Hash size={14} />;
      case 'boolean': return <ToggleLeft size={14} />;
      case 'date': return <Calendar size={14} />;
      case 'time': return <Calendar size={14} />;
      case 'datetime': return <Calendar size={14} />;
      case 'object': return <Box size={14} />;
      case 'array': return <List size={14} />;
      case 'code': return <Code size={14} />;
      case 'coded_text': return <Code size={14} />;
      case 'identifier': return <Code size={14} />;
      case 'quantity': return <Gauge size={14} />;
      case 'reference': return <Link2 size={14} />;
      case 'uri': return <Link2 size={14} />;
      case 'duration': return <Type size={14} />;
      case 'interval': return <List size={14} />;
      default: return <Box size={14} />;
    }
  };

  // Get color for data type
  const getDataTypeColor = (dataType) => {
    switch (dataType) {
      case 'string': return 'border-green-500 bg-green-500/10';
      case 'number': return 'border-blue-500 bg-blue-500/10';
      case 'boolean': return 'border-yellow-500 bg-yellow-500/10';
      case 'date': return 'border-purple-500 bg-purple-500/10';
      case 'time': return 'border-violet-500 bg-violet-500/10';
      case 'datetime': return 'border-violet-500 bg-violet-500/10';
      case 'object': return 'border-orange-500 bg-orange-500/10';
      case 'array': return 'border-pink-500 bg-pink-500/10';
      case 'code': return 'border-cyan-500 bg-cyan-500/10';
      case 'coded_text': return 'border-cyan-400 bg-cyan-400/10';
      case 'identifier': return 'border-red-400 bg-red-400/10';
      case 'quantity': return 'border-indigo-500 bg-indigo-500/10';
      case 'reference': return 'border-red-500 bg-red-500/10';
      case 'uri': return 'border-emerald-500 bg-emerald-500/10';
      case 'duration': return 'border-fuchsia-500 bg-fuchsia-500/10';
      case 'interval': return 'border-amber-500 bg-amber-500/10';
      default: return 'border-slate-500 bg-slate-500/10';
    }
  };

  // Toggle node collapse
  const toggleCollapse = (nodeId) => {
    setCollapsedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.3));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCollapsedNodes(new Set());
  };

  // Pan handling
  const handleMouseDown = (e) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Render connections
  const renderConnections = () => {
    const connections = [];

    nodes.forEach(node => {
      if (collapsedNodes.has(node.nodeId)) return;

      const parentPos = nodePositions[node.nodeId];
      if (!parentPos) return;

      const children = getChildren(node.nodeId);
      children.forEach(child => {
        const childPos = nodePositions[child.nodeId];
        if (!childPos) return;

        const startX = parentPos.x + NODE_WIDTH;
        const startY = parentPos.y + NODE_HEIGHT / 2;
        const endX = childPos.x;
        const endY = childPos.y + NODE_HEIGHT / 2;

        connections.push(
          <path
            key={`${node.nodeId}-${child.nodeId}`}
            d={generateCurvedPath(startX, startY, endX, endY)}
            stroke="rgba(100, 116, 139, 0.5)"
            strokeWidth="2"
            fill="none"
          />
        );
      });
    });

    return connections;
  };

  // Render a single node
  const renderNode = (node) => {
    const pos = nodePositions[node.nodeId];
    if (!pos) return null;

    const isRoot = node.parentNodeId === null;
    const isCollapsed = collapsedNodes.has(node.nodeId);
    const hasChildren = node.childrenNodeIds.length > 0;
    const isSelected = selectedNode === node.nodeId;
    const isRequired = node.occurrences.min > 0;

    return (
      <div
        key={node.nodeId}
        className={`absolute transition-all duration-200 ${isDragging ? '' : 'transition-transform'}`}
        style={{
          left: pos.x,
          top: pos.y,
          width: NODE_WIDTH,
          minHeight: NODE_HEIGHT
        }}
      >
        <div
          className={`
            relative rounded-lg border-2 p-3 cursor-pointer
            ${getDataTypeColor(node.dataType)}
            ${isRoot ? 'ring-2 ring-primary/50' : ''}
            ${isSelected ? 'ring-2 ring-primary shadow-lg' : 'hover:shadow-md'}
            transition-all duration-200
          `}
          onClick={() => setSelectedNode(node.nodeId === selectedNode ? null : node.nodeId)}
        >
          {/* Collapse button */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse(node.nodeId);
              }}
              className="absolute -right-3 top-1/2 -translate-y-1/2 p-1 bg-surface border border-theme rounded-full hover:bg-primary/20 transition-colors z-10"
            >
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
          )}

          {/* Node content */}
          <div className="flex items-start gap-2">
            <div className="p-1.5 bg-surface rounded">
              {getDataTypeIcon(node.dataType)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-theme-primary truncate">
                  {node.name}
                </span>
                {isRequired && (
                  <span className="text-error text-xs">*</span>
                )}
              </div>
              <div className="text-xs text-theme-secondary font-mono truncate">
                {node.attribute}
              </div>
            </div>
          </div>

          {/* Type badge */}
          <div className="absolute bottom-1 right-1">
            <span className="text-[10px] font-mono text-theme-secondary opacity-70">
              {node.dataType}
            </span>
          </div>

          {/* Collapsed indicator */}
          {isCollapsed && hasChildren && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-theme-secondary bg-surface px-1 rounded">
              +{node.childrenNodeIds.length}
            </div>
          )}
        </div>
      </div>
    );
  };

  const root = getRootNode();

  if (!root || nodes.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-theme-secondary">
        <div className="text-center">
          <Box size={48} className="mx-auto mb-2 opacity-50" />
          <p>No structure to visualize</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-theme bg-surface">
        <div className="text-sm font-medium text-theme-primary">{title}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-1.5 text-theme-secondary hover:text-theme-primary hover:bg-background rounded transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-theme-secondary min-w-[50px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-1.5 text-theme-secondary hover:text-theme-primary hover:bg-background rounded transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
          <div className="w-px h-4 bg-theme mx-1" />
          <button
            onClick={handleReset}
            className="p-1.5 text-theme-secondary hover:text-theme-primary hover:bg-background rounded transition-colors"
            title="Reset view"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden bg-background"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div
          className="absolute origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            width: dimensions.width,
            height: dimensions.height
          }}
        >
          {/* SVG layer for connections */}
          <svg
            ref={svgRef}
            className="absolute top-0 left-0 pointer-events-none"
            width={dimensions.width}
            height={dimensions.height}
          >
            {renderConnections()}
          </svg>

          {/* Nodes layer */}
          {nodes.map(node => renderNode(node))}
        </div>
      </div>

      {/* Node info panel */}
      {selectedNode && (
        <div className="p-3 border-t border-theme bg-surface">
          {(() => {
            const node = nodes.find(n => n.nodeId === selectedNode);
            if (!node) return null;
            return (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-theme-secondary">Name:</span>
                  <span className="ml-2 text-theme-primary">{node.name}</span>
                </div>
                <div>
                  <span className="text-theme-secondary">Type:</span>
                  <span className="ml-2 text-theme-primary">{node.dataType}</span>
                </div>
                <div>
                  <span className="text-theme-secondary">Attribute:</span>
                  <span className="ml-2 text-theme-primary font-mono text-xs">{node.attribute}</span>
                </div>
                <div>
                  <span className="text-theme-secondary">Required:</span>
                  <span className="ml-2 text-theme-primary">{node.occurrences.min > 0 ? 'Yes' : 'No'}</span>
                </div>
                {node.description && (
                  <div className="col-span-2">
                    <span className="text-theme-secondary">Description:</span>
                    <span className="ml-2 text-theme-primary">{node.description}</span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default NodeMindMap;
