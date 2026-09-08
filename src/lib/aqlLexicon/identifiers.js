// src/lib/aqlLexicon/indentifiers.js

// Reserved words & symbols (avoid as aliases/identifiers)
export const AQL_RESERVED_WORDS = new Set([
  // Clauses
  'SELECT','AS','FROM','WHERE','ORDER','BY','LIMIT','OFFSET','DISTINCT',
  // Containment / logic / comparisons
  'CONTAINS','AND','OR','NOT','LIKE','MATCHES','EXISTS',
  // Directions
  'ASC','ASCENDING','DESC','DESCENDING',
  // Aggregates
  'COUNT','MIN','MAX','SUM','AVG',
  // String funcs (subset commonly supported)
  'LENGTH','POSITION','SUBSTRING','CONCAT',
  // Numeric funcs
  'ABS','MOD','CEIL','FLOOR','ROUND',
  // Date/Time
  'CURRENT_DATE','CURRENT_TIME','CURRENT_DATE_TIME','NOW','CURRENT_TIMEZONE',
  // Literals
  'NULL','TRUE','FALSE'
  // (Vendor extensions intentionally NOT reserved)
]);

export function isReservedWord(s) { return AQL_RESERVED_WORDS.has((s||'').toUpperCase()); }
export function isValidIdentifier(s) { return !!s && /^[A-Za-z][A-Za-z0-9_]*$/.test(s) && !isReservedWord(s); }
export function sanitizeToIdentifier(s,fallback='col'){ let out=(s||'').trim().replace(/\W+/g,'_'); if(!/^[A-Za-z]/.test(out)) out=`_${out}`; if(isReservedWord(out)) out+=`_1`; return out||fallback; }