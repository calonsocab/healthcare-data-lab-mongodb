"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Save,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  FileCode,
  Settings,
  Code,
  Tag as TagIcon,
  Plus,
  Network,
  RefreshCw,
  Puzzle,
  List,
  ShieldAlert,
  Link2,
  Database,
  SlidersHorizontal,
  Sparkles
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/common/Tabs';
import {
  VALID_V1_SCOPES,
  VALID_V1_ORIGINS,
  VALID_STATUSES,
  SCHEMA_VERSION,
  PATH_DIALECT,
  syncChildrenNodeIds
} from '@/lib/definitions/types';
import FieldsTable from './FieldsTable';
import NodeMindMap from './NodeMindMap';
import IntegratedBlockComposer from './IntegratedBlockComposer';
import LintPanel from './LintPanel';
import { lintContextObjectSchema, applyLintFix, applyAllSafeFixes } from '@/lib/contextObjects/linting';
import { jsonSchemaToSemanticObject } from '@/lib/semantic/migration';
import {
  HIERARCHICAL_DEFINITION_FORMAT,
  flattenHierarchicalDefinition,
  mergeHierarchicalDefinitionWithNodes,
  shouldTreatDefinitionAsHierarchical
} from '@/lib/contextObjects/hierarchicalDefinition';
import { isOpenEhrContextObjectDefinition } from '@/lib/contextObjects/openehrSemanticArtifacts';
import SemanticArtifactsPanel from './SemanticArtifactsPanel';

// Semantic Object utilities - JSON Schema generator
const semanticObjectToJsonSchema = (obj) => {
  // Helper functions
  const getChildNodes = (parentNodeId, nodes) => {
    const parent = nodes.find(n => n.nodeId === parentNodeId);
    if (!parent) return [];
    return parent.childrenNodeIds
      .map(childId => nodes.find(n => n.nodeId === childId))
      .filter(n => n !== undefined);
  };

  const mapDataTypeToJsonSchema = (dataType) => {
    switch (dataType) {
      case 'string': return { type: 'string' };
      case 'number': return { type: 'number' };
      case 'integer': return { type: 'integer' };
      case 'boolean': return { type: 'boolean' };
      case 'date': return { type: 'string', format: 'date' };
      case 'time': return { type: 'string', format: 'time' };
      case 'datetime': return { type: 'string', format: 'date-time' };
      case 'duration': return { type: 'string', format: 'duration' };
      case 'object': return { type: 'object' };
      case 'array': return { type: 'array' };
      case 'code': return { type: 'string' };
      case 'coded_text': return { type: 'string' };
      case 'identifier': return { type: 'string' };
      case 'quantity': return { type: 'number' };
      case 'reference': return { type: 'string', format: 'uri' };
      case 'uri': return { type: 'string', format: 'uri' };
      case 'interval': return { type: 'object', properties: { lower: { type: 'string' }, upper: { type: 'string' } } };
      default: return { type: 'string' };
    }
  };

  const applyConstraints = (schema, node) => {
    if (!node.constraints) return schema;
    const result = { ...schema };
    if (node.constraints.pattern) result.pattern = node.constraints.pattern;
    if (node.constraints.allowedValues?.length > 0) result.enum = node.constraints.allowedValues;
    if (node.constraints.minValue !== undefined) result.minimum = node.constraints.minValue;
    if (node.constraints.maxValue !== undefined) result.maximum = node.constraints.maxValue;
    if (node.constraints.minLength !== undefined) result.minLength = node.constraints.minLength;
    if (node.constraints.maxLength !== undefined) result.maxLength = node.constraints.maxLength;
    if (node.constraints.fixedValue !== undefined) result.const = node.constraints.fixedValue;
    return result;
  };

  const buildNodeSchema = (node, allNodes) => {
    let schema = node.dataType
      ? mapDataTypeToJsonSchema(node.dataType)
      : { type: 'object' };

    if (node.description) schema.description = node.description;
    schema.title = node.name;
    schema = applyConstraints(schema, node);

    if (
      node.role === 'group' ||
      node.role === 'section' ||
      node.dataType === 'object' ||
      node.childrenNodeIds.length > 0
    ) {
      schema.type = 'object';
      schema.properties = {};
      const requiredFields = [];

      const children = getChildNodes(node.nodeId, allNodes);
      for (const child of children) {
        let childSchema = buildNodeSchema(child, allNodes);

        if (
          child.occurrences.max === '*' ||
          (typeof child.occurrences.max === 'number' && child.occurrences.max > 1)
        ) {
          childSchema = {
            type: 'array',
            items: childSchema,
            minItems: child.occurrences.min
          };
          if (child.occurrences.max !== '*') {
            childSchema.maxItems = child.occurrences.max;
          }
        }

        schema.properties[child.attribute] = childSchema;

        if (child.occurrences.min >= 1 || child.constraints?.required === true) {
          requiredFields.push(child.attribute);
        }
      }

      if (requiredFields.length > 0) {
        schema.required = requiredFields;
      }
    }

    if (node.role === 'event_series') {
      schema.type = 'array';
      schema.items = { type: 'object', properties: {} };

      const children = getChildNodes(node.nodeId, allNodes);
      const requiredFields = [];

      for (const child of children) {
        const childSchema = buildNodeSchema(child, allNodes);
        schema.items.properties[child.attribute] = childSchema;

        if (child.occurrences.min >= 1) {
          requiredFields.push(child.attribute);
        }
      }

      if (requiredFields.length > 0) {
        schema.items.required = requiredFields;
      }

      if (node.occurrences.min > 0) {
        schema.minItems = node.occurrences.min;
      }
    }

    return schema;
  };

  const rootNode = obj.nodes.find(n => n.parentNodeId === null);

  if (!rootNode) {
    return {
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: obj.name,
      description: obj.description || '',
      type: 'object',
      properties: {}
    };
  }

  const schema = buildNodeSchema(rootNode, obj.nodes);
  schema.$schema = 'http://json-schema.org/draft-07/schema#';
  schema.title = obj.name;
  if (obj.description) schema.description = obj.description;

  return schema;
};

