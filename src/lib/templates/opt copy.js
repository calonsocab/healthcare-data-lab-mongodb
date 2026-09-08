// src/lib/templates/opt.js
import xml2js from 'xml2js';

/**
 * Convert XML OPT to Web Template JSON matching Archetype Designer output closely.
 */
export async function convertOPTtoWebTemplate(xmlContent) {
  const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true, normalizeTags: false });
  const result = await parser.parseStringPromise(xmlContent);
  const template = result?.template || Object.values(result || {})[0];
  if (!template) throw new Error('Invalid OPT format: missing <template>');

  // Collect multi-language terms + language order
  const { tables: termDefsByArch, languages: availableLangs } =
    collectTermDefinitionsByArchetypeMultiLang(template);
  const { defaultLanguage, languages, langOrder } =
    buildLangOrder(template, availableLangs);

  // Extract version metadata (semVer)
  const semVer = extractStringValue(template, 'description.other_details', (items) => {
    if (Array.isArray(items)) {
      const semVerItem = items.find(item => item?.id === 'sem_ver');
      return semVerItem?._;
    }
    return items?.id === 'sem_ver' ? items?._ : null;
  }) || '0.0.1';
  const version = '2.3';

  // Root definition (COMPOSITION)
  const def = template.definition || {};
  const rootArch = extractStringValue(def, 'archetype_id.value') || '';
  const rootRmType = extractStringValue(def, 'rm_type_name') || 'COMPOSITION';

  const rootTerm = resolveTerm(termDefsByArch, rootArch, extractStringValue(def, 'node_id'), langOrder);
  const rootNodeText = rootTerm.text
    || extractStringValue(template, 'concept')
    || rootArch
    || 'Composition';

  const tree = {
    id: safeString(rootNodeText).toLowerCase().replace(/[^a-z0-9_]/g, '_'),
    name: rootNodeText,
    localizedName: rootNodeText,
    rmType: rootRmType,
    nodeId: rootArch || 'at0000',
    min: 1,
    max: 1,
    localizedNames: { [defaultLanguage]: rootNodeText },
    localizedDescriptions: { [defaultLanguage]: rootTerm.description || '' },
    aqlPath: '',
    children: []
  };

  // build children
  if (def.attributes) {
    const attrsArr = Array.isArray(def.attributes) ? def.attributes : [def.attributes];
    for (const attr of attrsArr) {
      await processAttribute_AD({
        attr,
        parentChildren: tree.children,
        parentPath: '',
        archScope: rootArch,
        language: defaultLanguage,
        langOrder,
        termDefsByArch
      });
    }
  }

  // Ensure context/system leaves are present
  postProcess_AD(tree);

  return {
    templateId: extractStringValue(template, 'template_id.value') || 'unknown_template',
    semVer,
    version,
    defaultLanguage,
    languages,
    tree
  };
}

// === Core recursive processing (AD style) ===================================

