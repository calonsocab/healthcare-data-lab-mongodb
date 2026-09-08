// src/lib/templates/webTemplate.js


export function extractCompositionArchetypeId(template) {
  return template?.webTemplate?.nodeId || "unknown";
}

export function extractTemplateVersion(name) {
  const m = (name || "").match(/(.+?)(?:[_\\s-]?[vV](\\d+(?:\\.\\d+)*))$/);
  return m ? { baseName: m[1].trim(), version: m[2] } : { baseName: name, version: null };
}

export function groupTemplatesByName(templates) {
  const groups = {};
  (templates || []).forEach(t => {
    const { baseName, version } = extractTemplateVersion(t.name);
    groups[baseName] ||= [];
    groups[baseName].push({ ...t, baseTemplateName: baseName, templateVersion: version });
  });
  Object.keys(groups).forEach(k => {
    groups[k].sort((a, b) => {
      if (!a.templateVersion) return 1;
      if (!b.templateVersion) return -1;
      return -a.templateVersion.localeCompare(b.templateVersion, undefined, { numeric: true });
    });
  });
  return groups;
}

export function groupTemplatesByComposition(templates) {
  const groups = {};
  (templates || []).forEach(t => {
    const id = extractCompositionArchetypeId(t);
    groups[id] ||= [];
    groups[id].push(t);
  });
  return groups;
}

export function computeWebTemplateMetadata(tree, extras = {}) {
  if (!tree) throw new Error('computeWebTemplateMetadata: missing tree');

  const languages = new Set(Object.keys(tree.localizedNames || {}));
  const datatypes = new Set();
  const terminologies = new Set();

  let nodeCount = 0, valueNodeCount = 0, repeatingNodeCount = 0;
  let compositionKind;

  // dedupe by nodeId
  const archetypeMap = new Map(); // nodeId -> { rmType, nodeId, name }

  const walk = (n) => {
    if (!n) return;
    nodeCount++;

    Object.keys(n.localizedNames || {}).forEach(l => languages.add(l));

    const name = n.localizedName || n.name || undefined;

    if (n.nodeId && /^openEHR-/.test(n.nodeId)) {
      if (!archetypeMap.has(n.nodeId)) {
        archetypeMap.set(n.nodeId, { rmType: n.rmType, nodeId: n.nodeId, name });
      }
    }

    if (/^DV_/.test(n.rmType || '')) {
      datatypes.add(n.rmType);
      valueNodeCount++;
    }

    if (typeof n.max === 'number' && (n.max === -1 || n.max > 1)) {
      repeatingNodeCount++;
    }

    if (Array.isArray(n.inputs)) {
      n.inputs.forEach(inp => {
        if (inp?.terminology) terminologies.add(String(inp.terminology).toLowerCase());
      });
    }

    if (!compositionKind && n.aqlPath?.endsWith('/category') && n.rmType === 'DV_CODED_TEXT') {
      const has = (label, code) =>
        (n.inputs || []).some(inp =>
          inp?.terminology?.toLowerCase() === 'openehr' &&
          (inp.list || []).some(x =>
            (x.label && String(x.label).toLowerCase().includes(label)) || String(x.code) === code
          )
        );
      if (has('event', '433')) compositionKind = 'event';
      else if (has('persistent', '431')) compositionKind = 'persistent';
    }

    (n.children || []).forEach(walk);
  };
  walk(tree);

  if (languages.size === 0 && extras.defaultLanguage) languages.add(extras.defaultLanguage);

  return {
    templateId: extras.templateId || tree.id || tree.name || '',
    node: tree.nodeId || '',
    description: (tree.localizedDescriptions && tree.localizedDescriptions.en) || '',
    compositionKind: compositionKind || undefined,
    archetypes: Array.from(archetypeMap.values()),
    datatypes: Array.from(datatypes),
    languages: Array.from(languages),
    terminologies: Array.from(terminologies),
    counts: { nodeCount, valueNodeCount, repeatingNodeCount }
  };
}

// facets for filters (strings)
export function collectTemplateFacets(templates = []) {
  const langs = new Set(), terms = new Set(), dtypes = new Set(), compositions = new Set();

  templates.forEach(t => {
    const md = t?.metadata || {};
    (md.languages || []).forEach(v => langs.add(v));
    (md.terminologies || []).forEach(v => terms.add(v));
    (md.datatypes || []).forEach(v => dtypes.add(v));
    const comp = t?.webTemplate?.nodeId;
    if (comp) compositions.add(comp);
  });

  return {
    languages: [...langs].sort(),
    terminologies: [...terms].sort(),
    datatypes: [...dtypes].sort(),
    compositions: [...compositions].sort()
  };
}

export function getNodeArchetypeId(node) {
  return node?.nodeId || node?.archetype_id || node?.node_id || null;
}

export function traverseTemplate(node, currentPath, registry) {
  if (!node) return;
  const key = getNodeArchetypeId(node);
  if (key) {
    registry[key] ||= [];
    registry[key].push(currentPath);
  }
  if (Array.isArray(node.children)) {
    node.children.forEach((child, i) => {
      const seg =
        child?.name ||
        child?.localizedName ||
        getNodeArchetypeId(child) ||
        `child${i}`;
      traverseTemplate(child, `${currentPath}/${seg}`, registry);
    });
  }
}

export function saveWebTemplateAsJSON(webTemplate, fileName = 'web-template.json') {
  const pretty = JSON.stringify(webTemplate, null, 2);
  const blob = new Blob([pretty], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
}