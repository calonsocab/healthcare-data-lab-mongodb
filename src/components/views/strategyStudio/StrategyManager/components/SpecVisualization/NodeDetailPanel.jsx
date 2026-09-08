// src/components/views/strategyStudio/StrategyManager/components/SpecVisualization/NodeDetailPanel.jsx
"use client";

import React, { useState } from 'react';
import {
  FileJson, Layers, Database, Search, BookOpen, Box, Hash,
  Key, ChevronRight, ChevronDown, ArrowRight, Filter, Info,
  Zap, GitBranch, Table, Tag, Route, Users, User
} from 'lucide-react';

/**
 * NodeDetailPanel - Rich detail view for selected graph nodes
 *
 * Uses pack_spec data directly to show contextual information:
 * - Source: Shows the input document structure
 * - Transform: Shows the operation details and I/O
 * - Sink: Shows collection schema, indexes, search config
 * - None: Shows strategy overview
 */
const NodeDetailPanel = ({
  node,
  packSpec,
  spec,
  encodingProfile,
  journeyData
}) => {
  // No node selected - show strategy overview
  if (!node) {
    return <StrategyOverview packSpec={packSpec} spec={spec} journeyData={journeyData} />;
  }

  switch (node.kind) {
    case 'source':
      return <SourceDetail node={node} packSpec={packSpec} />;
    case 'transform':
      return <TransformDetail node={node} packSpec={packSpec} journeyData={journeyData} />;
    case 'sink':
      return <SinkDetail node={node} packSpec={packSpec} encodingProfile={encodingProfile} journeyData={journeyData} />;
    default:
      return <StrategyOverview packSpec={packSpec} spec={spec} journeyData={journeyData} />;
  }
};

// ═══════════════════════════════════════════════════════════════
// Strategy Overview (when nothing selected)
// ═══════════════════════════════════════════════════════════════

