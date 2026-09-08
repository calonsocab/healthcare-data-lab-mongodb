// lib/aqlToMql/translator/hybrid-nodes/where-parser.js

import { parseAqlPath, processValueForMongo, extractArchetypeIdsFromPath } from '../path-utils';
import { mapOperatorToMongo } from '../dictionary';

export function parseWhereConditions(ast, containsInfo) {
  const whereInfo = {
    conditions: [],
    logicalTree: null,
    ehrIdCondition: null,
    unhandledConditions: []
  };
  
  if (!ast || !ast.where) {
    return whereInfo;
  }
  
  try {
    if (ast.where.path && ast.where.operator) {
      whereInfo.logicalTree = processSingleCondition(ast.where);
    } else if (ast.where.operator && ast.where.conditions) {
      whereInfo.logicalTree = processLogicalGroupRecursively(ast.where);
    }
    flattenLogicalTree(whereInfo.logicalTree, whereInfo.conditions);
    fixIncompleteConditions(whereInfo);
  } catch (error) {
    console.error("[WHERE Parser] Error parsing WHERE conditions:", error);
  }
  
  return whereInfo;
}

function processSingleCondition(condition) {
  const { alias, path } = parseAqlPath(condition.path);
  const parsedCondition = {
    path: condition.path,
    pathComponents: { alias, path },
    operator: condition.operator,
    mongoOperator: mapOperatorToMongo(condition.operator),
    value: condition.value,
    mongoValue: processValueForMongo(condition.value, condition.operator),
    archetypeIds: extractArchetypeIdsFromPath(path || '')
  };
  if (condition.path.includes('ehr_id/value')) {
    parsedCondition.isEhrIdCondition = true;
  }
  return parsedCondition;
}

function processLogicalGroupRecursively(group) {
  const children = [];
  Object.values(group.conditions).forEach(child => {
    if (child.path && child.operator) {
      children.push(processSingleCondition(child));
    } else if (child.operator && child.conditions) {
      children.push(processLogicalGroupRecursively(child));
    }
  });
  
  if (group.operator === 'AND') {
    return { $and: children };
  } else if (group.operator === 'OR') {
    return { $or: children };
  }
  return { $and: children };
}

function flattenLogicalTree(tree, flatConditions) {
  if (!tree) return;
  if (tree.$and || tree.$or) {
    const operator = tree.$and ? '$and' : '$or';
    tree[operator].forEach(child => flattenLogicalTree(child, flatConditions));
  } else {
    flatConditions.push(tree);
  }
}

function fixIncompleteConditions(whereInfo) {
  whereInfo.conditions.forEach((cond, i) => {
    if (!cond.operator) {
      console.warn(`[WHERE Parser] Condition at index ${i} is missing operator, defaulting to '='`);
      cond.operator = '=';
      cond.mongoOperator = '$eq';
    }
    if (cond.value === null || cond.value === undefined) {
      console.warn(`[WHERE Parser] Condition at index ${i} is missing value, defaulting to null`);
      cond.value = null;
      cond.mongoValue = null;
    }
    if (cond.operator === 'MATCHES' && cond.path && cond.path.endsWith('/value/defining_code/code_string')) {
      if (!Array.isArray(cond.mongoValue)) {
        if (typeof cond.mongoValue === 'string') {
          if (cond.mongoValue.startsWith('{') && cond.mongoValue.endsWith('}')) {
            const innerValue = cond.mongoValue.substring(1, cond.mongoValue.length - 1);
            cond.mongoValue = innerValue.split(',')
              .map(v => v.trim())
              .map(v => (v.startsWith("'") && v.endsWith("'") ? v.substring(1, v.length - 1) : v));
          } else {
            cond.mongoValue = [cond.mongoValue];
          }
        } else {
          cond.mongoValue = [cond.mongoValue];
        }
      }
    }
  });
}

export default parseWhereConditions;