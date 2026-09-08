// lib/aqlToMql/translator/hybrid-nodes/search-builder.js

import { mapArchetypeIdToShorthand } from '../dictionary';

const DEFAULT_SEARCH_NODE_FIELD = 'sn';
const DEFAULT_SEARCH_DATA_FIELD = 'd';

const buildNodePathHelper = (strategyConfig = {}) => {
  const nodeField = strategyConfig?.fields?.searchNodes || DEFAULT_SEARCH_NODE_FIELD;
  const dataField = strategyConfig?.fields?.searchData || DEFAULT_SEARCH_DATA_FIELD;
  return {
    field: nodeField,
    toPath: (suffix = '') => (suffix ? `${nodeField}.${suffix}` : nodeField),
    dataPath: (suffix = '') => (suffix ? `${nodeField}.${dataField}.${suffix}` : `${nodeField}.${dataField}`),
  };
};

/**
 * Build the MongoDB Atlas Search stage for population queries.
 * 
 * @param {Object} containsInfo - Information from the parsed CONTAINS clauses
 * @param {Object} whereInfo - Information from the parsed WHERE conditions
 * @param {Object} strategyConfig - Configuration options
 * @returns {Object} MongoDB $search stage or null if not applicable
 */
export function buildSearchStage(containsInfo, whereInfo, strategyConfig) {
  // Ensure that Atlas Search is properly configured
  if (!strategyConfig || !strategyConfig.atlasSearch || !strategyConfig.atlasSearch.index_name) {
    console.warn("[Search-Builder] Missing Atlas Search configuration. Cannot build $search stage.");
    return null;
  }

  if (strategyConfig.atlasSearch.enabled === false) {
    console.warn("[Search-Builder] Atlas Search disabled in strategy config.");
    return null;
  }

  const nodePaths = buildNodePathHelper(strategyConfig);

  // Create the $search stage
  const searchStage = {
    $search: {
      index: strategyConfig.atlasSearch.index_name,
      compound: {
        must: [],
        should: [],
        mustNot: []
      }
    }
  };

  // Add conditions for archetypes
  const archetypeConditions = buildArchetypeSearchConditions(containsInfo, nodePaths);
  if (archetypeConditions.length > 0) {
    searchStage.$search.compound.must.push(...archetypeConditions);
  }

  // Add conditions from WHERE clause
  if (whereInfo && whereInfo.conditions.length > 0) {
    // Identify which conditions can be handled by Atlas Search
    const searchableConditions = whereInfo.conditions.filter(cond =>
      !cond.isEhrIdCondition && isSearchableCondition(cond, strategyConfig));

    // Build search conditions for searchable WHERE conditions
    const whereSearchConditions = buildWhereSearchConditions(searchableConditions, strategyConfig, nodePaths);
    if (whereSearchConditions.length > 0) {
      searchStage.$search.compound.must.push(...whereSearchConditions);
    }

    // Identify conditions that cannot be handled by Atlas Search
    // These will need to be handled by a separate $match stage
    const unsearchableConditions = whereInfo.conditions.filter(cond =>
      !cond.isEhrIdCondition && !isSearchableCondition(cond, strategyConfig));

    // Store these for later processing
    if (unsearchableConditions.length > 0) {
      whereInfo.unhandledConditions = unsearchableConditions;
    }
  }

  // Only return the stage if it has at least one condition
  if (searchStage.$search.compound.must.length === 0 &&
    searchStage.$search.compound.should.length === 0 &&
    searchStage.$search.compound.mustNot.length === 0) {
    return null;
  }

  return searchStage;
}

/**
 * Build search conditions for archetypes required by CONTAINS clauses.
 * 
 * @param {Object} containsInfo - Information from the parsed CONTAINS clauses
 * @returns {Array} Array of Atlas Search conditions
 */
