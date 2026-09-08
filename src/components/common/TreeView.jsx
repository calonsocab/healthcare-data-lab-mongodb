// src/app/components/common/TreeView.jsx
"use client";

import React, { useMemo, useState } from "react";
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Square, Circle,
  Activity, ClipboardList, AlertCircle, PlayCircle, ShieldAlert, Type, Calendar,
  ToggleLeft, List, Hash, MapPin, User, Globe, Settings, Package, Layers,
  Database, Clock
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*                         Template parsing & lookups                       */
/* ------------------------------------------------------------------ */

const text = (el) => (el ? el.textContent?.trim() || "" : "");
const lc = (s) => (s || "").toLowerCase();

const buildLookupsFromTemplate = (template, preferredLang = "en") => {
  if (!template) {
    return {
      terms: {},
      slots: {},
      ordinals: {},
      countRanges: {},
      protocolChildren: {}, // OBS archetype id -> [{ archId, elements:[{code,dv}] }]
    };
  }

  let doc;
  try {
    doc = new DOMParser().parseFromString(template, "text/xml");
  } catch {
    return {
      terms: {},
      slots: {},
      ordinals: {},
      countRanges: {},
      protocolChildren: {},
    };
  }

  const ensure = (obj, k) => (obj[k] ??= {});

  const terms = {};
  const slots = {};
  const ordinals = {};
  const countRanges = {};
  const protocolChildren = {};

  const addTerms = (arch, termDefsEl) => {
    if (!arch || !termDefsEl) return;
    termDefsEl.querySelectorAll(':scope > items[code]').forEach((it) => {
      const code = it.getAttribute("code");
      const t = text(it.querySelector('items[id="text"]'));
      if (code && t) ensure(terms, arch)[code] = t;
    });
  };

  // component_ontologies with term_definitions (multi-language)
  doc.querySelectorAll("component_ontologies[archetype_id]").forEach((co) => {
    const arch = co.getAttribute("archetype_id");
    const defs = Array.from(co.querySelectorAll(":scope > term_definitions"));
    const chosen =
      defs.find((d) => d.getAttribute("language") === preferredLang) ||
      defs[0];
    if (arch && chosen) addTerms(arch, chosen);
  });

  // ontology for the template's own archetype
  doc.querySelectorAll("ontology[archetype_id]").forEach((ont) => {
    const arch = ont.getAttribute("archetype_id");
    const defs = Array.from(ont.querySelectorAll(":scope > term_definitions"));
    const chosen =
      defs.find((d) => d.getAttribute("language") === preferredLang) ||
      defs[0];
    if (arch && chosen) addTerms(arch, chosen);
  });

  // fallback: term_definitions grouped where an archetype_id/value appears
  doc.querySelectorAll("archetype_id > value").forEach((v) => {
    const arch = text(v);
    const container = v.parentElement?.parentElement;
    if (!arch || !container) return;
    container
      .querySelectorAll(':scope > term_definitions[code]')
      .forEach((td) => addTerms(arch, td));
  });

  // ARCHETYPE_SLOT includes → show slot patterns
  doc.querySelectorAll("archetype_id > value").forEach((v) => {
    const arch = text(v);
    const container = v.parentElement?.parentElement;
    if (!arch || !container) return;
    container
      .querySelectorAll('children[xsi\\:type="ARCHETYPE_SLOT"]')
      .forEach((slotEl) => {
        const code =
          slotEl.getAttribute("node_id") ||
          text(slotEl.querySelector(":scope > node_id"));
        if (!code) return;
        const inc = [];
        slotEl.querySelectorAll(":scope > includes").forEach((incEl) => {
          const se = text(incEl.querySelector(":scope > string_expression"));
          if (se) inc.push(se);
          const pat = text(incEl.querySelector(":scope pattern"));
          if (pat) inc.push(pat);
        });
        if (inc.length) ensure(slots, arch)[code] = inc;
      });
  });

  // DV_ORDINAL choices (code → [{value,label}]) per archetype
  doc.querySelectorAll("archetype_id > value").forEach((v) => {
    const arch = text(v);
    const root = v.parentElement?.parentElement;
    if (!arch || !root) return;
    root.querySelectorAll(":scope C_COMPLEX_OBJECT > node_id").forEach((nid) => {
      const elCode = text(nid);
      if (!/^at\d+$/i.test(elCode)) return;
      const elementCO = nid.parentElement; // the C_COMPLEX_OBJECT of ELEMENT
      if (!elementCO) return;
      const ord = elementCO.querySelector("C_DV_ORDINAL");
      if (!ord) return;
      const choices = [];
      ord.querySelectorAll(":scope > list").forEach((li) => {
        const value = text(li.querySelector(":scope > value"));
        const codeStr = text(li.querySelector(":scope code_string"));
        const label = ensure(terms, arch)[codeStr] || codeStr;
        if (value !== "") choices.push({ value, label });
      });
      if (choices.length) ensure(ordinals, arch)[elCode] = choices;
    });
  });

  // DV_COUNT ranges per element code
  doc.querySelectorAll("archetype_id > value").forEach((v) => {
    const arch = text(v);
    const root = v.parentElement?.parentElement;
    if (!arch || !root) return;
    root.querySelectorAll(":scope C_COMPLEX_OBJECT > node_id").forEach((nid) => {
      const elCode = text(nid);
      if (!/^at\d+$/i.test(elCode)) return;
      const elementCO = nid.parentElement; // element container
      if (!elementCO) return;
      const rangeEl = elementCO.querySelector(
        'item[xsi\\:type="C_INTEGER"] > range'
      );
      if (!rangeEl) return;
      const lower = text(rangeEl.querySelector(":scope > lower"));
      const upper = text(rangeEl.querySelector(":scope > upper"));
      if (lower !== "" && upper !== "") {
        ensure(countRanges, arch)[elCode] = {
          min: Number(lower),
          max: Number(upper),
        };
      }
    });
  });

  // Protocol clusters under OBSERVATION archetypes (e.g., HADS)
  // We store: protocolChildren[obsArch] = [{ archId, elements:[{code,dv}] }]
  doc.querySelectorAll("archetype_id > value").forEach((v) => {
    const obsArch = text(v);
    const root = v.parentElement?.parentElement;
    if (!obsArch || !root) return;

    // Look for protocol attribute inside this archetype container
    const protoAttr = Array.from(
      root.querySelectorAll("attributes")
    ).find((a) => text(a.querySelector(":scope > rm_attribute_name")) === "protocol");

    if (!protoAttr) return;

    const found = [];

    protoAttr
      .querySelectorAll('children[xsi\\:type="C_ARCHETYPE_ROOT"]')
      .forEach((car) => {
        const archId = text(car.querySelector(":scope archetype_id > value"));
        if (!archId) return;

        // Element codes + DV types inside this cluster
        const elements = [];
        car
          .querySelectorAll(':scope C_COMPLEX_OBJECT > rm_type_name')
          .forEach((rt) => {
            if (text(rt) !== "ELEMENT") return;
            const elemCO = rt.parentElement;
            const code = text(elemCO.querySelector(":scope > node_id"));
            if (!code) return;
            // detect DV type in this element
            let dv = "DV_TEXT";
            const dvRt = elemCO.querySelector(
              ':scope attributes C_COMPLEX_OBJECT > rm_type_name'
            );
            if (dvRt) dv = text(dvRt) || dv;
            elements.push({ code, dv });
          });

        found.push({ archId, elements: elements.length ? elements : [{ code: "at0001", dv: "DV_ORDINAL" }] });
      });

    if (found.length) protocolChildren[obsArch] = found;
  });

  return { terms, slots, ordinals, countRanges, protocolChildren };
};

