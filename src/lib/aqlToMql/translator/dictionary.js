/**
 * Dictionary for AQL-to-MQL translation.
 * 
 * This file defines mappings between openEHR standard field names,
 * RM types, archetype IDs, and their shortened versions for the flattened MongoDB structure.
 * 
 * All hardcoded labels are defined here.
 */

// OpenEHR RM Types mapping to shortened forms
const RM_TYPE_MAP = {
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

// Field name shortcuts
const FIELD_NAME_MAP = {
  "_type": "T",
  "name": "n",
  "value": "v",
  "archetype_node_id": "ani",
  "archetype_details": "ad",
  "archetype_id": "ai",
  "template_id": "ti",
  "rm_version": "rv",
  "start_time": "st",
  "time": "time",
  "context": "cx",
  "content": "ct",
  "other_context": "oc",
  "composer": "cpr",
  "setting": "se",
  "category": "ca",
  "territory": "te",
  "items": "i",
  "events": "ev",
  "description": "ds",
  "defining_code": "df",
  "terminology_id": "tid",
  "code_string": "cs",
  "language": "l",
  "encoding": "e",
  "feeder_audit": "fa",
  "uid": "uid",
  "subject": "su",
  "provider": "pr",
  "other_participations": "op",
  "function": "fx",
  "performer": "pf",
  "identifiers": "ids",
  "identifier": "id"
};

// Archetype prefix mappings for openEHR archetype IDs
const ARCHETYPE_PREFIX_MAP = {
  'openEHR-EHR-COMPOSITION': 'CC',
  'openEHR-EHR-SECTION': 'SS',
  'openEHR-EHR-ADMIN_ENTRY': 'MM',
  'openEHR-EHR-OBSERVATION': 'OO',
  'openEHR-EHR-EVALUATION': 'EE',
  'openEHR-EHR-INSTRUCTION': 'II',
  'openEHR-EHR-ACTION': 'AA',
  'openEHR-EHR-CLUSTER': 'KK',
  'openEHR-EHR-ITEM_TREE': 'TT',
  'openEHR-EHR-ITEM_LIST': 'LL',
  'openEHR-EHR-ITEM_SINGLE': 'GG',
  'openEHR-EHR-ITEM_TABLE': 'BB',
  'openEHR-EHR-ELEMENT': 'UU',
  'openEHR-EHR-HISTORY': 'HH',
  'openEHR-EHR-EVENT': 'VV',
  'openEHR-EHR-POINT_EVENT': 'PP',
  'openEHR-EHR-INTERVAL_EVENT': 'NN'
};

// Data type mappings to shorthand
const DATA_TYPE_MAP = {
  'DV_TEXT': 'dt',
  'DV_CODED_TEXT': 'dct',
  'DV_DATE_TIME': 'ddt',
  'DV_DATE': 'dd',
  'DV_TIME': 'dti',
  'DV_QUANTITY': 'dq',
  'DV_COUNT': 'dc',
  'DV_BOOLEAN': 'db',
  'DV_IDENTIFIER': 'di',
  'DV_PROPORTION': 'dp'
};

/**
 * Map standard RM type to its shorthand form.
 */
export function mapRmTypeToShorthand(rmType) {
  return RM_TYPE_MAP[rmType] || rmType;
}

/**
 * Map a field name to its shorthand form.
 */
export function mapFieldNameToShorthand(fieldName) {
  return FIELD_NAME_MAP[fieldName] || fieldName;
}

/**
 * Map an archetype ID to its shorthand prefix.
 */
export function mapArchetypePrefixToShorthand(archetypeId) {
  for (const [prefix, shorthand] of Object.entries(ARCHETYPE_PREFIX_MAP)) {
    if (archetypeId.startsWith(prefix)) {
      return shorthand;
    }
  }
  return null;
}

/**
 * Convert a full archetype ID to its shorthand form.
 */
export function mapArchetypeIdToShorthand(archetypeId) {
  if (!archetypeId) return archetypeId;
  for (const [prefix, shorthand] of Object.entries(ARCHETYPE_PREFIX_MAP)) {
    if (archetypeId.startsWith(prefix)) {
      return archetypeId.replace(prefix, shorthand);
    }
  }
  return archetypeId;
}

/**
 * Map a data type to its shorthand form.
 */
export function mapDataTypeToShorthand(dataType) {
  return DATA_TYPE_MAP[dataType] || dataType;
}

/**
 * Convert an AQL path to a MongoDB path using appropriate shortcuts.
 */
export function mapAqlPathToMongoPath(aqlPath) {
  const pathWithArchetypes = transformArchetypeReferences(aqlPath);
  const segments = pathWithArchetypes.split('.');
  const transformedSegments = segments.map(segment => mapFieldNameToShorthand(segment));
  return transformedSegments.join('.');
}

/**
 * Transform archetype references in an AQL path.
 */
function transformArchetypeReferences(aqlPath) {
  let result = aqlPath.replace(/\[([^\]]+)\]/g, '.$1');
  result = result.replace(/\//g, '.');
  return result;
}

/**
 * Get the name of the field containing nodes (search_nodes vs comp_nodes).
 */
export function getNodesArrayField(useSearchNodes = false) {
  return useSearchNodes ? "sn" : "cn";
}

/**
 * Map an AQL operator to a MongoDB operator.
 */
export function mapOperatorToMongo(operator) {
  const operatorMap = {
    '=': '$eq',
    '==': '$eq',
    '!=': '$ne',
    '>': '$gt',
    '>=': '$gte',
    '<': '$lt',
    '<=': '$lte',
    'EXISTS': '$exists',
    'MATCHES': '$in'
  };
  return operatorMap[operator] || '$eq';
}

/**
 * Recursively apply field shortcuts to an object.
 */
export function applyFieldShortcuts(obj) {
  if (Array.isArray(obj)) {
    return obj.map(applyFieldShortcuts);
  } else if (obj !== null && typeof obj === 'object') {
    const result = {};
    for (const key of Object.keys(obj)) {
      let mappedKey = key;
      if (mappedKey.includes('.')) {
        mappedKey = mappedKey.split('.').map(part => mapFieldNameToShorthand(part)).join('.');
      } else {
        mappedKey = mapFieldNameToShorthand(mappedKey);
      }
      result[mappedKey] = applyFieldShortcuts(obj[key]);
    }
    return result;
  } else {
    return obj;
  }
}

export default {
  mapRmTypeToShorthand,
  mapFieldNameToShorthand,
  mapArchetypePrefixToShorthand,
  mapDataTypeToShorthand,
  mapAqlPathToMongoPath,
  getNodesArrayField,
  mapOperatorToMongo,
  applyFieldShortcuts
};