function buildArchetypeSearchConditions(containsInfo, nodePaths) {
  const conditions = [];

  // Add a condition for each required archetype
  containsInfo.entries.forEach(entry => {
    if (entry.archetypeId) {
      const searchCondition = {
        embeddedDocument: {
          path: nodePaths.toPath(),
          operator: {
            compound: {
              must: [
                {
                  equals: {
                    path: nodePaths.dataPath('ani'),
                    value: entry.archetypeId
                  }
                }
              ]
            }
          }
        }
      };

      // Add RM type condition if available
      if (entry.rmType) {
        const shortArchetypeId = mapArchetypeIdToShorthand(entry.archetypeId);
        searchCondition.embeddedDocument.operator.compound.must.push({
          equals: {
            path: nodePaths.dataPath('ani'),
            value: shortArchetypeId
          }
        });
      }

      // Add parent relationship if this is a nested archetype
      if (entry.parentAlias) {
        const parentEntry = containsInfo.entriesByAlias[entry.parentAlias];
        if (parentEntry && parentEntry.archetypeId) {
          searchCondition.embeddedDocument.operator.compound.must.push({
            equals: {
              path: nodePaths.toPath('a'),
              value: parentEntry.archetypeId
            }
          });
        }
      }

      conditions.push(searchCondition);
    }
  });

  return conditions;
}

/**
 * Build search conditions from WHERE clauses.
 * 
 * @param {Array} conditions - Searchable WHERE conditions
 * @param {Object} strategyConfig - Configuration options
 * @returns {Array} Array of Atlas Search conditions
 */
function buildWhereSearchConditions(conditions, strategyConfig, nodePaths) {
  const searchConditions = [];

  conditions.forEach(condition => {
    if (condition.isValueCondition) {
      // Value condition (e.g., ev/data[at0001]/items[at0002]/value/value)
      const valueCondition = buildValueSearchCondition(condition, strategyConfig, nodePaths);
      if (valueCondition) {
        searchConditions.push(valueCondition);
      }
    } else if (condition.isTimeCondition) {
      // Time condition (e.g., ev/time/value)
      const timeCondition = buildTimeSearchCondition(condition, nodePaths);
      if (timeCondition) {
        searchConditions.push(timeCondition);
      }
    } else if (condition.isArchetypeCondition) {
      // Archetype condition (e.g., ev/archetype_node_id)
      const archetypeCondition = buildArchetypeSearchCondition(condition, nodePaths);
      if (archetypeCondition) {
        searchConditions.push(archetypeCondition);
      }
    }
  });

  return searchConditions;
}

/**
 * Build a value search condition for value-related filters.
 * 
 * @param {Object} condition - The WHERE condition
 * @param {Object} strategyConfig - Configuration options
 * @returns {Object} Atlas Search condition
 */
function buildValueSearchCondition(condition, strategyConfig, nodePaths) {
  const { path } = condition.pathComponents;

  // Handle different patterns of value paths
  if (path.endsWith('/value/value')) {
    // Check if text search is enabled for this field
    const textSearchEnabled = isTextSearchEnabledForPath(path, strategyConfig);

    if (textSearchEnabled && condition.operator === '=') {
      // Use text search for text fields with equals operator
      return {
        embeddedDocument: {
          path: nodePaths.toPath(),
          operator: {
            text: {
              query: condition.mongoValue,
              path: nodePaths.dataPath('v'),
              fuzzy: getFuzzyOptions(strategyConfig)
            }
          }
        }
      };
    } else {
      // Use equals for other cases
      return {
        embeddedDocument: {
          path: nodePaths.toPath(),
          operator: {
            [getSearchOperator(condition.operator)]: {
              path: nodePaths.dataPath('v'),
              [getSearchOperatorArg(condition.operator)]: condition.mongoValue
            }
          }
        }
      };
    }
  }
  // Handle coded values (defining_code/code_string)
  else if (path.endsWith('/value/defining_code/code_string')) {
    // Special handling for MATCHES operator with code_string
    if (condition.operator === 'MATCHES') {
      // For MATCHES with multiple values, use should (logical OR)
      const shouldConditions = [];
      condition.mongoValue.forEach(value => {
        shouldConditions.push({
          equals: {
            path: nodePaths.dataPath('cs'),
            value: value
          }
        });
      });

      return {
        embeddedDocument: {
          path: nodePaths.toPath(),
          operator: {
            compound: {
              should: shouldConditions,
              minimumShouldMatch: 1
            }
          }
        }
      };
    } else {
      // Normal operator for code_string
      return {
        embeddedDocument: {
          path: nodePaths.toPath(),
          operator: {
            equals: {
              path: nodePaths.dataPath('cs'),
              value: condition.mongoValue
            }
          }
        }
      };
    }
  }

  // Default case if no specific handling
  return null;
}

