// @lib/tranlator/4-hybrid-nodes.js

// Assume your AQL-to-AST parser is imported:
import { parseAql } from "../parser/parseAqlAST.js";

/* ================== PARSING & HELPER FUNCTIONS ================== */

/**
 * Update the "from" portion of the AST.
 * If from.archetype_node_id contains an ehr_id condition (e.g. "ehr_id/value=$ehr_id"),
 * mark the query as ehr_id-based and extract the parameter.
 */
function updateFromInfo(from) {
  if (from && from.archetype_node_id && from.archetype_node_id.indexOf("ehr_id/value") >= 0) {
    from.isEhrIdBased = true;
    // Extract the value after '=' if present.
    const parts = from.archetype_node_id.split("=");
    from.ehrId = parts.length === 2 ? parts[1].trim() : from.archetype_node_id;
  } else {
    from.isEhrIdBased = false;
  }
  return from;
}

/**
 * Convert the AST "contains" section into an object with an array of archetypes
 * and a mapping from alias to archetype.
 * (Assumes that your AST provides a "contains" property as an object or array.)
 */
function buildContainsInfo(containsAst) {
  let containsInfo = { archetypes: [], aliases: {} };
  if (!containsAst) return containsInfo;

  let items = Array.isArray(containsAst) ? containsAst : Object.values(containsAst);
  items.forEach(item => {
    containsInfo.archetypes.push(item);
    if (item.alias) {
      containsInfo.aliases[item.alias] = item;
    }
  });
  return containsInfo;
}

/**
 * Build additional stages for ORDER BY, LIMIT and OFFSET.
 */
