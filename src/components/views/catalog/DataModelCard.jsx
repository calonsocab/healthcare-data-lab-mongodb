// src/components/views/catalog/DataModelCard.jsx
"use client";

import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  Maximize2,
  ExternalLink,
  Calendar,
  Tag,
  X,
  Loader2,
  Layers,
  FileText,
  Hash,
  ToggleLeft,
  Clock,
  Code,
  Link,
  Box,
  List,
} from 'lucide-react';
import { DomainIcon, DOMAIN_CONFIG } from './DomainTabs';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/common/Tabs';
import MindMap from '@/components/common/MindMap';
import CodeViewer from '@/components/common/CodeViewer';
import {
  getCachedDataModel,
  setCachedDataModel,
  fetchDataModelDetail,
  invalidateDataModelCache,
} from '@/lib/data-models/clientCache';

const FHIR_ANALYTICS_PRIMITIVE_TYPES = new Set([
  'string',
  'code',
  'boolean',
  'integer',
  'decimal',
  'dateTime',
  'date',
  'time',
  'instant',
  'uri',
  'url',
  'canonical',
  'id',
  'markdown',
  'uuid',
  'oid',
]);

/**
 * Badge component for displaying metadata tags
 */
const Badge = ({ label, color = 'gray', className = '' }) => {
  const colorClasses = {
    gray: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    indigo: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    teal: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  };

  return (
    <span
      className={cn(
        'px-2 py-0.5 text-xs rounded border',
        colorClasses[color] || colorClasses.gray,
        className
      )}
    >
      {label}
    </span>
  );
};

/**
 * Get FHIR type display config
 */
