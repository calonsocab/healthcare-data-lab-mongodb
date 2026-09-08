// src/components/views/queryBuilder/blocks/FromBuilder.jsx
"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { AlignLeft, ChevronRight, ChevronDown, Database, Info, X, Loader2 } from 'lucide-react';
import TreeView from '../../../common/TreeView';
import CollapsibleSection from '../../../common/CollapsibleSection';
import { useQueryBuilderContext } from '@/providers/QueryBuilderProvider';
import { isValidIdentifier, isReservedWord, LOGICAL_SIBLING_OPERATORS } from '@/lib/aqlLexicon';

export const ContainmentNode = React.memo(function ContainmentNode({
  node,
  level = 0,
  siblingIndex = 0,
  queryState,
  updateContainsAlias,
  updateLogicalOperator,
  removeContainsNode,
  suggestVariableName,
  existingVariables,
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = !!(node.children && node.children.length);
  const clickable = hasChildren;
  const showSiblingOperator = siblingIndex > 0;
  const isFirstSibling = siblingIndex === 0;

  const isValidAlias = !node.alias || (isValidIdentifier(node.alias) && !isReservedWord(node.alias));
  const isDuplicateAlias =
    !!node.alias && (queryState.contains?.filter(i => i.alias === node.alias).length > 1);

  const inputRef = useRef(null);
  const handleAliasChange = (e) => {
    updateContainsAlias(node.index, e.target.value);
  };

  const getBorderColorClass = () => {
    const t = node.node.rmType?.toUpperCase();
    if (t === 'EHR') return 'border-blue-500';
    if (t === 'COMPOSITION') return 'border-green-500';
    if (t === 'SECTION') return 'border-yellow-500';
    if (['OBSERVATION', 'EVALUATION', 'INSTRUCTION', 'ACTION', 'ADMIN_ENTRY'].includes(t)) return 'border-purple-500';
    if (t === 'CLUSTER') return 'border-red-500';
    return 'border-theme';
  };

  const getHierarchyLevelName = () => {
    const t = node.node.rmType?.toUpperCase();
    if (t === 'EHR') return 'EHR';
    if (t === 'COMPOSITION') return 'Composition';
    if (t === 'SECTION') return 'Section';
    if (['OBSERVATION', 'EVALUATION', 'INSTRUCTION', 'ACTION', 'ADMIN_ENTRY'].includes(t)) return 'Entry';
    if (t === 'CLUSTER') return 'Cluster';
    if (t === 'ELEMENT') return 'Element';
    return t;
  };

  const handleOperatorChange = (e) => {
    updateLogicalOperator && updateLogicalOperator(node.index, e.target.value);
  };

  if (node.isEhrRoot) {
    return (
      <div className="mb-2">
        <div
          className={[
            "flex items-center gap-2 bg-primary/20 p-3 rounded-lg border-l-2 border-primary",
            clickable ? "hover:bg-primary/30 cursor-pointer" : ""
          ].join(" ")}
          onClick={clickable ? () => setExpanded(v => !v) : undefined}
          aria-expanded={clickable ? expanded : undefined}
        >
          {clickable && (
            <div className="text-theme-primary p-1 rounded">
              {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-center">
              <span className="text-xs bg-primary/50 text-primary px-2 py-1 rounded mr-2">EHR</span>
              <span className="text-sm text-primary">{node.alias || 'e'}</span>
              {node.ehrIdValue && (
                <span className="ml-2 text-xs text-theme-secondary">[ehr_id/value={node.ehrIdValue}]</span>
              )}
            </div>
          </div>
        </div>

        {expanded && hasChildren && (
          <div className="ml-6 mt-2 space-y-2">
            {node.children.map((child, idx) => (
              <ContainmentNode
                key={child.id}
                node={child}
                level={1}
                siblingIndex={idx}
                queryState={queryState}
                updateContainsAlias={updateContainsAlias}
                updateLogicalOperator={updateLogicalOperator}
                removeContainsNode={removeContainsNode}
                suggestVariableName={suggestVariableName}
                existingVariables={existingVariables}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`mb-2 ${level > 0 ? 'ml-6' : ''}`}>
      {showSiblingOperator && (
        <div className="flex items-center justify-center py-1 -mb-2">
          <select
            value={node.logicalOperator || 'AND'}
            onChange={handleOperatorChange}
            className="bg-surface-hover text-xs text-theme-primary rounded-md border border-theme focus:border-primary px-2 py-1"
          >
            {LOGICAL_SIBLING_OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
        </div>
      )}

      <div
        className={[
          "flex items-center gap-2 bg-surface-hover p-3 rounded-lg",
          level > 0 ? `border-l-2 ${getBorderColorClass()}` : "",
          clickable ? "hover:bg-surface cursor-pointer" : ""
        ].join(" ")}
        onClick={clickable ? () => setExpanded(!expanded) : undefined}
        aria-expanded={clickable ? expanded : undefined}
      >
        {hasChildren && (
          <div className="text-theme-primary p-1 rounded">
            {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        )}

        {level > 0 && isFirstSibling && (
          <div className="text-xs text-theme-secondary px-2 py-1 bg-surface rounded-md">CONTAINS</div>
        )}

        <div className="flex-1 text-theme-primary">
          <div className="flex flex-col">
            <div className="flex items-center">
              <span className="text-xs bg-surface text-theme-primary px-1 rounded mr-1">
                {getHierarchyLevelName()}
              </span>
              <span className="text-sm">{node.node.name || node.template}</span>
            </div>
            <div className="text-xs text-theme-secondary mt-1 truncate" title={node.node.nodeId || ''}>
              {node.node.nodeId || '(No ID)'}
            </div>
          </div>
        </div>

        {/* Stop both click and mousedown to fully protect focus */}
        <div className="relative" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            type="text"
            placeholder="(Optional alias)"
            value={node.alias || ''}
            onChange={handleAliasChange}
            className={[
              "w-32 px-3 py-1 rounded-md border focus:outline-none bg-surface text-theme-primary",
              !node.alias ? "border-theme focus:border-primary"
                : !isValidAlias ? "bg-red-900/50 text-red-300 border-red-700 focus:border-red-500"
                  : isDuplicateAlias ? "bg-yellow-900/50 text-yellow-300 border-yellow-700 focus:border-yellow-500"
                    : "border-theme focus:border-primary"
            ].join(" ")}
            title={
              !node.alias
                ? "Optional: Enter a variable name if needed for referencing"
                : !isValidAlias
                  ? "Variable must start with a letter and contain only letters, numbers, and underscores"
                  : isDuplicateAlias
                    ? "Variable name must be unique"
                    : "Variable is valid"
            }
          />
          {!isValidAlias && node.alias && (
            <div className="absolute text-xs text-red-300 mt-1">Invalid variable</div>
          )}
          {isDuplicateAlias && isValidAlias && (
            <div className="absolute text-xs text-yellow-300 mt-1">Duplicate variable</div>
          )}
        </div>

        <div className="flex gap-1" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={() => removeContainsNode(node.index)}
            className="p-1 text-theme-secondary hover:text-error hover:bg-surface rounded"
            title="Remove node"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {!node.alias && (
        <div className="ml-7 mt-1">
          <button
            className="text-xs text-primary hover:text-primary"
            onClick={(e) => {
              e.stopPropagation();
              const suggestion = suggestVariableName(node.node.rmType, existingVariables);
              updateContainsAlias(node.index, suggestion);
            }}
          >
            Suggest variable name
          </button>
        </div>
      )}

      {expanded && hasChildren && (
        <div className="mt-2">
          {node.children.map((child, idx) => (
            <ContainmentNode
              key={child.id}
              node={child}
              level={level + 1}
              siblingIndex={idx}
              queryState={queryState}
              updateContainsAlias={updateContainsAlias}
              updateLogicalOperator={updateLogicalOperator}
              removeContainsNode={removeContainsNode}
              suggestVariableName={suggestVariableName}
              existingVariables={existingVariables}
            />
          ))}
        </div>
      )}
    </div>
  );
});


const FromBuilder = ({ isExpanded, onToggleExpand }) => {
  const {
    activeTemplates,
    queryState,
    cachedTemplates,
    ensureTemplateTree,
    addContainsNode,
    removeContainsNode,
    updateContainsAlias,
    updateLogicalOperator,
    addEhrRoot,
    updateEhrId,
    fromNotice,
    clearFromNotice,
    canInsert,
  } = useQueryBuilderContext();

  const [searchTerm, setSearchTerm] = useState("");
  const [ehrFilterType, setEhrFilterType] = useState("specific");
  const [ehrIdValue, setEhrIdValue] = useState("$ehrUid");
  const [showContainmentRules, setShowContainmentRules] = useState(false);
  const [sectionExpanded, setSectionExpanded] = useState(true);

  const getTreeRoot = useCallback((doc) => {
    if (!doc?.webTemplate) return null;
    return Array.isArray(doc.webTemplate.children) ? doc.webTemplate : null;
  }, []);

  // Track calls in-flight AND templates we've already attempted this session
  const hydratingIdsRef = React.useRef(new Set());
  const attemptedIdsRef = React.useRef(new Set());

  // Build quick indexes to resolve active template keys (name or id) to docs
  const indexes = useMemo(() => {
    const byId = new Map();
    const byName = new Map();
    Object.values(cachedTemplates || {}).forEach(doc => {
      if (doc?._id) byId.set(doc._id, doc);
      const name = doc?.name || doc?.metadata?.templateId || doc?.webTemplate?.name;
      if (name) byName.set(name, doc);
    });
    return { byId, byName };
  }, [cachedTemplates]);

  const resolveDoc = useCallback(
    (key) => indexes.byId.get(key) || indexes.byName.get(key) || null,
    [indexes]
  );

  const getTemplateDisplayName = useCallback((doc, fallback) =>
    doc?.name || doc?.metadata?.templateId || doc?.webTemplate?.name || fallback || 'Unnamed Template',
    []
  );

  // Normalize nodes for TreeView (ensure `text` and `children` exist)
  const normalizeForTreeView = useCallback((node) => {
    if (!node) return null;
    const text = node.text || node.localizedName || node.name || node.nodeId || 'Unnamed';
    const children = Array.isArray(node.children)
      ? node.children.map(normalizeForTreeView)
      : [];
    return { ...node, text, children };
  }, []);

  useEffect(() => {
    if (!fromNotice) return;
    const id = setTimeout(() => clearFromNotice(), 4000);
    return () => clearTimeout(id);
  }, [fromNotice?.ts, clearFromNotice]);

  // Sync expand + EHR root state
  useEffect(() => {
    setSectionExpanded(isExpanded);
    const hasEhrRoot = queryState.contains?.some(item => item.isEhrRoot);
    if (!hasEhrRoot) addEhrRoot(ehrFilterType, ehrIdValue);

    const ehrNode = queryState.contains?.find(item => item.isEhrRoot);
    if (ehrNode) {
      const isPopulation = !ehrNode.ehrIdValue || ehrNode.ehrIdValue.trim() === "";
      setEhrFilterType(isPopulation ? "population" : "specific");
      if (!isPopulation) setEhrIdValue(ehrNode.ehrIdValue || "$ehrUid");
    }
  }, [isExpanded, queryState.contains, addEhrRoot, ehrFilterType, ehrIdValue]);

  // Filter logic
  const filterTree = useCallback((node, term) => {
    if (!node) return null;
    if (!term) return node;

    const search = term.toLowerCase();
    const nodeName = node.name?.toLowerCase() || "";
    const localizedName = node.localizedName?.toLowerCase() || "";
    const localizedEN = node.localizedNames?.en?.toLowerCase() || "";
    const nodeId = node.nodeId?.toLowerCase() || "";
    const rmType = node.rmType?.toLowerCase() || "";

    const isMatch =
      nodeName.includes(search) ||
      localizedName.includes(search) ||
      localizedEN.includes(search) ||
      nodeId.includes(search) ||
      rmType.includes(search);

    const children = node.children || [];
    const filteredChildren = children
      .map((child) => filterTree(child, term))
      .filter(Boolean);

    if (isMatch || filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }
    return null;
  }, []);

  const filteredTrees = useMemo(() => {
    const result = {};
    if (!activeTemplates?.length) return result;

    activeTemplates.forEach((key) => {
      const doc = resolveDoc(key);
      const root = getTreeRoot(doc);
      if (!root) return;

      const filtered = filterTree(root, searchTerm);
      if (filtered) result[key] = normalizeForTreeView(filtered);
    });

    return result;
  }, [activeTemplates, resolveDoc, searchTerm, filterTree, normalizeForTreeView, getTreeRoot]);

  // Lazily hydrate missing trees (use _id if we have it)
  useEffect(() => {
    if (!activeTemplates?.length) return;

    for (const key of activeTemplates) {
      const doc = resolveDoc(key);
      if (!doc?._id) continue;

      const root = getTreeRoot(doc);
      const hydrated = !!(root && root.children && root.children.length);
      if (hydrated) continue;

      if (attemptedIdsRef.current.has(doc._id)) continue; // don't hammer if we already tried
      if (hydratingIdsRef.current.has(doc._id)) continue; // in-flight guard

      hydratingIdsRef.current.add(doc._id);
      attemptedIdsRef.current.add(doc._id);

      Promise.resolve(ensureTemplateTree(doc._id))
        .catch((e) => console.warn('ensureTemplateTree failed for', doc._id, e))
        .finally(() => hydratingIdsRef.current.delete(doc._id));
    }
  }, [activeTemplates, resolveDoc, ensureTemplateTree, getTreeRoot]);

  // Alias suggestion
  const suggestVariableName = useCallback((rmType, existingVars) => {
    const abbrMap = { EHR: 'e', COMPOSITION: 'c', SECTION: 's', OBSERVATION: 'o', EVALUATION: 'ev', INSTRUCTION: 'i', ACTION: 'a', ADMIN_ENTRY: 'ad', CLUSTER: 'clu' };
    const base = abbrMap[rmType] || (rmType || '').substring(0, 3).toLowerCase();
    if (!existingVars.includes(base)) return base;
    let i = 1;
    while (existingVars.includes(`${base}${i}`)) i += 1;
    return `${base}${i}`;
  }, []);

  const existingVariables = useMemo(() => {
    if (!queryState.contains) return [];
    return queryState.contains.map(i => i.alias).filter(Boolean);
  }, [queryState.contains]);

  // Build containment hierarchy (unchanged)
  const containmentHierarchy = useMemo(() => {
    if (!queryState.contains || queryState.contains.length === 0) return [];
    const processed = new Set();

    const buildTree = (item, index) => {
      processed.add(index);
      const children = queryState.contains.filter(
        c => c.parentIndex === index && !processed.has(queryState.contains.indexOf(c))
      );
      const childNodes = children.map(child => {
        const childIndex = queryState.contains.indexOf(child);
        return buildTree(child, childIndex);
      });
      return { ...item, index, id: item.id ?? index, children: childNodes };
    };

    const ehrRoot = queryState.contains.find(i => i.isEhrRoot);
    if (ehrRoot) {
      const ehrIndex = queryState.contains.indexOf(ehrRoot);
      return [buildTree(ehrRoot, ehrIndex)];
    }

    const roots = queryState.contains.filter(
      i => (i.isRoot || i.parentIndex == null) && !i.isEhrRoot
    );
    return roots.map(r => buildTree(r, queryState.contains.indexOf(r)));
  }, [queryState.contains]);

  const handleToggleExpand = useCallback(() => {
    setSectionExpanded(prev => !prev);
    onToggleExpand && onToggleExpand();
  }, [onToggleExpand]);

  const handleAddNode = useCallback((templateKey, node) => {
    // Parent is resolved canonically inside the hook
    addContainsNode(templateKey, node, null, 'simple');
  }, [addContainsNode]);

  return (
    <CollapsibleSection
      title="FROM / CONTAINS Builder"
      isExpanded={sectionExpanded}
      onToggle={handleToggleExpand}
    >
      {sectionExpanded && (
        <div className="space-y-6">
          {/* EHR Configuration */}
          <div className="bg-surface p-4 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Database size={16} className="text-primary" />
                <span className="text-sm font-medium text-theme-primary">EHR Configuration</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-theme-secondary w-32">Query Type:</span>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="ehrType"
                      checked={ehrFilterType === "specific"}
                      onChange={() => {
                        setEhrFilterType("specific");
                        addEhrRoot("specific", ehrIdValue);
                      }}
                      className="accent-primary"
                    />
                    <span className="text-theme-primary">Specific EHR</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="ehrType"
                      checked={ehrFilterType === "population"}
                      onChange={() => {
                        setEhrFilterType("population");
                        addEhrRoot("population", "");
                      }}
                      className="accent-primary"
                    />
                    <span className="text-theme-primary">Population Query</span>
                  </label>
                </div>
              </div>

              {ehrFilterType === "specific" && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-theme-secondary w-32">EHR ID:</span>
                  <input
                    type="text"
                    value={ehrIdValue}
                    onChange={(e) => {
                      setEhrIdValue(e.target.value);
                      updateEhrId(e.target.value);
                    }}
                    placeholder="Enter EHR ID or parameter (e.g. $ehrUid)"
                    className="w-full px-3 py-1 rounded-md bg-surface-hover text-theme-primary border border-theme focus:border-primary focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Hierarchy Rules */}
          <div className="bg-surface p-4 rounded-lg">
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <AlignLeft size={16} className="text-primary" />
                  <span className="text-sm font-medium text-theme-primary">Hierarchy Explorer</span>
                </div>
                <button
                  onClick={() => setShowContainmentRules(!showContainmentRules)}
                  className="text-xs px-2 py-1 rounded bg-primary/30 text-primary hover:bg-primary/50 flex items-center gap-1"
                >
                  <Info size={12} />
                  {showContainmentRules ? "Hide Hierarchy Rules" : "Show Hierarchy Rules"}
                </button>
              </div>

              {showContainmentRules && (
                <div className="bg-surface-hover/50 p-3 rounded-md text-xs text-theme-primary mt-1">
                  <h5 className="font-medium mb-1">OpenEHR Hierarchy:</h5>
                  <div className="space-y-1 text-theme-secondary">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500 rounded-full"></div><span>EHR</span></div>
                    <div className="flex items-center gap-2 ml-3"><div className="w-3 h-3 bg-green-500 rounded-full"></div><span>COMPOSITION</span></div>
                    <div className="flex items-center gap-2 ml-6"><div className="w-3 h-3 bg-yellow-500 rounded-full"></div><span>SECTION (optional)</span></div>
                    <div className="flex items-center gap-2 ml-9"><div className="w-3 h-3 bg-purple-500 rounded-full"></div><span>ENTRY (OBS, EVAL, INSTR, ACTION, ADMIN_ENTRY)</span></div>
                    <div className="flex items-center gap-2 ml-12"><div className="w-3 h-3 bg-red-500 rounded-full"></div><span>CLUSTER / ELEMENT</span></div>
                  </div>
                  <div className="mt-2 text-theme-secondary">
                    <span className="text-primary">Note:</span> Different levels → CONTAINS. Same level → AND/OR.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search archetypes by name, id, or type..."
              className="w-full px-3 py-2 rounded-md bg-surface text-theme-primary border border-theme focus:border-primary focus:outline-none pl-10"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="w-4 h-4 text-theme-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Quick filters */}
          <div className="flex flex-wrap gap-2">
            {['COMPOSITION', 'OBSERVATION', 'EVALUATION', 'INSTRUCTION', 'ACTION', 'ADMIN_ENTRY', 'CLUSTER'].map(type => (
              <button
                key={type}
                onClick={() => setSearchTerm(type)}
                className="px-2 py-1 bg-surface-hover text-xs text-theme-primary rounded-md hover:bg-surface"
              >
                {type}
              </button>
            ))}
          </div>

          {/* Template Trees */}
          {!activeTemplates || activeTemplates.length === 0 ? (
            <div className="text-theme-secondary p-4 bg-surface rounded-lg">
              No active templates. Please select templates from the Templates tab.
            </div>
          ) : (
            <div className="space-y-4">
              {activeTemplates.map((key) => {
                const doc = resolveDoc(key);
                if (!doc) return null;

                const filteredRoot = filteredTrees[key];
                const treeRoot = filteredTrees[key] || (getTreeRoot(doc) ? normalizeForTreeView(getTreeRoot(doc)) : null);
                const title = getTemplateDisplayName(doc, key);

                return (
                  <div key={key} className="bg-background rounded-lg p-4">
                    <h3 className="text-lg font-medium text-theme-primary mb-4 sticky top-0 bg-background py-2 z-10">
                      {title}
                    </h3>

                    <div className="max-h-80 overflow-y-auto pr-2">
                      {!treeRoot ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="animate-spin text-theme-primary" size={32} />
                          <span className="ml-2 text-theme-primary">Loading template structure…</span>
                        </div>
                      ) : (
                        <TreeView
                          node={treeRoot}
                          onSelect={(node) => handleAddNode(key, node)}
                          isSelectable={(node) => canInsert(node?.rmType, key)}
                          purpose="CONTAINS"
                          defaultExpanded={!!searchTerm}
                          disabledTooltip="Add a COMPOSITION first or select a node with a valid parent."
                        />
                      )}
                    </div>
                    {fromNotice && (
                      <div className={`mt-3 p-3 rounded-md border text-sm ${fromNotice.kind === 'error'
                        ? 'bg-red-900/30 border-red-700 text-red-200'
                        : 'bg-yellow-900/30 border-yellow-700 text-yellow-200'
                        }`}>
                        <div className="flex items-start justify-between gap-2">
                          <span className="whitespace-pre-wrap">{fromNotice.text}</span>
                          <button
                            onClick={clearFromNotice}
                            className="text-theme-primary hover:text-white"
                            aria-label="Dismiss"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Containment Hierarchy */}
          <div className="mt-6">
            <h3 className="text-md font-medium text-theme-primary mb-4 flex items-center gap-2">
              <div className="flex items-center gap-2">
                <AlignLeft size={16} className="text-green-400" />
                <span>Containment Hierarchy</span>
              </div>
              <span className="text-xs text-theme-secondary font-normal">
                (Variables are only required if referenced elsewhere)
              </span>
            </h3>

            {!containmentHierarchy || containmentHierarchy.length === 0 ? (
              <div className="text-sm text-theme-secondary p-3 bg-surface rounded-lg">
                <div className="mb-2">Start by adding archetype nodes from the template tree above:</div>
                <ol className="list-decimal ml-5 space-y-1">
                  <li>Add a Composition first from the template tree</li>
                  <li>Click any node in the template tree to add it to the hierarchy</li>
                  <li>The system automatically organizes the nodes in proper hierarchy</li>
                  <li>Use the AND/OR drop-downs to control logical relationships at the same level</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3">
                {containmentHierarchy.map((rootNode, index) => (
                  <ContainmentNode
                    key={rootNode.id}
                    node={rootNode}
                    siblingIndex={index}
                    queryState={queryState}
                    updateContainsAlias={updateContainsAlias}
                    updateLogicalOperator={updateLogicalOperator}
                    removeContainsNode={removeContainsNode}
                    suggestVariableName={suggestVariableName}
                    existingVariables={existingVariables}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
};

FromBuilder.propTypes = {
  isExpanded: PropTypes.bool.isRequired,
  onToggleExpand: PropTypes.func.isRequired
};

export default FromBuilder;