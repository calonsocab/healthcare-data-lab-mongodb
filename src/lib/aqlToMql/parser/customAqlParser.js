/**
 * Custom AQL Parser
 * A hand-written parser for openEHR Archetype Query Language (AQL)
 * that handles complex FROM clauses with bracketed predicates
 */

/**
 * Enhanced AQL Parser 
 * Properly handles nested CONTAINS clauses and complex FROM structures
 */

 export function parseAql(aqlInput) {
  try {
    // First attempt standard ANTLR parsing
    return parseAqlToCustomAst(aqlInput);
  } catch (error) {
    console.log("ANTLR parsing failed, trying custom fallback parser:", error.message);
    // If ANTLR fails, use our robust custom parser
    return customParseAql(aqlInput);
  }
}

function parseAqlToCustomAst(aqlInput) {
  // Extract main clauses (SELECT, FROM, WHERE, etc.)
  const clauses = extractMainClauses(aqlInput);
  
  // Parse SELECT clause
  const select = parseSelectClause(clauses.select);
  
  // Parse FROM and CONTAINS clauses
  const { from, contains } = parseFromAndContains(clauses.from);
  
  // Parse WHERE clause
  const where = parseWhereClause(clauses.where);
  
  // Parse ORDER BY clause
  const orderBy = parseOrderByClause(clauses.orderBy);
  
  // Parse LIMIT/OFFSET
  const { limit, offset } = parseLimitOffset(clauses.limit);
  
  // Build final AST
  const ast = {
    select,
    from,
    contains,
    where,
    orderBy,
    limit,
    offset
  };
  
  return ast;
}

/**
 * Extract main clauses from an AQL query string
 */
function extractMainClauses(aql) {
  const clauses = {
    select: '',
    from: '',
    where: '',
    orderBy: '',
    limit: ''
  };
  
  // Match SELECT clause
  const selectMatch = aql.match(/SELECT\s+(.*?)(?=\s+FROM\s+|$)/is);
  if (selectMatch) clauses.select = selectMatch[1].trim();
  
  // Match FROM clause
  const fromMatch = aql.match(/FROM\s+(.*?)(?=\s+WHERE\s+|\s+ORDER\s+BY|\s+LIMIT\s+|$)/is);
  if (fromMatch) clauses.from = fromMatch[1].trim();
  
  // Match WHERE clause
  const whereMatch = aql.match(/WHERE\s+(.*?)(?=\s+ORDER\s+BY|\s+LIMIT\s+|$)/is);
  if (whereMatch) clauses.where = whereMatch[1].trim();
  
  // Match ORDER BY clause
  const orderByMatch = aql.match(/ORDER\s+BY\s+(.*?)(?=\s+LIMIT\s+|$)/is);
  if (orderByMatch) clauses.orderBy = orderByMatch[1].trim();
  
  // Match LIMIT clause
  const limitMatch = aql.match(/LIMIT\s+(.*?)$/is);
  if (limitMatch) clauses.limit = limitMatch[1].trim();
  
  return clauses;
}

/**
 * Parse the SELECT clause
 */
function parseSelectClause(selectText) {
  if (!selectText) return { distinct: false, columns: {} };
  
  // Check for DISTINCT
  const distinct = /DISTINCT\s+/i.test(selectText);
  if (distinct) {
    selectText = selectText.replace(/DISTINCT\s+/i, '');
  }
  
  // Split columns by commas, respecting nested functions and parentheses
  const columns = splitByCommas(selectText);
  
  const result = {
    distinct,
    columns: {}
  };
  
  // Process each column
  columns.forEach((column, index) => {
    // Look for alias with AS keyword
    const asMatch = /\s+AS\s+(\w+)$/i.exec(column);
    
    if (asMatch) {
      // We have an alias
      const valuePart = column.slice(0, asMatch.index).trim();
      const alias = asMatch[1].trim();
      
      result.columns[index] = {
        value: parseColumnValue(valuePart),
        alias: alias
      };
    } else {
      // No alias - use the expression itself
      result.columns[index] = {
        value: parseColumnValue(column.trim())
      };
    }
  });
  
  return result;
}

/**
 * Parse a column value (path, function call, etc.)
 */
