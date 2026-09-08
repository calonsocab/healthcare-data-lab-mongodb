// lib/aqlToMql/translator/3-semiflattened.js

/**
 * Translator for AQL to MongoDB queries using the Semi-Flattened strategy.
 * This strategy is designed for the structure where compositions have a 'nodes' array
 * containing flattened paths, allowing for efficient querying without loss of context.
 */

 export const translateSemiFlattened = (ast, strategyConfig = {}) => {
  // Check if we have a valid AST
  if (!ast) {
    throw new Error("Invalid AST: No AST data provided");
  }
  
  // Debug information - log the AST structure to help diagnose issues
  console.log("AST Structure:", JSON.stringify(ast, null, 2));

  const pipeline = [];
  
  // Validate critical AST parts before proceeding
  if (!ast.select && (!ast.contains || (Array.isArray(ast.contains) && ast.contains.length === 0))) {
    console.warn("AST is missing critical elements (select or contains clauses)");
  }
  
  // PHASE 1: Process the CONTAINS clauses to build path and archetype mappings
  const containsMapping = processContainsClauses(ast);
  
  // PHASE 2: Build the $match stage based on WHERE conditions and CONTAINS clauses
  const matchStage = buildMatchStage(ast, containsMapping);
  if (Object.keys(matchStage).length > 0) {
    pipeline.push({ $match: matchStage });
  }
  
  // PHASE 3: Add fields for the referenced paths using $let expressions
  const addFieldsStage = buildAddFieldsStage(ast, containsMapping);
  if (Object.keys(addFieldsStage).length > 0) {
    pipeline.push({ $addFields: addFieldsStage });
  }
  
  // PHASE 4: Project the final fields for the SELECT clause
  const projectStage = buildProjectStage(ast, containsMapping);
  if (Object.keys(projectStage).length > 0) {
    pipeline.push({ $project: projectStage });
  }
  
  // PHASE 5: Add sorting (ORDER BY) if needed
  const sortStage = buildSortStage(ast, containsMapping);
  if (Object.keys(sortStage).length > 0) {
    pipeline.push({ $sort: sortStage });
  }
  
  // Add limit and skip if provided
  if (ast.limit !== undefined && ast.limit !== null) {
    pipeline.push({ $limit: parseInt(ast.limit) });
  }
  if (ast.offset !== undefined && ast.offset !== null && ast.offset > 0) {
    pipeline.push({ $skip: parseInt(ast.offset) });
  }
  
  return pipeline;
};

/**
 * Process the CONTAINS clauses from the AST to build path mappings
 * This extracts all archetypes, their aliases and constraints
 */
function processContainsClauses(ast) {
  const mapping = {};
  
  // Parse the EHR-level constraints first
  if (ast.from && typeof ast.from === 'string' && ast.from.startsWith('EHR e')) {
    // Extract the ehr_id constraint if present
    const ehrIdMatch = ast.from.match(/\[ehr_id\/value\s*=\s*\$(.*?)\]/);
    if (ehrIdMatch && ehrIdMatch[1]) {
      mapping.ehrId = {
        variable: ehrIdMatch[1],
        alias: 'e'
      };
    }
  } else if (ast.from && ast.fromType === 'EHR') {
    // Alternative structure check - some AST implementations might use a more structured approach
    mapping.ehrId = {
      variable: ast.fromVariable || 'ehr_id',
      alias: ast.fromAlias || 'e'
    };
  }
  
  // Now process all CONTAINS clauses
  if (ast.contains) {
    // Handle both array and object formats of contains
    const containsArray = Array.isArray(ast.contains) 
      ? ast.contains 
      : Object.values(ast.contains);
    
    containsArray.forEach(containsClause => {
      if (containsClause.alias && containsClause.archetype_node_id) {
        mapping[containsClause.alias] = {
          archetype: containsClause.archetype_node_id,
          rmType: containsClause.rmType || 'ANY',
          constraints: containsClause.constraints || []
        };
      }
    });
  }
  
  return mapping;
}

