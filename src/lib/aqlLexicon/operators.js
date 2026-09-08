// src/lib/aqlLexicon/operators.js

export const LOGICAL_SIBLING_OPERATORS = ['AND','OR'];

export const AQL_ORDER_DIRECTIONS = ['ASC','DESC','ASCENDING','DESCENDING'];

// WHERE operators per DV_* type (keep tokens canonical/uppercase)
export const AQL_WHERE_OPERATORS_BY_TYPE = {
  DEFAULT: ['=','!='],
  DV_TEXT: ['=','!=','LIKE','MATCHES'],
  DV_CODED_TEXT: ['=','!=','MATCHES'],
  DV_QUANTITY: ['=','!=','>','>=','<','<='],
  DV_COUNT: ['=','!=','>','>=','<','<='],
  DV_DATE_TIME: ['=','!=','>','>=','<','<='],
  DV_BOOLEAN: ['=','!='],
  DV_IDENTIFIER: ['=','!=','LIKE','MATCHES'],
  DV_ORDINAL: ['=','!=','>','>=','<','<=']
};

export function getWhereOperatorsForRmType(rmType) {
  const key = (rmType || '').toUpperCase();
  return AQL_WHERE_OPERATORS_BY_TYPE[key] || AQL_WHERE_OPERATORS_BY_TYPE.DEFAULT;
}