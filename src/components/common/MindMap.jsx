// src/components/common/MindMap.jsx
"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronDown, Plus, Minus, ZoomIn, ZoomOut, Maximize2, PanelRightClose, PanelRightOpen } from 'lucide-react';

// Node type icons/badges based on data type
const getNodeTypeInfo = (node) => {
  if (!node) return { badge: '', color: 'slate' };

  const rmType = (node.rmType || '').toLowerCase();

  // openEHR specific types
  if (rmType.includes('composition')) return { badge: 'C', color: 'blue', label: 'Composition' };
  if (rmType.includes('section')) return { badge: 'S', color: 'purple', label: 'Section' };
  if (rmType.includes('cluster')) return { badge: 'CL', color: 'indigo', label: 'Cluster' };
  if (rmType.includes('observation')) return { badge: 'O', color: 'green', label: 'Observation' };
  if (rmType.includes('evaluation')) return { badge: 'E', color: 'cyan', label: 'Evaluation' };
  if (rmType.includes('instruction')) return { badge: 'I', color: 'amber', label: 'Instruction' };
  if (rmType.includes('action')) return { badge: 'A', color: 'emerald', label: 'Action' };
  if (rmType.includes('admin')) return { badge: 'AD', color: 'red', label: 'Admin' };
  if (rmType.includes('event')) return { badge: 'Ev', color: 'violet', label: 'Event' };
  if (rmType.includes('interval_event')) return { badge: '⊢', color: 'violet', label: 'Interval Event' };
  if (rmType.includes('point_event')) return { badge: '•', color: 'violet', label: 'Point Event' };
  if (rmType.includes('history')) return { badge: 'H', color: 'fuchsia', label: 'History' };
  if (rmType.includes('item_tree')) return { badge: 'IT', color: 'sky', label: 'Item Tree' };
  if (rmType.includes('item_list')) return { badge: 'IL', color: 'sky', label: 'Item List' };
  if (rmType.includes('element')) return { badge: 'El', color: 'slate', label: 'Element' };

  // Data value types
  if (rmType.includes('dv_quantity')) return { badge: 'Q', color: 'orange', label: 'Quantity' };
  if (rmType.includes('dv_coded_text')) return { badge: 'CT', color: 'teal', label: 'Coded Text' };
  if (rmType.includes('dv_text')) return { badge: 'T', color: 'gray', label: 'Text' };
  if (rmType.includes('dv_count')) return { badge: '#', color: 'orange', label: 'Count' };
  if (rmType.includes('dv_date_time')) return { badge: 'DT', color: 'pink', label: 'DateTime' };
  if (rmType.includes('dv_date')) return { badge: 'D', color: 'pink', label: 'Date' };
  if (rmType.includes('dv_time')) return { badge: 'Ti', color: 'pink', label: 'Time' };
  if (rmType.includes('dv_boolean')) return { badge: '?', color: 'yellow', label: 'Boolean' };
  if (rmType.includes('dv_ordinal')) return { badge: 'Or', color: 'lime', label: 'Ordinal' };
  if (rmType.includes('dv_duration')) return { badge: 'Du', color: 'rose', label: 'Duration' };
  if (rmType.includes('dv_identifier')) return { badge: 'ID', color: 'zinc', label: 'Identifier' };
  if (rmType.includes('dv_uri')) return { badge: 'U', color: 'blue', label: 'URI' };
  if (rmType.includes('dv_multimedia')) return { badge: 'M', color: 'purple', label: 'Multimedia' };
  if (rmType.includes('dv_parsable')) return { badge: 'P', color: 'slate', label: 'Parsable' };

  // Generic object/array detection
  if (Array.isArray(node)) return { badge: '[]', color: 'blue', label: 'Array' };
  if (typeof node === 'object') return { badge: '{}', color: 'slate', label: 'Object' };

  return { badge: '', color: 'slate', label: 'Node' };
};

