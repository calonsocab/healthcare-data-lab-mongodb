// lib/aqlToMql/translator/hybrid-nodes/from-parser.js

import { processValueForMongo } from '../path-utils';

/**
 * Parse the FROM clause of an AQL query to extract ehr_id and determine query type.
 */
export function parseFromClause(ast) {
  const fromInfo = {
    isEhrIdBased: false,
    ehrId: null,
    ehrAlias: 'e',
    containmentStructure: {}
  };
  
  if (!ast || !ast.from) {
    return fromInfo;
  }
  
  try {
    if (ast.from.alias) {
      fromInfo.ehrAlias = ast.from.alias;
    } else if (ast.from.rmType === 'EHR') {
      fromInfo.ehrAlias = ast.from.alias || 'e';
    }
    
    if (ast.from.predicate) {
      if (ast.from.predicate.path === 'ehr_id/value') {
        fromInfo.isEhrIdBased = true;
        fromInfo.ehrId = processValueForMongo(ast.from.predicate.value, ast.from.predicate.operator);
      }
    }
    
    if (!fromInfo.isEhrIdBased && ast.where) {
      if (ast.where.path === `${fromInfo.ehrAlias}/ehr_id/value` || ast.where.path === 'e/ehr_id/value') {
        fromInfo.isEhrIdBased = true;
        fromInfo.ehrId = processValueForMongo(ast.where.value, ast.where.operator);
      } else if (ast.where.operator === 'AND' && ast.where.conditions) {
        Object.values(ast.where.conditions).forEach(condition => {
          if (condition.path === `${fromInfo.ehrAlias}/ehr_id/value` || condition.path === 'e/ehr_id/value') {
            fromInfo.isEhrIdBased = true;
            fromInfo.ehrId = processValueForMongo(condition.value, condition.operator);
          }
        });
      }
    }
    
    buildContainmentStructure(ast.from, fromInfo.containmentStructure);
    
  } catch (error) {
    console.error("[FROM Parser] Error parsing FROM clause:", error);
  }
  
  return fromInfo;
}

function buildContainmentStructure(fromClause, containmentStructure) {
  if (!fromClause) return;
  const rootType = fromClause.rmType || 'EHR';
  const rootAlias = fromClause.alias || 'e';
  containmentStructure[rootAlias] = {
    type: rootType,
    archetype: null,
    children: {}
  };
  if (fromClause.contains) {
    processContains(fromClause.contains, rootAlias, containmentStructure);
  }
}

function processContains(contains, parentAlias, containmentStructure) {
  if (!contains) return;
  if (contains.rmType) {
    const entityType = contains.rmType;
    const entityAlias = contains.alias || '';
    const archetype = contains.predicate && contains.predicate.path === 'archetype_node_id'
                      ? contains.predicate.value
                      : null;
    
    if (containmentStructure[parentAlias] && entityAlias) {
      containmentStructure[parentAlias].children[entityAlias] = {
        type: entityType,
        archetype: archetype,
        children: {}
      };
      if (contains.contains) {
        processContains(contains.contains, entityAlias, containmentStructure);
      }
    }
  } else if (contains.operator === 'AND' && contains.children) {
    Object.values(contains.children).forEach(child => {
      processContains(child, parentAlias, containmentStructure);
    });
  }
}

export default parseFromClause;