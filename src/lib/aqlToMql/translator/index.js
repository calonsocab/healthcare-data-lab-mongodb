// lib/aqlToMql/translator/index.js
import { translateSingle } from "./1-single-match.js";
import { translateSingleSearch } from "./2-single-search.js";
import { translateSemiFlattened } from "./3-semiflattened.js";
import { translateHybridNodes } from "./4-hybrid-nodes.js";

/**
 * Main function to translate an AQL AST to an MQL pipeline.
 */
export function translateASTToMQL(ast, modelKey = "4-hybrid-nodes", strategyConfig = {}) {
  if (!ast) {
    throw new Error("Invalid AST: No data provided");
  }
  
  console.log("translateASTToMQL: Selected modelKey:", modelKey);
  console.log("translateASTToMQL: Strategy configuration:", strategyConfig);
  
  switch (modelKey) {
    case "4-hybrid-nodes":
      console.log("translateASTToMQL: Using Hybrid-Nodes strategy");
      return translateHybridNodes(ast, strategyConfig);
    case "3-distributed":
      console.log("translateASTToMQL: Distributed collections strategy selected (not implemented)");
      throw new Error("Distributed collections strategy not implemented yet");
    case "3-semiflattened":
      console.log("translateASTToMQL: Semi-Flattened strategy selected (not implemented)");
      throw new Error("Semi-Flattened strategy not implemented yet");
    case "2-single-search":
      console.log("translateASTToMQL: Using Single Search strategy (maps to Hybrid-Nodes)");
      return translateHybridNodes(ast, strategyConfig);
    case "1-single-match":
      console.log("translateASTToMQL: Using Single Match strategy (maps to Hybrid-Nodes)");
      return translateHybridNodes(ast, strategyConfig);
    default:
      console.log("translateASTToMQL: Defaulting to Hybrid-Nodes strategy");
      return translateHybridNodes(ast, strategyConfig);
  }
}

export default translateASTToMQL;