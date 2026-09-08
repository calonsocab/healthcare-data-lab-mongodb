// src/components/views/dataModelManagement/AnalyticsTab.jsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Star,
  Trash2,
  Check,
  ChevronRight,
  ChevronDown,
  Activity,
  Hash,
  Type,
  Calendar,
  List,
  ToggleLeft,
  Clock,
  FileText,
  Save,
  Loader2,
  Info,
  Sparkles,
  X,
  Folder,
  CheckSquare,
  Square,
  MinusSquare,
  Code,
  LayoutList
} from 'lucide-react';

// RM Type icons mapping
const TYPE_ICONS = {
  'DV_QUANTITY': Hash,
  'DV_COUNT': Hash,
  'DV_TEXT': Type,
  'DV_CODED_TEXT': List,
  'DV_DATE': Calendar,
  'DV_DATE_TIME': Calendar,
  'DV_TIME': Clock,
  'DV_DURATION': Clock,
  'DV_BOOLEAN': ToggleLeft,
  'DV_ORDINAL': Activity,
};

// Entry type icons
const ENTRY_ICONS = {
  'OBSERVATION': Activity,
  'EVALUATION': FileText,
  'INSTRUCTION': List,
  'ACTION': Activity,
  'ADMIN_ENTRY': FileText,
  'SECTION': Folder,
  'CLUSTER': Folder,
};

// Data types that can be selected for analytics
const SELECTABLE_DATA_TYPES = [
  'DV_QUANTITY', 'DV_COUNT', 'DV_TEXT', 'DV_CODED_TEXT',
  'DV_DATE', 'DV_DATE_TIME', 'DV_TIME', 'DV_DURATION',
  'DV_BOOLEAN', 'DV_ORDINAL', 'DV_IDENTIFIER', 'DV_URI'
];

/**
 * Get the analytics-appropriate AQL path suffix based on RM type
 * Extends the WebTemplate aqlPath to point to the actual value attribute
 */
const getAqlPathSuffix = (rmType, node) => {
  const rmTypeUpper = (rmType || '').toUpperCase();

  // Check if node has inputs with suffix hints
  const suffix = node?.inputs?.[0]?.suffix;

  switch (rmTypeUpper) {
    case 'DV_QUANTITY':
      // For quantities, we typically want magnitude (and optionally units)
      return suffix === 'units' ? '/units' : '/magnitude';
    case 'DV_COUNT':
      return '/magnitude';
    case 'DV_CODED_TEXT':
      // For coded text, get the code
      return '/defining_code/code_string';
    case 'DV_ORDINAL':
      // For ordinals, get the value (numeric)
      return '/value';
    case 'DV_TEXT':
    case 'DV_IDENTIFIER':
    case 'DV_URI':
      // Text types - the aqlPath usually already ends in /value
      return '/value';
    case 'DV_DATE':
    case 'DV_DATE_TIME':
    case 'DV_TIME':
    case 'DV_DURATION':
      return '/value';
    case 'DV_BOOLEAN':
      return '/value';
    default:
      return '';
  }
};

/**
 * Build the full analytics AQL path from WebTemplate node
 * Uses the node's aqlPath directly and appends appropriate suffix
 */
const buildAnalyticsPath = (node, rmType, suffixOverride) => {
  // Use the aqlPath from WebTemplate directly - it's already correct
  const basePath = (node.aqlPath || '').replace(/\/$/, '');

  if (!basePath) return '';

  // Get the appropriate suffix for this RM type
  const suffix = suffixOverride ?? getAqlPathSuffix(rmType, node);

  if (!suffix) return basePath;

  // Avoid duplicating suffixes if the template already includes them
  if (basePath.endsWith(suffix)) {
    return basePath;
  }

  return `${basePath}${suffix}`;
};

