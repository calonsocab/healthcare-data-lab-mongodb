// lib/aqlToMql/translator/hybrid-nodes/addfields-builder.js

import { buildVariableNameForPath as buildVarName } from '../path-utils';
import { getNodesArrayField, mapRmTypeToShorthand } from '../dictionary';

/**
 * Build the MongoDB $addFields stage to extract referenced entities and elements.
 * 
 * @param {Object} ast - The AQL Abstract Syntax Tree
 * @param {Object} containsInfo - Information from the parsed CONTAINS clauses
 * @param {string} nodeField - Field name for the nodes array ("cn" or "sn")
 * @returns {Object} MongoDB $addFields stage
 */
export function buildAddFieldsStage(ast, containsInfo, nodeField = "cn") {
  // Initialize the addFields stage
  const addFields = {};
  
  // First, extract all the entities referenced in CONTAINS clauses
  buildEntityExtractions(containsInfo, nodeField, addFields);
  
  // Then extract specific paths referenced in SELECT, WHERE, ORDER BY clauses
  if (ast.select) {
    buildSelectPathExtractions(ast.select, containsInfo, nodeField, addFields);
  }
  
  if (ast.where) {
    buildWherePathExtractions(ast.where, containsInfo, nodeField, addFields);
  }
  
  if (ast.orderBy) {
    buildOrderByPathExtractions(ast.orderBy, containsInfo, nodeField, addFields);
  }
  
  return addFields;
}

/**
 * Build extractions for entities referenced in CONTAINS clauses.
 * 
 * @param {Object} containsInfo - Information from the parsed CONTAINS clauses
 * @param {string} nodeField - Field name for the nodes array
 * @param {Object} addFields - Object being populated with extraction expressions
 */
function buildEntityExtractions(containsInfo, nodeField, addFields) {
  // Process each entry in CONTAINS
  if (containsInfo.entries && containsInfo.entries.length > 0) {
    containsInfo.entries.forEach(entry => {
      if (entry.alias && (entry.rmType || entry.archetypeId)) {
        // Build an extraction for this entity
        const conditions = [];
        
        // Add type condition if available
        if (entry.rmType) {
          conditions.push({ $eq: ["$$node.d.T", mapRmTypeToShorthand(entry.rmType)] });
        }
        
        // Add archetype ID condition if available
        if (entry.archetypeId) {
          conditions.push({ 
            $or: [
              { $eq: ["$$node.d.ani", entry.archetypeId] },
              { $eq: ["$$node.d.ad.ai.v", entry.archetypeId] }
            ]
          });
        }
        
        // Add parent relationship condition if this is a nested entity
        if (entry.parentAlias && containsInfo.entriesByAlias && containsInfo.entriesByAlias[entry.parentAlias]) {
          const parentEntry = containsInfo.entriesByAlias[entry.parentAlias];
          if (parentEntry.archetypeId) {
            conditions.push({ 
              $anyElementTrue: {
                $map: {
                  input: { $ifNull: ["$$node.a", []] },
                  as: "ancestor",
                  in: { $eq: ["$$ancestor", parentEntry.archetypeId] }
                }
              }
            });
          }
        }
        
        // Build the $filter expression to extract this entity
        addFields[entry.alias] = {
          $arrayElemAt: [
            {
              $filter: {
                input: `$${nodeField}`,
                as: "node",
                cond: { $and: conditions }
              }
            },
            0
          ]
        };
      }
    });
  }
}

/**
 * Build extractions for paths referenced in SELECT clause.
 * 
 * @param {Object} select - SELECT clause from the AST
 * @param {Object} containsInfo - Information from the parsed CONTAINS clauses
 * @param {string} nodeField - Field name for the nodes array
 * @param {Object} addFields - Object being populated with extraction expressions
 */
function buildSelectPathExtractions(select, containsInfo, nodeField, addFields) {
  // Extract columns from the SELECT clause
  const columns = Array.isArray(select.columns) 
    ? select.columns 
    : (typeof select.columns === 'object' ? Object.values(select.columns) : []);
  
  // Process each column
  columns.forEach(column => {
    let path = '';
    
    // Extract the path based on the column format
    if (column.value && column.value.path) {
      path = column.value.path;
    } else if (column.path) {
      path = column.path;
    } else if (column.aqlPath) {
      path = column.aqlPath;
    }
    
    if (path) {
      // Extract alias and path components
      const pathParts = path.split('/');
      if (pathParts.length >= 2) {
        const alias = pathParts[0];
        const restPath = pathParts.slice(1).join('/');
        
        // Check if this is a complex path with archetype IDs
        if (restPath.includes('[') && restPath.includes(']')) {
          buildComplexPathExtraction(alias, restPath, nodeField, addFields, containsInfo);
        }
      }
    }
  });
}

/**
 * Build extractions for paths referenced in WHERE clause.
 * 
 * @param {Object} where - WHERE clause from the AST
 * @param {Object} containsInfo - Information from the parsed CONTAINS clauses
 * @param {string} nodeField - Field name for the nodes array
 * @param {Object} addFields - Object being populated with extraction expressions
 */
