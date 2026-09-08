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

  const annotationsByArch = collectAnnotations(template);

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
    id: slugifyAD(rootNodeText),
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
        termDefsByArch,
        annotationsByArch
      });
    }
  }

  // Ensure context/system leaves are present + normalize final structure
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
  termDefsByArch,
  annotationsByArch
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
      // Skip non-archetyped CLUSTER placeholders under other_context (AD omits these)
      if ((rmType || '').toUpperCase() === 'CLUSTER' && !archId && /\/other_context\[[^/]+\]$/.test(parentPath)) {
        continue;
      }

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

      const annotations = annotationsByArch?.[archId || archScope]?.[nodeId];
      if (annotations) {
        node.annotations = annotations;
      }

      const nextAttrs = child.attributes ? (Array.isArray(child.attributes) ? child.attributes : [child.attributes]) : [];
      for (const a of nextAttrs) {
        await processAttribute_AD({
          attr: a,
          parentChildren: node.children,
          parentPath: aqlPath,
          archScope: archId || archScope,
          language,
          langOrder,
          termDefsByArch,
          annotationsByArch
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
          termDefsByArch,
          annotationsByArch
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
          termDefsByArch,
          annotationsByArch
        });
      }
      continue;
    }

    // EVENT nodes — collapse (AD flattens events)
    if (rmType === 'EVENT') {
      const seg = aqlSelector_AD({ attr: rmAttr, nodeId });
      const nextPath = joinAql_AD(parentPath, seg);

      const nextAttrs = child.attributes ? (Array.isArray(child.attributes) ? child.attributes : [child.attributes]) : [];
      for (const a of nextAttrs) {
        await processAttribute_AD({
          attr: a,
          parentChildren,
          parentPath: nextPath, // recurse without creating an EVENT node
          archScope,
          language,
          langOrder,
          termDefsByArch,
          annotationsByArch
        });
      }
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
        nodeId: nodeId || '',     // keep ELEMENT at-code (AD style)
        min: occurrencesMin(child),
        max: occurrencesMax(child),
        localizedNames: { [langOrder[0]]: elementName },
        localizedDescriptions: { [langOrder[0]]: term.description || '' },
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

      const name = (rmAttr === 'category') ? 'Category' : (term.text || fallback);
      const id = (rmAttr === 'category') ? 'category' : generateNodeId(nodeId, name);

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
        id: id,
        name,
        localizedName: name,
        rmType,
        nodeId: nodeId || '',
        min: occurrencesMin(child),
        max: occurrencesMax(child),
        localizedNames: { [langOrder[0]]: name },
        localizedDescriptions: { [langOrder[0]]: term.description || '' },
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
        termDefsByArch,
        annotationsByArch
      });
    }
  }
}

// === Helper Functions =======================================================

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
  const ub = (String(n?.upper_unbounded || '').toLowerCase() === 'true');
  if (ub) return -1;
  const upper = parseInt(n?.upper, 10);
  return Number.isFinite(upper) ? upper : 1;
}

