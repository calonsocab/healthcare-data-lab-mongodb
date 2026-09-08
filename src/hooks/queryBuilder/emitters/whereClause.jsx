// src/hooks/queryBuilder/emitters/whereClause.jsx
"use client";

import { buildNodePath, cleanupPath } from "../utils/pathUtils";

/**
 * Builds the WHERE clause
 */
 export function buildWhereClause(queryState) {
    const buildConditionString = (condition) => {
      if (condition.type === 'exists') {
        return `${condition.not ? 'NOT ' : ''}EXISTS ${condition.path}`;
      } else if (condition.type === 'parameter') {
        return condition.name;
      } else {
        const path = buildNodePath(condition.template, condition.node, queryState.contains);
        const cleanPath = cleanupPath(path);
        return `${cleanPath} ${condition.operator} ${condition.value}`;
      }
    };
  
    // Group conditions by groupId
    const groupedConditions = {};
    const nonGroupedConditions = [];
  
    queryState.where.forEach(condition => {
      if (condition.groupId) {
        if (!groupedConditions[condition.groupId]) {
          groupedConditions[condition.groupId] = {
            logic: condition.groupLogic || 'AND',
            conditions: []
          };
        }
        groupedConditions[condition.groupId].conditions.push(condition);
      } else {
        nonGroupedConditions.push(condition);
      }
    });
  
    // Build WHERE clause parts
    let whereParts = [];
  
    // Add non-grouped conditions
    nonGroupedConditions.forEach(condition => {
      whereParts.push(buildConditionString(condition));
    });
  
    // Add grouped conditions
    Object.values(groupedConditions).forEach(group => {
      if (group.conditions.length > 0) {
        const groupConditions = group.conditions.map(buildConditionString);
        const groupString = `(${groupConditions.join(` ${group.logic} `)})`;
        whereParts.push(groupString);
      }
    });
  
    return whereParts;
  }