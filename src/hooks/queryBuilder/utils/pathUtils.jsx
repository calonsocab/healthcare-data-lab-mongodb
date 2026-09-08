// src/hooks/queryBuilder/utils/pathUtils.jsx
"use client";

/** Simplify common AQL path patterns */
export const cleanupPath = (path) => {
  if (!path) return '';
  let cleanedPath = path.replace(/\[([^,\]]+),'[^']*'\]/g, '[$1]');
  cleanedPath = cleanedPath.replace(/\/\//g, '/');
  if (cleanedPath.endsWith('/')) cleanedPath = cleanedPath.slice(0, -1);
  return cleanedPath;
};

/**
 * Builds a node path for use in AQL queries, preferring aliases from CONTAINS.
 * @param {string} templateName
 * @param {object} node
 * @param {Array|object} containmentVariables  // can be queryState.contains or the whole queryState
 */
export const buildNodePath = (templateName, node, containmentVariables) => {
  if (!node) return "";

  // normalize: accept either the array or the whole queryState
  const vars = Array.isArray(containmentVariables)
    ? containmentVariables
    : (containmentVariables && Array.isArray(containmentVariables.contains))
      ? containmentVariables.contains
      : [];

  // 1) exact match → just use alias (whole object)
  const exactMatch = vars.find(item =>
    item.template === templateName &&
    (item.node?.nodeId === node.nodeId ||
     (node.uniquePath && item.node?.uniquePath === node.uniquePath))
  );
  if (exactMatch?.alias) return exactMatch.alias;

  // 2) nearest ancestor with alias → alias/relative
  const parentCandidates = (vars
    ?.filter(item => item.template === templateName && item.alias)
    .sort((a, b) => (b.node?.aqlPath?.length || 0) - (a.node?.aqlPath?.length || 0))) || [];

  for (const parent of parentCandidates) {
    if (node.aqlPath && isChildPath(parent.node?.aqlPath, node.aqlPath)) {
      let relativePath = node.aqlPath;
      if (parent.node?.aqlPath && relativePath.includes(parent.node.aqlPath)) {
        relativePath = relativePath.substring(
          relativePath.indexOf(parent.node.aqlPath) + parent.node.aqlPath.length
        );
        if (relativePath.startsWith('/')) relativePath = relativePath.substring(1);
      }
      return cleanupPath(`${parent.alias}/${relativePath}`);
    }
  }

  // 2b) fallback to COMPOSITION alias for this template
  const compositionVar = vars.find(
    v => v.template === templateName && v.alias && v.node?.rmType?.toUpperCase() === 'COMPOSITION'
  );
  if (compositionVar && node.aqlPath) {
    const rel = node.aqlPath.replace(/^\/+/, '');
    return cleanupPath(`${compositionVar.alias}/${rel}`);
  }

  // 2c) fallback to EHR alias (rare but harmless)
  const ehrVar = vars.find(v => v.alias && v.node?.rmType?.toUpperCase() === 'EHR');
  if (ehrVar && node.aqlPath) {
    const rel = node.aqlPath.replace(/^\/+/, '');
    return cleanupPath(`${ehrVar.alias}/${rel}`);
  }

  // 3) last resort: raw aqlPath or simple template/path
  if (node.aqlPath) return cleanupPath(node.aqlPath);
  if (node.nodeId) return templateName ? `${templateName}[${node.nodeId}]` : node.nodeId;
  return templateName ? `${templateName}/${node.name}` : node.name;
};

export const isChildPath = (potentialParentPath, childPath) => {
  if (!potentialParentPath || !childPath) return false;
  const norm = (s) => (s || '').replace(/^\/+/, '').replace(/\/+$/, '');
  const p = norm(potentialParentPath);
  const c = norm(childPath);
  if (!p) return true; // empty parent is “root”
  return c.startsWith(p);
};