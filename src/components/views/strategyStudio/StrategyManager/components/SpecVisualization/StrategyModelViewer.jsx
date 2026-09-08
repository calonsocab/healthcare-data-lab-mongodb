// src/components/views/strategyStudio/StrategyManager/components/SpecVisualization/StrategyModelViewer.jsx
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import {
  Database, Layers, Search, GitBranch,
  User, ArrowRight, Key, Zap, Link2,
  BookOpen
} from 'lucide-react';
import DictionaryManagerPanel from '../DictionaryManagerPanel';
import DualStoreLayout from '@/components/blueprint/presets/DualStoreLayout';

/**
 * StrategyModelViewer - Rich visualization of persistence strategy
 *
 * Multi-view component showing:
 * - Architecture: High-level dual-store pattern
 * - Collections: React Flow canvas with all collections
 * - Dictionaries: Path shortcuts & archetype codes management
 * - Transform: Pipeline DAG
 */
const StrategyModelViewer = ({ spec, strategy, activeEnv }) => {
  const [activeView, setActiveView] = useState('architecture');

  // Extract pack_spec
  const packSpec = spec?.pack_spec || (spec?.meta?.strategyId ? spec : null);

  if (!packSpec) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-800/40 rounded-xl border border-slate-700">
        <p className="text-slate-500">No model data available</p>
      </div>
    );
  }

  const viz = packSpec.visualization;
  const meta = packSpec.meta || {};

  const views = [
    { id: 'architecture', label: 'Architecture', icon: GitBranch },
    { id: 'collections', label: 'Collections', icon: Database },
    { id: 'dictionaries', label: 'Dictionaries', icon: BookOpen },
    { id: 'transform', label: 'Transform', icon: Layers },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">{meta.title || spec?.name}</h2>
            <p className="text-xs text-slate-500">{meta.domain} • v{meta.specVersion}</p>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex bg-slate-800/60 rounded-lg p-1">
          {views.map(view => (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeView === view.id
                  ? 'bg-primary text-primary-text'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <view.icon className="w-3.5 h-3.5" />
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="dark-banner bg-slate-900/40 rounded-xl border border-slate-700 overflow-hidden min-h-[500px]">
        {activeView === 'architecture' && (
          <ArchitectureView packSpec={packSpec} />
        )}
        {activeView === 'collections' && (
          <CollectionsCanvas packSpec={packSpec} />
        )}
        {activeView === 'dictionaries' && (
          <div className="p-6">
            <DictionaryManagerPanel strategy={strategy} environment={activeEnv} />
          </div>
        )}
        {activeView === 'transform' && (
          <TransformView packSpec={packSpec} viz={viz} />
        )}
      </div>

      {/* Quick Stats */}
      <div className="flex items-center gap-6 text-xs text-slate-500 px-2">
        <span>
          <span className="text-slate-300 font-medium">
            {viz?.collectionModel?.entities?.length || 0}
          </span> collections
        </span>
        <span>
          <span className="text-slate-300 font-medium">
            {packSpec.transformModel?.pipeline?.length || 0}
          </span> pipeline steps
        </span>
        <span>
          <span className="text-slate-300 font-medium">
            {packSpec.storageModel?.stores?.length || 0}
          </span> stores
        </span>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Custom Node for Collections
// ═══════════════════════════════════════════════════════════════

const CollectionNode = ({ data }) => {
  const [selectedField, setSelectedField] = useState(null);
  const hasSearch = data.hasSearch;
  const fields = data.fields || [];
  const legends = data.legends || {};

  // Get field description from legends (only from spec.json)
  const getFieldInfo = (fieldName) => {
    const cleanName = fieldName.replace('[]', '');
    const entry = legends.pathLegend?.entries?.find(e => e.label === cleanName);
    return entry || null;
  };

  return (
    <div
      className={`rounded-xl border-2 shadow-xl min-w-[300px] max-w-[360px] ${
        hasSearch
          ? 'border-amber-500/60 bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-900'
          : 'border-emerald-500/60 bg-gradient-to-br from-slate-900 via-emerald-950/20 to-slate-900'
      }`}
    >
      {/* Handles for edges */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-purple-500 !w-3 !h-3"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-purple-500 !w-3 !h-3"
      />

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 rounded-t-lg ${
        hasSearch
          ? 'bg-gradient-to-r from-amber-900/50 to-purple-900/30'
          : 'bg-gradient-to-r from-emerald-900/50 to-slate-800'
      }`}>
        <div className="flex items-center gap-3">
          {hasSearch ? (
            <Search className="w-5 h-5 text-amber-400" />
          ) : (
            <Database className="w-5 h-5 text-emerald-400" />
          )}
          <div>
            <h3 className="font-semibold text-white text-sm">{data.label}</h3>
            <p className="text-[10px] text-slate-400">{data.storeTitle}</p>
          </div>
        </div>
      </div>

      {/* Badges */}
      {data.badges?.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 py-2 bg-slate-800/40 border-b border-slate-700/50">
          {data.badges.map((badge, i) => (
            <span key={i} className={`px-2 py-0.5 text-[9px] font-medium rounded ${
              badge === 'canonical' ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-600/30' :
              badge === 'slim' ? 'bg-amber-900/50 text-amber-300 border border-amber-600/30' :
              badge === 'search-indexed' ? 'bg-purple-900/50 text-purple-300 border border-purple-600/30' :
              badge === 'patient' ? 'bg-blue-900/50 text-blue-300 border border-blue-600/30' :
              badge === 'cross-patient' ? 'bg-pink-900/50 text-pink-300 border border-pink-600/30' :
              'bg-slate-700/50 text-slate-300 border border-slate-600/30'
            }`}>
              {badge}
            </span>
          ))}
        </div>
      )}

      {/* Fields - show all */}
      <div className="px-3 py-2 space-y-0.5 max-h-[400px] overflow-y-auto">
        {fields.map((field, i) => {
          const nested = data.expand?.[field];
          const fieldInfo = getFieldInfo(field);
          const isSelected = selectedField === field;

          return (
            <div key={i}>
              <div
                className={`flex items-center justify-between py-1.5 px-1 rounded cursor-pointer transition-colors ${
                  isSelected ? 'bg-slate-700/50' : 'hover:bg-slate-800/30'
                }`}
                onClick={() => setSelectedField(isSelected ? null : field)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {field === '_id' && <Key className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                  {field === 'ehr_id' && <User className="w-3 h-3 text-blue-400 flex-shrink-0" />}
                  {nested && <Layers className="w-3 h-3 text-purple-400 flex-shrink-0" />}
                  <code className="text-xs text-slate-300">{field}</code>
                </div>
                {fieldInfo && (
                  <span className="text-[8px] px-1.5 py-0.5 bg-blue-900/30 text-blue-300 rounded flex-shrink-0">
                    ?
                  </span>
                )}
              </div>

              {/* Field description when selected - only from spec.json legends */}
              {isSelected && fieldInfo && (
                <div className="ml-4 px-2 py-1.5 bg-slate-800/60 rounded text-[10px] text-slate-400 mb-1">
                  <p className="text-slate-300">{fieldInfo.meaning}</p>
                  {fieldInfo.example !== undefined && (
                    <p className="mt-1 font-mono text-slate-500">
                      e.g. <span className="text-cyan-400">{typeof fieldInfo.example === 'string' ? fieldInfo.example : JSON.stringify(fieldInfo.example)}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Nested fields - always show */}
              {nested && (
                <div className="ml-4 pl-2 border-l border-slate-700/50">
                  {nested.map((nf, j) => {
                    const nestedInfo = getFieldInfo(nf);
                    return (
                      <div key={j} className="flex items-center gap-1.5 py-0.5 text-[10px]">
                        <span className="text-slate-600">└</span>
                        <code className="text-slate-400">{nf}</code>
                        {nestedInfo && (
                          <span className="text-slate-500 truncate max-w-[140px]" title={nestedInfo.meaning}>
                            - {nestedInfo.meaning}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Indexes */}
      {data.indexes?.length > 0 && (
        <div className="px-3 py-2 bg-slate-800/30 border-t border-slate-700/50">
          <p className="text-[9px] text-slate-500 uppercase mb-1">Indexes</p>
          {data.indexes.slice(0, 3).map((idx, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <Zap className="w-2.5 h-2.5 text-blue-400" />
              <span className="font-mono">{idx.id}</span>
            </div>
          ))}
        </div>
      )}

      {/* Atlas Search */}
      {hasSearch && (
        <div className="px-3 py-2 bg-purple-900/20 border-t border-purple-600/30 rounded-b-lg">
          <div className="flex items-center gap-2 text-[10px] text-purple-300">
            <Search className="w-3 h-3" />
            <span>Atlas Search enabled</span>
          </div>
        </div>
      )}

      {/* Join info */}
      {data.links?.length > 0 && (
        <div className="px-3 py-2 bg-slate-800/20 border-t border-slate-700/50">
          {data.links.map((link, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-400">
              <Link2 className="w-2.5 h-2.5 text-purple-400" />
              <span>→ {link.target}</span>
              <code className="text-slate-500">({link.on})</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Node types registration
const nodeTypes = {
  collection: CollectionNode,
};

// ═══════════════════════════════════════════════════════════════
// Collections Canvas - React Flow
// ═══════════════════════════════════════════════════════════════

const CollectionsCanvas = ({ packSpec }) => {
  const entities = packSpec.visualization?.collectionModel?.entities || [];
  const stores = packSpec.storageModel?.stores || [];
  const legends = packSpec.visualization?.legends || {};

  // Build store lookup
  const storeMap = useMemo(() => {
    const map = {};
    stores.forEach(s => { map[s.id] = s; });
    return map;
  }, [stores]);

  // Build nodes and edges for React Flow
  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes = [];
    const edges = [];

    entities.forEach((entity, index) => {
      const store = storeMap[entity.store];
      const hasSearch = store?.search?.kind === 'atlas_search';

      nodes.push({
        id: entity.id,
        type: 'collection',
        position: { x: 0, y: 0 }, // Will be set by dagre
        data: {
          label: entity.label,
          storeTitle: store?.title || entity.store,
          hasSearch,
          badges: entity.badges || [],
          fields: entity.fields || [],
          expand: entity.expand || {},
          indexes: store?.indexes || [],
          links: entity.links || [],
          legends, // Pass legends from spec.json
        },
      });

      // Add edges for links (static dashed lines)
      entity.links?.forEach((link, linkIdx) => {
        const targetEntity = entities.find(e => e.label === link.target || e.id === link.target);
        if (targetEntity) {
          edges.push({
            id: `${entity.id}-${targetEntity.id}-${linkIdx}`,
            source: entity.id,
            target: targetEntity.id,
            style: { stroke: '#8b5cf6', strokeWidth: 2, strokeDasharray: '6,4' },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#8b5cf6',
            },
            label: link.on,
            labelStyle: { fill: '#a78bfa', fontSize: 10, fontFamily: 'monospace' },
            labelBgStyle: { fill: '#1e1b4b', fillOpacity: 0.8 },
            labelBgPadding: [4, 2],
          });
        }
      });
    });

    // Use dagre for layout
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'LR', nodesep: 100, ranksep: 200 });

    nodes.forEach(node => {
      dagreGraph.setNode(node.id, { width: 300, height: 250 });
    });

    edges.forEach(edge => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    // Apply positions from dagre
    nodes.forEach(node => {
      const nodeWithPosition = dagreGraph.node(node.id);
      node.position = {
        x: nodeWithPosition.x - 150,
        y: nodeWithPosition.y - 125,
      };
    });

    return { initialNodes: nodes, initialEdges: edges };
  }, [entities, storeMap]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="w-full h-[500px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background color="#334155" gap={20} size={1} />
        <Controls className="!bg-slate-800 !border-slate-700 !rounded-lg [&>button]:!bg-slate-700 [&>button]:!border-slate-600 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-600" />
        <MiniMap
          nodeColor={(node) => node.data.hasSearch ? '#f59e0b' : '#10b981'}
          maskColor="rgba(15, 23, 42, 0.8)"
          className="!bg-slate-800 !border-slate-700 !rounded-lg"
        />
      </ReactFlow>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Architecture View - The big picture
// ═══════════════════════════════════════════════════════════════

const ArchitectureView = ({ packSpec }) => {
  return (
    <div className="p-6">
      <DualStoreLayout
        title={packSpec.meta?.title || 'Reversed Path Search - Dual Collection'}
        description={packSpec.meta?.summary}
        interactive
        onNodeClick={(nodeId) => console.log('Architecture node clicked:', nodeId)}
      />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Transform View - Pipeline DAG
// ═══════════════════════════════════════════════════════════════

const TransformView = ({ packSpec, viz }) => {
  const pipeline = packSpec.transformModel?.pipeline || [];
  const graph = viz?.transformGraph;

  return (
    <div className="p-6">
      <div className="bg-slate-800/30 rounded-xl p-6">
        <svg className="w-full h-[300px]" viewBox="0 0 800 280">
          <defs>
            <marker id="tf-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#6b7280" />
            </marker>
          </defs>

          {/* Render nodes from transformGraph */}
          {graph?.nodes?.map((node, i) => {
            const col = node.kind === 'source' ? 0 : node.kind === 'transform' ? 1 : 2;
            const row = graph.nodes.filter(n => n.kind === node.kind).indexOf(node);
            const x = 80 + col * 280;
            const y = 40 + row * 80;

            const colors = {
              source: { bg: '#3b82f620', border: '#3b82f6', text: '#93c5fd' },
              transform: { bg: '#8b5cf620', border: '#8b5cf6', text: '#c4b5fd' },
              sink: { bg: '#10b98120', border: '#10b981', text: '#6ee7b7' }
            };
            const c = colors[node.kind] || colors.transform;

            return (
              <g key={node.id} transform={`translate(${x}, ${y})`}>
                <rect
                  width="200"
                  height="60"
                  rx="8"
                  fill={c.bg}
                  stroke={c.border}
                  strokeWidth="2"
                />
                <text x="100" y="25" textAnchor="middle" fill={c.text} fontSize="12" fontWeight="600">
                  {node.label}
                </text>
                <text x="100" y="45" textAnchor="middle" fill={c.border} fontSize="10" opacity="0.8">
                  {node.kind}
                </text>
              </g>
            );
          })}

          {/* Render edges */}
          {graph?.edges?.map((edge, i) => {
            const fromNode = graph.nodes.find(n => n.id === edge.from);
            const toNode = graph.nodes.find(n => n.id === edge.to);
            if (!fromNode || !toNode) return null;

            const fromCol = fromNode.kind === 'source' ? 0 : fromNode.kind === 'transform' ? 1 : 2;
            const fromRow = graph.nodes.filter(n => n.kind === fromNode.kind).indexOf(fromNode);
            const toCol = toNode.kind === 'source' ? 0 : toNode.kind === 'transform' ? 1 : 2;
            const toRow = graph.nodes.filter(n => n.kind === toNode.kind).indexOf(toNode);

            const x1 = 80 + fromCol * 280 + 200;
            const y1 = 40 + fromRow * 80 + 30;
            const x2 = 80 + toCol * 280;
            const y2 = 40 + toRow * 80 + 30;

            const midX = (x1 + x2) / 2;
            const path = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;

            return (
              <path
                key={i}
                d={path}
                fill="none"
                stroke="#6b728080"
                strokeWidth="2"
                markerEnd="url(#tf-arrow)"
              />
            );
          })}
        </svg>
      </div>

      {/* Pipeline Steps */}
      <div className="mt-6 space-y-3">
        {pipeline.map((step, i) => (
          <div key={step.id} className="flex items-start gap-4 p-4 bg-slate-800/40 rounded-lg border border-slate-700">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-text text-sm font-bold">
              {i + 1}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-white">{step.title}</h4>
                <code className="px-2 py-0.5 text-[10px] bg-slate-700 text-slate-300 rounded">
                  {step.op}
                </code>
              </div>
              {step.visual?.notes && (
                <p className="text-xs text-slate-400">{step.visual.notes}</p>
              )}
            </div>
            {step.toStore && (
              <div className="flex items-center gap-2 text-xs text-emerald-400">
                <ArrowRight className="w-3 h-3" />
                <code>{step.toStore.replace('store:', '')}</code>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StrategyModelViewer;
