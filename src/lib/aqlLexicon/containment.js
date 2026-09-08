// src/lib/aqlLexicon/containment.js

// Canonical RM parent→child containment used in AQL CONTAINS
export const AQL_RM_CONTAINMENT = {
  EHR: ['COMPOSITION'],
  COMPOSITION: ['SECTION','OBSERVATION','EVALUATION','INSTRUCTION','ACTION','ADMIN_ENTRY'],
  SECTION: ['SECTION','OBSERVATION','EVALUATION','INSTRUCTION','ACTION','ADMIN_ENTRY'],
  OBSERVATION: ['CLUSTER'],
  EVALUATION: ['CLUSTER'],
  INSTRUCTION: ['CLUSTER'],
  ACTION: ['CLUSTER'],
  ADMIN_ENTRY: ['CLUSTER'],
  CLUSTER: ['CLUSTER']
};

export function isCanonicalContainment(parentType, childType) {
  if (!parentType || !childType) return false;
  const p = String(parentType).toUpperCase();
  const c = String(childType).toUpperCase();
  return Array.isArray(AQL_RM_CONTAINMENT[p]) && AQL_RM_CONTAINMENT[p].includes(c);
}

// Eligible children for the template tree in CONTAINS context
export const AQL_CONTAINABLE_TYPES = new Set(Object.values(AQL_RM_CONTAINMENT).flat());

// TreeView predicate
export function isContainableNode(node) {
  const t = node?.rmType?.toUpperCase();
  return !!t && AQL_CONTAINABLE_TYPES.has(t);
}