/* ------------------------------------------------------------------ */
/*                         naming + rendering                          */
/* ------------------------------------------------------------------ */

const stdAttrNames = {
  language: "Language",
  territory: "Territory",
  category: "Category",
  composer: "Composer",
  context: "Event context",
  other_context: "Other context",
  content: "Content",
  protocol: "Protocol",
  data: "Data",
  events: "Events",
  state: "State",
  description: "Description",
  items: "Items",
  name: "Name",
  identifier: "Identifier",
  time: "Time",
  width: "Width",
  encoding: "Encoding",
  subject: "Subject",
  start_time: "Start time",
  end_time: "End time",
  location: "Location",
  setting: "Setting",
  participations: "Participations",
  health_care_facility: "Healthcare facility",
};

const rmDisplay = {
  dv_coded_text: "Coded text",
  dv_text: "Text",
  dv_quantity: "Quantity",
  dv_count: "Count",
  dv_date_time: "Date/Time",
  dv_date: "Date",
  dv_time: "Time",
  dv_duration: "Duration",
  dv_boolean: "Boolean",
  dv_ordinal: "Ordinal",
  dv_uri: "URI",
  event_context: "Event context",
  item_tree: "Item tree",
  item_list: "Item list",
  item_table: "Item table",
  history: "History",
  point_event: "Any event",
  event: "Event",
  interval_event: "Interval event",
  element: "Element",
  cluster: "Cluster",
  composition: "Composition",
  section: "Section",
  observation: "Observation",
  evaluation: "Evaluation",
  instruction: "Instruction",
  action: "Action",
  admin_entry: "Admin entry",
};

