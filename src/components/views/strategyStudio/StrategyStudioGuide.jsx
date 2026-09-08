// src/components/views/strategyStudio/StrategyStudioGuide.jsx
"use client";

import React, { useState } from 'react';
import {
  BookOpen,
  Database,
  Layers,
  Settings,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Target,
  Zap,
  Shield,
  GitBranch,
  Box,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Workflow,
  Server,
  FileJson,
  Search,
  Users,
  Rocket,
  FilePlus,
  ClipboardCheck,
  Package,
  Repeat,
  Wand2
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * StrategyStudioGuide - Comprehensive learning documentation for Strategy Studio
 *
 * This component provides educational content explaining:
 * - What persistence strategies are
 * - Key concepts (Blueprints, Strategies, Environments, Strategy Links)
 * - The workflow from strategy selection to deployment
 * - Configuration options and best practices
 * - Multi-standard support (openEHR, FHIR, etc.)
 */

// Expandable section component
const ExpandableSection = ({ title, icon: Icon, children, defaultOpen = false, accentColor = 'primary' }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const colorClasses = {
    primary: 'text-primary bg-primary/10 border-primary/30',
    success: 'text-success bg-success/10 border-success/30',
    warning: 'text-warning bg-warning/10 border-warning/30',
    accent: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  };

  return (
    <div className="border border-theme/30 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-surface-hover/50 hover:bg-surface-hover transition-colors"
      >
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg border", colorClasses[accentColor])}>
              <Icon size={18} />
            </div>
            <span className="font-medium text-theme-primary">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown size={18} className="text-theme-secondary" />
        ) : (
          <ChevronRight size={18} className="text-theme-secondary" />
        )}

        {/* Deploy Strategies Tab */}
        {activeTab === 'deploy' && (
          <div className="space-y-5">
            <div className="bg-gradient-to-r from-emerald-600/15 via-surface to-sky-500/10 border border-emerald-500/30 rounded-lg p-5">
              <div className="flex items-start gap-3">
                <Rocket size={20} className="text-emerald-400 mt-0.5" />
                <div>
                  <h3 className="text-lg font-semibold text-theme-primary mb-1">Deploy Strategies</h3>
                  <p className="text-sm text-theme-secondary">
                    Move from catalog exploration to real, multi-environment deployments. Keep strategies immutable,
                    ship overrides per environment, and lean on Kehrnel bundles to accelerate enrichment.
                  </p>
                </div>
              </div>
            </div>

            <ExpandableSection title="Level 3 — Bundle-driven enrichment" icon={Wand2} accentColor="accent" defaultOpen>
              <div className="space-y-3 text-sm text-theme-secondary">
                <p>
                  Add new field mappings and shortcuts without touching code. Bundles let you repeat creative patterns safely and fast.
                </p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li><strong className="text-theme-primary">Create/select a bundle</strong> in HDL (wizard or raw JSON).</li>
                  <li><strong className="text-theme-primary">Validate</strong> the bundle via Kehrnel CLI/API to ensure schema and rules pass.</li>
                  <li><strong className="text-theme-primary">Import</strong> into the Kehrnel bundle store.</li>
                  <li><strong className="text-theme-primary">Activate</strong> a strategy referencing that bundle (set <code className="text-amber-300">bundleId</code> in config overrides).</li>
                </ol>
                <div className="bg-surface-hover/50 rounded-lg p-3 text-xs text-theme-secondary border border-theme/30">
                  Tip: Store bundleId alongside activation metadata. Config hashes and manifest digests help you trace exactly which bundle powered an activation.
                </div>
              </div>
            </ExpandableSection>

            <ExpandableSection title="Level 4 — Publish a new Strategy Pack" icon={FilePlus} accentColor="primary">
              <div className="space-y-3 text-sm text-theme-secondary">
                <p>
                  Build and publish a brand-new persistence strategy implementation, end-to-end.
                </p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li><strong className="text-theme-primary">Scaffold a pack</strong>: manifest, defaults, config schema, Python entrypoint.</li>
                  <li><strong className="text-theme-primary">Run local tests</strong> (kehrnel-validate-pack or CLI) to catch schema/ops issues.</li>
                  <li><strong className="text-theme-primary">Register</strong> the pack in the Kehrnel registry.</li>
                  <li><strong className="text-theme-primary">Verify</strong> it appears in <code className="text-amber-300">/strategies</code> and HDL catalog automatically.</li>
                </ol>
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-xs text-theme-secondary">
                  Benefit: once published, the pack is selectable like any other catalog entry; environments can activate it with overrides and audit via activation_id + config_hash + manifest_digest.
                </div>
              </div>
            </ExpandableSection>

            <ExpandableSection title="Safety & traceability" icon={ClipboardCheck} accentColor="warning">
              <div className="space-y-2 text-sm text-theme-secondary">
                <p>Strategy remains immutable. You only edit <strong className="text-theme-primary">configOverrides</strong> per environment.</p>
                <p>Kehrnel returns <code className="text-amber-300">config_hash</code> and <code className="text-amber-300">manifest_digest</code>; HDL stores them on the domain link for audits.</p>
                <p>Switching strategies in a domain replaces the link (no duplicates) and records <code className="text-amber-300">activation_id</code> and previous activation if provided.</p>
              </div>
            </ExpandableSection>
          </div>
        )}
      </button>
      {isOpen && (
        <div className="px-4 py-4 bg-surface/50 border-t border-theme/30">
          {children}
        </div>
      )}
    </div>
  );
};

