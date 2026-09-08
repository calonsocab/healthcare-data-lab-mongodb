// parseAqlAST.js

import antlr4 from "antlr4";
import AqlParserVisitor from "../grammar/AqlParserVisitor.js";
import AqlLexer from "../grammar/AqlLexer.js";
import AqlParser from "../grammar/AqlParser.js";
// Import our custom parser for fallback
import { parseAql as customParseAql } from "./customAqlParser.js";

/**
 * Exported top-level function: parse an AQL string into a custom AST.
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

/**
 * 1) Uses ANTLR to parse SELECT, WHERE, ORDER BY, etc.
 * 2) Captures the raw FROM clause as text, then calls parseFromClauseAll() to build a structured object.
 */
function parseAqlToCustomAst(aqlInput) {
  const chars = new antlr4.InputStream(aqlInput);
  const lexer = new AqlLexer(chars);
  const tokens = new antlr4.CommonTokenStream(lexer);
  const parser = new AqlParser(tokens);
  parser.buildParseTrees = true;

  try {
    // Parse with ANTLR to get a parse tree
    const tree = parser.aqlQuery();
    // Visit the parse tree using our custom visitor
    const visitor = new AqlToIntermediateAstVisitor();
    const rawAst = visitor.visit(tree);

    // rawAst.from is a single string. We'll do our custom parse:
    const { from, contains } = parseFromClauseAll(rawAst.from);

    // Build final AST
    const ast = {
      select: rawAst.select,
      from,
      contains,
      where: rawAst.where,
      orderBy: rawAst.orderBy,
      limit: rawAst.limit,
      offset: rawAst.offset
    };

    console.log("Final AST:", JSON.stringify(ast, null, 2));
    return ast;
  } catch (error) {
    console.error("Error in ANTLR parsing:", error);
    throw error; // Rethrow to trigger fallback
  }
}

/* ----------------------------------------------------------------------------
   AqlToIntermediateAstVisitor: handles everything EXCEPT the FROM structure.
   We do NOT modify AqlParser.g4, so the grammar may still reject certain uses
   (like EHR e[ehr_id/value='X']). The code below simply captures the FROM text
   and returns it.
----------------------------------------------------------------------------- */
export class AqlToIntermediateAstVisitor extends AqlParserVisitor {
  visitAqlQuery(ctx) {
    const result = {
      select: {},
      from: "",
      where: {},
      orderBy: {},
      limit: null,
      offset: null
    };

    if (ctx.selectClause()) {
      result.select = this.visitSelectClause(ctx.selectClause());
    }
    if (ctx.fromClause()) {
      result.from = this.visitFromClause(ctx.fromClause());
      console.log("Debug: raw FROM clause:", result.from );
    }
    if (ctx.whereClause()) {
      result.where = this.visitWhereClause(ctx.whereClause());
    }
    if (ctx.limitClause()) {
      const limOff = this.visitLimitClause(ctx.limitClause());
      result.limit = limOff.limit;
      result.offset = limOff.offset;
    }
    if (ctx.orderByClause()) {
      result.orderBy = this.visitOrderByClause(ctx.orderByClause());
    }

    return result;
  }

  // SELECT Clause, capturing DISTINCT if present
  visitSelectClause(ctx) {
    const textUpper = ctx.getText().toUpperCase();
    const distinct = textUpper.includes("DISTINCT");

    const resultTable = ctx.resultTable?.();
    if (!resultTable || !resultTable.columnSpec) {
      return { distinct, columns: {} };
    }

    const columns = resultTable.columnSpec().map((colCtx) => this.visitColumnSpec(colCtx));
    const colsObj = {};
    columns.forEach((col, idx) => {
      if (col) colsObj[idx] = col;
    });

    return {
      distinct,
      columns: colsObj
    };
  }

