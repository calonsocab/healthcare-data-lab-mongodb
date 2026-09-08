// src/components/views/queryBuilder/blocks/WhereByBuilder.jsx
"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { X, Filter, DivideCircle, Braces, GitMerge, GitBranch } from 'lucide-react';
import PropTypes from 'prop-types';
import TreeView from '../../../common/TreeView';
import CollapsibleSection from '../../../common/CollapsibleSection';
import { useQueryBuilderContext } from '@/providers/QueryBuilderProvider';
import { AQL_FILTERABLE_TYPES, getWhereOperatorsForRmType } from '@/lib/aqlLexicon';

const WhereBuilder = ({
  conditions,
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition,
  onAddGroup,
  onRemoveGroup,
  onUpdateGroup,
  isExpanded,
  onToggleExpand
}) => {
  const {
    cachedTemplates,
    activeTemplates,
    ensureTreeByName,
    buildNodePath,
    queryState
  } = useQueryBuilderContext();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("paths"); // "paths", "groups", "exists", "parameters"
  const [groupLogic, setGroupLogic] = useState("AND");
  const [parameterName, setParameterName] = useState("");
  const [existsPath, setExistsPath] = useState("");
  const [notExists, setNotExists] = useState(false);

  // Lazily hydrate full trees for active templates
  useEffect(() => {
    if (!activeTemplates?.length) return;
    (async () => {
      for (const name of activeTemplates) {
        const tpl = cachedTemplates?.[name];
        const hasTree = tpl?.webTemplate?.children?.length;
        if (!hasTree) await ensureTreeByName(name);   // ← hydrate by name
      }
    })();
  }, [activeTemplates, cachedTemplates, ensureTreeByName]);


  const getTreeRoot = useCallback((doc) => {
    if (!doc?.webTemplate) return null;
    return Array.isArray(doc.webTemplate.children) ? doc.webTemplate : null;
  }, []);

  const normalizeForTreeView = useCallback((node) => {
    if (!node) return null;
    const text = node.text || node.localizedName || node.name || node.nodeId || 'Unnamed';
    const children = Array.isArray(node.children)
      ? node.children.map(normalizeForTreeView)
      : [];
    return { ...node, text, children };
  }, []);

  // A helper function to recursively filter the tree by name
  const filterTree = (node, term) => {
    if (!term) return node;

    const nodeName = node.name?.toLowerCase() || "";
    const localizedName = node.localizedName?.toLowerCase() || "";
    const nodeId = node.nodeId?.toLowerCase() || "";
    const rmType = node.rmType?.toLowerCase() || "";
    const search = term.toLowerCase();

    const isMatch =
      nodeName.includes(search) ||
      localizedName.includes(search) ||
      nodeId.includes(search) ||
      rmType.includes(search);

    if (!node.children || node.children.length === 0) {
      return isMatch ? node : null;
    }

    const filteredChildren = node.children
      .map((child) => filterTree(child, term))
      .filter(Boolean);

    if (isMatch || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren,
      };
    }

    return null;
  };

  const isFilterableNode = (node) => {
    if (!node?.rmType) return false;
    const nodeType = node.rmType.toUpperCase();
    if (AQL_FILTERABLE_TYPES.has(nodeType)) return true;
    // allow element-like nodes by heuristic
    if (node.nodeId && (/^at\d+/.test(node.nodeId) || node.nodeId.includes('openEHR'))) return true;
    return false;
  };

  // For each active template, build the filtered tree once
  const filteredTrees = useMemo(() => {
    const result = {};
    if (!activeTemplates?.length) return result;
    activeTemplates.forEach((templateName) => {
      const templateData = cachedTemplates?.[templateName];
      const root = getTreeRoot(templateData);
      if (!root) return;
      const filtered = filterTree(root, searchTerm);
      if (filtered) result[templateName] = normalizeForTreeView(filtered);
    });
    return result;
  }, [activeTemplates, cachedTemplates, searchTerm, getTreeRoot, filterTree, normalizeForTreeView]);


  const getOperatorsForType = getWhereOperatorsForRmType;

  // Group conditions by type and group
  const groupedConditions = useMemo(() => {
    // First separate into groups and single conditions
    const groups = {};
    const singles = [];

    conditions.forEach((condition, index) => {
      if (condition.groupId) {
        if (!groups[condition.groupId]) {
          groups[condition.groupId] = {
            logic: condition.groupLogic || 'AND',
            conditions: []
          };
        }
        groups[condition.groupId].conditions.push({ ...condition, index });
      } else {
        singles.push({ ...condition, index });
      }
    });

    return { groups, singles };
  }, [conditions]);

  // Handle adding a EXISTS check
  // Add EXISTS to WHERE
  const handleAddExists = () => {
    if (!existsPath) return;

    const existsCondition = {
      type: 'exists',
      path: existsPath,
      not: notExists
    };

    // Add via provided callback API (keeps module contract)
    onAddCondition(null, null, existsCondition);

    setExistsPath("");
    setNotExists(false);
  };

  // Handle adding a parameter
  const handleAddParameter = () => {
    if (!parameterName) return;

    // Ensure parameter name starts with $
    const formattedName = parameterName.startsWith('$')
      ? parameterName
      : `$${parameterName}`;

    const paramConfig = {
      type: 'parameter',
      name: formattedName
    };

    onAddCondition(null, null, paramConfig);

    // Reset
    setParameterName("");
  };

  // Suggested value placeholders based on data type
  const getValuePlaceholder = (dataType) => {
    switch (dataType) {
      case 'DV_TEXT':
      case 'DV_CODED_TEXT':
        return "Text value...";
      case 'DV_QUANTITY':
        return "Numeric value";
      case 'DV_COUNT':
        return "Count value";
      case 'DV_DATE_TIME':
        return "YYYY-MM-DD";
      case 'DV_BOOLEAN':
        return "true/false";
      case 'DV_ORDINAL':
        return "Ordinal value";
      default:
        return "Value...";
    }
  };

  // Determine if a value needs to be quoted in the query
  const needsQuotes = (dataType) => {
    return ['DV_TEXT', 'DV_CODED_TEXT', 'DV_IDENTIFIER', 'DV_DATE_TIME'].includes(dataType);
  };

  return (
    <CollapsibleSection
      title="WHERE Builder"
      isExpanded={isExpanded}
      onToggle={onToggleExpand}
    >
      <div className="space-y-6">
        {/* WHERE Builder Tabs */}
        <div className="border-b border-theme">
          <div className="flex flex-wrap space-x-1">
            <button
              className={`px-4 py-2 border-b-2 text-sm font-medium ${selectedTab === "paths"
                ? "border-primary text-primary"
                : "border-transparent text-theme-secondary hover:text-theme-primary"
                }`}
              onClick={() => setSelectedTab("paths")}
            >
              <div className="flex items-center gap-1.5">
                <Filter size={16} />
                <span>Add Condition</span>
              </div>
            </button>
            <button
              className={`px-4 py-2 border-b-2 text-sm font-medium ${selectedTab === "groups"
                ? "border-primary text-primary"
                : "border-transparent text-theme-secondary hover:text-theme-primary"
                }`}
              onClick={() => setSelectedTab("groups")}
            >
              <div className="flex items-center gap-1.5">
                <Braces size={16} />
                <span>Logic Groups</span>
              </div>
            </button>
            <button
              className={`px-4 py-2 border-b-2 text-sm font-medium ${selectedTab === "exists"
                ? "border-primary text-primary"
                : "border-transparent text-theme-secondary hover:text-theme-primary"
                }`}
              onClick={() => setSelectedTab("exists")}
            >
              <div className="flex items-center gap-1.5">
                <DivideCircle size={16} />
                <span>EXISTS</span>
              </div>
            </button>
            <button
              className={`px-4 py-2 border-b-2 text-sm font-medium ${selectedTab === "parameters"
                ? "border-primary text-primary"
                : "border-transparent text-theme-secondary hover:text-theme-primary"
                }`}
              onClick={() => setSelectedTab("parameters")}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-lg">$</span>
                <span>Parameters</span>
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-4">
          {/* Paths/Conditions Tab */}
          {selectedTab === "paths" && (
            <div className="space-y-4">
              {/* Search bar */}
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search in trees (name, ID, type)..."
                  className="w-full px-3 pl-10 py-2 rounded-md bg-surface text-theme-primary border border-theme focus:border-primary focus:outline-none"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg className="w-4 h-4 text-theme-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                  </svg>
                </div>
              </div>

              {/* Quick Data Type Filters */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSearchTerm("DV_QUANTITY")}
                  className="px-2 py-1 bg-surface-hover text-xs text-theme-primary rounded-md hover:bg-surface"
                >
                  Quantities
                </button>
                <button
                  onClick={() => setSearchTerm("DV_TEXT")}
                  className="px-2 py-1 bg-surface-hover text-xs text-theme-primary rounded-md hover:bg-surface"
                >
                  Text
                </button>
                <button
                  onClick={() => setSearchTerm("DATE")}
                  className="px-2 py-1 bg-surface-hover text-xs text-theme-primary rounded-md hover:bg-surface"
                >
                  Dates
                </button>
                <button
                  onClick={() => setSearchTerm("DV_BOOLEAN")}
                  className="px-2 py-1 bg-surface-hover text-xs text-theme-primary rounded-md hover:bg-surface"
                >
                  Booleans
                </button>
                <button
                  onClick={() => setSearchTerm("DV_CODED")}
                  className="px-2 py-1 bg-surface-hover text-xs text-theme-primary rounded-md hover:bg-surface"
                >
                  Coded
                </button>
              </div>

              {/* Template Trees */}
              <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                {activeTemplates.map((templateName) => {
                  const filteredRoot = filteredTrees[templateName];
                  if (!cachedTemplates?.[templateName]) {
                    return (
                      <div key={templateName} className="bg-surface p-2 rounded-md">
                        <p className="text-red-400">
                          Template "{templateName}" not loaded or not found.
                        </p>
                      </div>
                    );
                  }
                  if (!filteredRoot) {
                    return (
                      <div key={templateName} className="bg-surface p-2 rounded-md">
                        <h3 className="text-lg font-medium text-theme-primary mb-2">
                          {templateName}
                        </h3>
                        <p className="text-sm text-theme-secondary">
                          No matches found for "{searchTerm}".
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={templateName}
                      className="bg-background rounded-lg p-4 overflow-y-auto"
                    >
                      <h3 className="text-lg font-medium text-theme-primary mb-4 sticky top-0 bg-background py-2">
                        {templateName}
                      </h3>
                      <TreeView
                        node={filteredRoot}
                        onSelect={(node) => onAddCondition(templateName, node)}
                        isSelectable={isFilterableNode}
                        purpose="WHERE"
                        defaultExpanded={!!searchTerm}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Logic Groups Tab */}
          {selectedTab === "groups" && (
            <div className="bg-surface p-4 rounded-lg">
              <h3 className="text-theme-primary text-sm font-medium mb-4">
                Create Logical Groups of Conditions
              </h3>

              <div className="space-y-4">
                {/* Group Logic Selection */}
                <div>
                  <label className="block text-xs font-medium text-theme-secondary mb-1">
                    Group Logic
                  </label>
                  <div className="flex gap-2">
                    <button
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md ${groupLogic === 'AND'
                        ? 'bg-primary text-white'
                        : 'bg-surface-hover text-theme-primary hover:bg-surface'
                        }`}
                      onClick={() => setGroupLogic('AND')}
                    >
                      <GitMerge size={16} />
                      <span>AND</span>
                    </button>
                    <button
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md ${groupLogic === 'OR'
                        ? 'bg-primary text-white'
                        : 'bg-surface-hover text-theme-primary hover:bg-surface'
                        }`}
                      onClick={() => setGroupLogic('OR')}
                    >
                      <GitBranch size={16} />
                      <span>OR</span>
                    </button>
                  </div>
                </div>

                {/* Create Group Button */}
                <button
                  onClick={() => onAddGroup && onAddGroup(groupLogic)}
                  className="w-full py-2 bg-primary text-white rounded-md hover:opacity-90 flex items-center justify-center gap-2"
                >
                  <Braces size={16} />
                  <span>Create New {groupLogic} Group</span>
                </button>

                {/* Group explanation */}
                <div className="text-xs text-theme-secondary mt-2 bg-surface-hover/40 p-3 rounded">
                  <p>
                    <span className="font-medium">AND groups:</span> All conditions must be true (x AND y AND z)
                  </p>
                  <p className="mt-1">
                    <span className="font-medium">OR groups:</span> Any condition can be true (x OR y OR z)
                  </p>
                  <p className="mt-2 text-primary">
                    After creating a group, add conditions to it by selecting them from the tree.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* EXISTS Tab */}
          {selectedTab === "exists" && (
            <div className="bg-surface p-4 rounded-lg">
              <h3 className="text-theme-primary text-sm font-medium mb-4">
                Add EXISTS Condition
              </h3>

              <div className="space-y-4">
                {/* EXISTS Path Input */}
                <div>
                  <label className="block text-xs font-medium text-theme-secondary mb-1">
                    Path to Check for Existence
                  </label>
                  <input
                    type="text"
                    value={existsPath}
                    onChange={(e) => setExistsPath(e.target.value)}
                    placeholder="e.g. c/content[openEHR-EHR-OBSERVATION.blood_pressure.v1]"
                    className="w-full px-3 py-2 bg-surface-hover text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none"
                  />
                </div>

                {/* NOT Toggle */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="notExists"
                    checked={notExists}
                    onChange={(e) => setNotExists(e.target.checked)}
                    className="rounded border-theme text-primary focus:ring-primary h-4 w-4"
                  />
                  <label htmlFor="notExists" className="text-theme-primary text-sm">
                    Use NOT EXISTS (check for absence)
                  </label>
                </div>

                {/* Add EXISTS Button */}
                <button
                  onClick={handleAddExists}
                  disabled={!existsPath}
                  className={`w-full py-2 rounded-md ${existsPath
                    ? 'bg-primary text-white hover:opacity-90'
                    : 'bg-surface-hover text-theme-secondary cursor-not-allowed'
                    }`}
                >
                  Add {notExists ? 'NOT EXISTS' : 'EXISTS'} Condition
                </button>

                {/* EXISTS explanation */}
                <div className="text-xs text-theme-secondary mt-2">
                  <p>
                    <span className="font-medium">EXISTS</span> checks if a specified path or data element exists in the records.
                  </p>
                  <p className="mt-1">
                    <span className="font-medium">NOT EXISTS</span> checks if a specified path or data element does not exist.
                  </p>
                  <p className="mt-2 text-primary">
                    Example: <code>EXISTS c/content[openEHR-EHR-OBSERVATION.blood_pressure.v1]</code>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Parameters Tab */}
          {selectedTab === "parameters" && (
            <div className="bg-surface p-4 rounded-lg">
              <h3 className="text-theme-primary text-sm font-medium mb-4">
                Add Parameter Reference
              </h3>

              <div className="space-y-4">
                {/* Parameter Name Input */}
                <div>
                  <label className="block text-xs font-medium text-theme-secondary mb-1">
                    Parameter Name
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-theme-secondary font-mono">$</span>
                    <input
                      type="text"
                      value={parameterName.startsWith('$') ? parameterName.substring(1) : parameterName}
                      onChange={(e) => setParameterName(e.target.value)}
                      placeholder="paramName"
                      className="w-full pl-7 px-3 py-2 bg-surface-hover text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Add Parameter Button */}
                <button
                  onClick={handleAddParameter}
                  disabled={!parameterName}
                  className={`w-full py-2 rounded-md ${parameterName
                    ? 'bg-primary text-white hover:opacity-90'
                    : 'bg-surface-hover text-theme-secondary cursor-not-allowed'
                    }`}
                >
                  Add Parameter Reference
                </button>

                {/* Parameter explanation */}
                <div className="text-xs text-theme-secondary mt-2">
                  <p>
                    Parameters are placeholders that will be replaced with actual values at runtime.
                  </p>
                  <p className="mt-1">
                    Parameter names must start with a dollar sign ($) and be followed by letters, numbers, or underscores.
                  </p>
                  <p className="mt-2 text-primary">
                    Example: <code>c/name/value = $nameValue</code>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Conditions Display */}
        <div className="mt-6">
          <h3 className="text-md font-medium text-theme-primary mb-4">
            Defined Conditions
          </h3>

          {/* Conditions not in groups */}
          {groupedConditions && groupedConditions.singles && groupedConditions.singles.length > 0 && (
            <div className="mb-5">
              <h4 className="text-sm font-medium text-theme-secondary mb-2">
                Individual Conditions
              </h4>

              <div className="space-y-3">
                {groupedConditions.singles.map((condition) => (
                  <div
                    key={condition.index}
                    className="bg-surface-hover p-3 rounded-lg"
                  >
                    {condition.type === 'exists' ? (
                      // EXISTS condition
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-theme-primary">
                          <DivideCircle size={16} className="text-primary" />
                          <span className="font-mono text-sm">
                            {condition.not ? 'NOT EXISTS' : 'EXISTS'} {condition.path}
                          </span>
                        </div>
                        <button
                          onClick={() => onRemoveCondition(condition.index)}
                          className="text-theme-secondary hover:text-error transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : condition.type === 'parameter' ? (
                      // Parameter reference
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-theme-primary">
                          <span className="font-mono text-primary text-lg">$</span>
                          <span className="font-mono text-sm">
                            {condition.name}
                          </span>
                        </div>
                        <button
                          onClick={() => onRemoveCondition(condition.index)}
                          className="text-theme-secondary hover:text-error transition-colors"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : (
                      // Regular path-based condition
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 text-theme-primary truncate font-mono text-sm">
                            {condition.template ? buildNodePath(condition.template, condition.node, queryState.contains) : '(unknown path)'}
                          </div>
                          <button
                            onClick={() => onRemoveCondition(condition.index)}
                            className="text-theme-secondary hover:text-error transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={condition.operator || '='}
                            onChange={(e) => onUpdateCondition(condition.index, { operator: e.target.value })}
                            className="px-2 py-1 bg-surface text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none text-sm"
                          >
                            {condition.node && getOperatorsForType(condition.node.rmType).map(op => (
                              <option key={op} value={op}>{op}</option>
                            ))}
                          </select>
                          {condition.operator === 'MATCHES' ? (
                            <input
                              type="text"
                              placeholder="{'value1', 'value2'}"
                              value={condition.value || ''}
                              onChange={(e) => onUpdateCondition(condition.index, { value: e.target.value })}
                              className="flex-1 px-3 py-1 bg-surface text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none text-sm"
                            />
                          ) : condition.node?.rmType === 'DV_DATE_TIME' ? (
                          <input
                            type="datetime-local"
                            value={condition.value || ''}
                            onChange={(e) => {
                              const value = needsQuotes(condition.node.rmType)
                                ? `'${e.target.value}'`
                                : e.target.value;
                              onUpdateCondition(condition.index, { value });
                            }}
                            className="flex-1 px-3 py-1 bg-surface text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none text-sm"
                          />
                          ) : condition.node?.rmType === 'DV_BOOLEAN' ? (
                          <select
                            value={condition.value || ''}
                            onChange={(e) => onUpdateCondition(condition.index, { value: e.target.value })}
                            className="flex-1 px-3 py-1 bg-surface text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none text-sm"
                          >
                            <option value="">Select...</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                          ) : (
                          <input
                            type={condition.node?.rmType === 'DV_QUANTITY' || condition.node?.rmType === 'DV_COUNT' ? 'number' : 'text'}
                            placeholder={condition.node ? getValuePlaceholder(condition.node.rmType) : 'Value'}
                            value={condition.value || ''}
                            onChange={(e) => {
                              const value = condition.node && needsQuotes(condition.node.rmType) && !e.target.value.startsWith("'")
                                ? `'${e.target.value}'`
                                : e.target.value;
                              onUpdateCondition(condition.index, { value });
                            }}
                            className="flex-1 px-3 py-1 bg-surface text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none text-sm"
                          />
                          )}

                          {/* Parameter button */}
                          <button
                            onClick={() => onUpdateCondition(condition.index, {
                              value: condition.value?.startsWith('$') ? condition.value : '$parameter'
                            })}
                            className="px-2 py-1 bg-surface text-theme-primary rounded-md hover:bg-primary hover:text-white text-xs"
                            title="Use Parameter"
                          >
                            $
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Groups */}
          {groupedConditions && Object.entries(groupedConditions.groups).length > 0 && (
            <div className="space-y-6">
              {Object.entries(groupedConditions.groups).map(([groupId, group]) => (
                <div key={groupId} className="border border-theme rounded-lg overflow-hidden">
                  {/* Group header */}
                  <div className={`p-3 ${group.logic === 'AND' ? 'bg-primary/20' : 'bg-success/20'} flex justify-between items-center`}>
                    <div className="flex items-center gap-2">
                      {group.logic === 'AND' ? (
                        <GitMerge size={18} className="text-primary" />
                      ) : (
                        <GitBranch size={18} className="text-success" />
                      )}
                      <span className="text-theme-primary font-medium">
                        {group.logic} Group ({group.conditions.length} conditions)
                      </span>
                    </div>
                    <button
                      onClick={() => onRemoveGroup && onRemoveGroup(groupId)}
                      className="text-theme-secondary hover:text-error transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Group conditions */}
                  <div className="bg-surface p-3 space-y-3">
                    {group.conditions.map((condition) => (
                      <div
                        key={condition.index}
                        className="bg-surface-hover p-3 rounded-lg"
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 text-theme-primary truncate font-mono text-sm">
                              {condition.template ? buildNodePath(condition.template, condition.node, queryState.contains) : '(unknown path)'}
                            </div>
                            <button
                              onClick={() => onRemoveCondition(condition.index)}
                              className="text-theme-secondary hover:text-error transition-colors"
                            >
                              <X size={18} />
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Operator selection */}
                            <select
                              value={condition.operator || '='}
                              onChange={(e) => onUpdateCondition(condition.index, { operator: e.target.value })}
                              className="px-2 py-1 bg-surface text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none text-sm"
                            >
                              {condition.node && getOperatorsForType(condition.node.rmType).map(op => (
                                <option key={op} value={op}>{op}</option>
                              ))}
                            </select>

                            {/* Value input */}
                            {condition.operator === 'matches' ? (
                              <input
                                type="text"
                                placeholder="{'value1', 'value2'}"
                                value={condition.value || ''}
                                onChange={(e) => onUpdateCondition(condition.index, { value: e.target.value })}
                                className="flex-1 px-3 py-1 bg-surface text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none text-sm"
                              />
                            ) : condition.node?.rmType === 'DV_DATE_TIME' ? (
                              <input
                                type="datetime-local"
                                value={condition.value || ''}
                                onChange={(e) => {
                                  const value = needsQuotes(condition.node.rmType)
                                    ? `'${e.target.value}'`
                                    : e.target.value;
                                  onUpdateCondition(condition.index, { value });
                                }}
                                className="flex-1 px-3 py-1 bg-surface text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none text-sm"
                              />
                            ) : condition.node?.rmType === 'DV_BOOLEAN' ? (
                              <select
                                value={condition.value || ''}
                                onChange={(e) => onUpdateCondition(condition.index, { value: e.target.value })}
                                className="flex-1 px-3 py-1 bg-surface text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none text-sm"
                              >
                                <option value="">Select...</option>
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            ) : (
                              <input
                                type={condition.node?.rmType === 'DV_QUANTITY' || condition.node?.rmType === 'DV_COUNT' ? 'number' : 'text'}
                                placeholder={condition.node ? getValuePlaceholder(condition.node.rmType) : 'Value'}
                                value={condition.value || ''}
                                onChange={(e) => {
                                  const value = condition.node && needsQuotes(condition.node.rmType) && !e.target.value.startsWith("'")
                                    ? `'${e.target.value}'`
                                    : e.target.value;
                                  onUpdateCondition(condition.index, { value });
                                }}
                                className="flex-1 px-3 py-1 bg-surface text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none text-sm"
                              />
                            )}

                            {/* Parameter button */}
                            <button
                              onClick={() => onUpdateCondition(condition.index, {
                                value: condition.value?.startsWith('$') ? condition.value : '$parameter'
                              })}
                              className="px-2 py-1 bg-surface text-theme-primary rounded-md hover:bg-primary hover:text-white text-xs"
                              title="Use Parameter"
                            >
                              $
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Empty group message */}
                    {group.conditions.length === 0 && (
                      <div className="text-theme-secondary text-sm text-center p-3">
                        This group has no conditions yet. Add conditions to this group from the tree.
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(!conditions || conditions.length === 0) && (
            <div className="text-sm text-theme-secondary p-4 bg-surface rounded-lg">
              <p>Add conditions to filter the data in your query.</p>
              <p className="mt-2">You can add:</p>
              <ul className="list-disc pl-5 mt-1">
                <li>Data value conditions (e.g., systolic blood pressure {'>'} 140)</li>
                <li>Existence checks (e.g., check if a specific observation exists)</li>
                <li>Parameter references (e.g., use $nameValue for runtime parameters)</li>
                <li>Logical groups with AND/OR operators for complex filtering</li>
              </ul>
            </div>
          )}
        </div>

        {/* AQL Guide and Example */}
        <div className="bg-surface p-4 rounded-lg">
          <h4 className="text-sm font-medium text-theme-primary mb-2">AQL WHERE Guide</h4>
          <div className="text-xs text-theme-secondary space-y-2">
            <p>The WHERE clause defines criteria to filter data in the query.</p>
            <p><span className="text-primary">c/name/value = 'Report'</span> - Simple equality check</p>
            <p><span className="text-primary">o/data[at0001]/events[at0006]/data[at0003]/items[at0004]/value/magnitude {'>='} 140</span> - Numeric comparison</p>
            <p><span className="text-primary">c/name/value LIKE '*Report*'</span> - Pattern matching with wildcards</p>
            <p><span className="text-primary">c/name/value matches {'code1', 'code2'}</span> - Match against a set of values</p>
            <p><span className="text-primary">EXISTS c/content[openEHR-EHR-OBSERVATION.blood_pressure.v1]</span> - Check for existence</p>
            <p><span className="text-primary">(condition1 AND condition2) OR condition3</span> - Logical grouping</p>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};

WhereBuilder.propTypes = {
  conditions: PropTypes.arrayOf(PropTypes.shape({
    template: PropTypes.string,
    node: PropTypes.shape({
      name: PropTypes.string,
      rmType: PropTypes.string
    }),
    operator: PropTypes.string,
    value: PropTypes.string,
    groupId: PropTypes.string,
    groupLogic: PropTypes.oneOf(['AND', 'OR']),
    // For EXISTS conditions
    type: PropTypes.string,
    path: PropTypes.string,
    not: PropTypes.bool,
    // For parameter references
    name: PropTypes.string
  })),
  onAddCondition: PropTypes.func.isRequired,
  onRemoveCondition: PropTypes.func.isRequired,
  onUpdateCondition: PropTypes.func.isRequired,
  onAddGroup: PropTypes.func,
  onRemoveGroup: PropTypes.func,
  onUpdateGroup: PropTypes.func,
  isExpanded: PropTypes.bool.isRequired,
  onToggleExpand: PropTypes.func.isRequired
};

WhereBuilder.defaultProps = {
  conditions: [],
  onAddGroup: () => { },
  onRemoveGroup: () => { },
  onUpdateGroup: () => { }
};

export default WhereBuilder;