// Concept card component
const ConceptCard = ({ icon: Icon, title, description, color = 'primary' }) => {
  const colorClasses = {
    primary: 'text-primary bg-primary/20',
    success: 'text-success bg-success/20',
    warning: 'text-warning bg-warning/20',
    accent: 'text-blue-400 bg-blue-500/20',
    purple: 'text-purple-400 bg-purple-500/20',
  };

  return (
    <div className="bg-surface/50 rounded-lg p-4 border border-theme/30">
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-lg flex-shrink-0", colorClasses[color])}>
          <Icon size={20} />
        </div>
        <div>
          <h4 className="font-medium text-theme-primary mb-1">{title}</h4>
          <p className="text-sm text-theme-secondary leading-relaxed">{description}</p>
        </div>
      </div>
    </div>
  );
};

// Workflow step component
const WorkflowStep = ({ number, title, description, icon: Icon }) => (
  <div className="flex items-start gap-4">
    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center">
      <span className="text-primary font-bold">{number}</span>
    </div>
    <div className="flex-1 pb-6 border-l-2 border-theme/30 pl-6 -ml-5 mt-5">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className="text-primary" />
        <h4 className="font-medium text-theme-primary">{title}</h4>
      </div>
      <p className="text-sm text-theme-secondary">{description}</p>
    </div>
  </div>
);