/**
 * Build the MongoDB $match stage based on WHERE conditions and CONTAINS clauses
 */
function buildMatchStage(ast, mapping) {
  const matchConditions = [];
  
  // Add ehr_id constraint if present
  if (mapping.ehrId) {
    matchConditions.push({ 
      "ehr_id": { $eq: `$${mapping.ehrId.variable}` }
    });
  }
  
  // Add archetype constraints from CONTAINS clauses
  Object.entries(mapping).forEach(([alias, info]) => {
    if (alias !== 'ehrId' && info.archetype) {
      // For compositions, match directly on the composition archetype
      if (info.rmType === 'COMPOSITION') {
        matchConditions.push({
          "nodes": {
            $elemMatch: {
              "node_data._type": "COMPOSITION",
              "node_data.archetype_details.archetype_id.value": info.archetype
            }
          }
        });
      } 
      // For other types, match on the nodes array with appropriate filters
      else if (['SECTION', 'OBSERVATION', 'EVALUATION', 'ACTION', 'INSTRUCTION', 'CLUSTER', 'ELEMENT'].includes(info.rmType)) {
        matchConditions.push({
          "nodes": {
            $elemMatch: {
              "node_data._type": info.rmType,
              "node_data.archetype_details.archetype_id.value": info.archetype
            }
          }
        });
      }
    }
  });
  
  // Process WHERE conditions
  if (ast.where) {
    // Handle different possible structures of the WHERE clause
    let conditions = [];
    
    if (ast.where.conditions) {
      // Standard format with conditions property
      conditions = Array.isArray(ast.where.conditions) 
        ? ast.where.conditions 
        : Object.values(ast.where.conditions);
    } else if (Array.isArray(ast.where)) {
      // Alternative format where where is an array of conditions
      conditions = ast.where;
    } else if (typeof ast.where === 'object') {
      // Format where where is the condition object itself
      conditions = [ast.where];
    }
    
    conditions.forEach(condition => {
      if (!condition) return;
      
      // Process path-based conditions
      if (condition.path) {
        // Extract alias and path parts
        const pathParts = condition.path.split('/');
        const alias = pathParts[0];
        
        // Skip if alias not in mapping
        if (!mapping[alias]) return;
        
        // Handle different condition types
        if (condition.operator === '=' || condition.operator === '==') {
          const valueExpr = parseConditionValue(condition.value);
          
          // Convert path to MongoDB-compatible format
          const pathValue = pathParts.slice(1).join('/');
          
          // Create elemMatch condition for nodes array
          matchConditions.push(buildNodeElemMatchForPath(alias, pathValue, mapping[alias], valueExpr, "$eq"));
        }
        else if (['!=', '>', '<', '>=', '<='].includes(condition.operator)) {
          const valueExpr = parseConditionValue(condition.value);
          const pathValue = pathParts.slice(1).join('/');
          const opMap = {
            '!=': '$ne',
            '>': '$gt',
            '<': '$lt',
            '>=': '$gte',
            '<=': '$lte'
          };
          
          matchConditions.push(buildNodeElemMatchForPath(alias, pathValue, mapping[alias], valueExpr, opMap[condition.operator]));
        }
        // Handle date range conditions
        else if (condition.operator === 'BETWEEN') {
          const pathValue = pathParts.slice(1).join('/');
          matchConditions.push({
            $and: [
              buildNodeElemMatchForPath(alias, pathValue, mapping[alias], parseConditionValue(condition.value.lower), '$gte'),
              buildNodeElemMatchForPath(alias, pathValue, mapping[alias], parseConditionValue(condition.value.upper), '$lte')
            ]
          });
        }
      }
      // Process logical combinations (AND, OR)
      else if (condition.type === 'and' || condition.type === 'AND') {
        const andConditions = [];
        condition.operands.forEach(operand => {
          // Recursively process each operand
          if (operand.path) {
            const subConditions = processPathCondition(operand, mapping);
            if (subConditions) andConditions.push(subConditions);
          }
        });
        
        if (andConditions.length > 0) {
          matchConditions.push({ $and: andConditions });
        }
      }
      else if (condition.type === 'or' || condition.type === 'OR') {
        const orConditions = [];
        condition.operands.forEach(operand => {
          if (operand.path) {
            const subConditions = processPathCondition(operand, mapping);
            if (subConditions) orConditions.push(subConditions);
          }
        });
        
        if (orConditions.length > 0) {
          matchConditions.push({ $or: orConditions });
        }
      }
    });
  }
  
  // Combine all conditions with $and
  if (matchConditions.length > 0) {
    return { $and: matchConditions };
  }
  
  return {};
}

