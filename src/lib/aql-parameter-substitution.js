// src/lib/aql-parameter-substitution.js

import { analyzeAffectedTemplates } from './aql-normalizer';

/**
 * Extracts parameters from an AQL query
 * @param {string} aqlText - The AQL query text
 * @returns {Array<string>} - List of parameters found in the query
 */
export function extractParametersFromAQL(aqlText) {
  if (!aqlText) return [];
  
  // Match all occurrences of $parameterName in the query
  // Parameters can start with $ and contain letters, numbers, and underscores
  const parameterRegex = /\$([a-zA-Z0-9_]+)/g;
  const matches = [...aqlText.matchAll(parameterRegex)];
  
  // Extract just the parameter names without the $ prefix
  return matches.map(match => match[0]);
}

const normalizeParameterValue = (value) => {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildParameterRegex = (parameter) => (
  new RegExp(`${escapeRegex(parameter)}(?![a-zA-Z0-9_])`, 'g')
);

const getUniqueParameters = (parameters = []) => (
  Array.from(new Set(parameters.filter(Boolean)))
);

/**
 * Analyzes a parameter based on its context in the AQL and the affected templates
 * @param {string} parameter - The parameter name with $ prefix
 * @param {string} aqlText - The full AQL query text
 * @param {Array} affectedTemplates - Templates affected by this query
 * @returns {Object} - Parameter type information and suggested value
 */
export function analyzeParameter(parameter, aqlText, affectedTemplates) {
  if (!parameter || !aqlText) {
    return { type: 'unknown', suggestedValue: parameter };
  }
  
  // Extract the parameter name without $ prefix
  const paramName = parameter.substring(1);
  
  // Look for where this parameter is used in the query
  const contexts = findParameterContexts(parameter, aqlText);
  
  // For each context, determine the likely data type
  for (const context of contexts) {
    // If we find a clear type from the context, return it
    if (context.type !== 'unknown') {
      return context;
    }
  }
  
  // If we couldn't determine from context, try to infer from templates
  if (affectedTemplates && affectedTemplates.length > 0) {
    for (const template of affectedTemplates) {
      // Try to find this parameter in path expressions related to this template
      const templateMatch = findParameterInTemplate(paramName, template, contexts);
      if (templateMatch && templateMatch.type !== 'unknown') {
        return templateMatch;
      }
    }
  }
  
  // If we still don't know, make a best guess based on the parameter name
  return guessParameterTypeFromName(paramName);
}

/**
 * Find all contexts where a parameter is used in an AQL query
 * @param {string} parameter - The parameter name with $ prefix
 * @param {string} aqlText - The AQL query text
 * @returns {Array<Object>} - List of contexts with type information
 */
function findParameterContexts(parameter, aqlText) {
  const contexts = [];
  
  // Check if parameter is used in a comparison with a date/time field
  if (aqlText.includes('/time') && aqlText.includes(parameter)) {
    // Look for patterns like: path/time >= $param
    const dateTimePattern = new RegExp(`([\\w\\/\\[\\]]+time\\S*\\s*[<>=]+\\s*${parameter.replace('$', '\\$')})`, 'i');
    if (dateTimePattern.test(aqlText)) {
      contexts.push({
        type: 'datetime',
        context: 'timestamp_comparison',
        suggestedValue: new Date().toISOString()
      });
    }
  }
  
  // Check if parameter is used in a string comparison (often with defining_code)
  if (aqlText.includes('/value/defining_code') && aqlText.includes(parameter)) {
    // Look for patterns like: path/value/defining_code/code_string = $param
    const codePattern = new RegExp(`([\\w\\/\\[\\]]+code_string\\s*[=]+\\s*${parameter.replace('$', '\\$')})`, 'i');
    if (codePattern.test(aqlText)) {
      contexts.push({
        type: 'code',
        context: 'code_comparison',
        suggestedValue: 'CODE123'
      });
    }
  }
  
  // Check if parameter is used with identifiers (like professional IDs)
  if (aqlText.includes('/identifiers/id') && aqlText.includes(parameter)) {
    const idPattern = new RegExp(`([\\w\\/\\[\\]]+identifiers\\/id\\s*[=]+\\s*${parameter.replace('$', '\\$')})`, 'i');
    if (idPattern.test(aqlText)) {
      contexts.push({
        type: 'identifier',
        context: 'id_comparison',
        suggestedValue: 'ID12345'
      });
    }
  }
  
  // If we didn't find specific contexts, but the parameter appears in a WHERE clause
  if (contexts.length === 0) {
    const whereClausePattern = /WHERE\s+(.*?)(?:ORDER BY|LIMIT|$)/is;
    const whereMatch = aqlText.match(whereClausePattern);
    
    if (whereMatch && whereMatch[1].includes(parameter)) {
      // Generic unknown context in WHERE clause
      contexts.push({
        type: 'unknown',
        context: 'where_clause',
        suggestedValue: 'value'
      });
    }
  }
  
  return contexts;
}

/**
 * Try to find parameter information in a template
 * @param {string} paramName - Parameter name without $ prefix
 * @param {Object} template - Template object
 * @param {Array} contexts - Already identified contexts
 * @returns {Object|null} - Parameter type information if found
 */
function findParameterInTemplate(paramName, template, contexts) {
  // This would require deep analysis of the template structure
  // For now, we'll implement a simplified version
  
  if (!template.webTemplate || !template.webTemplate) {
    return null;
  }
  
  // For each context, try to find a matching path in the template
  for (const context of contexts) {
    if (context.context === 'timestamp_comparison') {
      // We already know it's a datetime
      return {
        type: 'datetime',
        context: 'template_matching',
        suggestedValue: new Date().toISOString()
      };
    }
    
    if (context.context === 'code_comparison') {
      // Look for code sets in the template
      const templateHasCodeSet = hasPathInTemplateTree(template.webTemplate, 'defining_code');
      if (templateHasCodeSet) {
        // We confirmed it's a code from the template
        return {
          type: 'code',
          context: 'template_code',
          suggestedValue: 'CODE_' + template.webTemplate.rmType.substring(0, 3).toUpperCase()
        };
      }
    }
  }
  
  return null;
}

/**
 * Check if a specific path exists in the template tree
 * @param {Object} node - Template tree node
 * @param {string} pathFragment - Path fragment to look for
 * @returns {boolean} - Whether the path exists
 */
function hasPathInTemplateTree(node, pathFragment) {
  if (!node) return false;
  
  // Check if this node's AQL path contains the fragment
  if (node.aqlPath && node.aqlPath.includes(pathFragment)) {
    return true;
  }
  
  // Check children recursively
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      if (hasPathInTemplateTree(child, pathFragment)) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Make a best guess at parameter type based on its name
 * @param {string} paramName - Parameter name without $ prefix
 * @returns {Object} - Parameter type information
 */
function guessParameterTypeFromName(paramName) {
  const lowerName = paramName.toLowerCase();
  
  // Check for date-related parameter names
  if (lowerName.includes('date') || lowerName.includes('time') || 
      lowerName.includes('inicio') || lowerName.includes('fi') ||
      lowerName.includes('start') || lowerName.includes('end')) {
    return {
      type: 'datetime',
      context: 'name_analysis',
      suggestedValue: new Date().toISOString()
    };
  }
  
  // Check for ID-related parameter names
  if (lowerName.includes('id') || lowerName.includes('code') || 
      lowerName.includes('identifier') || lowerName.includes('centre') ||
      lowerName.includes('center')) {
    return {
      type: 'identifier',
      context: 'name_analysis',
      suggestedValue: lowerName.toUpperCase() + '001'
    };
  }
  
  // Check for person-related parameter names
  if (lowerName.includes('professional') || lowerName.includes('doctor') || 
      lowerName.includes('practitioner') || lowerName.includes('provider')) {
    return {
      type: 'practitioner',
      context: 'name_analysis',
      suggestedValue: 'PRAC12345'
    };
  }
  
  // Default to string
  return {
    type: 'string',
    context: 'default',
    suggestedValue: 'sample_value'
  };
}

/**
 * Generate a properly formatted value based on the parameter type
 * @param {string} type - The parameter type
 * @param {string} value - The raw value to format
 * @returns {string} - Properly formatted value for AQL
 */
export function formatValueForType(type, value) {
  const normalizedValue = normalizeParameterValue(value);
  // Remove any existing quotes
  const rawValue = normalizedValue.replace(/^['"]|['"]$/g, '');
  
  switch(type) {
    case 'datetime':
      // For datetime values, use simple ISO string with quotes
      // The AQL parser doesn't seem to like DATE_TIME_STRING()
      return `'${rawValue}'`;
      
    case 'date':
      // For date values, use simple date string with quotes
      return `'${rawValue.split('T')[0]}'`;
      
    case 'time':
      // For time values, use time portion of ISO string with quotes
      return `'${rawValue.split('T')[1] || rawValue}'`;
      
    case 'code':
    case 'identifier':
    case 'practitioner':
    case 'string':
      // String values just need to be quoted
      return `'${rawValue}'`;
      
    case 'integer':
      return rawValue;
      
    case 'real':
      return rawValue;

    case 'boolean':
      return String(rawValue).toLowerCase() === 'true' ? 'true' : 'false';
      
    default:
      // When in doubt, format as string
      return `'${rawValue}'`;
  }
}

/**
 * Applies the current substitution values to a parameterized AQL query
 * @param {string} aqlText - AQL query containing $parameters
 * @param {Array} substitutions - Parameter substitution descriptors
 * @returns {Object} - Query with substituted values and refreshed substitution metadata
 */
export function applyParameterSubstitutions(aqlText, substitutions = []) {
  if (!aqlText) {
    return { aqlText, substitutions: [] };
  }

  if (!Array.isArray(substitutions) || substitutions.length === 0) {
    return { aqlText, substitutions: [] };
  }

  const uniqueSubstitutions = [];
  const seenParameters = new Set();

  for (const substitution of substitutions) {
    if (!substitution?.parameter || seenParameters.has(substitution.parameter)) {
      continue;
    }

    seenParameters.add(substitution.parameter);
    uniqueSubstitutions.push(substitution);
  }

  let substitutedAql = aqlText;
  const resolvedSubstitutions = uniqueSubstitutions.map((substitution) => {
    const rawValue = normalizeParameterValue(
      substitution.rawValue ?? substitution.originalValue ?? substitution.parameter
    );
    const substitutedValue = formatValueForType(substitution.type, rawValue);

    substitutedAql = substitutedAql.replace(
      buildParameterRegex(substitution.parameter),
      substitutedValue
    );

    return {
      ...substitution,
      rawValue,
      substitutedValue,
    };
  });

  return {
    aqlText: substitutedAql,
    substitutions: resolvedSubstitutions,
  };
}

/**
 * Substitute parameters in an AQL query with synthetic values
 * @param {string} aqlText - The AQL query text
 * @param {Array} templates - Available templates for analysis
 * @returns {Object} - Query with substituted parameters and parameter info
 */
export async function substituteParametersWithSyntheticValues(aqlText, templates = []) {
  if (!aqlText) {
    return { aqlText, substitutions: [] };
  }
  
  // Extract all parameters from the query
  const parameters = getUniqueParameters(extractParametersFromAQL(aqlText));
  if (parameters.length === 0) {
    return { aqlText, substitutions: [] };
  }
  
  // If we have templates, analyze them to get affected templates
  let affectedTemplates = [];
  if (templates && templates.length > 0) {
    const analysisResult = await analyzeAffectedTemplates(aqlText, templates);
    affectedTemplates = analysisResult.affectedTemplates || [];
  }
  
  // For each parameter, determine its type and suggest a value
  const substitutions = [];
  
  for (const param of parameters) {
    const analysis = analyzeParameter(param, aqlText, affectedTemplates);
    
    // Record the substitution
    substitutions.push({
      parameter: param,
      type: analysis.type,
      originalValue: param,
      rawValue: normalizeParameterValue(analysis.suggestedValue),
      context: analysis.context
    });
  }

  return applyParameterSubstitutions(aqlText, substitutions);
}

/**
 * This function provides a more specific datetime value based on parameter name
 * @param {string} paramName - The parameter name
 * @returns {string} - A context-appropriate datetime string
 */
export function getContextualDateTimeValue(paramName) {
  const now = new Date();
  const lowerName = paramName.toLowerCase();
  
  // Start date parameters typically get an earlier date
  if (lowerName.includes('start') || lowerName.includes('inicio') || lowerName.includes('from')) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(now.getMonth() - 3);
    return threeMonthsAgo.toISOString();
  }
  
  // End date parameters typically get current or future date
  if (lowerName.includes('end') || lowerName.includes('fi') || lowerName.includes('to')) {
    return now.toISOString();
  }
  
  // Default date (1 month ago)
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(now.getMonth() - 1);
  return oneMonthAgo.toISOString();
}
