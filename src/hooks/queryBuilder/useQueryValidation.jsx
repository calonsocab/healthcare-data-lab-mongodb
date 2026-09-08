// //hooks/queryBuilder/useQueryValidation.jsx
"use client";

import { useCallback, useState } from 'react';
import { buildNodePath } from './utils/pathUtils';
import { AQL_RESERVED_WORDS, AQL_RM_CONTAINMENT } from "@/lib/aqlLexicon";

export const useQueryValidation = (queryState, activeTemplates) => {
  const [validationErrors, setValidationErrors] = useState({});

  // Check if a variable name is valid
  const isVariableNameValid = useCallback((name) => {
    if (!name) return false;

    // Must start with a letter and contain only letters, numbers, and underscores
    const validPattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;

    // Must not be an AQL reserved word
    return validPattern.test(name) && !AQL_RESERVED_WORDS.includes(name.toUpperCase());
  }, []);

  // Check if a variable is referenced elsewhere in the query
  const isVariableReferenced = useCallback((containsItem) => {
    if (!containsItem || !containsItem.alias) return false;
    
    const variableName = containsItem.alias;
    
    // Check if variable is used in SELECT
    const usedInSelect = queryState.select.some(item => {
      if (item.type === 'variable') {
        return item.variable === variableName;
      } else if (item.type === 'path') {
        const path = buildNodePath(item.template, item.node, queryState.contains);
        return path.startsWith(variableName);
      }
      return false;
    });
    
    // Check if variable is used in WHERE
    const usedInWhere = queryState.where.some(condition => {
      if (condition.type === 'exists') {
        return condition.path.startsWith(variableName);
      } else if (condition.type !== 'parameter') {
        const path = buildNodePath(condition.template, condition.node, queryState.contains);
        return path.startsWith(variableName);
      }
      return false;
    });
    
    // Check if variable is used in ORDER BY
    const usedInOrderBy = queryState.orderBy.some(item => {
      const path = buildNodePath(item.template, item.node, queryState.contains);
      return path.startsWith(variableName);
    });
    
    return usedInSelect || usedInWhere || usedInOrderBy;
  }, [queryState]);

  // Function to check if a parent can contain a child according to the reference model
  const isValidContainment = useCallback((parentNode, childNode) => {
    if (!parentNode || !childNode) return false;

    const parentType = parentNode.rmType?.toUpperCase();
    const childType = childNode.rmType?.toUpperCase();

    if (!parentType || !childType) return false;

    // Special case for EHR root (allows any root level archetype)
    if (parentType === 'EHR') return true;

    // Check if parent can contain this child type
    return AQL_RM_CONTAINMENT[parentType] && AQL_RM_CONTAINMENT[parentType].includes(childType);
  }, []);

  // Validate the entire query
  const validateQuery = useCallback(() => {
    const errors = {};

    // Check for duplicate variables in CONTAINS clauses
    const variableNames = new Map();
    queryState.contains.forEach((item, index) => {
      if (item.alias) {
        if (variableNames.has(item.alias)) {
          errors[`contains_${index}`] = `Duplicate variable name '${item.alias}' used in CONTAINS clause`;
        } else {
          variableNames.set(item.alias, index);
        }
      }
    });

    queryState.contains.forEach((item, index) => {
      if (item.alias && !isVariableNameValid(item.alias)) {
        errors[`contains_alias_${index}`] = `Invalid variable name '${item.alias}' - must start with a letter and contain only letters, numbers, and underscores`;
      }
    });
  
    // Check for missing required variables (only if referenced elsewhere)
    queryState.contains.forEach((item, index) => {
      if (!item.alias && isVariableReferenced(item)) {
        errors[`contains_required_${index}`] = `Variable name is required for this node because it's referenced in other parts of the query`;
      }
    });
  
    // Check for empty SELECT clause
    if (activeTemplates.length > 0 && queryState.select.length === 0) {
      errors['select_empty'] = 'SELECT clause is empty - must select at least one item';
    }
  
    // Check for invalid containment relationships
    queryState.contains.forEach((item, index) => {
      if (item.parentIndex !== null && item.parentIndex !== undefined) {
        const parentNode = queryState.contains[item.parentIndex]?.node;
        const childNode = item.node;
        
        if (parentNode && childNode) {
          const parentType = parentNode.rmType?.toUpperCase();
          const childType = childNode.rmType?.toUpperCase();
          
          if (!isValidContainment(parentNode, childNode)) {
            errors[`contains_invalid_${index}`] = `Invalid containment relationship: ${parentType} cannot contain ${childType} according to openEHR reference model`;
          }
        }
      }
    });
  
    // Check for invalid WHERE conditions
    queryState.where.forEach((condition, index) => {
      if (condition.type !== 'exists' && condition.type !== 'parameter') {
        if (!condition.operator) {
          errors[`where_${index}_operator`] = 'WHERE condition is missing an operator';
        }
  
        if (condition.value === '' && !['IS NULL', 'IS NOT NULL'].includes(condition.operator)) {
          errors[`where_${index}_value`] = 'WHERE condition is missing a value';
        }
      }
    });
  
    // Check for invalid LIMIT and OFFSET values
    if (queryState.limit && !/^\d+$/.test(queryState.limit)) {
      errors['limit'] = 'LIMIT must be a positive integer';
    }
  
    if (queryState.offset && !/^\d+$/.test(queryState.offset)) {
      errors['offset'] = 'OFFSET must be a positive integer';
    }
  
    // Special check for missing variable when referenced in path
    queryState.select.forEach((item, index) => {
      if (item.type === 'path') {
        const path = buildNodePath(item.template, item.node, queryState.contains);
        const variablePart = path.split('/')[0];
        
        // If path starts with a variable name
        if (variablePart && !path.startsWith('/')) {
          // Check if this variable exists in contains
          const variableExists = queryState.contains.some(
            containsItem => containsItem.alias === variablePart
          );
          
          if (!variableExists) {
            errors[`select_${index}_missing_variable`] = `Path '${path}' references undefined variable '${variablePart}'`;
          }
        }
      }
    });
  
    // Similar checks for WHERE and ORDER BY clauses that reference variables
    queryState.where.forEach((condition, index) => {
      if (condition.type !== 'exists' && condition.type !== 'parameter') {
        const path = buildNodePath(condition.template, condition.node, queryState.contains);
        const variablePart = path.split('/')[0];
        
        if (variablePart && !path.startsWith('/')) {
          const variableExists = queryState.contains.some(
            containsItem => containsItem.alias === variablePart
          );
          
          if (!variableExists) {
            errors[`where_${index}_missing_variable`] = `Path '${path}' references undefined variable '${variablePart}'`;
          }
        }
      }
    });
  
    queryState.orderBy.forEach((item, index) => {
      const path = buildNodePath(item.template, item.node, queryState.contains);
      const variablePart = path.split('/')[0];
      
      if (variablePart && !path.startsWith('/')) {
        const variableExists = queryState.contains.some(
          containsItem => containsItem.alias === variablePart
        );
        
        if (!variableExists) {
          errors[`orderBy_${index}_missing_variable`] = `Path '${path}' references undefined variable '${variablePart}'`;
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [activeTemplates, queryState, isVariableNameValid, isVariableReferenced, isValidContainment]);

  return {
    isVariableNameValid,
    isVariableReferenced,
    validateQuery,
    isValidContainment,
    validationErrors
  };
};