/**
 * Process a single path-based condition for WHERE clause
 */
function processPathCondition(condition, mapping) {
  if (!condition.path) return null;
  
  const pathParts = condition.path.split('/');
  const alias = pathParts[0];
  
  // Skip if alias not in mapping
  if (!mapping[alias]) return null;
  
  const valueExpr = parseConditionValue(condition.value);
  const pathValue = pathParts.slice(1).join('/');
  
  // Map operators to MongoDB operators
  let mongoOperator = '$eq';
  if (condition.operator === '!=') mongoOperator = '$ne';
  else if (condition.operator === '>') mongoOperator = '$gt';
  else if (condition.operator === '<') mongoOperator = '$lt';
  else if (condition.operator === '>=') mongoOperator = '$gte';
  else if (condition.operator === '<=') mongoOperator = '$lte';
  
  return buildNodeElemMatchForPath(alias, pathValue, mapping[alias], valueExpr, mongoOperator);
}

/**
 * Build an $elemMatch expression for a node in the nodes array
 * This handles path-based queries in the semi-flattened structure
 */
function buildNodeElemMatchForPath(alias, path, info, valueExpr, operator) {
  // Handle special cases for path segments with archetype constraints
  const pathSegments = path.split('/');
  const lastSegment = pathSegments[pathSegments.length - 1];
  
  // For nodes directly referenced by archetype_node_id
  if (pathSegments.length === 1 && lastSegment === 'archetype_node_id') {
    return {
      "nodes": {
        $elemMatch: {
          "node_data._type": info.rmType,
          "node_data.archetype_node_id": { [operator]: valueExpr }
        }
      }
    };
  }
  
  // For paths that include array indices or naming patterns like [at0001]
  const archetypePattern = /\[(at\d+)\]/;
  const matchedArchetype = lastSegment.match(archetypePattern);
  
  if (matchedArchetype) {
    // Extract the archetype node ID
    const archetypeNodeId = matchedArchetype[1];
    
    // Creating a condition that looks for this archetype node ID
    return {
      "nodes": {
        $elemMatch: {
          "node_data.archetype_node_id": archetypeNodeId,
          "ancestors": { $in: [info.archetype] }
        }
      }
    };
  }
  
  // For paths ending with value/value, defining_code/code_string, etc.
  if (pathSegments[pathSegments.length - 2] === 'value' && pathSegments[pathSegments.length - 1] === 'value') {
    // Handle paths like "med/value/value"
    const nodePath = pathSegments.slice(0, pathSegments.length - 2).join('/');
    
    return {
      "nodes": {
        $elemMatch: {
          "archetype_path": { $regex: new RegExp(nodePath) },
          "node_data.value.value": { [operator]: valueExpr },
          "ancestors": { $in: [info.archetype] }
        }
      }
    };
  }
  
  if (pathSegments[pathSegments.length - 2] === 'defining_code' && pathSegments[pathSegments.length - 1] === 'code_string') {
    // Handle paths like "med/defining_code/code_string"
    const nodePath = pathSegments.slice(0, pathSegments.length - 2).join('/');
    
    return {
      "nodes": {
        $elemMatch: {
          "archetype_path": { $regex: new RegExp(nodePath) },
          "node_data.value.defining_code.code_string": { [operator]: valueExpr },
          "ancestors": { $in: [info.archetype] }
        }
      }
    };
  }
  
  // Generic path handling
  return {
    "nodes": {
      $elemMatch: {
        "path": { $regex: new RegExp(`${alias}/${path}$`) },
        "ancestors": { $all: [info.archetype] },
        "node_data": { [operator]: valueExpr }
      }
    }
  };
}