/**
 * Build a time search condition for time-related filters.
 * 
 * @param {Object} condition - The WHERE condition
 * @returns {Object} Atlas Search condition
 */
function buildTimeSearchCondition(condition, nodePaths) {
  const { path } = condition.pathComponents;

  // Handle different time fields
  let searchPath = "";

  if (path === 'time/value') {
    searchPath = nodePaths.dataPath('time');
  } else if (path === 'context/start_time/value') {
    searchPath = nodePaths.dataPath('st');
  } else if (path.includes('date') || path.includes('time')) {
    // Generic time/date field
    searchPath = nodePaths.dataPath(path.replace(/\//g, '.'));
  } else {
    // Can't handle this time path
    return null;
  }

  // Build the range condition
  return {
    embeddedDocument: {
      path: nodePaths.toPath(),
      operator: {
        range: {
          path: searchPath,
          [getSearchRangeOperator(condition.operator)]: condition.mongoValue
        }
      }
    }
  };
}

/**
 * Build an archetype search condition for archetype-related filters.
 * 
 * @param {Object} condition - The WHERE condition
 * @returns {Object} Atlas Search condition
 */
function buildArchetypeSearchCondition(condition, nodePaths) {
  const { path } = condition.pathComponents;

  // Handle archetype_node_id condition
  if (path === 'archetype_node_id') {
    return {
      embeddedDocument: {
        path: nodePaths.toPath(),
        operator: {
          equals: {
            path: nodePaths.dataPath('ani'),
            value: condition.mongoValue
          }
        }
      }
    };
  }
  // Handle archetype_details.archetype_id.value condition
  else if (path === 'archetype_details/archetype_id/value') {
    return {
      embeddedDocument: {
        path: nodePaths.toPath(),
        operator: {
          equals: {
            path: nodePaths.dataPath('ai'),
            value: condition.mongoValue
          }
        }
      }
    };
  }

  // Can't handle other archetype paths
  return null;
}

/**
 * Check if a condition can be handled by Atlas Search.
 * 
 * @param {Object} condition - The WHERE condition
 * @param {Object} strategyConfig - Configuration options
 * @returns {boolean} True if the condition can be handled by Atlas Search
 */
function isSearchableCondition(condition, strategyConfig) {
  // Check if the operator is supported by Atlas Search
  const supportedOperators = ['=', '!=', '>', '>=', '<', '<=', 'MATCHES'];
  if (!supportedOperators.includes(condition.operator)) {
    return false;
  }

  // Check if the path is indexed for search
  const { path } = condition.pathComponents;

  // Common searchable paths
  const commonSearchablePaths = [
    '/archetype_node_id',
    '/value/value',
    '/value/defining_code/code_string',
    '/time/value',
    '/context/start_time/value'
  ];

  // First check if it's a common searchable path
  for (const searchablePath of commonSearchablePaths) {
    if (path.endsWith(searchablePath)) {
      return true;
    }
  }

  // Check config for additional searchable paths
  if (strategyConfig.atlasSearch && strategyConfig.atlasSearch.searchablePaths) {
    for (const searchablePath of strategyConfig.atlasSearch.searchablePaths) {
      if (path.includes(searchablePath)) {
        return true;
      }
    }
  }

  // Not searchable
  return false;
}

/**
 * Check if text search is enabled for a specific path.
 * 
 * @param {string} path - The path to check
 * @param {Object} strategyConfig - Configuration options
 * @returns {boolean} True if text search is enabled for this path
 */
function isTextSearchEnabledForPath(path, strategyConfig) {
  if (!strategyConfig.atlasSearch || !strategyConfig.atlasSearch.textSearchPaths) {
    return false;
  }

  // Check if this path is explicitly listed as a text search path
  for (const textPath of strategyConfig.atlasSearch.textSearchPaths) {
    if (path.endsWith(textPath)) {
      return true;
    }
  }

  // Not a text search path
  return false;
}

/**
 * Get fuzzy search options from strategy config.
 * 
 * @param {Object} strategyConfig - Configuration options
 * @returns {Object|undefined} Fuzzy search options or undefined if disabled
 */
function getFuzzyOptions(strategyConfig) {
  if (strategyConfig.atlasSearch &&
    strategyConfig.atlasSearch.fuzzySearch === false) {
    return undefined;
  }

  return {
    maxEdits: strategyConfig.atlasSearch?.fuzzyMaxEdits || 1,
    prefixLength: strategyConfig.atlasSearch?.fuzzyPrefixLength || 2
  };
}

/**
 * Map AQL comparison operators to Atlas Search range operators.
 * 
 * @param {string} operator - AQL operator
 * @returns {string} Atlas Search range operator
 */
function getSearchRangeOperator(operator) {
  const operatorMap = {
    '>': 'gt',
    '>=': 'gte',
    '<': 'lt',
    '<=': 'lte',
    '=': 'eq',
    '==': 'eq',
    '!=': 'ne'
  };

  return operatorMap[operator] || 'eq';
}

/**
 * Get the appropriate Atlas Search operator based on AQL operator.
 * 
 * @param {string} operator - AQL operator
 * @returns {string} Atlas Search operator
 */
function getSearchOperator(operator) {
  if (['>', '>=', '<', '<='].includes(operator)) {
    return 'range';
  } else if (operator === '!=' || operator === '<>') {
    return 'compound';
  } else {
    return 'equals';
  }
}

/**
 * Get the argument name for the search operator.
 * 
 * @param {string} operator - AQL operator
 * @returns {string} Argument name
 */
function getSearchOperatorArg(operator) {
  if (operator === '>') return 'gt';
  if (operator === '>=') return 'gte';
  if (operator === '<') return 'lt';
  if (operator === '<=') return 'lte';
  return 'value';
}

/**
 * Map openEHR RM type to its shorthand representation.
 * 
 * @param {string} rmType - RM type (e.g., "COMPOSITION", "EVALUATION")
 * @returns {string} Shorthand (e.g., "C", "E")
 */
function mapRmTypeToShorthand(rmType) {
  const rmTypeMap = {
    'COMPOSITION': 'C',
    'SECTION': 'S',
    'ADMIN_ENTRY': 'M',
    'OBSERVATION': 'O',
    'EVALUATION': 'E',
    'INSTRUCTION': 'I',
    'ACTION': 'A',
    'CLUSTER': 'K',
    'ITEM_TREE': 'T',
    'ITEM_LIST': 'L',
    'ITEM_SINGLE': 'G',
    'ITEM_TABLE': 'B',
    'ELEMENT': 'U',
    'HISTORY': 'H',
    'EVENT': 'V',
    'POINT_EVENT': 'P',
    'INTERVAL_EVENT': 'N',
    'ACTIVITY': 'Y',
    'ISM_TRANSITION': 'X',
    'INSTRUCTION_DETAILS': 'Z',
    'CARE_ENTRY': 'R',
    'PARTY_PROXY': 'W',
    'EVENT_CONTEXT': 'J'
  };

  return rmTypeMap[rmType] || rmType;
}

export default buildSearchStage;