const getColorClasses = (color) => {
  const colors = {
    blue: 'bg-blue-500/20 text-blue-400 border-blue-400',
    green: 'bg-green-500/20 text-green-400 border-green-400',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-400',
    indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-400',
    cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-400',
    amber: 'bg-amber-500/20 text-amber-400 border-amber-400',
    emerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-400',
    red: 'bg-red-500/20 text-red-400 border-red-400',
    violet: 'bg-violet-500/20 text-violet-400 border-violet-400',
    fuchsia: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-400',
    sky: 'bg-sky-500/20 text-sky-400 border-sky-400',
    orange: 'bg-orange-500/20 text-orange-400 border-orange-400',
    teal: 'bg-teal-500/20 text-teal-400 border-teal-400',
    gray: 'bg-gray-500/20 text-gray-400 border-gray-400',
    pink: 'bg-pink-500/20 text-pink-400 border-pink-400',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-400',
    lime: 'bg-lime-500/20 text-lime-400 border-lime-400',
    rose: 'bg-rose-500/20 text-rose-400 border-rose-400',
    zinc: 'bg-zinc-500/20 text-zinc-400 border-zinc-400',
    slate: 'bg-slate-500/20 text-slate-400 border-slate-400',
  };
  return colors[color] || colors.slate;
};

const getStrokeColor = (color) => {
  const colors = {
    blue: '#3b82f6',
    green: '#22c55e',
    purple: '#a855f7',
    indigo: '#6366f1',
    cyan: '#06b6d4',
    amber: '#f59e0b',
    emerald: '#10b981',
    red: '#ef4444',
    violet: '#8b5cf6',
    fuchsia: '#d946ef',
    sky: '#0ea5e9',
    orange: '#f97316',
    teal: '#14b8a6',
    gray: '#6b7280',
    pink: '#ec4899',
    yellow: '#eab308',
    lime: '#84cc16',
    rose: '#f43f5e',
    zinc: '#71717a',
    slate: '#64748b',
  };
  return colors[color] || colors.slate;
};

// Convert any structured data to a tree format
const normalizeToTree = (data, key = 'root') => {
  if (!data) return null;

  // For openEHR webTemplate
  if (data.tree) {
    return normalizeToTree(data.tree, data.templateId || key);
  }

  // Already has children structure (openEHR nodes)
  if (data.children || data.nodeId) {
    return {
      id: data.nodeId || data.id || key,
      name: data.localizedNames?.en || data.name || data.localizedName || key,
      description: data.localizedDescriptions?.en || data.description || '',
      rmType: data.rmType || '',
      min: data.min,
      max: data.max,
      aqlPath: data.aqlPath || '',
      children: (data.children || []).map((child, i) =>
        normalizeToTree(child, `${key}-${i}`)
      ).filter(Boolean)
    };
  }

  // Generic object/array
  if (Array.isArray(data)) {
    return {
      id: key,
      name: key,
      rmType: 'array',
      children: data.map((item, i) => normalizeToTree(item, `[${i}]`)).filter(Boolean)
    };
  }

  if (typeof data === 'object' && data !== null) {
    const children = Object.entries(data)
      .filter(([k, v]) => typeof v === 'object' && v !== null)
      .map(([k, v]) => normalizeToTree(v, k))
      .filter(Boolean);

    return {
      id: key,
      name: key,
      rmType: 'object',
      children,
      properties: Object.entries(data)
        .filter(([k, v]) => typeof v !== 'object' || v === null)
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})
    };
  }

  return null;
};

// Calculate tree layout positions
const calculateLayout = (node, expandedNodes, x = 0, y = 0, level = 0, nodePositions = new Map()) => {
  const NODE_WIDTH = 220;
  const NODE_HEIGHT = 36;
  const HORIZONTAL_SPACING = 280;
  const VERTICAL_SPACING = 50;

  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children && node.children.length > 0 && isExpanded;

  // Store current node position
  nodePositions.set(node.id, { x, y, width: NODE_WIDTH, height: NODE_HEIGHT });

  let totalHeight = NODE_HEIGHT;

  if (hasChildren) {
    let childY = y;
    const childX = x + HORIZONTAL_SPACING;

    node.children.forEach((child, index) => {
      const childLayout = calculateLayout(child, expandedNodes, childX, childY, level + 1, nodePositions);
      childY += childLayout.totalHeight + VERTICAL_SPACING;
    });

    // Adjust total height
    totalHeight = childY - y - VERTICAL_SPACING;

    // Center parent vertically relative to children
    if (node.children.length > 1) {
      const firstChildPos = nodePositions.get(node.children[0].id);
      const lastChildPos = nodePositions.get(node.children[node.children.length - 1].id);
      const centerY = (firstChildPos.y + lastChildPos.y) / 2;
      nodePositions.set(node.id, { x, y: centerY, width: NODE_WIDTH, height: NODE_HEIGHT });
    }
  }

  return { totalHeight, nodePositions };
};

