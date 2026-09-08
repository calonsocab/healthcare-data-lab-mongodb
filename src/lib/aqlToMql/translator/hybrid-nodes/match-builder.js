// lib/aqlToMql/translator/hybrid-nodes/match-builder.js
import {
  getNodesArrayField,
  mapRmTypeToShorthand,
  mapArchetypeIdToShorthand,
  mapAqlPathToMongoPath,
} from '../dictionary';

/**
 * Build the MongoDB $match stage from parsed FROM, CONTAINS and nested WHERE conditions.
 *
 * @param {Object} fromInfo - Parsed FROM clause info.
 * @param {Object} containsInfo - Parsed CONTAINS clause info.
 * @param {Object} nestedConditionsTransformed - Nested WHERE conditions (already transformed).
 * @param {string} nodeField - Name of the nodes array (defaults to cn/comp_nodes).
 * @param {string} ehrIdField - Name of the ehr_id field (defaults to ehr_id).
 * @returns {Object} The MongoDB $match stage.
 */
export function buildMatchStage(
  fromInfo,
  containsInfo,
  nestedConditionsTransformed,
  nodeField = 'cn',
  ehrIdField = 'ehr_id'
) {
  const match = {};

  if (fromInfo.isEhrIdBased && fromInfo.ehrId) {
    const ehrKey = ehrIdField || 'ehr_id';
    match[ehrKey] = fromInfo.ehrId;
  }

  const nodesField = nodeField || getNodesArrayField(false);
  const elemMatches = [];

  const containsConds = buildArchetypeConditions(containsInfo);
  containsConds.forEach((cond) => {
    elemMatches.push({ $elemMatch: cond });
  });

  if (nestedConditionsTransformed) {
    elemMatches.push({ $elemMatch: nestedConditionsTransformed });
  }

  if (elemMatches.length === 1) {
    match[nodesField] = elemMatches[0];
  } else if (elemMatches.length > 1) {
    match[nodesField] = { $all: elemMatches };
  }

  return { $match: match };
}

/**
 * Build an array of conditions from the CONTAINS clauses,
 * mapping RM type and archetype id to the flattened keys.
 *
 * @param {Object} containsInfo - Parsed CONTAINS info.
 * @returns {Array} Array of condition objects.
 */
export function buildArchetypeConditions(containsInfo) {
  if (!containsInfo || !containsInfo.entries) return [];
  return containsInfo.entries.map((entry) => {
    const cond = {};
    if (entry.rmType) {
      cond['d.T'] = mapRmTypeToShorthand(entry.rmType);
    }
    if (entry.archetypeId) {
      cond['d.ani'] = mapArchetypeIdToShorthand(entry.archetypeId);
    }
    if (entry.parentAlias) {
      const parentEntry = containsInfo.entriesByAlias ? containsInfo.entriesByAlias[entry.parentAlias] : null;
      if (parentEntry && parentEntry.archetypeId) {
        cond['a'] = mapArchetypeIdToShorthand(parentEntry.archetypeId);
      } else {
        cond['a'] = entry.parentAlias;
      }
    }
    return cond;
  });
}

/**
 * Build nested match conditions from the WHERE clause.
 *
 * @param {Object} whereInfo - WHERE clause info (includes nested logical tree).
 * @param {Object} containsInfo - Parsed CONTAINS info (if needed).
 * @returns {Object} Transformed MongoDB query fragment.
 */
export function buildNestedMatchConditions(whereInfo, containsInfo, _nodeField = 'cn') {
  if (!whereInfo.logicalTree) return null;
  return transformLogicalTree(whereInfo.logicalTree);
}

function transformLogicalTree(tree) {
  if (tree.$and || tree.$or) {
    const operator = tree.$and ? '$and' : '$or';
    const transformedChildren = tree[operator].map((child) => transformLogicalTree(child));
    return { [operator]: transformedChildren };
  }

  const fullPath = tree.path || '';
  if (fullPath.includes('items[at0007]') && fullPath.includes('items[at0004]') === false && fullPath.includes('items[at0014]')) {
    const effectivePath = extractPublishingCentreField(fullPath);
    const mongoField = 'd.' + mapAqlPathToMongoPath(effectivePath);
    const condition = {};
    condition[mongoField] = { [tree.mongoOperator]: tree.mongoValue };
    return Object.assign({ 'd.T': 'U', 'd.ani': 'at0014' }, condition);
  } else {
    let effectivePath = fullPath;
    const firstSlashIndex = fullPath.indexOf('/');
    if (firstSlashIndex !== -1) {
      effectivePath = fullPath.substring(firstSlashIndex + 1);
    }
    const mongoField = 'd.' + mapAqlPathToMongoPath(effectivePath);
    const condition = {};
    condition[mongoField] = { [tree.mongoOperator]: tree.mongoValue };
    return condition;
  }
}

function extractPublishingCentreField(path) {
  const lastItemsIndex = path.lastIndexOf('/items[');
  if (lastItemsIndex !== -1) {
    const remainder = path.substring(lastItemsIndex);
    const slashIndex = remainder.indexOf('/', 1);
    if (slashIndex !== -1) {
      return remainder.substring(slashIndex + 1);
    }
  }
  const firstSlashIndex = path.indexOf('/');
  return firstSlashIndex !== -1 ? path.substring(firstSlashIndex + 1) : path;
}
