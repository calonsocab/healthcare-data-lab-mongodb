// src/components/views/deployStrategies/DeveloperGuide.jsx
"use client";

import React, { useState } from 'react';
import {
  BookOpen,
  FolderTree,
  Code,
  FileJson,
  Terminal,
  Zap,
  Database,
  Search,
  FileInput,
  Settings,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  ExternalLink,
  Package,
  GitBranch
} from 'lucide-react';

/**
 * DeveloperGuide - SDK documentation for creating Kehrnel strategies
 */
const DeveloperGuide = () => {
  const [copiedCode, setCopiedCode] = useState(null);

  const copyToClipboard = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-900/30 border border-blue-600/40">
            <BookOpen className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">Strategy SDK Guide</h2>
            <p className="text-sm text-slate-400">
              Learn how to create custom persistence strategies for Kehrnel
            </p>
          </div>
        </div>

        <a
          href="https://github.com/mongodb-industry-solutions/kehrnel"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors text-sm"
        >
          <GitBranch className="w-4 h-4" />
          View on GitHub
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Strategy Pack Structure */}
      <ExpandableSection
        title="Strategy Pack Structure"
        icon={FolderTree}
        defaultOpen
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            A strategy pack is a directory containing your strategy implementation and metadata files.
          </p>

          <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm">
            <div className="text-slate-300">
              <span className="text-blue-400">my-strategy/</span>
              <div className="ml-4 space-y-1">
                <div><span className="text-emerald-400">manifest.json</span> <span className="text-slate-500"># Required: strategy metadata</span></div>
                <div><span className="text-emerald-400">strategy.py</span> <span className="text-slate-500"># Required: StrategyPlugin class</span></div>
                <div><span className="text-amber-400">schema.json</span> <span className="text-slate-500"># Optional: config JSON Schema</span></div>
                <div><span className="text-amber-400">defaults.json</span> <span className="text-slate-500"># Optional: default config values</span></div>
                <div><span className="text-amber-400">spec.json</span> <span className="text-slate-500"># Optional: pack visualization data</span></div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FileCard
              name="manifest.json"
              required
              description="Declares strategy ID, version, capabilities, and UI metadata"
            />
            <FileCard
              name="strategy.py"
              required
              description="Python class extending StrategyPlugin with capability methods"
            />
            <FileCard
              name="schema.json"
              description="JSON Schema for validating configuration"
            />
            <FileCard
              name="defaults.json"
              description="Default configuration values applied when not overridden"
            />
          </div>
        </div>
      </ExpandableSection>

      {/* Quick Start */}
      <ExpandableSection
        title="Quick Start"
        icon={Terminal}
        defaultOpen
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">1</span>
            <span>Copy the strategy template</span>
          </div>

          <CodeBlock
            code={`cp -r kehrnel/strategy_sdk/strategy-pack-template my-domain/my-strategy
cd my-domain/my-strategy`}
            language="bash"
            onCopy={(code) => copyToClipboard(code, 'copy-template')}
            copied={copiedCode === 'copy-template'}
          />

          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">2</span>
            <span>Update manifest.json with your strategy metadata</span>
          </div>

          <CodeBlock
            code={`{
  "id": "mydomain.my_strategy",
  "name": "My Custom Strategy",
  "version": "0.1.0",
  "domain": "MyDomain",
  "pack_format": "strategy-pack/v1",
  "entrypoint": "strategy:MyStrategy",
  "capabilities": ["ingest", "query"],
  "summary": "A custom persistence strategy"
}`}
            language="json"
            onCopy={(code) => copyToClipboard(code, 'manifest')}
            copied={copiedCode === 'manifest'}
          />

          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">3</span>
            <span>Implement your strategy class</span>
          </div>

          <CodeBlock
            code={`from kehrnel.core.plugin import StrategyPlugin
from kehrnel.core.types import StrategyContext, QueryPlan, QueryResult

class MyStrategy(StrategyPlugin):
    """Custom persistence strategy."""

    async def validate_config(self, ctx: StrategyContext):
        """Validate configuration before activation."""
        collections = ctx.config.get("collections", {})
        if not collections.get("main"):
            raise ValueError("collections.main is required")

    async def ingest(self, ctx: StrategyContext, payload: dict):
        """Ingest a document into the database."""
        storage = ctx.bindings.get("storage")
        collection = ctx.config["collections"]["main"]

        result = await storage.insert_one(collection, payload)
        return {"ok": True, "inserted_id": str(result.inserted_id)}

    async def compile_query(self, ctx: StrategyContext, domain: str, query: dict) -> QueryPlan:
        """Compile a query into an execution plan."""
        return QueryPlan(engine="mongo", plan={"collection": "main", "query": query})

    async def execute_query(self, ctx: StrategyContext, plan: QueryPlan) -> QueryResult:
        """Execute a compiled query plan."""
        storage = ctx.bindings.get("storage")
        cursor = storage.find(plan.plan["collection"], plan.plan["query"])
        rows = await cursor.to_list(length=100)
        return QueryResult(engine_used=plan.engine, rows=rows)`}
            language="python"
            onCopy={(code) => copyToClipboard(code, 'strategy-py')}
            copied={copiedCode === 'strategy-py'}
          />

          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">4</span>
            <span>Deploy to Kehrnel using the Deploy tab</span>
          </div>
        </div>
      </ExpandableSection>

      {/* Manifest Reference */}
      <ExpandableSection
        title="Manifest Reference"
        icon={FileJson}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            The manifest.json file declares your strategy metadata and configuration schema.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 pr-4 text-slate-400 font-medium">Field</th>
                  <th className="text-left py-2 pr-4 text-slate-400 font-medium">Required</th>
                  <th className="text-left py-2 text-slate-400 font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                <ManifestRow field="id" required desc="Unique strategy identifier (e.g., 'openehr.rps_dual')" />
                <ManifestRow field="name" required desc="Human-readable name" />
                <ManifestRow field="version" required desc="SemVer version string (e.g., '0.1.0')" />
                <ManifestRow field="domain" required desc="Data domain (openEHR, FHIR, Genomics, etc.)" />
                <ManifestRow field="entrypoint" required desc="Dotted path 'module:ClassName' to plugin" />
                <ManifestRow field="capabilities" required desc="List: ingest, transform, query, search, validate" />
                <ManifestRow field="pack_format" desc="Version string (e.g., 'strategy-pack/v1')" />
                <ManifestRow field="summary" desc="Brief description (1-2 sentences)" />
                <ManifestRow field="config_schema" desc="JSON Schema for config validation" />
                <ManifestRow field="default_config" desc="Default configuration values" />
                <ManifestRow field="adapters" desc="Required adapters: { storage: [...], search: [...] }" />
                <ManifestRow field="maturity" desc="preview, development, or published" />
                <ManifestRow field="ops" desc="List of strategy-specific operations" />
                <ManifestRow field="ui" desc="UI metadata: tags, badges, links, benefits, constraints" />
              </tbody>
            </table>
          </div>
        </div>
      </ExpandableSection>

      {/* Plugin API */}
      <ExpandableSection
        title="Plugin API Methods"
        icon={Code}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Implement these methods based on your declared capabilities.
          </p>

          <div className="space-y-3">
            <MethodCard
              name="validate_config"
              signature="async def validate_config(self, ctx: StrategyContext)"
              desc="Called before activation to validate merged configuration. Raise ValueError for invalid config."
              capability="all"
            />
            <MethodCard
              name="ingest"
              signature="async def ingest(self, ctx: StrategyContext, payload: dict) -> dict"
              desc="Ingest a document into the database. Returns dict with status."
              capability="ingest"
            />
            <MethodCard
              name="transform"
              signature="async def transform(self, ctx: StrategyContext, payload: dict) -> TransformResult"
              desc="Transform a payload according to strategy rules."
              capability="transform"
            />
            <MethodCard
              name="compile_query"
              signature="async def compile_query(self, ctx: StrategyContext, domain: str, query: dict) -> QueryPlan"
              desc="Compile a domain query into an execution plan."
              capability="query"
            />
            <MethodCard
              name="execute_query"
              signature="async def execute_query(self, ctx: StrategyContext, plan: QueryPlan) -> QueryResult"
              desc="Execute a compiled query plan and return results."
              capability="query"
            />
            <MethodCard
              name="run_op"
              signature="async def run_op(self, ctx: StrategyContext, op: str, payload: dict) -> dict"
              desc="Execute a strategy-specific operation (e.g., rebuild_indexes)."
              capability="ops"
            />
          </div>
        </div>
      </ExpandableSection>

      {/* Example Strategies */}
      <ExpandableSection
        title="Example Strategies"
        icon={Package}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Learn from existing strategies in the Kehrnel repository.
          </p>

          <div className="grid gap-4">
            <ExampleCard
              name="openehr.rps_dual"
              domain="openEHR"
              description="Dual-collection strategy with reversed path indexing and Atlas Search support"
              path="strategies/openehr/rps_dual"
              maturity="published"
            />
            <ExampleCard
              name="fhir.resource_first"
              domain="FHIR"
              description="Native FHIR resource storage with basic search capabilities"
              path="strategies/fhir/resource_first"
              maturity="development"
            />
            <ExampleCard
              name="genomics.variant_first"
              domain="genomics"
              description="Variant-first indexing for genomic data"
              path="strategies/genomics/variant_first"
              maturity="preview"
            />
          </div>
        </div>
      </ExpandableSection>

      {/* Adapters */}
      <ExpandableSection
        title="Available Adapters"
        icon={Database}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Declare required adapters in your manifest. They're injected via <code className="text-purple-400">ctx.bindings</code>.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <AdapterCard
              name="mongo"
              type="storage"
              desc="MongoDB document storage with full CRUD operations"
            />
            <AdapterCard
              name="atlas_search"
              type="search"
              desc="MongoDB Atlas Search for full-text and vector search"
            />
            <AdapterCard
              name="redis"
              type="queue"
              desc="Redis for caching and message queuing"
            />
            <AdapterCard
              name="vector"
              type="vector"
              desc="Vector storage for embeddings (Atlas Vector Search)"
            />
          </div>
        </div>
      </ExpandableSection>
    </div>
  );
};