const getFHIRTypeConfig = (type) => {
  const typeMap = {
    'string': { icon: FileText, color: 'text-green-400', bgColor: 'bg-green-500/20' },
    'code': { icon: Code, color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
    'boolean': { icon: ToggleLeft, color: 'text-pink-400', bgColor: 'bg-pink-500/20' },
    'integer': { icon: Hash, color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
    'decimal': { icon: Hash, color: 'text-orange-400', bgColor: 'bg-orange-500/20' },
    'dateTime': { icon: Clock, color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    'date': { icon: Clock, color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    'time': { icon: Clock, color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    'instant': { icon: Clock, color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
    'uri': { icon: Link, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
    'url': { icon: Link, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
    'canonical': { icon: Link, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20' },
    'Reference': { icon: ExternalLink, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' },
    'CodeableConcept': { icon: Layers, color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
    'Coding': { icon: Code, color: 'text-indigo-400', bgColor: 'bg-indigo-500/20' },
    'Identifier': { icon: Hash, color: 'text-teal-400', bgColor: 'bg-teal-500/20' },
    'BackboneElement': { icon: Box, color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
    'Element': { icon: Box, color: 'text-gray-400', bgColor: 'bg-gray-500/20' },
  };
  return typeMap[type] || { icon: FileText, color: 'text-theme-secondary', bgColor: 'bg-theme-secondary/20' };
};

/**
 * Parse FHIR StructureDefinition elements into a tree structure
 */
const parseFHIRElements = (data) => {
  if (!data) return [];

  // Prefer snapshot when present; differential can be sparse.
  const elements =
    (Array.isArray(data.snapshot?.element) && data.snapshot.element.length > 0)
      ? data.snapshot.element
      : (Array.isArray(data.differential?.element) ? data.differential.element : []);
  if (!elements.length) return [];

  const validElements = elements.filter((el) => el && typeof el.path === 'string' && el.path.length > 0);
  if (!validElements.length) return [];

  // Build node map first (order-independent).
  const nodeMap = new Map();
  validElements.forEach((el, idx) => {
    const parts = el.path.split('.');
    const nodeName = parts[parts.length - 1];

    const types = el.type?.map((t) => t.code).filter(Boolean) || [];
    const primaryType = types[0] || 'Element';

    const min = el.min ?? 0;
    const max = el.max === '*' ? '*' : (el.max ?? '*');
    const cardinality = `${min}..${max}`;

    nodeMap.set(el.path, {
      id: el.path,
      name: nodeName,
      path: el.path,
      type: primaryType,
      types,
      cardinality,
      isRequired: min > 0,
      short: el.short,
      definition: el.definition,
      binding: el.binding,
      children: [],
      __order: idx,
    });
  });

  // Ensure parents exist even in sparse differentials.
  const ensureParent = (path) => {
    if (!path) return null;
    if (nodeMap.has(path)) return nodeMap.get(path);

    const parts = String(path).split('.');
    if (parts.length <= 1) return null;

    const nodeName = parts[parts.length - 1];
    const synthetic = {
      id: path,
      name: nodeName,
      path,
      type: 'Element',
      types: [],
      cardinality: '0..*',
      isRequired: false,
      short: undefined,
      definition: undefined,
      binding: undefined,
      children: [],
      __order: Number.MAX_SAFE_INTEGER,
      __synthetic: true,
    };
    nodeMap.set(path, synthetic);

    const parentPath = parts.slice(0, -1).join('.');
    ensureParent(parentPath);
    return synthetic;
  };

  // Build parent-child relationships.
  for (const node of nodeMap.values()) {
    const parts = String(node.path).split('.');
    if (parts.length <= 1) continue;
    const parentPath = parts.slice(0, -1).join('.');
    const parent = nodeMap.get(parentPath) || ensureParent(parentPath);
    if (parent) parent.children.push(node);
  }

  // Roots: nodes with no dot, plus any nodes whose parent doesn't exist.
  const roots = [];
  for (const node of nodeMap.values()) {
    const parts = String(node.path).split('.');
    if (parts.length === 1) {
      roots.push(node);
      continue;
    }
    const parentPath = parts.slice(0, -1).join('.');
    if (!nodeMap.has(parentPath)) roots.push(node);
  }

  // Deterministic child ordering: preserve original snapshot order as best-effort.
  const sortTree = (n) => {
    n.children.sort((a, b) => (a.__order ?? 0) - (b.__order ?? 0));
    n.children.forEach(sortTree);
  };
  roots.sort((a, b) => (a.__order ?? 0) - (b.__order ?? 0));
  roots.forEach(sortTree);

  return roots;
};

const getJsonNodeType = (value) => {
  if (value === null || value === undefined) return 'Element';
  if (Array.isArray(value)) return 'Element';
  const t = typeof value;
  if (t === 'string') return 'string';
  if (t === 'boolean') return 'boolean';
  if (t === 'number') return Number.isInteger(value) ? 'integer' : 'decimal';
  if (t === 'object') return 'BackboneElement';
  return 'Element';
};

const formatJsonPathParts = (parts = []) => {
  let out = '';
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith('[')) {
      out += part; // array marker, e.g. "[*]"
      continue;
    }
    out += out ? `.${part}` : part;
  }
  return out;
};

const buildJsonTree = (value, { key = null, pathParts = [], depth = 0, maxDepth = 12 } = {}) => {
  const type = getJsonNodeType(value);
  const name =
    key == null
      ? (typeof value?.resourceType === 'string' ? value.resourceType : 'root')
      : String(key);
  const path = pathParts.length ? formatJsonPathParts(pathParts) : '';

  const isArray = Array.isArray(value);
  const isObject = value && typeof value === 'object' && !isArray;

  const node = {
    id: path || name,
    name,
    path,
    type,
    types: [],
    cardinality: isArray ? '0..*' : '0..1',
    isRequired: false,
    short: undefined,
    definition: undefined,
    binding: undefined,
    children: [],
    __json: true,
    __selectable: !isObject && !isArray && value !== null && value !== undefined,
  };

  if (depth >= maxDepth) return node;

  if (isArray) {
    // Avoid enumerating items; represent an item schema node.
    const first = value.length > 0 ? value[0] : null;
    const item = buildJsonTree(first, {
      key: '[*]',
      pathParts: [...pathParts, '[*]'],
      depth: depth + 1,
      maxDepth,
    });
    item.cardinality = '0..1';
    node.children = [item];
    return node;
  }

  if (isObject) {
    node.children = Object.entries(value).map(([k, v]) =>
      buildJsonTree(v, {
        key: k,
        pathParts: pathParts.length ? [...pathParts, k] : [k],
        depth: depth + 1,
        maxDepth,
      })
    );
    return node;
  }

  return node;
};

const parseFHIRTreeData = (data) => {
  if (!data) return [];
  if (data.resourceType === 'StructureDefinition') return parseFHIRElements(data);
  // Any other FHIR resource: show its JSON shape in the same table-style tree.
  return [buildJsonTree(data, { key: data.resourceType || 'root', pathParts: [] })];
};

const makeFhirAnalyticsField = (node) => {
  const path = typeof node?.path === 'string' ? node.path : '';
  if (!path) return null;
  const name = typeof node?.name === 'string' && node.name.length ? node.name : path.split('.').pop();
  const rmType = typeof node?.type === 'string' ? node.type : 'Element';
  return { name, path, rmType };
};

const enhanceFhirAnalyticsTree = (nodes = []) => {
  const isPrimitive = (t) => FHIR_ANALYTICS_PRIMITIVE_TYPES.has(String(t || ''));

  const walk = (node) => {
    const children = Array.isArray(node?.children) ? node.children : [];
    const enhancedChildren = children.map(walk);

    const leafFields = [];
    for (const c of enhancedChildren) {
      if (Array.isArray(c.__leafFields) && c.__leafFields.length) {
        leafFields.push(...c.__leafFields);
      }
    }

    const selectable =
      !!node?.__selectable ||
      (!!node?.path && enhancedChildren.length === 0 && isPrimitive(node?.type));

    if (leafFields.length === 0 && selectable) {
      const f = makeFhirAnalyticsField(node);
      if (f) leafFields.push(f);
    }

    return { ...node, children: enhancedChildren, __leafFields: leafFields, __selectable: selectable };
  };

  return nodes.map(walk);
};

const FHIRAnalyticsTreeNode = ({
  node,
  level,
  expandedIds,
  toggleExpanded,
  selectedPaths,
  toggleSelection,
}) => {
  const children = Array.isArray(node?.children) ? node.children : [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const leafFields = Array.isArray(node.__leafFields) ? node.__leafFields : [];
  const selectableLeaves = leafFields.filter((f) => f && typeof f.path === 'string' && f.path.length > 0);

  let selectedCount = 0;
  for (const f of selectableLeaves) if (selectedPaths.has(f.path)) selectedCount += 1;
  const totalCount = selectableLeaves.length;
  const checked = totalCount > 0 && selectedCount === totalCount;
  const indeterminate = selectedCount > 0 && selectedCount < totalCount;

  const typeConfig = getFHIRTypeConfig(node.type);
  const TypeIcon = typeConfig.icon;

  return (
    <div>
      <div
        className="group flex items-center gap-2 py-1 px-2 hover:bg-surface-hover rounded cursor-pointer"
        style={{ paddingLeft: `${level * 14 + 8}px` }}
        onClick={() => hasChildren && toggleExpanded(node.id)}
      >
        {hasChildren ? (
          <span className="w-4 h-4 flex items-center justify-center text-theme-secondary">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span className="w-4" />
        )}

        <input
          type="checkbox"
          className="accent-primary"
          checked={checked}
          ref={(el) => {
            if (el) el.indeterminate = indeterminate;
          }}
          onChange={(e) => {
            e.stopPropagation();
            toggleSelection(node);
          }}
          disabled={totalCount === 0}
          title={totalCount === 0 ? 'No selectable fields under this node' : 'Toggle analytics fields'}
        />

        <TypeIcon size={14} className={cn(typeConfig.color, 'opacity-80')} />
        <span className="text-sm text-theme-primary min-w-0 truncate">
          {node.name}
        </span>

        {totalCount > 0 && (
          <span className="ml-auto text-[11px] text-theme-secondary font-mono">
            {selectedCount}/{totalCount}
          </span>
        )}
      </div>

      {isExpanded && hasChildren && (
        <div>
          {children.map((c) => (
            <FHIRAnalyticsTreeNode
              key={c.id}
              node={c}
              level={level + 1}
              expandedIds={expandedIds}
              toggleExpanded={toggleExpanded}
              selectedPaths={selectedPaths}
              toggleSelection={toggleSelection}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const FHIRAnalyticsTab = ({ dataModel, data, fullscreen = false }) => {
  const [saving, setSaving] = useState(false);
  const [savedTemplate, setSavedTemplate] = useState(() => dataModel?.analyticsTemplate || null);
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [selectedFields, setSelectedFields] = useState(() => {
    const fields = dataModel?.analyticsTemplate?.fields;
    return Array.isArray(fields) ? fields.filter((f) => f?.path) : [];
  });
  const [rightPanelView, setRightPanelView] = useState('table');

  React.useEffect(() => {
    setSavedTemplate(dataModel?.analyticsTemplate || null);
    const fields = dataModel?.analyticsTemplate?.fields;
    setSelectedFields(Array.isArray(fields) ? fields.filter((f) => f?.path) : []);
    setExpandedIds(new Set());
  }, [dataModel?._id]);

  const treeRoots = useMemo(() => {
    const roots = parseFHIRTreeData(data);
    return enhanceFhirAnalyticsTree(roots);
  }, [data]);

  const selectedPathSet = useMemo(() => new Set(selectedFields.map((f) => String(f.path))), [selectedFields]);

  const initialSignature = useMemo(() => {
    const base = savedTemplate?.fields;
    const paths = Array.isArray(base) ? base.map((f) => String(f.path)).filter(Boolean).sort() : [];
    return JSON.stringify(paths);
  }, [savedTemplate]);

  const currentSignature = useMemo(() => {
    const paths = selectedFields.map((f) => String(f.path)).filter(Boolean).sort();
    return JSON.stringify(paths);
  }, [selectedFields]);

  const hasChanges = initialSignature !== currentSignature;

  const allNodeIds = useMemo(() => {
    const ids = [];
    const walk = (n) => {
      if (!n || !n.id) return;
      if (Array.isArray(n.children) && n.children.length) {
        ids.push(n.id);
        n.children.forEach(walk);
      }
    };
    treeRoots.forEach(walk);
    return ids;
  }, [treeRoots]);

  const expandAll = () => setExpandedIds(new Set(allNodeIds));
  const collapseAll = () => setExpandedIds(new Set());
  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelection = (node) => {
    const leafFields = Array.isArray(node?.__leafFields) ? node.__leafFields : [];
    const leaves = leafFields.filter((f) => f?.path);
    if (!leaves.length) return;

    const allSelected = leaves.every((f) => selectedPathSet.has(String(f.path)));
    if (allSelected) {
      const remove = new Set(leaves.map((f) => String(f.path)));
      setSelectedFields((prev) => prev.filter((f) => !remove.has(String(f.path))));
      return;
    }

    setSelectedFields((prev) => {
      const seen = new Set(prev.map((f) => String(f.path)));
      const next = prev.slice();
      for (const f of leaves) {
        const p = String(f.path);
        if (seen.has(p)) continue;
        next.push({ name: f.name, path: p, rmType: f.rmType });
        seen.add(p);
      }
      return next;
    });
  };

  const selectAll = () => {
    const allLeaves = [];
    for (const r of treeRoots) {
      const lf = Array.isArray(r.__leafFields) ? r.__leafFields : [];
      allLeaves.push(...lf);
    }
    const unique = new Map();
    for (const f of allLeaves) {
      if (!f?.path) continue;
      unique.set(String(f.path), { name: f.name, path: String(f.path), rmType: f.rmType });
    }
    setSelectedFields(Array.from(unique.values()));
  };

  const clearAll = () => setSelectedFields([]);

  const removeField = (path) => {
    setSelectedFields((prev) => prev.filter((f) => String(f.path) !== String(path)));
  };

  const handleSave = async () => {
    if (!dataModel?._id) return;
    try {
      setSaving(true);
      const analyticsTemplate = {
        id: dataModel._id,
        templateId: dataModel.name,
        domain: 'fhir',
        resourceType: data?.resourceType || dataModel.resourceType,
        fields: selectedFields.map((f) => ({
          name: f.name,
          path: f.path,
          rmType: f.rmType,
        })),
      };

      const res = await fetch(`/api/data-model-catalog/${dataModel._id}/analytics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analyticsTemplate }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save analytics configuration');
      }

      const payload = await res.json();
      const saved = payload?.analyticsTemplate || analyticsTemplate;
      setSavedTemplate(saved);
      setCachedDataModel({ ...dataModel, analyticsTemplate: saved });
    } catch (e) {
      console.error('Error saving FHIR analytics:', e);
      alert(`Failed to save analytics configuration: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const leftHeight = fullscreen ? 'calc(100vh - 360px)' : '420px';
  const rightHeight = fullscreen ? 'calc(100vh - 420px)' : '360px';

  return (
    <div className={cn('h-full flex flex-col', fullscreen && 'min-h-0')}>
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-theme">
        <div>
          <h3 className="text-lg font-semibold text-theme-primary">Analytics Configuration</h3>
          <p className="text-sm text-theme-secondary mt-1">
            Define which fields to include in analytics/projection queries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasChanges && <span className="text-sm text-warning">Unsaved changes</span>}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-4 py-2 bg-primary text-primary-text rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        <div className="w-1/2 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-theme-primary">FHIR Structure</h4>
            <div className="flex items-center gap-2 text-xs text-theme-secondary">
              <button onClick={expandAll} className="hover:text-primary">Expand All</button>
              <span>|</span>
              <button onClick={collapseAll} className="hover:text-primary">Collapse All</button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-xs rounded border border-theme surface hover:border-primary/50 transition-all"
            >
              Select All
            </button>
            <button
              onClick={clearAll}
              className="px-3 py-1.5 text-xs rounded border border-theme surface hover:border-primary/50 transition-all"
            >
              Clear All
            </button>
          </div>

          <div className="flex-1 overflow-auto border border-theme rounded-lg bg-background p-2" style={{ maxHeight: leftHeight }}>
            {treeRoots.length === 0 ? (
              <div className="p-8 text-center text-theme-secondary">No structure available.</div>
            ) : (
              treeRoots.map((r) => (
                <FHIRAnalyticsTreeNode
                  key={r.id}
                  node={r}
                  level={0}
                  expandedIds={expandedIds}
                  toggleExpanded={toggleExpanded}
                  selectedPaths={selectedPathSet}
                  toggleSelection={toggleSelection}
                />
              ))
            )}
          </div>
        </div>

        <div className="w-1/2 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-theme-primary">
              Selected Fields ({selectedFields.length})
            </h4>
            <div className="flex items-center gap-1 bg-surface rounded-lg p-0.5 border border-theme">
              <button
                onClick={() => setRightPanelView('table')}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors',
                  rightPanelView === 'table' ? 'bg-primary text-primary-text' : 'text-theme-secondary hover:text-theme-primary'
                )}
              >
                Table
              </button>
              <button
                onClick={() => setRightPanelView('json')}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors',
                  rightPanelView === 'json' ? 'bg-primary text-primary-text' : 'text-theme-secondary hover:text-theme-primary'
                )}
              >
                JSON
              </button>
            </div>
          </div>

          {rightPanelView === 'table' ? (
            <div className="flex-1 overflow-auto border border-theme rounded-lg bg-background" style={{ maxHeight: rightHeight }}>
              {selectedFields.length === 0 ? (
                <div className="p-8 text-center text-theme-secondary">
                  No fields selected yet.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-surface sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-theme-secondary">Field</th>
                      <th className="text-left px-3 py-2 font-medium text-theme-secondary">Type</th>
                      <th className="text-left px-3 py-2 font-medium text-theme-secondary">Path</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-theme">
                    {selectedFields.map((field) => (
                      <tr key={field.path} className="hover:bg-surface">
                        <td className="px-3 py-2 text-theme-primary text-sm font-medium">{field.name}</td>
                        <td className="px-3 py-2">
                          <span className="text-xs px-2 py-0.5 rounded bg-surface text-theme-secondary font-mono">
                            {field.rmType}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <code className="text-xs text-theme-secondary break-all">{field.path}</code>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => removeField(field.path)}
                            className="p-1 text-theme-secondary hover:text-error rounded hover:bg-error/10"
                            title="Remove field"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : (
            <CodeViewer
              value={JSON.stringify(
                {
                  id: dataModel._id,
                  domain: 'fhir',
                  resourceType: data?.resourceType || dataModel.resourceType,
                  fields: selectedFields,
                },
                null,
                2
              )}
              language="json"
              readOnly
              height={fullscreen ? 'calc(100vh - 420px)' : 360}
              fileName={`${dataModel.name || 'fhir'}-analytics.json`}
              allowFormat={false}
            />
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * FHIR Tree Node - Table-based layout matching OpenEHR TreeView
 */
const FHIRTreeNode = ({ node, level = 0, defaultExpanded = false }) => {
  const [isExpanded, setIsExpanded] = useState(level < 2 ? true : defaultExpanded);
  const hasChildren = node.children && node.children.length > 0;
  const typeConfig = getFHIRTypeConfig(node.type);
  const TypeIcon = typeConfig.icon;

  return (
    <>
      <div
        // Match the softer openEHR tree presentation (use theme border color, not default gray).
        className="group flex items-center py-1 hover:bg-surface-hover cursor-pointer border-b border-theme"
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {/* Node Name Column */}
        <div className="flex-1 flex items-center px-2" style={{ paddingLeft: `${level * 16}px` }}>
          {hasChildren ? (
            <span className="w-4 h-4 flex items-center justify-center text-theme-secondary mr-1">
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          ) : (
            <span className="w-4 mr-1" />
          )}
          <TypeIcon size={14} className={cn('mr-2', typeConfig.color)} />
          <span className="text-sm font-medium text-theme-primary">
            {node.name}
            {node.isRequired && <span className="text-error ml-1">*</span>}
          </span>
        </div>

        {/* Type Column */}
        <div className="w-32 text-center px-2">
          <span className={cn('text-xs px-2 py-0.5 rounded', typeConfig.bgColor, typeConfig.color)}>
            {node.type}
          </span>
        </div>

        {/* Cardinality Column */}
        <div className="w-24 text-center px-2">
          <span className="text-xs font-mono text-theme-secondary bg-surface px-2 py-0.5 rounded">
            {node.cardinality}
          </span>
        </div>

        {/* Path/ID Column */}
        <div className="w-64 truncate px-2">
          <span className="text-xs text-theme-secondary font-mono">{node.path}</span>
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child, idx) => (
            <FHIRTreeNode
              key={`${child.id}-${idx}`}
              node={child}
              level={level + 1}
              defaultExpanded={defaultExpanded}
            />
          ))}
        </div>
      )}
    </>
  );
};

/**
 * FHIR Tree View - Table-based layout matching OpenEHR TreeView
 */
const FHIRTreeView = ({ data, title, maxHeight = '400px' }) => {
  const treeData = useMemo(() => parseFHIRTreeData(data), [data]);

  if (!data || !treeData.length) {
    return (
      <div className="flex items-center justify-center py-8 text-theme-secondary">
        No structure data available
      </div>
    );
  }

  return (
    <div className="bg-background rounded-lg border border-theme overflow-hidden">
      {/* Header row */}
      <div className="flex items-center surface p-2 text-xs text-theme-secondary border-b border-theme sticky top-0 z-10">
        <div className="flex-1">Element</div>
        <div className="w-32 text-center">Type</div>
        <div className="w-24 text-center">Cardinality</div>
        <div className="w-64">Path</div>
      </div>

      {/* Tree content */}
      <div style={{ maxHeight, overflowY: 'auto' }}>
        {treeData.map((node, idx) => (
          <FHIRTreeNode key={`${node.id}-${idx}`} node={node} level={0} defaultExpanded={true} />
        ))}
      </div>
    </div>
  );
};

/**
 * FHIR Structure Display - Similar to OpenEHR EnhancedStructureDisplay
 * Shows top-level elements with expandable field details
 */
const FHIRStructureDisplay = ({ data }) => {
  const [expandedSections, setExpandedSections] = useState({});

  const elements = useMemo(() => {
    if (!data) return [];
    // Prefer snapshot when present; differential can be too sparse for a useful overview.
    const rawElements =
      (Array.isArray(data.snapshot?.element) && data.snapshot.element.length > 0)
        ? data.snapshot.element
        : (Array.isArray(data.differential?.element) ? data.differential.element : []);

    const validElements = rawElements.filter((el) => el && typeof el.path === 'string' && el.path.length > 0);

    // Build direct child mapping once (avoid O(n^2) scans for large snapshots).
    const childrenByParent = new Map();
    for (const el of validElements) {
      const parts = el.path.split('.');
      if (parts.length <= 1) continue;
      const parentPath = parts.slice(0, -1).join('.');
      if (!childrenByParent.has(parentPath)) childrenByParent.set(parentPath, []);
      childrenByParent.get(parentPath).push(el);
    }

    // Group elements by their top-level parent.
    // For typical StructureDefinitions, snapshot has: Type (root) + Type.field (top-level fields) + ...
    // Some differentials can be sparse and omit intermediate parents, which would otherwise make this tab look empty.
    let topLevel = validElements.filter((el) => {
      const parts = el.path.split('.');
      return parts.length <= 2; // Type or Type.field
    });

    if (topLevel.length === 0 && validElements.length > 0) {
      const rootTypeFromData = typeof data.type === 'string' && data.type.length ? data.type : null;
      const rootTypeFromElements = String(validElements[0].path || '').split('.')[0] || null;
      const rootPath = rootTypeFromData || rootTypeFromElements;

      const rootEl = rootPath ? validElements.find((el) => el.path === rootPath) : null;
      const topLevelPaths = Array.from(
        new Set(
          validElements
            .map((el) => String(el.path || '').split('.'))
            .filter((parts) => parts.length >= 2)
            .map((parts) => parts.slice(0, 2).join('.'))
        )
      );

      const synthesized = topLevelPaths.map((path) => {
        const exact = validElements.find((el) => el.path === path);
        if (exact) return exact;

        // Synthesize a minimal parent node if the intermediate element is missing.
        const descendant = validElements.find((el) => typeof el.path === 'string' && el.path.startsWith(`${path}.`));
        return {
          path,
          min: 0,
          max: '*',
          short: descendant?.short,
          definition: descendant?.definition,
          type: descendant?.type,
        };
      });

      topLevel = rootEl ? [rootEl, ...synthesized] : synthesized;
    }

    return topLevel.map(el => {
      const path = el.path;
      const types = el.type?.map(t => t.code) || [];
      const primaryType = types[0] || 'Element';

      // Find child elements
      const children = (childrenByParent.get(path) || []).filter((child) => {
        if (!child || typeof child.path !== 'string') return false;
        return child.path.split('.').length === path.split('.').length + 1;
      });

      return {
        id: path,
        name: path.split('.').pop(),
        path: path,
        type: primaryType,
        types: types,
        cardinality: `${el.min ?? 0}..${el.max === '*' ? '*' : el.max ?? '*'}`,
        isRequired: (el.min ?? 0) > 0,
        short: el.short,
        definition: el.definition,
        binding: el.binding,
        children: children.map(c => ({
          id: c.path,
          name: c.path.split('.').pop(),
          type: c.type?.[0]?.code || 'Element',
          cardinality: `${c.min ?? 0}..${c.max === '*' ? '*' : c.max ?? '*'}`,
          isRequired: (c.min ?? 0) > 0,
          short: c.short,
        })),
      };
    });
  }, [data]);

  const toggleSection = (id) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!elements.length) {
    return (
      <div className="flex items-center justify-center py-8 text-theme-secondary">
        No structure elements found
      </div>
    );
  }

  // Skip the root element when it's present (first element is usually the type itself, e.g. "Condition").
  const displayElements = (() => {
    const first = elements[0];
    const firstPath = typeof first?.path === 'string' ? first.path : '';
    const isRootLike = firstPath && !firstPath.includes('.') && (!data?.type || String(firstPath) === String(data.type));
    if (!isRootLike) return elements;

    const sliced = elements.slice(1);
    return sliced.length > 0 ? sliced : elements;
  })();

  return (
    <div className="space-y-2">
      {displayElements.map((element) => {
        const typeConfig = getFHIRTypeConfig(element.type);
        const TypeIcon = typeConfig.icon;
        const isExpanded = expandedSections[element.id];

        return (
          <div
            key={element.id}
            className="border border-theme rounded-lg p-3 hover:border-primary/50 transition-colors bg-surface"
          >
            <div className="flex items-start space-x-3">
              <TypeIcon size={18} className={typeConfig.color} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2 flex-wrap gap-1">
                    <h4 className="font-medium text-theme-primary">
                      {element.name}
                      {element.isRequired && <span className="text-error ml-1">*</span>}
                    </h4>
                    <span className={cn('px-2 py-0.5 text-xs rounded border', typeConfig.bgColor, typeConfig.color, 'border-current/30')}>
                      {element.type}
                    </span>
                    <span className="text-xs bg-background text-theme-secondary px-2 py-0.5 rounded border border-theme font-mono">
                      {element.cardinality}
                    </span>
                  </div>

                  {element.children.length > 0 && (
                    <button
                      onClick={() => toggleSection(element.id)}
                      className="flex items-center space-x-1 text-xs text-theme-secondary hover:text-theme-primary transition-colors"
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span>{element.children.length} field{element.children.length !== 1 ? 's' : ''}</span>
                    </button>
                  )}
                </div>

                {element.short && (
                  <p className="text-sm text-theme-secondary mb-2 line-clamp-2">
                    {element.short}
                  </p>
                )}

                {isExpanded && element.children.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {element.children.map((child) => {
                      const childTypeConfig = getFHIRTypeConfig(child.type);
                      const ChildIcon = childTypeConfig.icon;
                      return (
                        <div
                          key={child.id}
                          className="flex items-center justify-between p-2 bg-background border border-theme rounded text-xs"
                        >
                          <div className="flex items-center space-x-2 flex-1">
                            <ChildIcon size={14} className="text-theme-secondary" />
                            <span className="font-medium text-theme-primary">{child.name}</span>
                            {child.isRequired && <span className="text-error font-bold">*</span>}
                          </div>
                          <div className="flex items-center space-x-2 text-theme-secondary">
                            <span className={cn('text-xs px-1.5 py-0.5 rounded', childTypeConfig.bgColor, childTypeConfig.color)}>
                              {child.type}
                            </span>
                            <span className="text-xs bg-theme-secondary/20 px-1 py-0.5 rounded font-mono">
                              {child.cardinality}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const FHIRStructureDefinitionSummary = ({ data }) => {
  if (!data || data.resourceType !== 'StructureDefinition') return null;

  const type = data.type || null;
  const url = data.url || null;
  const baseDefinition = data.baseDefinition || null;
  const parentProfile = baseDefinition ? String(baseDefinition).split('/').pop() : null;
  const isResourceKind = String(data.kind || '').toLowerCase() === 'resource';

  const rootPath =
    (Array.isArray(data.snapshot?.element) && data.snapshot.element[0]?.path)
      ? data.snapshot.element[0].path
      : ((Array.isArray(data.differential?.element) && data.differential.element[0]?.path) ? data.differential.element[0].path : null);

  const isOneToOne = !!(isResourceKind && type && rootPath && String(rootPath) === String(type));

  return (
    <div className="rounded-lg border border-theme bg-surface p-4 space-y-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-1 rounded border border-theme/60 bg-theme-secondary/10 text-theme-secondary">
            StructureDefinition
          </span>
          {type && (
            <span className="text-xs px-2 py-1 rounded border border-red-500/30 bg-red-500/10 text-red-300">
              {isOneToOne ? `Profile for ${type}` : `Type: ${type}`}
            </span>
          )}
          {data.kind && (
            <span className="text-xs px-2 py-1 rounded border border-theme/60 bg-theme-secondary/10 text-theme-secondary">
              Kind: {String(data.kind)}
            </span>
          )}
          {data.derivation && (
            <span className="text-xs px-2 py-1 rounded border border-theme/60 bg-theme-secondary/10 text-theme-secondary">
              {String(data.derivation)}
            </span>
          )}
          {data.status && (
            <span className="text-xs px-2 py-1 rounded border border-theme/60 bg-theme-secondary/10 text-theme-secondary">
              {String(data.status)}
            </span>
          )}
          {data.version && (
            <span className="text-xs px-2 py-1 rounded border border-theme/60 bg-theme-secondary/10 text-theme-secondary font-mono">
              v{String(data.version)}
            </span>
          )}
        </div>

        <p className="mt-2 text-sm text-theme-primary font-semibold">
          {data.title || data.name || 'Unnamed profile'}
        </p>

        {(data.description || data.purpose) && (
          <div className="mt-1 space-y-1">
            {data.description && (
              <p className="text-sm text-theme-secondary leading-relaxed line-clamp-3">
                {String(data.description)}
              </p>
            )}
            {!data.description && data.purpose && (
              <p className="text-sm text-theme-secondary leading-relaxed line-clamp-3">
                {String(data.purpose)}
              </p>
            )}
            {data.description && data.purpose && (
              <p className="text-sm text-theme-secondary leading-relaxed line-clamp-2">
                <span className="text-theme-secondary/80">Purpose: </span>
                {String(data.purpose)}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        {data.id && (
          <div className="rounded border border-theme/60 bg-background px-3 py-2">
            <div className="text-theme-secondary">ID</div>
            <div className="text-theme-primary font-mono break-all">{String(data.id)}</div>
          </div>
        )}
        {data.name && (
          <div className="rounded border border-theme/60 bg-background px-3 py-2">
            <div className="text-theme-secondary">Name</div>
            <div className="text-theme-primary font-mono break-all">{String(data.name)}</div>
          </div>
        )}
        {url && (
          <div className="rounded border border-theme/60 bg-background px-3 py-2">
            <div className="text-theme-secondary">Profile (Canonical URL)</div>
            <div className="text-theme-primary font-mono break-all">{String(url)}</div>
          </div>
        )}
        {baseDefinition && (
          <div className="rounded border border-theme/60 bg-background px-3 py-2">
            <div className="text-theme-secondary">Based On (baseDefinition)</div>
            <div className="text-theme-primary font-mono break-all">{String(baseDefinition)}</div>
            {parentProfile && (
              <div className="text-theme-secondary mt-1">({parentProfile})</div>
            )}
          </div>
        )}
        {data.publisher && (
          <div className="rounded border border-theme/60 bg-background px-3 py-2">
            <div className="text-theme-secondary">Publisher</div>
            <div className="text-theme-primary">{String(data.publisher)}</div>
          </div>
        )}
        {data.fhirVersion && (
          <div className="rounded border border-theme/60 bg-background px-3 py-2">
            <div className="text-theme-secondary">FHIR Version</div>
            <div className="text-theme-primary font-mono">{String(data.fhirVersion)}</div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Generic TreeView for Context Objects - Simplified tree view
 */
const GenericTreeNode = ({ name, value, level = 0, defaultExpanded = true }) => {
  const [isExpanded, setIsExpanded] = useState(level < 2 ? defaultExpanded : false);

  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);
  const hasChildren = isObject && Object.keys(value).length > 0;

  const getTypeLabel = () => {
    if (isArray) return `Array[${value.length}]`;
    if (isObject) return 'Object';
    if (typeof value === 'string') return 'String';
    if (typeof value === 'number') return 'Number';
    if (typeof value === 'boolean') return 'Boolean';
    if (value === null) return 'null';
    return typeof value;
  };

  const getTypeColor = () => {
    if (isArray) return 'text-blue-400';
    if (isObject) return 'text-purple-400';
    if (typeof value === 'string') return 'text-green-400';
    if (typeof value === 'number') return 'text-orange-400';
    if (typeof value === 'boolean') return 'text-pink-400';
    return 'text-theme-secondary';
  };

  return (
    <div>
      <div
        className="flex items-center py-1 px-2 hover:bg-surface-hover rounded cursor-pointer group"
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
      >
        {/* Expand/Collapse */}
        {hasChildren ? (
          <span className="w-4 h-4 flex items-center justify-center text-theme-secondary mr-1">
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span className="w-4 mr-1" />
        )}

        {/* Key name */}
        <span className="text-sm font-medium text-theme-primary mr-2">{name}</span>

        {/* Type badge */}
        <span className={cn('text-xs px-1.5 py-0.5 rounded bg-surface', getTypeColor())}>
          {getTypeLabel()}
        </span>

        {/* Value preview for primitives */}
        {!isObject && (
          <span className="ml-2 text-sm text-theme-secondary truncate max-w-xs">
            {typeof value === 'string' ? `"${value.substring(0, 50)}${value.length > 50 ? '...' : ''}"` : String(value)}
          </span>
        )}
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {Object.entries(value).map(([key, val], idx) => (
            <GenericTreeNode
              key={`${key}-${idx}`}
              name={isArray ? `[${key}]` : key}
              value={val}
              level={level + 1}
              defaultExpanded={level < 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * GenericTreeView - Tree view for Context Objects
 */
const GenericTreeView = ({ data, title, maxHeight = '400px' }) => {
  if (!data) {
    return (
      <div className="flex items-center justify-center py-8 text-theme-secondary">
        No data to display
      </div>
    );
  }

  return (
    <div className="bg-background rounded-lg border border-theme overflow-hidden">
      <div className="p-2 border-b border-theme bg-surface">
        <h4 className="text-sm font-medium text-theme-primary">{title || 'Data Structure'}</h4>
      </div>
      <div style={{ maxHeight, overflowY: 'auto' }} className="p-2">
        <GenericTreeNode name="root" value={data} level={0} defaultExpanded={true} />
      </div>
    </div>
  );
};

/**
 * DataModelDetailView - Tabbed detail view for FHIR and Context Objects
 * @param {Object} dataModel - The data model to display
 * @param {boolean} fullscreen - Whether displayed in fullscreen modal (uses flex height)
 */
const DataModelDetailView = ({ dataModel, fullscreen = false }) => {
  const [activeTab, setActiveTab] = useState('structure');

  const domain = dataModel.domain;
  const data = dataModel.data || dataModel.webTemplate;
  const isFHIR = domain === 'fhir';
  const isContext = domain === 'context' || domain === 'contextobject';

  // Get display title based on domain
  const getTitle = () => {
    if (isFHIR) {
      return `${dataModel.resourceType || 'FHIR Resource'}: ${dataModel.name}`;
    }
    if (isContext) {
      return `ContextObject: ${dataModel.name}`;
    }
    return dataModel.name;
  };

  if (!data) {
    return (
      <div className="p-4 text-center text-theme-secondary">
        No data available for this model
      </div>
    );
  }

  // Dynamic height for mindmap - uses flex in fullscreen, fixed height otherwise
  const mindmapHeight = fullscreen ? '100%' : '500px';
  const treeMaxHeight = fullscreen ? 'calc(100vh - 280px)' : '400px';
  const jsonHeight = fullscreen ? 'calc(100vh - 280px)' : 400;

  return (
    <div className={cn('flex flex-col', fullscreen && 'h-full')}>
      <h3 className="text-lg font-medium text-theme-primary mb-3 flex items-center gap-2 flex-shrink-0">
        {getTitle()}
        {isFHIR && dataModel.resourceType && (
          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30">
            {dataModel.resourceType}
          </span>
        )}
      </h3>

      <Tabs
        defaultValue="structure"
        value={activeTab}
        onValueChange={setActiveTab}
        className={cn('flex flex-col', fullscreen && 'flex-1 min-h-0')}
      >
        <TabsList className="mb-4 flex-shrink-0">
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="mindmap">Mind Map</TabsTrigger>
          <TabsTrigger value="tree">Tree View</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
          {isFHIR && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
        </TabsList>

        {/* Structure Tab - Shows main sections/fields like OpenEHR */}
        <TabsContent value="structure" className={cn('mt-0', fullscreen && 'flex-1 overflow-auto')}>
          <div className={cn('bg-background rounded-lg p-4 border border-theme', fullscreen && 'h-full overflow-auto')}>
            {activeTab === 'structure' && (
              isFHIR ? (
                data?.resourceType === 'StructureDefinition' ? (
                  <div className="space-y-4">
                    <FHIRStructureDefinitionSummary data={data} />
                    <FHIRStructureDisplay data={data} />
                  </div>
                ) : (
                  <GenericTreeView data={data} title={dataModel.name} maxHeight={treeMaxHeight} />
                )
              ) : (
                <GenericTreeView data={data} title={dataModel.name} maxHeight={treeMaxHeight} />
              )
            )}
          </div>
        </TabsContent>

        {/* Mind Map Tab */}
        <TabsContent value="mindmap" className={cn('mt-0', fullscreen && 'flex-1 min-h-0')}>
          <div
            className={cn('bg-background rounded-lg border border-theme', fullscreen && 'h-full')}
            style={{ height: fullscreen ? '100%' : '500px' }}
          >
            {activeTab === 'mindmap' && (
              <MindMap
                data={data}
                title={dataModel.name || 'Data Structure'}
                onNodeSelect={(node) => {
                  console.log('Selected node:', node);
                }}
              />
            )}
          </div>
        </TabsContent>

        {/* Tree View Tab - Table-based layout for FHIR */}
        <TabsContent value="tree" className={cn('mt-0', fullscreen && 'flex-1 overflow-auto')}>
          {activeTab === 'tree' && (
            isFHIR ? (
              <FHIRTreeView data={data} title={dataModel.name} maxHeight={treeMaxHeight} />
            ) : (
              <GenericTreeView data={data} title={dataModel.name} maxHeight={treeMaxHeight} />
            )
          )}
        </TabsContent>

        {/* JSON Tab */}
        <TabsContent value="json" className={cn('mt-0', fullscreen && 'flex-1 overflow-auto')}>
          {activeTab === 'json' && (
            <CodeViewer
              value={JSON.stringify(data, null, 2)}
              language="json"
              readOnly
              height={jsonHeight}
              fileName={`${dataModel.name || 'data-model'}.json`}
              allowFormat={false}
            />
          )}
        </TabsContent>

        {/* Analytics Tab (FHIR) */}
        {isFHIR && (
          <TabsContent value="analytics" className={cn('mt-0', fullscreen && 'flex-1 overflow-auto')}>
            {activeTab === 'analytics' && (
              <div className={cn('bg-background rounded-lg p-4 border border-theme', fullscreen && 'h-full overflow-auto')}>
                <FHIRAnalyticsTab dataModel={dataModel} data={data} fullscreen={fullscreen} />
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

/**
 * FullscreenDataModelModal - Fullscreen modal for viewing data model details
 */
const FullscreenDataModelModal = ({ dataModel, onClose }) => {
  React.useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const domain = dataModel.domain;
  const domainConfig = DOMAIN_CONFIG[domain] || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-[95vw] h-[95vh] bg-surface border border-theme rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-theme bg-background flex-shrink-0">
          <div className="flex items-center gap-3">
            <DomainIcon domain={domain} size={28} />
            <span
              className="inline-block px-2.5 py-1 text-xs font-medium rounded-md"
              style={{
                backgroundColor: `${domainConfig.color}20`,
                color: domainConfig.color,
                border: `1px solid ${domainConfig.color}40`
              }}
            >
              {domainConfig.name}
            </span>
            <h2 className="text-xl font-bold text-theme-primary">
              {dataModel.name || 'Untitled'}
            </h2>
            {dataModel.version && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                v{dataModel.version}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-theme-secondary hover:text-theme-primary hover:bg-surface rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body - Uses flex to fill remaining space */}
        <div className="flex-1 min-h-0 p-4 flex flex-col">
          <DataModelDetailView dataModel={dataModel} fullscreen={true} />
        </div>
      </div>
    </div>
  );
};

/**
 * DataModelCard - Unified card component for all data model types
 */
const DataModelCard = ({
  dataModel,
  onDelete,
  onExpand,
  onView,
  expanded = false,
  children,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showFullscreenModal, setShowFullscreenModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(expanded);
  const cachedInitialModel = useMemo(
    () => getCachedDataModel(dataModel?._id),
    [dataModel?._id]
  );
  const [fullDataModel, setFullDataModel] = useState(() => {
    return setCachedDataModel(cachedInitialModel ? { ...dataModel, ...cachedInitialModel } : dataModel);
  });
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataFetched, setDataFetched] = useState(
    !!(cachedInitialModel?.webTemplate?.children?.length || cachedInitialModel?.data != null)
  );

  // Reset when dataModel changes
  React.useEffect(() => {
    const cached = getCachedDataModel(dataModel?._id);
    const merged = setCachedDataModel(cached ? { ...dataModel, ...cached } : dataModel);
    setFullDataModel(merged);
    setDataFetched(!!(merged?.webTemplate?.children?.length || merged?.data != null));
  }, [dataModel]);

  // Fetch full data when expanded
  const fetchFullData = async () => {
    if (dataFetched || isLoadingData || !dataModel._id) return;

    setIsLoadingData(true);
    try {
      const domain = dataModel.domain;
      // For FHIR/Context, use include=data; for OpenEHR, use include=tree
      const include = [domain === 'openehr' ? 'tree' : 'data'];
      const fullDoc = await fetchDataModelDetail(dataModel._id, { include, seedModel: fullDataModel });
      setFullDataModel(fullDoc);
      setDataFetched(true);
    } catch (e) {
      console.error('Failed to fetch full data model:', e);
    } finally {
      setIsLoadingData(false);
    }
  };

  // Use internal expanded state if onExpand is not provided
  const handleToggleExpand = async () => {
    const willExpand = onExpand ? !expanded : !isExpanded;

    if (willExpand && !dataFetched) {
      await fetchFullData();
    }

    if (onExpand) {
      onExpand(willExpand);
    } else {
      setIsExpanded(willExpand);
    }
  };

  const actualExpanded = onExpand ? expanded : isExpanded;
  const domain = dataModel.domain;
  const domainConfig = DOMAIN_CONFIG[domain] || {};

  // Get domain-specific metadata - handle both old and new data structures
  const domainMetadata = dataModel.metadata?.domainMetadata || {};
  const metadata = dataModel.metadata || {};

  // Get badges based on domain
  const getBadges = () => {
    const badges = [];

    // Model type
    if (dataModel.modelType) {
      badges.push({
        label: dataModel.modelType.replace(/_/g, ' '),
        color: 'blue',
      });
    }

    // Status
    if (dataModel.status && dataModel.status !== 'active') {
      badges.push({
        label: dataModel.status,
        color: dataModel.status === 'draft' ? 'yellow' : 'gray',
      });
    }

    // Domain-specific badges
    if (domain === 'openehr') {
      // Handle both metadata locations
      const compositionKind = domainMetadata.compositionKind || metadata.compositionKind;
      const languages = domainMetadata.languages || metadata.languages;
      const datatypes = domainMetadata.datatypes || metadata.datatypes;

      if (compositionKind) {
        badges.push({ label: compositionKind, color: 'purple' });
      }
      if (languages?.length) {
        badges.push({ label: languages[0], color: 'green' });
      }
      if (datatypes?.length) {
        badges.push({ label: `${datatypes.length} types`, color: 'gray' });
      }
    } else if (domain === 'fhir') {
      // Handle resourceType from multiple locations
      const resourceType = domainMetadata.resourceType || dataModel.resourceType || dataModel.data?.resourceType;
      const category = domainMetadata.category;

      if (resourceType) {
        badges.push({ label: resourceType, color: 'red' });
      }
      if (category && category !== 'other') {
        badges.push({ label: category, color: 'blue' });
      }
    } else if (domain === 'context' || domain === 'contextobject') {
      const origin = domainMetadata.origin;
      // Count nodes in schema if available
      const nodeCount = domainMetadata.nodeCount || (dataModel.data ? Object.keys(dataModel.data).length : 0);

      if (origin && origin !== 'custom') {
        badges.push({ label: origin, color: 'teal' });
      }
      if (nodeCount) {
        badges.push({ label: `${nodeCount} fields`, color: 'indigo' });
      }
    }

    return badges;
  };

  const badges = getBadges();

  const handleDelete = () => {
    setShowConfirmDelete(true);
  };

  const confirmDelete = () => {
    invalidateDataModelCache(dataModel._id);
    onDelete?.(dataModel._id);
    setShowConfirmDelete(false);
  };

  const formatDate = (date) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="surface border border-theme rounded-lg p-4 hover:border-primary/30 transition-colors">
      {/* Header */}
      <div className="flex justify-between items-start">
        {/* Domain icon */}
        <div className="flex-shrink-0 mr-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${domainConfig.color}15 0%, ${domainConfig.color}08 100%)`,
              border: `1.5px solid ${domainConfig.color}30`
            }}
          >
            <DomainIcon domain={domain} size={30} />
          </div>
        </div>

        <div
          className="flex-1 cursor-pointer"
          onClick={handleToggleExpand}
        >
          {/* Domain chip - aligned with title */}
          <div className="mb-2">
            <span
              className="inline-block px-2.5 py-1 text-xs font-medium rounded-md"
              style={{
                backgroundColor: `${domainConfig.color}20`,
                color: domainConfig.color,
                border: `1px solid ${domainConfig.color}40`
              }}
            >
              {domainConfig.name}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Name and version */}
            <h3 className="text-xl font-bold text-theme-primary">
              {dataModel.name || 'Untitled'}
            </h3>
            {dataModel.version && (
              <span className="text-xs text-theme-secondary">
                v{dataModel.version}
              </span>
            )}
          </div>

          {/* Description */}
          {dataModel.description && (
            <p className="mt-2 text-sm text-theme-secondary line-clamp-2">
              {dataModel.description}
            </p>
          )}

          {/* Meta info row */}
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-theme-secondary">
            <div className="flex items-center gap-1">
              <Calendar size={14} />
              <span>Created: {formatDate(dataModel.audit?.createdAt)}</span>
            </div>

            {dataModel.source && (
              <div className="flex items-center gap-1">
                <Tag size={14} />
                <span>Source: {
                  typeof dataModel.source === 'string'
                    ? dataModel.source
                    : dataModel.source.fileName || dataModel.source.type || 'file'
                }</span>
              </div>
            )}

            {/* Domain-specific info */}
            {domain === 'openehr' && metadata.templateId && (
              <div className="flex items-center gap-1">
                <span className="text-theme-secondary">Template:</span>
                <span className="text-theme-primary">{metadata.templateId}</span>
              </div>
            )}

            {domain === 'fhir' && dataModel.domainData?.url && (
              <div className="flex items-center gap-1">
                <ExternalLink size={14} />
                <span className="text-theme-primary truncate max-w-xs">
                  {dataModel.domainData.url}
                </span>
              </div>
            )}
          </div>

          {/* Badges */}
          {badges.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {badges.map((badge, idx) => (
                <Badge key={idx} label={badge.label} color={badge.color} />
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 ml-4">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (onView) {
                onView(dataModel);
              } else {
                // Fetch full data before opening modal
                if (!dataFetched) {
                  await fetchFullData();
                }
                setShowFullscreenModal(true);
              }
            }}
            className="p-1 text-theme-secondary hover:text-primary transition-colors"
            title="Open fullscreen"
          >
            <Maximize2 size={20} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleExpand();
            }}
            className="p-1 text-theme-secondary hover:text-theme-primary transition-colors"
            title={actualExpanded ? 'Collapse' : 'Expand'}
          >
            {actualExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </button>
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
              className="p-1 text-theme-secondary hover:text-error transition-colors"
              title="Delete"
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded content with tabs */}
      {actualExpanded && (
        <div className="mt-4 pt-4 border-t border-theme">
          {isLoadingData ? (
            <div className="flex items-center justify-center py-8 text-theme-secondary">
              <Loader2 className="animate-spin mr-2" size={20} />
              Loading data model...
            </div>
          ) : (
            <DataModelDetailView dataModel={fullDataModel} />
          )}
          {children}
        </div>
      )}

      {/* Delete confirmation */}
      {showConfirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowConfirmDelete(false)}
        >
          <div
            className="bg-surface border border-theme rounded-lg p-6 max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-theme-primary mb-2">
              Confirm Deletion
            </h3>
            <p className="text-theme-secondary mb-4">
              Are you sure you want to delete "{dataModel.name}"? This action cannot
              be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="px-4 py-2 rounded border border-theme text-theme-primary hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded bg-error text-white hover:bg-error/80 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Modal */}
      {showFullscreenModal && (
        <FullscreenDataModelModal
          dataModel={fullDataModel}
          onClose={() => setShowFullscreenModal(false)}
        />
      )}
    </div>
  );
};

DataModelCard.propTypes = {
  dataModel: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    description: PropTypes.string,
    domain: PropTypes.string.isRequired,
    modelType: PropTypes.string,
    source: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    status: PropTypes.string,
    version: PropTypes.string,
    resourceType: PropTypes.string, // FHIR resource type
    data: PropTypes.object, // FHIR/Context JSON data
    webTemplate: PropTypes.object, // OpenEHR webTemplate
    domainData: PropTypes.object,
    metadata: PropTypes.object,
    audit: PropTypes.object,
  }).isRequired,
  onDelete: PropTypes.func,
  onExpand: PropTypes.func,
  onView: PropTypes.func,
  expanded: PropTypes.bool,
  children: PropTypes.node,
};

Badge.propTypes = {
  label: PropTypes.string.isRequired,
  color: PropTypes.string,
  className: PropTypes.string,
};

export {
  DataModelCard,
  Badge,
  DataModelDetailView,
  GenericTreeView,
  FHIRTreeView,
  FHIRStructureDisplay,
  FullscreenDataModelModal,
};
export default DataModelCard;
