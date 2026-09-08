"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  RefreshCw,
  Loader2,
  Database,
  CheckCircle2,
  Wand2,
  PenTool,
  Copy,
  Layers,
  Brain,
  Shield,
  Zap,
  ArrowRight,
  Boxes,
  FileText,
  Network
} from 'lucide-react';
import ContextObjectList from './contextObjectList';
import ContextObjectEditor from './contextObjectEditor';
import CreationWizard from './CreationWizard';
import OpenEhrTemplateImportPanel from './OpenEhrTemplateImportPanel';
import { STARTER_EXAMPLES } from './starterExamples';
import { createDefaultCustomDefinition } from '@/lib/definitions/types';
import {
  HIERARCHICAL_DEFINITION_FORMAT,
  flattenHierarchicalDefinition,
  shouldTreatDefinitionAsHierarchical,
  nodesToHierarchicalDefinition
} from '@/lib/contextObjects/hierarchicalDefinition';

const normalizeExampleNodes = (inputNodes = [], fallbackName = 'ContextObject') => {
  if (!Array.isArray(inputNodes) || inputNodes.length === 0) {
    return [];
  }

  const normalized = inputNodes.map((node, index) => ({
    ...node,
    nodeId: typeof node?.nodeId === 'string' && node.nodeId.trim()
      ? node.nodeId.trim()
      : `ex-node-${index + 1}`,
    parentNodeId: typeof node?.parentNodeId === 'string' && node.parentNodeId.trim()
      ? node.parentNodeId.trim()
      : null,
    childrenNodeIds: Array.isArray(node?.childrenNodeIds) ? node.childrenNodeIds : [],
    occurrences: node?.occurrences || { min: 0, max: 1 },
    role: node?.role || 'field',
    dataType: node?.dataType || 'string',
    attribute: node?.attribute || `field${index + 1}`
  }));

  const nodeIds = new Set(normalized.map((node) => node.nodeId));
  let rootNode = normalized.find((node) => node.parentNodeId === null);
  if (!rootNode) {
    rootNode = normalized[0];
    if (rootNode) rootNode.parentNodeId = null;
  }

  normalized.forEach((node) => {
    if (!node.parentNodeId) return;
    if (!nodeIds.has(node.parentNodeId) || node.parentNodeId === node.nodeId) {
      node.parentNodeId = rootNode?.nodeId || null;
    }
  });

  const childrenMap = new Map(normalized.map((node) => [node.nodeId, []]));
  normalized.forEach((node) => {
    if (node.parentNodeId && childrenMap.has(node.parentNodeId)) {
      childrenMap.get(node.parentNodeId).push(node.nodeId);
    }
  });

  return normalized.map((node) => {
    if (node.nodeId === rootNode?.nodeId) {
      return {
        ...node,
        name: node.name || fallbackName,
        role: 'section',
        dataType: 'object',
        attribute: 'root',
        occurrences: { min: 1, max: 1 },
        childrenNodeIds: childrenMap.get(node.nodeId) || []
      };
    }
    return {
      ...node,
      childrenNodeIds: childrenMap.get(node.nodeId) || []
    };
  });
};

// Check if AI assistant is disabled via environment variable
const isAIAssistantDisabled = process.env.NEXT_PUBLIC_DISABLE_AI_ASSISTANT === 'true';

