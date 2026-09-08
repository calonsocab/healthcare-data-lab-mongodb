// lib/aqlToMql/translator/4-hybrid-nodes.js

/**
 * Hybrid-Nodes Strategy for AQL to MQL Translation
 * This strategy:
 * 1. Uses $search for population-level queries
 * 2. Uses $match with $elemMatch for ehr_id-based queries
 * 3. Intelligently chooses between search_nodes and comp_nodes based on the query type
 */

 export const translateHybridNodes = (ast, strategyConfig = {}) => {
    // Validate input
    if (!ast) {
      throw new Error("Invalid AST: No AST data provided");
    }
    
    // Determine if this is an ehr_id based query
    const isEhrIdBasedQuery = detectEhrIdBasedQuery(ast);
    
    // Log for debugging
    console.log(`[Hybrid-Nodes] Query type detected: ${isEhrIdBasedQuery ? 'ehr_id-based' : 'population-based'}`);
    
    // Choose the appropriate strategy based on query type
    if (isEhrIdBasedQuery) {
      return buildEhrIdBasedQuery(ast, strategyConfig);
    } else {
      return buildPopulationBasedQuery(ast, strategyConfig);
    }
  };
  
  /**
   * Detect if the query is ehr_id based by analyzing the AST
   */
  function detectEhrIdBasedQuery(ast) {
    // Check for explicit EHR e[ehr_id/value = $ehr_id] pattern
    if (ast.from && typeof ast.from === 'string') {
      if (ast.from.match(/EHR\s+[a-zA-Z0-9_]+\s*\[\s*ehr_id\/value\s*=\s*\$[a-zA-Z0-9_]+\s*\]/)) {
        return true;
      }
    }
    
    // Check for ehr_id in the WHERE clause
    if (ast.where) {
      const conditions = Array.isArray(ast.where) ? ast.where : 
                        (ast.where.conditions ? ast.where.conditions : [ast.where]);
      
      for (const condition of conditions) {
        if (!condition) continue;
        
        // Direct ehr_id comparison
        if (condition.path && condition.path === 'e/ehr_id/value' && 
            condition.operator && ['=', '=='].includes(condition.operator)) {
          return true;
        }
        
        // ehr_id in a complex path
        if (condition.path && condition.path.includes('ehr_id/value') && 
            condition.operator && ['=', '=='].includes(condition.operator)) {
          return true;
        }
      }
    }
    
    // Check for ehr_id parameter in FROM clause structured format
    if (ast.from && ast.fromType === 'EHR' && ast.fromExpression && 
        ast.fromExpression.includes('ehr_id/value')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Build MQL pipeline for ehr_id based queries using comp_nodes
   */
  function buildEhrIdBasedQuery(ast, strategyConfig) {
    const pipeline = [];
    
    // PHASE 1: Build the initial $match stage for ehr_id and required archetypes
    const initialMatch = buildInitialMatchStage(ast);
    if (Object.keys(initialMatch).length > 0) {
      pipeline.push({ $match: initialMatch });
    }
    
    // PHASE 2: Process the CONTAINS clauses to build path and archetype mappings
    const containsMapping = processContainsClauses(ast);
    
    // PHASE 3: Add fields for referenced variables using $let expressions
    const addFieldsStage = buildAddFieldsStage(ast, containsMapping);
    if (Object.keys(addFieldsStage).length > 0) {
      pipeline.push({ $addFields: addFieldsStage });
    }
    
    // PHASE 4: Build specific element field references if needed
    const elementsFieldsStage = buildElementFieldsStage(ast, containsMapping);
    if (Object.keys(elementsFieldsStage).length > 0) {
      pipeline.push({ $addFields: elementsFieldsStage });
    }
    
    // PHASE 5: Project the final fields for the SELECT clause
    const projectStage = buildProjectStage(ast, containsMapping);
    if (Object.keys(projectStage).length > 0) {
      pipeline.push({ $project: projectStage });
    }
    
    // PHASE 6: Add sorting (ORDER BY), limit, and offset if needed
    addSortLimitOffsetStages(ast, pipeline);
    
    return pipeline;
  }
  
  /**
   * Build MQL pipeline for population-based queries using search_nodes
   */
  function buildPopulationBasedQuery(ast, strategyConfig) {
    const pipeline = [];
    
    // Ensure Atlas Search is enabled
    if (!strategyConfig.atlasSearch || !strategyConfig.atlasSearch.index_name) {
      // Fallback to ehr_id based approach if search is not enabled
      console.log("[Hybrid-Nodes] Atlas Search not configured, falling back to $match strategy");
      return buildEhrIdBasedQuery(ast, strategyConfig);
    }
    
    // PHASE 1: Build $search stage
    const searchStage = buildSearchStage(ast, strategyConfig);
    if (searchStage) {
      pipeline.push(searchStage);
    } else {
      // Fallback to ehr_id based approach if search couldn't be built
      console.log("[Hybrid-Nodes] Could not build $search query, falling back to $match strategy");
      return buildEhrIdBasedQuery(ast, strategyConfig);
    }
    
    // PHASE 2: Process CONTAINS clauses for path mappings
    const containsMapping = processContainsClauses(ast);
    
    // PHASE 3: Add fields for path resolution
    const addFieldsStage = buildAddFieldsStage(ast, containsMapping, true);
    if (Object.keys(addFieldsStage).length > 0) {
      pipeline.push({ $addFields: addFieldsStage });
    }
    
    // PHASE 4: Build specific element field references if needed
    const elementsFieldsStage = buildElementFieldsStage(ast, containsMapping, true);
    if (Object.keys(elementsFieldsStage).length > 0) {
      pipeline.push({ $addFields: elementsFieldsStage });
    }
    
    // PHASE 5: Project the final fields
    const projectStage = buildProjectStage(ast, containsMapping, true);
    if (Object.keys(projectStage).length > 0) {
      pipeline.push({ $project: projectStage });
    }
    
    // PHASE 6: Add sorting, limit, and offset
    addSortLimitOffsetStages(ast, pipeline);
    
    return pipeline;
  }
  
  /**
   * Build the initial $match stage for ehr_id and required archetypes
   */
  function buildInitialMatchStage(ast) {
    const matchConditions = {};
    const andConditions = [];
    
    // Extract ehr_id from FROM or WHERE clause
    let ehrId = null;
    
    // Check FROM clause for ehr_id
    if (ast.from && typeof ast.from === 'string') {
      const ehrIdMatch = ast.from.match(/EHR\s+[a-zA-Z0-9_]+\s*\[\s*ehr_id\/value\s*=\s*\$([a-zA-Z0-9_]+)\s*\]/);
      if (ehrIdMatch && ehrIdMatch[1]) {
        ehrId = `$${ehrIdMatch[1]}`;
      }
    } else if (ast.from && ast.fromType === 'EHR' && ast.fromExpression) {
      // Check for structured format
      const ehrIdMatch = ast.fromExpression.match(/ehr_id\/value\s*=\s*\$([a-zA-Z0-9_]+)/);
      if (ehrIdMatch && ehrIdMatch[1]) {
        ehrId = `$${ehrIdMatch[1]}`;
      }
    }
    
    // Check WHERE clause for ehr_id if not found in FROM
    if (!ehrId && ast.where) {
      const conditions = Array.isArray(ast.where) ? ast.where : 
                        (ast.where.conditions ? ast.where.conditions : [ast.where]);
      
      for (const condition of conditions) {
        if (!condition) continue;
        
        if ((condition.path === 'e/ehr_id/value' || condition.path.includes('ehr_id/value')) && 
            ['=', '=='].includes(condition.operator)) {
          if (typeof condition.value === 'string' && condition.value.startsWith('$')) {
            ehrId = condition.value;
          } else {
            ehrId = condition.value;
          }
          break;
        }
      }
    }
    
    // Add ehr_id to match conditions if found
    if (ehrId) {
      matchConditions.ehr_id = { $eq: ehrId };
    }
    
    // Extract required archetypes from CONTAINS clauses
    if (ast.contains) {
      const containsClauses = Array.isArray(ast.contains) ? ast.contains : 
                            (typeof ast.contains === 'object' ? Object.values(ast.contains) : []);
      
      for (const clause of containsClauses) {
        if (clause.rmType && clause.archetype_node_id) {
          andConditions.push({
            "comp_nodes": {
              $elemMatch: {
                "data._type": clause.rmType,
                "data.archetype_details.archetype_id.value": clause.archetype_node_id
              }
            }
          });
        }
      }
    }
    
    // Add WHERE conditions that can be directly used in $match
    if (ast.where) {
      const conditions = Array.isArray(ast.where) ? ast.where : 
                        (ast.where.conditions ? ast.where.conditions : [ast.where]);
      
      for (const condition of conditions) {
        if (!condition || !condition.path || condition.path === 'e/ehr_id/value' || 
            condition.path.includes('ehr_id/value')) {
          continue; // Skip ehr_id conditions (already handled) and invalid conditions
        }
        
        // Process other conditions that can be directly matched
        // For example, specific archetype_node_id values, dates, etc.
        if (condition.path.includes('archetype_node_id') && ['=', '=='].includes(condition.operator)) {
          andConditions.push({
            "comp_nodes": {
              $elemMatch: {
                "data.archetype_node_id": condition.value
              }
            }
          });
        }
        
        // Handle date and time conditions
        if (condition.path.includes('/time/value') && ['>=', '<=', '>', '<'].includes(condition.operator)) {
          const mongoOp = condition.operator === '>=' ? '$gte' : 
                          condition.operator === '<=' ? '$lte' :
                          condition.operator === '>' ? '$gt' : '$lt';
          
          andConditions.push({
            "comp_nodes": {
              $elemMatch: {
                "data.time.value": { [mongoOp]: condition.value }
              }
            }
          });
        }
      }
    }
    
    // Combine all conditions
    if (andConditions.length > 0) {
      if (Object.keys(matchConditions).length > 0) {
        matchConditions.$and = andConditions;
      } else {
        matchConditions.$and = andConditions;
      }
    }
    
    return matchConditions;
  }
  
  /**
   * Process the CONTAINS clauses from the AST to build path mappings
   */
  function processContainsClauses(ast) {
    const mapping = {};
    
    // Parse the EHR-level constraints first
    if (ast.from && typeof ast.from === 'string') {
      // Extract the ehr_id constraint if present
      const ehrIdMatch = ast.from.match(/EHR\s+([a-zA-Z0-9_]+)\s*\[\s*ehr_id\/value\s*=\s*\$(.*?)\s*\]/);
      if (ehrIdMatch && ehrIdMatch[1] && ehrIdMatch[2]) {
        mapping.ehrId = {
          variable: ehrIdMatch[2],
          alias: ehrIdMatch[1]
        };
      }
    } else if (ast.from && ast.fromType === 'EHR') {
      // Alternative structure check
      mapping.ehrId = {
        variable: ast.fromVariable || 'ehr_id',
        alias: ast.fromAlias || 'e'
      };
    }
    
    // Process all CONTAINS clauses
    if (ast.contains) {
      // Handle both array and object formats of contains
      const containsArray = Array.isArray(ast.contains) ? 
                          ast.contains : 
                          Object.values(ast.contains);
      
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
   * Build the $addFields stage to extract references to main nodes
   */
  function buildAddFieldsStage(ast, mapping, useSearchNodes = false) {
    const addFields = {};
    const nodeField = useSearchNodes ? "search_nodes" : "comp_nodes";
    
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
                  input: `$${nodeField}`,
                  as: "node",
                  cond: {
                    $and: [
                      { $eq: ["$$node.data._type", info.rmType] },
                      { $eq: ["$$node.data.archetype_details.archetype_id.value", info.archetype] }
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
    
    return addFields;
  }
  
  /**
   * Build the additional $addFields stage for specific element fields
   */
  function buildElementFieldsStage(ast, mapping, useSearchNodes = false) {
    const addFields = {};
    const nodeField = useSearchNodes ? "search_nodes" : "comp_nodes";
    
    // Check the SELECT statement for specific paths that need separate variables
    if (ast.select) {
      const selectItems = Array.isArray(ast.select) ? ast.select : 
                         (typeof ast.select === 'object' ? Object.values(ast.select) : []);
      
      selectItems.forEach(item => {
        let path = '';
        
        // Extract path from different possible formats
        if (item.value && item.value.path) {
          path = item.value.path;
        } else if (item.path) {
          path = item.path;
        } else if (item.aqlPath) {
          path = item.aqlPath;
        }
        
        if (!path || path.split('/').length < 3) return;
        
        const pathParts = path.split('/');
        const alias = pathParts[0];
        
        // Skip if alias not found in mapping
        if (!mapping[alias]) return;
        
        // For specific patterns like archetype node IDs with at0XXX format
        // or complex paths with items[] and other segments
        const restPath = pathParts.slice(1).join('/');
        
        // Check for patterns like data[at0001]/items[at0133]
        const dataItemsPattern = /data\[at\d+\]\/items\[(at\d+|openEHR-EHR-[A-Z]+\.[a-z_]+\.v\d+)\]/;
        
        if (dataItemsPattern.test(restPath)) {
          // Extract the archetype node ID
          const archetypeMatch = restPath.match(/\[(at\d+|openEHR-EHR-[A-Z]+\.[a-z_]+\.v\d+)\]/g);
          
          if (archetypeMatch && archetypeMatch.length > 0) {
            // Create variable names based on path components
            const varName = `${alias}_${restPath.replace(/[\[\]\/\.]/g, '_')}`;
            
            // Create filter conditions based on archetypes and paths
            const filterConditions = [];
            
            // Add type condition if it's an ELEMENT
            filterConditions.push({ $eq: ["$$node.data._type", "ELEMENT"] });
            
            // Extract the last archetype ID for direct node match
            const lastArchetype = archetypeMatch[archetypeMatch.length - 1].replace(/[\[\]]/g, '');
            
            if (lastArchetype.startsWith('at')) {
              // It's an archetype_node_id
              filterConditions.push({ $eq: ["$$node.data.archetype_node_id", lastArchetype] });
            } else {
              // It's a full archetype ID
              filterConditions.push({ 
                $eq: ["$$node.data.archetype_details.archetype_id.value", lastArchetype] 
              });
            }
            
            // Ensure node is within the correct ancestor hierarchy
            filterConditions.push({ $in: [mapping[alias].archetype, "$$node.ant"] });
            
            // For nested paths, ensure all ancestor archetypes are present
            for (let i = 0; i < archetypeMatch.length - 1; i++) {
              const ancestor = archetypeMatch[i].replace(/[\[\]]/g, '');
              if (ancestor.startsWith('at') || ancestor.startsWith('openEHR')) {
                filterConditions.push({ $in: [ancestor, "$$node.ant"] });
              }
            }
            
            // Create the $addFields entry
            addFields[varName] = {
              $let: {
                vars: {
                  [varName]: {
                    $first: {
                      $filter: {
                        input: `$${nodeField}`,
                        as: "node",
                        cond: {
                          $and: filterConditions
                        }
                      }
                    }
                  }
                },
                in: `$$${varName}`
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
  function buildProjectStage(ast, mapping, useSearchNodes = false) {
    const projectStage = {};
    
    if (!ast.select) return {};
    
    // Handle different possible structures of the SELECT clause
    const selectItems = Array.isArray(ast.select) ? ast.select : 
                       (typeof ast.select === 'object' ? Object.values(ast.select) : []);
    
    selectItems.forEach(item => {
      let path = '';
      let alias = '';
      
      // Extract path and alias from different possible formats
      if (item.value && item.value.path) {
        path = item.value.path;
        alias = item.alias || item.name || path.replace(/\//g, '_');
      } else if (item.path) {
        path = item.path;
        alias = item.alias || item.name || path.replace(/\//g, '_');
      } else if (item.aqlPath) {
        path = item.aqlPath;
        alias = item.aqlColumn || path.replace(/\//g, '_');
      }
      
      if (!path) return;
      
      const pathParts = path.split('/');
      if (pathParts.length < 2) return;
      
      const itemAlias = pathParts[0];
      const restPath = pathParts.slice(1).join('/');
      
      // Check if we have a variable for this specific path
      const specificVarName = `${itemAlias}_${restPath.replace(/[\[\]\/\.]/g, '_')}`;
      
      if (restPath.includes('uid/value')) {
        // Special case for composition UID
        projectStage[alias] = `$${itemAlias}.data.uid.value`;
      }
      else if (restPath.includes('feeder_audit')) {
        // Special case for feeder_audit
        projectStage[alias] = `$${itemAlias}.data.feeder_audit`;
      }
      else if (restPath.includes('/time/value')) {
        // Special case for time value
        projectStage[alias] = `$${itemAlias}.data.time.value`;
      }
      else if (restPath.includes('data[at') && restPath.includes('items[')) {
        // Complex paths with data[atXXX]/items[...]
        // Use the specific variable if available
        if (Object.keys(projectStage).includes(specificVarName)) {
          // Extract the value based on path ending pattern
          if (restPath.endsWith('/value/value')) {
            projectStage[alias] = `$${specificVarName}.data.value.value`;
          }
          else if (restPath.endsWith('/value/defining_code/code_string')) {
            projectStage[alias] = `$${specificVarName}.data.value.defining_code.code_string`;
          }
          else if (restPath.endsWith('/value/defining_code/terminology_id/value')) {
            projectStage[alias] = `$${specificVarName}.data.value.defining_code.terminology_id.value`;
          }
          else {
            // Default value projection
            projectStage[alias] = `$${specificVarName}.data.value`;
          }
        } else {
          // Fallback dot notation
          const mongoPath = restPath.replace(/\[([^\]]+)\]/g, '.$1').replace(/\//g, '.');
          projectStage[alias] = `$${itemAlias}.data.${mongoPath}`;
        }
      }
      else {
        // Generic fallback - convert path notation to MongoDB dot notation
        const mongoPath = restPath.replace(/\[([^\]]+)\]/g, '.$1').replace(/\//g, '.');
        projectStage[alias] = `$${itemAlias}.data.${mongoPath}`;
      }
    });
    
    return projectStage;
  }
  
  /**
   * Add sorting, limit, and offset stages to the pipeline
   */
  function addSortLimitOffsetStages(ast, pipeline) {
    // Add ORDER BY if specified
    if (ast.orderBy) {
      const sortStage = {};
      
      // Handle different possible structures
      const orderByItems = Array.isArray(ast.orderBy) ? ast.orderBy : 
                          (typeof ast.orderBy === 'object' ? Object.values(ast.orderBy) : []);
      
      orderByItems.forEach(item => {
        let path = '';
        if (item.path) {
          path = item.path;
        } else if (item.aqlPath) {
          path = item.aqlPath;
        }
        
        if (!path) return;
        
        const pathParts = path.split('/');
        if (pathParts.length < 2) return;
        
        const itemAlias = pathParts[0];
        const restPath = pathParts.slice(1).join('/');
        
        // Determine the MongoDB path based on the pattern
        let sortPath;
        
        if (restPath.includes('time/value')) {
          sortPath = `${itemAlias}.data.time.value`;
        }
        else if (restPath.includes('context/start_time/value')) {
          sortPath = `${itemAlias}.data.context.start_time.value`;
        }
        else {
          // Generic case - convert AQL path to dot notation
          const mongoPath = restPath.replace(/\[([^\]]+)\]/g, '.$1').replace(/\//g, '.');
          sortPath = `${itemAlias}.data.${mongoPath}`;
        }
        
        // Set the sort direction (1 for ASC, -1 for DESC)
        sortStage[sortPath] = (item.direction === 'DESC' || item.direction === 'desc') ? -1 : 1;
      });
      
      if (Object.keys(sortStage).length > 0) {
        pipeline.push({ $sort: sortStage });
      }
    }
    
    // Add LIMIT if specified
    if (ast.limit !== undefined && ast.limit !== null) {
      pipeline.push({ $limit: parseInt(ast.limit) });
    }
    
    // Add OFFSET if specified
    if (ast.offset !== undefined && ast.offset !== null && ast.offset > 0) {
      pipeline.push({ $skip: parseInt(ast.offset) });
    }
  }
  
  /**
   * Build the $search stage for Atlas Search
   */
  function buildSearchStage(ast, strategyConfig) {
    // Start building the search query
    const searchQuery = {
      $search: {
        index: strategyConfig.atlasSearch.index_name,
        compound: {
          must: [],
          should: [],
          mustNot: []
        }
      }
    };
    
    // Add ehr_id condition if available (rare in population queries but possible)
    let ehrId = null;
    
    // Check if there's an ehr_id in the FROM clause
    if (ast.from && typeof ast.from === 'string') {
      const ehrIdMatch = ast.from.match(/EHR\s+[a-zA-Z0-9_]+\s*\[\s*ehr_id\/value\s*=\s*\$([a-zA-Z0-9_]+)\s*\]/);
      if (ehrIdMatch && ehrIdMatch[1]) {
        ehrId = `$${ehrIdMatch[1]}`;
      }
    }
    
    // Check WHERE clause for ehr_id
    if (!ehrId && ast.where) {
      const conditions = Array.isArray(ast.where) ? ast.where : 
                        (ast.where.conditions ? ast.where.conditions : [ast.where]);
      
      for (const condition of conditions) {
        if (!condition) continue;
        
        if ((condition.path === 'e/ehr_id/value' || condition.path.includes('ehr_id/value')) && 
            ['=', '=='].includes(condition.operator)) {
          if (typeof condition.value === 'string' && condition.value.startsWith('$')) {
            ehrId = condition.value;
          } else {
            ehrId = condition.value;
          }
          break;
        }
      }
    }
    
    // Add ehr_id to search if found
    if (ehrId) {
      searchQuery.$search.compound.must.push({
        equals: {
          path: "ehr_id",
          value: ehrId
        }
      });
    }
    
    // Add composition archetype conditions from CONTAINS clauses
    if (ast.contains) {
      const containsClauses = Array.isArray(ast.contains) ? ast.contains : 
                            (typeof ast.contains === 'object' ? Object.values(ast.contains) : []);
      
      for (const clause of containsClauses) {
        if (clause.rmType === 'COMPOSITION' && clause.archetype_node_id) {
          searchQuery.$search.compound.must.push({
            embeddedDocument: {
              path: "search_nodes",
              operator: {
                compound: {
                  must: [
                    {
                      equals: {
                        path: "search_nodes.data._type",
                        value: "COMPOSITION"
                      }
                    },
                    {
                      equals: {
                        path: "search_nodes.data.archetype_details.archetype_id.value",
                        value: clause.archetype_node_id
                      }
                    }
                  ]
                }
              }
            }
          });
        }
        else if (['SECTION', 'ACTION', 'EVALUATION', 'OBSERVATION', 'CLUSTER'].includes(clause.rmType) && 
                 clause.archetype_node_id) {
          // For other node types, add embedded document search
          searchQuery.$search.compound.must.push({
            embeddedDocument: {
              path: "search_nodes",
              operator: {
                compound: {
                  must: [
                    {
                      equals: {
                        path: "search_nodes.data._type",
                        value: clause.rmType
                      }
                    },
                    {
                      equals: {
                        path: "search_nodes.data.archetype_details.archetype_id.value",
                        value: clause.archetype_node_id
                      }
                    }
                  ]
                }
              }
            }
          });
        }
      }
    }
    
    // Process WHERE conditions for search
    if (ast.where) {
      const conditions = Array.isArray(ast.where) ? ast.where : 
                        (ast.where.conditions ? ast.where.conditions : [ast.where]);
      
      for (const condition of conditions) {
        if (!condition || !condition.path || 
           condition.path === 'e/ehr_id/value' || 
           condition.path.includes('ehr_id/value')) {
          continue; // Skip ehr_id and invalid conditions
        }
        
        const pathParts = condition.path.split('/');
        if (pathParts.length < 2) continue;
        
        const alias = pathParts[0];
        const restPath = pathParts.slice(1).join('/');
        
        // Handle different condition types based on pattern and operator
        if (restPath.includes('archetype_node_id') && ['=', '=='].includes(condition.operator)) {
          // Archetype node ID condition
          searchQuery.$search.compound.must.push({
            embeddedDocument: {
              path: "search_nodes",
              operator: {
                compound: {
                  must: [
                    {
                      equals: {
                        path: "search_nodes.data.archetype_node_id",
                        value: condition.value
                      }
                    }
                  ]
                }
              }
            }
          });
        }
        else if (restPath.includes('/value/value') && ['=', '=='].includes(condition.operator)) {
          // Value equality condition
          searchQuery.$search.compound.must.push({
            embeddedDocument: {
              path: "search_nodes",
              operator: {
                compound: {
                  must: [
                    {
                      equals: {
                        path: "search_nodes.data.value.value",
                        value: condition.value
                      }
                    }
                  ]
                }
              }
            }
          });
        }
        else if (restPath.includes('/value/defining_code/code_string') && ['=', '=='].includes(condition.operator)) {
          // Code string equality condition
          searchQuery.$search.compound.must.push({
            embeddedDocument: {
              path: "search_nodes",
              operator: {
                compound: {
                  must: [
                    {
                      equals: {
                        path: "search_nodes.data.value.defining_code.code_string",
                        value: condition.value
                      }
                    }
                  ]
                }
              }
            }
          });
        }
        else if (restPath.includes('/time/value') && ['>=', '<=', '>', '<'].includes(condition.operator)) {
          // Time/date range condition
          const rangeQuery = {
            range: {
              path: "search_nodes.data.time.value",
            }
          };
          
          // Map operator to MongoDB operator
          if (condition.operator === '>=') {
            rangeQuery.range.gte = condition.value;
          } else if (condition.operator === '<=') {
            rangeQuery.range.lte = condition.value;
          } else if (condition.operator === '>') {
            rangeQuery.range.gt = condition.value;
          } else if (condition.operator === '<') {
            rangeQuery.range.lt = condition.value;
          }
          
          searchQuery.$search.compound.must.push({
            embeddedDocument: {
              path: "search_nodes",
              operator: rangeQuery
            }
          });
        }
        else if (restPath.includes('/value/defining_code/code_string') && condition.operator === 'MATCHES') {
          // MATCHES operator for code strings (multiple values)
          if (Array.isArray(condition.value)) {
            const shouldConditions = condition.value.map(value => ({
              equals: {
                path: "search_nodes.data.value.defining_code.code_string",
                value: value
              }
            }));
            
            searchQuery.$search.compound.must.push({
              embeddedDocument: {
                path: "search_nodes",
                operator: {
                  compound: {
                    should: shouldConditions
                  }
                }
              }
            });
          }
        }
      }
    }
    
    // Check if we have any search criteria
    if (searchQuery.$search.compound.must.length === 0) {
      return null;
    }
    
    return searchQuery;
  }