// src/lib/aql-normalizer.js

/**
* Analyzes an AQL query and normalizes paths based on available templates
* Also identifies which templates are affected by the query
*/

import validateAQL from "@/lib/aqlToMql/parser/validateAql";

/**
 * Analyzes an AQL query to determine which templates it affects
 * @param {string} aqlText - The AQL query text
 * @param {Array} templates - Available templates
 * @returns {Promise<{affectedTemplates: Array, status: string, progress: number}>} - Analysis result with progress updates
 */
export async function analyzeAffectedTemplates(aqlText, templates) {
    if (!aqlText || !templates || !Array.isArray(templates)) {
        return {
            affectedTemplates: [],
            status: "No templates available for analysis",
            progress: 100
        };
    }

    const validationResult = validateAQL(aqlText);
    if (!validationResult.success) {
        return {
            affectedTemplates: [],
            status: "Invalid AQL query",
            progress: 100,
            error: validationResult.error
        };
    }

    try {
        // Extract archetypes and paths from the AQL
        const { archetypeIds, containsExpressions, ehr, compositions } = extractQueryElements(aqlText);

        // If specific compositions are mentioned, find those templates
        if (compositions.length > 0) {
            const specificTemplates = templates.filter(template =>
                compositions.some(comp =>
                    template.webTemplate?.rmType === 'COMPOSITION' &&
                    template.webTemplate?.nodeId === comp
                )
            );

            if (specificTemplates.length > 0) {
                return {
                    affectedTemplates: specificTemplates,
                    status: "Found directly referenced templates",
                    progress: 100
                };
            }
        }

        // If no direct composition references, we need to analyze all templates
        const result = [];
        const totalTemplates = templates.length;

        // Processing templates in batches to allow UI updates
        const batchSize = 20;
        const batches = Math.ceil(totalTemplates / batchSize);

        for (let i = 0; i < batches; i++) {
            const start = i * batchSize;
            const end = Math.min(start + batchSize, totalTemplates);
            const batch = templates.slice(start, end);

            // Analyze this batch of templates
            const batchResults = batch.filter(template => {
                return isTemplateAffected(template, archetypeIds, containsExpressions);
            });

            result.push(...batchResults);

            // Calculate progress
            const progress = Math.floor((end / totalTemplates) * 100);

            // Yield to the main thread and provide progress update
            await new Promise(resolve => setTimeout(resolve, 0));

            // Return progress update
            if (i < batches - 1) {
                // This is used for progress updates during processing
                // The caller should handle these intermediate updates appropriately
                console.log(`Analyzed ${end}/${totalTemplates} templates (${progress}%)`);
            }
        }

        return {
            affectedTemplates: result,
            status: result.length > 0
                ? `Found ${result.length} affected template(s)`
                : "No affected templates found",
            progress: 100
        };
    } catch (error) {
        console.error("Error analyzing templates:", error);
        return {
            affectedTemplates: [],
            status: "Error analyzing templates",
            progress: 100,
            error: error.message
        };
    }
}

/**
 * Extract query elements like archetype IDs and path expressions from an AQL query
 * @param {string} aqlText - The AQL query text
 * @returns {Object} - Extracted query elements
 */
function extractQueryElements(aqlText) {
    const archetypeIds = [];
    const containsExpressions = [];
    const compositions = [];
    let ehr = false;

    // Extract top-level FROM clause archetypes
    const fromPattern = /FROM\s+(?:EHR\s+e\s+CONTAINS\s+)?([A-Z_]+)\s+([a-z])\s*(?:\[(.*?)\])?/i;
    const fromMatch = aqlText.match(fromPattern);

    if (fromMatch) {
        const type = fromMatch[1].toUpperCase(); // COMPOSITION, etc.
        const alias = fromMatch[2];
        const archetypeConstraint = fromMatch[3];

        // If we have an archetype constraint, extract it
        if (archetypeConstraint && archetypeConstraint.includes('openEHR-')) {
            archetypeIds.push(archetypeConstraint);

            if (type === 'COMPOSITION') {
                compositions.push(archetypeConstraint);
            }
        }

        // Track that we're working with EHR data
        ehr = aqlText.includes("EHR e") || aqlText.includes("EHR");
    }

    // Extract archetypes from CONTAINS expressions - only taking top level ones per contains block
    // This is more complex and requires analyzing the structure of nested CONTAINS
    const containsBlocks = aqlText.split(/CONTAINS/i);

    // Skip the first block (it's the FROM clause)
    for (let i = 1; i < containsBlocks.length; i++) {
        const block = containsBlocks[i].trim();
        // Extract the topmost archetype in this CONTAINS block
        const typeAliasPattern = /([A-Z_]+)\s+([a-z])\s*(?:\[(.*?)\])?/i;
        const match = block.match(typeAliasPattern);

        if (match) {
            const type = match[1].toUpperCase();
            const alias = match[2];
            const archetypeConstraint = match[3];

            containsExpressions.push({
                type: type,
                alias: alias,
                archetype: archetypeConstraint || null
            });

            // If it has an archetype ID, add it to our list
            if (archetypeConstraint && archetypeConstraint.includes('openEHR-')) {
                archetypeIds.push(archetypeConstraint);
            }
        }
    }

    return {
        archetypeIds,
        containsExpressions,
        ehr,
        compositions
    };
}

