// src/components/views/strategyStudio/StrategyManager/components/SpecVisualization/StrategySpecViewer.jsx
"use client";

import React, { useState, useMemo } from 'react';
import {
  Layers, Database, GitBranch, Search, Play, Eye, EyeOff,
  ChevronDown, ChevronRight, Maximize2, Minimize2, Copy,
  Box, Route, Hash, Filter, FileJson, RefreshCw, Settings,
  Fingerprint, Link, AlertCircle
} from 'lucide-react';
import { normalizeSpec } from './specTypes';
import CollectionDiagram from './CollectionDiagram';
import SchemaDiagram from './SchemaDiagram';
import TransformDAG from './TransformDAG';

const VIEW_TABS = [
  { id: 'overview', label: 'Overview', icon: Layers, description: '2-column: Collections + Transform DAG' },
  { id: 'collections', label: 'Collections', icon: Database, description: 'Detailed collection schemas' },
  { id: 'transform', label: 'Transform', icon: GitBranch, description: 'Pipeline DAG visualization' },
  { id: 'indexes', label: 'Indexes', icon: Search, description: 'Index and Atlas Search mappings' },
];

/**
 * StrategySpecViewer - Advanced visualization of strategy spec.json
 *
 * Features:
 * - Multiple views: Overview, Collections, Transform, Indexes
 * - Interactive collection diagrams with expandable fields
 * - Transform pipeline DAG visualization
 * - Index and Atlas Search overlay
 * - Encoding profile switching
 * - Sample-driven highlighting
 */