// Curved path generator for connections
const generateCurvedPath = (startX, startY, endX, endY) => {
  const controlPointOffset = (endX - startX) * 0.5;
  return `M ${startX} ${startY} C ${startX + controlPointOffset} ${startY}, ${endX - controlPointOffset} ${endY}, ${endX} ${endY}`;
};

// SVG Connections Layer
const ConnectionsLayer = ({ tree, expandedNodes, nodePositions }) => {
  const paths = [];

  const generateConnections = (node) => {
    if (!node || !expandedNodes.has(node.id)) return;

    const parentPos = nodePositions.get(node.id);
    if (!parentPos) return;

    const hasVisibleChildren = node.children && node.children.length > 0 && expandedNodes.has(node.id);

    if (hasVisibleChildren) {
      node.children.forEach((child) => {
        const childPos = nodePositions.get(child.id);
        if (childPos) {
          const startX = parentPos.x + parentPos.width;
          const startY = parentPos.y + parentPos.height / 2;
          const endX = childPos.x;
          const endY = childPos.y + childPos.height / 2;

          const childTypeInfo = getNodeTypeInfo(child);
          const strokeColor = getStrokeColor(childTypeInfo.color);

          paths.push(
            <path
              key={`${node.id}-${child.id}`}
              d={generateCurvedPath(startX, startY, endX, endY)}
              fill="none"
              stroke={strokeColor}
              strokeWidth="2"
              strokeOpacity="0.6"
              markerEnd="url(#arrowhead)"
            />
          );
        }
        generateConnections(child);
      });
    }
  };

  generateConnections(tree);

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3.5, 0 7"
            fill="#64748b"
            fillOpacity="0.8"
          />
        </marker>
      </defs>
      {paths}
    </svg>
  );
};

// Individual Tree Node Component
const TreeNode = ({
  node,
  expandedNodes,
  onToggle,
  onNodeClick,
  selectedNode,
  nodePositions,
}) => {
  const pos = nodePositions.get(node.id);
  if (!pos) return null;

  const typeInfo = getNodeTypeInfo(node);
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedNode?.id === node.id;

  const childNodes = hasChildren && isExpanded ? (
    node.children.map((child) => (
      <TreeNode
        key={child.id}
        node={child}
        expandedNodes={expandedNodes}
        onToggle={onToggle}
        onNodeClick={onNodeClick}
        selectedNode={selectedNode}
        nodePositions={nodePositions}
      />
    ))
  ) : null;

  return (
    <>
      <div
        className={`
          absolute flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer
          transition-all duration-200 hover:shadow-lg hover:scale-105
          ${isSelected
            ? 'ring-4 ring-primary/50 border-primary shadow-lg shadow-primary/20'
            : 'border-theme hover:border-theme-secondary'}
          bg-surface/90 backdrop-blur-sm
        `}
        style={{
          left: pos.x,
          top: pos.y,
          width: pos.width,
          height: pos.height,
        }}
        onClick={() => onNodeClick?.(node)}
      >
        {/* Expand/Collapse button */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className={`
              flex-shrink-0 w-5 h-5 flex items-center justify-center rounded
              bg-surface-hover hover:bg-surface text-theme-secondary hover:text-white
              transition-colors duration-150
            `}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}

        {/* Spacer when no children */}
        {!hasChildren && <div className="w-5 flex-shrink-0" />}

        {/* Type badge */}
        {typeInfo.badge && (
          <span className={`
            flex-shrink-0 inline-flex items-center justify-center w-6 h-6 text-[10px] font-bold rounded border
            ${getColorClasses(typeInfo.color)}
          `}>
            {typeInfo.badge}
          </span>
        )}

        {/* Node name */}
        <span className="text-sm text-theme-primary truncate flex-1" title={node.name}>
          {node.name}
        </span>

        {/* Children count indicator */}
        {hasChildren && !isExpanded && (
          <span className="flex-shrink-0 text-[10px] text-theme-secondary bg-surface-hover px-1.5 py-0.5 rounded-full">
            {node.children.length}
          </span>
        )}
      </div>
      {childNodes}
    </>
  );
};