function buildOptionsStages(ast) {
  let stages = [];
  if (ast.orderBy) {
    let sortStage = {};
    let orderItems = Array.isArray(ast.orderBy)
      ? Object.values(ast.orderBy)
      : [ast.orderBy];
    orderItems.forEach(item => {
      // Remove any brackets and convert slashes to dots.
      let mongoPath = item.path.replace(/\[.*?\]/g, '').replace(/\//g, '.');
      sortStage[mongoPath] =
        item.direction && item.direction.toUpperCase() === 'DESC' ? -1 : 1;
    });
    stages.push({ $sort: sortStage });
  }
  if (ast.limit) {
    stages.push({ $limit: parseInt(ast.limit, 10) });
  }
  if (ast.offset) {
    stages.push({ $skip: parseInt(ast.offset, 10) });
  }
  return stages;
}

/* ================== STAGE BUILDERS ================== */

/**
 * Build a $match stage for ehr_id–based queries.
 * It adds an equality on ehr_id from the FROM clause and builds an array of
 * $elemMatch filters for the nodes array based on the CONTAINS information
 * and any additional WHERE conditions.
 */
function buildMatchStage(fromInfo, containsInfo, whereAst) {
  let matchStage = { $match: {} };

  // Add ehr_id condition if flagged.
  if (fromInfo.isEhrIdBased && fromInfo.ehrId) {
    matchStage.$match.ehr_id = fromInfo.ehrId;
  }

  // Build an array of $elemMatch conditions.
  let elemMatchConditions = [];

  // From the CONTAINS clause.
  containsInfo.archetypes.forEach(archetype => {
    if (archetype.rmType && archetype.archetype_node_id) {
      elemMatchConditions.push({
        $elemMatch: {
          "data._type": archetype.rmType,
          "data.archetype_details.archetype_id.value": archetype.archetype_node_id
        }
      });
    }
  });

  // For any WHERE conditions (this simple example does not process them deeply).
  // (You can extend this to handle conditions on value, time, etc.)
  // For now, if whereAst is nonempty and not an object, you might add custom logic.

  if (elemMatchConditions.length > 0) {
    matchStage.$match.nodes = { $all: elemMatchConditions };
  }
  return matchStage;
}

/**
 * Build a $search stage for population-based queries using Atlas Search.
 * This uses the strategyConfig.atlasSearch settings and builds embeddedDocument conditions.
 */
function buildSearchStage(containsInfo, whereAst, strategyConfig) {
  if (
    !strategyConfig.atlasSearch ||
    !strategyConfig.atlasSearch.index_name ||
    strategyConfig.atlasSearch.enabled !== true
  ) {
    console.log("Atlas Search is not enabled or configured properly.");
    return null;
  }

  let searchStage = {
    $search: {
      index: strategyConfig.atlasSearch.index_name,
      compound: { must: [] }
    }
  };

  // Optionally add an ehr_id condition if provided in strategyConfig.
  if (strategyConfig.ehrId) {
    searchStage.$search.compound.must.push({
      equals: { path: "ehr_id", value: strategyConfig.ehrId }
    });
  }

  // Add each CONTAINS archetype as an embeddedDocument condition.
  containsInfo.archetypes.forEach(archetype => {
    if (archetype.rmType && archetype.archetype_node_id) {
      searchStage.$search.compound.must.push({
        embeddedDocument: {
          path: "nodes",
          operator: {
            compound: {
              must: [
                { equals: { path: "nodes.data._type", value: archetype.rmType } },
                {
                  equals: {
                    path: "nodes.data.archetype_details.archetype_id.value",
                    value: archetype.archetype_node_id
                  }
                }
              ]
            }
          }
        }
      });
    }
  });

  // Further WHERE conditions could be added here.

  return searchStage;
}

/**
 * Build an $addFields stage to extract each alias from the nodes array.
 * It uses the CONTAINS clause information for top-level aliases.
 * For select aliases not defined in CONTAINS, we use a predefined mapping.
 */
function buildAddFieldsStage(ast, containsInfo, nodeField = "nodes") {
  let addFields = {};

  // First, add each alias from the CONTAINS clause.
  if (containsInfo.aliases) {
    for (let alias in containsInfo.aliases) {
      let item = containsInfo.aliases[alias];
      addFields[alias] = {
        $let: {
          vars: {
            extracted: {
              $first: {
                $filter: {
                  input: `$${nodeField}`,
                  as: "node",
                  cond: {
                    $and: [
                      { $eq: ["$$node.data._type", item.rmType] },
                      {
                        $eq: [
                          "$$node.data.archetype_details.archetype_id.value",
                          item.archetype_node_id
                        ]
                      }
                    ]
                  }
                }
              }
            }
          },
          in: "$$extracted"
        }
      };
    }
  }

  // Predefined mappings for aliases that might appear in SELECT but are not in CONTAINS.
  const predefinedAliases = {
    med_ac: {
      rmType: "ACTION",
      archetypeId: "openEHR-EHR-ACTION.medication.v1"
    },
    admin_salut: {
      rmType: "CLUSTER",
      archetypeId: "openEHR-EHR-CLUSTER.admin_salut.v0"
    }
    // Add more mappings as needed.
  };

  // Check the SELECT clause: if an alias is used that we haven't added, add it.
  const selectAliases = Object.values(ast.select).map(item => item.alias);
  selectAliases.forEach(alias => {
    if (!addFields[alias] && predefinedAliases[alias]) {
      let def = predefinedAliases[alias];
      addFields[alias] = {
        $let: {
          vars: {
            extracted: {
              $first: {
                $filter: {
                  input: `$${nodeField}`,
                  as: "node",
                  cond: {
                    $and: [
                      { $eq: ["$$node.data._type", def.rmType] },
                      {
                        $eq: [
                          "$$node.data.archetype_details.archetype_id.value",
                          def.archetypeId
                        ]
                      }
                    ]
                  }
                }
              }
            }
          },
          in: "$$extracted"
        }
      };
    }
  });

  return addFields;
}

/**
 * Build a $project stage based on the SELECT clause.
 * This implementation assumes each select item has a "value" with a dataMatchPath,
 * and that the first component of the path is the alias (which we extracted earlier).
 */
function buildProjectStage(ast) {
  let projectStage = {};
  if (!ast.select) return projectStage;

  Object.values(ast.select).forEach(item => {
    if (item.value && item.value.type === "dataMatchPath" && item.alias) {
      // Split the AQL path at the first "/"
      let parts = item.value.path.split("/");
      if (parts.length > 1) {
        let alias = parts[0];
        let fieldPath = parts.slice(1).join(".");
        // Prepend "data." if the field path does not already start with it.
        if (!fieldPath.startsWith("data.")) {
          fieldPath = "data." + fieldPath;
        }
        projectStage[item.alias] = "$" + alias + "." + fieldPath;
      } else {
        projectStage[item.alias] = "$" + item.value.path;
      }
    }
  });
  return projectStage;
}

/* ================== MAIN TRANSLATION FUNCTION ================== */

/**
 * Main function that converts an AQL query (using your AST parser) into
 * a MongoDB aggregation pipeline.
 *
 * This function:
 * 1. Parses the AQL into an AST.
 * 2. Updates the FROM clause to detect ehr_id-based queries.
 * 3. Builds the CONTAINS info.
 * 4. Depending on the query type and strategy configuration, builds either a $match or $search stage.
 * 5. Adds an $addFields stage to extract nodes for each alias.
 * 6. Constructs a $project stage based on the SELECT clause.
 * 7. Appends additional stages (orderBy, limit, offset).
 *
 * @param {string} aqlQuery - The input AQL query.
 * @param {object} strategyConfig - Configuration (e.g., atlasSearch: { enabled: true, index_name: "default" })
 * @returns {Array} - The full MongoDB aggregation pipeline.
 */
 export function translateAqlToMql(aqlQuery, strategyConfig = {}) {
    console.log("translateAqlToMql: Received AQL query", aqlQuery);
    const ast = parseAql(aqlQuery);
    console.log("translateAqlToMql: AST:", ast);
    
    let fromInfo = updateFromInfo(ast.from);
    console.log("translateAqlToMql: fromInfo:", fromInfo);
  
    let containsInfo = buildContainsInfo(ast.contains);
    console.log("translateAqlToMql: containsInfo:", containsInfo);
  
    let pipeline = [];
    if (fromInfo.isEhrIdBased || !strategyConfig.atlasSearch || strategyConfig.atlasSearch.enabled !== true) {
      pipeline.push(buildMatchStage(fromInfo, containsInfo, ast.where));
      console.log("translateAqlToMql: Using $match stage");
    } else {
      const searchStage = buildSearchStage(containsInfo, ast.where, strategyConfig);
      if (searchStage) {
        pipeline.push(searchStage);
        console.log("translateAqlToMql: Using $search stage");
      } else {
        pipeline.push(buildMatchStage(fromInfo, containsInfo, ast.where));
        console.log("translateAqlToMql: Fallback to $match stage");
      }
    }
  
    const addFieldsStage = buildAddFieldsStage(ast, containsInfo, "nodes");
    if (Object.keys(addFieldsStage).length > 0) {
      pipeline.push({ $addFields: addFieldsStage });
      console.log("translateAqlToMql: Added $addFields stage:", addFieldsStage);
    }
  
    const projectStage = buildProjectStage(ast);
    if (Object.keys(projectStage).length > 0) {
      pipeline.push({ $project: projectStage });
      console.log("translateAqlToMql: Added $project stage:", projectStage);
    }
  
    const optionsStages = buildOptionsStages(ast);
    pipeline = pipeline.concat(optionsStages);
    console.log("translateAqlToMql: Final pipeline:", pipeline);
    
    return pipeline;
  }

/* ================== EXPORTS ================== */
export default { translateAqlToMql };