// --- Configuration variables ---
const compositionObject = "CanonicalJSON"; // later configurable
const indexName = "default";

// --- Dictionary: Only these segments keep their predicate.
const archetypeKeywords = { content: true, items: true };

// --- Helper: Remove surrounding quotes from literal values.
function cleanLiteral(literal) {
  return literal.replace(/^'|'$/g, "");
}

// --- Helper: Parse a segment into { name, predicate }.
// For example, "content[openEHR-EHR-SECTION.immunisation_list.v0]"
// becomes { name: "content", predicate: "openEHR-EHR-SECTION.immunisation_list.v0" }.
// For non-keyword segments (e.g. "description"), the predicate is discarded.
function parseSegment(seg) {
  const m = seg.match(/^([^[]+)(\[(.+?)\])?$/);
  return { 
    name: m[1], 
    predicate: archetypeKeywords[m[1]] ? (m[3] || null) : null 
  };
}

// --- Recursive function: Build an MQL clause from a list of segments.
// "segments" is an array of strings (each segment, e.g. "content[...]", "items[...]", "time").
// "operator" and "value" belong to the leaf condition.
// "base" is the current path (initially compositionObject).
function buildClauseFromSegments(segments, operator, value, base) {
  if (segments.length === 0) return null;
  const { name, predicate } = parseSegment(segments[0]);
  const newBase = base + "." + name; // Extend the base.
  
  if (segments.length === 1) {
    // Leaf field.
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
    // Not a leaf.
    if (archetypeKeywords[name]) {
      // This segment is handled as an embeddedDocument clause.
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
      // Non-keyword: simply extend the base and continue.
      return buildClauseFromSegments(segments.slice(1), operator, value, newBase);
    }
  }
}

// --- Main helper: Convert an AQL path into an MQL clause.
// For example, given:
//   "c/content[openEHR-EHR-SECTION.immunisation_list.v0]/items[openEHR-EHR-ACTION.medication.v1]/time"
// we first remove the leading "c/" and split into segments.
// Also, if duplicate keywords appear at the beginning (e.g. "content" twice),
// we remove the duplicate.
function pathToMQLClause(aqlPath, operator, value) {
  // Remove leading "c/".
  const raw = aqlPath.slice(2);
  let segments = raw.split("/");
  // If the first two segments are duplicates (e.g. both "content"), remove the duplicate.
  if (segments.length > 1) {
    const first = parseSegment(segments[0]);
    const second = parseSegment(segments[1]);
    if (first.name === second.name && archetypeKeywords[first.name]) {
      // Remove the second occurrence.
      segments.splice(1, 1);
    }
  }
  return buildClauseFromSegments(segments, operator, value, compositionObject);
}

// --- Helper: Recursively flatten nested where conditions into an array of leaves.
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

// --- Build the final $search where clause from the AST.
// For each leaf condition, we convert its AQL path to an MQL clause using the above mechanics.
function buildWhereClause(ast) {
  const flatConds = flattenConditionsRec(ast.where);
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

// --- Final export: translateSingleSearch builds the complete aggregation pipeline.
export const translateSingleSearch = (ast) => {
  const pipeline = [];
  // 1. Where clause stage.
  pipeline.push(buildWhereClause(ast));
  
  // 2. Projection stage.
  const projectStage = {};
  Object.values(ast.select).forEach(sel => {
    if (sel && sel.value && sel.value.path) {
      const alias = sel.alias || sel.value.path.replace(/\//g, "_");
      if (sel.value.path.startsWith("e/")) {
        const field = "canonicalJSON." + sel.value.path.slice(2).split("/").join(".");
        projectStage[alias] = "$" + field;
      } else if (sel.value.path.startsWith("c/")) {
        const remainder = sel.value.path.slice(2).split("/").join(".");
        projectStage[alias] = {
          $let: {
            vars: {
              comp: {
                $first: {
                  $filter: {
                    input: "$" + compositionObject + ".content",
                    as: "comp",
                    cond: { $eq: [ "$$comp.archetype_node_id", ast.from?.archetype_node_id || "" ] }
                  }
                }
              }
            },
            in: "$$comp." + remainder
          }
        };
      } else {
        projectStage[alias] = "$" + sel.value.path.split("/").join(".");
      }
    }
  });
  pipeline.push({ $project: projectStage });
  
  // 3. Sort stage.
  if (ast.orderBy && Object.keys(ast.orderBy).length > 0) {
    const sortStage = {};
    Object.values(ast.orderBy).forEach(order => {
      if (order && typeof order.path === "string") {
        let field;
        if (order.path.startsWith("e/")) {
          field = "canonicalJSON." + order.path.slice(2).split("/").join(".");
        } else if (order.path.startsWith("c/")) {
          field = "canonicalJSON.content." + order.path.slice(2).split("/").join(".");
        } else {
          field = order.path.split("/").join(".");
        }
        sortStage[field] = order.direction === "DESC" ? -1 : 1;
      }
    });
    pipeline.push({ $sort: sortStage });
  }
  
  // 4. Limit and Skip.
  if (ast.limit != null) pipeline.push({ $limit: ast.limit });
  if (ast.offset != null && ast.offset > 0) pipeline.push({ $skip: ast.offset });
  
  return pipeline;
};

export default translateSingleSearch;