// Expandable section component
const ExpandableSection = ({ title, icon: Icon, defaultOpen = false, children }) => {
  const [expanded, setExpanded] = useState(defaultOpen);

  return (
    <div className="dark-banner bg-slate-800/40 rounded-xl border border-slate-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-slate-700/50">
            <Icon className="w-4 h-4 text-slate-400" />
          </div>
          <span className="font-medium text-white">{title}</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-700/50">
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  );
};

// Code block component
const CodeBlock = ({ code, language, onCopy, copied }) => (
  <div className="relative bg-slate-900 rounded-lg overflow-hidden">
    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700">
      <span className="text-xs text-slate-500">{language}</span>
      <button
        onClick={() => onCopy(code)}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
    <pre className="p-4 overflow-x-auto text-sm text-slate-300">
      <code>{code}</code>
    </pre>
  </div>
);

// File card component
const FileCard = ({ name, required, description }) => (
  <div className={`p-3 rounded-lg border ${
    required
      ? 'bg-emerald-900/20 border-emerald-700/40'
      : 'bg-slate-800/50 border-slate-700'
  }`}>
    <div className="flex items-center gap-2 mb-1">
      <FileJson className={`w-4 h-4 ${required ? 'text-emerald-400' : 'text-slate-400'}`} />
      <code className="text-sm font-mono text-white">{name}</code>
      {required && (
        <span className="text-xs px-1.5 py-0.5 bg-emerald-600/30 text-emerald-300 rounded">required</span>
      )}
    </div>
    <p className="text-xs text-slate-400">{description}</p>
  </div>
);

