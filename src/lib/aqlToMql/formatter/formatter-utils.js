// src/lib/aqlToMql/formatter/formatter-utils.js

const createParseState = () => ({
  squareDepth: 0,
  roundDepth: 0,
  curlyDepth: 0,
  inSingleQuote: false,
  inDoubleQuote: false,
});

const isEscaped = (input, index) => {
  let backslashCount = 0;

  for (let i = index - 1; i >= 0 && input[i] === '\\'; i -= 1) {
    backslashCount += 1;
  }

  return backslashCount % 2 === 1;
};

const updateParseState = (state, input, index) => {
  const char = input[index];

  if (char === "'" && !state.inDoubleQuote && !isEscaped(input, index)) {
    state.inSingleQuote = !state.inSingleQuote;
    return;
  }

  if (char === '"' && !state.inSingleQuote && !isEscaped(input, index)) {
    state.inDoubleQuote = !state.inDoubleQuote;
    return;
  }

  if (state.inSingleQuote || state.inDoubleQuote) {
    return;
  }

  if (char === '[') {
    state.squareDepth += 1;
  } else if (char === ']') {
    state.squareDepth = Math.max(0, state.squareDepth - 1);
  } else if (char === '(') {
    state.roundDepth += 1;
  } else if (char === ')') {
    state.roundDepth = Math.max(0, state.roundDepth - 1);
  } else if (char === '{') {
    state.curlyDepth += 1;
  } else if (char === '}') {
    state.curlyDepth = Math.max(0, state.curlyDepth - 1);
  }
};

const isAtTopLevel = (state) => (
  !state.inSingleQuote
  && !state.inDoubleQuote
  && state.squareDepth === 0
  && state.roundDepth === 0
  && state.curlyDepth === 0
);

const isKeywordBoundary = (char) => !char || /[\s(),]/.test(char);

const matchesKeywordAt = (input, keyword, index, state) => {
  if (!isAtTopLevel(state)) {
    return false;
  }

  if (input.slice(index, index + keyword.length).toUpperCase() !== keyword) {
    return false;
  }

  const previousChar = input[index - 1];
  const nextChar = input[index + keyword.length];

  return isKeywordBoundary(previousChar) && isKeywordBoundary(nextChar);
};

// Helper: Splits a line on commas only when those commas are outside brackets, braces, parentheses, and quotes.
export const splitByCommaOutsideBrackets = (line) => {
  const parts = [];
  let current = "";
  const state = createParseState();

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === ',' && isAtTopLevel(state)) {
      parts.push(current);
      current = "";
      continue;
    }

    current += char;
    updateParseState(state, line, i);
  }

  if (current) {
    parts.push(current);
  }

  return parts;
};

export const splitByKeywordOutsideStructures = (input, keyword) => {
  const normalizedKeyword = keyword.toUpperCase();
  const segments = [];
  let current = "";
  const state = createParseState();

  for (let i = 0; i < input.length; i += 1) {
    if (matchesKeywordAt(input, normalizedKeyword, i, state)) {
      if (current.trim()) {
        segments.push(current.trim());
      }

      current = "";
      i += normalizedKeyword.length - 1;
      continue;
    }

    current += input[i];
    updateParseState(state, input, i);
  }

  if (current.trim()) {
    segments.push(current.trim());
  }

  return segments;
};

export const splitWhereConditions = (input) => {
  const operators = ['AND', 'OR'];
  const conditions = [];
  let current = "";
  let currentOperator = null;
  const state = createParseState();

  for (let i = 0; i < input.length; i += 1) {
    const matchedOperator = operators.find(operator => matchesKeywordAt(input, operator, i, state));

    if (matchedOperator) {
      if (current.trim()) {
        conditions.push({
          operator: currentOperator,
          condition: current.trim(),
        });
      }

      current = "";
      currentOperator = matchedOperator;
      i += matchedOperator.length - 1;
      continue;
    }

    current += input[i];
    updateParseState(state, input, i);
  }

  if (current.trim()) {
    conditions.push({
      operator: currentOperator,
      condition: current.trim(),
    });
  }

  return conditions;
};

export const extractTopLevelClauses = (query) => {
  const clauseKeywords = ['SELECT', 'FROM', 'WHERE', 'ORDER BY', 'OFFSET', 'LIMIT'];
  const positions = [];
  const state = createParseState();

  for (let i = 0; i < query.length; i += 1) {
    const matchedKeyword = clauseKeywords.find(keyword => matchesKeywordAt(query, keyword, i, state));

    if (matchedKeyword) {
      positions.push({ keyword: matchedKeyword, index: i });
      i += matchedKeyword.length - 1;
      continue;
    }

    updateParseState(state, query, i);
  }

  return positions.map((position, index) => {
    const nextPosition = positions[index + 1];
    const startIndex = position.index + position.keyword.length;
    const endIndex = nextPosition ? nextPosition.index : query.length;

    return {
      keyword: position.keyword,
      content: query.slice(startIndex, endIndex).trim(),
    };
  });
};

// Helper: Formats a FROM/CONTAINS block with hierarchical indentation.
export const formatFromContainsBlock = (line) => {
  if (!/^FROM\s+/i.test(line)) {
    return line;
  }

  const content = line.replace(/^FROM\s+/i, '').trim();
  const tokens = splitByKeywordOutsideStructures(content, 'CONTAINS');
  const indent = (level) => '    '.repeat(level);

  if (tokens.length === 0) {
    return 'FROM';
  }

  let result = "FROM";

  if (tokens[0]) {
    result += "\n" + indent(1) + tokens[0];
  }

  for (let i = 1; i < tokens.length; i += 1) {
    result += "\n" + indent(2 * i) + "CONTAINS";
    result += "\n" + indent(2 * i + 1) + tokens[i];
  }

  return result;
};
