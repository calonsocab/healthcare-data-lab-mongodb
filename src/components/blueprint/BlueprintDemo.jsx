// BlueprintDemo.jsx
// Demo component showcasing the Blueprint library capabilities

"use client";

import React, { useState } from 'react';
import BlueprintCanvas from './BlueprintCanvas';
import BlueprintNode from './BlueprintNode';
import BlueprintGroup from './BlueprintGroup';
import BlueprintLabel from './BlueprintLabel';
import BlueprintBadge from './BlueprintBadge';
import DualStoreLayout from './presets/DualStoreLayout';
import {
  MongoDBLeaf,
  AtlasCloud,
  AtlasSearch,
  Collection,
  Document,
  Index,
  Aggregation,
  Query,
  Transform,
  Ingest,
  Flatten,
  VectorSearch,
} from './icons';

/**
 * BlueprintDemo - Showcase component for the Blueprint library
 *
 * This component demonstrates all the building blocks available
 * and shows a complete example with the DualStoreLayout preset.
 */
const BlueprintDemo = () => {
  const [activeTab, setActiveTab] = useState('preset');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <MongoDBLeaf size={28} color="#00ED64" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Blueprint Component Library</h1>
            <p className="text-slate-400">MongoDB-style architecture diagram components</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-700">
        {[
          { id: 'preset', label: 'Strategy Preset' },
          { id: 'nodes', label: 'Nodes' },
          { id: 'icons', label: 'Icons' },
          { id: 'badges', label: 'Badges' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-6">
        {/* Strategy Preset Demo */}
        {activeTab === 'preset' && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Dual-Store Strategy Layout</h2>
            <p className="text-sm text-slate-400 mb-6">
              This preset demonstrates a complete data model diagram for the Reversed Path Search strategy.
            </p>
            <DualStoreLayout
              interactive
              onNodeClick={(nodeId) => console.log('Clicked node:', nodeId)}
            />
          </div>
        )}

        {/* Nodes Demo */}
        {activeTab === 'nodes' && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Node Variants</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <BlueprintNode
                title="Primary"
                subtitle="MongoDB Green"
                variant="primary"
                icon={MongoDBLeaf}
              />
              <BlueprintNode
                title="Primary Outline"
                subtitle="Green border"
                variant="primary-outline"
                icon={AtlasCloud}
              />
              <BlueprintNode
                title="Cyan"
                subtitle="Teal/cyan"
                variant="cyan"
                icon={Collection}
              />
              <BlueprintNode
                title="Cyan Outline"
                variant="cyan-outline"
                subtitle="Cyan border"
                icon={AtlasSearch}
              />
              <BlueprintNode
                title="Purple"
                subtitle="Purple fill"
                variant="purple"
                icon={Query}
              />
              <BlueprintNode
                title="Purple Outline"
                subtitle="Purple border"
                variant="purple-outline"
                icon={VectorSearch}
              />
              <BlueprintNode
                title="Info"
                subtitle="Pink/purple info"
                variant="info"
                icon={Document}
              />
              <BlueprintNode
                title="Pipeline"
                subtitle="Dark stage"
                variant="pipeline"
                icon={Aggregation}
              />
              <BlueprintNode
                title="Slate"
                subtitle="Gray fill"
                variant="slate"
                icon={Index}
              />
              <BlueprintNode
                title="Ghost"
                subtitle="Transparent"
                variant="ghost"
                icon={Transform}
              />
              <BlueprintNode
                title="With Badges"
                subtitle="Multiple badges"
                variant="cyan"
                badges={[
                  { label: 'B-tree', background: 'rgba(59,130,246,0.2)', color: '#60a5fa' },
                  { label: 'Patient', background: 'rgba(168,85,247,0.2)', color: '#c084fc' },
                ]}
              />
              <BlueprintNode
                title="Dashed"
                subtitle="Dashed border"
                variant="slate-outline"
                dashed
                icon={Ingest}
              />
            </div>

            <h2 className="text-lg font-semibold text-white mt-8 mb-4">Group Containers</h2>
            <div className="grid grid-cols-2 gap-6">
              <BlueprintGroup title="Default Group" variant="default" padding={12}>
                <BlueprintNode title="Node A" variant="primary" width={100} />
                <BlueprintNode title="Node B" variant="primary-outline" width={100} />
              </BlueprintGroup>

              <BlueprintGroup title="Info Callout" variant="info" padding={12}>
                <BlueprintLabel variant="info">
                  This is an info callout with explanatory text about the architecture.
                </BlueprintLabel>
              </BlueprintGroup>

              <BlueprintGroup title="Solid Dark" variant="solid" padding={12}>
                <BlueprintNode title="Stage 1" variant="pipeline" width={100} />
                <BlueprintNode title="Stage 2" variant="pipeline" width={100} />
              </BlueprintGroup>

              <BlueprintGroup variant="dashed" padding={12} headerPosition="inside-top" title="Legacy Component">
                <BlueprintNode title="Legacy App" variant="ghost" width={120} dashed />
              </BlueprintGroup>
            </div>
          </div>
        )}

        {/* Icons Demo */}
        {activeTab === 'icons' && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">MongoDB Icons</h2>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-6">
              {[
                { Icon: MongoDBLeaf, name: 'MongoDB Leaf' },
                { Icon: AtlasCloud, name: 'Atlas Cloud' },
                { Icon: AtlasSearch, name: 'Atlas Search' },
                { Icon: Collection, name: 'Collection' },
                { Icon: Document, name: 'Document' },
                { Icon: Index, name: 'Index' },
                { Icon: Aggregation, name: 'Aggregation' },
                { Icon: Query, name: 'Query' },
                { Icon: Transform, name: 'Transform' },
                { Icon: Ingest, name: 'Ingest' },
                { Icon: Flatten, name: 'Flatten' },
                { Icon: VectorSearch, name: 'Vector Search' },
              ].map(({ Icon, name }) => (
                <div key={name} className="flex flex-col items-center gap-2 p-4 rounded-lg bg-slate-800/50">
                  <Icon size={32} color="#00ED64" />
                  <span className="text-xs text-slate-400 text-center">{name}</span>
                </div>
              ))}
            </div>

            <h3 className="text-md font-semibold text-white mt-8 mb-4">Icon Colors</h3>
            <div className="flex gap-6">
              <div className="flex flex-col items-center gap-2">
                <MongoDBLeaf size={40} color="#00ED64" />
                <span className="text-xs text-slate-400">Primary</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <AtlasSearch size={40} color="#a855f7" />
                <span className="text-xs text-slate-400">Purple</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Collection size={40} color="#0d9488" />
                <span className="text-xs text-slate-400">Cyan</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Query size={40} color="#f59e0b" />
                <span className="text-xs text-slate-400">Amber</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Document size={40} color="#ec4899" />
                <span className="text-xs text-slate-400">Pink</span>
              </div>
            </div>
          </div>
        )}

        {/* Badges Demo */}
        {activeTab === 'badges' && (
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Badge Variants</h2>
            <div className="flex flex-wrap gap-3">
              <BlueprintBadge label="Default" variant="default" />
              <BlueprintBadge label="Primary" variant="primary" />
              <BlueprintBadge label="Purple" variant="purple" />
              <BlueprintBadge label="Cyan" variant="cyan" />
              <BlueprintBadge label="Blue" variant="blue" />
              <BlueprintBadge label="Amber" variant="amber" />
              <BlueprintBadge label="Pink" variant="pink" />
              <BlueprintBadge label="Success" variant="success" />
            </div>

            <h3 className="text-md font-semibold text-white mt-8 mb-4">Semantic Badges</h3>
            <div className="flex flex-wrap gap-3">
              <BlueprintBadge label="Atlas Search" variant="atlas-search" />
              <BlueprintBadge label="B-tree" variant="btree" />
              <BlueprintBadge label="Patient" variant="patient" />
              <BlueprintBadge label="Population" variant="population" />
            </div>

            <h3 className="text-md font-semibold text-white mt-8 mb-4">Label Variants</h3>
            <div className="space-y-3">
              <BlueprintLabel text="Default label text" variant="default" />
              <BlueprintLabel text="Emphasis label" variant="emphasis" />
              <BlueprintLabel text="Caption text" variant="caption" />
              <BlueprintLabel text="code_variable" variant="code" />
              <BlueprintLabel text="Primary highlight" variant="primary" />
              <BlueprintLabel text="Info callout with background" variant="info" />
              <BlueprintLabel text="Cyan callout" variant="cyan" />
            </div>
          </div>
        )}
      </div>

      {/* Usage Instructions */}
      <div className="mt-8 p-4 rounded-lg bg-slate-800/30 border border-slate-700">
        <h3 className="text-sm font-semibold text-white mb-2">Usage</h3>
        <pre className="text-xs text-slate-400 overflow-x-auto">
{`import {
  BlueprintCanvas,
  BlueprintNode,
  BlueprintGroup,
  MongoDBLeaf,
  AtlasSearch
} from '@/components/blueprint';

// Use preset layouts
import { DualStoreLayout } from '@/components/blueprint';

<DualStoreLayout
  interactive
  onNodeClick={(nodeId) => console.log(nodeId)}
/>`}
        </pre>
      </div>
    </div>
  );
};

export default BlueprintDemo;