  visitColumnSpec(ctx) {
    const columnValueCtx = ctx.columnValue();
    const aliasCtx = ctx.columnAlias();
    if (!columnValueCtx) return null;
    const value = this.visitColumnValue(columnValueCtx);
    const alias = aliasCtx ? aliasCtx.getText() : null;
    return { value, alias };
  }

  visitColumnValue(ctx) {
    if (ctx.dataMatchPath()) {
      return { type: "dataMatchPath", path: ctx.dataMatchPath().getText() };
    }
    if (ctx.aggregateFunctionCall()) {
      const aggCall = this.visitAggregateFunctionCall(ctx.aggregateFunctionCall());
      return {
        type: "aggregateFunctionCall",
        path: ctx.aggregateFunctionCall().getText(),
        function: aggCall.function
      };
    }
    if (ctx.functionCall()) {
      const funcCall = this.visitFunctionCall(ctx.functionCall());
      return {
        type: "functionCall",
        path: ctx.functionCall().getText(),
        function: funcCall
      };
    }
    if (ctx.primitiveLiteral()) {
      return {
        type: "literal",
        path: ctx.primitiveLiteral().getText(),
        value: ctx.primitiveLiteral().getText()
      };
    }
    return { type: "unknown", path: ctx.getText() };
  }

  // FROM: just return the raw text ( joined + trimmed ). We'll parse it manually later.
  visitFromClause(ctx) {
    // Instead of joining children manually, visit the fromExpr subtree.
    if (ctx.fromExpr()) {
      return this.visit(ctx.fromExpr());
    }
    return "";
  }

  visitFromExpr(ctx) {
    // You can choose to return the raw text, or do additional processing.
    // For example, simply return the text:
    return ctx.getText();
  }

  // WHERE Clause
  visitWhereClause(ctx) {
    if (!ctx.whereExpr()) return {};
    const conditions = this.visitWhereExpr(ctx.whereExpr());
    if (Array.isArray(conditions)) {
      const obj = {};
      conditions.forEach((cond, idx) => (obj[idx] = cond));
      return obj;
    }
    return conditions;
  }

  visitWhereExpr(ctx) {
    if (!ctx) return null;

    // If it's wrapped in parentheses ( ), strip them
    if (
      ctx.getChildCount() === 3 &&
      ctx.getChild(0).getText() === "(" &&
      ctx.getChild(ctx.getChildCount() - 1).getText() === ")"
    ) {
      return this.visitWhereExpr(ctx.getChild(1));
    }

    // If it's an expression with operator (left op right)
    if (ctx.getChildCount() === 3) {
      const left = this.visitWhereExpr(ctx.getChild(0));
      const op = ctx.getChild(1).getText().toUpperCase(); // AND / OR
      const right = this.visitWhereExpr(ctx.getChild(2));

      const leftArr = Array.isArray(left) ? left : [left];
      const rightArr = Array.isArray(right) ? right : [right];

      return {
        operator: op,
        conditions: [...leftArr, ...rightArr]
      };
    }

    // Otherwise handle a leaf
    return this.visit(ctx.getChild(0));
  }

  visitWhereBooleanLeaf(ctx) {
    if (!ctx) return [];
    if (ctx.SYM_EXISTS()) {
      const path = ctx.dataMatchPath().getText();
      return [{ path, operator: "EXISTS", value: null }];
    }
    let leftExpr = null;
    if (ctx.dataMatchPath()) {
      leftExpr = ctx.dataMatchPath().getText();
    } else if (ctx.functionCall()) {
      leftExpr = ctx.functionCall().getText();
    } else if (ctx.comparisonOperand()) {
      leftExpr = this.visitComparisonOperand(ctx.comparisonOperand());
    }
    const operator = ctx.comparisonOperator() ? ctx.comparisonOperator().getText() : null;
    let rightValue = null;
    if (ctx.comparisonOperand()) {
      rightValue = this.visitComparisonOperand(ctx.comparisonOperand());
    }
    if (leftExpr == null) {
      // e.g. "archetype_node_id = 'XYZ'"
      if (typeof rightValue === "string") {
        rightValue = rightValue.replace(/^'|'$/g, "");
      }
      return [{ path: "archetype_node_id", operator, value: rightValue }];
    }
    return [{ path: leftExpr, operator, value: rightValue }];
  }