// Manifest row component
const ManifestRow = ({ field, required, desc }) => (
  <tr>
    <td className="py-2 pr-4">
      <code className="text-purple-400 font-mono">{field}</code>
    </td>
    <td className="py-2 pr-4">
      {required && <span className="text-xs text-emerald-400">Yes</span>}
    </td>
    <td className="py-2 text-slate-300">{desc}</td>
  </tr>
);

// Method card component
const MethodCard = ({ name, signature, desc, capability }) => (
  <div className="bg-slate-900 rounded-lg p-4">
    <div className="flex items-center justify-between mb-2">
      <code className="text-sm text-blue-400 font-mono">{name}</code>
      <span className="text-xs px-2 py-0.5 bg-purple-600/30 text-purple-300 rounded">
        {capability}
      </span>
    </div>
    <code className="text-xs text-slate-500 font-mono block mb-2">{signature}</code>
    <p className="text-sm text-slate-400">{desc}</p>
  </div>
);

// Example card component
const ExampleCard = ({ name, domain, description, path, maturity }) => (
  <a
    href={`https://github.com/mongodb-industry-solutions/kehrnel/tree/main/src/kehrnel/${path}`}
    target="_blank"
    rel="noreferrer"
    className="block bg-slate-900 rounded-lg p-4 hover:bg-slate-800 transition-colors group"
  >
    <div className="flex items-center justify-between mb-2">
      <code className="text-sm text-white font-mono">{name}</code>
      <div className="flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 bg-blue-600/30 text-blue-300 rounded">{domain}</span>
        <span className={`text-xs px-2 py-0.5 rounded capitalize ${
          maturity === 'published' ? 'bg-emerald-600/30 text-emerald-300' :
          maturity === 'development' ? 'bg-blue-600/30 text-blue-300' :
          'bg-amber-600/30 text-amber-300'
        }`}>{maturity}</span>
      </div>
    </div>
    <p className="text-sm text-slate-400 mb-2">{description}</p>
    <div className="flex items-center gap-1 text-xs text-purple-400 group-hover:text-purple-300">
      View source
      <ExternalLink className="w-3 h-3" />
    </div>
  </a>
);

// Adapter card component
const AdapterCard = ({ name, type, desc }) => (
  <div className="bg-slate-900 rounded-lg p-4">
    <div className="flex items-center gap-2 mb-2">
      <code className="text-sm text-white font-mono">{name}</code>
      <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-400 rounded">{type}</span>
    </div>
    <p className="text-sm text-slate-400">{desc}</p>
  </div>
);

export default DeveloperGuide;
