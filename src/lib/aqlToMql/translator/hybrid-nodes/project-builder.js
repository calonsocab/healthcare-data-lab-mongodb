// lib/aqlToMql/translator/hybrid-nodes/project-builder.js

import { buildVariableNameForPath } from './addfields-builder';

/**
 * Build the MongoDB $project stage for the SELECT clause.
 * 
 * @param {Object} ast - The AQL Abstract Syntax Tree
 * @param {Object} containsInfo - Information from the parsed CONTAINS clauses
 * @returns {Object} MongoDB $project stage
 */
export function buildProjectStage(ast, containsInfo) {
  // Initialize the project stage
  const projectStage = {};
  
  // Always include _id in the result
  projectStage._id = 1;
  
  // Return empty if there's no SELECT clause
  if (!ast || !ast.select) {
    return projectStage;
  }
  
  // Extract columns from the SELECT clause
  const columns = Array.isArray(ast.select.columns) 
    ? ast.select.columns 
    : (typeof ast.select.columns === 'object' ? Object.values(ast.select.columns) : []);
  
  // Process each column
  columns.forEach(column => {
    let path = '';
    let alias = '';
    
    // Extract the path and alias based on the column format
    if (column.value && column.value.path) {
      path = column.value.path;
      alias = column.alias || column.name || '';
    } else if (column.path) {
      path = column.path;
      alias = column.alias || column.name || '';
    } else if (column.aqlPath) {
      path = column.aqlPath;
      alias = column.aqlColumn || '';
    }
    
    if (path) {
      // Build the projection for this column
      buildColumnProjection(path, alias, projectStage);
    }
  });
  
  return projectStage;
}

/**
 * Build a projection for a SELECT column.
 * 
 * @param {string} path - AQL path (e.g., "ev/data[at0001]/items[at0002]/value/value")
 * @param {string} alias - Column alias or name
 * @param {Object} projectStage - Object being populated with projections
 */
function buildColumnProjection(path, alias, projectStage) {
  // Split the path to get the alias and the rest
  const pathParts = path.split('/');
  
  if (pathParts.length < 2) {
    // Simple field, just include it
    projectStage[alias || path] = `${path}`;
    return;
  }
  
  const entityAlias = pathParts[0];
  const restPath = pathParts.slice(1).join('/');
  
  // Use the alias if provided, otherwise generate a field name from the path
  const outputField = alias || path.replace(/\//g, '_').replace(/[\[\]]/g, '_');
  
  // Check if this is a complex path with archetype IDs
  if (restPath.includes('[') && restPath.includes(']')) {
    buildComplexPathProjection(entityAlias, restPath, outputField, projectStage);
  } else {
    buildSimplePathProjection(entityAlias, restPath, outputField, projectStage);
  }
}

/**
 * Build a projection for a complex path with archetype IDs.
 * 
 * @param {string} entityAlias - Entity alias (e.g., "ev")
 * @param {string} path - Path after the entity alias (e.g., "data[at0001]/items[at0002]/value/value")
 * @param {string} outputField - Field name for the output
 * @param {Object} projectStage - Object being populated with projections
 */
function buildComplexPathProjection(entityAlias, path, outputField, projectStage) {
  // Generate a variable name for this path (used in $addFields)
  const varName = buildVariableNameForPath(entityAlias, path);
  
  // Check if path ends with /value or /value/value
  if (path.endsWith('/value/value')) {
    projectStage[outputField] = `${varName}.d.v.v`;
  } else if (path.endsWith('/value')) {
    projectStage[outputField] = `${varName}.d.v`;
  } else if (path.endsWith('/value/defining_code/code_string')) {
    projectStage[outputField] = `${varName}.d.v.df.cs`;
  } else if (path.endsWith('/value/magnitude')) {
    projectStage[outputField] = `${varName}.d.v.magnitude`;
  } else {
    // Extract the last segment for a generic case
    const segments = path.split('/');
    const lastSegment = segments[segments.length - 1];
    
    // Remove any archetype ID
    const cleanSegment = lastSegment.replace(/\[[^\]]*\]/g, '');
    
    // We'll try a few common patterns
    projectStage[outputField] = {
      $ifNull: [
        `${varName}.d.${mapFieldToShorthand(cleanSegment)}`,
        `${varName}.d.v.${mapFieldToShorthand(cleanSegment)}`,
        `${varName}.d.${mapFieldToShorthand(cleanSegment)}.v`,
        null
      ]
    };
  }
}

