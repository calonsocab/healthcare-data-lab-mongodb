// src/components/views/dataModelManagement/OpenEHRTemplateList.jsx
"use client";

import React, { useState, useEffect, createContext, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Info,
  ChevronDown,
  ChevronRight,
  File,
  FileText,
  ClipboardList,
  AlertCircle,
  Activity,
  PlayCircle,
  ShieldAlert,
  Trash2,
  FileSpreadsheet,
  Square,
  Loader2,
  ExternalLink,
  X,
  Maximize2,
  BarChart2
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/common/Tabs';
import TreeView from '@/components/common/TreeView';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import CodeViewer from '@/components/common/CodeViewer';
import MindMap from '@/components/common/MindMap';
import JsonTree from '@/components/common/JsonTree';
import RelatedAQLsModal from './RelatedAQLsModal';
import AnalyticsTab from './AnalyticsTab';
import { useAQLQueries } from '@/providers/AQLQueryProvider';
import {
  getCachedDataModel,
  setCachedDataModel,
  fetchDataModelDetail,
  invalidateDataModelCache
} from '@/lib/data-models/clientCache';

// Create a context for QueryBuilder
export const QueryBuilderContext = createContext({
  setActiveTab: () => { }
});

// Section Card component 
const SectionCard = ({ section }) => {
  const [collapsed, setCollapsed] = useState(false);
  const toggleCollapse = () => setCollapsed(!collapsed);

  // Render the children of a section as entry boxes based on rmType
  const renderEntryBox = (child, idx) => {
    const rmType = (child.rmType || "").toLowerCase();
    let IconComponent = Square;
    let label = "ELEMENT";
    let colorClasses = "text-theme-secondary border-theme";

    if (rmType.includes("evaluation")) {
      IconComponent = ClipboardList;
      label = "EVALUATION";
      colorClasses = "text-primary border-primary";
    } else if (rmType.includes("instruction")) {
      IconComponent = AlertCircle;
      label = "INSTRUCTION";
      colorClasses = "text-warning border-warning";
    } else if (rmType.includes("observation")) {
      IconComponent = Activity;
      label = "OBSERVATION";
      colorClasses = "text-primary border-primary";
    } else if (rmType.includes("action")) {
      IconComponent = PlayCircle;
      label = "ACTION";
      colorClasses = "text-success border-success";
    } else if (rmType.includes("admin")) {
      IconComponent = ShieldAlert;
      label = "ADMIN_ENTRY";
      colorClasses = "text-error border-error";
    }

    return (
      <div
        key={`entry-${child.nodeId || child.id || 'unknown'}-${idx}`}
        className={`border rounded px-1 py-0.5 inline-flex items-center gap-1 m-1 ${colorClasses}`}
      >
        <IconComponent size={14} />
        <span className="text-xs">{label}</span>
        <span className="text-xs text-theme-secondary">
          {child.nodeId ? `${child.name || child.localizedName || ''}` : ""}
        </span>
      </div>
    );
  };

  return (
    <div className="mb-2 pl-2 border-l border-theme">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-theme-secondary">Section:</span>
          <span className="text-theme-primary font-medium">
            {section.name || section.localizedName || "Unnamed Section"}
          </span>
          <span className="text-xs text-theme-secondary">
            ({section.nodeId || "N/A"})
          </span>
        </div>
        <button onClick={toggleCollapse} className="text-theme-secondary hover:text-theme-primary">
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      {!collapsed && (
        <div className="mt-2 flex flex-wrap">
          {(section.children || []).map((child, i) => renderEntryBox(child, i))}
        </div>
      )}
    </div>
  );
};

const EnhancedStructureDisplay = ({ template, sections, rootEntries }) => {
  const getEntryTypeConfig = (rmType) => {
    const type = (rmType || "").toLowerCase();
    if (type.includes("evaluation")) {
      return { icon: ClipboardList, label: "EVALUATION", bgColor: "bg-blue-500/20", textColor: "text-blue-400", borderColor: "border-blue-400" };
    } else if (type.includes("instruction")) {
      return { icon: AlertCircle, label: "INSTRUCTION", bgColor: "bg-warning/20", textColor: "text-warning", borderColor: "border-warning" };
    } else if (type.includes("observation")) {
      return { icon: Activity, label: "OBSERVATION", bgColor: "bg-green-500/20", textColor: "text-green-400", borderColor: "border-green-400" };
    } else if (type.includes("action")) {
      return { icon: PlayCircle, label: "ACTION", bgColor: "bg-success/20", textColor: "text-success", borderColor: "border-success" };
    } else if (type.includes("admin")) {
      return { icon: ShieldAlert, label: "ADMIN_ENTRY", bgColor: "bg-error/20", textColor: "text-error", borderColor: "border-error" };
    }
    return { icon: Square, label: "ELEMENT", bgColor: "bg-theme-secondary/20", textColor: "text-theme-secondary", borderColor: "border-theme" };
  };

  const getCardinalityDisplay = (node) => {
    if (node?.min == null && node?.max == null) return null;
    const maxDisplay = node.max === -1 ? '*' : node.max ?? '*';
    return `${node.min ?? 0}..${maxDisplay}`;
  };

  const getFieldsToShow = (entry) => {
    const fields = [];
    const root = { clusters: new Map(), fields: [] };

    const getNodeName = (node) => node?.localizedNames?.en || node?.name || node?.localizedName || null;
    const isClusterNode = (node) => String(node?.rmType || '').toLowerCase().includes('cluster');
    const isDataFieldNode = (node) => {
      const rmType = String(node?.rmType || '').toLowerCase();
      return [
        'dv_quantity', 'dv_text', 'dv_coded_text', 'dv_count', 'dv_date', 'dv_boolean',
        'dv_ordinal', 'dv_duration', 'dv_date_time', 'dv_time', 'dv_uri', 'dv_identifier',
        'dv_multimedia', 'dv_parsable', 'dv_encapsulated'
      ].some(t => rmType.includes(t));
    };

    const ensureCluster = (parent, name) => {
      if (!name) return null;
      if (!parent.clusters) parent.clusters = new Map();
      if (!parent.clusters.has(name)) {
        parent.clusters.set(name, { name, clusters: new Map(), fields: [] });
      }
      return parent.clusters.get(name);
    };

    const addFieldToTree = (clusterPath, field) => {
      if (!Array.isArray(clusterPath) || clusterPath.length === 0) {
        root.fields.push(field);
        return;
      }
      let cursor = root;
      for (const seg of clusterPath) {
        const next = ensureCluster(cursor, seg);
        if (!next) break;
        cursor = next;
      }
      cursor.fields.push(field);
    };

    const traverse = (node, clusterPath = [], path = []) => {
      if (!node) return;
      const nodeName = getNodeName(node);
      const nextPath = [...path, nodeName].filter(Boolean);
      const nextClusterPath =
        isClusterNode(node) && nodeName
          ? [...clusterPath, nodeName]
          : clusterPath;

      if (isDataFieldNode(node) && nodeName) {
        const field = {
          name: nodeName,
          rmType: node.rmType,
          path: nextPath,
          cardinality: getCardinalityDisplay(node),
          isRequired: (node.min ?? 0) > 0,
          hasOptions: !!(node.inputs && node.inputs.some(i => i.list?.length > 0)),
          node,
          clusterPath: nextClusterPath
        };
        fields.push(field);
        addFieldToTree(nextClusterPath, field);
      }

      (node.children || []).forEach((child) => traverse(child, nextClusterPath, nextPath));
    };

    traverse(entry);

    fields.sort((a, b) => (b.isRequired - a.isRequired) || a.name.localeCompare(b.name));
    return { visible: fields, hidden: [], clustered: root };
  };

  const getFieldTypeInfo = (field) => {
    const t = (field.rmType || "").toLowerCase();
    if (t.includes('quantity')) return { icon: Activity, type: 'Numeric' };
    if (t.includes('coded_text')) return { icon: ChevronDown, type: 'Selection' };
    if (t.includes('dv_text')) return { icon: File, type: 'Text' };
    if (t.includes('count')) return { icon: Activity, type: 'Count' };
    if (t.includes('date')) return { icon: FileText, type: 'Date/Time' };
    if (t.includes('boolean')) return { icon: Square, type: 'Yes/No' };
    return { icon: FileText, type: 'Data' };
  };

  const EnhancedEntryCard = ({ entry }) => {
    const config = getEntryTypeConfig(entry.rmType);
    const fieldsData = React.useMemo(() => getFieldsToShow(entry), [entry]);
    const visibleFields = fieldsData.visible;
    const clustered = fieldsData.clustered;
    const cardinality = getCardinalityDisplay(entry);
    const IconComponent = config.icon;
    const [showFields, setShowFields] = React.useState(false);
    const [showOptionsFor, setShowOptionsFor] = React.useState(null);
    const entryKey = String(entry?.nodeId || entry?.id || entry?.name || '');

    const buildDefaultExpandedClusters = React.useCallback((tree) => {
      const expanded = new Set();
      const walk = (node, path = []) => {
        const depth = path.length;
        if (depth > 0 && depth <= 1) {
          expanded.add(path.join('||'));
        }
        for (const child of node?.clusters?.values?.() || []) {
          walk(child, [...path, child.name]);
        }
      };
      walk(tree, []);
      return expanded;
    }, []);

    const [expandedClusters, setExpandedClusters] = React.useState(() => buildDefaultExpandedClusters(clustered));

    React.useEffect(() => {
      // Reset cluster expansion when switching entries
      setExpandedClusters(buildDefaultExpandedClusters(clustered));
      setShowOptionsFor(null);
    }, [entryKey, buildDefaultExpandedClusters, visibleFields.length, clustered?.clusters?.size]);

    const countFieldsDeep = React.useCallback((node) => {
      let count = Array.isArray(node?.fields) ? node.fields.length : 0;
      for (const child of node?.clusters?.values?.() || []) {
        count += countFieldsDeep(child);
      }
      return count;
    }, []);

    const toggleCluster = (pathKey) => {
      setExpandedClusters((prev) => {
        const next = new Set(prev);
        if (next.has(pathKey)) next.delete(pathKey);
        else next.add(pathKey);
        return next;
      });
    };

    const renderFieldRow = (field, indentLevel = 0) => {
      const typeInfo = getFieldTypeInfo(field);
      const FieldIcon = typeInfo.icon;
      const hasOptionsList = field.hasOptions && field.node?.inputs?.[0]?.list;
      const key = String(field.node?.nodeId || field.node?.id || field.path?.join('/') || field.name);

      return (
        <div key={key} className="relative">
          <div
            className="flex items-center justify-between p-2 bg-background border border-theme rounded text-xs"
            style={{ paddingLeft: `${Math.max(0, indentLevel) * 14 + 8}px` }}
          >
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              <FieldIcon size={14} className="text-theme-secondary flex-shrink-0" />
              <span className="font-medium text-theme-primary truncate">{field.name}</span>
              {field.isRequired && <span className="text-error text-xs font-bold">*</span>}
              {field.hasOptions && (
                <button
                  className="bg-info/20 text-info px-2 py-1 rounded text-xs hover:bg-info/30 flex items-center gap-1 transition-colors flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOptionsFor(showOptionsFor === key ? null : key);
                  }}
                >
                  <ChevronDown size={10} />
                  {hasOptionsList ? field.node.inputs[0].list.length : ''} options
                </button>
              )}
            </div>
            <div className="flex items-center space-x-2 text-theme-secondary flex-shrink-0">
              <span className="text-xs font-medium">{typeInfo.type}</span>
              {field.cardinality && (
                <span className="text-xs bg-theme-secondary/20 px-1 py-0.5 rounded font-mono">
                  {field.cardinality}
                </span>
              )}
            </div>
          </div>

          {showOptionsFor === key && hasOptionsList && (
            <div className="mt-1 p-3 bg-surface border border-info/30 rounded">
              <div className="text-xs font-medium text-info mb-2 flex items-center gap-1">
                <ChevronDown size={12} />
                Available Options ({field.node.inputs[0].list.length})
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {field.node.inputs[0].list.map((opt, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs p-1 rounded hover:bg-background/50">
                    <span className="font-mono text-primary bg-primary/10 px-1 rounded flex-shrink-0 text-[10px]">
                      {opt.code}
                    </span>
                    <span className="text-theme-primary">
                      {opt.label && opt.label !== opt.code ? opt.label : opt.code}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    };

    const renderClusterTree = (node, level = 0, path = []) => {
      const clusters = Array.from(node?.clusters?.values?.() || []).sort((a, b) => a.name.localeCompare(b.name));
      const directFields = Array.isArray(node?.fields) ? node.fields.slice().sort((a, b) => a.name.localeCompare(b.name)) : [];

      return (
        <div className="space-y-2">
          {clusters.map((cluster) => {
            const nextPath = [...path, cluster.name];
            const pathKey = nextPath.join('||');
            const expanded = expandedClusters.has(pathKey);
            const fieldCount = countFieldsDeep(cluster);
            return (
              <div key={pathKey} className="space-y-2">
                <button
                  className="w-full flex items-center justify-between p-2 rounded border border-theme bg-surface hover:bg-surface-hover text-xs"
                  style={{ paddingLeft: `${Math.max(0, level) * 14 + 8}px` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCluster(pathKey);
                  }}
                  title="Click to expand/collapse cluster"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-theme-secondary">
                      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <span className="font-medium text-theme-primary truncate">{cluster.name}</span>
                    <span className="px-2 py-0.5 rounded border border-theme/60 bg-theme-secondary/10 text-theme-secondary">
                      CLUSTER
                    </span>
                  </span>
                  <span className="text-theme-secondary">{fieldCount} field{fieldCount === 1 ? '' : 's'}</span>
                </button>

                {expanded && (
                  <div className="space-y-2">
                    {renderClusterTree(cluster, level + 1, nextPath)}
                  </div>
                )}
              </div>
            );
          })}

          {directFields.map((field) => renderFieldRow(field, level))}
        </div>
      );
    };

    return (
      <div className="border border-theme rounded-lg p-3 mb-2 hover:border-primary/50 transition-colors bg-surface">
        <div className="flex items-start space-x-3">
          <IconComponent size={18} className={config.textColor} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <h4 className="font-medium text-theme-primary">
                  {entry.localizedNames?.en || entry.name || "Unnamed Entry"}
                </h4>
                <span className={`px-2 py-0.5 text-xs rounded ${config.bgColor} ${config.textColor} ${config.borderColor} border`}>
                  {config.label}
                </span>
                {cardinality && (
                  <span className="text-xs bg-background text-theme-secondary px-2 py-0.5 rounded border border-theme">
                    {cardinality}
                  </span>
                )}
              </div>

              {visibleFields.length > 0 && (
                <button
                  onClick={() => setShowFields(!showFields)}
                  className="flex items-center space-x-1 text-xs text-theme-secondary hover:text-theme-primary transition-colors"
                >
                  {showFields ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span>{visibleFields.length} field{visibleFields.length !== 1 ? 's' : ''}</span>
                </button>
              )}
            </div>

            {(entry.localizedDescriptions?.en || entry.description) && (
              <p className="text-sm text-theme-secondary mb-3 line-clamp-2">
                {entry.localizedDescriptions?.en || entry.description}
              </p>
            )}

            {showFields && visibleFields.length > 0 && (
              <div className="mb-2 space-y-2">
                {renderClusterTree(clustered, 0, [])}
              </div>
            )}

            {!showFields && visibleFields.length === 0 && (
              <div className="text-xs text-theme-secondary italic">
                No data fields found in this entry
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const EnhancedSectionCard = ({ section }) => {
    const [expanded, setExpanded] = React.useState(true);
    const entries = (section.children || []).filter(child =>
      ['observation', 'evaluation', 'instruction', 'action', 'admin_entry'].includes(child.rmType?.toLowerCase())
    );

    return (
      <div className="border border-theme rounded-lg mb-4 bg-surface">
        <div className="p-4 cursor-pointer hover:bg-background/50 transition-colors" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center space-x-3">
            {expanded ? <ChevronDown size={18} className="text-theme-primary" /> : <ChevronRight size={18} className="text-theme-primary" />}
            <div>
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-semibold text-theme-primary">
                  Section: {section.localizedNames?.en || section.name || "Unnamed Section"}
                </h3>
                <span className="text-xs bg-primary/20 border border-primary text-primary px-2 py-0.5 rounded">
                  {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}
                </span>
              </div>
              {(section.localizedDescriptions?.en || section.description) && (
                <p className="text-sm text-theme-secondary">
                  {section.localizedDescriptions?.en || section.description}
                </p>
              )}
              <code className="text-xs text-theme-secondary bg-background border border-theme px-2 py-1 rounded mt-2 inline-block">
                {section.nodeId || 'No node ID'}
              </code>
            </div>
          </div>
        </div>

        {expanded && entries.length > 0 && (
          <div className="px-4 pb-4">
            <div className="pl-6 border-l-2 border-theme/30">
              {entries.map((entry, idx) => (
                <EnhancedEntryCard key={`${entry.nodeId || entry.id || 'unknown'}-${idx}`} entry={entry} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Clinical purpose (from props.template only)
  const clinicalPurpose = template?.metadata?.description;

  return (
    <div>
      {clinicalPurpose && (
        <div className="bg-primary/10 border-l-4 border-primary pl-3 py-2 mb-4">
          <div className="flex items-center space-x-2 mb-1">
            <Info className="text-primary" size={14} />
            <span className="text-sm font-medium text-primary">Clinical Purpose</span>
          </div>
          <p className="text-theme-primary text-sm">{clinicalPurpose}</p>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-medium text-theme-primary">Template Structure</h4>
          <div className="text-sm text-theme-secondary">
            {sections.length > 0
              ? (<>{sections.length} section{sections.length !== 1 ? 's' : ''} • {' '}
                {sections.reduce((acc, s) => {
                  const count = (s.children || []).filter(child =>
                    ['observation', 'evaluation', 'instruction', 'action', 'admin_entry'].includes(child.rmType?.toLowerCase())
                  ).length;
                  return acc + count;
                }, 0)} total entries</>)
              : (`${rootEntries.length} direct entries`)
            }
          </div>
        </div>

        {sections.length > 0 ? (
          sections.map((section, idx) => (
            <EnhancedSectionCard key={`section-${section.nodeId || section.id || 'unknown'}-${idx}`} section={section} />
          ))
        ) : rootEntries.length > 0 ? (
          <div className="space-y-2">
            <div className="text-theme-secondary text-sm mb-3">This template contains direct entries without sections:</div>
            {rootEntries.map((entry, idx) => (
              <EnhancedEntryCard key={`entry-${entry.nodeId || entry.id || 'unknown'}-${idx}`} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="text-theme-secondary text-center py-4">No entries found in this template.</div>
        )}
      </div>
    </div>
  );
};

// Fullscreen Template Modal
const FullscreenTemplateModal = ({ template, onClose, children }) => {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

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
        <div className="flex items-center justify-between p-4 border-b border-theme bg-background">
          <div className="flex items-center gap-3">
            <File className="text-primary" size={24} />
            <h2 className="text-xl font-bold text-theme-primary">
              {template.name || "Unnamed Template"}
            </h2>
            {template.templateVersion && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                v{template.templateVersion}
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

        {/* Body */}
        <div className="flex-1 overflow-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
};

// Template list item component
const TemplateListItem = ({ template, onDelete, aqlUsage = {} }) => {
  const { getQueriesByTemplateId } = useAQLQueries();
  const [expanded, setExpanded] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showAqlModal, setShowAqlModal] = useState(false);
  const [showFullscreenModal, setShowFullscreenModal] = useState(false);
  const [modalTemplate, setModalTemplate] = useState(null);
  const [relatedAQLs, setRelatedAQLs] = useState([]);
  const relatedAQLsCount = aqlUsage[template._id] || 0;
  const [aqlLoading, setAqlLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("structure");
  const { setActiveTab: setAppActiveTab = () => { } } = React.useContext(QueryBuilderContext);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [optParsed, setOptParsed] = useState(null);
  const [optParsing, setOptParsing] = useState(false);
  const [optParseError, setOptParseError] = useState(null);
  const [showParsedOpt, setShowParsedOpt] = useState(false);
  const [savingAnalytics, setSavingAnalytics] = useState(false);
  const initialTemplate = React.useMemo(() => {
    const cached = getCachedDataModel(template?._id);
    return cached ? { ...template, ...cached } : template;
  }, [template]);
  const [fullTemplate, setFullTemplate] = useState(() => setCachedDataModel(initialTemplate) || initialTemplate);
  const fullTemplateRef = useRef(initialTemplate);
  const optParseRunIdRef = useRef(0);
  const rootTree = fullTemplate?.webTemplate || template?.webTemplate;
  const [copiedItem, setCopiedItem] = useState(null);

  // Keep ref in sync with state
  useEffect(() => {
    fullTemplateRef.current = fullTemplate;
  }, [fullTemplate]);

  useEffect(() => {
    const cached = getCachedDataModel(template?._id);
    const merged = setCachedDataModel(cached ? { ...template, ...cached } : template);
    setFullTemplate(merged);
  }, [template]);

  const hydrated = React.useMemo(() => ({
    hasTree: !!(fullTemplate?.webTemplate && fullTemplate.webTemplate.children?.length),
    hasXml: typeof fullTemplate?.source?.xml === 'string' && fullTemplate.source.xml.length > 0,
  }), [fullTemplate?.webTemplate, fullTemplate?.source?.xml]);

  const md = fullTemplate?.metadata || template?.metadata || {};
  const archs = md.archetypes ?? [];
  const entryArchs = archs.filter(a => a.rmType && a.rmType.toUpperCase() !== 'COMPOSITION');
  const entryRmTypes = Array.from(new Set(entryArchs.map(a => a.rmType)));

  // Reset tabs when component first mounts or when expanding/collapsing
  const handleExpand = async () => {
    const opening = !expanded;
    setExpanded(opening);

    if (opening) {
      // Always default to the left-most tab
      setActiveTab("structure");
      // prefetch structure so the tab has data
      await ensureDetails({ tree: true });
    }
  };

  const loadRelatedAQLs = React.useCallback(async () => {
    if (aqlLoading || relatedAQLs.length) return;
    // Derived from the shared AQL-queries cache — no network call.
    setRelatedAQLs(getQueriesByTemplateId(template._id));
  }, [aqlLoading, relatedAQLs.length, template._id, getQueriesByTemplateId]);

  const handleCopy = async (text, item) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(item);
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  useEffect(() => {
    if (expanded && activeTab === 'aql' && relatedAQLsCount > 0 && relatedAQLs.length === 0 && !aqlLoading) {
      setRelatedAQLs(getQueriesByTemplateId(template._id));
    }
  }, [expanded, activeTab, relatedAQLsCount, relatedAQLs.length, aqlLoading, template._id, getQueriesByTemplateId]);

  // Get sections from template structure
  const sections = (rootTree?.children || []).filter(
    (child) => child.rmType && child.rmType.toLowerCase().includes('section')
  );

  const rootEntries = (rootTree?.children || []).filter(c =>
    ['observation', 'evaluation', 'instruction', 'action', 'admin_entry']
      .includes(c.rmType?.toLowerCase())
  );

  const ensureDetails = React.useCallback(async (what = { tree: false }) => {
    const current = fullTemplateRef.current;
    const needTree = what.tree && !(current?.webTemplate?.children?.length);
    const needXml = what.xml && !(typeof current?.source?.xml === 'string' && current.source.xml.length > 0);
    if (!needTree && !needXml) {
      return current;
    }

    try {
      setDetailsLoading(true);
      const include = [needTree ? 'tree' : null, needXml ? 'xml' : null].filter(Boolean);
      const updatedTemplate = await fetchDataModelDetail(template._id, {
        include,
        seedModel: current,
      });

      setFullTemplate(updatedTemplate);

      return updatedTemplate;
    } catch (e) {
      console.error(e);
      return fullTemplateRef.current;
    } finally {
      setDetailsLoading(false);
    }
  }, [template._id]);

  // Automatically open the structure tab by default
  useEffect(() => {
    if (!expanded) return;

    if (activeTab === 'structure' && !(fullTemplate?.webTemplate?.children?.length)) {
      ensureDetails({ tree: true });
    }
  }, [activeTab, ensureDetails, expanded, fullTemplate?.webTemplate?.children?.length]);

  const hasOpt = (fullTemplate?.source?.type || template?.source?.type) === 'opt';
  const optXml = fullTemplate?.source?.xml || null;

  useEffect(() => {
    if (!expanded) return;
    if (activeTab !== 'opt') return;
    if (!hasOpt) return;
    if (hydrated.hasXml) return;
    ensureDetails({ xml: true });
  }, [activeTab, ensureDetails, expanded, hasOpt, hydrated.hasXml]);

  useEffect(() => {
    // Reset OPT parse state per template
    setOptParsed(null);
    setOptParseError(null);
    setOptParsing(false);
    setShowParsedOpt(false);
    optParseRunIdRef.current += 1; // invalidate any in-flight parse
  }, [template._id]);

  const handleParseOpt = async () => {
    if (optParsing) return;

    // Make sure the XML is loaded first.
    if (!hydrated.hasXml) {
      await ensureDetails({ xml: true });
    }
    const xml = (fullTemplateRef.current?.source?.xml || fullTemplate?.source?.xml || optXml || '');
    if (!xml) return;

    const runId = ++optParseRunIdRef.current;
    const timeoutMs = 8000;

    try {
      setOptParsing(true);
      setOptParseError(null);
      setShowParsedOpt(true);

      const { parseStringPromise } = await import('xml2js');
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Parsing timed out')), timeoutMs)
      );

      const parsed = await Promise.race([
        parseStringPromise(xml, {
          explicitArray: false,
          attrkey: '@',
          charkey: '#text',
          trim: true,
        }),
        timeoutPromise
      ]);

      if (optParseRunIdRef.current !== runId) return; // cancelled/superseded
      setOptParsed(parsed);
    } catch (e) {
      if (optParseRunIdRef.current !== runId) return;
      setOptParsed(null);
      setOptParseError(e?.message || 'Failed to parse OPT XML');
    } finally {
      if (optParseRunIdRef.current === runId) setOptParsing(false);
    }
  };

  const handleCancelOptParse = () => {
    // We cannot abort xml2js parsing, but we can ignore the eventual result.
    optParseRunIdRef.current += 1;
    setOptParsing(false);
    setOptParseError('Parsing cancelled');
    setOptParsed(null);
    setShowParsedOpt(false);
  };


  // Handle delete
  const handleDelete = () => {
    setShowConfirmDelete(true);
  };

  // Confirm delete
  const confirmDelete = () => {
    invalidateDataModelCache(template._id);
    onDelete(template._id);
    setShowConfirmDelete(false);
  };

  // Cancel delete
  const cancelDelete = () => {
    setShowConfirmDelete(false);
  };

  // Save analytics configuration
  const handleSaveAnalytics = async (analyticsTemplate) => {
    try {
      setSavingAnalytics(true);
      const res = await fetch(`/api/data-model-catalog/${template._id}/analytics`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analyticsTemplate })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save analytics configuration');
      }

      const updatedTemplate = await res.json();

      // Update local state with the new analytics template
      const mergedTemplate = {
        ...fullTemplateRef.current,
        analyticsTemplate: updatedTemplate.analyticsTemplate
      };
      setFullTemplate(mergedTemplate);
      setCachedDataModel(mergedTemplate);

      // Also update modal template if open
      if (modalTemplate) {
        setModalTemplate(prev => ({
          ...prev,
          analyticsTemplate: updatedTemplate.analyticsTemplate
        }));
      }
    } catch (error) {
      console.error('Error saving analytics:', error);
      alert(`Failed to save analytics configuration: ${error.message}`);
    } finally {
      setSavingAnalytics(false);
    }
  };

  // Navigate to AQL Management and open the editor for a specific query
  const navigateToAQLEditor = (aqlId) => {
    try {
      // Try to navigate using the context function
      setAppActiveTab('queryManagement');

      // Store ID in session storage
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('openAqlId', aqlId);
      }

      // Close the modal
      setShowAqlModal(false);
    } catch (error) {
      console.warn('Error navigating to AQL editor:', error);
      // Fallback navigation if context function fails
      if (typeof window !== 'undefined') {
        window.location.href = `/query-management?id=${aqlId}`;
      }
    }
  };

  const isEntry = (n) =>
    ['observation', 'evaluation', 'instruction', 'action', 'admin_entry']
      .includes((n?.rmType || '').toLowerCase());

  const renderEntryPill = (child, idx) => {
    const rmType = (child.rmType || "").toLowerCase();
    let IconComponent = Square;
    let label = "ELEMENT";
    let colorClasses = "text-theme-secondary border-theme";

    if (rmType.includes("evaluation")) { IconComponent = ClipboardList; label = "EVALUATION"; colorClasses = "text-primary border-primary"; }
    else if (rmType.includes("instruction")) { IconComponent = AlertCircle; label = "INSTRUCTION"; colorClasses = "text-warning border-warning"; }
    else if (rmType.includes("observation")) { IconComponent = Activity; label = "OBSERVATION"; colorClasses = "text-primary border-primary"; }
    else if (rmType.includes("action")) { IconComponent = PlayCircle; label = "ACTION"; colorClasses = "text-success border-success"; }
    else if (rmType.includes("admin")) { IconComponent = ShieldAlert; label = "ADMIN_ENTRY"; colorClasses = "text-error border-error"; }

    return (
      <div
        key={`entry-${child.nodeId || child.id || 'unknown'}-${idx}`}
        className={`border rounded px-1 py-0.5 inline-flex items-center gap-1 m-1 ${colorClasses}`}
      >
        <IconComponent size={14} />
        <span className="text-xs">{label}</span>
        <span className="text-xs text-theme-secondary">
          {child.nodeId ? `${child.name || child.localizedName || ''}` : ""}
        </span>
      </div>
    );
  };

  // breadth-first: first level where entries exist
  const findShallowEntries = React.useCallback((root) => {
    if (!root) return [];
    const children = Array.isArray(root.children) ? root.children : [];

    const level1 = children.filter(isEntry);
    if (level1.length) return level1;

    let frontier = children.filter(c => !isEntry(c));
    while (frontier.length) {
      const next = [];
      const found = [];
      for (const n of frontier) {
        const ch = Array.isArray(n.children) ? n.children : [];
        for (const c of ch) {
          if (isEntry(c)) found.push(c);
          else next.push(c);
        }
      }
      if (found.length) return found;
      frontier = next;
    }
    return [];
  }, []);

  const shallowEntries = React.useMemo(
    () => findShallowEntries(rootTree),
    [findShallowEntries, rootTree]
  );

  return (
    <div className="surface border border-theme rounded-lg p-4">
      {/* Header - Always Visible */}
      <div className="flex justify-between items-start">
        {/* Domain icon */}
        <div className="flex-shrink-0 mr-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #00a99d15 0%, #00a99d08 100%)',
              border: '1.5px solid #00a99d30'
            }}
          >
            <img
              src="/images/openehr.png"
              alt="openEHR icon"
              className="w-8 h-8 object-contain"
            />
          </div>
        </div>

        <div
          className="flex-1 cursor-pointer"
          onMouseEnter={() => !hydrated.hasTree && !detailsLoading && ensureDetails({ tree: true })}
          onClick={handleExpand}
        >
          {/* Domain chip - aligned with title */}
          <div className="mb-2">
            <span
              className="inline-block px-2.5 py-1 text-xs font-medium rounded-md"
              style={{
                backgroundColor: '#00a99d20',
                color: '#00a99d',
                border: '1px solid #00a99d40'
              }}
            >
              openEHR®
            </span>
          </div>

          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-theme-primary">{template.name || "Unnamed Template"}</h3>
            {template.templateVersion && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                v{template.templateVersion}
              </span>
            )}

            {/* Badge for related AQLs */}
            {relatedAQLsCount > 0 && (
              <span
                className="text-xs bg-success/20 text-success px-2 py-0.5 rounded-full flex items-center gap-1 cursor-pointer hover:bg-success/30"
                onClick={(e) => {
                  e.stopPropagation();
                  if (relatedAQLs.length === 0) loadRelatedAQLs();
                  setShowAqlModal(true);
                }}
              >
                <FileSpreadsheet size={12} />
                {relatedAQLsCount} AQL{relatedAQLsCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Header badges */}
          <div className="text-sm text-theme-secondary mt-1">
            <div className="flex flex-wrap gap-4">
              <div>
                Created: {(template.audit?.createdAt)
                  ? new Date(template.audit?.createdAt).toLocaleDateString()
                  : "Unknown date"}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-theme-secondary">Composition:</span>
                <span className="text-theme-primary">{rootTree?.nodeId ?? '—'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-theme-secondary">RM Type:</span>
                <span className="text-theme-primary">{rootTree?.rmType ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Template description */}
          {(fullTemplate?.metadata?.description || template?.metadata?.description) && (
            <p className="mt-3 text-sm text-theme-primary leading-relaxed">
              {fullTemplate?.metadata?.description || template?.metadata?.description}
            </p>
          )}

          {/* Metadata badges */}
          {(() => {
            const md = fullTemplate?.metadata || template?.metadata || {};
            return (
              <div className="mt-2 flex flex-wrap gap-2">
                {md.templateId && (
                  <span className="px-2 py-0.5 text-xs rounded border border-theme text-theme-secondary">
                    Template ID: <span className="text-theme-primary">{md.templateId}</span>
                  </span>
                )}
                {md.compositionKind && (
                  <span className="px-2 py-0.5 text-xs rounded border border-theme text-theme-secondary">
                    Kind: <span className="text-theme-primary">{md.compositionKind}</span>
                  </span>
                )}
                {entryRmTypes.length > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded border border-theme text-theme-secondary">
                    Entry RM types:{" "}
                    <span className="text-theme-primary">
                      {entryRmTypes.slice(0, 3).join(", ")}
                      {entryRmTypes.length > 3 ? ` +${entryRmTypes.length - 3}` : ""}
                    </span>
                  </span>
                )}
                {md.languages?.length > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded border border-theme text-theme-secondary">
                    Lang:{" "}
                    <span className="text-theme-primary">
                      {md.languages.slice(0, 3).join(", ")}
                      {md.languages.length > 3 ? ` +${md.languages.length - 3}` : ""}
                    </span>
                  </span>
                )}
                {md.terminologies?.length > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded border border-theme text-theme-secondary">
                    Terminologies:{" "}
                    <span className="text-theme-primary">
                      {md.terminologies.slice(0, 3).join(", ")}
                      {md.terminologies.length > 3 ? ` +${md.terminologies.length - 3}` : ""}
                    </span>
                  </span>
                )}
                {md.datatypes?.length > 0 && (
                  <span className="px-2 py-0.5 text-xs rounded border border-theme text-theme-secondary">
                    Datatypes: <span className="text-theme-primary">{md.datatypes.length}</span>
                  </span>
                )}
              </div>
            );
          })()}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              try {
                const loadedTemplate = await ensureDetails({ tree: true });
                setModalTemplate(loadedTemplate);
                setShowFullscreenModal(true);
              } catch (err) {
                console.error('Error loading template for fullscreen:', err);
                // Fallback to current template data
                setModalTemplate(fullTemplate);
                setShowFullscreenModal(true);
              }
            }}
            className="p-1 text-theme-secondary hover:text-primary"
            title="Open in fullscreen"
          >
            <Maximize2 size={20} />
          </button>
          <button
            onClick={handleExpand}
            className="p-1 text-theme-secondary hover:text-theme-primary"
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="p-1 text-theme-secondary hover:text-error"
            title="Delete template"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* Expanded Content with Tabs - FULL WIDTH */}
      {expanded && (
        <div className="mt-4 pt-4 border-t border-theme">
          <h3 className="text-lg font-medium text-theme-primary mb-3 flex items-center gap-2">
            Template Structure
            <span className="text-xs text-theme-secondary">
              • {entryRmTypes.length} entry RM type{entryRmTypes.length === 1 ? "" : "s"}
              {" "}• {archs.length} archetype{archs.length === 1 ? "" : "s"}
              {" "}• {(md.datatypes || []).length} data type{(md.datatypes || []).length === 1 ? "" : "s"}
            </span>
          </h3>

          <Tabs defaultValue="structure" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="structure">Structure</TabsTrigger>
              <TabsTrigger value="mindmap">Mind Map</TabsTrigger>
              <TabsTrigger value="tree">Tree View</TabsTrigger>
              <TabsTrigger value="json">WebTemplate</TabsTrigger>
              {hasOpt && <TabsTrigger value="opt">OPT</TabsTrigger>}
              <TabsTrigger value="analytics" className="flex items-center gap-1">
                <BarChart2 size={14} />
                Analytics
              </TabsTrigger>
              {relatedAQLsCount > 0 && (
                <TabsTrigger value="aql" className="flex items-center gap-1">
                  <FileSpreadsheet size={14} />
                  Related AQLs ({relatedAQLsCount})
                </TabsTrigger>
              )}
            </TabsList>

            {/* Structure Tab */}
            <TabsContent value="structure" className="mt-0">
              <div className="bg-background rounded-lg p-4 border border-theme">
                {detailsLoading && !hydrated.hasTree ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="animate-spin mr-2" /> Loading structure…
                  </div>
                ) : (
                  <EnhancedStructureDisplay
                    template={fullTemplate}
                    sections={sections}
                    rootEntries={shallowEntries}
                  />
                )}
              </div>
            </TabsContent>

            {/* Mind Map Tab */}
            <TabsContent value="mindmap" className="mt-0">
              <div className="bg-background rounded-lg border border-theme" style={{ height: '500px' }}>
                {activeTab === 'mindmap' && (
                  detailsLoading && !rootTree ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="animate-spin mr-2" /> Loading mind map…
                    </div>
                  ) : rootTree ? (
                    <MindMap
                      data={rootTree}
                      title={template.name || 'Template Structure'}
                      onNodeSelect={(node) => {
                        console.log('Selected node:', node);
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-theme-secondary">
                      No structure loaded yet.
                    </div>
                  )
                )}
              </div>
            </TabsContent>

            {/* Tree View Tab */}
            <TabsContent value="tree" className="mt-0">
              <div className="bg-background rounded-lg p-2 border border-theme">
                <div className="flex items-center surface p-2 text-xs text-theme-secondary rounded-t sticky top-0 z-10">
                  <div className="flex-1">Node</div>
                  <div className="w-28 text-center">Type</div>
                  <div className="w-20 text-center">Cardinality</div>
                  <div className="w-80">Node ID</div>
                  <div className="w-10"></div>
                </div>

                <div style={{ maxHeight: '400px', overflowY: 'auto' }} className="border-t border-theme">
                  {activeTab === 'tree' && (
                    detailsLoading && !rootTree ? (
                      <div className="p-4 flex items-center">
                        <Loader2 className="animate-spin mr-2" /> Loading structure…
                      </div>
                    ) : rootTree ? (
                      <TreeView node={rootTree} defaultExpanded={false} />
                    ) : (
                      <div className="p-4 text-theme-secondary">No structure loaded yet.</div>
                    )
                  )}
                </div>
              </div>
            </TabsContent>

            {/* JSON Tab */}
            <TabsContent value="json" className="mt-0">
              {activeTab === 'json' && (
                detailsLoading && !rootTree ? (           // <-- was checking .webTemplate?.tree
                  <div className="flex items-center p-4">
                    <Loader2 className="animate-spin mr-2" /> Loading JSON…
                  </div>
                ) : (
                    <CodeViewer
                      value={JSON.stringify(rootTree, null, 2)} // keep it simple; the tree itself
                      language="json"
                      readOnly
                      height={400}
                      fileName={`${template.name}-structure.json`}
                      allowFormat={false}
                    />
                )
              )}
            </TabsContent>

            {/* OPT Tab */}
            {hasOpt && (
              <TabsContent value="opt" className="mt-0">
                <div className="bg-background rounded-lg p-4 border border-theme space-y-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm font-medium text-theme-primary">Raw OPT (XML)</div>
                    <div className="flex items-center gap-2">
                      {!hydrated.hasXml ? (
                        <span className="inline-flex items-center text-sm text-theme-secondary">
                          <Loader2 className="animate-spin mr-2" size={16} />
                          Loading…
                        </span>
                      ) : optParsing ? (
                        <button
                          onClick={handleCancelOptParse}
                          className="px-3 py-1.5 rounded text-xs border border-theme surface hover:border-primary/50 transition-all"
                          title="Stop parsing"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          onClick={handleParseOpt}
                          className="px-3 py-1.5 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                          title="Parse OPT to show a visualization (may be slow for large files)"
                        >
                          Parse (Optional)
                        </button>
                      )}
                      {showParsedOpt && !optParsing && (
                        <button
                          onClick={() => setShowParsedOpt(false)}
                          className="px-3 py-1.5 rounded text-xs border border-theme surface hover:border-primary/50 transition-all"
                        >
                          Hide Parsed
                        </button>
                      )}
                    </div>
                  </div>

                  {typeof optXml === 'string' && optXml.length > 0 ? (
                    <CodeViewer
                      value={optXml}
                      language="xml"
                      readOnly
                      height={520}
                      fileName={`${template.name || 'template'}.opt.xml`}
                      allowFormat={false}
                    />
                  ) : (
                    <div className="flex items-center justify-center py-10 text-theme-secondary">
                      No OPT XML available.
                    </div>
                  )}

                  {hydrated.hasXml && (optParseError || optParsing || (showParsedOpt && optParsed)) && (
                    <div className="rounded-lg border border-theme bg-surface p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-theme-primary">Parsed OPT (Preview)</div>
                        {optParsing && (
                          <div className="inline-flex items-center text-sm text-theme-secondary">
                            <Loader2 className="animate-spin mr-2" size={16} />
                            Parsing…
                          </div>
                        )}
                      </div>

                      {optParseError && (
                        <div className="rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">
                          {optParseError}
                        </div>
                      )}

                      {showParsedOpt && optParsed && !optParseError && (
                        <JsonTree data={optParsed || {}} rootName="OPT" defaultExpandedDepth={1} maxHeight="420px" />
                      )}
                    </div>
                  )}
                </div>
              </TabsContent>
            )}

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="mt-0">
              <div className="bg-background rounded-lg p-4 border border-theme" style={{ minHeight: '500px' }}>
                {activeTab === 'analytics' && (
                  <AnalyticsTab
                    template={fullTemplate}
                    onSave={handleSaveAnalytics}
                    saving={savingAnalytics}
                  />
                )}
              </div>
            </TabsContent>

            {/* Related AQLs Tab */}
            {relatedAQLsCount > 0 && (
              <TabsContent value="aql" className="mt-0">
                <div className="bg-background rounded-lg p-4 border border-theme">
                  {aqlLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="animate-spin text-theme-primary" size={24} />
                      <span className="ml-2 text-theme-primary">Loading related AQLs...</span>
                    </div>
                  ) : relatedAQLs.length === 0 ? (
                    <div className="text-theme-secondary text-center py-4">
                      No related AQL queries found.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {relatedAQLs.map((aql) => (
                        <div key={aql._id} className="surface border border-theme hover:border-primary rounded-md p-3 transition-colors">
                          <div className="flex justify-between items-center">
                            <h4 className="text-theme-primary font-medium">
                              {aql.name || "Unnamed Query"}
                            </h4>
                            <button
                              onClick={() => navigateToAQLEditor(aql._id)}
                              className="text-primary hover:opacity-80 text-sm flex items-center gap-1"
                            >
                              <ExternalLink size={14} />
                              Open in Editor
                            </button>
                          </div>
                          {aql.description && (
                            <p className="text-theme-secondary text-sm mt-1">{aql.description}</p>
                          )}
                          {aql.aql && (
                            <div className="mt-2 p-2 bg-background rounded border border-theme text-xs font-mono text-theme-primary max-h-32 overflow-y-auto">
                              {aql.aql}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      )}

      {/* Related AQLs Modal */}
      {showAqlModal && (
        <RelatedAQLsModal
          templateName={template.name || "Unnamed Template"}
          relatedAQLs={relatedAQLs}
          loading={aqlLoading}
          onClose={() => setShowAqlModal(false)}
          onViewQuery={navigateToAQLEditor}
        />
      )}

      {/* Confirm Delete Modal */}
      {showConfirmDelete && (
        <ConfirmationModal
          title={relatedAQLsCount > 0 ? "Warning: Template In Use" : "Confirm Deletion"}
          message={`Are you sure you want to delete the template "${template.name || 'this template'}"? This action cannot be undone.
            ${relatedAQLsCount > 0 ? `Warning: This template is used by ${relatedAQLsCount} AQL quer${relatedAQLsCount === 1 ? 'y' : 'ies'}.` : ''}
            `}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}

      {/* Fullscreen Template Modal */}
      {showFullscreenModal && modalTemplate && (
        <FullscreenTemplateModal
          template={modalTemplate}
          onClose={() => {
            setShowFullscreenModal(false);
            setModalTemplate(null);
          }}
        >
          {(() => {
            // Use the loaded modal template data
            const modalRootTree = modalTemplate?.webTemplate;
            const modalSections = (modalRootTree?.children || []).filter(
              (child) => child.rmType && child.rmType.toLowerCase().includes('section')
            );
            const modalRootEntries = (modalRootTree?.children || []).filter(c =>
              ['observation', 'evaluation', 'instruction', 'action', 'admin_entry']
                .includes(c.rmType?.toLowerCase())
            );
            const modalShallowEntries = findShallowEntries(modalRootTree);

            return (
              <Tabs defaultValue="structure" className="h-full flex flex-col">
              <TabsList className="mb-4 flex-shrink-0">
                <TabsTrigger value="structure">Structure</TabsTrigger>
                <TabsTrigger value="mindmap">Mind Map</TabsTrigger>
                <TabsTrigger value="tree">Tree View</TabsTrigger>
                <TabsTrigger value="json">WebTemplate</TabsTrigger>
                {(modalTemplate?.source?.type || template?.source?.type) === 'opt' && (
                  <TabsTrigger value="opt">OPT</TabsTrigger>
                )}
                <TabsTrigger value="analytics" className="flex items-center gap-1">
                  <BarChart2 size={14} />
                    Analytics
                  </TabsTrigger>
                </TabsList>

                <div className="flex-1 overflow-hidden">
                  {/* Structure Tab */}
                  <TabsContent value="structure" className="mt-0 h-full overflow-auto">
                    <div className="bg-background rounded-lg p-4 border border-theme">
                      {detailsLoading && !modalRootTree ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="animate-spin mr-2" /> Loading structure…
                        </div>
                      ) : modalRootTree ? (
                        <EnhancedStructureDisplay
                          template={modalTemplate}
                          sections={modalSections}
                          rootEntries={modalShallowEntries}
                        />
                      ) : (
                        <div className="flex items-center justify-center py-4 text-theme-secondary">
                          No structure data available.
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Mind Map Tab */}
                  <TabsContent value="mindmap" className="mt-0 h-full">
                    <div className="bg-background rounded-lg border border-theme h-full">
                      {detailsLoading && !modalRootTree ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="animate-spin mr-2" /> Loading mind map…
                        </div>
                      ) : modalRootTree ? (
                        <MindMap
                          data={modalRootTree}
                          title={modalTemplate.name || 'Template Structure'}
                          onNodeSelect={(node) => {
                            console.log('Selected node:', node);
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full text-theme-secondary">
                          No structure loaded yet.
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Tree View Tab */}
                  <TabsContent value="tree" className="mt-0 h-full overflow-auto">
                    <div className="bg-background rounded-lg p-2 border border-theme">
                      <div className="flex items-center surface p-2 text-xs text-theme-secondary rounded-t sticky top-0 z-10">
                        <div className="flex-1">Node</div>
                        <div className="w-28 text-center">Type</div>
                        <div className="w-20 text-center">Cardinality</div>
                        <div className="w-80">Node ID</div>
                        <div className="w-10"></div>
                      </div>
                      <div className="border-t border-theme">
                        {detailsLoading && !modalRootTree ? (
                          <div className="p-4 flex items-center">
                            <Loader2 className="animate-spin mr-2" /> Loading structure…
                          </div>
                        ) : modalRootTree ? (
                          <TreeView node={modalRootTree} defaultExpanded={false} />
                        ) : (
                          <div className="p-4 text-theme-secondary">No structure loaded yet.</div>
                        )}
                      </div>
                    </div>
                  </TabsContent>

                  {/* JSON Tab */}
                  <TabsContent value="json" className="mt-0 h-full">
                    {detailsLoading && !modalRootTree ? (
                      <div className="flex items-center p-4">
                        <Loader2 className="animate-spin mr-2" /> Loading JSON…
                      </div>
                    ) : modalRootTree ? (
                      <CodeViewer
                        value={JSON.stringify(modalRootTree, null, 2)}
                        language="json"
                        readOnly
                        height="100%"
                        fileName={`${modalTemplate.name}-structure.json`}
                        allowFormat={false}
                      />
                    ) : (
                      <div className="flex items-center p-4 text-theme-secondary">
                        No data available.
                      </div>
                    )}
                  </TabsContent>

                  {/* OPT Tab (fullscreen) */}
                  {(modalTemplate?.source?.type || template?.source?.type) === 'opt' && (
                    <TabsContent value="opt" className="mt-0 h-full overflow-auto">
                      <div className="bg-background rounded-lg p-4 border border-theme space-y-4">
                        <p className="text-sm text-theme-secondary">
                          OPT visualization requires loading the raw OPT XML.
                        </p>
                        <button
                          onClick={async () => {
                            try {
                              const loaded = await fetchDataModelDetail(template._id, {
                                include: ['xml'],
                                seedModel: modalTemplate,
                              });
                              setModalTemplate(loaded);
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                          className="px-3 py-2 rounded bg-primary/10 text-primary hover:bg-primary/20 text-sm inline-flex items-center gap-2"
                        >
                          Load OPT XML
                          <ExternalLink size={14} />
                        </button>

                        {typeof modalTemplate?.source?.xml === 'string' && modalTemplate.source.xml.length > 0 && (
                          <CodeViewer
                            value={modalTemplate.source.xml}
                            language="xml"
                            readOnly
                            height={520}
                            fileName={`${modalTemplate.name || 'template'}.opt.xml`}
                            allowFormat={false}
                          />
                        )}
                      </div>
                    </TabsContent>
                  )}

                  {/* Analytics Tab */}
                  <TabsContent value="analytics" className="mt-0 h-full overflow-auto">
                    <div className="bg-background rounded-lg p-4 border border-theme h-full">
                      <AnalyticsTab
                        template={modalTemplate}
                        onSave={handleSaveAnalytics}
                        saving={savingAnalytics}
                      />
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            );
          })()}
        </FullscreenTemplateModal>
      )}
    </div>
  );
};

// Root component for TemplateList
const OpenEHRTemplateList = ({ templates, templateGroups, groupingMode, expandedGroups, onDelete, onToggleGroupExpansion, aqlUsage = {} }) => {
  // If using grouping mode
  if (groupingMode !== 'none' && templateGroups) {
    return (
      <div className="space-y-4">
        {Object.keys(templateGroups)
          .sort((a, b) => a.localeCompare(b))
          .map((groupKey) => {
            const templatesInGroup = templateGroups[groupKey];
            const isExpanded = expandedGroups[groupKey] !== false; // Default to expanded
            const templateCount = templatesInGroup.length;

            return (
              <div key={groupKey} className="surface border border-theme rounded-lg overflow-hidden">
                {/* Group Header */}
                <div
                  className="p-4 surface-hover cursor-pointer flex items-center justify-between"
                  onClick={() => onToggleGroupExpansion(groupKey)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    <h3 className="font-semibold text-theme-primary">{groupKey}</h3>
                    <span className="text-sm text-theme-secondary">
                      ({templateCount} template{templateCount !== 1 ? 's' : ''})
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-theme divide-y divide-[var(--color-border)]">
                    {templatesInGroup.map((t) => (
                      <div key={t._id} className="p-4">
                        <TemplateListItem
                          template={t}
                          onDelete={onDelete}
                          aqlUsage={aqlUsage}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {templates.map((t) => (
        <TemplateListItem
          key={t._id}
          template={t}
          onDelete={onDelete}
          aqlUsage={aqlUsage}
        />
      ))}
    </div>
  );
};

// PropTypes
OpenEHRTemplateList.propTypes = {
  templates: PropTypes.array.isRequired,
  templateGroups: PropTypes.object,
  groupingMode: PropTypes.string,
  expandedGroups: PropTypes.object,
  onDelete: PropTypes.func.isRequired,
  onToggleGroupExpansion: PropTypes.func,
  aqlUsage: PropTypes.object
};

SectionCard.propTypes = {
  section: PropTypes.object.isRequired,
};

TemplateListItem.propTypes = {
  template: PropTypes.object.isRequired,
  onDelete: PropTypes.func.isRequired,
  aqlUsage: PropTypes.object
};

export default OpenEHRTemplateList;