  visitComparisonOperand(ctx) {
    if (ctx.value()) return this.visitValue(ctx.value());
    if (ctx.arithmeticExpr()) return this.visitArithmeticExpr(ctx.arithmeticExpr());
    return ctx.getText();
  }

  visitValue(ctx) {
    if (ctx.dataMatchPath()) {
      return { type: "dataMatchPath", value: ctx.dataMatchPath().getText() };
    }
    if (ctx.primitiveLiteral()) {
      const lit = ctx.primitiveLiteral().getText().replace(/^'|'$/g, "");
      return { type: "literal", value: lit };
    }
    if (ctx.functionCall()) {
      return this.visitFunctionCall(ctx.functionCall());
    }
    if (ctx.arithmeticExpr()) {
      return this.visitArithmeticExpr(ctx.arithmeticExpr());
    }
    return { type: "value", value: ctx.getText() };
  }

  // ORDER BY – fix trailing ASC/DESC
  visitOrderByClause(ctx) {
    if (!ctx || !ctx.orderByExpr() || ctx.orderByExpr().length === 0) return {};
    const orders = ctx.orderByExpr().map(expr => {
      const raw = expr.getText().trim();
      return parseOrderByExpression(raw);
    });
    const result = {};
    orders.forEach((o, idx) => (result[idx] = o));
    return result;
  }

  // LIMIT / OFFSET
  visitLimitClause(ctx) {
    const ints = ctx.INTEGER();
    if (!ints || ints.length === 0) return { limit: null, offset: null };
    const limitVal = parseInt(ints[0].getText(), 10) || 0;
    let offsetVal = null;
    if (ints.length > 1) {
      offsetVal = parseInt(ints[1].getText(), 10) || 0;
    }
    return { limit: limitVal, offset: offsetVal };
  }

  // Aggregates, function calls, arithmetic – unchanged
  visitFunctionCall(ctx) {
    const funcCall = {};
    if (ctx.terminologyFunctionCall()) {
      funcCall.type = "terminologyFunctionCall";
      funcCall.text = ctx.terminologyFunctionCall().getText();
    } else if (ctx.builtInFunction() && ctx.functionArgs()) {
      funcCall.type = "builtInFunction";
      funcCall.name = ctx.builtInFunction().getText();
      funcCall.args = this.visitFunctionArgs(ctx.functionArgs());
    } else if (ctx.LC_ID() && ctx.functionArgs()) {
      funcCall.type = "genericFunctionCall";
      funcCall.name = ctx.LC_ID().getText();
      funcCall.args = this.visitFunctionArgs(ctx.functionArgs());
    } else {
      funcCall.type = "functionCall";
      funcCall.text = ctx.getText();
    }
    return funcCall;
  }

  visitFunctionArgs(ctx) {
    if (!ctx) return [];
    const values = [];
    if (ctx.value()) {
      ctx.value().forEach(val => values.push(this.visitValue(val)));
    }
    return values;
  }

  visitAggregateFunctionCall(ctx) {
    const func = {};
    if (ctx.name && typeof ctx.name.getText === "function") {
      func.name = ctx.name.getText();
    } else if (ctx.aggregateMathFunction() && typeof ctx.aggregateMathFunction().getText === "function") {
      func.name = ctx.aggregateMathFunction().getText();
    } else {
      func.name = ctx.getText().split("(")[0];
    }
    const augmentedAdlPathNode = ctx.augmentedAdlPath ? ctx.augmentedAdlPath() : null;
    func.args = augmentedAdlPathNode ? augmentedAdlPathNode.getText() : null;
    return { type: "aggregateFunctionCall", function: func };
  }