/**
 * Build a projection for a simple path without archetype IDs.
 * 
 * @param {string} entityAlias - Entity alias (e.g., "ev")
 * @param {string} path - Path after the entity alias (e.g., "uid/value")
 * @param {string} outputField - Field name for the output
 * @param {Object} projectStage - Object being populated with projections
 */
function buildSimplePathProjection(entityAlias, path, outputField, projectStage) {
  // Handle some common paths
  if (path === 'uid/value') {
    projectStage[outputField] = `${entityAlias}.d.uid.v`;
  } else if (path === 'time/value') {
    projectStage[outputField] = `${entityAlias}.d.time.v`;
  } else if (path === 'context/start_time/value') {
    projectStage[outputField] = `${entityAlias}.d.cx.st.v`;
  } else {
    // Convert the path to dot notation with shortened field names
    const segments = path.split('/');
    const mongoPath = segments.map(mapFieldToShorthand).join('.');
    
    projectStage[outputField] = `${entityAlias}.d.${mongoPath}`;
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

/**
 * Handle aggregate functions in the SELECT clause.
 * 
 * @param {Object} aggregateFunc - Aggregate function information
 * @param {string} outputField - Field name for the output
 * @param {Object} projectStage - Object being populated with projections
 */
function buildAggregateProjection(aggregateFunc, outputField, projectStage) {
  if (!aggregateFunc || !aggregateFunc.name) {
    return;
  }
  
  const funcName = aggregateFunc.name.toUpperCase();
  const path = aggregateFunc.args || '';
  
  // Handle different types of aggregate functions
  switch (funcName) {
    case 'COUNT':
      // For COUNT, we use $size on an array
      projectStage[outputField] = { $size: getPathForCount(path) };
      break;
    
    case 'MAX':
      projectStage[outputField] = { $max: getPathForAggregate(path) };
      break;
    
    case 'MIN':
      projectStage[outputField] = { $min: getPathForAggregate(path) };
      break;
    
    case 'AVG':
      projectStage[outputField] = { $avg: getPathForAggregate(path) };
      break;
    
    case 'SUM':
      projectStage[outputField] = { $sum: getPathForAggregate(path) };
      break;
    
    default:
      // Unknown aggregate function
      projectStage[outputField] = null;
  }
}

/**
 * Get the MongoDB path for COUNT function.
 * 
 * @param {string} path - The path to count
 * @returns {string} MongoDB expression for COUNT
 */
function getPathForCount(path) {
  // Remove surrounding brackets if present in the path
  const cleanPath = path.replace(/^\(|\)$/g, '').trim();
  
  // Split the path to get the alias and the rest
  const pathParts = cleanPath.split('/');
  
  if (pathParts.length < 2) {
    // Simple field
    return `${cleanPath}`;
  }
  
  const entityAlias = pathParts[0];
  const restPath = pathParts.slice(1).join('/');
  
  // For complex paths with archetype IDs, we might need a different approach
  // Here we just return a simple array reference as an example
  return `${entityAlias}_${restPath.replace(/\//g, '_').replace(/[\[\]]/g, '_')}`;
}

/**
 * Get the MongoDB path for other aggregate functions.
 * 
 * @param {string} path - The path for aggregation
 * @returns {string} MongoDB expression for aggregation
 */
function getPathForAggregate(path) {
  // Similar logic to getPathForCount, but might need adjustments
  // based on the specific aggregate function and path format
  return getPathForCount(path);
}

export default buildProjectStage;