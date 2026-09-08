// src/lib/aqlToMql/formatter/formatter.js

import {
  extractTopLevelClauses,
  formatFromContainsBlock,
  splitByCommaOutsideBrackets,
  splitWhereConditions,
} from './formatter-utils.js';

const indent = (level = 1) => '    '.repeat(level);

const formatListClause = (keyword, content) => {
  if (!content) {
    return keyword;
  }

  const parts = splitByCommaOutsideBrackets(content)
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return keyword;
  }

  return [
    keyword,
    ...parts.map((part, index) => `${indent()}${part}${index < parts.length - 1 ? ',' : ''}`),
  ].join('\n');
};

const formatSelectClause = (content) => {
  if (!content) {
    return 'SELECT';
  }

  const distinctMatch = content.match(/^DISTINCT\b/i);
  const normalizedContent = distinctMatch
    ? content.slice(distinctMatch[0].length).trim()
    : content;
  const clauseHeader = distinctMatch ? 'SELECT DISTINCT' : 'SELECT';

  return formatListClause(clauseHeader, normalizedContent);
};

const formatWhereClause = (content) => {
  if (!content) {
    return 'WHERE';
  }

  const conditions = splitWhereConditions(content);

  if (conditions.length === 0) {
    return `WHERE\n${indent()}${content}`;
  }

  return [
    'WHERE',
    ...conditions.map(({ operator, condition }) => `${indent()}${operator ? `${operator} ` : ''}${condition}`),
  ].join('\n');
};

const formatSimpleClause = (keyword, content) => {
  if (!content) {
    return keyword;
  }

  return `${keyword} ${content}`;
};

/**
 * Formats an AQL query with improved readability and optional parameter substitution
 * Combined functionality - one button operation for both formatting and substitution
 * @param {string} query - The input AQL query to format
 * @param {Array} templates - Available templates for parameter analysis (optional)
 * @returns {Object} Formatted AQL query and substitution info
 */
export const formatAQLQuery = async (query, templates = []) => {
  // First detect if there are parameters in the query
  const hasParameters = query.includes('$');
  
  // Step 1: Format the query for better readability
  const parameterizedQuery = formatQueryOnly(query);
  
  // Step 2: If there are parameters, substitute them with proper values
  if (hasParameters && templates) {
    const { substituteParametersWithSyntheticValues } = await import('../../aql-parameter-substitution.js');
    const { aqlText, substitutions } = await substituteParametersWithSyntheticValues(parameterizedQuery, templates);
    
    return {
      formattedQuery: aqlText,
      parameterizedQuery,
      substitutions,
      hasSubstitutions: true
    };
  }
  
  // If no parameters or no templates, return just the formatted query
  return {
    formattedQuery: parameterizedQuery,
    parameterizedQuery,
    substitutions: [],
    hasSubstitutions: false
  };
};

/**
 * Core formatting function without parameter substitution
 * @param {string} query - The input AQL query to format
 * @returns {string} Formatted AQL query
 */
export const formatQueryOnly = (query) => {
  if (!query || !query.trim()) {
    return '';
  }

  // Normalize the input by replacing newlines and extra spaces.
  query = query.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

  // 1. Ensure a space after CONTAINS when missing.
  query = query.replace(/\bCONTAINS(?=\S)/gi, 'CONTAINS ');

  const clauses = extractTopLevelClauses(query);

  if (clauses.length === 0) {
    return query;
  }

  return clauses.map(({ keyword, content }) => {
    switch (keyword) {
      case 'SELECT':
        return formatSelectClause(content);
      case 'FROM':
        return formatFromContainsBlock(`FROM ${content}`.trim());
      case 'WHERE':
        return formatWhereClause(content);
      case 'ORDER BY':
        return formatListClause('ORDER BY', content);
      case 'OFFSET':
      case 'LIMIT':
        return formatSimpleClause(keyword, content);
      default:
        return `${keyword} ${content}`.trim();
    }
  }).join('\n').trim();
};

// Export the original utility functions for reuse
export {
  extractTopLevelClauses,
  splitByCommaOutsideBrackets,
  splitWhereConditions,
  formatFromContainsBlock,
};