async function processAttribute_AD({
  attr,
  parentChildren,
  parentPath,
  archScope,
  language,
  langOrder,
  termDefsByArch
}) {
  if (!attr?.children) return;

  const rmAttr = extractStringValue(attr, 'rm_attribute_name') || '';
  const children = Array.isArray(attr.children) ? attr.children : [attr.children];
  if (rmAttr === 'name') return;

  for (const child of children) {
    if (!child) continue;

    const rmType = extractStringValue(child, 'rm_type_name') || '';
    const nodeId = extractStringValue(child, 'node_id') || '';
    const archId = extractStringValue(child, 'archetype_id.value') || '';

    // Archetyped & non-archetyped containers (CLUSTER, SECTION, ENTRY…)
    if (isArchetypedContainer(rmType, archId)) {
      const term = resolveTerm(termDefsByArch, archId || archScope, nodeId, langOrder);
      const name = term.text || extractStringValue(child, 'rm_type_name') || 'Node';

      const seg = aqlSelector_AD({
        attr: rmAttr,
        rmType,
        archId: archId || undefined,
        nodeId: archId ? undefined : (nodeId || undefined),
        title: name
      });
      const aqlPath = joinAql_AD(parentPath, seg);

      const node = {
        id: generateNodeId(archId || nodeId, name),
        nodeId: archId || (nodeId || ''),
        name,
        localizedName: name,
        rmType,
        min: occurrencesMin(child),
        max: occurrencesMax(child),
        localizedNames: { [language]: name },
        localizedDescriptions: { [language]: term.description || '' },
        aqlPath,
        children: []
      };

      const nextAttrs = child.attributes ? (Array.isArray(child.attributes) ? child.attributes : [child.attributes]) : [];
      for (const a of nextAttrs) {
        await processAttribute_AD({
          attr: a,
          parentChildren: node.children,
          parentPath: aqlPath,
          archScope: archId || archScope,
          language,
          langOrder,
          termDefsByArch
        });
      }

      parentChildren.push(node);
      continue;
    }

    // EVENT_CONTEXT
    if (rmType === 'EVENT_CONTEXT') {
      const seg = aqlSelector_AD({ attr: 'context', nodeId });
      const aqlPath = joinAql_AD(parentPath, seg);

      const node = {
        id: 'event_context',
        name: 'Event Context',
        localizedName: 'Event Context',
        rmType: 'EVENT_CONTEXT',
        nodeId: nodeId || 'at0002',
        min: occurrencesMin(child),
        max: occurrencesMax(child),
        localizedNames: { [language]: 'Event Context' },
        localizedDescriptions: { [language]: '' },
        aqlPath,
        children: []
      };

      const nextAttrs = child.attributes ? (Array.isArray(child.attributes) ? child.attributes : [child.attributes]) : [];
      for (const a of nextAttrs) {
        await processAttribute_AD({
          attr: a,
          parentChildren: node.children,
          parentPath: aqlPath,
          archScope,
          language,
          langOrder,
          termDefsByArch
        });
      }
      parentChildren.push(node);
      continue;
    }

    // HISTORY / ITEM_TREE / ITEM_LIST — collapse
    if (rmType === 'HISTORY' || rmType === 'ITEM_TREE' || rmType === 'ITEM_LIST') {
      const seg = aqlSelector_AD({ attr: rmAttr, nodeId });
      const nextPath = joinAql_AD(parentPath, seg);

      const nextAttrs = child.attributes ? (Array.isArray(child.attributes) ? child.attributes : [child.attributes]) : [];
      for (const a of nextAttrs) {
        await processAttribute_AD({
          attr: a,
          parentChildren,
          parentPath: nextPath,
          archScope,
          language,
          langOrder,
          termDefsByArch
        });
      }
      continue;
    }

    // EVENT nodes
    if (rmType === 'EVENT') {
      const seg = aqlSelector_AD({ attr: rmAttr, nodeId });
      const aqlPath = joinAql_AD(parentPath, seg);
      const term = resolveTerm(termDefsByArch, archScope, nodeId, langOrder);
      const evtName = term.text || 'Any event';

      const node = {
        id: generateNodeId(nodeId, evtName),
        name: evtName,
        localizedName: evtName,
        rmType: 'EVENT',
        nodeId: nodeId || 'at0002',   // keep the nodeId
        min: occurrencesMin(child),
        max: occurrencesMax(child),
        localizedNames: { [language]: evtName },
        localizedDescriptions: { [language]: term.description || '' },
        aqlPath,
        children: []
      };

      const nextAttrs = child.attributes ? (Array.isArray(child.attributes) ? child.attributes : [child.attributes]) : [];
      for (const a of nextAttrs) {
        await processAttribute_AD({
          attr: a,
          parentChildren: node.children,
          parentPath: aqlPath,
          archScope,
          language,
          langOrder,
          termDefsByArch
        });
      }
      parentChildren.push(node);
      continue;
    }

    // ELEMENT -> emit DV_* value
    if (rmType === 'ELEMENT') {
      const term = resolveTerm(termDefsByArch, archScope, nodeId, langOrder);
      const elementName = term.text || 'Element';
      const valueAttr = pickChildAttribute(child, 'value');
      if (!valueAttr) continue;

      const dvChild = firstChild(valueAttr);
      if (!dvChild) continue;

      const dvType = extractStringValue(dvChild, 'rm_type_name') || 'DV_TEXT';
      const seg = aqlSelector_AD({ attr: rmAttr, nodeId });
      const atItems = joinAql_AD(parentPath, seg);
      const aqlPath = joinAql_AD(atItems, 'value');

      const inputs = dvType === 'DV_ORDINAL'
        ? extractOrdinalInputs(dvChild, archScope, termDefsByArch, langOrder)
        : getInputsForType_AD(dvType, dvChild, archScope, termDefsByArch, langOrder, { isCategory: rmAttr === 'category' });

      const node = {
        id: generateNodeId(nodeId, elementName),
        name: elementName,
        localizedName: elementName,
        rmType: dvType,
        nodeId: '',
        min: occurrencesMin(child),
        max: occurrencesMax(child),
        localizedNames: { [language]: elementName },
        localizedDescriptions: { [language]: term.description || '' },
        aqlPath,
        children: [],
        inputs
      };

      if (maybeMarkInContext(aqlPath)) node.inContext = true;

      parentChildren.push(node);
      continue;
    }

    // Primitive/value nodes (DV_*, CODE_PHRASE, PARTY_PROXY)
    if (isValueType(rmType) || rmType === 'PARTY_PROXY' || rmType === 'CODE_PHRASE') {
      const term = resolveTerm(termDefsByArch, archScope, nodeId, langOrder);
      const fallback = (rmAttr === 'category') ? 'Category' : readable(rmAttr);
      const name = term.text || fallback;

      const seg = aqlSelector_AD({ attr: rmAttr, nodeId });
      const aqlPath = joinAql_AD(parentPath, seg);

      const inputs = getInputsForType_AD(
        rmType,
        child,
        archScope,
        termDefsByArch,
        langOrder,
        { isCategory: rmAttr === 'category' }
      );

      const node = {
        id: generateNodeId(nodeId, name),
        name,
        rmType,
        min: occurrencesMin(child),
        max: occurrencesMax(child),
        aqlPath,
        children: [],
        inputs
      };

      if (maybeMarkInContext(aqlPath)) node.inContext = true;

      parentChildren.push(node);
      continue;
    }

    // Unknown – recurse
    const nextAttrs = child.attributes ? (Array.isArray(child.attributes) ? child.attributes : [child.attributes]) : [];
    for (const a of nextAttrs) {
      await processAttribute_AD({
        attr: a,
        parentChildren,
        parentPath,
        archScope,
        language,
        langOrder,
        termDefsByArch
      });
    }
  }
}