function aqlSelector_AD({ attr, rmType, archId, nodeId, title }) {
  const base = attr || '';
  const t = (rmType || '').toUpperCase();

  if (archId) {
    if (t === 'SECTION' || base === 'content') {
      const safeTitle = (title || '').replace(/'/g, "''");
      return `${base}[${archId},'${safeTitle}']`;
    }
    return `${base}[${archId}]`;
  }
  if (nodeId) return `${base}[${nodeId}]`;
  return base;
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
  return /^DV_|^CODE_PHRASE$/.test(rmType || '');
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

function extractQuantityUnitList(nodeObj, langOrder) {
  const rawList = nodeObj?.list ? (Array.isArray(nodeObj.list) ? nodeObj.list : [nodeObj.list]) : [];
  const unitOptions = rawList
    .map((item) => {
      const unit = extractStringValue(item, 'units') || extractStringValue(item, 'value') || extractStringValue(item, 'label');
      if (!unit) return null;
      return {
        value: unit,
        label: unit,
        localizedLabels: { [langOrder[0]]: unit }
      };
    })
    .filter(Boolean);

  return unitOptions;
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
    case 'DV_QUANTITY': {
      const unitList = extractQuantityUnitList(nodeObj, langOrder);
      return [
        { suffix: 'magnitude', type: 'DECIMAL' },
        { suffix: 'units', type: 'TEXT', ...(unitList.length ? { list: unitList } : {}) }
      ];
    }
case 'DV_COUNT': {
      // FIXED: Enhanced extraction of magnitude range constraints
      let rangeData = null;
      
      // Strategy 1: Check magnitude attribute
      const magnitudeAttr = pickChildAttribute(nodeObj, 'magnitude');
      if (magnitudeAttr) {
        const primObj = firstChild(magnitudeAttr);
        if (primObj) {
          // Look for C_INTEGER item with range
          const item = primObj.item;
          if (item?.range) {
            rangeData = Array.isArray(item.range) ? item.range[0] : item.range;
          }
          // Also check direct range on primitive object
          if (!rangeData && primObj.range) {
            rangeData = Array.isArray(primObj.range) ? primObj.range[0] : primObj.range;
          }
        }
      }
      
      // Strategy 2: Check direct range on nodeObj
      if (!rangeData && nodeObj?.range) {
        rangeData = Array.isArray(nodeObj.range) ? nodeObj.range[0] : nodeObj.range;
      }
      
      // Strategy 3: Look for attributes > magnitude > children with C_INTEGER
      if (!rangeData && nodeObj.attributes) {
        const attrs = Array.isArray(nodeObj.attributes) ? nodeObj.attributes : [nodeObj.attributes];
        for (const attr of attrs) {
          if (extractStringValue(attr, 'rm_attribute_name') === 'magnitude') {
            const kids = attr.children ? (Array.isArray(attr.children) ? attr.children : [attr.children]) : [];
            for (const kid of kids) {
              if (kid?.item?.range) {
                rangeData = Array.isArray(kid.item.range) ? kid.item.range[0] : kid.item.range;
                break;
              }
            }
            if (rangeData) break;
          }
        }
      }

      if (rangeData) {
        const lower = Number.parseInt(rangeData.lower, 10);
        const upper = Number.parseInt(rangeData.upper, 10);
        const lowerIncluded = String(rangeData.lower_included).toLowerCase();
        const upperIncluded = String(rangeData.upper_included).toLowerCase();
        
        const minOp = (lowerIncluded === 'true') ? '>=' : '>';
        const maxOp = (upperIncluded === 'true') ? '<=' : '<';
        
        return [{
          type: 'INTEGER',
          validation: {
            range: {
              minOp,
              min: Number.isFinite(lower) ? lower : 0,
              maxOp,
              max: Number.isFinite(upper) ? upper : Number.MAX_SAFE_INTEGER
            }
          }
        }];
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

function maybeMarkInContext(aqlPath) {
  if (!aqlPath) return false;
  // match attribute with or without predicate (e.g., /category[at0001])
  return /\/(category|start_time|setting|territory|time|language|encoding|subject)(\[|$)/.test(aqlPath);
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

function findParentOfNode(tree, targetNode) {
  let parent = null;
  walkNodes(tree, (n) => {
    if (n.children?.includes(targetNode)) parent = n;
  });
  return parent;
}

// === Normalization / Post-processing to match AD ============================

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

  // EVENT_CONTEXT nodes: ensure start_time & setting
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

  // OBSERVATION nodes: language, encoding, subject, and time (before protocol)
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

    // Ensure time path exists and appears before protocol clusters
    const eventTimePath = `${n.aqlPath}/data[at0001]/events[at0002]/time`;
    const timeNode = {
      id: 'time',
      name: 'Time',
      rmType: 'DV_DATE_TIME',
      min: 1, max: 1,
      aqlPath: eventTimePath,
      inputs: [{ type: 'DATETIME' }],
      children: [],
      inContext: true
    };

    // remove existing 'time', then insert before first protocol child
    n.children = (n.children || []).filter(c => c.id !== 'time');
    const idx = (n.children || []).findIndex(c => c.aqlPath?.includes('/protocol['));
    if (idx >= 0) n.children.splice(idx, 0, timeNode);
    else pushIfMissing(n.children, timeNode);
  });

  // Protocol clusters: rebuild dependsOn to list data items only, exclude 'time'
  walkNodes(tree, (n) => {
    if (!(n.rmType === 'CLUSTER' && n.aqlPath?.includes('/protocol['))) return;

    const parent = findParentOfNode(tree, n);
    let obs = parent;
    while (obs && obs.rmType !== 'OBSERVATION') obs = findParentOfNode(tree, obs);
    if (!obs) return;

    const deps = [];
    walkNodes(obs, s => {
      if (!s || s === n) return;
      const ap = s.aqlPath || '';
      // data items only (value leaves under items), not protocol/language/encoding/subject or /time
      const isDataItem = /\/data\[[^/]+\]\/events\[[^/]+\]\/data\[[^/]+\]\/items\[[^/]+\]\/value$/.test(ap);
      const isValueType = (s.rmType?.startsWith?.('DV_') || s.rmType === 'DV_COUNT');
      const isTime = /\/events\[[^/]+\]\/time$/.test(ap);
      if (isDataItem && isValueType && s.id && !isTime) deps.push({ id: s.id, aql: ap });
    });
    deps.sort((a, b) => a.aql.localeCompare(b.aql));
    if (deps.length) n.dependsOn = deps.map(d => d.id);
  });
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

      const langKey = lang || 'en';
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

function collectAnnotations(rootObj) {
  const out = {};

  function visit(node, archId) {
    if (!node || typeof node !== 'object') return;
    const nextArchId = extractStringValue(node, 'archetype_id.value') || archId;

    const tdefs = node.term_definitions
      ? (Array.isArray(node.term_definitions) ? node.term_definitions : [node.term_definitions])
      : [];

    for (const td of tdefs) {
      const code = td?.code || td?.$?.code;
      if (!code || !nextArchId) continue;

      const items = td.items ? (Array.isArray(td.items) ? td.items : [td.items]) : [];
      const comment = items.find(it => (it?.id || it?.$?.id) === 'comment');

      if (comment) {
        const commentVal = (typeof comment === 'string') ? comment : (comment?._ ?? comment?.value ?? '');
        if (commentVal) {
          out[nextArchId] ||= {};
          out[nextArchId][code] = { comment: commentVal };
        }
      }
    }

    for (const k of Object.keys(node)) visit(node[k], nextArchId || archId);
  }

  const rootArchId = extractStringValue(rootObj, 'definition.archetype_id.value') || null;
  visit(rootObj, rootArchId);

  return out;
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

// Like resolveTerm, but also returns the language used (for fallback marking)
function resolveTermWithLang(tables, archId, code, langOrder) {
  if (!archId || !code) return {};
  const perCode = tables[archId]?.[code];
  if (!perCode) return {};
  
  for (const lang of langOrder) {
    if (lang === '*') {
      for (const [l, t] of Object.entries(perCode)) {
        // Return if term exists, regardless of whether text/description are empty
        if (t?.text !== undefined || t?.description !== undefined) {
          return { ...t, lang: l };
        }
      }
    } else if (perCode[lang]) {
      const t = perCode[lang];
      // Return if term exists, regardless of whether text/description are empty
      if (t.text !== undefined || t.description !== undefined) {
        return { ...t, lang };
      }
    }
  }
  return {};
}

// === Inputs extraction =======================================================

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

    const localizedLabels = { [langOrder[0]]: term.text || '' };
    const localizedDescriptions = { [langOrder[0]]: term.description || '' };

    rows.push({
      value: code,
      label: term.text || '',
      localizedLabels,
      localizedDescriptions,
      ...(Number.isFinite(ordinal) ? { ordinal } : {})
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
        const term = resolveTermWithLang(termDefsByArch, archId, code, langOrder) || {};
        
        // FIXED: Use term.text if defined (even if empty), otherwise use code
        const labelClean = term.text !== undefined ? term.text : code;
        
        const usedFallback = term.lang && term.lang !== langOrder[0];
        
        // Only apply "*" prefix if we have non-empty text AND used fallback
        const displayLabel = (usedFallback && labelClean) ? `*${labelClean}` : labelClean;

        const localizedLabels = { [langOrder[0]]: displayLabel };
        if (term.lang && labelClean) localizedLabels[term.lang] = labelClean;

        const localizedDescriptions = { [langOrder[0]]: term.description || '' };
        if (term.lang) localizedDescriptions[term.lang] = term.description || '';

        codes.push({
          value: code,
          label: displayLabel,
          localizedLabels,
          localizedDescriptions
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

// === ID/slug helpers =========================================================

function slugifyAD(s) {
  if (!s) return '';
  let t = String(s).trim();

  // Preserve a leading "Qn." prefix as "qn."
  const m = t.match(/^\s*q\s*(\d+)\.\s*/i);
  let prefix = '';
  if (m) {
    prefix = `q${m[1]}.`;
    t = t.replace(/^\s*q\s*\d+\.\s*/i, '');
  }

  t = t.toLowerCase();

  // Normalize unicode dashes
  t = t.replace(/[\u2012\u2013\u2014\u2212]/g, '-');

  // Remove quotes and parentheses
  t = t.replace(/[()'\"]/g, '');

  // Replace non-alphanum (except dot) with underscores
  t = t.replace(/[^a-z0-9.]+/g, '_');

  // Collapse multiple underscores and trim
  t = t.replace(/_+/g, '_').replace(/^_+|_+$/g, '');

  // Avoid underscore immediately after the preserved dot
  t = t.replace(/^(\w+\.)_/, '$1');

  return prefix ? `${prefix}${t}` : t;
}

function generateNodeId(nodeId, name) {
  const base = name || nodeId || 'node';
  return slugifyAD(base);
}

// === Public normalizer =======================================================

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