  visitArithmeticExpr(ctx) {
    if (ctx.getChildCount() === 1) {
      return this.visitArithmeticLeaf(ctx.getChild(0));
    } else if (ctx.getChildCount() === 3) {
      return {
        type: "arithmeticExpr",
        left: this.visitArithmeticExpr(ctx.getChild(0)),
        operator: ctx.getChild(1).getText(),
        right: this.visitArithmeticExpr(ctx.getChild(2))
      };
    } else {
      return { type: "arithmeticExpr", text: ctx.getText() };
    }
  }

  visitArithmeticLeaf(ctx) {
    if (ctx.arithmeticLiteral()) {
      return { type: "literal", value: ctx.arithmeticLiteral().getText() };
    }
    if (ctx.value()) {
      return this.visitValue(ctx.value());
    }
    if (ctx.getChildCount() === 3) {
      return this.visitArithmeticExpr(ctx.getChild(1));
    }
    return { type: "arithmeticLeaf", text: ctx.getText() };
  }
}

/** 
 * Helper for ORDER BY to avoid merging 'DESC' into the path.
 * If the final token is ASC/ASCENDING or DESC/DESCENDING, remove it from the path, else default ASC.
 */
function parseOrderByExpression(raw) {
  let direction = "ASC";
  // e.g. match " ... DESC" at the end, ignoring case
  const pattern = /\s+(ASC|ASCENDING|DESC|DESCENDING)$/i;
  const match = pattern.exec(raw);
  if (match) {
    const dirText = match[1].toUpperCase();
    direction = dirText.startsWith("ASC") ? "ASC" : "DESC";
    // cut off the matched substring from the raw path
    const path = raw.substring(0, match.index).trim();
    return { path, direction };
  }
  // no match => default ASC
  return { path: raw, direction };
}

/* ----------------------------------------------------------------------------
   Now the custom parser for the FROM text, ignoring the official grammar.
   parseFromClauseAll(input) => { from: {...}, contains: nested structure }
----------------------------------------------------------------------------- */

function parseFromClauseAll(input) {
  console.log("Debug: raw FROM clause:", input);
  
  // 1) remove "FROM" if present
  input = input.replace(/^FROM\s+/i, "").trim();
  if (!input) return { from: {}, contains: null };

  // 2) We repeatedly split off each top-level "CONTAINS". 
  //    The first chunk is the main FROM resource (e.g. "EHR e[...]").
  //    Each subsequent chunk is a piece for the contains chain.

  const tokens = [];
  let remainder = input;

  while (true) {
    const { chunk, rest } = splitOffTopLevelContains(remainder);
    tokens.push(chunk.trim());
    if (!rest) break;
    remainder = rest.trim();
  }

  // tokens[0] => the main FROM token
  const fromObj = parseSingleRmToken(tokens[0]);

  // If no more tokens => no "CONTAINS"
  if (tokens.length < 2) {
    return { from: fromObj, contains: null };
  }

  // Combine all subsequent tokens into an expression that uses "AND" by default
  // so we can parse them as a single nested AND/OR expression if the user used parentheses.
  // For example if we have tokens = ["VERSION v", "COMPOSITION c", "CLUSTER cl01[...]", ...]
  // We'll join them => "VERSION v AND COMPOSITION c AND CLUSTER cl01[...] ..."
  const containsExpr = tokens.slice(1).map(t => t.trim()).join(" AND ");

  // parse it into a nested structure
  const containsAst = parseContainsExpression(containsExpr);

  return { from: fromObj, contains: containsAst };
}

/** 
 * Splits off everything up to the first top-level "CONTAINS"
 * e.g. "EHR e[...] CONTAINS VERSION v ..." => chunk="EHR e[...]", rest="VERSION v ..."
 */