const getLeafLabelForRmType = (rmType, suffix = '') => {
  switch (rmType) {
    case 'DV_QUANTITY':
      return suffix.includes('units') ? 'Units' : 'Magnitude';
    case 'DV_COUNT':
      return 'Count';
    case 'DV_CODED_TEXT':
      return 'Code';
    case 'DV_ORDINAL':
      return 'Value';
    case 'DV_TEXT':
    case 'DV_IDENTIFIER':
    case 'DV_URI':
    case 'DV_DATE':
    case 'DV_DATE_TIME':
    case 'DV_TIME':
    case 'DV_DURATION':
    case 'DV_BOOLEAN':
      return 'Value';
    default:
      return 'Value';
  }
};

const getSelectableFieldInfo = (node) => {
  const rmType = (node.rmType || '').toUpperCase();
  const nodeName = node.localizedNames?.en || node.name || node.localizedName || '';
  const aqlPath = node.aqlPath || '';
  const leafLabelFromNode = node.__leafLabel;

  if (!SELECTABLE_DATA_TYPES.includes(rmType) || !nodeName || !aqlPath) return null;

  if (node.__isValueLeaf) {
    const leafLabel = leafLabelFromNode || getLeafLabelForRmType(rmType);
    const displayName = node.__parentDisplayName
      ? `${node.__parentDisplayName} (${nodeName})`
      : nodeName;

    return {
      path: aqlPath,
      name: displayName,
      rmType,
      leafLabel
    };
  }

  const suffix = getAqlPathSuffix(rmType, node);
  const analyticsPath = buildAnalyticsPath(node, rmType, suffix);
  const leafLabel = leafLabelFromNode || getLeafLabelForRmType(rmType, suffix);
  const displayName = leafLabel ? `${nodeName} (${leafLabel})` : nodeName;

  return {
    path: analyticsPath,
    name: displayName,
    rmType,
    leafLabel
  };
};

/**
 * TreeNode - Recursive component for rendering hierarchical tree with checkboxes
 */