const StrategySpecViewer = ({ spec, strategy }) => {
  const [activeView, setActiveView] = useState('overview');
  const [encodingProfile, setEncodingProfile] = useState('coded');
  const [expandedStores, setExpandedStores] = useState(new Set(['compositions']));
  const [showMetaOnly, setShowMetaOnly] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Normalize spec to universal format
  const normalizedSpec = useMemo(() => normalizeSpec(spec), [spec]);

  if (!normalizedSpec) {
    return (
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-8 text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
        <h3 className="text-lg font-semibold text-slate-300 mb-2">No Spec Available</h3>
        <p className="text-sm text-slate-500">
          Unable to parse or normalize the strategy specification.
        </p>
      </div>
    );
  }

  const toggleStoreExpanded = (storeId) => {
    setExpandedStores(prev => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  };

  return (
    <div className={`space-y-4 ${fullscreen ? 'fixed inset-0 z-50 bg-slate-900 p-6 overflow-auto' : ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-900/30 border border-purple-600/40">
            <Layers className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Strategy Visualization</h2>
            <p className="text-xs text-slate-500">
              {normalizedSpec.meta?.name} • {normalizedSpec.meta?.domain} • v{normalizedSpec.meta?.version}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Encoding Profile Selector */}
          {normalizedSpec.physicalProfiles?.length > 0 && (
            <select
              value={encodingProfile}
              onChange={(e) => setEncodingProfile(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-800 border border-slate-600 rounded-md text-slate-300 focus:outline-none focus:border-purple-500"
            >
              {normalizedSpec.physicalProfiles.map(profile => (
                <option key={profile.id} value={profile.id}>{profile.name}</option>
              ))}
            </select>
          )}

          {/* Show Meta Only Toggle */}
          <button
            onClick={() => setShowMetaOnly(!showMetaOnly)}
            className={`p-2 rounded-md transition-colors ${
              showMetaOnly
                ? 'bg-purple-600/30 text-purple-300 border border-purple-500/50'
                : 'bg-slate-800 text-slate-400 border border-slate-600 hover:text-slate-300'
            }`}
            title={showMetaOnly ? 'Show all fields' : 'Show meta fields only'}
          >
            {showMetaOnly ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setFullscreen(!fullscreen)}
            className="p-2 rounded-md bg-slate-800 text-slate-400 border border-slate-600 hover:text-slate-300 transition-colors"
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-700 pb-2">
        {VIEW_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveView(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeView === tab.id
                ? 'bg-purple-600/20 text-purple-300 border-b-2 border-purple-500'
                : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
            title={tab.description}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* View Content */}
      <div className="min-h-[500px]">
        {activeView === 'overview' && (
          <OverviewView
            spec={normalizedSpec}
            encodingProfile={encodingProfile}
            expandedStores={expandedStores}
            toggleStoreExpanded={toggleStoreExpanded}
            showMetaOnly={showMetaOnly}
          />
        )}
        {activeView === 'collections' && (
          <CollectionsView
            spec={normalizedSpec}
            encodingProfile={encodingProfile}
            expandedStores={expandedStores}
            toggleStoreExpanded={toggleStoreExpanded}
            showMetaOnly={showMetaOnly}
          />
        )}
        {activeView === 'transform' && (
          <TransformView spec={normalizedSpec} />
        )}
        {activeView === 'indexes' && (
          <IndexesView spec={normalizedSpec} />
        )}
      </div>
    </div>
  );
};

// Overview View - 2 column layout
const OverviewView = ({ spec, encodingProfile, expandedStores, toggleStoreExpanded, showMetaOnly }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Collection Model */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-400" />
          Storage Model
          {spec.storageModel?.stores?.length > 0 && (
            <span className="text-xs text-slate-500">
              ({spec.storageModel.stores.length} collection{spec.storageModel.stores.length !== 1 ? 's' : ''})
            </span>
          )}
        </h3>
        <SchemaDiagram
          stores={spec.storageModel?.stores || []}
          joins={spec.storageModel?.joins || []}
          compact={true}
        />
      </div>

      {/* Right: Transform DAG */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-purple-400" />
          Transform Pipeline
          {spec.transformModel?.pipeline?.length > 0 && (
            <span className="text-xs text-slate-500">
              ({spec.transformModel.pipeline.length} step{spec.transformModel.pipeline.length !== 1 ? 's' : ''})
            </span>
          )}
        </h3>
        <TransformDAG
          artifacts={spec.transformModel?.artifacts || []}
          pipeline={spec.transformModel?.pipeline || []}
          dictionaries={spec.transformModel?.dictionaries || []}
          visualization={spec.visualization}
          vizGraph={spec.transformModel?.vizGraph}
          compact={true}
        />
      </div>
    </div>
  );
};

// Collections View - detailed schemas with SchemaDiagram
const CollectionsView = ({ spec, encodingProfile, expandedStores, toggleStoreExpanded, showMetaOnly }) => {
  return (
    <SchemaDiagram
      stores={spec.storageModel?.stores || []}
      joins={spec.storageModel?.joins || []}
      compact={false}
    />
  );
};

// Transform View - full DAG
const TransformView = ({ spec }) => {
  const [selectedStep, setSelectedStep] = useState(null);

  return (
    <div className="space-y-6">
      {/* Pipeline Stats */}
      {spec.transformModel && (
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-400">
            <span className="font-medium text-white">{spec.transformModel.pipeline?.length || 0}</span> steps
          </span>
          <span className="text-slate-400">
            <span className="font-medium text-white">{spec.transformModel.artifacts?.length || 0}</span> artifacts
          </span>
          {spec.transformModel.dictionaries?.length > 0 && (
            <span className="text-slate-400">
              <span className="font-medium text-amber-400">{spec.transformModel.dictionaries.length}</span> dictionaries
            </span>
          )}
          {spec.transformModel.invariants?.length > 0 && (
            <span className="text-slate-400">
              <span className="font-medium text-emerald-400">{spec.transformModel.invariants.length}</span> invariants
            </span>
          )}
        </div>
      )}

      <TransformDAG
        artifacts={spec.transformModel?.artifacts || []}
        pipeline={spec.transformModel?.pipeline || []}
        dictionaries={spec.transformModel?.dictionaries || []}
        visualization={spec.visualization}
        vizGraph={spec.transformModel?.vizGraph}
        compact={false}
        onStepSelect={setSelectedStep}
        selectedStep={selectedStep}
      />

      {/* Step Details Panel */}
      {selectedStep && (
        <StepDetailsPanel
          step={selectedStep}
          artifacts={spec.transformModel?.artifacts || []}
          onClose={() => setSelectedStep(null)}
        />
      )}
    </div>
  );
};

// Step Details Panel
const StepDetailsPanel = ({ step, artifacts, onClose }) => {
  const inputArtifacts = artifacts.filter(a => step.inputs?.includes(a.id));
  const outputArtifacts = artifacts.filter(a => step.outputs?.includes(a.id));

  return (
    <div className="bg-slate-800/60 border border-purple-600/40 rounded-xl p-4">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-900/40 border border-purple-600/40">
            <StepIcon type={step.type} className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-white">{step.name}</h4>
            <p className="text-xs text-slate-500">{step.type} step • {step.group || 'transform'}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300">×</button>
      </div>

      {step.description && (
        <p className="text-sm text-slate-400 mb-4">{step.description}</p>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Inputs */}
        <div>
          <h5 className="text-xs font-semibold text-slate-400 uppercase mb-2">Inputs</h5>
          <div className="space-y-1">
            {inputArtifacts.map(art => (
              <div key={art.id} className="flex items-center gap-2 p-2 bg-slate-900/60 rounded border border-slate-700">
                <ArtifactIcon type={art.type} className="w-4 h-4" />
                <span className="text-xs text-slate-300">{art.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Outputs */}
        <div>
          <h5 className="text-xs font-semibold text-slate-400 uppercase mb-2">Outputs</h5>
          <div className="space-y-1">
            {outputArtifacts.map(art => (
              <div key={art.id} className="flex items-center gap-2 p-2 bg-slate-900/60 rounded border border-slate-700">
                <ArtifactIcon type={art.type} className="w-4 h-4" />
                <span className="text-xs text-slate-300">{art.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Parameters */}
      {step.params && Object.keys(step.params).length > 0 && (
        <div className="mt-4">
          <h5 className="text-xs font-semibold text-slate-400 uppercase mb-2">Parameters</h5>
          <div className="bg-slate-900/60 rounded-lg p-3 border border-slate-700">
            <pre className="text-xs text-slate-300 font-mono">
              {JSON.stringify(step.params, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Invariants */}
      {step.invariants?.length > 0 && (
        <div className="mt-4">
          <h5 className="text-xs font-semibold text-slate-400 uppercase mb-2">Invariants Maintained</h5>
          <div className="flex flex-wrap gap-2">
            {step.invariants.map(inv => (
              <span key={inv} className="px-2 py-1 text-xs bg-emerald-900/30 text-emerald-300 rounded border border-emerald-600/40">
                {inv}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Indexes View
const IndexesView = ({ spec }) => {
  const stores = spec.storageModel?.stores || [];
  const indexOverlay = spec.visualization?.indexOverlay;

  return (
    <div className="space-y-6">
      {/* Index Overlay Summary (from visualization) */}
      {indexOverlay && (
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-purple-400" />
            Index Strategy Overview
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {indexOverlay.btree && (
              <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-600/40">
                <h5 className="text-xs font-semibold text-blue-400 uppercase mb-2">B-tree Indexes</h5>
                <p className="text-xs text-slate-400">{indexOverlay.btree.purpose || 'Standard field indexing'}</p>
              </div>
            )}
            {indexOverlay.atlasSearch && (
              <div className="p-3 bg-purple-900/20 rounded-lg border border-purple-600/40">
                <h5 className="text-xs font-semibold text-purple-400 uppercase mb-2">Atlas Search</h5>
                <p className="text-xs text-slate-400">{indexOverlay.atlasSearch.purpose || 'Full-text and facet search'}</p>
              </div>
            )}
            {indexOverlay.vector && (
              <div className="p-3 bg-emerald-900/20 rounded-lg border border-emerald-600/40">
                <h5 className="text-xs font-semibold text-emerald-400 uppercase mb-2">Vector Search</h5>
                <p className="text-xs text-slate-400">{indexOverlay.vector.purpose || 'Semantic similarity search'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {stores.map(store => (
        <div key={store.id} className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <StoreRoleBadge role={store.role} />
              <div>
                <h4 className="text-lg font-semibold text-white">{store.name}</h4>
                <p className="text-xs text-slate-500">{store.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {store.indexes?.length > 0 && (
                <span className="px-2 py-1 text-xs bg-blue-900/30 text-blue-300 rounded">
                  {store.indexes.length} B-tree
                </span>
              )}
              {store.atlasSearch && (
                <span className="px-2 py-1 text-xs bg-purple-900/30 text-purple-300 rounded">
                  Atlas Search
                </span>
              )}
            </div>
          </div>

          {/* B-tree Indexes */}
          {store.indexes?.length > 0 && (
            <div className="mb-4">
              <h5 className="text-xs font-semibold text-slate-400 uppercase mb-2">B-tree Indexes</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {store.indexes.map((idx, i) => (
                  <div key={i} className="p-3 bg-slate-900/60 rounded-lg border border-slate-700">
                    <div className="flex items-center gap-2 mb-1">
                      <Database className="w-4 h-4 text-blue-400" />
                      <span className="text-sm font-medium text-slate-200">{idx.name}</span>
                      {idx.type && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-slate-700 text-slate-400 rounded">
                          {idx.type}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{idx.purpose}</p>
                    <div className="flex flex-wrap gap-1">
                      {idx.fields?.map((field, j) => (
                        <span key={j} className="px-2 py-0.5 text-xs font-mono bg-blue-900/30 text-blue-300 rounded">
                          {typeof field === 'string' ? field : `${field.name}: ${field.order || 1}`}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Atlas Search */}
          {store.atlasSearch && (
            <div>
              <h5 className="text-xs font-semibold text-slate-400 uppercase mb-2">Atlas Search Index</h5>
              <div className="p-3 bg-purple-900/20 rounded-lg border border-purple-600/40">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-medium text-purple-200">
                    {store.atlasSearch.indexNameConfig
                      ? `\${config.${store.atlasSearch.indexNameConfig}}`
                      : store.atlasSearch.indexName || 'search_index'}
                  </span>
                  {store.atlasSearch.definitionRef && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-purple-900/60 text-purple-300 rounded">
                      ref: {store.atlasSearch.definitionRef}
                    </span>
                  )}
                </div>
                {store.atlasSearch.purpose && (
                  <p className="text-xs text-slate-400 mb-2">{store.atlasSearch.purpose}</p>
                )}
                {store.atlasSearch.mappings && (
                  <pre className="text-xs text-slate-300 font-mono bg-slate-900/60 rounded p-2 overflow-auto max-h-40">
                    {JSON.stringify(store.atlasSearch.mappings, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Helper Components
const StoreRoleBadge = ({ role }) => {
  const colors = {
    canonical: 'bg-blue-900/30 text-blue-300 border-blue-600/40',
    projection: 'bg-purple-900/30 text-purple-300 border-purple-600/40',
    dictionary: 'bg-amber-900/30 text-amber-300 border-amber-600/40',
    index: 'bg-emerald-900/30 text-emerald-300 border-emerald-600/40'
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded border ${colors[role] || colors.canonical}`}>
      {role}
    </span>
  );
};

const StepIcon = ({ type, className }) => {
  const icons = {
    flatten: Layers,
    normalize: Hash,
    validate: AlertCircle,
    project: Filter,
    vectorize: Box,
    materialize: Database
  };
  const Icon = icons[type] || Box;
  return <Icon className={className} />;
};

const ArtifactIcon = ({ type, className }) => {
  const colors = {
    source: 'text-blue-400',
    intermediate: 'text-purple-400',
    sink: 'text-emerald-400'
  };
  return <Box className={`${className} ${colors[type] || colors.intermediate}`} />;
};

export default StrategySpecViewer;