function splitOffTopLevelContains(str) {
  let depth = 0;
  const upper = str.toUpperCase();
  for (let i = 0; i < str.length - 7; i++) {
    if (str[i] === "(") depth++;
    else if (str[i] === ")") depth--;
    if (depth === 0 && upper.substr(i, 8) === "CONTAINS") {
      const chunk = str.substring(0, i);
      const rest = str.substring(i + 8);
      return { chunk, rest };
    }
  }
  // no top-level CONTAINS found => entire str is one chunk
  return { chunk: str, rest: null };
}

/** 
 * parseContainsExpression => build nested AND/OR structure from a chunk like:
 *   "CLUSTER cl01[...] AND CLUSTER cl02[...] AND (OBSERVATION o[...] OR EVALUATION ev01[...])"
 */
function parseContainsExpression(expr) {
  // remove outer parentheses if balanced
  if (expr.startsWith("(") && expr.endsWith(")") && isBalanced(expr)) {
    return parseContainsExpression(expr.slice(1, -1).trim());
  }

  // find top-level AND or OR
  const idx = findFirstTopLevelAndOr(expr);
  if (idx >= 0) {
    // e.g. "AND" or "OR "
    const op = expr.substr(idx, 3).toUpperCase().trim(); // "AND" / "OR"
    const leftStr = expr.substring(0, idx).trim();
    const rightStr = expr.substring(idx + 3).trim();
    return {
      operator: op,
      children: [
        parseContainsExpression(leftStr),
        parseContainsExpression(rightStr)
      ]
    };
  }

  // if no top-level AND/OR => treat as single resource token
  return parseSingleRmToken(expr.trim());
}

/** 
 * parseSingleRmToken => e.g. "EHR e[...]"
 * Uses improved alias pattern to capture e, cl01, ev02, etc.
 */
function parseSingleRmToken(token) {
  // e.g. "([A-Z]+)([a-zA-Z0-9_]*)\s*\[(.*?)\]?"
  // That way "CLUSTERcl01[openEHR-...]" => rmType="CLUSTER", alias="cl01", bracketStuff=...
  const regex = /^([A-Z]+)([a-zA-Z0-9_]*)\s*(?:\[(.*?)\])?$/;
            
  const match = regex.exec(token);
  if (!match) {
    // fallback if it doesn't match at all
    // maybe it's a parenthesized expression or something unexpected
    return { rmType: "", alias: token, predicate: null };
  }

  const rmType = match[1] || "";
  const alias = match[2] || "";
  const bracket = (match[3] || "").trim();

  // If bracket is non-empty => parse it as a bracket predicate
  let pred = null;
  if (bracket) {
    pred = parseBracketPredicate(bracket);
  }

  return { rmType, alias, predicate: pred };
}

/** 
 * parseBracketPredicate => minimal parse for "[something='XYZ']" or multiple.
 * Here we only do a single path=val. If you want "AND"/"OR" inside brackets,
 * you can recursively parse them like a whereExpr. 
 */
 function parseBracketPredicate(str) {
  // If the string does not contain an operator, assume default equality on archetype_node_id.
  if (!/=/.test(str)) {
    return {
      path: "archetype_node_id",
      operator: "=",
      value: str.trim()
    };
  }
  // Otherwise, parse using your existing logic.
  const eqRegex = /^([^=]+)\s*=\s*'([^']*)'$/;
  const m = eqRegex.exec(str);
  if (m) {
    return {
      path: m[1].trim(),
      operator: "=",
      value: m[2].trim()
    };
  }
  // Fallback, return the raw string in case further parsing is needed.
  return { path: str, operator: null, value: null };
}

function findFirstTopLevelAndOr(expr) {
  let depth = 0;
  const upper = expr.toUpperCase();
  for (let i = 0; i < expr.length - 2; i++) {
    if (expr[i] === "(") depth++;
    else if (expr[i] === ")") depth--;
    if (depth === 0) {
      const maybe = upper.substr(i, 3);
      if (maybe === "AND" || maybe === "OR ") {
        return i;
      }
    }
  }
  return -1;
}

function isBalanced(s) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}