function parseColumnValue(text) {
  // Check if it's an aggregate function
  const aggFuncMatch = /^(COUNT|MIN|MAX|AVG|SUM)\s*\((.*)\)$/i.exec(text);
  if (aggFuncMatch) {
    return {
      type: "aggregateFunctionCall",
      path: text,
      function: {
        name: aggFuncMatch[1].toUpperCase(),
        args: aggFuncMatch[2].trim()
      }
    };
  }
  
  // Check if it's a function call
  const funcMatch = /^(\w+)\s*\((.*)\)$/i.exec(text);
  if (funcMatch && !aggFuncMatch) {
    return {
      type: "functionCall",
      path: text,
      function: {
        name: funcMatch[1],
        args: funcMatch[2].trim()
      }
    };
  }
  
  // If it's a literal (starts with number or quote)
  if (/^(['"]).*\1$/.test(text) || /^-?\d+(\.\d+)?$/.test(text)) {
    return {
      type: "literal",
      path: text,
      value: text.replace(/^(['"])(.*)\1$/, '$2')
    };
  }
  
  // Default to data path
  return {
    type: "dataMatchPath",
    path: text
  };
}

/**
 * Parse FROM clause and extract CONTAINS structures
 */
function parseFromAndContains(fromText) {
  if (!fromText) return { from: {}, contains: null };
  
  // Split the FROM clause by CONTAINS, respecting parentheses
  const parts = splitByTopLevelContains(fromText);
  
  // The first part is the main FROM expression
  const mainFrom = parseRmType(parts[0]);
  
  // If there are no CONTAINS clauses, return just the FROM part
  if (parts.length <= 1) {
    return { from: mainFrom, contains: null };
  }
  
  // Build the nested CONTAINS structure from the remaining parts
  const containsStructure = buildNestedContainsStructure(parts.slice(1));
  
  return { from: mainFrom, contains: containsStructure };
}

/**
 * Split a FROM clause by top-level CONTAINS
 */
function splitByTopLevelContains(text) {
  const parts = [];
  let remainder = text.trim();
  
  while (remainder) {
    const containsIndex = findTopLevelKeyword(remainder, 'CONTAINS');
    
    if (containsIndex === -1) {
      // No more CONTAINS
      parts.push(remainder);
      break;
    }
    
    // Add the part before CONTAINS
    parts.push(remainder.substring(0, containsIndex).trim());
    
    // Move to after CONTAINS
    remainder = remainder.substring(containsIndex + 8).trim();
  }
  
  return parts;
}

/**
 * Build a nested CONTAINS structure from parts
 */
function buildNestedContainsStructure(parts) {
  if (!parts.length) return null;
  
  // Process the first part
  let firstPart = parts[0];
  
  // Check if this part has a nested CONTAINS within it
  const nestedContainsIndex = findTopLevelKeyword(firstPart, 'CONTAINS');
  
  if (nestedContainsIndex !== -1) {
    // This part has a nested CONTAINS
    const beforeContains = firstPart.substring(0, nestedContainsIndex).trim();
    const afterContains = firstPart.substring(nestedContainsIndex + 8).trim();
    
    // Parse the part before CONTAINS
    const containingNode = parseContainsExpression(beforeContains);
    
    // Parse the part after CONTAINS
    const containedNode = parseContainsExpression(afterContains);
    
    // Create the nested structure
    containingNode.contains = containedNode;
    
    // If there are more top-level CONTAINS parts, process them
    if (parts.length > 1) {
      // Create a sequential CONTAINS structure
      return {
        ...containingNode,
        contains: buildNestedContainsStructure(parts.slice(1))
      };
    }
    
    return containingNode;
  }
  
  // Check for AND/OR expressions
  const andIndex = findTopLevelKeyword(firstPart, 'AND');
  const orIndex = findTopLevelKeyword(firstPart, 'OR');
  
  if (andIndex !== -1 || orIndex !== -1) {
    // This is a compound AND/OR expression
    const opIndex = (andIndex !== -1 && orIndex !== -1) ? 
                   Math.min(andIndex, orIndex) : 
                   (andIndex !== -1 ? andIndex : orIndex);
    
    const operator = firstPart.substring(opIndex, opIndex + 3).toUpperCase().trim();
    const leftExpr = firstPart.substring(0, opIndex).trim();
    const rightExpr = firstPart.substring(opIndex + 3).trim();
    
    // Parse both sides of the AND/OR
    const leftNode = parseContainsExpression(leftExpr);
    const rightNode = parseContainsExpression(rightExpr);
    
    // Create the AND/OR structure
    const result = {
      operator,
      children: {
        "0": leftNode,
        "1": rightNode
      }
    };
    
    // If there are more parts, add them
    if (parts.length > 1) {
      return {
        ...result,
        contains: buildNestedContainsStructure(parts.slice(1))
      };
    }
    
    return result;
  }
  
  // Simple expression without nested CONTAINS or AND/OR
  const node = parseContainsExpression(firstPart);
  
  // If there are more parts, process them
  if (parts.length > 1) {
    return {
      ...node,
      contains: buildNestedContainsStructure(parts.slice(1))
    };
  }
  
  return node;
}

/**
 * Parse a CONTAINS expression
 */
function parseContainsExpression(expr) {
  // Remove outer parentheses if balanced
  if (expr.startsWith('(') && expr.endsWith(')') && isBalanced(expr)) {
    return parseContainsExpression(expr.slice(1, -1).trim());
  }
  
  // Check for AND/OR expressions
  const andIndex = findTopLevelKeyword(expr, 'AND');
  const orIndex = findTopLevelKeyword(expr, 'OR');
  
  if (andIndex !== -1 || orIndex !== -1) {
    // This is a compound expression
    const opIndex = (andIndex !== -1 && orIndex !== -1) ? 
                   Math.min(andIndex, orIndex) : 
                   (andIndex !== -1 ? andIndex : orIndex);
    
    const operator = expr.substring(opIndex, opIndex + 3).toUpperCase().trim();
    const leftExpr = expr.substring(0, opIndex).trim();
    const rightExpr = expr.substring(opIndex + 3).trim();
    
    // Check if right side has a CONTAINS
    const rightContainsIndex = findTopLevelKeyword(rightExpr, 'CONTAINS');
    
    if (rightContainsIndex !== -1) {
      // The right side has a CONTAINS expression
      const beforeContains = rightExpr.substring(0, rightContainsIndex).trim();
      const afterContains = rightExpr.substring(rightContainsIndex + 8).trim();
      
      const rightContainingNode = parseRmType(beforeContains);
      const rightContainedNode = parseContainsExpression(afterContains);
      
      rightContainingNode.contains = rightContainedNode;
      
      return {
        operator,
        children: {
          "0": parseRmType(leftExpr),
          "1": rightContainingNode
        }
      };
    }
    
    // Regular AND/OR
    return {
      operator,
      children: {
        "0": parseRmType(leftExpr),
        "1": parseRmType(rightExpr)
      }
    };
  }
  
  // Check for nested CONTAINS
  const containsIndex = findTopLevelKeyword(expr, 'CONTAINS');
  
  if (containsIndex !== -1) {
    // This has a nested CONTAINS
    const beforeContains = expr.substring(0, containsIndex).trim();
    const afterContains = expr.substring(containsIndex + 8).trim();
    
    const containingNode = parseRmType(beforeContains);
    const containedNode = parseContainsExpression(afterContains);
    
    containingNode.contains = containedNode;
    return containingNode;
  }
  
  // Simple RM type expression
  return parseRmType(expr);
}

/**
 * Parse a Resource Model type expression (e.g., "EHR e[ehr_id/value='123']")
 */
function parseRmType(text) {
  // Match format like "EHR e[condition]" or just "EHR" or "EHR e"
  const regex = /^([A-Z]+)\s*([a-zA-Z0-9_]*)(?:\[(.*?)\])?/;
  const match = regex.exec(text.trim());
  
  if (!match) {
    // Fallback for unmatched text
    return { rmType: "", alias: text.trim(), predicate: null };
  }
  
  const rmType = match[1];
  const alias = match[2] || "";
  const bracketContent = match[3] ? match[3].trim() : null;
  
  let predicate = null;
  if (bracketContent) {
    predicate = parsePredicate(bracketContent);
  }
  
  return { rmType, alias, predicate };
}

/**
 * Parse a predicate expression (content inside square brackets)
 */
function parsePredicate(text) {
  // If it's an openEHR archetype ID without operator
  if (text.startsWith('openEHR-') && !text.includes('=')) {
    return {
      path: "archetype_node_id",
      operator: "=",
      value: text
    };
  }
  
  // Match equality pattern with optional quotes
  const equalsMatch = text.match(/^([^=]+)\s*=\s*['"]?([^'"]*?)['"]?$/);
  if (equalsMatch) {
    return {
      path: equalsMatch[1].trim(),
      operator: "=",
      value: equalsMatch[2].trim()
    };
  }
  
  // Fallback
  return { path: text, operator: null, value: null };
}

/**
 * Parse the WHERE clause
 */
function parseWhereClause(whereText) {
  if (!whereText) return {};
  
  // Parse the WHERE conditions into a structured format
  const conditions = parseWhereConditions(whereText);
  
  return conditions;
}

/**
 * Parse WHERE conditions recursively
 */
function parseWhereConditions(text) {
  // Try to find top-level AND or OR
  const andIndex = findTopLevelKeyword(text, 'AND');
  const orIndex = findTopLevelKeyword(text, 'OR');
  
  if (andIndex !== -1 || orIndex !== -1) {
    // Compound condition with AND/OR
    const opIndex = (andIndex !== -1 && orIndex !== -1) ? 
                   Math.min(andIndex, orIndex) : 
                   (andIndex !== -1 ? andIndex : orIndex);
    
    const operator = text.substring(opIndex, opIndex + 3).toUpperCase().trim();
    const leftExpr = text.substring(0, opIndex).trim();
    const rightExpr = text.substring(opIndex + 3).trim();
    
    // Parse both sides recursively
    const leftCondition = parseWhereConditions(leftExpr);
    const rightCondition = parseWhereConditions(rightExpr);
    
    return {
      operator,
      conditions: {
        "0": leftCondition,
        "1": rightCondition
      }
    };
  }
  
  // If it's a parenthesized expression
  if (text.startsWith('(') && text.endsWith(')') && isBalanced(text)) {
    return parseWhereConditions(text.slice(1, -1).trim());
  }
  
  // Parse a single condition
  return parseSingleCondition(text);
}

/**
 * Parse a single WHERE condition
 */
function parseSingleCondition(text) {
  // Match patterns for common conditions
  
  // EXISTS
  if (/^EXISTS\s+/i.test(text)) {
    const path = text.replace(/^EXISTS\s+/i, '').trim();
    return {
      path,
      operator: "EXISTS",
      value: null
    };
  }
  
  // NOT EXISTS
  if (/^NOT\s+EXISTS\s+/i.test(text)) {
    const path = text.replace(/^NOT\s+EXISTS\s+/i, '').trim();
    return {
      path,
      operator: "NOT EXISTS",
      value: null
    };
  }
  
  // MATCHES with array
  const matchesMatch = text.match(/(.*?)\s+MATCHES\s+\{(.*?)\}/i);
  if (matchesMatch) {
    const path = matchesMatch[1].trim();
    
    // Parse the comma-separated values, handling quotes
    const valuesText = matchesMatch[2];
    const valueArray = splitByCommas(valuesText).map(v => {
      const trimmed = v.trim();
      // Remove quotes if present
      return trimmed.replace(/^(['"])(.*)\1$/, '$2');
    });
    
    // Convert to object with numeric keys
    const valueObj = {};
    valueArray.forEach((v, i) => {
      valueObj[i] = v;
    });
    
    return {
      path,
      operator: "MATCHES",
      value: valueObj
    };
  }
  
  // LIKE operator
  const likeMatch = text.match(/(.*?)\s+LIKE\s+(.*)/i);
  if (likeMatch) {
    const path = likeMatch[1].trim();
    let value = likeMatch[2].trim();
    
    // Remove quotes if present
    value = value.replace(/^(['"])(.*)\1$/, '$2');
    
    return {
      path,
      operator: "LIKE",
      value
    };
  }
  
  // Standard comparison operators (=, !=, >, <, >=, <=)
  const comparisonMatch = text.match(/(.*?)\s*([=!<>]=?|!=)\s*(.*)/);
  if (comparisonMatch) {
    const path = comparisonMatch[1].trim();
    const operator = comparisonMatch[2];
    let value = comparisonMatch[3].trim();
    
    // Remove quotes if present
    value = value.replace(/^(['"])(.*)\1$/, '$2');
    
    return {
      path,
      operator,
      value
    };
  }
  
  // If no pattern matched, return the raw condition
  return { raw: text };
}

/**
 * Parse the ORDER BY clause
 */
function parseOrderByClause(orderByText) {
  if (!orderByText) return {};
  
  // Split by commas, respecting functions and parentheses
  const parts = splitByCommas(orderByText);
  const result = {};
  
  parts.forEach((part, index) => {
    // Look for direction (ASC/DESC)
    const descMatch = /\s+(DESC|DESCENDING)$/i.exec(part);
    const ascMatch = /\s+(ASC|ASCENDING)$/i.exec(part);
    
    let path = part;
    let direction = "ASC"; // Default to ascending
    
    if (descMatch) {
      path = part.substring(0, descMatch.index).trim();
      direction = "DESC";
    } else if (ascMatch) {
      path = part.substring(0, ascMatch.index).trim();
      direction = "ASC";
    }
    
    result[index] = { path, direction };
  });
  
  return result;
}

/**
 * Parse LIMIT and OFFSET clauses
 */
function parseLimitOffset(limitText) {
  if (!limitText) return { limit: null, offset: null };
  
  // Check for OFFSET keyword
  const parts = limitText.split(/\s+OFFSET\s+/i);
  
  const limit = parseInt(parts[0], 10) || null;
  const offset = parts.length > 1 ? (parseInt(parts[1], 10) || null) : null;
  
  return { limit, offset };
}

// ======================== Helper functions ========================

/**
 * Find a top-level keyword in text, respecting parentheses depth
 */
function findTopLevelKeyword(text, keyword) {
  let depth = 0;
  const upperText = text.toUpperCase();
  const keywordLength = keyword.length;
  
  for (let i = 0; i < text.length - keywordLength + 1; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth--;
    
    // Only consider keywords at depth 0 (top level)
    if (depth === 0 && 
        upperText.substr(i, keywordLength) === keyword &&
        (i === 0 || /\s/.test(text[i-1])) && // preceded by whitespace or start
        (i + keywordLength === text.length || /\s/.test(text[i+keywordLength]))) { // followed by whitespace or end
      return i;
    }
  }
  
  return -1;
}

/**
 * Split a string by commas, respecting nested parentheses and brackets
 */
function splitByCommas(text) {
  const result = [];
  let current = "";
  let depth = 0;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if (char === '(' || char === '[' || char === '{') {
      depth++;
      current += char;
    } else if (char === ')' || char === ']' || char === '}') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    result.push(current.trim());
  }
  
  return result;
}

/**
 * Check if a string has balanced parentheses
 */
function isBalanced(text) {
  let depth = 0;
  
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') depth--;
    
    if (depth < 0) return false;
  }
  
  return depth === 0;
}

/**
 * Custom AQL Parser - fallback implementation
 */
export function customParseAql(aqlString) {
  // This function would be your existing fallback parser implementation
  // The implementation above should replace this in most cases
  console.log("Using fallback parser for AQL");
  
  // Clean and normalize the input
  const cleanedAql = aqlString.replace(/\s+/g, ' ').trim();
  
  // Extract the main clauses
  const clauses = extractMainClauses(cleanedAql);
  
  // Parse each clause
  const result = {
    select: parseSelectClause(clauses.select),
    from: {},
    contains: null,
    where: {},
    orderBy: {},
    limit: null,
    offset: null
  };
  
  // Parse FROM and CONTAINS
  const fromResult = parseFromAndContains(clauses.from);
  result.from = fromResult.from;
  result.contains = fromResult.contains;
  
  // Parse WHERE
  if (clauses.where) {
    result.where = parseWhereClause(clauses.where);
  }
  
  // Parse ORDER BY
  if (clauses.orderBy) {
    result.orderBy = parseOrderByClause(clauses.orderBy);
  }
  
  // Parse LIMIT/OFFSET
  if (clauses.limit) {
    const limitResult = parseLimitOffset(clauses.limit);
    result.limit = limitResult.limit;
    result.offset = limitResult.offset;
  }
  
  return result;
}