const StrategyOverview = ({ packSpec, spec, journeyData }) => {
  const meta = packSpec?.meta || {};
  const queryModel = packSpec?.queryModel;

  return (
    <div className="p-4 h-full overflow-auto">
      <div className="flex items-center gap-2 mb-4">
        <Info className="w-5 h-5 text-purple-400" />
        <h3 className="text-lg font-semibold text-white">Strategy Overview</h3>
      </div>

      <p className="text-sm text-slate-400 mb-4">
        {meta.summary || spec?.summary || 'Click on any node to see details.'}
      </p>

      {/* Tags */}
      {meta.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {meta.tags.map((tag, i) => (
            <span key={i} className="px-2 py-0.5 text-xs bg-slate-700/50 text-slate-300 rounded">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Query Modes - Key insight */}
      {queryModel?.modes && (
        <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-600/30 p-4 mb-4">
          <h4 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            Query Modes
          </h4>
          <div className="space-y-3">
            {queryModel.modes.map((mode, i) => (
              <div key={i} className="bg-slate-900/40 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  {mode.id === 'patient_scoped' ? (
                    <User className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Users className="w-4 h-4 text-blue-400" />
                  )}
                  <span className="text-sm font-medium text-white">{mode.title}</span>
                </div>
                <p className="text-xs text-slate-400 mb-2">{mode.notes}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">Uses:</span>
                  <code className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">
                    {mode.uses?.[0]}
                  </code>
                  <span className="text-slate-500">via</span>
                  <code className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">
                    {mode.pattern}
                  </code>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Encoding Profiles */}
      {journeyData.physicalProfiles?.length > 0 && (
        <div className="bg-slate-800/40 rounded-lg border border-slate-700 p-4 mb-4">
          <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Hash className="w-4 h-4 text-amber-400" />
            Encoding Profiles
          </h4>
          <div className="space-y-2">
            {journeyData.physicalProfiles.map(profile => (
              <div key={profile.id} className="bg-slate-900/40 rounded p-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-300">{profile.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                    {profile.paths?.mode || 'default'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">{profile.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Collections Quick View */}
      {journeyData.collectionModel?.entities && (
        <div className="bg-slate-800/40 rounded-lg border border-slate-700 p-4">
          <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            Collections
          </h4>
          <div className="space-y-2">
            {journeyData.collectionModel.entities.map(entity => (
              <div key={entity.id} className="flex items-center justify-between p-2 bg-slate-900/40 rounded">
                <div className="flex items-center gap-2">
                  <Database className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs text-slate-300">{entity.label}</span>
                </div>
                <div className="flex gap-1">
                  {entity.badges?.slice(0, 2).map((badge, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                      {badge}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Source Node Detail
// ═══════════════════════════════════════════════════════════════

const SourceDetail = ({ node, packSpec }) => {
  const sourceTypes = packSpec?.logicalModel?.source?.types || [];
  const sourceType = node.typeRef
    ? sourceTypes.find(t => t.id === node.typeRef)
    : sourceTypes[0];

  return (
    <div className="p-4 h-full overflow-auto">
      <NodeHeader
        icon={FileJson}
        title={node.label}
        subtitle="Source Document"
        color="blue"
      />

      {sourceType && (
        <div className="mt-4 space-y-4">
          {/* Source type info */}
          <div className="bg-blue-900/20 rounded-lg border border-blue-600/30 p-3">
            <p className="text-xs text-blue-300 mb-1">{sourceType.title}</p>
            <p className="text-xs text-slate-400">{sourceType.description}</p>
          </div>

          {/* Fields */}
          {sourceType.fields && (
            <div className="bg-slate-800/40 rounded-lg border border-slate-700 p-4">
              <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <Table className="w-4 h-4 text-blue-400" />
                Input Fields
              </h4>
              <div className="space-y-1">
                {Object.entries(sourceType.fields).map(([name, field]) => (
                  <div key={name} className="flex items-center justify-between p-2 bg-slate-900/40 rounded">
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-blue-300">{name}</code>
                      {field.role && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded">
                          {field.role.split('.').pop()}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-500">{field.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Transform Node Detail
// ═══════════════════════════════════════════════════════════════

const TransformDetail = ({ node, packSpec, journeyData }) => {
  const [showParams, setShowParams] = useState(false);

  // Find the pipeline step this node references
  const pipeline = packSpec?.transformModel?.pipeline || [];
  const step = node.stepRef ? pipeline.find(s => s.id === node.stepRef) : null;

  // Find connected nodes from edges
  const edges = journeyData.transformGraph?.edges || [];
  const incomingNodes = edges.filter(e => e.to === node.id).map(e => e.from);
  const outgoingNodes = edges.filter(e => e.from === node.id).map(e => e.to);

  return (
    <div className="p-4 h-full overflow-auto">
      <NodeHeader
        icon={Layers}
        title={node.label}
        subtitle={step?.op || 'Transform Operation'}
        color="purple"
      />

      <div className="mt-4 space-y-4">
        {/* Operation badge */}
        {step?.op && (
          <div className="flex items-center gap-2">
            <code className="px-2 py-1 text-xs bg-purple-900/30 text-purple-300 rounded border border-purple-600/40 font-mono">
              {step.op}
            </code>
          </div>
        )}

        {/* Visual notes */}
        {step?.visual?.notes && (
          <p className="text-sm text-slate-400 bg-slate-800/40 p-3 rounded-lg border border-slate-700">
            {step.visual.notes}
          </p>
        )}

        {/* Data Flow */}
        <div className="bg-slate-800/40 rounded-lg border border-slate-700 p-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">Data Flow</h4>

          {/* Input */}
          {step?.in && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-500 w-12">Input:</span>
              <code className="px-2 py-1 text-xs bg-blue-900/30 text-blue-300 rounded">
                {step.in}
              </code>
            </div>
          )}

          {step?.from && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-500 w-12">From:</span>
              <code className="px-2 py-1 text-xs bg-blue-900/30 text-blue-300 rounded">
                {step.from}
              </code>
            </div>
          )}

          {/* Output */}
          {step?.out && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-500 w-12">Output:</span>
              <code className="px-2 py-1 text-xs bg-emerald-900/30 text-emerald-300 rounded">
                {step.out}
              </code>
            </div>
          )}

          {step?.toStore && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-12">Sink:</span>
              <div className="flex items-center gap-2">
                <Database className="w-3 h-3 text-emerald-400" />
                <code className="px-2 py-1 text-xs bg-emerald-900/30 text-emerald-300 rounded">
                  {step.toStore.replace('store:', '')}
                </code>
              </div>
            </div>
          )}
        </div>

        {/* Extra Fields (for materialize steps) */}
        {step?.extraFields && (
          <div className="bg-slate-800/40 rounded-lg border border-slate-700 p-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">Materialized Fields</h4>
            <div className="space-y-1">
              {step.extraFields.map((ef, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <code className="text-emerald-300">{ef.field}</code>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <code className="text-slate-400">{ef.from}</code>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Parameters */}
        {step?.params && Object.keys(step.params).length > 0 && (
          <div className="bg-slate-800/40 rounded-lg border border-slate-700 overflow-hidden">
            <button
              onClick={() => setShowParams(!showParams)}
              className="w-full flex items-center justify-between p-3 hover:bg-slate-700/30"
            >
              <span className="text-xs font-semibold text-slate-400 uppercase">Parameters</span>
              {showParams ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
            </button>
            {showParams && (
              <pre className="p-3 text-xs text-slate-300 font-mono overflow-auto max-h-40 border-t border-slate-700">
                {JSON.stringify(step.params, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Sink (Collection) Node Detail
// ═══════════════════════════════════════════════════════════════

const SinkDetail = ({ node, packSpec, encodingProfile, journeyData }) => {
  // Find the collection entity from viz.collectionModel
  const entity = journeyData.collectionModel?.entities?.find(e => e.id === node.entityRef);

  // Find the store from storageModel
  const stores = packSpec?.storageModel?.stores || [];
  const store = entity?.store ? stores.find(s => s.id === entity.store) : null;

  // Find the destination type from logicalModel
  const destTypes = packSpec?.logicalModel?.destinations?.types || [];
  const destType = store?.destinationType ? destTypes.find(d => d.id === store.destinationType) : null;

  const hasAtlasSearch = store?.search?.kind === 'atlas_search';

  return (
    <div className="p-4 h-full overflow-auto">
      <NodeHeader
        icon={hasAtlasSearch ? Search : Database}
        title={entity?.label || node.label}
        subtitle={store?.title || 'Collection'}
        color={hasAtlasSearch ? 'amber' : 'emerald'}
      />

      <div className="mt-4 space-y-4">
        {/* Badges */}
        {entity?.badges && (
          <div className="flex flex-wrap gap-1.5">
            {entity.badges.map((badge, i) => (
              <span key={i} className={`px-2 py-0.5 text-xs rounded border ${
                badge === 'canonical' ? 'bg-emerald-900/30 text-emerald-300 border-emerald-600/40' :
                badge === 'slim' ? 'bg-amber-900/30 text-amber-300 border-amber-600/40' :
                badge === 'search-indexed' ? 'bg-purple-900/30 text-purple-300 border-purple-600/40' :
                'bg-slate-700 text-slate-300 border-slate-600'
              }`}>
                {badge}
              </span>
            ))}
          </div>
        )}

        {/* Fields from viz.collectionModel */}
        {entity?.fields && (
          <div className="bg-slate-800/40 rounded-lg border border-slate-700 p-4">
            <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Table className="w-4 h-4 text-emerald-400" />
              Schema Fields
            </h4>
            <div className="space-y-1">
              {entity.fields.map((fieldName, i) => {
                const isExpandable = entity.expand?.[fieldName];
                const nestedFields = isExpandable ? entity.expand[fieldName] : null;

                return (
                  <div key={i}>
                    <div className="flex items-center justify-between p-2 bg-slate-900/40 rounded">
                      <div className="flex items-center gap-2">
                        {fieldName === '_id' && <Key className="w-3 h-3 text-amber-400" />}
                        <code className="text-xs text-slate-300">{fieldName}</code>
                        {isExpandable && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-purple-900/40 text-purple-300 rounded">
                            expandable
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Nested fields */}
                    {nestedFields && (
                      <div className="ml-4 mt-1 pl-2 border-l border-slate-700">
                        {nestedFields.map((nf, j) => (
                          <div key={j} className="flex items-center gap-2 py-1 text-xs text-slate-400">
                            <Route className="w-3 h-3 text-slate-500" />
                            <code>{nf}</code>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* B-tree Indexes */}
        {store?.indexes?.length > 0 && (
          <div className="bg-slate-800/40 rounded-lg border border-slate-700 p-4">
            <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" />
              B-tree Indexes
            </h4>
            <div className="space-y-2">
              {store.indexes.map((idx, i) => (
                <div key={i} className="bg-slate-900/40 rounded p-2">
                  <div className="flex items-center justify-between mb-1">
                    <code className="text-xs text-slate-300">{idx.id}</code>
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-900/40 text-blue-300 rounded">
                      {idx.type}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {idx.fields?.map((f, j) => (
                      <code key={j} className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
                        {f}
                      </code>
                    ))}
                  </div>
                  {idx.purpose && (
                    <p className="text-[10px] text-slate-500">{idx.purpose}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Atlas Search */}
        {hasAtlasSearch && (
          <div className="bg-gradient-to-br from-purple-900/20 to-amber-900/20 rounded-lg border border-purple-600/30 p-4">
            <h4 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
              <Search className="w-4 h-4" />
              Atlas Search Index
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Index Name</span>
                <code className="text-purple-200">${`{config.${store.search.indexNameFromConfig}}`}</code>
              </div>
              {store.search.definitionRef && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Definition</span>
                  <code className="text-purple-200">{store.search.definitionRef}</code>
                </div>
              )}
              {store.search.purpose && (
                <p className="text-slate-400 mt-2 pt-2 border-t border-purple-600/30">
                  {store.search.purpose}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Links to other collections */}
        {entity?.links?.length > 0 && (
          <div className="bg-slate-800/40 rounded-lg border border-slate-700 p-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">Joins</h4>
            {entity.links.map((link, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <ArrowRight className="w-3 h-3 text-emerald-400" />
                <span className="text-slate-400">{link.type}</span>
                <code className="text-emerald-300">{link.target}</code>
                <span className="text-slate-500">on</span>
                <code className="text-slate-300">{link.on}</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Shared Components
// ═══════════════════════════════════════════════════════════════

const NodeHeader = ({ icon: Icon, title, subtitle, color }) => {
  const colorClasses = {
    blue: 'bg-blue-900/30 border-blue-600/40 text-blue-400',
    purple: 'bg-purple-900/30 border-purple-600/40 text-purple-400',
    emerald: 'bg-emerald-900/30 border-emerald-600/40 text-emerald-400',
    amber: 'bg-amber-900/30 border-amber-600/40 text-amber-400'
  };

  return (
    <div className="flex items-start gap-3">
      <div className={`p-2.5 rounded-lg border ${colorClasses[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-semibold text-white truncate">{title}</h3>
        <p className="text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
};

export default NodeDetailPanel;