const isAttribute = (n) => n && !n.rmType && typeof n.id === "string" && n.id.length > 0;

const firstChildOfAttr = (node, attrLC) =>
  node?.children?.find((c) => lc(c.id) === attrLC)?.children?.[0];

const getElementValueType = (node) => {
  if (lc(node?.rmType) !== "element") return null;
  const v = firstChildOfAttr(node, "value");
  return v?.rmType ? v.rmType.toUpperCase() : null;
};

// Find nearest archetype id (e.g., openEHR-EHR-CLUSTER.document_metadata.v0)
const nearestArchId = (node, ancestors) => {
  if (node?.nodeId?.includes("openEHR-EHR-")) return node.nodeId;
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const n = ancestors[i];
    if (n?.nodeId?.includes("openEHR-EHR-")) return n.nodeId;
  }
  return null;
};

const ontologyText = (node, ancestors, lookups) => {
  if (!node?.nodeId) return null;
  const arch = nearestArchId(node, ancestors);
  if (!arch) return null;
  const map = lookups.terms[arch];
  return map?.[node.nodeId] || null;
};

// Prefer the attribute label when we’re rendering the DV under an attribute
const labelFromAttributeContext = (node, parent) => {
  if (node?.nodeId) return null; // real coded nodes use ontology
  if (!isAttribute(parent)) return null;
  const attrName = stdAttrNames[lc(parent.id)] || parent.id;
  return attrName || null;
};

