// lib/aqlToMql/translator/4-hybrid-nodes.js
import { parseFromClause } from './hybrid-nodes/from-parser';
import { parseContainsClauses } from './hybrid-nodes/contains-parser';
import { parseWhereConditions } from './hybrid-nodes/where-parser';
import { buildMatchStage, buildNestedMatchConditions } from './hybrid-nodes/match-builder';
import { buildSearchStage } from './hybrid-nodes/search-builder';
import { buildAddFieldsStage } from './hybrid-nodes/addfields-builder';
import { buildProjectStage } from './hybrid-nodes/project-builder';
import { buildOptionsStages } from './hybrid-nodes/options-builder';

/**
 * Hybrid-Nodes Strategy for AQL to MQL Translation.
 */
export const translateHybridNodes = (ast, strategyConfig = {}) => {
  if (!ast) {
    throw new Error("[Hybrid-Nodes] Invalid AST: No AST data provided");
  }
  
  console.log("[Hybrid-Nodes] Starting translation with config:", strategyConfig);
  
  const fromInfo = parseFromClause(ast);
  const containsInfo = parseContainsClauses(ast);
  const whereInfo = parseWhereConditions(ast, containsInfo);
  console.log("[Hybrid-Nodes] Parsed WHERE conditions (raw):", JSON.stringify(whereInfo, null, 2));
  
  const pipeline = [];

  // Get field names from adapted config (or use defaults for backward compatibility)
  const nodeField = strategyConfig?.fields?.compositionNodes || "comp_nodes";
  const ehrIdField = strategyConfig?.fields?.compositionEhrId || "ehr_id";

  console.log(`[Hybrid-Nodes] Using field mappings - nodes: ${nodeField}, ehrId: ${ehrIdField}`);

  if (fromInfo.isEhrIdBased || !isAtlasSearchEnabled(strategyConfig)) {
    console.log(`[Hybrid-Nodes] Using $match with ${nodeField} for filtering`);
    const nestedConditionsTransformed = buildNestedMatchConditions(whereInfo, containsInfo, nodeField);
    const matchStage = buildMatchStage(fromInfo, containsInfo, nestedConditionsTransformed, nodeField, ehrIdField);
    if (matchStage && Object.keys(matchStage.$match || {}).length > 0) {
      console.log("[Hybrid-Nodes] $match stage created:", JSON.stringify(matchStage, null, 2));
      pipeline.push(matchStage);
    } else {
      console.warn("[Hybrid-Nodes] $match stage was empty. Check WHERE clause processing.");
    }
  } else {
    console.log("[Hybrid-Nodes] Using Atlas $search with search_nodes for filtering");
    const searchStage = buildSearchStage(containsInfo, whereInfo, strategyConfig);
    if (searchStage) {
      console.log("[Hybrid-Nodes] $search stage created:", JSON.stringify(searchStage, null, 2));
      pipeline.push(searchStage);
      const postSearchMatchStage = buildPostSearchMatchStage(whereInfo);
      if (postSearchMatchStage && Object.keys(postSearchMatchStage).length > 0) {
        console.log("[Hybrid-Nodes] Post-search $match stage added:", JSON.stringify(postSearchMatchStage, null, 2));
        pipeline.push(postSearchMatchStage);
      } else {
        console.log("[Hybrid-Nodes] No additional post-search conditions found.");
      }
    } else {
      console.warn("[Hybrid-Nodes] Could not build $search stage, falling back to $match");
      const matchStage = buildMatchStage(fromInfo, containsInfo, whereInfo, nodeField, ehrIdField);
      if (matchStage && Object.keys(matchStage.$match || {}).length > 0) {
        console.log("[Hybrid-Nodes] Fallback $match stage created:", JSON.stringify(matchStage, null, 2));
        pipeline.push(matchStage);
      } else {
        console.warn("[Hybrid-Nodes] Fallback $match stage was empty. Check WHERE clause processing.");
      }
    }
  }

  console.log(`[Hybrid-Nodes] Using ${nodeField} for entity extraction`);
  const addFieldsStage = buildAddFieldsStage(ast, containsInfo, nodeField);
  if (addFieldsStage && Object.keys(addFieldsStage).length > 0) {
    pipeline.push({ $addFields: addFieldsStage });
  } else {
    console.warn("[Hybrid-Nodes] $addFields stage is empty.");
  }
  
  const projectStage = buildProjectStage(ast, containsInfo);
  if (projectStage && Object.keys(projectStage).length > 0) {
    pipeline.push({ $project: projectStage });
  } else {
    console.warn("[Hybrid-Nodes] $project stage is empty.");
  }
  
  const optionsStages = buildOptionsStages(ast);
  if (optionsStages && optionsStages.length > 0) {
    pipeline.push(...optionsStages);
  }
  
  console.log("[Hybrid-Nodes] Translation complete, pipeline stages count:", pipeline.length);
  return pipeline;
};

function buildPostSearchMatchStage(whereInfo) {
  if (!whereInfo.unhandledConditions || whereInfo.unhandledConditions.length === 0) {
    console.log("[Hybrid-Nodes] No unhandled WHERE conditions for post-search $match");
    return null;
  }
  
  const matchStage = { $match: {} };
  if (whereInfo.unhandledConditions.length === 1) {
    Object.assign(matchStage.$match, whereInfo.unhandledConditions[0]);
  } else {
    matchStage.$match.$and = whereInfo.unhandledConditions;
  }
  return matchStage;
}

function isAtlasSearchEnabled(strategyConfig) {
  // Support both old schema (atlasSearch.index_name) and new adapted schema (atlasSearch.enabled, atlasSearch.index_name)
  if (!strategyConfig) return false;

  // New adapted schema from Strategy Studio
  if (strategyConfig.atlasSearch) {
    if (strategyConfig.atlasSearch.enabled === false) return false;
    if (strategyConfig.atlasSearch.index_name && strategyConfig.atlasSearch.index_name.trim() !== '') {
      return true;
    }
  }

  // Legacy schema fallback
  return false;
}

export default translateHybridNodes;