// Dynamic import for Monaco to avoid SSR issues
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const isObjectRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const looksLikeJsonSchema = (candidate) => {
  if (!isObjectRecord(candidate)) return false;
  return (
    typeof candidate.$schema === 'string' ||
    typeof candidate.type === 'string' ||
    isObjectRecord(candidate.properties) ||
    isObjectRecord(candidate.items) ||
    Array.isArray(candidate.required)
  );
};

const looksLikeSemanticObjectPayload = (candidate) => {
  if (!isObjectRecord(candidate)) return false;
  return (
    Array.isArray(candidate.nodes) ||
    typeof candidate.id === 'string' ||
    typeof candidate.kind === 'string' ||
    typeof candidate.scope === 'string' ||
    typeof candidate.origin === 'string' ||
    'definition' in candidate ||
    'metadata' in candidate
  );
};

const normalizeNodesFromEditor = (nodes = []) => {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];

  const normalized = nodes.map((node, index) => ({
    ...node,
    nodeId: typeof node?.nodeId === 'string' && node.nodeId.trim()
      ? node.nodeId.trim()
      : `node-${index + 1}`,
    parentNodeId: typeof node?.parentNodeId === 'string' && node.parentNodeId.trim()
      ? node.parentNodeId.trim()
      : null,
    childrenNodeIds: Array.isArray(node?.childrenNodeIds) ? node.childrenNodeIds : [],
    occurrences: node?.occurrences || { min: 0, max: 1 }
  }));

  const nodeIds = new Set(normalized.map((node) => node.nodeId));
  const rootNode = normalized.find((node) => node.parentNodeId === null) || normalized[0] || null;
  if (rootNode) {
    rootNode.parentNodeId = null;
  }

  normalized.forEach((node) => {
    if (!node.parentNodeId) return;
    if (!nodeIds.has(node.parentNodeId) || node.parentNodeId === node.nodeId) {
      node.parentNodeId = rootNode?.nodeId || null;
    }
  });

  return syncChildrenNodeIds(normalized);
};

const STRUCTURAL_MODELS = ['FHIR', 'openEHR', 'X12', 'HL7v2', 'Other'];
const TERMINOLOGY_BINDING_STRENGTHS = ['required', 'extensible', 'preferred', 'example'];
const RELATIONSHIP_TYPES = ['reference', 'derived_from', 'caused_by', 'same_as', 'part_of', 'associated_with'];
const RELATIONSHIP_CARDINALITIES = ['one_to_one', 'one_to_many', 'many_to_many'];
const OPERATIONAL_WRITE_MODES = ['upsert', 'append', 'event_log', 'snapshot'];
const DEFINITION_FORMAT_OPTIONS = ['INTERNAL-JSON', HIERARCHICAL_DEFINITION_FORMAT];