// === Helper Functions =======================================================

function generateNodeId(nodeId, name) {
  const baseName = name || nodeId || 'node';
  return safeString(baseName).toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

function extractStringValue(obj, path, customExtractor = null) {
  try {
    const parts = path.split('.');
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return null;
      cur = cur[p];
    }
    if (customExtractor) return customExtractor(cur);
    if (cur == null) return null;
    if (Array.isArray(cur)) return cur[0] != null ? String(cur[0]) : null;
    return String(cur);
  } catch {
    return null;
  }
}

function safeString(v) { return v == null ? '' : String(v); }

function occurrencesMin(node) {
  const occ = node?.occurrences;
  const n = Array.isArray(occ) ? occ[0] : occ;
  const lower = n?.lower;
  const parsed = parseInt(lower, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function occurrencesMax(node) {
  const occ = node?.occurrences;
  const n = Array.isArray(occ) ? occ[0] : occ;
  const ub = (safeString(n?.upper_unbounded).toLowerCase() === 'true');
  if (ub) return -1;
  const upper = parseInt(n?.upper, 10);
  return Number.isFinite(upper) ? upper : 1;
}

function aqlSelector_AD({ attr, rmType, archId, nodeId, title }) {
  const base = attr || '';
  const t = (rmType || '').toUpperCase();

  if (archId) {
    if (t === 'SECTION' || base === 'content') {
      const safe = (title || '').replace(/'/g, "''");
      return `${base}[${archId},'${safe}']`;
    }
    return `${base}[${archId}]`;
  }
  if (nodeId) return `${base}[${nodeId}]`;
  return base;
}

function maybeMarkInContext(aqlPath) {
  if (!aqlPath) return false;
  return (
    aqlPath.endsWith('/category') ||
    aqlPath.endsWith('/start_time') ||
    aqlPath.endsWith('/setting') ||
    aqlPath.endsWith('/time') ||
    aqlPath.endsWith('/language') ||
    aqlPath.endsWith('/encoding') ||
    aqlPath.endsWith('/subject')
  );
}

function extractOrdinalInputs(dvOrdinalNode, archId, termDefsByArch, langOrder) {
  const raw = [];

  if (dvOrdinalNode?.list) {
    const arr = Array.isArray(dvOrdinalNode.list) ? dvOrdinalNode.list : [dvOrdinalNode.list];
    raw.push(...arr);
  }

  const listAttr = pickChildAttribute(dvOrdinalNode, 'list');
  const items = listAttr
    ? (Array.isArray(listAttr.children) ? listAttr.children : [listAttr.children])
    : [];
  raw.push(...items);

  const rows = [];
  for (const o of raw) {
    if (!o) continue;
    const ordStr = extractStringValue(o, 'value') ?? extractStringValue(o, 'value._');
    const ordinal = ordStr != null ? parseInt(ordStr, 10) : undefined;

    const code =
      extractStringValue(o, 'symbol.defining_code.code_string') ||
      extractStringValue(o, 'symbol.code_string') ||
      null;

    if (!code) continue;

    const term = resolveTerm(termDefsByArch, archId, code, langOrder);
    const label =
      term.text ||
      extractStringValue(o, 'symbol.value') ||
      code;

    rows.push({
      value: code,
      label,
      localizedLabels: { [langOrder[0]]: label },
      localizedDescriptions: { [langOrder[0]]: term.description || '' },
      ordinal: Number.isFinite(ordinal) ? ordinal : undefined
    });
  }

  return rows.length ? [{ type: 'CODED_TEXT', list: rows }] : [];
}

function extractCodedTextInputs(dvCodedNode, archId, termDefsByArch, langOrder) {
  const defAttr = pickChildAttribute(dvCodedNode, 'defining_code');
  const kids = defAttr ? (Array.isArray(defAttr.children) ? defAttr.children : [defAttr.children]) : [];
  const cp = kids.find(c => extractStringValue(c, 'rm_type_name') === 'CODE_PHRASE');

  const codes = [];
  if (cp?.code_list) {
    const raw = Array.isArray(cp.code_list) ? cp.code_list : [cp.code_list];
    for (const r of raw) {
      const code = typeof r === 'string' ? r : (r?._ || '');
      if (code) {
        const term = resolveTerm(termDefsByArch, archId, code, langOrder);
        const label = term.text || code;
        codes.push({
          value: code,
          label,
          localizedLabels: { [langOrder[0]]: label },
          localizedDescriptions: { [langOrder[0]]: term.description || '' }
        });
      }
    }
  }

  if (codes.length) {
    const terminology = extractStringValue(cp, 'terminology_id.value') || undefined;
    return [{
      type: 'CODED_TEXT',
      ...(terminology && { terminology }),
      list: codes
    }];
  }

  return [{ suffix: 'code', type: 'TEXT' }, { suffix: 'value', type: 'TEXT' }];
}

function joinAql_AD(parent, seg) {
  if (!seg) return parent || '';
  if (!parent) return `/${seg}`;
  return `${parent}/${seg}`;
}

function isArchetypedContainer(rmType, archId) {
  const t = (rmType || '').toUpperCase();
  if (t === 'CLUSTER') return true;
  return ['SECTION', 'OBSERVATION', 'EVALUATION', 'INSTRUCTION', 'ACTION', 'ADMIN_ENTRY'].includes(t);
}

function isValueType(rmType) {
  return /^DV_|^CODE_PHRASE$/.test(rmType);
}

function pickChildAttribute(node, rmAttrName) {
  if (!node?.attributes) return null;
  const arr = Array.isArray(node.attributes) ? node.attributes : [node.attributes];
  return arr.find(a => extractStringValue(a, 'rm_attribute_name') === rmAttrName) || null;
}

function firstChild(attr) {
  if (!attr?.children) return null;
  const arr = Array.isArray(attr.children) ? attr.children : [attr.children];
  return arr[0] || null;
}

function readable(s) {
  if (!s) return '';
  return s.replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
}

function getInputsForType_AD(
  rmType,
  nodeObj,
  archId,
  termDefsByArch,
  langOrder,
  { isCategory = false } = {}
) {
  switch (rmType) {
    case 'DV_TEXT': return [{ type: 'TEXT' }];
    case 'DV_URI': return [{ type: 'TEXT' }];
    case 'DV_QUANTITY': return [
      { suffix: 'magnitude', type: 'DECIMAL' },
      { suffix: 'units', type: 'TEXT' }
    ];
    case 'DV_COUNT': {
      // Try to extract magnitude range constraints if present
      const magnitudeAttr = pickChildAttribute(nodeObj, 'magnitude');
      if (magnitudeAttr) {
        const primitiveChild = firstChild(magnitudeAttr);
        const rangeNode = primitiveChild?.range;
        const r = Array.isArray(rangeNode) ? rangeNode[0] : rangeNode;
        if (r) {
          const lower = parseInt(r.lower, 10);
          const upper = parseInt(r.upper, 10);
          const minOp = String(r.lower_included).toLowerCase() === 'true' ? '>=' : '>';
          const maxOp = String(r.upper_included).toLowerCase() === 'true' ? '<=' : '<';
          const validation = {
            range: {
              minOp,
              min: Number.isFinite(lower) ? lower : 0,
              maxOp,
              max: Number.isFinite(upper) ? upper : Number.MAX_SAFE_INTEGER
            }
          };
          return [{ type: 'INTEGER', validation }];
        }
      }
      return [{ type: 'INTEGER' }];
    }
    case 'DV_DATE_TIME': return [{ type: 'DATETIME' }];
    case 'DV_DATE': return [{ type: 'DATE' }];
    case 'DV_TIME': return [{ type: 'TIME' }];
    case 'DV_BOOLEAN': return [{ type: 'BOOLEAN' }];
    case 'DV_ORDINAL': return extractOrdinalInputs(nodeObj, archId, termDefsByArch, langOrder);
    case 'DV_CODED_TEXT': {
      if (isCategory) {
        // COMPOSITION.category -> openehr::433|event|
        return [{
          suffix: 'code',
          type: 'CODED_TEXT',
          terminology: 'openehr',
          list: [{
            value: '433',
            label: 'event',
            localizedLabels: { [langOrder[0]]: 'event' }
          }]
        }];
      }
      return extractCodedTextInputs(nodeObj, archId, termDefsByArch, langOrder);
    }
    case 'PARTY_PROXY': return [
      { suffix: 'id', type: 'TEXT' },
      { suffix: 'id_scheme', type: 'TEXT' },
      { suffix: 'id_namespace', type: 'TEXT' },
      { suffix: 'name', type: 'TEXT' }
    ];
    case 'CODE_PHRASE': return [];
    default: return [];
  }
}

function hasChildWithAql(children, aqlPath) {
  return (children || []).some(c => c?.aqlPath === aqlPath);
}

function pushIfMissing(children, node) {
  if (!hasChildWithAql(children, node.aqlPath)) children.push(node);
}

function walkNodes(node, fn) {
  if (!node) return;
  fn(node);
  (node.children || []).forEach(ch => walkNodes(ch, fn));
}

function postProcess_AD(tree) {
  // Composition-level standard nodes
  pushIfMissing(tree.children, {
    id: 'language',
    name: 'Language',
    rmType: 'CODE_PHRASE',
    min: 1, max: 1,
    aqlPath: '/language',
    children: [],
    inContext: true
  });
  
  pushIfMissing(tree.children, {
    id: 'territory',
    name: 'Territory',
    rmType: 'CODE_PHRASE',
    min: 1, max: 1,
    aqlPath: '/territory',
    children: [],
    inContext: true
  });
  
  pushIfMissing(tree.children, {
    id: 'composer',
    name: 'Composer',
    rmType: 'PARTY_PROXY',
    min: 1, max: 1,
    aqlPath: '/composer',
    inputs: [
      { suffix: 'id', type: 'TEXT' },
      { suffix: 'id_scheme', type: 'TEXT' },
      { suffix: 'id_namespace', type: 'TEXT' },
      { suffix: 'name', type: 'TEXT' },
    ],
    children: [],
    inContext: true
  });

  // EVENT_CONTEXT nodes
  const ctxNode = (tree.children || []).find(n => n.rmType === 'EVENT_CONTEXT');
  if (ctxNode) {
    pushIfMissing(ctxNode.children, {
      id: 'start_time',
      name: 'Start_time',
      rmType: 'DV_DATE_TIME',
      min: 1, max: 1,
      aqlPath: `${ctxNode.aqlPath}/start_time`,
      inputs: [{ type: 'DATETIME' }],
      children: [],
      inContext: true
    });
    
    pushIfMissing(ctxNode.children, {
      id: 'setting',
      name: 'Setting',
      rmType: 'DV_CODED_TEXT',
      min: 1, max: 1,
      aqlPath: `${ctxNode.aqlPath}/setting`,
      inputs: [
        { suffix: 'code', type: 'TEXT' },
        { suffix: 'value', type: 'TEXT' }
      ],
      children: [],
      inContext: true
    });
  }

  // OBSERVATION nodes
  walkNodes(tree, (n) => {
    if (n.rmType !== 'OBSERVATION' || !n.aqlPath?.startsWith('/content[')) return;

    pushIfMissing(n.children, {
      id: 'language',
      name: 'Language',
      rmType: 'CODE_PHRASE',
      min: 1, max: 1,
      aqlPath: `${n.aqlPath}/language`,
      children: [],
      inContext: true
    });
    
    pushIfMissing(n.children, {
      id: 'encoding',
      name: 'Encoding',
      rmType: 'CODE_PHRASE',
      min: 1, max: 1,
      aqlPath: `${n.aqlPath}/encoding`,
      children: [],
      inContext: true
    });
    
    pushIfMissing(n.children, {
      id: 'subject',
      name: 'Subject',
      rmType: 'PARTY_PROXY',
      min: 1, max: 1,
      aqlPath: `${n.aqlPath}/subject`,
      inputs: [
        { suffix: 'id', type: 'TEXT' },
        { suffix: 'id_scheme', type: 'TEXT' },
        { suffix: 'id_namespace', type: 'TEXT' },
        { suffix: 'name', type: 'TEXT' },
      ],
      children: [],
      inContext: true
    });

    const anyEvent = (n.children || []).find(c => c.rmType === 'EVENT');
    if (anyEvent) {
      const eventTimePath = `${anyEvent.aqlPath}/time`;
      pushIfMissing(n.children, {
        id: 'time',
        name: 'Time',
        rmType: 'DV_DATE_TIME',
        min: 1, max: 1,
        aqlPath: eventTimePath,
        inputs: [{ type: 'DATETIME' }],
        children: [],
        inContext: true
      });
    }
  });

  // Protocol clusters dependencies
  walkNodes(tree, (n) => {
    if (n.rmType === 'CLUSTER' && n.aqlPath?.includes('/protocol[')) {
      const parent = findParentOfNode(tree, n);
      if (parent) {
        let observationNode = parent;
        while (observationNode && observationNode.rmType !== 'OBSERVATION') {
          observationNode = findParentOfNode(tree, observationNode);
        }
        if (observationNode) {
          const dependsOn = [];
          walkNodes(observationNode, (sibling) => {
            if (sibling.id &&
                sibling.id !== n.id &&
                sibling.aqlPath?.includes('/data[') &&
                !sibling.aqlPath?.includes('/protocol[') &&
                (sibling.rmType?.startsWith?.('DV_') || sibling.rmType === 'DV_COUNT')) {
              dependsOn.push(sibling.id);
            }
          });
          if (dependsOn.length > 0) n.dependsOn = dependsOn;
        }
      }
    }
  });
}

function findParentOfNode(tree, targetNode) {
  let parent = null;
  walkNodes(tree, (n) => {
    if (n.children?.includes(targetNode)) parent = n;
  });
  return parent;
}

// === Term tables (multi-lang) ===============================================

function collectTermDefinitionsByArchetypeMultiLang(rootObj) {
  const out = {};
  const langs = new Set();

  function visit(node, archId) {
    if (!node || typeof node !== 'object') return;
    const nextArchId = extractStringValue(node, 'archetype_id.value') || archId;

    const tdefs = node.term_definitions
      ? (Array.isArray(node.term_definitions) ? node.term_definitions : [node.term_definitions])
      : [];

    for (const td of tdefs) {
      const lang =
        (td?.language && String(td.language)) ||
        (td?.language_code && String(td.language_code)) ||
        (td?.$?.language && String(td.$.language)) ||
        null;

      const code = td?.code || td?.$?.code;
      if (!code || !nextArchId) continue;

      const items = td.items ? (Array.isArray(td.items) ? td.items : [td.items]) : [];
      out[nextArchId] ||= {};
      out[nextArchId][code] ||= {};
      const bucket = out[nextArchId][code];

      const text = items.find(it => (it?.id || it?.$?.id) === 'text');
      const desc = items.find(it => (it?.id || it?.$?.id) === 'description');

      const textVal = (typeof text === 'string') ? text : (text?._ ?? text?.value ?? '');
      const descVal = (typeof desc === 'string') ? desc : (desc?._ ?? desc?.value ?? '');

      const langKey = lang || '??';
      langs.add(langKey);
      bucket[langKey] = { text: textVal, description: descVal };
    }

    for (const k of Object.keys(node)) visit(node[k], nextArchId || archId);
  }

  const rootArchId = extractStringValue(rootObj, 'definition.archetype_id.value') || null;
  visit(rootObj, rootArchId);

  if (langs.size === 0) langs.add('en');

  return { tables: out, languages: Array.from(langs) };
}

function buildLangOrder(template, available) {
  const def = extractStringValue(template, 'language.code_string') || 'en';
  const uniq = Array.from(new Set([def, ...(available || [])]));
  const order = [def, ...uniq.filter(l => l !== def), '*'];
  return { defaultLanguage: def, languages: uniq, langOrder: order };
}

function resolveTerm(tables, archId, code, langOrder) {
  if (!archId || !code) return {};
  const perCode = tables[archId]?.[code];
  if (!perCode) return {};
  for (const lang of langOrder) {
    if (lang === '*') {
      for (const t of Object.values(perCode)) if (t?.text || t?.description) return t;
    } else if (perCode[lang]) {
      const t = perCode[lang];
      if (t?.text || t?.description) return t;
    }
  }
  return {};
}

// === Normalizer =============================================================

export function toNormalizedWebTemplate(rawWebTemplate, extras = {}) {
  const tree = rawWebTemplate?.tree || rawWebTemplate;
  if (!tree?.children) throw new Error('Invalid web template: missing tree');
  postProcess_AD(tree);
  
  return {
    templateId: extras.templateId || 'unknown_template',
    semVer: extras.semVer || '0.0.1',
    version: extras.version || '2.3',
    defaultLanguage: extras.defaultLanguage || 'en',
    languages: extras.languages || ['en'],
    tree
  };
}