// Strategy comparison table
const StrategyComparison = () => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-theme/50">
          <th className="text-left py-2 px-3 text-theme-primary font-medium">Strategy</th>
          <th className="text-left py-2 px-3 text-theme-primary font-medium">Best For</th>
          <th className="text-left py-2 px-3 text-theme-primary font-medium">Query Type</th>
          <th className="text-left py-2 px-3 text-theme-primary font-medium">Complexity</th>
        </tr>
      </thead>
      <tbody className="text-theme-secondary">
        <tr className="border-b border-theme/30">
          <td className="py-2 px-3 font-medium text-theme-primary">CCQ</td>
          <td className="py-2 px-3">Simple templates, patient queries</td>
          <td className="py-2 px-3">Nested $elemMatch</td>
          <td className="py-2 px-3"><span className="px-2 py-0.5 rounded-full bg-success/20 text-success text-xs">Low</span></td>
        </tr>
        <tr className="border-b border-theme/30">
          <td className="py-2 px-3 font-medium text-theme-primary">AAI</td>
          <td className="py-2 px-3">Variable-depth templates, CONTAINS</td>
          <td className="py-2 px-3">Ancestor matching</td>
          <td className="py-2 px-3"><span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning text-xs">Medium</span></td>
        </tr>
        <tr className="border-b border-theme/30">
          <td className="py-2 px-3 font-medium text-theme-primary">RPB</td>
          <td className="py-2 px-3">Cost-efficient, no Atlas Search</td>
          <td className="py-2 px-3">B-tree reversed path</td>
          <td className="py-2 px-3"><span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning text-xs">Medium</span></td>
        </tr>
        <tr className="border-b border-theme/30">
          <td className="py-2 px-3 font-medium text-theme-primary">RPS-Single</td>
          <td className="py-2 px-3">Balanced patient + population</td>
          <td className="py-2 px-3">Dual indexing</td>
          <td className="py-2 px-3"><span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning text-xs">Medium</span></td>
        </tr>
        <tr>
          <td className="py-2 px-3 font-medium text-theme-primary">RPS-Dual</td>
          <td className="py-2 px-3">National scale, high performance</td>
          <td className="py-2 px-3">Atlas Search first</td>
          <td className="py-2 px-3"><span className="px-2 py-0.5 rounded-full bg-error/20 text-error text-xs">High</span></td>
        </tr>
      </tbody>
    </table>
  </div>
);