const generateRelationshipId = () => `rel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const parseCommaSeparatedList = (rawValue) => {
  if (typeof rawValue !== 'string') return [];
  const seen = new Set();
  const result = [];
  rawValue.split(',').forEach((item) => {
    const trimmed = item.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  });
  return result;
};

const formatArrayAsCsv = (items) => (Array.isArray(items) ? items.join(', ') : '');

const ContextObjectEditor = ({
  definition,
  isCreating,
  aiBootstrap = null,
  activeEnvironmentId = '',
  onNavigate,
  onSave,
  onDelete,
  onCancel
}) => {
  const [formData, setFormData] = useState(definition);
  const [definitionJson, setDefinitionJson] = useState('');
  const [jsonError, setJsonError] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [syncingNodes, setSyncingNodes] = useState(false);
  const [activeTab, setActiveTab] = useState('compose');
  const editorRef = useRef(null);

  const lintIssues = useMemo(() => {
    return lintContextObjectSchema({
      nodes: Array.isArray(formData?.nodes) ? formData.nodes : [],
      context: {
        temporalMode: formData?.metadata?.temporalMode || undefined,
        kind: formData?.kind || undefined,
        scope: formData?.scope || undefined
      }
    });
  }, [formData?.nodes, formData?.metadata?.temporalMode, formData?.kind, formData?.scope]);

  const nodeOptions = useMemo(() => {
    if (!Array.isArray(formData?.nodes)) return [];
    return formData.nodes.map((node) => ({
      nodeId: node.nodeId,
      label: `${node.name || node.attribute || node.nodeId} (${node.nodeId})`
    }));
  }, [formData?.nodes]);

  const rootNodeId = useMemo(() => {
    if (!Array.isArray(formData?.nodes) || formData.nodes.length === 0) return '';
    const rootNode = formData.nodes.find((node) => node.parentNodeId === null);
    return rootNode?.nodeId || formData.nodes[0]?.nodeId || '';
  }, [formData?.nodes]);

  const operationalProfile = useMemo(() => {
    if (!isObjectRecord(formData?.metadata)) return {};
    if (!isObjectRecord(formData.metadata.operationalProfile)) return {};
    return formData.metadata.operationalProfile;
  }, [formData?.metadata]);

  const primitiveStats = useMemo(() => {
    const nodeCount = Array.isArray(formData?.nodes) ? formData.nodes.length : 0;
    const objectTerminology = Array.isArray(formData?.terminologyBindings) ? formData.terminologyBindings.length : 0;
    const objectStructural = Array.isArray(formData?.structuralBindings) ? formData.structuralBindings.length : 0;
    const nodeTerminology = Array.isArray(formData?.nodes)
      ? formData.nodes.reduce(
          (acc, node) => acc + (Array.isArray(node?.terminologyBindings) ? node.terminologyBindings.length : 0),
          0
        )
      : 0;
    const relationshipCount = Array.isArray(formData?.relationships) ? formData.relationships.length : 0;
    const operationalSignals = [
      ...(Array.isArray(operationalProfile.readPatterns) ? operationalProfile.readPatterns : []),
      ...(Array.isArray(operationalProfile.queryAxes) ? operationalProfile.queryAxes : []),
      ...(Array.isArray(operationalProfile.optimizedPaths) ? operationalProfile.optimizedPaths : []),
      ...(Array.isArray(operationalProfile.indexHints) ? operationalProfile.indexHints : [])
    ].length;

    return {
      nodeCount,
      bindingCount: objectTerminology + objectStructural + nodeTerminology,
      relationshipCount,
      operationalSignals
    };
  }, [formData?.nodes, formData?.terminologyBindings, formData?.structuralBindings, formData?.relationships, operationalProfile]);

  // Initialize form data when definition changes
  useEffect(() => {
    setFormData(definition);
    // Show the entire SemanticObject as JSON
    setDefinitionJson(JSON.stringify(definition, null, 2));
    setSaveStatus(null);
    setJsonError(null);
    setActiveTab(isOpenEhrContextObjectDefinition(definition?.definition || definition) ? 'artifacts' : 'compose');
  }, [definition]);

  // Keep Definition JSON in sync when editing outside the JSON tab.
  useEffect(() => {
    if (activeTab === 'definition') return;
    setDefinitionJson(JSON.stringify(formData, null, 2));
  }, [formData, activeTab]);

  const applyParsedEditorJson = (parsed) => {
    setFormData((prev) => {
      if (looksLikeSemanticObjectPayload(parsed)) {
        const next = { ...prev, ...parsed };
        const definitionFormat = parsed.definitionFormat || prev?.definitionFormat;
        const definitionIsHierarchical = shouldTreatDefinitionAsHierarchical(parsed.definition, definitionFormat);

        if (Array.isArray(parsed.nodes)) {
          next.nodes = normalizeNodesFromEditor(parsed.nodes);
        } else if (definitionIsHierarchical) {
          next.nodes = normalizeNodesFromEditor(flattenHierarchicalDefinition(parsed.definition));
          next.definitionFormat = HIERARCHICAL_DEFINITION_FORMAT;
        } else if (looksLikeJsonSchema(parsed.definition)) {
          const migrated = jsonSchemaToSemanticObject(parsed.definition, {
            id: parsed.id || prev?.id,
            name: parsed.name || prev?.name || 'ContextObject',
            description: parsed.description || prev?.description || '',
            scope: parsed.scope || prev?.scope || 'business_object'
          });
          next.nodes = normalizeNodesFromEditor(migrated.nodes || []);
        }

        return next;
      }

      if (shouldTreatDefinitionAsHierarchical(parsed, HIERARCHICAL_DEFINITION_FORMAT)) {
        const hierarchicalNodes = flattenHierarchicalDefinition(parsed);
        return {
          ...prev,
          definitionFormat: HIERARCHICAL_DEFINITION_FORMAT,
          definition: parsed,
          nodes: normalizeNodesFromEditor(hierarchicalNodes)
        };
      }

      if (looksLikeJsonSchema(parsed)) {
        const migrated = jsonSchemaToSemanticObject(parsed, {
          id: prev?.id,
          name: prev?.name || parsed?.title || 'ContextObject',
          description: prev?.description || parsed?.description || '',
          scope: prev?.scope || 'business_object'
        });
        return {
          ...prev,
          definition: parsed,
          nodes: normalizeNodesFromEditor(migrated.nodes || []),
          name: parsed?.title || prev?.name,
          description: parsed?.description || prev?.description
        };
      }

      return { ...prev, definition: parsed };
    });
  };

  // Handle nodes changes
  const handleNodesChange = (newNodes) => {
    setFormData(prev => ({ ...prev, nodes: normalizeNodesFromEditor(newNodes) }));
    setSaveStatus(null);
  };

  // Sync definition JSON from nodes (using SemanticObject schema generator)
  const syncDefinitionFromNodes = () => {
    if (!formData.nodes || formData.nodes.length === 0) {
      setSaveStatus({ type: 'error', message: 'No nodes to sync' });
      return;
    }

    try {
      setSyncingNodes(true);
      const useHierarchicalDefinition = shouldTreatDefinitionAsHierarchical(formData.definition, formData.definitionFormat)
        || `${formData.definitionFormat || ''}`.toUpperCase() === HIERARCHICAL_DEFINITION_FORMAT;

      let generatedDefinition;
      if (useHierarchicalDefinition) {
        generatedDefinition = mergeHierarchicalDefinitionWithNodes(formData.definition, formData.nodes, {
          name: formData.name,
          rmEntity: formData.rmType,
          archetypeId: formData?.definition?.archetypeId
        });
      } else {
        const semanticObject = {
          name: formData.name || 'Data Object',
          description: formData.description || '',
          nodes: formData.nodes
        };
        generatedDefinition = semanticObjectToJsonSchema(semanticObject);
      }

      const nextFormData = {
        ...formData,
        definitionFormat: useHierarchicalDefinition ? HIERARCHICAL_DEFINITION_FORMAT : (formData.definitionFormat || 'INTERNAL-JSON'),
        definition: generatedDefinition
      };
      setFormData(nextFormData);
      setDefinitionJson(JSON.stringify(nextFormData, null, 2));
      setSaveStatus({
        type: 'success',
        message: useHierarchicalDefinition
          ? 'Hierarchical definition generated from SemanticNodes'
          : 'JSON Schema generated from SemanticNodes'
      });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      console.error('Error syncing definition:', err);
      setSaveStatus({ type: 'error', message: 'Failed to generate JSON Schema' });
    } finally {
      setSyncingNodes(false);
    }
  };

  // Handle form field changes
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaveStatus(null);
  };

  // Handle metadata changes
  const handleMetadataChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, [field]: value }
    }));
    setSaveStatus(null);
  };

  const handleTopLevelCollectionAdd = (field, template) => {
    setFormData((prev) => {
      const current = Array.isArray(prev?.[field]) ? prev[field] : [];
      return {
        ...prev,
        [field]: [...current, template]
      };
    });
    setSaveStatus(null);
  };

  const handleTopLevelCollectionUpdate = (field, index, patch) => {
    setFormData((prev) => {
      const current = Array.isArray(prev?.[field]) ? [...prev[field]] : [];
      if (!current[index]) return prev;
      current[index] = { ...current[index], ...patch };
      return {
        ...prev,
        [field]: current
      };
    });
    setSaveStatus(null);
  };

  const handleTopLevelCollectionRemove = (field, index) => {
    setFormData((prev) => {
      const current = Array.isArray(prev?.[field]) ? [...prev[field]] : [];
      if (!current[index]) return prev;
      current.splice(index, 1);
      return {
        ...prev,
        [field]: current
      };
    });
    setSaveStatus(null);
  };

  const handleOperationalProfileChange = (field, value) => {
    setFormData((prev) => {
      const metadata = isObjectRecord(prev?.metadata) ? prev.metadata : {};
      const profile = isObjectRecord(metadata.operationalProfile) ? metadata.operationalProfile : {};
      const nextProfile = { ...profile };
      if (typeof value === 'string' && value.trim() === '') {
        delete nextProfile[field];
      } else {
        nextProfile[field] = value;
      }
      return {
        ...prev,
        metadata: {
          ...metadata,
          operationalProfile: nextProfile
        }
      };
    });
    setSaveStatus(null);
  };

  const handleOperationalProfileListChange = (field, rawValue) => {
    handleOperationalProfileChange(field, parseCommaSeparatedList(rawValue));
  };

  // Handle JSON definition changes
  const handleJsonChange = (value) => {
    setDefinitionJson(value || '');
    setSaveStatus(null);

    try {
      const parsed = JSON.parse(value || '{}');
      applyParsedEditorJson(parsed);
      setJsonError(null);
    } catch (err) {
      setJsonError(err.message);
    }
  };

  // Format JSON
  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(definitionJson);
      const formatted = JSON.stringify(parsed, null, 2);
      setDefinitionJson(formatted);
      applyParsedEditorJson(parsed);
      setJsonError(null);
    } catch (err) {
      setJsonError(err.message);
    }
  };

  // Add tag
  const handleAddTag = () => {
    if (!tagInput.trim()) return;

    const currentTags = formData.metadata?.tags || [];
    if (!currentTags.includes(tagInput.trim())) {
      handleMetadataChange('tags', [...currentTags, tagInput.trim()]);
    }
    setTagInput('');
  };

  // Remove tag
  const handleRemoveTag = (tagToRemove) => {
    const currentTags = formData.metadata?.tags || [];
    handleMetadataChange('tags', currentTags.filter(tag => tag !== tagToRemove));
  };

  // Save handler
  const handleSave = async () => {
    // Validate JSON first
    if (jsonError) {
      setSaveStatus({ type: 'error', message: 'Please fix JSON errors before saving' });
      return;
    }

    // Validate required fields
    if (!formData.name?.trim()) {
      setSaveStatus({ type: 'error', message: 'Name is required' });
      return;
    }

    setSaveStatus({ type: 'saving', message: 'Saving...' });

    const useHierarchicalDefinition = shouldTreatDefinitionAsHierarchical(formData.definition, formData.definitionFormat)
      || `${formData.definitionFormat || ''}`.toUpperCase() === HIERARCHICAL_DEFINITION_FORMAT;

    const payload = useHierarchicalDefinition
      ? {
        ...formData,
        definitionFormat: HIERARCHICAL_DEFINITION_FORMAT,
        definition: mergeHierarchicalDefinitionWithNodes(formData.definition, formData.nodes || [], {
          name: formData.name,
          rmEntity: formData.rmType,
          archetypeId: formData?.definition?.archetypeId
        })
      }
      : formData;

    const result = await onSave(payload);

    if (result.success) {
      setSaveStatus({ type: 'success', message: 'Saved successfully!' });
      setTimeout(() => setSaveStatus(null), 3000);
    } else {
      setSaveStatus({ type: 'error', message: result.error || 'Failed to save' });
    }
  };

  // Delete handler
  const handleDelete = () => {
    if (!formData.id) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    onDelete(formData.id);
    setShowDeleteConfirm(false);
  };

  const handleApplyLintFix = (issue) => {
    if (!issue?.fix?.id || !Array.isArray(formData?.nodes)) return;
    const fixedNodes = applyLintFix(formData.nodes, issue, {
      temporalMode: formData?.metadata?.temporalMode || undefined,
      kind: formData?.kind || undefined,
      scope: formData?.scope || undefined
    });
    handleNodesChange(fixedNodes);
  };

  const handleApplyAllLintFixes = () => {
    if (!Array.isArray(formData?.nodes) || lintIssues.length === 0) return;
    const fixedNodes = applyAllSafeFixes(formData.nodes, lintIssues, {
      temporalMode: formData?.metadata?.temporalMode || undefined,
      kind: formData?.kind || undefined,
      scope: formData?.scope || undefined
    });
    handleNodesChange(fixedNodes);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Editor header */}
      <div className="flex items-center justify-between p-4 border-b border-theme bg-surface flex-shrink-0">
        <div className="flex items-center gap-3">
          <FileCode size={24} className="text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-theme-primary">
              {isCreating ? 'Create New ContextObject' : formData.name || 'Edit ContextObject'}
            </h2>
            <p className="text-xs text-theme-secondary">
              ContextObject Definition (reusable schema template)
            </p>
            {!isCreating && formData.id && (
              <p className="text-xs text-theme-secondary font-mono mt-0.5">ID: {formData.id}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Save status */}
          {saveStatus && (
            <div className={`flex items-center gap-1 text-sm mr-2 ${saveStatus.type === 'error'
                ? 'text-error'
                : saveStatus.type === 'success'
                  ? 'text-success'
                  : 'text-theme-secondary'
              }`}>
              {saveStatus.type === 'error' && <AlertCircle size={16} />}
              {saveStatus.type === 'success' && <CheckCircle2 size={16} />}
              {saveStatus.message}
            </div>
          )}

          {/* Action buttons */}
          <button
            onClick={handleSave}
            disabled={!!jsonError || saveStatus?.type === 'saving'}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={16} />
            {isCreating ? 'Save as new ContextObject' : 'Update ContextObject'}
          </button>

          {!isCreating && (
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 bg-error/10 text-error rounded-lg hover:bg-error/20 transition-colors"
            >
              <Trash2 size={16} />
              Delete
            </button>
          )}

          <button
            onClick={onCancel}
            className="p-2 text-theme-secondary hover:text-theme-primary hover:bg-background rounded-lg transition-colors"
            title="Close editor"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Editor content with tabs */}
      <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mb-0 flex-shrink-0 bg-surface border-b border-theme px-4 pt-2">
            <TabsTrigger value="compose" className="flex items-center gap-2">
              <Puzzle size={16} />
              Compose
            </TabsTrigger>
            <TabsTrigger value="fields" className="flex items-center gap-2">
              <List size={16} />
              Fields
            </TabsTrigger>
            <TabsTrigger value="mindmap" className="flex items-center gap-2">
              <Network size={16} />
              Mind Map
            </TabsTrigger>
            <TabsTrigger value="lint" className="flex items-center gap-2">
              <ShieldAlert size={16} />
              Lint
            </TabsTrigger>
            <TabsTrigger value="artifacts" className="flex items-center gap-2">
              <Sparkles size={16} />
              Artifacts
            </TabsTrigger>
            <TabsTrigger value="metadata" className="flex items-center gap-2">
              <Settings size={16} />
              Metadata
            </TabsTrigger>
            <TabsTrigger value="definition" className="flex items-center gap-2">
              <Code size={16} />
              Definition
            </TabsTrigger>
          </TabsList>

          {/* Compose Tab - Block-based visual builder */}
          <TabsContent value="compose" className="flex-1 overflow-hidden min-h-0 p-0">
            {formData.nodes && Array.isArray(formData.nodes) ? (
              <div className="h-full overflow-hidden">
                <IntegratedBlockComposer
                  nodes={formData.nodes || []}
                  onNodesChange={handleNodesChange}
                  definitionName={formData.name || 'ContextObject'}
                  aiBootstrap={aiBootstrap}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-theme-secondary">
                <div className="text-center">
                  <Puzzle size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Block composition not available</p>
                  <p className="text-sm mt-2">
                    Block-based composition is only available for node-based semantic objects.
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Fields Tab */}
          <TabsContent value="fields" className="flex-1 overflow-hidden flex flex-col min-h-0 p-4">
            {formData.nodes && Array.isArray(formData.nodes) ? (
              <>
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <div>
                    <h3 className="text-sm font-medium text-theme-primary">Object Fields</h3>
                    <p className="text-xs text-theme-secondary mt-1">
                      Define and reorder fields for your semantic object
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={syncDefinitionFromNodes}
                      disabled={syncingNodes || !formData.nodes?.length}
                      className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                      title="Generate JSON Schema from SemanticNodes (ADL2-inspired)"
                    >
                      <RefreshCw size={14} className={syncingNodes ? 'animate-spin' : ''} />
                      Generate Schema
                    </button>
                  </div>
                </div>

                {/* Fields Table - Full width */}
                <div className="flex-1 overflow-auto min-h-0">
                  <FieldsTable
                    nodes={formData.nodes || []}
                    onNodesChange={handleNodesChange}
                    readOnly={false}
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-theme-secondary">
                <div className="text-center">
                  <List size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Fields editing not available</p>
                  <p className="text-sm mt-2">
                    Field editing is only available for node-based semantic objects.
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Mind Map Tab */}
          <TabsContent value="mindmap" className="flex-1 overflow-hidden flex flex-col min-h-0 p-4">
            {formData.nodes && Array.isArray(formData.nodes) ? (
              <>
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <div>
                    <h3 className="text-sm font-medium text-theme-primary">Visual Structure</h3>
                    <p className="text-xs text-theme-secondary mt-1">
                      Interactive visualization of your semantic object structure
                    </p>
                  </div>
                </div>

                {/* MindMap Visualization - Full screen */}
                <div className="flex-1 border border-theme rounded-lg overflow-hidden min-h-0">
                  <NodeMindMap
                    nodes={formData.nodes || []}
                    title="Object Structure"
                  />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-theme-secondary">
                <div className="text-center">
                  <Network size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Mind map not available</p>
                  <p className="text-sm mt-2">
                    Visual structure is only available for node-based semantic objects.
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Lint Tab */}
          <TabsContent value="lint" className="flex-1 overflow-hidden flex flex-col min-h-0 p-4">
            <LintPanel
              issues={lintIssues}
              onApplyFix={handleApplyLintFix}
              onApplyAll={handleApplyAllLintFixes}
            />
          </TabsContent>

          <TabsContent value="artifacts" className="flex-1 overflow-hidden flex flex-col min-h-0 p-0">
            <SemanticArtifactsPanel
              definition={formData}
              activeEnvironmentId={activeEnvironmentId}
              isCreating={isCreating}
              onNavigate={onNavigate}
            />
          </TabsContent>

          {/* Metadata Tab */}
          <TabsContent value="metadata" className="flex-1 overflow-auto min-h-0 p-4">
            <div className="space-y-6 max-w-4xl">
              {/* Info Banner */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-semibold text-blue-400 mb-2">ContextObject / Block Definition</h4>
                <p className="text-xs text-theme-secondary leading-relaxed">
                  This is a reusable <strong>definition</strong> for a ContextObject or block. It defines the <em>structure and constraints</em> for data,
                  but does not contain runtime records.
                  <br/><br/>
                  ContextObjects can include reusable blocks, and blocks can be versioned and reused across many ContextObjects.
                </p>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-theme-primary mb-1">
                  Name <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Enter definition name"
                  className="w-full px-4 py-2 bg-background border border-theme rounded-lg text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-theme-primary mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                  className="w-full px-4 py-2 bg-background border border-theme rounded-lg text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary resize-none"
                />
              </div>

              {/* Origin and Scope */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-1">
                    Origin
                  </label>
                  <select
                    value={formData.origin || 'custom'}
                    onChange={(e) => handleChange('origin', e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-theme rounded-lg text-theme-primary focus:outline-none focus:border-primary"
                  >
                    {VALID_V1_ORIGINS.map(origin => (
                      <option key={origin} value={origin}>
                        {origin === 'custom' ? 'Custom' :
                         origin === 'standard' ? 'Standard (FHIR, openEHR)' :
                         'Imported'}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-theme-secondary mt-1">
                    Source of this object
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-1">
                    Scope
                  </label>
                  <select
                    value={formData.scope || 'business_object'}
                    onChange={(e) => handleChange('scope', e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-theme rounded-lg text-theme-primary focus:outline-none focus:border-primary"
                  >
                    {VALID_V1_SCOPES.map(scope => (
                      <option key={scope} value={scope}>
                        {scope === 'business_object' ? 'Business Object' :
                         scope === 'event' ? 'Event' :
                         scope === 'document' ? 'Document' :
                         'Block (Reusable)'}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-theme-secondary mt-1">
                    Type of object
                  </p>
                </div>
              </div>

              {/* Version and Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-1">
                    Version
                  </label>
                  <input
                    type="text"
                    value={formData.version || '1.0.0'}
                    onChange={(e) => handleChange('version', e.target.value)}
                    placeholder="e.g., 1.0.0"
                    className="w-full px-4 py-2 bg-background border border-theme rounded-lg text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary font-mono"
                  />
                  <p className="text-xs text-theme-secondary mt-1">
                    Semantic version (x.y.z)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status || 'draft'}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-theme rounded-lg text-theme-primary focus:outline-none focus:border-primary"
                  >
                    {VALID_STATUSES.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Definition format */}
              <div>
                <label className="block text-sm font-medium text-theme-primary mb-1">
                  Definition Format
                </label>
                <select
                  value={formData.definitionFormat || HIERARCHICAL_DEFINITION_FORMAT}
                  onChange={(e) => handleChange('definitionFormat', e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-theme rounded-lg text-theme-primary focus:outline-none focus:border-primary"
                >
                  {DEFINITION_FORMAT_OPTIONS.map((format) => (
                    <option key={format} value={format}>{format}</option>
                  ))}
                </select>
                <p className="text-xs text-theme-secondary mt-1">
                  Use <span className="font-mono">{HIERARCHICAL_DEFINITION_FORMAT}</span> to author ADL-like hierarchical definitions and derive storage nodes automatically.
                </p>
              </div>

              {/* Core primitives */}
              <div>
                <h4 className="text-sm font-semibold text-theme-primary mb-2">
                  Core ContextObject Primitives
                </h4>
                <p className="text-xs text-theme-secondary mb-3">
                  Cross-cutting semantics for storage, retrieval and agent workflows.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg border border-theme bg-background/60">
                    <div className="text-[11px] uppercase tracking-wide text-theme-secondary">Nodes</div>
                    <div className="text-xl font-semibold text-theme-primary">{primitiveStats.nodeCount}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-theme bg-background/60">
                    <div className="text-[11px] uppercase tracking-wide text-theme-secondary">Bindings</div>
                    <div className="text-xl font-semibold text-theme-primary">{primitiveStats.bindingCount}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-theme bg-background/60">
                    <div className="text-[11px] uppercase tracking-wide text-theme-secondary">Relationships</div>
                    <div className="text-xl font-semibold text-theme-primary">{primitiveStats.relationshipCount}</div>
                  </div>
                  <div className="p-3 rounded-lg border border-theme bg-background/60">
                    <div className="text-[11px] uppercase tracking-wide text-theme-secondary">Query Signals</div>
                    <div className="text-xl font-semibold text-theme-primary">{primitiveStats.operationalSignals}</div>
                  </div>
                </div>
              </div>

              {/* Definition terminology bindings */}
              <div className="border border-theme rounded-lg p-4 bg-background/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TagIcon size={16} className="text-primary" />
                    <h4 className="text-sm font-semibold text-theme-primary">Definition Terminology</h4>
                  </div>
                  <button
                    onClick={() => handleTopLevelCollectionAdd('terminologyBindings', {
                      system: '',
                      code: '',
                      display: '',
                      valueSet: undefined,
                      bindingStrength: 'required'
                    })}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-theme text-xs text-theme-primary hover:bg-background transition-colors"
                  >
                    <Plus size={12} />
                    Add Binding
                  </button>
                </div>
                {Array.isArray(formData.terminologyBindings) && formData.terminologyBindings.length > 0 ? (
                  <div className="space-y-2">
                    {formData.terminologyBindings.map((binding, index) => (
                      <div key={`object-term-${index}`} className="grid grid-cols-12 gap-2 p-2 rounded bg-background border border-theme/70">
                        <input
                          type="text"
                          value={binding.system || ''}
                          onChange={(e) => handleTopLevelCollectionUpdate('terminologyBindings', index, { system: e.target.value })}
                          placeholder="System (SNOMED-CT)"
                          className="col-span-3 px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                        />
                        <input
                          type="text"
                          value={binding.code || ''}
                          onChange={(e) => handleTopLevelCollectionUpdate('terminologyBindings', index, { code: e.target.value })}
                          placeholder="Code"
                          className="col-span-2 px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                        />
                        <input
                          type="text"
                          value={binding.display || ''}
                          onChange={(e) => handleTopLevelCollectionUpdate('terminologyBindings', index, { display: e.target.value })}
                          placeholder="Display"
                          className="col-span-3 px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                        />
                        <select
                          value={binding.bindingStrength || 'required'}
                          onChange={(e) => handleTopLevelCollectionUpdate('terminologyBindings', index, { bindingStrength: e.target.value })}
                          className="col-span-2 px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                        >
                          {TERMINOLOGY_BINDING_STRENGTHS.map((strength) => (
                            <option key={strength} value={strength}>{strength}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleTopLevelCollectionRemove('terminologyBindings', index)}
                          className="col-span-2 inline-flex items-center justify-center px-2 py-1.5 rounded border border-error/60 text-error hover:bg-error/10 transition-colors"
                          title="Remove binding"
                        >
                          <Trash2 size={14} />
                        </button>
                        <input
                          type="text"
                          value={binding.valueSet || ''}
                          onChange={(e) => handleTopLevelCollectionUpdate('terminologyBindings', index, { valueSet: e.target.value || undefined })}
                          placeholder="Value set URL/URN/identifier (optional)"
                          className="col-span-12 px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-theme-secondary">No definition-level terminology bindings yet.</p>
                )}
              </div>

              {/* Definition structural bindings */}
              <div className="border border-theme rounded-lg p-4 bg-background/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database size={16} className="text-primary" />
                    <h4 className="text-sm font-semibold text-theme-primary">Definition Structural Bindings</h4>
                  </div>
                  <button
                    onClick={() => handleTopLevelCollectionAdd('structuralBindings', {
                      model: 'FHIR',
                      path: '',
                      nodeId: rootNodeId || ''
                    })}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-theme text-xs text-theme-primary hover:bg-background transition-colors"
                  >
                    <Plus size={12} />
                    Add Binding
                  </button>
                </div>
                {Array.isArray(formData.structuralBindings) && formData.structuralBindings.length > 0 ? (
                  <div className="space-y-2">
                    {formData.structuralBindings.map((binding, index) => (
                      <div key={`object-struct-${index}`} className="grid grid-cols-12 gap-2 p-2 rounded bg-background border border-theme/70">
                        <select
                          value={binding.model || 'FHIR'}
                          onChange={(e) => handleTopLevelCollectionUpdate('structuralBindings', index, { model: e.target.value })}
                          className="col-span-2 px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                        >
                          {STRUCTURAL_MODELS.map((model) => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={binding.path || ''}
                          onChange={(e) => handleTopLevelCollectionUpdate('structuralBindings', index, { path: e.target.value })}
                          placeholder="Path (Observation.valueQuantity.value)"
                          className="col-span-7 px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary font-mono"
                        />
                        <select
                          value={binding.nodeId || ''}
                          onChange={(e) => handleTopLevelCollectionUpdate('structuralBindings', index, { nodeId: e.target.value || undefined })}
                          className="col-span-2 px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                        >
                          <option value="">All nodes</option>
                          {nodeOptions.map((node) => (
                            <option key={node.nodeId} value={node.nodeId}>{node.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleTopLevelCollectionRemove('structuralBindings', index)}
                          className="col-span-1 inline-flex items-center justify-center px-2 py-1.5 rounded border border-error/60 text-error hover:bg-error/10 transition-colors"
                          title="Remove structural binding"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-theme-secondary">No definition-level structural bindings yet.</p>
                )}
              </div>

              {/* Semantic relationships */}
              <div className="border border-theme rounded-lg p-4 bg-background/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link2 size={16} className="text-primary" />
                    <h4 className="text-sm font-semibold text-theme-primary">Semantic Relationships</h4>
                  </div>
                  <button
                    onClick={() => handleTopLevelCollectionAdd('relationships', {
                      relationshipId: generateRelationshipId(),
                      type: 'associated_with',
                      sourceNodeId: rootNodeId || '',
                      targetNodeId: undefined,
                      targetObjectId: undefined,
                      targetPath: undefined,
                      cardinality: 'one_to_one',
                      description: undefined
                    })}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-theme text-xs text-theme-primary hover:bg-background transition-colors"
                  >
                    <Plus size={12} />
                    Add Relationship
                  </button>
                </div>
                {Array.isArray(formData.relationships) && formData.relationships.length > 0 ? (
                  <div className="space-y-3">
                    {formData.relationships.map((relationship, index) => (
                      <div key={relationship.relationshipId || `object-rel-${index}`} className="p-3 rounded border border-theme/70 bg-background space-y-2">
                        <div className="grid grid-cols-12 gap-2">
                          <input
                            type="text"
                            value={relationship.relationshipId || ''}
                            onChange={(e) => handleTopLevelCollectionUpdate('relationships', index, { relationshipId: e.target.value })}
                            placeholder="Relationship ID"
                            className="col-span-3 px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary font-mono"
                          />
                          <select
                            value={relationship.type || 'associated_with'}
                            onChange={(e) => handleTopLevelCollectionUpdate('relationships', index, { type: e.target.value })}
                            className="col-span-3 px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                          >
                            {RELATIONSHIP_TYPES.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                          <select
                            value={relationship.sourceNodeId || ''}
                            onChange={(e) => handleTopLevelCollectionUpdate('relationships', index, { sourceNodeId: e.target.value })}
                            className="col-span-4 px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                          >
                            <option value="">Select source node</option>
                            {nodeOptions.map((node) => (
                              <option key={node.nodeId} value={node.nodeId}>{node.label}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleTopLevelCollectionRemove('relationships', index)}
                            className="col-span-2 inline-flex items-center justify-center px-2 py-1.5 rounded border border-error/60 text-error hover:bg-error/10 transition-colors"
                            title="Remove relationship"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <div className="grid grid-cols-12 gap-2">
                          <select
                            value={relationship.targetNodeId || ''}
                            onChange={(e) => handleTopLevelCollectionUpdate('relationships', index, { targetNodeId: e.target.value || undefined })}
                            className="col-span-4 px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                          >
                            <option value="">Target node (same object)</option>
                            {nodeOptions.map((node) => (
                              <option key={node.nodeId} value={node.nodeId}>{node.label}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={relationship.targetObjectId || ''}
                            onChange={(e) => handleTopLevelCollectionUpdate('relationships', index, { targetObjectId: e.target.value || undefined })}
                            placeholder="Target object ID (cross-object)"
                            className="col-span-4 px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                          />
                          <select
                            value={relationship.cardinality || ''}
                            onChange={(e) => handleTopLevelCollectionUpdate('relationships', index, { cardinality: e.target.value || undefined })}
                            className="col-span-4 px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                          >
                            <option value="">Cardinality (optional)</option>
                            {RELATIONSHIP_CARDINALITIES.map((cardinality) => (
                              <option key={cardinality} value={cardinality}>{cardinality}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={relationship.targetPath || ''}
                            onChange={(e) => handleTopLevelCollectionUpdate('relationships', index, { targetPath: e.target.value || undefined })}
                            placeholder="Target path (optional)"
                            className="col-span-6 px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary font-mono"
                          />
                          <input
                            type="text"
                            value={relationship.description || ''}
                            onChange={(e) => handleTopLevelCollectionUpdate('relationships', index, { description: e.target.value || undefined })}
                            placeholder="Description (optional)"
                            className="col-span-6 px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-theme-secondary">No semantic relationships defined yet.</p>
                )}
              </div>

              {/* Operational profile */}
              <div className="border border-theme rounded-lg p-4 bg-background/50 space-y-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={16} className="text-primary" />
                  <h4 className="text-sm font-semibold text-theme-primary">Operational Profile</h4>
                </div>
                <p className="text-xs text-theme-secondary">
                  Keep this model agnostic while exposing retrieval, indexing and retention intentions.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={operationalProfile.writeMode || ''}
                    onChange={(e) => handleOperationalProfileChange('writeMode', e.target.value || undefined)}
                    className="px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                  >
                    <option value="">Write mode (optional)</option>
                    {OPERATIONAL_WRITE_MODES.map((mode) => (
                      <option key={mode} value={mode}>{mode}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={operationalProfile.partitionKey || ''}
                    onChange={(e) => handleOperationalProfileChange('partitionKey', e.target.value)}
                    placeholder="Partition key (e.g., subjectId)"
                    className="px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    value={operationalProfile.retentionPolicy || ''}
                    onChange={(e) => handleOperationalProfileChange('retentionPolicy', e.target.value)}
                    placeholder="Retention policy"
                    className="px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    value={operationalProfile.temporalAxis || ''}
                    onChange={(e) => handleOperationalProfileChange('temporalAxis', e.target.value)}
                    placeholder="Temporal axis (e.g., eventTime)"
                    className="px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <input
                  type="text"
                  value={formatArrayAsCsv(operationalProfile.readPatterns)}
                  onChange={(e) => handleOperationalProfileListChange('readPatterns', e.target.value)}
                  placeholder="Read patterns (comma-separated)"
                  className="w-full px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                />
                <input
                  type="text"
                  value={formatArrayAsCsv(operationalProfile.queryAxes)}
                  onChange={(e) => handleOperationalProfileListChange('queryAxes', e.target.value)}
                  placeholder="Query axes (comma-separated)"
                  className="w-full px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                />
                <input
                  type="text"
                  value={formatArrayAsCsv(operationalProfile.optimizedPaths)}
                  onChange={(e) => handleOperationalProfileListChange('optimizedPaths', e.target.value)}
                  placeholder="Optimized paths (comma-separated)"
                  className="w-full px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary font-mono"
                />
                <input
                  type="text"
                  value={formatArrayAsCsv(operationalProfile.indexHints)}
                  onChange={(e) => handleOperationalProfileListChange('indexHints', e.target.value)}
                  placeholder="Index hints (comma-separated)"
                  className="w-full px-3 py-1.5 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-theme-primary mb-1">
                  Tags
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="Add a tag..."
                    className="flex-1 px-4 py-2 bg-background border border-theme rounded-lg text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(formData.metadata?.tags || []).map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-slate-600/30 text-slate-300 text-sm rounded"
                    >
                      <TagIcon size={12} />
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 text-slate-400 hover:text-error"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* External ID (for standard/imported) */}
              {(formData.origin === 'standard' || formData.origin === 'imported') && (
                <div>
                  <label className="block text-sm font-medium text-theme-primary mb-1">
                    External ID
                  </label>
                  <input
                    type="text"
                    value={formData.externalId || ''}
                    onChange={(e) => handleChange('externalId', e.target.value)}
                    placeholder="e.g., external profile URL or source id"
                    className="w-full px-4 py-2 bg-background border border-theme rounded-lg text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary font-mono"
                  />
                  <p className="text-xs text-theme-secondary mt-1">
                    Reference to the original standard definition
                  </p>
                </div>
              )}

              {/* v1 Schema Info (read-only) */}
              <div className="p-4 bg-background/50 border border-theme/50 rounded-lg">
                <h4 className="text-sm font-medium text-theme-primary mb-2">Schema Information (v1)</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-theme-secondary">Schema Version:</span>
                    <span className="ml-2 font-mono text-green-400">{SCHEMA_VERSION}</span>
                  </div>
                  <div>
                    <span className="text-theme-secondary">Path Dialect:</span>
                    <span className="ml-2 font-mono text-green-400">{PATH_DIALECT}</span>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Definition Tab */}
          <TabsContent value="definition" className="flex-1 overflow-hidden flex flex-col min-h-0 p-4">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-theme-primary">
                  Definition JSON
                </span>
                <span className="text-xs text-theme-secondary">
                  (Scope: {formData.scope || 'unknown'}, Version: {formData.versionString || formData.version || 'n/a'})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {jsonError && (
                  <span className="text-xs text-error flex items-center gap-1">
                    <AlertCircle size={12} />
                    Invalid JSON
                  </span>
                )}
                <button
                  onClick={handleFormatJson}
                  className="px-3 py-1 text-xs bg-primary/20 text-primary rounded hover:bg-primary/30 transition-colors"
                >
                  Format JSON
                </button>
              </div>
            </div>

            <div className="flex-1 border border-theme rounded-lg overflow-hidden min-h-0">
              <Editor
                height="100%"
                defaultLanguage="json"
                value={definitionJson}
                onChange={handleJsonChange}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  formatOnPaste: true
                }}
                onMount={(editor) => {
                  editorRef.current = editor;
                }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-surface border border-theme rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-theme-primary mb-2">Confirm Deletion</h3>
            <p className="text-theme-secondary mb-4">
              Are you sure you want to delete &quot;{formData.name}&quot;? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-theme-secondary hover:text-theme-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 bg-error text-white rounded-lg hover:bg-error/90 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContextObjectEditor;
