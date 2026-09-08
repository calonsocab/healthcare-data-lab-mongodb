// src/components/views/strategyStudio/StrategyManager/components/SpecVisualization/DataJourneyViewer.jsx
"use client";

import React, { useState, useMemo } from 'react';
import { Layers, ChevronDown, Info, AlertTriangle, FileJson } from 'lucide-react';
import JourneyCanvas from './JourneyCanvas';
import NodeDetailPanel from './NodeDetailPanel';

/**
 * DataJourneyViewer - Unified visualization of strategy data flow
 *
 * Uses pack_spec.visualization directly from Kehrnel - no over-normalization.
 * The spec.json IS the universal format (strategy-pack/v1).
 */
const DataJourneyViewer = ({ spec, strategy }) => {
  const [selectedNode, setSelectedNode] = useState(null);
  const [encodingProfile, setEncodingProfile] = useState(null);

  // Detect pack_spec structure:
  // 1. Kehrnel /spec endpoint returns { meta, logicalModel, ... } directly (spec IS pack_spec)
  // 2. Full strategy object has { pack_spec: { meta, logicalModel, ... } }
  const packSpec = spec?.pack_spec || (spec?.meta?.strategyId ? spec : null);

  // Check for visualization data
  const viz = packSpec?.visualization;
  const hasViz = viz?.transformGraph || viz?.collectionModel;

  // Extract encoding profiles directly from pack_spec
  const profiles = useMemo(() => {
    return packSpec?.physicalProfiles?.encodingProfiles || [];
  }, [packSpec]);

  // Use visualization data directly - no normalization needed
  // (All hooks must be called before any conditional returns)
  const journeyData = useMemo(() => {
    if (!packSpec || !viz) return null;
    return {
      // Transform graph from visualization
      transformGraph: viz.transformGraph,
      // Collection model from visualization
      collectionModel: viz.collectionModel,
      // Index overlay
      indexOverlay: viz.indexOverlay,
      // Legends
      legends: viz.legends,
      // Raw model data for detail panel
      logicalModel: packSpec.logicalModel,
      storageModel: packSpec.storageModel,
      transformModel: packSpec.transformModel,
      queryModel: packSpec.queryModel,
      // Profiles
      physicalProfiles: profiles,
      // Bundles
      bundles: packSpec.bundles
    };
  }, [packSpec, viz, profiles]);

  // Set default encoding profile if not set (using useEffect pattern would be better but this is OK)
  React.useEffect(() => {
    if (!encodingProfile && profiles.length > 0) {
      const defaultProfile = profiles.find(p => p.id?.includes('codedpath')) || profiles[0];
      if (defaultProfile) setEncodingProfile(defaultProfile.id);
    }
  }, [profiles, encodingProfile]);

  // Now handle the early returns (after all hooks)
  // No spec at all
  if (!spec) {
    return (
      <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-8 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
        <h3 className="text-lg font-semibold text-amber-200 mb-2">Spec Not Loaded</h3>
        <p className="text-sm text-amber-300/70 max-w-md mx-auto">
          The strategy spec.json could not be loaded from Kehrnel.
        </p>
        {strategy?.id && (
          <p className="text-xs text-slate-500 mt-4 font-mono">
            Strategy: {strategy.id}
          </p>
        )}
      </div>
    );
  }

  // No pack_spec (detailed model)
  if (!packSpec) {
    return (
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-8 text-center">
        <FileJson className="w-12 h-12 mx-auto mb-4 text-slate-500" />
        <h3 className="text-lg font-semibold text-slate-300 mb-2">No Data Model</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
          Spec loaded but no visualization data found.
        </p>
      </div>
    );
  }

  if (!hasViz) {
    return (
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-8 text-center">
        <FileJson className="w-12 h-12 mx-auto mb-4 text-slate-500" />
        <h3 className="text-lg font-semibold text-slate-300 mb-2">No Visualization Defined</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
          pack_spec.visualization is empty.
        </p>
      </div>
    );
  }

  const handleNodeSelect = (node) => {
    setSelectedNode(prev =>
      prev?.id === node?.id && prev?.nodeType === node?.nodeType ? null : node
    );
  };

  // Meta from pack_spec
  const meta = packSpec.meta || {};

  // Stats from visualization
  const graphNodes = viz.transformGraph?.nodes || [];
  const collections = viz.collectionModel?.entities || [];
  const sourceCount = graphNodes.filter(n => n.kind === 'source').length;
  const transformCount = graphNodes.filter(n => n.kind === 'transform').length;
  const sinkCount = graphNodes.filter(n => n.kind === 'sink').length;

  return (
    <div className="space-y-4">
      {/* Header with encoding profile selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-900/30 border border-purple-600/40">
            <Layers className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Data Journey</h2>
            <p className="text-xs text-slate-500">
              {meta.title || spec.name} • {meta.domain || spec.domain}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Stage Legend */}
          <div className="flex items-center gap-4 mr-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-500/40 border border-blue-500" />
              <span className="text-slate-400">Source</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-purple-500/40 border border-purple-500" />
              <span className="text-slate-400">Transform</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-500/40 border border-emerald-500" />
              <span className="text-slate-400">Sink</span>
            </div>
          </div>

          {/* Encoding Profile Selector */}
          {profiles.length > 0 && (
            <div className="relative">
              <select
                value={encodingProfile || ''}
                onChange={(e) => setEncodingProfile(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-xs bg-slate-800 border border-slate-600 rounded-md text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                {profiles.map(profile => (
                  <option key={profile.id} value={profile.id}>
                    {profile.title || profile.id}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Main Content: Canvas + Detail Panel */}
      <div className="flex gap-4 min-h-[500px]">
        {/* Left: Journey Canvas (60%) */}
        <div className="dark-banner flex-[3] bg-slate-900/40 rounded-xl border border-slate-700 overflow-hidden">
          <JourneyCanvas
            data={journeyData}
            selectedNode={selectedNode}
            onNodeSelect={handleNodeSelect}
            encodingProfile={encodingProfile}
          />
        </div>

        {/* Right: Detail Panel (40%) */}
        <div className="dark-banner flex-[2] bg-slate-900/40 rounded-xl border border-slate-700 overflow-hidden">
          <NodeDetailPanel
            node={selectedNode}
            packSpec={packSpec}
            spec={spec}
            encodingProfile={encodingProfile}
            journeyData={journeyData}
          />
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="flex items-center gap-6 text-xs text-slate-500 px-2">
        <span>
          <span className="text-slate-300 font-medium">{sourceCount}</span> source{sourceCount !== 1 ? 's' : ''}
        </span>
        <span>
          <span className="text-slate-300 font-medium">{transformCount}</span> transform{transformCount !== 1 ? 's' : ''}
        </span>
        <span>
          <span className="text-slate-300 font-medium">{sinkCount}</span> sink{sinkCount !== 1 ? 's' : ''}
        </span>
        <span>
          <span className="text-emerald-300 font-medium">{collections.length}</span> collection{collections.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
};

export default DataJourneyViewer;