/**
 * Parse a condition value considering various value types
 */
function parseConditionValue(value) {
  if (!value) return null;
  
  // Handle parameter variables (starting with $)
  if (typeof value === 'string' && value.startsWith('$')) {
    return `$${value.substring(1)}`;
  }
  
  // Handle date values
  if (value.type === 'date' || (typeof value === 'object' && value.value && value.$date)) {
    return { $date: value.value || value.$date };
  }
  
  // Handle numeric values
  if (typeof value === 'number' || (typeof value === 'string' && !isNaN(value))) {
    return parseFloat(value);
  }
  
  // Default case - return the value itself
  return value.value || value;
}

/**
 * Build the $addFields stage to extract references to nodes that will be used in the projection
 */
function buildAddFieldsStage(ast, mapping) {
  const addFields = {};
  
  // For each alias in the mapping, create a variable to store the node
  Object.entries(mapping).forEach(([alias, info]) => {
    if (alias === 'ehrId') return;
    
    // Skip if the alias is not a real RM type
    if (!info.rmType || !info.archetype) return;
    
    // Create a variable with the alias that finds the matching node
    addFields[alias] = {
      $let: {
        vars: {
          [alias]: {
            $first: {
              $filter: {
                input: "$nodes",
                as: "node",
                cond: {
                  $and: [
                    { $eq: ["$$node.node_data._type", info.rmType] },
                    { $eq: ["$$node.node_data.archetype_details.archetype_id.value", info.archetype] }
                  ]
                }
              }
            }
          }
        },
        in: `$$${alias}`
      }
    };
  });
  
  // For query paths that include specific attributes like time/value, create additional variables
  if (ast.select) {
    const selectItems = Array.isArray(ast.select) ? ast.select : Object.values(ast.select);
    
    selectItems.forEach(item => {
      if (!item.value || !item.value.path) return;
      
      const path = item.value.path;
      const pathParts = path.split('/');
      
      // Only process paths with specific patterns that need extraction
      if (pathParts.length >= 3) {
        const alias = pathParts[0];
        if (!mapping[alias] || alias === 'ehrId') return;
        
        // For patterns like med_ac/time/value or admin_salut/items[at0007]/items[at0014]
        // We need to find the exact node for these paths
        if (pathParts.some(part => part.includes('items[') || part === 'time' || part === 'description')) {
          const specificPathAlias = `${alias}_${pathParts.slice(1).join('_')}`.replace(/\[|\]|\./g, '_');
          
          // Extract the specific path pattern to search for
          const pathPattern = pathParts.slice(1).join('/');
          
          // Create a variable with a $filter to find the specific node
          addFields[specificPathAlias] = {
            $let: {
              vars: {
                [specificPathAlias]: {
                  $first: {
                    $filter: {
                      input: "$nodes",
                      as: "node",
                      cond: {
                        $and: [
                          // Path or archetype_path should match the pattern
                          { 
                            $or: [
                              { $regexMatch: { input: "$$node.path", regex: pathPattern } },
                              { $regexMatch: { input: "$$node.archetype_path", regex: pathPattern } }
                            ]
                          },
                          // Make sure this node is within the correct ancestor hierarchy
                          { $in: [mapping[alias].archetype, "$$node.ancestors"] }
                        ]
                      }
                    }
                  }
                }
              },
              in: `$$${specificPathAlias}`
            }
          };
        }
      }
    });
  }
  
  return addFields;
}

/**
 * Build the $project stage based on the SELECT clause
 */
