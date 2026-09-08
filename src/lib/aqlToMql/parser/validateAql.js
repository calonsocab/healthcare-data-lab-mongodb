import antlr4 from "antlr4";
import AqlLexer from "../grammar/AqlLexer.js";
import AqlParser from "../grammar/AqlParser.js";
import { parseAql as customParseAql } from "./customAqlParser.js";

class AqlErrorListener extends antlr4.error.ErrorListener {
  constructor() {
    super();
    this.errors = [];
  }

  syntaxError(recognizer, offendingSymbol, line, column, msg, e) {
    this.errors.push({ line, column, message: msg });
  }

  getErrors() {
    return this.errors;
  }
}

const validateAQL = (aqlInput) => {
  if (!aqlInput || aqlInput.trim() === "") {
    return { success: false, message: "AQL query is empty.", errors: [] }; // Ensure `errors` exists
  }

  try {
    const chars = new antlr4.InputStream(aqlInput);
    const lexer = new AqlLexer(chars);
    const tokens = new antlr4.CommonTokenStream(lexer);
    const parser = new AqlParser(tokens);

    // Attach error listener
    const errorListener = new AqlErrorListener();
    parser.removeErrorListeners();
    parser.addErrorListener(errorListener);

    parser.buildParseTrees = true;
    parser.aqlQuery(); // Start parsing from AQL Query rule

    const errors = errorListener.getErrors(); // Get collected errors
    if (errors.length > 0) {
      try {
        customParseAql(aqlInput);
        return {
          success: true,
          message: "Valid AQL query",
          errors: [],
        };
      } catch {
        return {
          success: false,
          message: "AQL syntax errors detected.",
          errors,
        };
      }
    }

    return {
      success: true,
      message: "Valid AQL query",
      errors: [], // Ensure it is always an array
    };
  } catch (error) {
    try {
      customParseAql(aqlInput);
      return {
        success: true,
        message: "Valid AQL query",
        errors: [],
      };
    } catch {
      console.error("Validation failed:", error);
      return { success: false, message: "Unexpected error during validation.", errors: [error.message] };
    }
  }
};

export default validateAQL;
