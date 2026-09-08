// src/lib/aqlLexicon/functions.js

// Canonical + widely implemented function names
export const AQL_SELECT_FUNCTIONS = {
    aggregate: ['COUNT','MIN','MAX','SUM','AVG'],
    string: ['LENGTH','POSITION','SUBSTRING','CONCAT'],
    numeric: ['ABS','MOD','CEIL','FLOOR','ROUND'],
    datetime: ['CURRENT_DATE','CURRENT_TIME','CURRENT_DATE_TIME','NOW','CURRENT_TIMEZONE'],
    // Vendor/extension bucket (optional UI)
    vendor: ['TERMINOLOGY']
  };
  
  export const AQL_ALL_SELECT_FUNCTIONS = new Set(
    Object.values(AQL_SELECT_FUNCTIONS).flat()
  );