function buildWherePathExtractions(where, containsInfo, nodeField, addFields) {
  // Skip ehr_id conditions as they're not part of the nodes
  if (where.path && !where.path.includes('ehr_id')) {
    const pathParts = where.path.split('/');
    if (pathParts.length >= 2) {
      const alias = pathParts[0];
      const restPath = pathParts.slice(1).join('/');
      
      // Check if this is a complex path with archetype IDs
      if (restPath.includes('[') && restPath.includes(']')) {
        buildComplexPathExtraction(alias, restPath, nodeField, addFields, containsInfo);
      }
    }
  }
  
  // Process logical groups (AND/OR)
  if (where.conditions) {
    Object.values(where.conditions).forEach(condition => {
      if (condition.path && !condition.path.includes('ehr_id')) {
        const pathParts = condition.path.split('/');
        if (pathParts.length >= 2) {
          const alias = pathParts[0];
          const restPath = pathParts.slice(1).join('/');
          
          // Check if this is a complex path with archetype IDs
          if (restPath.includes('[') && restPath.includes(']')) {
            buildComplexPathExtraction(alias, restPath, nodeField, addFields, containsInfo);
          }
        }
      } else if (condition.operator && condition.conditions) {
        // Recursively process nested logical groups
        buildWherePathExtractions(condition, containsInfo, nodeField, addFields);
      }
    });
  }
}

/**
 * Build extractions for paths referenced in ORDER BY clause.
 * 
 * @param {Object} orderBy - ORDER BY clause from the AST
 * @param {Object} containsInfo - Information from the parsed CONTAINS clauses
 * @param {string} nodeField - Field name for the nodes array
 * @param {Object} addFields - Object being populated with extraction expressions
 */
function buildOrderByPathExtractions(orderBy, containsInfo, nodeField, addFields) {
  // Extract sort items from the ORDER BY clause
  const sortItems = Array.isArray(orderBy) 
    ? orderBy 
    : (typeof orderBy === 'object' ? Object.values(orderBy) : []);
  
  // Process each sort item
  sortItems.forEach(item => {
    let path = '';
    
    // Extract the path based on the item format
    if (item.path) {
      path = item.path;
    } else if (item.aqlPath) {
      path = item.aqlPath;
    }
    
    if (path) {
      // Extract alias and path components
      const pathParts = path.split('/');
      if (pathParts.length >= 2) {
        const alias = pathParts[0];
        const restPath = pathParts.slice(1).join('/');
        
        // Check if this is a complex path with archetype IDs
        if (restPath.includes('[') && restPath.includes(']')) {
          buildComplexPathExtraction(alias, restPath, nodeField, addFields, containsInfo);
        }
      }
    }
  });
}

/**
 * Build extraction for a complex path with archetype IDs.
 * This handles paths like "ev/data[at0001]/items[at0002]/value/value"
 * by creating nested filters to extract each archetype node.
 * 
 * @param {string} alias - Path alias (e.g., "ev")
 * @param {string} path - Path after the alias (e.g., "data[at0001]/items[at0002]/value/value")
 * @param {string} nodeField - Field name for the nodes array
 * @param {Object} addFields - Object being populated with extraction expressions
 * @param {Object} containsInfo - Information from the parsed CONTAINS clauses
 */
function buildComplexPathExtraction(alias, path, nodeField, addFields, containsInfo) {
  // Generate a variable name for this path
  const varName = buildVarName(alias, path);
  
  // Don't duplicate extractions
  if (addFields[varName]) {
    return;
  }
  
  // Extract archetype IDs from the path
  const archetypeMatches = path.match(/\[(at\d+|openEHR-EHR-[A-Z_]+\.[a-z_]+\.v\d+)\]/g) || [];
  const archetypeIds = archetypeMatches.map(match => match.substring(1, match.length - 1));
  
  // Get the root entity's archetype ID
  let parentArchetypeId = null;
  if (containsInfo.entriesByAlias && containsInfo.entriesByAlias[alias]) {
    parentArchetypeId = containsInfo.entriesByAlias[alias].archetypeId;
  }
  
  // Build the extraction expression
  if (archetypeIds.length > 0) {
    const conditions = [];
    
    // Add condition for the last archetype ID
    const lastArchetypeId = archetypeIds[archetypeIds.length - 1];
    conditions.push({ 
      $or: [
        { $eq: ["$$node.d.ani", lastArchetypeId] },
        { $eq: ["$$node.d.ad.ai.v", lastArchetypeId] }
      ]
    });
    
    // Add condition for the parent entity
    if (parentArchetypeId) {
      conditions.push({ 
        $anyElementTrue: {
          $map: {
            input: { $ifNull: ["$$node.a", []] },
            as: "ancestor",
            in: { $eq: ["$$ancestor", parentArchetypeId] }
          }
        }
      });
    }
    
    // Add conditions for intermediate archetype IDs if present
    if (archetypeIds.length > 1) {
      for (let i = 0; i < archetypeIds.length - 1; i++) {
        const archetypeId = archetypeIds[i];
        conditions.push({ 
          $anyElementTrue: {
            $map: {
              input: { $ifNull: ["$$node.a", []] },
              as: "ancestor",
              in: { $eq: ["$$ancestor", archetypeId] }
            }
          }
        });
      }
    }
    
    // Build the $filter expression
    addFields[varName] = {
      $arrayElemAt: [
        {
          $filter: {
            input: `$${nodeField}`,
            as: "node",
            cond: { $and: conditions }
          }
        },
        0
      ]
    };
  }
}

/**
 * Build a variable name for a path that can be used in MongoDB aggregation pipeline.
 * This is a wrapper around the utility function to ensure consistency.
 * 
 * @param {string} alias - Path alias
 * @param {string} path - AQL path after the alias
 * @returns {string} Variable name safe for MongoDB
 */
export function buildVariableNameForPath(alias, path) {
  return buildVarName(alias, path);
}

export default buildAddFieldsStage;