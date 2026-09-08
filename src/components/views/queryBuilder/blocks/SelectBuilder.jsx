// src/components/views/blocks/queryBuilder/SelectBuilder.jsx
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { X, FunctionSquare, AlignLeft } from 'lucide-react';
import TreeView from '../../../common/TreeView';
import CollapsibleSection from '../../../common/CollapsibleSection';
import { useQueryBuilderContext } from '@/providers/QueryBuilderProvider';
import { AQL_SELECTABLE_TYPES, AQL_SELECT_FUNCTIONS } from '@/lib/aqlLexicon';


const SelectBuilder = ({ isExpanded, onToggleExpand }) => {
  // Get state from context
  const {
    activeTemplates,
    queryState,
    cachedTemplates,
    ensureTreeByName,
    addSelectNode,
    removeSelectNode,
    updateSelectAlias,
    useDistinct,
    setUseDistinct,
    addFunction,
    addLiteral,
    buildNodePath
  } = useQueryBuilderContext();

  // Local state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("paths"); // "paths", "functions", "literals"
  const [functionType, setFunctionType] = useState(""); // Empty or one of the function types
  const [functionArgument, setFunctionArgument] = useState("");
  const [literalType, setLiteralType] = useState("string"); // "string", "number", "boolean", "datetime"
  const [literalValue, setLiteralValue] = useState("");
  const [countDistinct, setCountDistinct] = useState(false);

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

  // Filter logic for searching the template tree
  const filterTree = (node, term) => {
    if (!node) return null;
    if (!term) return node;

    // Check if this node's name or localizedName contains the search term
    const nodeName = node.name?.toLowerCase() || "";
    const localizedName = node.localizedName?.toLowerCase() || "";
    const nodeId = node.nodeId?.toLowerCase() || "";
    const rmType = node.rmType?.toLowerCase() || "";
    const search = term.toLowerCase();

    // Check multiple properties for matches
    const isMatch =
      nodeName.includes(search) ||
      localizedName.includes(search) ||
      nodeId.includes(search) ||
      rmType.includes(search);

    // If no children, return this node only if it matches
    if (!node.children || node.children.length === 0) {
      return isMatch ? node : null;
    }

    // Otherwise, filter the children
    const filteredChildren = node.children
      .map((child) => filterTree(child, term))
      .filter(Boolean); // remove nulls

    // If this node is a match or if any children matched, keep this node
    if (isMatch || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren,
      };
    }

    // Otherwise, no match
    return null;
  };

  const isSelectableNode = (node) => {
    if (!node || !node.rmType) return false;

    const selectableTypes = AQL_SELECTABLE_TYPES;

    const nodeType = node.rmType.toUpperCase();
    if (selectableTypes.has(nodeType)) return true;

    // Special cases:
    // 1. Node has no children (likely a leaf node)
    if (!node.children || node.children.length === 0) return true;

    // 2. Node has at0001-style nodeId (typically elements)
    if (node.nodeId && node.nodeId.match(/^at\d+/)) return true;

    // Otherwise, not selectable
    return false;
  };

  const filteredTrees = useMemo(() => {
    const result = {};

    if (!activeTemplates || !cachedTemplates) return result;

    activeTemplates.forEach((templateName) => {
      const templateData = cachedTemplates[templateName];
      const root = getTreeRoot(templateData);
      if (!root) return;
      const filtered = filterTree(root, searchTerm);
      if (filtered) result[templateName] = normalizeForTreeView(filtered);
    });

    return result;
  }, [activeTemplates, cachedTemplates, searchTerm, getTreeRoot, filterTree, normalizeForTreeView]);

  useEffect(() => {
    if (!activeTemplates?.length) return;
    (async () => {
      for (const name of activeTemplates) {
        const tpl = cachedTemplates?.[name];

        const hasTree = tpl?.webTemplate?.children?.length;
        if (!hasTree) await ensureTreeByName(name);
      }
    })();

  }, [activeTemplates, cachedTemplates, ensureTreeByName]);

  // Group query parts by type for organized display
  const groupedQueryParts = useMemo(() => {
    const groups = {
      paths: [],
      functions: [],
      variables: [],
      literals: []
    };

    if (!queryState || !queryState.select) return groups;

    queryState.select.forEach((item, index) => {
      if (item.type === 'function') {
        groups.functions.push({ ...item, index });
      } else if (item.type === 'variable') {
        groups.variables.push({ ...item, index });
      } else if (item.type === 'literal') {
        groups.literals.push({ ...item, index });
      } else {
        // Default to path
        groups.paths.push({ ...item, index });
      }
    });

    return groups;
  }, [queryState]);

  // Handle adding a function
  const handleAddFunction = () => {
    if (!functionType) return;

    // Build canonical argument strings
    let arg = functionArgument?.trim();
    if (functionType === 'COUNT') {
      if (!arg || arg === '*') {
        arg = '*';
      } else if (countDistinct) {
        arg = `DISTINCT ${arg}`;
      }
    } else if (functionType === 'TERMINOLOGY') {
      // Expect 3 comma-separated string args; if user typed raw text, we won’t force quotes here.
      // The query generator should emit quotes per AQL grammar.
    }

    addFunction({
      type: 'function',
      functionType,
      argument: arg,
      alias: ''
    });

    setFunctionType('');
    setFunctionArgument('');
    setCountDistinct(false);
  };

  // Handle adding a literal
  const handleAddLiteral = () => {
    if (!literalValue) return;

    let formattedValue = literalValue;

    // Format the value based on type
    if (literalType === 'string') {
      formattedValue = `'${literalValue}'`;
    } else if (literalType === 'datetime') {
      formattedValue = `'${literalValue}'`;
    } else if (literalType === 'boolean') {
      formattedValue = literalValue.toLowerCase();
    }

    const literalConfig = {
      type: 'literal',
      literalType,
      value: formattedValue,
      alias: ""
    };

    addLiteral(literalConfig);

    // Reset input
    setLiteralValue("");
  };

  // Generate display text for the selected items
  const getItemDisplayText = (item) => {
    if (item.type === 'function') {
      return `${item.functionType}(${item.argument || '*'})`;
    } else if (item.type === 'variable') {
      return item.variable;
    } else if (item.type === 'literal') {
      return item.value;
    } else if (queryState && queryState.contains) {
      return buildNodePath(item.template, item.node, queryState.contains);
    } else {
      return `${item.template}/${item.node.name || 'unknown'}`;
    }
  };

  return (
    <CollapsibleSection
      title="SELECT Builder"
      isExpanded={isExpanded}
      onToggle={onToggleExpand}
    >
      <div className="space-y-6">
        {/* DISTINCT option */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useDistinct}
            onChange={(e) => setUseDistinct(e.target.checked)}
          />
          <label htmlFor="useDistinct" className="text-theme-primary text-sm">
            Use DISTINCT (remove duplicate results)
          </label>
        </div>

        {/* SELECT Builder Tabs */}
        <div className="border-b border-theme">
          <div className="flex space-x-1">
            <button
              className={`px-4 py-2 border-b-2 text-sm font-medium ${selectedTab === "paths"
                ? "border-primary text-primary"
                : "border-transparent text-theme-secondary hover:text-theme-primary"
                }`}
              onClick={() => setSelectedTab("paths")}
            >
              <div className="flex items-center gap-1.5">
                <AlignLeft size={16} />
                <span>Paths</span>
              </div>
            </button>
            <button
              className={`px-4 py-2 border-b-2 text-sm font-medium ${selectedTab === "functions"
                ? "border-primary text-primary"
                : "border-transparent text-theme-secondary hover:text-theme-primary"
                }`}
              onClick={() => setSelectedTab("functions")}
            >
              <div className="flex items-center gap-1.5">
                <FunctionSquare size={16} />
                <span>Functions</span>
              </div>
            </button>
            <button
              className={`px-4 py-2 border-b-2 text-sm font-medium ${selectedTab === "literals"
                ? "border-primary text-primary"
                : "border-transparent text-theme-secondary hover:text-theme-primary"
                }`}
              onClick={() => setSelectedTab("literals")}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-lg">"</span>
                <span>Literals</span>
              </div>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-4">
          {/* Paths Tab */}
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

              {/* Template Trees */}
              {!activeTemplates || activeTemplates.length === 0 ? (
                <div className="text-theme-secondary p-4 bg-surface rounded-lg">
                  No active templates. Please select templates from the Templates tab.
                </div>
              ) : (
                <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                  {activeTemplates.map((templateName) => {
                    const filteredRoot = filteredTrees[templateName];
                    if (!cachedTemplates[templateName]) {
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
                        className="bg-background rounded-lg p-4"
                      >
                        <h3 className="text-lg font-medium text-theme-primary mb-4 sticky top-0 bg-background py-2 z-10">
                          {templateName}
                        </h3>
                        <div className="max-h-80 overflow-y-auto pr-2">
                          <TreeView
                            node={filteredRoot}
                            onSelect={(node) => addSelectNode(templateName, node)}
                            isSelectable={isSelectableNode}
                            purpose="SELECT"
                            defaultExpanded={!!searchTerm}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Functions Tab */}
          {selectedTab === "functions" && (
            <div className="bg-surface p-4 rounded-lg">
              <h3 className="text-theme-primary text-sm font-medium mb-4">
                Add functions to SELECT clause
              </h3>
              {functionType === 'COUNT' && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={countDistinct}
                    onChange={(e) => setCountDistinct(e.target.checked)}
                  />
                  <span className="text-theme-primary text-sm">Use DISTINCT (COUNT(DISTINCT path))</span>
                </label>
              )}

              <div className="space-y-4">
                {/* Function Type Selection */}
                <div>
                  <label className="block text-xs font-medium text-theme-secondary mb-1">
                    Function Type
                  </label>
                  <select
                    value={functionType}
                    onChange={(e) => setFunctionType(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none"
                  >
                    <option value="">Select a function...</option>
                    <optgroup label="Aggregate Functions">
                      {AQL_SELECT_FUNCTIONS.aggregate.map(f => <option key={f} value={f}>{f}()</option>)}
                    </optgroup>
                    <optgroup label="String Functions">
                      {AQL_SELECT_FUNCTIONS.string.map(f => <option key={f} value={f}>{f}()</option>)}
                    </optgroup>
                    <optgroup label="Numeric Functions">
                      {AQL_SELECT_FUNCTIONS.numeric.map(f => <option key={f} value={f}>{f}(…)</option>)}
                    </optgroup>
                    <optgroup label="Date/Time Functions">
                      {AQL_SELECT_FUNCTIONS.datetime.map(f => <option key={f} value={f}>{f}(…)</option>)}
                    </optgroup>
                    <optgroup label="Terminology">
                      {AQL_SELECT_FUNCTIONS.vendor.map(f => <option key={f} value={f}>{f}(…)</option>)}
                    </optgroup>
                  </select>
                </div>

                {/* Function Arguments (if needed) */}
                {functionType && functionType !== 'CURRENT_DATE' &&
                  functionType !== 'CURRENT_TIME' && functionType !== 'CURRENT_DATE_TIME' && (
                    <div>
                      <label className="block text-xs font-medium text-theme-secondary mb-1">
                        Argument
                      </label>
                      <input
                        type="text"
                        value={functionArgument}
                        onChange={(e) => setFunctionArgument(e.target.value)}
                        placeholder={functionType === 'COUNT' ? "* for all rows or path" : "Path or expression"}
                        className="w-full px-3 py-2 bg-surface-hover text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none"
                      />
                    </div>
                  )}

                {/* Add Function Button */}
                <button
                  onClick={handleAddFunction}
                  disabled={!functionType}
                  className={`px-3 py-2 rounded-md ${functionType
                    ? 'bg-primary text-white hover:opacity-90'
                    : 'bg-surface-hover text-theme-secondary cursor-not-allowed'
                    }`}
                >
                  Add Function
                </button>

                {/* Function documentation */}
                <div className="text-xs text-theme-secondary mt-3 border-t border-theme pt-3">
                  <h4 className="font-medium mb-1">Function Help</h4>
                  {functionType === 'COUNT' && (
                    <div>
                      <p className="font-medium">COUNT(expression)</p>
                      <p>Returns count of rows or specified values. Use * for all rows.</p>
                      <p className="mt-1">Example: <code>COUNT(*)</code> or <code>COUNT(o/data[at0001]/events)</code></p>
                    </div>
                  )}
                  {functionType === 'MIN' && (
                    <div>
                      <p className="font-medium">MIN(expression)</p>
                      <p>Returns minimum value from the specified path.</p>
                      <p className="mt-1">Example: <code>MIN(o/data[at0001]/events[at0006]/data[at0003]/items[at0004]/value/magnitude)</code></p>
                    </div>
                  )}
                  {functionType === 'MAX' && (
                    <p>Returns maximum value from the specified path.</p>
                  )}
                  {functionType === 'SUM' && (
                    <p>Returns sum of all values from the specified path.</p>
                  )}
                  {functionType === 'AVG' && (
                    <p>Returns average (mean) of all values from the specified path.</p>
                  )}
                  {functionType === 'LENGTH' && (
                    <p>Returns the length of a string value.</p>
                  )}
                  {functionType === 'CONCAT' && (
                    <p>Concatenates multiple strings. Separate arguments with commas.</p>
                  )}
                  {(functionType === 'CURRENT_DATE' || functionType === 'CURRENT_TIME' || functionType === 'CURRENT_DATE_TIME') && (
                    <p>Returns the current date/time. No arguments needed.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Literals Tab */}
          {selectedTab === "literals" && (
            <div className="bg-surface p-4 rounded-lg">
              <h3 className="text-theme-primary text-sm font-medium mb-4">
                Add literal values to SELECT clause
              </h3>

              <div className="space-y-4">
                {/* Literal Type Selection */}
                <div>
                  <label className="block text-xs font-medium text-theme-secondary mb-1">
                    Literal Type
                  </label>
                  <select
                    value={literalType}
                    onChange={(e) => setLiteralType(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-hover text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="datetime">Date/Time</option>
                  </select>
                </div>

                {/* Literal Value Input */}
                <div>
                  <label className="block text-xs font-medium text-theme-secondary mb-1">
                    Value
                  </label>
                  {literalType === 'boolean' ? (
                    <select
                      value={literalValue}
                      onChange={(e) => setLiteralValue(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-hover text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none"
                    >
                      <option value="">Select a value</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : literalType === 'datetime' ? (
                    <input
                      type="datetime-local"
                      value={literalValue}
                      onChange={(e) => setLiteralValue(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-hover text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none"
                    />
                  ) : (
                    <input
                      type={literalType === 'number' ? 'number' : 'text'}
                      value={literalValue}
                      onChange={(e) => setLiteralValue(e.target.value)}
                      placeholder={`Enter a ${literalType} value...`}
                      className="w-full px-3 py-2 bg-surface-hover text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none"
                    />
                  )}
                </div>

                {/* Add Literal Button */}
                <button
                  onClick={handleAddLiteral}
                  disabled={!literalValue}
                  className={`px-3 py-2 rounded-md ${literalValue
                    ? 'bg-primary text-white hover:opacity-90'
                    : 'bg-surface-hover text-theme-secondary cursor-not-allowed'
                    }`}
                >
                  Add Literal
                </button>

                {/* Literal format help */}
                <div className="text-xs text-theme-secondary mt-2">
                  {literalType === 'string' && (
                    <p>String literals will be enclosed in single quotes: 'example'</p>
                  )}
                  {literalType === 'datetime' && (
                    <p>Date/time values will be enclosed in single quotes and formatted according to ISO 8601.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Selected Items */}
        <div className="mt-6">
          {/* Quick add: variables from FROM/CONTAINS */}
          {queryState?.contains?.some(n => n.alias) && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs text-theme-secondary">Add whole objects:</span>
              {queryState.contains.filter(n => !!n.alias).map(n => (
                <button
                  key={n.index}
                  onClick={() => addSelectNode(null, null, n.alias)}
                  className="text-xs px-2 py-1 rounded bg-surface-hover hover:bg-surface text-theme-primary"
                  title={`SELECT ${n.alias}`}
                >
                  {n.alias}
                </button>
              ))}
            </div>
          )}
          <h3 className="text-md font-medium text-theme-primary mb-4">
            Selected Items ({queryState?.select?.length || 0})
          </h3>

          {Object.entries(groupedQueryParts).map(([groupType, items]) => (
            items.length > 0 && (
              <div key={groupType} className="mb-5">
                <h4 className="text-sm font-medium text-theme-secondary mb-2 capitalize flex items-center gap-1.5">
                  {groupType === 'paths' && <AlignLeft size={14} />}
                  {groupType === 'functions' && <FunctionSquare size={14} />}
                  {groupType === 'literals' && <span className="font-mono">""</span>}
                  {groupType}
                </h4>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                  {items.map((item) => (
                    <div
                      key={item.index}
                      className="flex items-center gap-4 bg-surface-hover p-3 rounded-lg"
                    >
                      <div className="flex-1 text-theme-primary truncate font-mono text-sm" title={getItemDisplayText(item)}>
                        {getItemDisplayText(item)}
                      </div>
                      <input
                        type="text"
                        placeholder="AS alias"
                        value={item.alias || ''}
                        onChange={(e) => updateSelectAlias(item.index, e.target.value)}
                        className="px-3 py-1 bg-surface text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none w-32"
                      />
                      <button
                        onClick={() => removeSelectNode(item.index)}
                        className="text-theme-secondary hover:text-error transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          ))}
        </div>

        {/* AQL Guide and Example */}
        <div className="bg-surface p-4 rounded-lg">
          <h4 className="text-sm font-medium text-theme-primary mb-2">AQL SELECT Guide</h4>
          <div className="text-xs text-theme-secondary space-y-2">
            <p>The SELECT clause defines what data should be returned in the result set.</p>
            <p><span className="text-primary">SELECT c/name/value</span> - Path to specific data element</p>
            <p><span className="text-primary">SELECT DISTINCT e/ehr_id/value</span> - Remove duplicate results</p>
            <p><span className="text-primary">SELECT c</span> - Return the whole Composition object</p>
            <p><span className="text-primary">SELECT COUNT(*)</span> - Count all matching results</p>
            <p><span className="text-primary">SELECT c/name/value AS CompositionName</span> - Rename result column</p>
            <p><span className="text-primary">SELECT 'Critical' AS status</span> - Add a literal value to results</p>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};

SelectBuilder.propTypes = {
  isExpanded: PropTypes.bool.isRequired,
  onToggleExpand: PropTypes.func.isRequired
};

export default SelectBuilder;