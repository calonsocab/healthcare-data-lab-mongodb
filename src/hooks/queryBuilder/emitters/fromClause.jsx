// src/hooks/queryBuilder/emitters/fromClause.jsx
"use client";

/**
 * Canonical FROM / CONTAINS emitter from queryState.contains.
 * - EHR specific vs population
 * - sibling AND/OR with parentheses if any OR appears
 * - per-node NOT CONTAINS via node.containmentOperator === 'NOT CONTAINS'
 * - node.node.nodeId and node.alias
 * - arbitrary nesting using parentIndex
 */
export function buildFromClause(queryState) {
  const nodes = queryState?.contains || [];
  if (!nodes.length) return "";

  const ehrIndex = nodes.findIndex(n => n.isEhrRoot === true);
  if (ehrIndex !== -1) {
    const ehr = nodes[ehrIndex];
    let out = `FROM EHR ${ehr.alias || "e"}`;
    const isPopulation = !ehr.ehrIdValue || ehr.ehrIdValue.trim() === "";
    if (!isPopulation) out += `[ehr_id/value=${ehr.ehrIdValue}]`;

    const contains = emitChildren(nodes, ehrIndex, 1);
    if (contains) out += contains;
    return out;
  }

  // Non-EHR roots (supported but uncommon)
  const rootIdxs = nodes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => n.parentIndex == null || n.isRoot)
    .map(({ i }) => i);

  if (!rootIdxs.length) return "";

  let out = "FROM ";
  out += rootIdxs
    .map((idx, ix) => emitRoot(nodes, idx, ix > 0))
    .join(",\n    ");
  return out;
}

function emitRoot(nodes, rootIndex, isNotFirst) {
  const n = nodes[rootIndex];
  const alias = n.alias || "_";
  const id = n.node?.nodeId ? `[${n.node.nodeId}]` : "";
  let line = `${n.node?.rmType || n.template} ${alias}${id}`;
  const tail = emitChildren(nodes, rootIndex, 1);
  if (tail) line += tail;
  return isNotFirst ? `    ${line}` : line;
}

function emitChildren(all, parentIndex, indentLevel) {
  const kids = all
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => n.parentIndex === parentIndex);

  if (!kids.length) return "";

  const indent = "    ".repeat(indentLevel);
  const hasOR = kids.some((k, idx) => idx > 0 && (k.n.logicalOperator || "AND") === "OR");

  const first = kids[0];
  const firstIsNot = first.n.containmentOperator === "NOT CONTAINS";
  const head0 = emitNodeHead(first.n);
  let out;

  if (hasOR) {
    out = `\n${indent}${firstIsNot ? "NOT CONTAINS" : "CONTAINS"} (${head0}`;
  } else {
    out = `\n${indent}${firstIsNot ? "NOT CONTAINS" : "CONTAINS"} ${head0}`;
  }

  const deeper0 = emitChildren(all, first.i, indentLevel + 1);
  if (deeper0) out += deeper0;

  for (let s = 1; s < kids.length; s++) {
    const { n: sib, i: sibIdx } = kids[s];
    const join = sib.logicalOperator || "AND";
    const maybeNot = sib.containmentOperator === "NOT CONTAINS" ? "NOT " : "";
    const head = emitNodeHead(sib);
    const deeper = emitChildren(all, sibIdx, indentLevel + 1);
    out += `\n${indent}${join} ${maybeNot}${head}${deeper || ""}`;
  }

  if (hasOR) out += `\n${indent})`;
  return out;
}

function emitNodeHead(nodeItem) {
  const alias = nodeItem.alias || "_";
  const id = nodeItem.node?.nodeId ? `[${nodeItem.node.nodeId}]` : "";
  const rm = nodeItem.node?.rmType || nodeItem.template;
  return `${rm} ${alias}${id}`;
}