// Main MindMap Component
const MindMap = ({ data, title = 'Mind Map', onNodeSelect }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [selectedNode, setSelectedNode] = useState(null);
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollPos, setScrollPos] = useState({ x: 0, y: 0 });
  const [nodePositions, setNodePositions] = useState(new Map());
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const tree = useMemo(() => normalizeToTree(data), [data]);

  // Initialize with root expanded
  useEffect(() => {
    if (tree) {
      setExpandedNodes(new Set([tree.id]));
    }
  }, [tree]);

  // Recalculate layout when expanded nodes change
  useEffect(() => {
    if (tree) {
      const { nodePositions: newPositions } = calculateLayout(tree, expandedNodes, 50, 50);
      setNodePositions(newPositions);
    }
  }, [tree, expandedNodes]);

  const toggleNode = useCallback((nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allIds = new Set();
    const collectIds = (node) => {
      if (!node) return;
      allIds.add(node.id);
      (node.children || []).forEach(collectIds);
    };
    collectIds(tree);
    setExpandedNodes(allIds);
  }, [tree]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set([tree?.id || 'root']));
  }, [tree]);

  const expandToLevel = useCallback((maxLevel) => {
    const idsToExpand = new Set();
    const collect = (node, level) => {
      if (!node || level > maxLevel) return;
      idsToExpand.add(node.id);
      if (level < maxLevel) {
        (node.children || []).forEach(child => collect(child, level + 1));
      }
    };
    collect(tree, 0);
    setExpandedNodes(idsToExpand);
  }, [tree]);

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(node);
    onNodeSelect?.(node);
  }, [onNodeSelect]);

  const resetView = useCallback(() => {
    setZoom(1);
    if (containerRef.current) {
      containerRef.current.scrollLeft = 0;
      containerRef.current.scrollTop = 0;
    }
  }, []);

  // Pan functionality
  const handleMouseDown = (e) => {
    if (e.button === 0 && !e.target.closest('button')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setScrollPos({
        x: containerRef.current.scrollLeft,
        y: containerRef.current.scrollTop
      });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    containerRef.current.scrollLeft = scrollPos.x - dx;
    containerRef.current.scrollTop = scrollPos.y - dy;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Calculate canvas size based on node positions
  const canvasSize = useMemo(() => {
    let maxX = 800;
    let maxY = 600;
    nodePositions.forEach((pos) => {
      maxX = Math.max(maxX, pos.x + pos.width + 100);
      maxY = Math.max(maxY, pos.y + pos.height + 100);
    });
    return { width: maxX, height: maxY };
  }, [nodePositions]);

  if (!tree) {
    return (
      <div className="flex items-center justify-center h-64 text-theme-secondary">
        No data to display
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background rounded-lg">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-theme">
        <h3 className="text-sm font-medium text-white">{title}</h3>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button
            onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}
            className="p-1.5 text-theme-secondary hover:text-white hover:bg-surface-hover rounded transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={16} />
          </button>
          <span className="text-xs text-theme-secondary w-14 text-center font-mono">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(z => Math.min(2, z + 0.1))}
            className="p-1.5 text-theme-secondary hover:text-white hover:bg-surface-hover rounded transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 text-theme-secondary hover:text-white hover:bg-surface-hover rounded transition-colors"
            title="Reset view"
          >
            <Maximize2 size={16} />
          </button>

          <div className="w-px h-4 bg-theme mx-1" />

          {/* Expand controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => expandToLevel(1)}
              className="px-2 py-1 text-xs text-theme-secondary hover:text-white hover:bg-surface-hover rounded transition-colors"
              title="Expand to level 1"
            >
              L1
            </button>
            <button
              onClick={() => expandToLevel(2)}
              className="px-2 py-1 text-xs text-theme-secondary hover:text-white hover:bg-surface-hover rounded transition-colors"
              title="Expand to level 2"
            >
              L2
            </button>
            <button
              onClick={() => expandToLevel(3)}
              className="px-2 py-1 text-xs text-theme-secondary hover:text-white hover:bg-surface-hover rounded transition-colors"
              title="Expand to level 3"
            >
              L3
            </button>
          </div>

          <div className="w-px h-4 bg-theme mx-1" />

          <button
            onClick={expandAll}
            className="px-2 py-1 text-xs text-theme-secondary hover:text-white hover:bg-surface-hover rounded transition-colors"
          >
            Expand All
          </button>
          <button
            onClick={collapseAll}
            className="px-2 py-1 text-xs text-theme-secondary hover:text-white hover:bg-surface-hover rounded transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Main content area with canvas and optional side panel */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Mind Map Canvas */}
        <div
          ref={containerRef}
          className={`
            flex-1 overflow-auto bg-gradient-to-br from-background via-background to-surface
            ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
            scrollbar-thin scrollbar-thumb-surface-hover scrollbar-track-transparent hover:scrollbar-thumb-surface
          `}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(71, 85, 105, 0.3) transparent',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            ref={contentRef}
            className="relative"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              width: canvasSize.width,
              height: canvasSize.height,
              minWidth: '100%',
              minHeight: '100%',
            }}
          >
            {/* SVG layer for connections */}
            <ConnectionsLayer
              tree={tree}
              expandedNodes={expandedNodes}
              nodePositions={nodePositions}
            />

            {/* Tree nodes */}
            <TreeNode
              node={tree}
              expandedNodes={expandedNodes}
              onToggle={toggleNode}
              onNodeClick={handleNodeClick}
              selectedNode={selectedNode}
              nodePositions={nodePositions}
            />
          </div>
        </div>

        {/* Panel Toggle Button */}
        {selectedNode && (
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            className={`
              absolute top-2 z-20 p-1.5 rounded-lg
              bg-surface/90 border border-theme
              text-theme-secondary hover:text-white hover:bg-surface-hover
              transition-all duration-200
              ${isPanelOpen ? 'right-[21rem]' : 'right-2'}
            `}
            title={isPanelOpen ? 'Hide panel' : 'Show panel'}
          >
            {isPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
        )}

        {/* Selected Node Info Panel - Right Side (Collapsible) */}
        {selectedNode && (
          <div
            className={`
              border-l border-theme bg-surface/80 backdrop-blur-sm flex-shrink-0
              transition-all duration-300 ease-in-out overflow-hidden
              ${isPanelOpen ? 'w-80' : 'w-0 border-l-0'}
            `}
          >
            <div
              className="w-80 h-full p-4 overflow-y-auto"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(71, 85, 105, 0.3) transparent',
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                {getNodeTypeInfo(selectedNode).badge && (
                  <span className={`
                    inline-flex items-center justify-center w-7 h-7 text-xs font-bold rounded border flex-shrink-0
                    ${getColorClasses(getNodeTypeInfo(selectedNode).color)}
                  `}>
                    {getNodeTypeInfo(selectedNode).badge}
                  </span>
                )}
                <h4 className="font-medium text-white text-base leading-tight">{selectedNode.name}</h4>
              </div>
              <span className="text-xs text-theme-secondary bg-surface-hover px-2 py-1 rounded inline-block mb-3">
                {getNodeTypeInfo(selectedNode).label}
              </span>
              {selectedNode.description && (
                <p className="text-sm text-theme-secondary mb-3">{selectedNode.description}</p>
              )}
              <div className="space-y-2 text-xs">
                {selectedNode.rmType && (
                  <div className="bg-background/50 p-2 rounded">
                    <span className="text-theme-muted block mb-1">RM Type</span>
                    <span className="text-theme-secondary font-mono">{selectedNode.rmType}</span>
                  </div>
                )}
                {selectedNode.min != null && (
                  <div className="bg-background/50 p-2 rounded">
                    <span className="text-theme-muted block mb-1">Cardinality</span>
                    <span className="text-theme-secondary font-mono">
                      {selectedNode.min}..{selectedNode.max === -1 ? '*' : selectedNode.max}
                    </span>
                  </div>
                )}
                {selectedNode.children?.length > 0 && (
                  <div className="bg-background/50 p-2 rounded">
                    <span className="text-theme-muted block mb-1">Children</span>
                    <span className="text-theme-secondary">{selectedNode.children.length} nodes</span>
                  </div>
                )}
                {selectedNode.aqlPath && (
                  <div className="bg-background/50 p-2 rounded">
                    <span className="text-theme-muted block mb-1">AQL Path</span>
                    <span
                      className="text-theme-secondary font-mono text-[10px] break-all block max-h-32 overflow-y-auto"
                      style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'rgba(71, 85, 105, 0.3) transparent',
                      }}
                    >
                      {selectedNode.aqlPath}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MindMap;
