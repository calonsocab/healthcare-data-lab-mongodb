// lib/aqlToMql/translator/hybrid-nodes/options-builder.js

import { buildVariableNameForPath } from './addfields-builder';

/**
 * Build MongoDB stages for query options (ORDER BY, LIMIT, OFFSET).
 * 
 * @param {Object} ast - The AQL Abstract Syntax Tree
 * @returns {Array} Array of MongoDB pipeline stages
 */
export function buildOptionsStages(ast) {
  const stages = [];
  
  // Add sorting stage if ORDER BY is present
  if (ast.orderBy) {
    const sortStage = buildSortStage(ast.orderBy);
    if (sortStage && Object.keys(sortStage.$sort || {}).length > 0) {
      stages.push(sortStage);
    }
  }
  
  // Add LIMIT stage if present
  if (ast.limit !== null && ast.limit !== undefined) {
    const limit = parseInt(ast.limit, 10);
    if (!isNaN(limit) && limit > 0) {
      stages.push({ $limit: limit });
    }
  }
  
  // Add OFFSET (skip) stage if present
  if (ast.offset !== null && ast.offset !== undefined) {
    const offset = parseInt(ast.offset, 10);
    if (!isNaN(offset) && offset > 0) {
      stages.push({ $skip: offset });
    }
  }
  
  return stages;
}

/**
 * Build the MongoDB $sort stage for ORDER BY clause.
 * 
 * @param {Object} orderBy - ORDER BY clause from the AST
 * @returns {Object} MongoDB $sort stage
 */
function buildSortStage(orderBy) {
  const sort = {};
  
  // Extract sort items from the ORDER BY clause
  const sortItems = Array.isArray(orderBy) 
    ? orderBy 
    : (typeof orderBy === 'object' ? Object.values(orderBy) : []);
  
  // Process each sort item
  sortItems.forEach(item => {
    let path = '';
    let direction = 1; // Default: ascending
    
    // Extract path and direction based on the item format
    if (item.path) {
      path = item.path;
      direction = (item.direction && item.direction.toUpperCase() === 'DESC') ? -1 : 1;
    } else if (item.aqlPath) {
      path = item.aqlPath;
      direction = (item.direction && item.direction.toUpperCase() === 'DESC') ? -1 : 1;
    }
    
    if (path) {
      // Build the sort field
      const sortField = buildSortField(path);
      if (sortField) {
        sort[sortField] = direction;
      }
    }
  });
  
  return Object.keys(sort).length > 0 ? { $sort: sort } : {};
}

/**
 * Build a MongoDB sort field from an AQL path.
 * 
 * @param {string} path - AQL path (e.g., "ev/data[at0001]/items[at0002]/value/value")
 * @returns {string} MongoDB field for sorting
 */
function buildSortField(path) {
  // Split the path to get the alias and the rest
  const pathParts = path.split('/');
  
  if (pathParts.length < 2) {
    // Simple field
    return path;
  }
  
  const entityAlias = pathParts[0];
  const restPath = pathParts.slice(1).join('/');
  
  // Check if this is a complex path with archetype IDs
  if (restPath.includes('[') && restPath.includes(']')) {
    return buildComplexSortField(entityAlias, restPath);
  } else {
    return buildSimpleSortField(entityAlias, restPath);
  }
}

/**
 * Build a MongoDB sort field for a complex path with archetype IDs.
 * 
 * @param {string} entityAlias - Entity alias (e.g., "ev")
 * @param {string} path - Path after the entity alias (e.g., "data[at0001]/items[at0002]/value/value")
 * @returns {string} MongoDB field for sorting
 */
function buildComplexSortField(entityAlias, path) {
  // Generate a variable name for this path (used in $addFields)
  const varName = buildVariableNameForPath(entityAlias, path);
  
  // Handle common path patterns
  if (path.endsWith('/value/value')) {
    return `${varName}.d.v.v`;
  } else if (path.endsWith('/value')) {
    return `${varName}.d.v`;
  } else if (path.endsWith('/value/defining_code/code_string')) {
    return `${varName}.d.v.df.cs`;
  } else if (path.endsWith('/value/magnitude')) {
    return `${varName}.d.v.magnitude`;
  } else if (path.endsWith('/time/value')) {
    return `${varName}.d.time.v`;
  } else {
    // Default for other patterns
    return varName;
  }
}

/**
 * Build a MongoDB sort field for a simple path without archetype IDs.
 * 
 * @param {string} entityAlias - Entity alias (e.g., "ev")
 * @param {string} path - Path after the entity alias (e.g., "uid/value")
 * @returns {string} MongoDB field for sorting
 */
function buildSimpleSortField(entityAlias, path) {
  // Handle common simple paths
  if (path === 'uid/value') {
    return `${entityAlias}.d.uid.v`;
  } else if (path === 'time/value') {
    return `${entityAlias}.d.time.v`;
  } else if (path === 'context/start_time/value') {
    return `${entityAlias}.d.cx.st.v`;
  } else {
    // Convert the path to dot notation with shortened field names
    const segments = path.split('/');
    const mongoPath = segments.map(mapFieldToShorthand).join('.');
    
    return `${entityAlias}.d.${mongoPath}`;
  }
}

/**
 * Map field names to their shorthand forms.
 * 
 * @param {string} field - Field name
 * @returns {string} Shorthand form of the field name
 */
function mapFieldToShorthand(field) {
  const fieldMap = {
    'value': 'v',
    'magnitude': 'magnitude',
    'units': 'units',
    'name': 'n',
    'archetype_node_id': 'ani',
    'archetype_details': 'ad',
    'context': 'cx',
    'items': 'i',
    'defining_code': 'df',
    'code_string': 'cs',
    'terminology_id': 'tid'
  };
  
  return fieldMap[field] || field;
}

export default buildOptionsStages;