const getNodeDisplayName = (node, parent, ancestors, lookups) => {
  // 1) attribute-context label
  const attrLbl = labelFromAttributeContext(node, parent);
  if (attrLbl) return attrLbl;

  // 2) ontology for this archetype/code
  const onto = ontologyText(node, ancestors, lookups);
  if (onto) return onto;

  // 3) explicit name fields
  if (node?.localizedNames?.en) return node.localizedNames.en;
  if (node?.localizedName) return node.localizedName;
  if (node?.name && node.name !== "null" && node.name !== "undefined")
    return node.name;

  // 4) archetype root pretty label
  if (node?.nodeId && node.nodeId.includes("openEHR-EHR-")) {
    const parts = node.nodeId.split(".");
    const tag = (parts[1] || "").replace(/_/g, " ");
    if (tag === "hads") return "HADS (Hospital Anxiety and Depression Scale)";
    if (tag === "self reported data") return "Self-reported data";
    return tag
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  // 5) attributes / RM fallbacks
  if (isAttribute(node)) return stdAttrNames[lc(node.id)] || node.id;
  const rm = lc(node?.rmType);
  if (rm && rmDisplay[rm]) return rmDisplay[rm];
  return "Item";
};

const isSlotNode = (node, ancestors, lookups) => {
  if (!node?.nodeId) return false;
  const arch = nearestArchId(node, ancestors);
  if (!arch) return false;
  return Boolean(lookups.slots[arch]?.[node.nodeId]);
};

const slotIncludes = (node, ancestors, lookups) => {
  const arch = nearestArchId(node, ancestors);
  return lookups.slots[arch]?.[node.nodeId] || [];
};

const ordinalChoicesFor = (node, ancestors, lookups) => {
  const arch = nearestArchId(node, ancestors);
  return lookups.ordinals[arch]?.[node.nodeId] || null;
};

const countRangeFor = (node, ancestors, lookups) => {
  const arch = nearestArchId(node, ancestors);
  return lookups.countRanges[arch]?.[node.nodeId] || null;
};

const getCardinality = (node) => {
  if (node?.min !== undefined && node?.max !== undefined) {
    const max = node.max === -1 || node.max === 999 ? "*" : node.max;
    return `${node.min}..${max}`;
  }
  if (node?.occurrences) {
    if (typeof node.occurrences === "string") return node.occurrences;
    const lower = node.occurrences.lower ?? node.occurrences.min ?? 0;
    let upper = node.occurrences.upper ?? node.occurrences.max;
    if (upper === undefined || upper === -1 || upper === 999) upper = "*";
    return `${lower}..${upper}`;
  }
  return "";
};

const shouldShowNode = (node, parent) => {
  const id = lc(node?.id);
  const rm = lc(node?.rmType);
  if (node?.nodeId && node.nodeId.includes("openEHR-EHR-")) return true;
  if (id === "items" && /item_(tree|list|table)/.test(lc(parent?.rmType)))
    return false;
  if (id === "value" && rm === "" && lc(parent?.rmType) === "element")
    return false;
  return true;
};

const getNodeTypeInfo = (node, parent, ancestors, lookups) => {
  const id = lc(node?.id);
  const rm = lc(node?.rmType);
  const nodeId = node?.nodeId || "";

  // Archetype root
  if (nodeId && nodeId.includes("openEHR-EHR-")) {
    return {
      icon: Folder,
      expandedIcon: FolderOpen,
      color: "text-primary",
      isArchetype: true,
      label: "ARCHETYPE",
    };
  }

  // Attribute containers
  if (isAttribute(node))
    return { icon: Folder, color: "text-theme-secondary", label: id.toUpperCase() };

  // Slot clusters
  if (rm === "cluster" && isSlotNode(node, ancestors, lookups)) {
    return { icon: Layers, color: "text-indigo-300", label: "CLUSTER (slot)" };
  }

  // Entry types
  if (rm === "observation")
    return { icon: Activity, color: "text-success", label: "OBSERVATION" };
  if (rm === "evaluation")
    return { icon: ClipboardList, color: "text-primary", label: "EVALUATION" };
  if (rm === "instruction")
    return { icon: AlertCircle, color: "text-warning", label: "INSTRUCTION" };
  if (rm === "action")
    return { icon: PlayCircle, color: "text-purple-400", label: "ACTION" };
  if (rm === "admin_entry")
    return { icon: ShieldAlert, color: "text-error", label: "ADMIN_ENTRY" };

  // Structures
  if (rm === "cluster")
    return { icon: Layers, color: "text-indigo-400", label: "CLUSTER" };
  if (rm === "section")
    return { icon: Folder, color: "text-theme-secondary", label: "SECTION" };
  if (rm === "item_tree")
    return { icon: Folder, color: "text-theme-secondary", label: "ITEM_TREE" };
  if (rm === "item_list")
    return { icon: Folder, color: "text-theme-secondary", label: "ITEM_LIST" };
  if (rm === "history")
    return { icon: Database, color: "text-theme-secondary", label: "HISTORY" };
  if (rm === "point_event" || rm === "event")
    return { icon: Circle, color: "text-theme-secondary", label: "EVENT" };
  if (rm === "interval_event")
    return { icon: Circle, color: "text-theme-secondary", label: "INTERVAL_EVENT" };
  if (rm === "event_context")
    return { icon: Settings, color: "text-cyan-400", label: "EVENT_CONTEXT" };

  // Data values
  if (rm === "element")
    return {
      icon: Square,
      color: "text-theme-secondary",
      label: getElementValueType(node) || "ELEMENT",
    };
  if (rm === "dv_text") return { icon: Type, color: "text-primary", label: "DV_TEXT" };
  if (rm === "dv_coded_text") return { icon: List, color: "text-purple-400", label: "DV_CODED_TEXT" };
  if (rm === "dv_quantity") return { icon: Hash, color: "text-warning", label: "DV_QUANTITY" };
  if (rm === "dv_count") return { icon: Hash, color: "text-warning", label: "DV_COUNT" };
  if (rm === "dv_ordinal") return { icon: List, color: "text-purple-400", label: "DV_ORDINAL" };
  if (rm === "dv_date_time") return { icon: Calendar, color: "text-success", label: "DV_DATE_TIME" };
  if (rm === "dv_boolean") return { icon: ToggleLeft, color: "text-pink-400", label: "DV_BOOLEAN" };
  if (rm === "dv_uri") return { icon: FileText, color: "text-primary", label: "DV_URI" };

  // Specific attributes with icons
  if (id === "language" || id === "territory")
    return { icon: Globe, color: "text-success", label: "DV_CODED_TEXT" };
  if (id === "category")
    return { icon: Package, color: "text-purple-400", label: "DV_CODED_TEXT" };
  if (id === "composer")
    return { icon: User, color: "text-warning", label: "PARTY_PROXY" };
  if (id === "start_time" || id === "end_time")
    return { icon: Clock, color: "text-primary", label: "DV_DATE_TIME" };

  return {
    icon: FileText,
    color: "text-theme-secondary",
    label: rm ? rm.toUpperCase() : "ITEM",
  };
};

// Extras shown in Type column
const typeExtras = (node, ancestors, lookups) => {
  // slot includes
  if (lc(node?.rmType) === "cluster" && isSlotNode(node, ancestors, lookups)) {
    const inc = slotIncludes(node, ancestors, lookups);
    if (inc.length) return `includes: ${inc.join(" | ")}`;
  }

  if (lc(node?.rmType) !== "element") return "";
  const dv = getElementValueType(node);

  if (dv === "DV_ORDINAL") {
    const choices = ordinalChoicesFor(node, ancestors, lookups);
    if (!choices || !choices.length) return "";
    const preview = choices
      .slice(0, 4)
      .map((c) => `${c.value}=${c.label}`)
      .join(", ");
    return `(${preview}${choices.length > 4 ? ", …" : ""})`;
  }
  if (dv === "DV_COUNT") {
    const r = countRangeFor(node, ancestors, lookups);
    if (r) return `[${r.min}..${r.max}]`;
  }
  return "";
};

/* ------------------------------------------------------------------ */
/*                    Augment tree with protocol clusters              */
/* ------------------------------------------------------------------ */

const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

const findNodeByPredicate = (node, pred, ancestors = []) => {
  if (pred(node, ancestors)) return node;
  for (const c of node.children || []) {
    const found = findNodeByPredicate(c, pred, [...ancestors, node]);
    if (found) return found;
  }
  return null;
};

const ensureProtocolBranch = (obsNode) => {
  // find attribute {id:'protocol'}; create if missing
  let protoAttr = (obsNode.children || []).find((c) => isAttribute(c) && lc(c.id) === "protocol");
  if (!protoAttr) {
    protoAttr = { id: "protocol", children: [] };
    obsNode.children = [...(obsNode.children || []), protoAttr];
  }
  return protoAttr;
};

const makeElement = (code, dv = "DV_ORDINAL") => ({
  rmType: "ELEMENT",
  nodeId: code,
  min: 0,
  max: 1,
  children: [
    {
      id: "value",
      children: [{ rmType: dv }],
    },
  ],
});

const makeClusterArchRoot = (archId, elements = [{ code: "at0001", dv: "DV_ORDINAL" }]) => ({
  rmType: "CLUSTER",
  nodeId: archId,
  min: 0,
  max: 1,
  children: elements.map(({ code, dv }) => makeElement(code, dv)),
});

const augmentWithProtocolFromTemplate = (rootNode, lookups) => {
  if (!lookups?.protocolChildren) return rootNode;

  const clone = deepClone(rootNode);

  // For each OBSERVATION archetype we know about
  Object.keys(lookups.protocolChildren).forEach((obsArchId) => {
    // find the matching node in the UI tree
    const obsNode = findNodeByPredicate(
      clone,
      (n) => n?.nodeId === obsArchId || (lc(n?.rmType) === "observation" && n?.nodeId?.includes(obsArchId)),
    );
    if (!obsNode) return;

    const protoAttr = ensureProtocolBranch(obsNode);

    // existing cluster ids under protocol
    const existing = new Set(
      (protoAttr.children || [])
        .filter((c) => c?.nodeId?.includes("openEHR-EHR-CLUSTER"))
        .map((c) => c.nodeId)
    );

    // inject any missing clusters defined in Template
    (lookups.protocolChildren[obsArchId] || []).forEach(({ archId, elements }) => {
      if (existing.has(archId)) return;
      const cluster = makeClusterArchRoot(archId, elements);
      protoAttr.children = [...(protoAttr.children || []), cluster];
    });
  });

  return clone;
};

/* ------------------------------------------------------------------ */
/*                            Row component                            */
/* ------------------------------------------------------------------ */

const Row = ({
  node,
  parent = null,
  ancestors,
  level,
  onSelect,
  isSelectable,
  defaultExpanded,
  showActions,
  compact,
  lookups,
  customRowRenderer = null,
}) => {
  const typeInfo = getNodeTypeInfo(node, parent, ancestors, lookups);
  const [open, setOpen] = useState(() => {
    if (defaultExpanded || typeInfo.isArchetype || level < 2) return true;
    if (lc(node?.id) === "content" && level === 1) return true;
    if (lc(node?.id) === "data" && lc(parent?.rmType) === "observation") return true;
    if (lc(node?.id) === "protocol") return true; // keep protocol visible for interpretation clusters
    return false;
  });

  const children = useMemo(
    () => (node?.children || []).filter((c) => shouldShowNode(c, node)),
    [node]
  );

  const hasChildren = children.length > 0;
  const displayName = getNodeDisplayName(node, parent, ancestors, lookups);
  const cardinality = getCardinality(node);
  const Icon = open && typeInfo.expandedIcon ? typeInfo.expandedIcon : typeInfo.icon;
  const selectable = isSelectable(node);
  const extra = typeExtras(node, ancestors.concat(parent || []).filter(Boolean), lookups);

  if (!shouldShowNode(node, parent)) return null;

  // Compact view
  if (compact) {
    return (
      <div>
        <div
          className="group flex items-center py-0.5 hover:bg-surface-hover cursor-pointer"
          style={{ paddingLeft: `${level * 16}px` }}
          onClick={() => hasChildren && setOpen(!open)}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown size={12} className="text-theme-secondary mr-1" />
            ) : (
              <ChevronRight size={12} className="text-theme-secondary mr-1" />
            )
          ) : (
            <span className="w-3 mr-1" />
          )}
          <Icon size={14} className={typeInfo.color} />
          <span className="ml-2 text-xs text-theme-primary">{displayName}</span>
          {node.nodeId?.startsWith("at") && (
            <span className="ml-1 text-[10px] text-theme-muted">[{node.nodeId}]</span>
          )}
          {cardinality && (
            <span className="ml-2 text-[10px] text-theme-muted">[{cardinality}]</span>
          )}
          {extra && <span className="ml-2 text-[10px] text-theme-secondary">{extra}</span>}
        </div>

        {open &&
          hasChildren &&
          children.map((c, i) => (
            <Row
              key={`${c.nodeId || c.id || "n"}-${i}`}
              node={c}
              parent={node}
              ancestors={[...ancestors, node]}
              level={level + 1}
              onSelect={onSelect}
              isSelectable={isSelectable}
              defaultExpanded={defaultExpanded}
              showActions={showActions}
              compact
              lookups={lookups}
              customRowRenderer={customRowRenderer}
            />
          ))}
      </div>
    );
  }


  const defaultRowRender = (
    <div className="group flex items-center border-b border-theme py-1 hover:bg-surface-hover">
      {/* Indent + toggle */}
      <div
        className="flex items-center cursor-pointer"
        style={{ width: `${level * 20 + 40}px`, minWidth: `${level * 20 + 40}px` }}
        onClick={() => hasChildren && setOpen(!open)}
      >
        <div style={{ marginLeft: `${level * 20}px` }} className="flex items-center">
          {hasChildren ? (
            open ? (
              <ChevronDown className="text-theme-secondary" size={14} />
            ) : (
              <ChevronRight className="text-theme-secondary" size={14} />
            )
          ) : (
            <span className="w-3.5" />
          )}
          <Icon size={16} className={`ml-1 ${typeInfo.color}`} />
        </div>
      </div>

      {/* Label */}
      <div
        className="flex-1 text-xs font-medium text-theme-primary truncate pr-2"
        title={displayName}
      >
        {displayName}
        {typeInfo.isArchetype && (
          <span className="ml-2 text-[10px] text-primary opacity-70">[{node.nodeId}]</span>
        )}
      </div>

      {/* Type + extras */}
      <div className="w-48 text-[11px] text-theme-secondary text-center px-1">
        <span className="px-1 py-0.5 rounded text-[10px]">{typeInfo.label}</span>
        {extra && <span className="ml-1 text-[10px] text-theme-secondary">{extra}</span>}
      </div>

      {/* Cardinality */}
      <div className="w-20 text-xs text-theme-muted text-center font-mono">
        {cardinality}
      </div>

      {/* Node ID */}
      <div className="w-80 px-2">
        <code className="text-[10px] text-theme-muted break-all">
          {node.nodeId || ""}
        </code>
      </div>

      {/* Action */}
      {showActions && onSelect && (
        <div className="w-16 px-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (selectable) onSelect(node);
            }}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${selectable
                ? "bg-primary text-white hover:bg-primary/80"
                : "bg-surface-hover text-theme-muted cursor-not-allowed"
              }`}
            disabled={!selectable}
            title={selectable ? "Add to query" : "Not selectable for this purpose"}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );


  const rowContent = customRowRenderer
    ? customRowRenderer(node, ancestors, defaultRowRender)
    : defaultRowRender;

  // Full view
  return (
    <div>
      {rowContent}
      {/* Children */}
      {open &&
        hasChildren &&
        children.map((c, i) => (
          <Row
            key={`${c.nodeId || c.id || "n"}-${i}-${level}`}
            node={c}
            parent={node}
            ancestors={[...ancestors, node]}
            level={level + 1}
            onSelect={onSelect}
            isSelectable={isSelectable}
            defaultExpanded={defaultExpanded}
            showActions={showActions}
            compact={false}
            lookups={lookups}
          />
        ))}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*                               Root                                  */
/* ------------------------------------------------------------------ */

const TreeView = ({
  node,
  onSelect,
  isSelectable = () => true,
  defaultExpanded = false,
  showHeader = true,
  showActions = true,
  compact = false,
  template = null,     // pass template (string)
  language = "en",   // "es" will show your HADS interpretation texts
  autoAugmentProtocol = true, // inject protocol clusters from template when missing
  customRowRenderer = null
}) => {
  // Parse template → lookups (hooks must be called unconditionally)
  const lookups = useMemo(
    () => buildLookupsFromTemplate(template, language),
    [template, language]
  );

  // Optionally augment the provided tree with protocol clusters (HADS interp.)
  const rootForRender = useMemo(() => {
    if (!node || !autoAugmentProtocol || !template) return node;
    return augmentWithProtocolFromTemplate(node, lookups);
  }, [node, lookups, autoAugmentProtocol, template]);

  if (!node) return null;

  return (
    <div className="text-theme-primary">
      {showHeader && !compact && (
        <div className="flex items-center bg-surface p-2 text-xs text-theme-secondary font-semibold border-b border-theme sticky top-0 z-10">
          <div style={{ width: "40px", minWidth: "40px" }} />
          <div className="flex-1 px-2">Node</div>
          <div className="w-48 text-center">Type</div>
          <div className="w-20 text-center">Cardinality</div>
          <div className="w-80 px-2">Node ID</div>
          {showActions && onSelect && <div className="w-16 px-2">Action</div>}
        </div>
      )}

      <div className={compact ? "" : "bg-background"}>
        <Row
          node={rootForRender}
          parent={null}
          ancestors={[]}
          level={0}
          onSelect={onSelect}
          isSelectable={isSelectable}
          defaultExpanded={defaultExpanded}
          showActions={showActions}
          compact={compact}
          lookups={lookups}
        />
      </div>
    </div>
  );
};

export default TreeView;