// lib/aqlToMql/util/path-utils.js

import { mapFieldNameToShorthand, mapArchetypePrefixToShorthand, mapArchetypeIdToShorthand } from '../translator/dictionary';

/**
 * Parse an AQL path into components.
 */
export function parseAqlPath(aqlPath) {
  if (!aqlPath) {
    return { alias: null, path: null, pathSegments: [], archetypeIds: [] };
  }
  const firstSlashIndex = aqlPath.indexOf('/');
  if (firstSlashIndex === -1) {
    return { alias: aqlPath, path: '', pathSegments: [], archetypeIds: [] };
  }
  const alias = aqlPath.substring(0, firstSlashIndex);
  const path = aqlPath.substring(firstSlashIndex + 1);
  const pathSegments = [];
  const archetypeIds = [];
  let currentSegment = '';
  let inBrackets = false;
  for (let i = 0; i < path.length; i++) {
    const char = path[i];
    if (char === '[') {
      inBrackets = true;
      if (currentSegment) {
        pathSegments.push({ type: 'field', value: currentSegment });
      }
      currentSegment = '';
    } else if (char === ']') {
      inBrackets = false;
      archetypeIds.push(currentSegment);
      pathSegments.push({ type: 'archetype', value: currentSegment });
      currentSegment = '';
    } else if (char === '/' && !inBrackets) {
      if (currentSegment) {
        pathSegments.push({ type: 'field', value: currentSegment });
      }
      currentSegment = '';
    } else {
      currentSegment += char;
    }
  }
  if (currentSegment) {
    pathSegments.push({ type: 'field', value: currentSegment });
  }
  return { alias, path, pathSegments, archetypeIds };
}

/**
 * Convert an AQL path to a MongoDB path for the flattened structure.
 */
export function convertAqlPathToMongoPath(alias, path) {
  const { pathSegments } = parseAqlPath(`${alias}/${path}`);
  let prefixParts = [alias, 'd'];
  for (const segment of pathSegments) {
    if (segment.type === 'field') {
      prefixParts.push(mapFieldNameToShorthand(segment.value));
    } else if (segment.type === 'archetype') {
      const prefix = mapArchetypePrefixToShorthand(segment.value);
      prefixParts.push(prefix || segment.value);
    }
  }
  return prefixParts.join('.');
}

/**
 * Build a variable name for a path.
 */
export function buildVariableNameForPath(alias, path) {
  return `${alias}_${path.replace(/[$begin:math:display$$end:math:display$\/.]/g, '_')}`;
}

/**
 * Extract archetype IDs from a path.
 */
export function extractArchetypeIdsFromPath(path) {
  const archetypeIds = [];
  const matches = path.match(/\[(at\d+|openEHR-EHR-[A-Z_]+\.[a-z_]+\.v\d+)\]/g);
  if (matches) {
    matches.forEach(match => {
      const archetypeId = match.substring(1, match.length - 1);
      archetypeIds.push(mapArchetypeIdToShorthand(archetypeId));
    });
  }
  return archetypeIds;
}

/**
 * Process a value for a MongoDB query.
 */
export function processValueForMongo(value, operator) {
  if (value === null || value === undefined) {
    return null;
  }
  if (operator === 'MATCHES' || operator === 'matches') {
    if (Array.isArray(value)) {
      return value;
    } else if (typeof value === 'string') {
      if (value.startsWith('{') && value.endsWith('}')) {
        const innerValue = value.substring(1, value.length - 1);
        return innerValue.split(',')
          .map(v => v.trim())
          .map(v => (v.startsWith("'") && v.endsWith("'") ? v.substring(1, v.length - 1) : v));
      } else {
        return [value];
      }
    } else if (value && value.type === 'literal' && value.value) {
      if (typeof value.value === 'string' && value.value.startsWith('{') && value.value.endsWith('}')) {
        const innerValue = value.value.substring(1, value.value.length - 1);
        return innerValue.split(',')
          .map(v => v.trim())
          .map(v => (v.startsWith("'") && v.endsWith("'") ? v.substring(1, v.length - 1) : v));
      } else {
        return [value.value];
      }
    }
    return [value];
  }
  if (typeof value === 'string' && value.startsWith('$')) {
    return value;
  }
  if (value && (value.type === 'date' || (typeof value === 'object' && value.value && value.$date))) {
    return value.value || value.$date;
  }
  if (value && value.type === 'literal' && value.value !== undefined) {
    return value.value;
  }
  return value;
}

export default {
  parseAqlPath,
  convertAqlPathToMongoPath,
  buildVariableNameForPath,
  extractArchetypeIdsFromPath,
  processValueForMongo
};