const StrategyStudioGuide = ({ showFullGuide = true, initialTab = 'overview' }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'overview');

  React.useEffect(() => {
    setActiveTab(initialTab || 'overview');
  }, [initialTab]);

  // Quick tips for collapsed view
  if (!showFullGuide) {
    return (
      <div className="bg-gradient-to-br from-primary/5 to-surface rounded-lg border border-primary/20 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Lightbulb size={20} className="text-primary" />
          </div>
          <div>
            <h4 className="font-medium text-theme-primary mb-1">Quick Tips</h4>
            <ul className="text-sm text-theme-secondary space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-success" />
                <span>Strategies are read-only templates - customize via config overrides</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-success" />
                <span>One active strategy per data product type (openEHR, FHIR)</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-success" />
                <span>Changes are stored per environment, not on the strategy itself</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary/10 via-surface to-blue-500/5 rounded-xl border border-primary/20 p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
            <BookOpen size={28} className="text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-theme-primary mb-2">Strategy Studio Guide</h2>
            <p className="text-theme-secondary leading-relaxed">
              The Strategy Studio is the central hub for managing how your healthcare data is persisted, indexed, and queried.
              It provides a catalog of pre-built persistence strategies optimized for different data standards (openEHR, FHIR)
              and query patterns, allowing you to choose the best approach for your use case without building from scratch.
            </p>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-2 mt-6 border-t border-theme/30 pt-4">
          {[
            { id: 'overview', label: 'Overview', icon: BookOpen },
            { id: 'concepts', label: 'Key Concepts', icon: Layers },
            { id: 'workflow', label: 'Workflow', icon: Workflow },
            { id: 'strategies', label: 'Strategies', icon: Database },
            { id: 'configuration', label: 'Configuration', icon: Settings },
            { id: 'deploy', label: 'Deploy Strategies', icon: Rocket },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors",
                activeTab === tab.id
                  ? "bg-primary text-primary-text"
                  : "text-theme-secondary hover:text-theme-primary hover:bg-surface-hover"
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <ConceptCard
                icon={Shield}
                title="Read-Only Templates"
                description="Strategies are system-curated blueprints. You activate them for your environment and customize via configuration overrides."
                color="primary"
              />
              <ConceptCard
                icon={Target}
                title="Multi-Standard Support"
                description="Built for multiple data standards including openEHR and FHIR, with each requiring its own optimized persistence approach."
                color="success"
              />
              <ConceptCard
                icon={Zap}
                title="Performance Optimized"
                description="Each strategy is designed for specific query patterns - from patient-scoped lookups to population-wide analytics."
                color="warning"
              />
            </div>

            <div className="bg-surface rounded-lg border border-theme/30 p-5">
              <h3 className="font-semibold text-theme-primary mb-3 flex items-center gap-2">
                <HelpCircle size={18} className="text-primary" />
                Why Persistence Strategies Matter
              </h3>
              <div className="space-y-3 text-sm text-theme-secondary">
                <p>
                  Healthcare data standards like openEHR and FHIR are complex hierarchical structures. The way you store and index
                  this data dramatically affects query performance, storage costs, and the types of queries you can efficiently execute.
                </p>
                <p>
                  A <strong className="text-theme-primary">persistence strategy</strong> defines:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>How documents are structured in MongoDB collections</li>
                  <li>Which fields are indexed and how (B-tree, Atlas Search)</li>
                  <li>How archetype paths are encoded and stored</li>
                  <li>The query engine mode (patient-scoped vs population queries)</li>
                  <li>Collection topology (single collection vs dual collection)</li>
                </ul>
              </div>
            </div>

            <div className="bg-primary/5 rounded-lg border border-primary/20 p-4">
              <div className="flex items-start gap-3">
                <Lightbulb size={20} className="text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium text-theme-primary mb-1">Getting Started</h4>
                  <p className="text-sm text-theme-secondary">
                    Browse the strategy catalog, review each strategy's benefits and constraints, then activate the one that
                    best matches your query patterns and scale requirements. You can always switch strategies later.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Key Concepts Tab */}
        {activeTab === 'concepts' && (
          <div className="space-y-4">
            <ExpandableSection title="Blueprints" icon={Box} defaultOpen={true} accentColor="primary">
              <div className="space-y-3">
                <p className="text-sm text-theme-secondary">
                  A <strong className="text-theme-primary">Blueprint</strong> is the read-only template that defines a persistence strategy's
                  core architecture. It includes:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-surface-hover/50 rounded-lg p-3">
                    <h5 className="text-sm font-medium text-theme-primary mb-1">Metadata</h5>
                    <ul className="text-xs text-theme-secondary space-y-1">
                      <li>• Domain (openEHR, FHIR)</li>
                      <li>• Query focus (patient-scoped, population)</li>
                      <li>• Complexity level</li>
                      <li>• Benefits & constraints</li>
                    </ul>
                  </div>
                  <div className="bg-surface-hover/50 rounded-lg p-3">
                    <h5 className="text-sm font-medium text-theme-primary mb-1">Technical Specs</h5>
                    <ul className="text-xs text-theme-secondary space-y-1">
                      <li>• Collection topology</li>
                      <li>• Index templates</li>
                      <li>• Field mappings</li>
                      <li>• Query engine mode</li>
                    </ul>
                  </div>
                </div>
              </div>
            </ExpandableSection>

            <ExpandableSection title="Strategies" icon={Database} accentColor="success">
              <div className="space-y-3">
                <p className="text-sm text-theme-secondary">
                  A <strong className="text-theme-primary">Strategy</strong> is a database document that combines a blueprint with
                  default configuration and documentation. Strategies are managed by the system and cannot be created or deleted by users.
                </p>
                <div className="bg-surface-hover/50 rounded-lg p-3">
                  <h5 className="text-sm font-medium text-theme-primary mb-2">Strategy Properties</h5>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="text-theme-secondary">Name & Description</div>
                    <div className="text-theme-primary">User-friendly identification</div>
                    <div className="text-theme-secondary">Blueprint</div>
                    <div className="text-theme-primary">Technical architecture</div>
                    <div className="text-theme-secondary">Default Config</div>
                    <div className="text-theme-primary">Collection names, field mappings</div>
                    <div className="text-theme-secondary">Documentation Tabs</div>
                    <div className="text-theme-primary">Schema, indexing, enrichment info</div>
                  </div>
                </div>
              </div>
            </ExpandableSection>

            <ExpandableSection title="Environments" icon={Server} accentColor="accent">
              <div className="space-y-3">
                <p className="text-sm text-theme-secondary">
                  An <strong className="text-theme-primary">Environment</strong> represents a deployment target (e.g., DEV, STAGING, PROD).
                  Each environment connects to a MongoDB database and has its own set of strategy links.
                </p>
                <div className="bg-surface-hover/50 rounded-lg p-3">
                  <h5 className="text-sm font-medium text-theme-primary mb-2">Environment Contains</h5>
                  <ul className="text-xs text-theme-secondary space-y-1">
                    <li>• <strong className="text-theme-primary">Connection:</strong> Database name, connection string</li>
                    <li>• <strong className="text-theme-primary">Strategy Links:</strong> One active strategy per data product type</li>
                    <li>• <strong className="text-theme-primary">Config Overrides:</strong> Custom settings that override strategy defaults</li>
                  </ul>
                </div>
              </div>
            </ExpandableSection>

            <ExpandableSection title="Strategy Links" icon={GitBranch} accentColor="warning">
              <div className="space-y-3">
                <p className="text-sm text-theme-secondary">
                  A <strong className="text-theme-primary">Strategy Link</strong> connects a strategy to an environment with optional
                  configuration customizations. This is where your custom settings are stored.
                </p>
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                  <h5 className="text-sm font-medium text-warning mb-1">Important</h5>
                  <p className="text-xs text-theme-secondary">
                    Each environment can have only <strong className="text-theme-primary">one active strategy per data product type</strong>.
                    For example, one openEHR strategy and one FHIR strategy can be active simultaneously.
                  </p>
                </div>
                <div className="bg-surface-hover/50 rounded-lg p-3">
                  <h5 className="text-sm font-medium text-theme-primary mb-2">Link Properties</h5>
                  <ul className="text-xs text-theme-secondary space-y-1">
                    <li>• <strong className="text-theme-primary">strategyId:</strong> Reference to the system strategy</li>
                    <li>• <strong className="text-theme-primary">domain:</strong> openEHR, FHIR, or Genomics</li>
                    <li>• <strong className="text-theme-primary">configOverrides:</strong> Your custom configuration (merged with defaults)</li>
                    <li>• <strong className="text-theme-primary">contexts:</strong> Which operations use this strategy (synthetic, query, API)</li>
                  </ul>
                </div>
              </div>
            </ExpandableSection>

            <ExpandableSection title="Configuration Merging" icon={FileJson} accentColor="purple">
              <div className="space-y-3">
                <p className="text-sm text-theme-secondary">
                  When a strategy is used, the final configuration is computed by deep-merging the strategy's default config
                  with your environment's config overrides.
                </p>
                <div className="bg-surface-hover/50 rounded-lg p-3 font-mono text-xs">
                  <div className="text-theme-secondary mb-2">// Example merge:</div>
                  <div className="text-theme-primary">
                    <div>Strategy Default: {"{ collections: { compositions: 'comps' } }"}</div>
                    <div className="text-warning mt-1">+ Your Override: {"{ collections: { compositions: 'my_comps' } }"}</div>
                    <div className="text-success mt-1">= Final Config: {"{ collections: { compositions: 'my_comps' } }"}</div>
                  </div>
                </div>
              </div>
            </ExpandableSection>
          </div>
        )}

        {/* Workflow Tab */}
        {activeTab === 'workflow' && (
          <div className="space-y-6">
            <div className="bg-surface rounded-lg border border-theme/30 p-5">
              <h3 className="font-semibold text-theme-primary mb-4">Strategy Activation Workflow</h3>
              <div className="space-y-0">
                <WorkflowStep
                  number="1"
                  title="Browse Strategy Catalog"
                  description="Explore available strategies filtered by domain (openEHR, FHIR). Review each strategy's benefits, constraints, and recommended use cases."
                  icon={Search}
                />
                <WorkflowStep
                  number="2"
                  title="Review Strategy Details"
                  description="Click on a strategy to see detailed documentation including schema architecture, indexing approach, and query capabilities."
                  icon={BookOpen}
                />
                <WorkflowStep
                  number="3"
                  title="Activate for Environment"
                  description="Select your target environment and click 'Activate'. This creates a strategy link associating the strategy with your environment."
                  icon={Zap}
                />
                <WorkflowStep
                  number="4"
                  title="Customize Configuration"
                  description="Once activated, customize collection names, field mappings, or other settings. Changes are saved as config overrides on your environment."
                  icon={Settings}
                />
                <WorkflowStep
                  number="5"
                  title="Use in Operations"
                  description="The strategy is now used for synthetic data generation, query execution, and API operations targeting that environment."
                  icon={CheckCircle2}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-success/10 border border-success/30 rounded-lg p-4">
                <h4 className="font-medium text-success mb-2 flex items-center gap-2">
                  <CheckCircle2 size={18} />
                  Best Practices
                </h4>
                <ul className="text-sm text-theme-secondary space-y-2">
                  <li>• Start with RPS-Dual for most openEHR deployments</li>
                  <li>• Use CCQ only for simple, shallow templates</li>
                  <li>• Test strategies in DEV before activating in PROD</li>
                  <li>• Document your config overrides for team reference</li>
                </ul>
              </div>
              <div className="bg-error/10 border border-error/30 rounded-lg p-4">
                <h4 className="font-medium text-error mb-2 flex items-center gap-2">
                  <AlertTriangle size={18} />
                  Common Pitfalls
                </h4>
                <ul className="text-sm text-theme-secondary space-y-2">
                  <li>• Switching strategies requires data migration</li>
                  <li>• Atlas Search strategies need M10+ clusters</li>
                  <li>• Don't use CCQ for deep nested templates</li>
                  <li>• Ensure indexes are created after activation</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Strategies Tab */}
        {activeTab === 'strategies' && (
          <div className="space-y-6">
            <div className="bg-surface rounded-lg border border-theme/30 p-5">
              <h3 className="font-semibold text-theme-primary mb-4">OpenEHR Strategies Comparison</h3>
              <StrategyComparison />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-surface rounded-lg border border-theme/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Target size={18} className="text-primary" />
                  </div>
                  <h4 className="font-medium text-theme-primary">Patient-Scoped Queries</h4>
                </div>
                <p className="text-sm text-theme-secondary mb-3">
                  Optimized for queries that include an EHR ID (patient identifier). Uses B-tree indexes for fast lookups.
                </p>
                <div className="text-xs text-theme-secondary">
                  <strong className="text-theme-primary">Recommended:</strong> CCQ, RPB, RPS-Single
                </div>
              </div>

              <div className="bg-surface rounded-lg border border-theme/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-success/20">
                    <Users size={18} className="text-success" />
                  </div>
                  <h4 className="font-medium text-theme-primary">Population Queries</h4>
                </div>
                <p className="text-sm text-theme-secondary mb-3">
                  Optimized for queries across all patients. Uses Atlas Search for full-text and path-based searching.
                </p>
                <div className="text-xs text-theme-secondary">
                  <strong className="text-theme-primary">Recommended:</strong> RPS-Dual, RPS-Single, AAI
                </div>
              </div>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Database size={20} className="text-blue-400" />
                </div>
                <div>
                  <h4 className="font-medium text-theme-primary mb-1">FHIR Support (Coming Soon)</h4>
                  <p className="text-sm text-theme-secondary">
                    FHIR Resource-First strategy is planned for future release. It will store native FHIR resources
                    with optimized indexing for FHIR search parameters.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Configuration Tab */}
        {activeTab === 'configuration' && (
          <div className="space-y-4">
            <ExpandableSection title="Collection Settings" icon={Database} defaultOpen={true} accentColor="primary">
              <div className="space-y-3">
                <p className="text-sm text-theme-secondary">
                  Configure the MongoDB collection names where your data will be stored.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-surface-hover/50 rounded-lg p-3">
                    <h5 className="text-sm font-medium text-theme-primary mb-1">compositions</h5>
                    <p className="text-xs text-theme-secondary">Main collection for storing composition documents</p>
                  </div>
                  <div className="bg-surface-hover/50 rounded-lg p-3">
                    <h5 className="text-sm font-medium text-theme-primary mb-1">search / search_nodes</h5>
                    <p className="text-xs text-theme-secondary">Slim collection for Atlas Search (RPS-Dual only)</p>
                  </div>
                  <div className="bg-surface-hover/50 rounded-lg p-3">
                    <h5 className="text-sm font-medium text-theme-primary mb-1">ehr_index / meta</h5>
                    <p className="text-xs text-theme-secondary">Patient metadata and EHR index collection</p>
                  </div>
                  <div className="bg-surface-hover/50 rounded-lg p-3">
                    <h5 className="text-sm font-medium text-theme-primary mb-1">dictionaries</h5>
                    <p className="text-xs text-theme-secondary">Code mappings and terminology shortcuts</p>
                  </div>
                </div>
              </div>
            </ExpandableSection>

            <ExpandableSection title="Field Mappings" icon={FileJson} accentColor="success">
              <div className="space-y-3">
                <p className="text-sm text-theme-secondary">
                  Configure the field names used in your documents. Shorter names reduce storage but affect readability.
                </p>
                <div className="bg-surface-hover/50 rounded-lg p-3 font-mono text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-theme-secondary">ehr_id field:</div>
                    <div className="text-theme-primary">"e" or "ehr_id"</div>
                    <div className="text-theme-secondary">path field:</div>
                    <div className="text-theme-primary">"p" or "path"</div>
                    <div className="text-theme-secondary">nodes field:</div>
                    <div className="text-theme-primary">"cn" or "nodes"</div>
                    <div className="text-theme-secondary">version field:</div>
                    <div className="text-theme-primary">"v" or "version"</div>
                  </div>
                </div>
              </div>
            </ExpandableSection>

            <ExpandableSection title="Coding Options" icon={Settings} accentColor="warning">
              <div className="space-y-3">
                <p className="text-sm text-theme-secondary">
                  Configure how archetype IDs and AT codes are stored. Affects storage size and query syntax.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-surface-hover/50 rounded-lg p-3">
                    <h5 className="text-sm font-medium text-theme-primary mb-1">Archetype ID Storage</h5>
                    <ul className="text-xs text-theme-secondary space-y-1">
                      <li>• <strong>full:</strong> openEHR-EHR-OBSERVATION.blood_pressure.v1</li>
                      <li>• <strong>concept_only:</strong> blood_pressure</li>
                      <li>• <strong>dictionary:</strong> Numeric lookup from dictionary</li>
                    </ul>
                  </div>
                  <div className="bg-surface-hover/50 rounded-lg p-3">
                    <h5 className="text-sm font-medium text-theme-primary mb-1">AT Code Strategy</h5>
                    <ul className="text-xs text-theme-secondary space-y-1">
                      <li>• <strong>as_is:</strong> at0001, at0002</li>
                      <li>• <strong>negative_int:</strong> -1, -2 (compact)</li>
                      <li>• <strong>alpha_compact:</strong> a, b, c (most compact)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </ExpandableSection>

            <ExpandableSection title="Query Engine Settings" icon={Search} accentColor="accent">
              <div className="space-y-3">
                <p className="text-sm text-theme-secondary">
                  Configure query engine behavior based on your strategy's capabilities.
                </p>
                <div className="bg-surface-hover/50 rounded-lg p-3">
                  <h5 className="text-sm font-medium text-theme-primary mb-2">Query Modes</h5>
                  <ul className="text-xs text-theme-secondary space-y-1">
                    <li>• <strong className="text-theme-primary">canonical:</strong> Direct nested $elemMatch (CCQ)</li>
                    <li>• <strong className="text-theme-primary">ancestor_prefix:</strong> Ancestry chain matching (AAI)</li>
                    <li>• <strong className="text-theme-primary">b_tree_reversed_path:</strong> B-tree with reversed paths (RPB)</li>
                    <li>• <strong className="text-theme-primary">atlas_search_first:</strong> Atlas Search with B-tree fallback (RPS)</li>
                  </ul>
                </div>
              </div>
            </ExpandableSection>
          </div>
        )}
      </div>
    </div>
  );
};

export default StrategyStudioGuide;