const ContextObjectBuilder = ({ activeEnvironmentId = '', onNavigate }) => {
  // List state
  const [definitions, setDefinitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);

  // Filter state
  const [filters, setFilters] = useState({
    kind: '',
    origin: '',
    status: '',
    search: ''
  });

  // Selection state
  const [selectedDefinition, setSelectedDefinition] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [createKind, setCreateKind] = useState('context_object');
  const [editorAIBootstrap, setEditorAIBootstrap] = useState(null);
  const [wizardInitialMethod, setWizardInitialMethod] = useState(null);
  const [wizardInitialExampleId, setWizardInitialExampleId] = useState(null);
  const [showEmbeddedWizard, setShowEmbeddedWizard] = useState(false);  // Show wizard embedded in right panel
  const [exampleSearch, setExampleSearch] = useState('');
  const [createPanelTab, setCreatePanelTab] = useState('examples');

  // Visual explanation for Why ContextObjects - single narrative block
  const WhyContextObjectsSection = () => (
    <div className="rounded-xl border border-theme bg-surface p-6 space-y-6">
      {/* Experimental notice */}
      <div className="flex items-center gap-2 px-3 py-2 bg-warning/10 border border-warning/30 rounded-lg text-warning text-xs">
        <span className="font-semibold">Note:</span>
        <span>This feature is experimental and under active development.</span>
      </div>

      {/* Introduction */}
      <div>
        <h2 className="text-xl font-semibold text-theme-primary mb-3">Why ContextObjects</h2>
        <p className="text-sm text-theme-secondary leading-relaxed">
          Healthcare data is hard not because it&apos;s &quot;big&quot; — but because <span className="text-theme-primary font-medium">meaning and context are scattered</span> across thousands of events, notes, and systems. Today, applications and AI agents must rebuild clinical context on every request: joining across sources, re-deriving meaning, and duplicating logic. ContextObjects change that by persisting &quot;situations&quot; — episodes of care, therapy lines, diagnostic workups — as first-class objects optimized for fast reads and consistent interpretation.
        </p>
      </div>

      {/* Why it matters */}
      <div className="pt-4 border-t border-theme">
        <p className="text-sm text-theme-secondary leading-relaxed">
          <span className="text-theme-primary font-medium">Why it matters at scale:</span> Instead of rebuilding context on every request, ContextObjects persist it once in a shape optimized for <span className="text-theme-primary">low-latency reads</span>, <span className="text-theme-primary">predictable analysis</span>, and <span className="text-theme-primary">governed access</span> — exactly what next-generation clinical apps and AI agents need.
        </p>
      </div>
    </div>
  );

  // Fetch definitions from API
  const fetchDefinitions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filters.kind) params.append('kind', filters.kind);
      if (filters.origin) params.append('origin', filters.origin);
      if (filters.status) params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);

      const response = await fetch(`/api/definitions?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch context objects');
      }

      const data = await response.json();
      setDefinitions(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Error fetching context objects:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Initial load
  useEffect(() => {
    fetchDefinitions();
  }, [fetchDefinitions]);

  // Load full definition when selected
  const handleSelect = async (def) => {
    if (!def) {
      setSelectedDefinition(null);
      setIsCreating(false);
      setEditorAIBootstrap(null);
      return;
    }

    try {
      setEditorLoading(true);
      setIsCreating(false);
      setEditorAIBootstrap(null);

      const response = await fetch(`/api/definitions/${def.id}`);
      if (!response.ok) {
        throw new Error('Failed to load context object');
      }

      const fullDef = await response.json();
      setSelectedDefinition(fullDef);
    } catch (err) {
      console.error('Error loading context object:', err);
      setError(err.message);
    } finally {
      setEditorLoading(false);
    }
  };

  // Create new definition
  const handleCreateNew = (kind = 'context_object', options = {}) => {
    setCreateKind(kind);
    setWizardInitialMethod(options.initialMethod || null);
    setWizardInitialExampleId(options.initialExampleId || null);
    setSelectedDefinition(null);
    setIsCreating(false);

    // ContextObjects are always created in embedded mode (no modal).
    if (kind === 'context_object') {
      setShowEmbeddedWizard(true);
      setShowWizard(false);
    } else {
      // Blocks continue using modal wizard.
      setShowEmbeddedWizard(false);
      setShowWizard(true);
    }
  };

  // Handle wizard completion
  const handleWizardComplete = (wizardData) => {
    const nodes = Array.isArray(wizardData.nodes) ? wizardData.nodes : [];
    const newDef = {
      ...createDefaultCustomDefinition(),
      name: wizardData.name,
      description: wizardData.description || '',
      definitionFormat: HIERARCHICAL_DEFINITION_FORMAT,
      definition: nodesToHierarchicalDefinition(nodes, {
        name: wizardData.name || 'ContextObject'
      }),
      nodes,
      kind: wizardData.kind || createKind,
      scope: wizardData.scope || (createKind === 'block' ? 'building_block' : 'business_object')
    };
    setSelectedDefinition(newDef);
    setIsCreating(true);
    if (wizardData.assistant?.open) {
      setEditorAIBootstrap({
        open: true,
        prompt: wizardData.assistant?.prompt || '',
        recommendedBlocks: Array.isArray(wizardData.assistant?.recommendedBlocks) ? wizardData.assistant.recommendedBlocks : [],
        agent: wizardData.assistant?.agent || null,
        nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      });
    } else {
      setEditorAIBootstrap(null);
    }
    setWizardInitialMethod(null);
    setWizardInitialExampleId(null);
    setShowWizard(false);
    setShowEmbeddedWizard(false);
  };

  const filteredStarterExamples = useMemo(() => {
    const search = exampleSearch.trim().toLowerCase();
    return STARTER_EXAMPLES.filter((example) => {
      if (!search) return true;
      const haystack = [
        example.name,
        example.description,
        example.category,
        ...(example.tags || [])
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [exampleSearch]);

  const handleCreateFromExample = (example) => {
    if (!example) return;

    const exampleIsHierarchical = shouldTreatDefinitionAsHierarchical(
      example.definition,
      example.definitionFormat
    );
    const sourceNodes = exampleIsHierarchical
      ? flattenHierarchicalDefinition(example.definition)
      : example.nodes;
    const nodes = normalizeExampleNodes(sourceNodes, example.name || 'ContextObject');
    const definition = exampleIsHierarchical
      ? example.definition
      : nodesToHierarchicalDefinition(nodes, {
        name: example.name || 'ContextObject'
      });

    const newDef = {
      ...createDefaultCustomDefinition(),
      name: example.name || 'ContextObject',
      description: example.description || '',
      kind: example.kind || 'context_object',
      scope: example.scope || 'business_object',
      definitionFormat: HIERARCHICAL_DEFINITION_FORMAT,
      definition,
      nodes,
      relationships: Array.isArray(example.relationships) ? example.relationships : [],
      terminologyBindings: Array.isArray(example.terminologyBindings) ? example.terminologyBindings : [],
      structuralBindings: Array.isArray(example.structuralBindings) ? example.structuralBindings : [],
      metadata: {
        ...(example.metadata && typeof example.metadata === 'object' && !Array.isArray(example.metadata) ? example.metadata : {}),
        tags: Array.isArray(example.metadata?.tags)
          ? example.metadata.tags
          : (Array.isArray(example.tags) ? example.tags : [])
      }
    };

    setCreateKind('context_object');
    setSelectedDefinition(newDef);
    setIsCreating(true);
    setShowEmbeddedWizard(false);
    setShowWizard(false);
    setWizardInitialMethod(null);
    setWizardInitialExampleId(null);
    setEditorAIBootstrap({
      open: true,
      prompt: '',
      recommendedBlocks: [],
      agent: null,
      nonce: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    });
  };

  const handleImportFromOpenEhrTemplate = (draft) => {
    if (!draft) return;
    setCreateKind('context_object');
    setSelectedDefinition(draft);
    setIsCreating(true);
    setShowEmbeddedWizard(false);
    setShowWizard(false);
    setWizardInitialMethod(null);
    setWizardInitialExampleId(null);
    setEditorAIBootstrap(null);
  };

  // Save definition (create or update)
  const handleSave = async (definitionData) => {
    try {
      setEditorLoading(true);

      let response;
      if (isCreating) {
        response = await fetch('/api/definitions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(definitionData)
        });
      } else {
        response = await fetch(`/api/definitions/${definitionData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(definitionData)
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details?.join(', ') || errorData.error || 'Failed to save');
      }

      const savedDef = await response.json();
      setSelectedDefinition(savedDef);
      setIsCreating(false);
      setEditorAIBootstrap(null);

      // Refresh list
      await fetchDefinitions();

      return { success: true };
    } catch (err) {
      console.error('Error saving definition:', err);
      return { success: false, error: err.message };
    } finally {
      setEditorLoading(false);
    }
  };

  // Delete definition
  const handleDelete = async (id) => {
    try {
      const response = await fetch(`/api/definitions/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete context object');
      }

      setSelectedDefinition(null);
      setIsCreating(false);
      await fetchDefinitions();
    } catch (err) {
      console.error('Error deleting context object:', err);
      setError(err.message);
    }
  };

  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Main content */}
      <div className="flex-1 overflow-hidden relative">
        <div className="h-full bg-background overflow-hidden relative flex flex-col">
          {editorLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-primary" size={32} />
              <span className="ml-3 text-theme-secondary text-lg">Loading...</span>
            </div>
          ) : showEmbeddedWizard ? (
            // Embedded wizard in right panel (AI/manual/example)
            <CreationWizard
              onComplete={handleWizardComplete}
              onCancel={() => {
                setShowEmbeddedWizard(false);
                setWizardInitialMethod(null);
                setWizardInitialExampleId(null);
              }}
              targetKind={createKind}
              initialMethod={wizardInitialMethod}
              initialExampleId={wizardInitialExampleId}
              embedded={true}
            />
          ) : selectedDefinition ? (
            <ContextObjectEditor
              definition={selectedDefinition}
              isCreating={isCreating}
              aiBootstrap={editorAIBootstrap}
              activeEnvironmentId={activeEnvironmentId}
              onNavigate={onNavigate}
              onSave={handleSave}
              onDelete={handleDelete}
              onCancel={() => {
                setSelectedDefinition(null);
                setIsCreating(false);
                setEditorAIBootstrap(null);
              }}
            />
          ) : (
            <div
              className="h-full overflow-auto p-8"
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(100, 116, 139, 0.2) transparent'
              }}
            >
              <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div>
                  <h1 className="text-xl font-medium text-theme-primary">ContextObjects Builder</h1>
                  <p className="text-sm text-theme-secondary mt-1">
                    Create and manage ContextObjects and reusable blocks
                  </p>
                </div>

                {/* Why ContextObjects - Visual Explanation */}
                <WhyContextObjectsSection />

                {/* Direct method selection - AI or Manual */}
                <div className="rounded-xl border border-theme bg-surface p-6">
                  <h3 className="text-lg font-semibold text-theme-primary mb-4">Create a new ContextObject</h3>
                  <div className={`grid grid-cols-1 ${isAIAssistantDisabled ? '' : 'md:grid-cols-2'} gap-4`}>
                    {/* AI Assistant option - hidden when disabled */}
                    {!isAIAssistantDisabled && (
                      <button
                        onClick={() => handleCreateNew('context_object', { initialMethod: 'ai' })}
                        className="p-5 border-2 border-theme rounded-lg hover:border-purple-500 hover:bg-purple-500/5 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
                            <Wand2 size={20} className="text-purple-400" />
                          </div>
                          <h4 className="font-semibold text-theme-primary">Modeller AI Agent</h4>
                        </div>
                        <p className="text-sm text-theme-secondary">
                          Describe what you need in plain language and let AI suggest the structure
                        </p>
                      </button>
                    )}

                    {/* Manual option */}
                    <button
                      onClick={() => handleCreateNew('context_object', { initialMethod: 'manual' })}
                      className="p-5 border-2 border-theme rounded-lg hover:border-blue-500 hover:bg-blue-500/5 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                          <PenTool size={20} className="text-blue-400" />
                        </div>
                        <h4 className="font-semibold text-theme-primary">Build manually from scratch              
                        </h4>
                      </div>
                      <p className="text-sm text-theme-secondary">
                        Define each field yourself with full control over names, types, and requirements
                      </p>
                    </button>
                  </div>

                  <div className="mt-6 border-2 border-theme rounded-lg bg-background/40 p-5 hover:border-cyan-500/30 transition-all">
                    {/* Section header with icon */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-cyan-500/20 rounded-lg">
                        <Copy size={20} className="text-cyan-300" />
                      </div>
                      <h4 className="font-semibold text-theme-primary">Start from Existing</h4>
                    </div>

                    {/* Sub-options tabs */}
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => setCreatePanelTab('examples')}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                          createPanelTab === 'examples'
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-surface text-theme-secondary border-theme hover:border-cyan-500/30'
                        }`}
                      >
                        From an example
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreatePanelTab('existing')}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                          createPanelTab === 'existing'
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-surface text-theme-secondary border-theme hover:border-cyan-500/30'
                        }`}
                      >
                        From your library
                      </button>
                      <button
                        type="button"
                        onClick={() => setCreatePanelTab('openehr')}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                          createPanelTab === 'openehr'
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            : 'bg-surface text-theme-secondary border-theme hover:border-cyan-500/30'
                        }`}
                      >
                        From openEHR template
                      </button>
                    </div>

                    {createPanelTab === 'examples' ? (
                      <>
                        <div className="relative mb-3">
                          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" />
                          <input
                            type="text"
                            value={exampleSearch}
                            onChange={(e) => setExampleSearch(e.target.value)}
                            placeholder="Search by name, description, or tags..."
                            className="w-full pl-10 pr-4 py-2 bg-background border border-theme rounded-lg text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary"
                          />
                        </div>

                        <div className="border border-theme rounded-lg overflow-hidden bg-surface">
                          <div className="px-4 py-2 bg-background text-xs text-theme-secondary">
                            Showing {filteredStarterExamples.length} of {STARTER_EXAMPLES.length} examples
                          </div>
                          <div
                            className="max-h-[320px] overflow-auto divide-y divide-theme"
                            style={{
                              scrollbarWidth: 'thin',
                              scrollbarColor: 'rgba(100, 116, 139, 0.3) transparent'
                            }}
                          >
                            {filteredStarterExamples.length === 0 ? (
                              <div className="p-4 text-sm text-theme-secondary">No examples match your search.</div>
                            ) : (
                              filteredStarterExamples.map((example) => (
                                <button
                                  key={example.id}
                                  type="button"
                                  onClick={() => handleCreateFromExample(example)}
                                  className="w-full p-4 text-left hover:bg-background/50 transition-all"
                                >
                                  <div className="flex items-start justify-between mb-1 gap-2">
                                    <span className="text-lg font-semibold text-theme-primary">{example.name}</span>
                                    <span className="px-2 py-0.5 text-[10px] font-medium rounded border bg-cyan-500/20 text-cyan-300 border-cyan-500/40">
                                      EXAMPLE
                                    </span>
                                  </div>
                                  {example.description && (
                                    <p className="text-sm text-theme-secondary mb-2">{example.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 flex-wrap text-xs text-theme-secondary">
                                    {example.category && (
                                      <span className="px-2 py-0.5 rounded border border-theme bg-background/50">
                                        {example.category}
                                      </span>
                                    )}
                                    {(example.tags || []).slice(0, 3).map((tag) => (
                                      <span key={`${example.id}-${tag}`} className="px-2 py-0.5 rounded bg-slate-600/30 text-slate-400">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    ) : createPanelTab === 'existing' ? (
                      <>
                        <div className="space-y-3">
                          <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" />
                            <input
                              type="text"
                              placeholder="Search by name, description, or tags..."
                              value={filters.search}
                              onChange={(e) => handleFilterChange('search', e.target.value)}
                              className="w-full pl-10 pr-4 py-2 bg-background border border-theme rounded-lg text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary"
                            />
                          </div>

                          <div className="flex gap-2">
                            <select
                              value={filters.origin}
                              onChange={(e) => handleFilterChange('origin', e.target.value)}
                              className="flex-1 px-3 py-2 bg-background border border-theme rounded-lg text-theme-primary focus:outline-none focus:border-primary"
                            >
                              <option value="">All Origins</option>
                              <option value="custom">Custom</option>
                              <option value="standard">Standard</option>
                              <option value="vendor">Vendor</option>
                              <option value="openehr">OpenEHR</option>
                            </select>

                            <select
                              value={filters.kind}
                              onChange={(e) => handleFilterChange('kind', e.target.value)}
                              className="flex-1 px-3 py-2 bg-background border border-theme rounded-lg text-theme-primary focus:outline-none focus:border-primary"
                            >
                              <option value="">All Kinds</option>
                              <option value="context_object">ContextObject</option>
                              <option value="block">Block</option>
                            </select>

                            <select
                              value={filters.status}
                              onChange={(e) => handleFilterChange('status', e.target.value)}
                              className="flex-1 px-3 py-2 bg-background border border-theme rounded-lg text-theme-primary focus:outline-none focus:border-primary"
                            >
                              <option value="">All Statuses</option>
                              <option value="draft">Draft</option>
                              <option value="active">Active</option>
                              <option value="deprecated">Deprecated</option>
                            </select>
                          </div>
                        </div>

                        <div className="mt-3 border border-theme rounded-lg overflow-hidden bg-surface">
                          <div
                            className="max-h-[320px] overflow-auto"
                            style={{
                              scrollbarWidth: 'thin',
                              scrollbarColor: 'rgba(100, 116, 139, 0.3) transparent'
                            }}
                          >
                            {loading ? (
                              <div className="flex items-center justify-center h-32">
                                <Loader2 className="animate-spin text-primary" size={24} />
                                <span className="ml-2 text-theme-secondary">Loading context objects...</span>
                              </div>
                            ) : error ? (
                              <div className="p-4 text-error text-center">
                                <p>Error: {error}</p>
                                <button
                                  onClick={fetchDefinitions}
                                  className="mt-2 text-primary hover:underline"
                                >
                                  Try again
                                </button>
                              </div>
                            ) : (
                              <ContextObjectList
                                definitions={definitions}
                                selectedId={selectedDefinition?.id}
                                onSelect={handleSelect}
                                total={total}
                              />
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <OpenEhrTemplateImportPanel onImport={handleImportFromOpenEhrTemplate} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Creation Wizard Modal */}
      {showWizard && (
        <CreationWizard
          onComplete={handleWizardComplete}
          onCancel={() => {
            setShowWizard(false);
            setWizardInitialMethod(null);
            setWizardInitialExampleId(null);
          }}
          targetKind={createKind}
          initialMethod={wizardInitialMethod}
          initialExampleId={wizardInitialExampleId}
        />
      )}
    </div>
  );
};

export default ContextObjectBuilder;