/**
 * Check if a template is affected by the given query elements
 * @param {Object} template - The template to check
 * @param {Array} archetypeIds - Archetype IDs from the query
 * @param {Array} containsExpressions - CONTAINS expressions from the query
 * @returns {boolean} - Whether the template is affected
 */
function isTemplateAffected(template, archetypeIds, containsExpressions) {
    if (!template.webTemplate || !template.webTemplate) {
        return false;
    }

    // Check if any of the archetypes in the query are in this template
    if (archetypeIds.length > 0) {
        // We need to scan the template tree for these archetypes
        for (const archetypeId of archetypeIds) {
            if (hasArchetypeInTree(template.webTemplate, archetypeId)) {
                return true;
            }
        }
    }

    // Check if any CONTAINS expressions match this template
    if (containsExpressions.length > 0 && archetypeIds.length === 0) {
        for (const expr of containsExpressions) {
            if (containsRmType(template.webTemplate, expr.type)) {
                return true;
            }
        }
    }

    return false;
}

/**
* Recursively check if any archetypes in the list are in the template tree
* @param {Object} node - The current node in the template tree
* @param {Array} archetypeIds - Archetype IDs to look for
* @returns {boolean} - Whether any archetype was found
*/
function hasArchetypeInTree(node, archetypeId) {
    if (!node) return false;

    // Match at this node level
    if (node.nodeId && node.nodeId === archetypeId) {
        return true;
    }

    // Check children
    if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
            if (hasArchetypeInTree(child, archetypeId)) {
                return true;
            }
        }
    }

    return false;
}


/**
 * Recursively check if a template contains a specific RM type
 * @param {Object} node - The current node in the template tree
 * @param {string} rmType - RM type to look for (e.g., OBSERVATION, EVALUATION)
 * @returns {boolean} - Whether the RM type was found
 */
function containsRmType(node, rmType) {
    if (!node) return false;

    // Check if this node has the RM type we're looking for
    if (node.rmType && node.rmType.toUpperCase() === rmType) {
        return true;
    }

    // Check children
    if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
            if (containsRmType(child, rmType)) {
                return true;
            }
        }
    }

    return false;
}

/**
 * Normalizes an AQL query by replacing relative paths with absolute paths
 * @param {string} aqlText - The AQL query text
 * @param {Array} affectedTemplates - Templates affected by this query
 * @returns {string} - Normalized AQL query
 */
 export function normalizeAQL(aqlText, affectedTemplates) {
    if (!aqlText || !affectedTemplates || affectedTemplates.length === 0) {
      return aqlText;
    }
    
    // First, extract all aliases from FROM and CONTAINS clauses
    const queryElements = extractQueryElements(aqlText);
    const aliases = {};
    
    // Extract aliases from FROM clause
    const fromPattern = /FROM\s+(?:EHR\s+e\s+CONTAINS\s+)?([A-Z_]+)\s+([a-z])\s*(?:\[(.*?)\])?/i;
    const fromMatch = aqlText.match(fromPattern);
    if (fromMatch) {
      aliases[fromMatch[2]] = {
        type: fromMatch[1],
        archetype: fromMatch[3]
      };
    }
    
    // Add aliases from CONTAINS expressions
    for (const expr of queryElements.containsExpressions) {
      if (expr.alias) {
        aliases[expr.alias] = {
          type: expr.type,
          archetype: expr.archetype
        };
      }
    }
    
    // Build a path map for all archetypes in affected templates
    const archetypePathMap = {};
    
    for (const template of affectedTemplates) {
      if (template.webTemplate && template.webTemplate) {
        collectArchetypePaths(template.webTemplate, '', archetypePathMap);
      }
    }
    
    // Now we have a map of archetypes to their absolute paths
    // For each alias, find its corresponding absolute path
    const aliasPathMap = {};
    
    for (const [alias, info] of Object.entries(aliases)) {
      if (info.archetype && archetypePathMap[info.archetype]) {
        aliasPathMap[alias] = archetypePathMap[info.archetype];
      }
    }
    
    // Now replace all alias references in the query
    let normalizedAQL = aqlText;
    
    // Replace in SELECT clause
    for (const [alias, path] of Object.entries(aliasPathMap)) {
      // Replace alias/path with absolute path
      const aliasRegex = new RegExp(`\\b${alias}\\/(\\w+)\\b`, 'g');
      normalizedAQL = normalizedAQL.replace(aliasRegex, (match, attribute) => {
        return `${path}/${attribute}`;
      });
      
      // Replace standalone alias with its path
      const standaloneAliasRegex = new RegExp(`\\b${alias}\\b(?!\\/|\\s*\\()`, 'g');
      normalizedAQL = normalizedAQL.replace(standaloneAliasRegex, path);
    }
    
    return normalizedAQL;
  }


  function collectArchetypePaths(node, parentPath, archetypePathMap) {
    if (!node) return;
    
    const currentPath = parentPath ? `${parentPath}/${node.aqlPath || ''}` : node.aqlPath || '';
    
    // If this node has an archetype ID and AQL path, store it
    if (node.nodeId && node.nodeId.includes('openEHR-') && currentPath) {
      archetypePathMap[node.nodeId] = currentPath;
    }
    
    // Process children
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        collectArchetypePaths(child, currentPath, archetypePathMap);
      }
    }
  }
  