function buildProjectStage(ast, mapping) {
  const projectStage = {};
  
  if (!ast.select) return {};
  
  // Handle different possible structures of the SELECT clause
  let selectItems = [];
  
  if (Array.isArray(ast.select)) {
    // Format where select is an array
    selectItems = ast.select;
  } else if (typeof ast.select === 'object') {
    // Format where select is an object with numbered keys or named properties
    selectItems = Object.values(ast.select);
  }
  
  // If we still don't have items, try to extract them from a different structure
  if (selectItems.length === 0 && ast.select.items) {
    selectItems = Array.isArray(ast.select.items) ? ast.select.items : Object.values(ast.select.items);
  }
  
  selectItems.forEach(selectItem => {
    // Handle different ways the path might be stored in the selectItem
    let path = '';
    let alias = '';
    
    // Case 1: Standard format with value.path
    if (selectItem.value && selectItem.value.path) {
      path = selectItem.value.path;
      alias = selectItem.alias || selectItem.name || path.replace(/\//g, '_');
    } 
    // Case 2: Direct path property
    else if (selectItem.path) {
      path = selectItem.path;
      alias = selectItem.alias || selectItem.name || path.replace(/\//g, '_');
    }
    // Case 3: AQL column name format
    else if (selectItem.aqlColumn && selectItem.aqlPath) {
      path = selectItem.aqlPath;
      alias = selectItem.aqlColumn;
    }
    
    // Skip if we couldn't extract a path
    if (!path) return;
    
    const pathParts = path.split('/');
    
    if (pathParts.length < 2) return;
    
    const itemAlias = pathParts[0];
    const restPath = pathParts.slice(1).join('/');
    
    // For simple paths like c/uid/value
    if (itemAlias === 'c' && restPath === 'uid/value') {
      projectStage[alias] = "$c.node_data.uid.value";
    }
    // For time/value paths
    else if (restPath === 'time/value') {
      projectStage[alias] = `$${itemAlias}.node_data.time.value`;
    }
    // For complex item paths with nested elements
    else if (restPath.includes('items[')) {
      // For these complex paths, we've extracted the node in the addFields stage
      const specificPathAlias = `${itemAlias}_${pathParts.slice(1).join('_')}`.replace(/\[|\]|\./g, '_');
      
      // Handle the final property access based on the path ending pattern
      if (restPath.endsWith('/value/value')) {
        projectStage[alias] = `$${specificPathAlias}.node_data.value.value`;
      }
      else if (restPath.endsWith('/value/defining_code/code_string')) {
        projectStage[alias] = `$${specificPathAlias}.node_data.value.defining_code.code_string`;
      }
      else {
        // Generic fallback for other patterns
        projectStage[alias] = `$${specificPathAlias}.node_data`;
      }
    }
    // Generic fallback
    else {
      projectStage[alias] = `$${itemAlias}.node_data.${restPath.replace(/\//g, '.')}`;
    }
  });
  
  return projectStage;
}

/**
 * Build the $sort stage based on the ORDER BY clause
 */
function buildSortStage(ast, mapping) {
  const sortStage = {};
  
  if (!ast.orderBy) return {};
  
  const orderByItems = Array.isArray(ast.orderBy) ? ast.orderBy : Object.values(ast.orderBy);
  
  orderByItems.forEach(orderItem => {
    if (!orderItem.path) return;
    
    const pathParts = orderItem.path.split('/');
    if (pathParts.length < 2) return;
    
    const itemAlias = pathParts[0];
    const restPath = pathParts.slice(1).join('/');
    
    // For simple paths
    if (itemAlias === 'c' && restPath === 'uid/value') {
      sortStage["c.node_data.uid.value"] = orderItem.direction === 'DESC' ? -1 : 1;
    }
    // For time/value paths
    else if (restPath === 'time/value') {
      sortStage[`${itemAlias}.node_data.time.value`] = orderItem.direction === 'DESC' ? -1 : 1;
    }
    // For complex paths, we need to use the projected field name
    else {
      const fieldName = orderItem.alias || orderItem.path.replace(/\//g, '_');
      sortStage[fieldName] = orderItem.direction === 'DESC' ? -1 : 1;
    }
  });
  
  return sortStage;
}