const TreeNode = ({
  node,
  depth = 0,
  expandedNodes,
  toggleExpand,
  selectedPaths,
  onToggleSelect,
  getFieldRecommendation
}) => {
  if (!node) return null;

  const rmType = (node.rmType || '').toUpperCase();
  const rawNodeName = node.localizedNames?.en || node.name || node.localizedName || '';
  const nodeId = node.nodeId || node.id || '';
  const baseChildren = node.children || [];

  // Use the WebTemplate's aqlPath directly - it's already unique and correct
  const aqlPath = node.aqlPath || '';
  const selectableInfo = getSelectableFieldInfo(node);
  const leafLabel = node.__leafLabel || selectableInfo?.leafLabel;
  const isValueLeaf = node.__isValueLeaf;
  const analyticsPath = selectableInfo
    ? (isValueLeaf ? aqlPath : selectableInfo.path)
    : aqlPath;
  const hasSyntheticLeaf = selectableInfo && !isValueLeaf;

  const syntheticLeaf = hasSyntheticLeaf ? {
    nodeId: `${nodeId || aqlPath || rawNodeName}-value`,
    name: leafLabel || 'Value',
    localizedNames: { en: leafLabel || 'Value' },
    rmType,
    aqlPath: analyticsPath,
    children: [],
    __isValueLeaf: true,
    __leafLabel: leafLabel,
    __parentDisplayName: rawNodeName,
    __sourceNode: node
  } : null;

  const children = hasSyntheticLeaf ? [...baseChildren, syntheticLeaf] : baseChildren;
  const hasChildren = children.length > 0;

  // Is this a selectable data field?
  const isSelectable = selectableInfo && (!hasSyntheticLeaf || isValueLeaf);
  const uniqueKey = aqlPath || nodeId || rawNodeName;
  const isSelected = isSelectable && selectedPaths.has(analyticsPath);
  const isExpanded = expandedNodes[uniqueKey] !== false;
  const displayName = isValueLeaf && node.__parentDisplayName
    ? `${node.__parentDisplayName} (${rawNodeName || leafLabel || 'Value'})`
    : rawNodeName;
  const selectionName = isValueLeaf && node.__parentDisplayName
    ? `${node.__parentDisplayName} (${rawNodeName || leafLabel || 'Value'})`
    : (selectableInfo?.leafLabel && !hasSyntheticLeaf ? `${rawNodeName} (${selectableInfo.leafLabel})` : rawNodeName);

  // Get recommendation info for selectable fields
  const recommendation = isSelectable ? getFieldRecommendation(rmType, node.__sourceNode || node) : null;

  // Determine icon
  let IconComponent = FileText;
  if (isSelectable) {
    IconComponent = TYPE_ICONS[rmType] || FileText;
  } else if (ENTRY_ICONS[rmType]) {
    IconComponent = ENTRY_ICONS[rmType];
  }

  // Calculate child selection state for parent nodes
  const getChildSelectableNodes = (n) => {
    const result = [];
    const info = getSelectableFieldInfo(n);
    const childRmType = (n.rmType || '').toUpperCase();
    if (info) {
      result.push({ node: n.__sourceNode || n, path: info.path, rmType: childRmType, name: info.name });
    }

    (n.children || []).forEach(grandchild => {
      result.push(...getChildSelectableNodes(grandchild));
    });
    return result;
  };

  const childSelectables = hasChildren ? children.flatMap(child =>
    getChildSelectableNodes(child)
  ) : [];
  const selectedChildCount = childSelectables.filter(c => selectedPaths.has(c.path)).length;
  const allChildrenSelected = childSelectables.length > 0 && selectedChildCount === childSelectables.length;
  const someChildrenSelected = selectedChildCount > 0 && selectedChildCount < childSelectables.length;

  // Handle checkbox click for parent (select/deselect all children)
  const handleParentCheckboxClick = (e) => {
    e.stopPropagation();
    if (allChildrenSelected) {
      // Deselect all
      childSelectables.forEach(c => {
        if (selectedPaths.has(c.path)) {
          onToggleSelect(c.path, c.node, c.rmType, c.name, false);
        }
      });
    } else {
      // Select all
      childSelectables.forEach(c => {
        if (!selectedPaths.has(c.path)) {
          onToggleSelect(c.path, c.node, c.rmType, c.name, true);
        }
      });
    }
  };

  // Skip non-meaningful nodes but render their children
  if (!displayName && !isSelectable && hasChildren) {
    return (
      <>
        {children.map((child, idx) => (
          <TreeNode
            key={`${child.nodeId || child.id || idx}-${idx}`}
            node={child}
            depth={depth}
            expandedNodes={expandedNodes}
            toggleExpand={toggleExpand}
            selectedPaths={selectedPaths}
            onToggleSelect={onToggleSelect}
            getFieldRecommendation={getFieldRecommendation}
          />
        ))}
      </>
    );
  }

  if (!displayName) return null;

  return (
    <div>
      {/* Node row */}
      <div
        className={`flex items-center gap-1 py-1.5 px-2 hover:bg-surface/50 rounded-sm cursor-pointer transition-colors ${
          isSelected ? 'bg-primary/10' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (isSelectable) {
            onToggleSelect(analyticsPath, node, rmType, selectionName, !isSelected);
          } else if (hasChildren) {
            toggleExpand(uniqueKey);
          }
        }}
      >
        {/* Expand/collapse button for parents */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(uniqueKey);
            }}
            className="p-0.5 hover:bg-surface rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-theme-secondary" />
            ) : (
              <ChevronRight className="w-4 h-4 text-theme-secondary" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Checkbox */}
        {isSelectable ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(analyticsPath, node, rmType, selectionName, !isSelected);
            }}
            className="p-0.5"
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4 text-theme-secondary hover:text-primary" />
            )}
          </button>
        ) : hasChildren && childSelectables.length > 0 ? (
          <button
            onClick={handleParentCheckboxClick}
            className="p-0.5"
            title={allChildrenSelected ? 'Deselect all in this group' : 'Select all in this group'}
          >
            {allChildrenSelected ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : someChildrenSelected ? (
              <MinusSquare className="w-4 h-4 text-primary/60" />
            ) : (
              <Square className="w-4 h-4 text-theme-secondary hover:text-primary" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Icon */}
        <IconComponent className={`w-4 h-4 flex-shrink-0 ${
          isSelectable
            ? isSelected ? 'text-primary' : 'text-theme-secondary'
            : 'text-slate-500'
        }`} />

        {/* Name */}
        <span className={`text-sm truncate ${
          isSelected ? 'text-primary font-medium' : 'text-theme-primary'
        }`}>
          {displayName}
        </span>

        {/* RM Type badge for selectable fields */}
        {isSelectable && (
          <span className="text-xs text-theme-secondary bg-surface px-1.5 py-0.5 rounded ml-1">
            {rmType.replace('DV_', '')}
          </span>
        )}

        {/* Recommendation star */}
        {recommendation?.recommended && (
          <Star
            className="w-3.5 h-3.5 text-amber-400 fill-amber-400 ml-1 flex-shrink-0"
            title={recommendation.reason}
          />
        )}

        {/* Child count for containers */}
        {!isSelectable && childSelectables.length > 0 && (
          <span className="text-xs text-theme-secondary ml-auto">
            {selectedChildCount > 0 && (
              <span className="text-primary">{selectedChildCount}/</span>
            )}
            {childSelectables.length} fields
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {children.map((child, idx) => (
            <TreeNode
              key={`${child.nodeId || child.id || idx}-${idx}`}
              node={child}
              depth={depth + 1}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
              selectedPaths={selectedPaths}
              onToggleSelect={onToggleSelect}
              getFieldRecommendation={getFieldRecommendation}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * AnalyticsTab - Configure analytics fields for a template
 *
 * Two views: GUI (tree + selected table) and JSON
 */
const AnalyticsTab = ({ template, onSave, saving = false }) => {
  const [selectedFields, setSelectedFields] = useState([]);
  const [expandedNodes, setExpandedNodes] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [rightPanelView, setRightPanelView] = useState('table'); // 'table' or 'json'

  // Load existing analytics config
  useEffect(() => {
    if (template?.analyticsTemplate?.fields) {
      setSelectedFields(template.analyticsTemplate.fields);
    } else {
      setSelectedFields([]);
    }
    setHasChanges(false);
  }, [template?._id, template?.analyticsTemplate]);

  // Get recommendation status for a field
  const getFieldRecommendation = useCallback((rmType, node) => {
    if (['DV_QUANTITY', 'DV_COUNT'].includes(rmType)) {
      return { recommended: true, reason: 'Good for measures/aggregations' };
    }

    if (rmType === 'DV_CODED_TEXT') {
      const hasTerminology = node.inputs?.some(i =>
        i.terminology && ['SNOMED-CT', 'LOINC', 'ICD10'].some(t =>
          i.terminology.toUpperCase().includes(t)
        )
      );
      if (hasTerminology) {
        return { recommended: true, reason: 'Terminology-bound, good for filtering' };
      }
      if (node.inputs?.some(i => i.list?.length > 0)) {
        return { recommended: true, reason: 'Has coded options, good for grouping' };
      }
    }

    if (['DV_DATE', 'DV_DATE_TIME'].includes(rmType)) {
      return { recommended: true, reason: 'Useful for time-based analysis' };
    }

    if (rmType === 'DV_ORDINAL') {
      return { recommended: true, reason: 'Good for scoring/ranking analysis' };
    }

    return { recommended: false, reason: null };
  }, []);

  // Build flat list of all selectable nodes for counting/recommendations
  const allSelectableNodes = useMemo(() => {
    const nodes = [];

    const traverse = (node) => {
      if (!node) return;

      const info = getSelectableFieldInfo(node);

      if (info) {
        nodes.push({
          path: info.path,
          name: info.name,
          rmType: info.rmType,
          node,
          isRecommended: getFieldRecommendation(info.rmType, node)
        });
      }

      (node.children || []).forEach(child => traverse(child));
    };

    if (template?.webTemplate) {
      traverse(template.webTemplate);
    }

    return nodes;
  }, [template?.webTemplate, getFieldRecommendation]);

  // Selected paths as a Set for O(1) lookup
  const selectedPaths = useMemo(() => {
    return new Set(selectedFields.map(f => f.path));
  }, [selectedFields]);

  // Toggle field selection
  const handleToggleSelect = (path, node, rmType, fieldName, shouldSelect) => {
    setSelectedFields(prev => {
      if (shouldSelect) {
        if (prev.some(f => f.path === path)) return prev;
        return [...prev, {
          name: fieldName,
          path,
          rmType
        }];
      } else {
        return prev.filter(f => f.path !== path);
      }
    });
    setHasChanges(true);
  };

  // Toggle node expansion
  const toggleExpand = (nodeKey) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeKey]: prev[nodeKey] === false ? true : false
    }));
  };

  // Expand all nodes
  const expandAll = () => {
    const expanded = {};

    const traverse = (node) => {
      if (!node) return;

      // Use the aqlPath or nodeId as the unique key (matches TreeNode's uniqueKey)
      const aqlPath = node.aqlPath || '';
      const nodeId = node.nodeId || node.id || '';
      const nodeName = node.localizedNames?.en || node.name || node.localizedName || '';
      const uniqueKey = aqlPath || nodeId || nodeName;

      if (node.children?.length && uniqueKey) {
        expanded[uniqueKey] = true;
        node.children.forEach(child => traverse(child));
      }
    };

    if (template?.webTemplate) {
      traverse(template.webTemplate);
    }
    setExpandedNodes(expanded);
  };

  // Collapse all nodes
  const collapseAll = () => {
    setExpandedNodes({});
  };

  // Select all recommended fields
  const selectAllRecommended = () => {
    const recommended = allSelectableNodes.filter(n => n.isRecommended?.recommended);
    const newFields = recommended.map(field => ({
      name: field.name,
      path: field.path,
      rmType: field.rmType
    }));

    setSelectedFields(prev => {
      const existingPaths = new Set(prev.map(f => f.path));
      const toAdd = newFields.filter(f => !existingPaths.has(f.path));
      return [...prev, ...toAdd];
    });
    setHasChanges(true);
  };

  // Select all fields
  const selectAll = () => {
    const newFields = allSelectableNodes.map(field => ({
      name: field.name,
      path: field.path,
      rmType: field.rmType
    }));

    setSelectedFields(prev => {
      const existingPaths = new Set(prev.map(f => f.path));
      const toAdd = newFields.filter(f => !existingPaths.has(f.path));
      return [...prev, ...toAdd];
    });
    setHasChanges(true);
  };

  // Clear all selections
  const clearAllSelections = () => {
    setSelectedFields([]);
    setHasChanges(true);
  };

  // Remove a single field
  const removeField = (path) => {
    setSelectedFields(prev => prev.filter(f => f.path !== path));
    setHasChanges(true);
  };

  // Build output structure
  const analyticsOutput = useMemo(() => ({
    templateId: template?.name || 'template',
    fields: selectedFields.map(f => ({
      name: f.name,
      path: f.path,
      rmType: f.rmType
    }))
  }), [template?.name, selectedFields]);

  // Save analytics configuration
  const handleSave = async () => {
    if (onSave) {
      await onSave(analyticsOutput);
      setHasChanges(false);
    }
  };

  // Update from JSON
  const handleJsonChange = (jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.fields && Array.isArray(parsed.fields)) {
        setSelectedFields(parsed.fields);
        setHasChanges(true);
      }
    } catch (e) {
      // Invalid JSON, ignore
    }
  };

  // Get icon for RM type
  const getTypeIcon = (rmType) => TYPE_ICONS[rmType] || FileText;

  // Counts
  const recommendedCount = allSelectableNodes.filter(n => n.isRecommended?.recommended).length;
  const totalFieldCount = allSelectableNodes.length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-theme">
        <div>
          <h3 className="text-lg font-semibold text-theme-primary">
            Analytics Configuration
          </h3>
          <p className="text-sm text-theme-secondary mt-1">
            Define which fields to include in analytics/cohort queries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className="text-sm text-warning">Unsaved changes</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="px-4 py-2 bg-primary text-primary-text rounded-lg flex items-center gap-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main content - two columns */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* Left: Hierarchical Tree */}
        <div className="w-1/2 flex flex-col min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-theme-primary">
              Template Structure
            </h4>
            <div className="flex items-center gap-2">
              <button
                onClick={expandAll}
                className="text-xs text-theme-secondary hover:text-primary"
              >
                Expand All
              </button>
              <span className="text-theme-secondary">|</span>
              <button
                onClick={collapseAll}
                className="text-xs text-theme-secondary hover:text-primary"
              >
                Collapse All
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto border border-theme rounded-lg bg-background p-2">
            {template?.webTemplate ? (
              <TreeNode
                node={template.webTemplate}
                expandedNodes={expandedNodes}
                toggleExpand={toggleExpand}
                selectedPaths={selectedPaths}
                onToggleSelect={handleToggleSelect}
                getFieldRecommendation={getFieldRecommendation}
              />
            ) : (
              <div className="p-8 text-center text-theme-secondary">
                <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No template structure available.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick actions + Selected fields (Table/JSON toggle) */}
        <div className="w-1/2 flex flex-col min-w-0">
          {/* Quick Actions */}
          <div className="mb-4 p-3 bg-surface rounded-lg border border-theme">
            <h4 className="text-sm font-medium text-theme-primary mb-3">Quick Actions</h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={selectAllRecommended}
                className="px-3 py-1.5 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-500 flex items-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                Auto-select Recommended ({recommendedCount})
              </button>
              <button
                onClick={selectAll}
                className="px-3 py-1.5 bg-surface-hover text-theme-primary text-sm rounded-lg hover:bg-surface border border-theme flex items-center gap-1.5"
              >
                <CheckSquare className="w-4 h-4" />
                Select All ({totalFieldCount})
              </button>
              {selectedFields.length > 0 && (
                <button
                  onClick={clearAllSelections}
                  className="px-3 py-1.5 border border-theme text-theme-secondary text-sm rounded-lg hover:bg-surface flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" />
                  Clear All
                </button>
              )}
            </div>
            <p className="text-xs text-theme-secondary mt-2">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400 inline mr-1" />
              Recommended: quantities, coded values with terminologies, dates, ordinals.
            </p>
          </div>

          {/* Selected Fields Header with View Toggle */}
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-theme-primary flex items-center gap-2">
              <Check className="w-4 h-4" />
              Selected Fields ({selectedFields.length})
            </h4>
            <div className="flex items-center gap-1 bg-surface rounded-lg p-0.5 border border-theme">
              <button
                onClick={() => setRightPanelView('table')}
                className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
                  rightPanelView === 'table'
                    ? 'bg-primary text-primary-text'
                    : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                Table
              </button>
              <button
                onClick={() => setRightPanelView('json')}
                className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-colors ${
                  rightPanelView === 'json'
                    ? 'bg-primary text-primary-text'
                    : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                JSON
              </button>
            </div>
          </div>

          {/* Table View */}
          {rightPanelView === 'table' && (
            <div className="flex-1 overflow-auto border border-theme rounded-lg bg-background">
              {selectedFields.length === 0 ? (
                <div className="p-8 text-center text-theme-secondary">
                  <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No fields selected yet.</p>
                  <p className="text-xs mt-1">Use quick actions or select from the tree.</p>
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
                    {selectedFields.map(field => {
                      const TypeIcon = getTypeIcon(field.rmType);

                      return (
                        <tr key={field.path} className="hover:bg-surface">
                          <td className="px-3 py-2 text-theme-primary text-sm font-medium">{field.name}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5 text-theme-secondary">
                              <TypeIcon className="w-3.5 h-3.5" />
                              <span className="text-xs">{field.rmType.replace('DV_', '')}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <code className="text-xs text-theme-secondary break-all">
                              {field.path}
                            </code>
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => removeField(field.path)}
                              className="p-1 text-theme-secondary hover:text-error rounded hover:bg-error/10"
                              title="Remove field"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* JSON View */}
          {rightPanelView === 'json' && (
            <div className="flex-1 flex flex-col min-h-0">
              <textarea
                value={JSON.stringify(analyticsOutput, null, 2)}
                onChange={(e) => handleJsonChange(e.target.value)}
                className="flex-1 w-full p-4 bg-background border border-theme rounded-lg font-mono text-sm text-theme-primary resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTab;
