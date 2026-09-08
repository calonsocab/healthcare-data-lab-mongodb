// --- Configuration variables ---
const compositionObject = "CanonicalJSON"; // configurable root object
const indexName = "default";               // configurable index

// --- Dictionary: Only these segments preserve their predicate.
const archetypeKeywords = { content: true, items: true };

// --- Helper: Remove surrounding quotes.
function cleanLiteral(literal) {
  return literal.replace(/^'|'$/g, "");
}

// --- Helper: Parse a segment into { name, predicate }.
function parseSegment(seg) {
  const m = seg.match(/^([^[]+)(\[(.+?)\])?$/);
  return {
    name: m[1],
    predicate: archetypeKeywords[m[1]] ? (m[3] || null) : null
  };
}

// --- WHERE Clause Processing ---
// Build a clause tree from an AQL path.
// Input: an array of segments (strings), operator, value, and a base path.
// The function recursively processes segments.
// For segments in archetypeKeywords with a predicate, it generates an embeddedDocument block.
function buildClauseFromSegments(segments, operator, value, base) {
  if (segments.length === 0) return null;
  const { name, predicate } = parseSegment(segments[0]);
  const newBase = base + "." + name;
  if (segments.length === 1) {
    // Leaf: generate equals or range.
    if (operator === "=") {
      return { equals: { path: newBase, value: cleanLiteral(value) } };
    } else if (["<", ">", "<=", ">="].includes(operator)) {
      const opMap = { ">=": "gte", "<=": "lte", ">": "gt", "<": "lt" };
      return {
        range: {
          path: newBase,
          [opMap[operator]]: `ISODate("${cleanLiteral(value)}T00:00:00.000Z")`
        }
      };
    }
    return { equals: { path: newBase, value: cleanLiteral(value) } };
  } else {
    // Non-leaf.
    if (archetypeKeywords[name]) {
      let must = [];
      if (predicate) {
        must.push({
          equals: {
            path: newBase + ".archetype_node_id",
            value: predicate
          }
        });
      }
      const subClause = buildClauseFromSegments(segments.slice(1), operator, value, newBase);
      if (subClause) must.push(subClause);
      return {
        embeddedDocument: {
          path: newBase,
          operator: { compound: { must } }
        }
      };
    } else {
      // Not a keyword: just extend the path.
      return buildClauseFromSegments(segments.slice(1), operator, value, newBase);
    }
  }
}

// Convert an AQL path into an MQL clause for WHERE.
// Remove the leading "c/" then adjust the base:
//  - If path starts with "content", remove that segment and use compositionObject + ".content".
//  - If path starts with "context", remove the first two segments and use compositionObject + ".context.other_context".
//  - Otherwise, use compositionObject.
function pathToMQLClause(aqlPath, operator, value) {
  // Remove the leading "c/".
  const raw = aqlPath.slice(2);
  let segments = raw.split("/");
  let base;
  if (segments[0].startsWith("content")) {
    base = compositionObject + ".content";
    segments = segments.slice(1);
  } else if (segments[0].startsWith("context")) {
    base = compositionObject + ".context.other_context";
    segments = segments.slice(2); // remove "context" and the following segment (e.g., other_context[...])
  } else {
    base = compositionObject;
  }
  return buildClauseFromSegments(segments, operator, value, base);
}

// Flatten nested WHERE conditions (assumed in ast.where) into an array.
function flattenConditionsRec(obj) {
  if (obj.path) return [obj];
  let arr = [];
  if (obj.conditions) {
    Object.values(obj.conditions).forEach(sub => {
      arr = arr.concat(flattenConditionsRec(sub));
    });
  }
  return arr;
}

// Build the final $search stage.
function buildWhereClause(ast) {
  const flatConds = flattenConditionsRec(ast.where);
  // For each leaf condition, convert its AQL path.
  const clauses = flatConds.map(cond =>
    pathToMQLClause(cond.path, cond.operator, cond.value.value || cond.value)
  );
  return {
    $search: {
      index: indexName,
      compound: { must: clauses }
    }
  };
}

// --- Projection (SELECT) Processing ---
// Build a nested projection expression from an AQL select path.
// For each segment that is in archetypeKeywords and has a predicate,
// wrap the current expression in a $let that uses $first on a $filter.
// Otherwise, simply navigate using dot notation.
function buildProjectionExpression(aqlPath) {
  // Remove the leading "c/".
  const raw = aqlPath.slice(2);
  let segments = raw.split("/");
  let base;
  if (segments[0].startsWith("content")) {
    base = compositionObject + ".content";
    segments = segments.slice(1);
  } else if (segments[0].startsWith("context")) {
    base = compositionObject + ".context.other_context";
    segments = segments.slice(2);
  } else {
    base = compositionObject;
  }
  // Start with the base expression.
  let expr = "$" + base;
  segments.forEach(seg => {
    const { name, predicate } = parseSegment(seg);
    if (archetypeKeywords[name] && predicate) {
      // Wrap the current expression with a $let using $first and $filter.
      expr = {
        $let: {
          vars: {
            current: {
              $first: {
                $filter: {
                  input: expr + "." + name,
                  as: name,
                  cond: { $eq: [ "$$" + name + ".archetype_node_id", predicate ] }
                }
              }
            }
          },
          in: "$$current"
        }
      };
    } else {
      // Append this segment.
      if (typeof expr === "string") {
        expr = expr + "." + name;
      } else {
        expr = {
          $let: {
            vars: { prev: expr },
            in: "$$prev." + name
          }
        };
      }
    }
  });
  return expr;
}

// Build the $project stage from the AST’s SELECT clause.
function buildProjectStage(ast) {
  const projectStage = {};
  Object.values(ast.select).forEach(sel => {
    if (sel && sel.value && sel.value.path) {
      const alias = sel.alias || sel.value.path.replace(/\//g, "_");
      if (sel.value.path.startsWith("e/")) {
        const field = "canonicalJSON." + sel.value.path.slice(2).split("/").join(".");
        projectStage[alias] = "$" + field;
      } else if (sel.value.path.startsWith("c/")) {
        projectStage[alias] = buildProjectionExpression(sel.value.path);
      } else {
        projectStage[alias] = "$" + sel.value.path.split("/").join(".");
      }
    }
  });
  return { $project: projectStage };
}

// --- Other Pipeline Stages: SORT, LIMIT, OFFSET ---
function buildSortStage(ast) {
  const sortStage = {};
  if (ast.orderBy && Object.keys(ast.orderBy).length > 0) {
    Object.values(ast.orderBy).forEach(order => {
      if (order && typeof order.path === "string") {
        // Remove leading alias and convert to dot notation.
        const raw = order.path.slice(2).split("/").join(".");
        // For simplicity, assume fields for sort come from content.
        const field = order.path.startsWith("e/") 
          ? "canonicalJSON." + raw 
          : "canonicalJSON.content." + raw;
        sortStage[field] = order.direction === "DESC" ? -1 : 1;
      }
    });
  }
  return { $sort: sortStage };
}

function buildLimitSkipStages(ast) {
  const stages = [];
  if (ast.limit != null) stages.push({ $limit: ast.limit });
  if (ast.offset != null && ast.offset > 0) stages.push({ $skip: ast.offset });
  return stages;
}

// --- Main Function: translateSingleSearch ---
// This function translates every stage of the AQL query (FROM, CONTAINS, WHERE, SORT, LIMIT, OFFSET, SELECT)
// into a complete MongoDB aggregation pipeline.
export const translateSingleSearch = (ast) => {
  const pipeline = [];
  // 1. WHERE ($search) stage.
  pipeline.push(buildWhereClause(ast));
  // 2. SELECT ($project) stage.
  pipeline.push(buildProjectStage(ast));
  // 3. SORT stage.
  //pipeline.push(buildSortStage(ast));
  // 4. LIMIT and SKIP stages.
  pipeline.push(...buildLimitSkipStages(ast));
  return pipeline;
};

export default translateSingleSearch;