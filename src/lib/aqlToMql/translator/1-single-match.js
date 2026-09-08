// lib/aqlToMql/translator/1-single-match.js

import { dataModels } from "../schema/dataModels.js";

export const translateSingle = (ast) => {
  const pipeline = [];
  
  // Get the schema for the "single" strategy.
  const schema = dataModels.single;
  
  // For composition-level fields, we need to extract from the content array.
  // We assume that in the canonical AST the contained composition is referenced
  // by alias "c". (Our canonical AST should have something like:)
  // "contains": [
  //   { rmType: "COMPOSITION", alias: "c", archetype_node_id: "openEHR-EHR-COMPOSITION.probs_base_composition.v0" },
  //   { rmType: "CLUSTER", alias: "t", archetype_node_id: "openEHR-EHR-CLUSTER.test_request_screen.v0" }
  // ]
  let compMapping;
  if (ast.contains) {
    if (Array.isArray(ast.contains)) {
      compMapping = ast.contains.find(item => item.alias === "c");
    } else {
      compMapping = Object.values(ast.contains).find(item => item.alias === "c");
    }
  }
  const compArchetype = compMapping ? compMapping.archetype_node_id : "";
  
  // --- $match Stage ---
  // We process the WHERE conditions from the canonical AST.
  const matchConditions = [];
  if (ast.where && ast.where.conditions) {
    Object.values(ast.where.conditions).forEach((condition) => {
      if (condition && typeof condition.path === "string") {
        // Case 1: EHR-level condition.
        if (condition.path.startsWith("e/")) {
          // Remove "e/" and convert "/" to "."
          const field = "canonicalJSON." + condition.path.slice(2).split("/").join(".");
          const cond = {};
          cond[field] = condition.value;
          matchConditions.push(cond);
        }
        // Case 2: Composition-level condition.
        else if (condition.path.startsWith("c/")) {
          const remainder = condition.path.slice(2).split("/").join(".");
          const exprCond = {
            $expr: {
              $eq: [
                {
                  $let: {
                    vars: {
                      comp: {
                        $first: {
                          $filter: {
                            input: "$canonicalJSON.content",
                            as: "comp",
                            cond: { $eq: [ "$$comp.archetype_node_id", compArchetype ] }
                          }
                        }
                      }
                    },
                    in: "$$comp." + remainder
                  }
                },
                condition.value
              ]
            }
          };
          matchConditions.push(exprCond);
        }
        // Case 3: Function call in condition (e.g. LENGTH(...))
        else if (condition.path.startsWith("LENGTH(")) {
          // Extract the inner path. For example, "LENGTH(c/uid/value)" => "c/uid/value"
          const inner = condition.path.substring("LENGTH(".length, condition.path.length - 1);
          // Map the comparison operator.
          let op;
          switch (condition.operator) {
            case "=":
              op = "$eq";
              break;
            case "!=":
              op = "$ne";
              break;
            case ">":
              op = "$gt";
              break;
            case "<":
              op = "$lt";
              break;
            case ">=":
              op = "$gte";
              break;
            case "<=":
              op = "$lte";
              break;
            default:
              op = "$eq";
          }
          // Transform the inner path into a MongoDB field expression.
          let fieldExpr;
          if (inner.startsWith("c/")) {
            const remainder = inner.slice(2).split("/").join(".");
            fieldExpr = {
              $let: {
                vars: {
                  comp: {
                    $first: {
                      $filter: {
                        input: "$canonicalJSON.content",
                        as: "comp",
                        cond: { $eq: [ "$$comp.archetype_node_id", compArchetype ] }
                      }
                    }
                  }
                },
                in: "$$comp." + remainder
              }
            };
          } else if (inner.startsWith("e/")) {
            fieldExpr = "$canonicalJSON." + inner.slice(2).split("/").join(".");
          } else {
            fieldExpr = "$" + inner.split("/").join(".");
          }
          // Build the $expr condition using $strLenCP.
          const exprCond = {
            $expr: {
              [op]: [
                { $strLenCP: fieldExpr },
                Number(condition.value.value)
              ]
            }
          };
          matchConditions.push(exprCond);
        }
      }
    });
  }
  if (matchConditions.length > 0) {
    pipeline.push({ $match: { $and: matchConditions } });
  }
  
  // --- $project Stage ---
  // For each SELECT field, convert the AQL path to the proper field using $let/$first/$filter for composition-level fields.
  // --- $project Stage ---
const projectStage = {};
Object.values(ast.select).forEach((sel) => {
  if (sel && sel.value && sel.value.path) {
    const alias = sel.alias || sel.value.path.replace(/\//g, "_");
    // If the field is from EHR (starts with "e/"), process normally:
    if (sel.value.path.startsWith("e/")) {
      const field = "canonicalJSON." + sel.value.path.slice(2).split("/").join(".");
      projectStage[alias] = "$" + field;
    }
    // If it's a composition-level field:
    else if (sel.value.path.startsWith("c/")) {
      const remainder = sel.value.path.slice(2).split("/").join(".");
      projectStage[alias] = {
        $let: {
          vars: {
            comp: {
              $first: {
                $filter: {
                  input: "$canonicalJSON.content",
                  as: "comp",
                  cond: { $eq: [ "$$comp.archetype_node_id", compArchetype ] }
                }
              }
            }
          },
          in: "$$comp." + remainder
        }
      };
    }
    // If it is a function call (for example, ABS or SUBSTRING):
    else if (sel.value.type === "functionCall" || sel.value.type === "aggregateFunctionCall") {
      const func = sel.value.function;
      // Example handling for built-in functions:
      if (func && func.type === "builtInFunction") {
        switch (func.name) {
          case "ABS":
            if (func.args && func.args[0] && func.args[0].type === "dataMatchPath") {
              const field = "canonicalJSON." + func.args[0].value.slice(2).split("/").join(".");
              projectStage[alias] = { $abs: "$" + field };
            } else {
              // Fallback: pass raw value.
              projectStage[alias] = "$" + sel.value.path.split("/").join(".");
            }
            break;
          case "SUBSTRING":
            if (
              func.args &&
              func.args.length >= 3 &&
              func.args[0].type === "dataMatchPath"
            ) {
              const field = "canonicalJSON." + func.args[0].value.slice(2).split("/").join(".");
              projectStage[alias] = {
                $substrBytes: [
                  "$" + field,
                  Number(func.args[1].value),
                  Number(func.args[2].value)
                ]
              };
            } else {
              projectStage[alias] = "$" + sel.value.path.split("/").join(".");
            }
            break;
          case "CONCAT":
            // Example: translate CONCAT into {$concat: [ ... ]}
            if (func.args && func.args.length > 0) {
              const concatArgs = func.args.map(arg => {
                if (arg.type === "dataMatchPath") {
                  if (arg.value.startsWith("e/")) {
                    return "$" + "canonicalJSON." + arg.value.slice(2).split("/").join(".");
                  } else if (arg.value.startsWith("c/")) {
                    // For composition-level fields, you might want to apply a similar $let/$first/$filter pattern.
                    const rem = arg.value.slice(2).split("/").join(".");
                    return { $let: {
                      vars: {
                        comp: {
                          $first: {
                            $filter: {
                              input: "$canonicalJSON.content",
                              as: "comp",
                              cond: { $eq: [ "$$comp.archetype_node_id", compArchetype ] }
                            }
                          }
                        }
                      },
                      in: "$$comp." + rem
                    }};
                  }
                }
                // If literal:
                return arg.value || arg;
              });
              projectStage[alias] = { $concat: concatArgs };
            }
            break;
          default:
            // For unsupported function names, fall back to the raw text.
            projectStage[alias] = "$" + sel.value.path.split("/").join(".");
        }
      } else {
        // For any other case (or if the function type is unknown), fall back to the raw text.
        projectStage[alias] = "$" + sel.value.path.split("/").join(".");
      }
    }
    // Otherwise, fall back to a generic conversion:
    else {
      projectStage[alias] = "$" + sel.value.path.split("/").join(".");
    }
  }
});
pipeline.push({ $project: projectStage });
  
  // --- $sort Stage ---
  // For each ORDER BY field, convert the path similarly.
  if (ast.orderBy && Object.keys(ast.orderBy).length > 0) {
    const sortStage = {};
    Object.values(ast.orderBy).forEach((order) => {
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
  
  // --- Limit and Skip (Offset) ---
  if (ast.limit != null) pipeline.push({ $limit: ast.limit });
  if (ast.offset != null && ast.offset > 0) pipeline.push({ $skip: ast.offset });
  
  return pipeline;
};