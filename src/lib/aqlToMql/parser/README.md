# OpenEHR AQL Parser and AST Translator

This project parses OpenEHR AQL queries using ANTLR4 and builds an intermediate Abstract Syntax Tree (AST) for later translation into MongoDB MQL. The parser is based on a complete rewrite of the original AQL grammar and is designed to support key query clauses and operations.

## Current Supported Features

### SELECT Clause
- **Column Specifications:** 
  - Supports selecting columns defined by a data match path, function calls (including aggregate and built-in functions), and literal values.
  - Supports optional aliasing using the `AS` keyword.
- **DISTINCT and TOP:** 
  - The grammar recognizes `DISTINCT` (and the deprecated `TOP` keyword), although additional semantic processing is not yet implemented.

### FROM Clause
- **Model Type Constraints:**
  - Parses a basic model type (e.g., `EHR e`) and a chain of contained entities using the `CONTAINS` operator.
  - **Current Implementation:** Uses a regular expression to extract a two-level `CONTAINS` chain.
- **Limitations:**
  - Does not yet support arbitrary nesting or complex model type expressions as defined in the full grammar.

### WHERE Clause
- **Boolean Expressions:**
  - Supports basic conditions using logical operators (`AND`, `OR`, `NOT`), with proper handling of parentheses.
- **Comparison and Predicate Operators:**
  - Handles comparisons using `=` and supports operators like `LIKE`, `MATCHES`, and `EXISTS`.
  - Supports function calls and arithmetic expressions as operands, though deeper transformation into MQL is a future enhancement.

### ORDER BY Clause
- **Ordering:**
  - Parses order-by expressions, inferring sort direction (ASC/DESC) by inspecting the text.
  
### LIMIT and OFFSET Clauses
- **Limit:** 
  - Extracts a numeric limit from the query.
- **Offset:** 
  - Optionally supports OFFSET following LIMIT.

### Functions and Literals
- **Function Calls:** 
  - Supports built-in functions (string, numeric, date/time, aggregate, and terminology functions).
- **Arithmetic Expressions:** 
  - The grammar defines operator precedence for arithmetic, though extensive use in AST conversion is not yet demonstrated.
- **Literal Types:** 
  - Supports string, numeric, date/time literals, and Boolean values.

## Future Enhancements

1. **Full FROM Clause Parsing:**
   - Develop a dedicated visitor to fully traverse the model type constraint tree, enabling support for multiple and nested `CONTAINS` clauses.
   - Implement alias and archetype predicate extraction directly from the parse tree.

2. **Enhanced WHERE Clause AST:**
   - Build a recursive AST structure to accurately represent nested boolean and arithmetic expressions.
   - Extend handling of function calls and parameterized queries for translation into MongoDB MQL.

3. **Operator and Function Support:**
   - Ensure full support for all comparison operators (e.g., `>`, `>=`, `<`, `<=`).
   - Enhance the AST nodes for aggregate functions (e.g., `COUNT`, `MIN`, `MAX`, etc.) to facilitate translation into MongoDB aggregation pipelines.

4. **Alias Substitution and Path Transformation:**
   - Add a transformation phase that substitutes aliases into SELECT, WHERE, and ORDER BY clauses to align with MongoDB’s document model.

5. **Testing and Validation:**
   - Increase test coverage with complex AQL queries and edge cases.
   - Compare with the [openEHR AQL Reference Grammar](https://specifications.openehr.org/releases/query_language.html) to ensure full coverage.

## References

- **OpenEHR AQL Grammar and Specification:**
  - [openEHR Query Language Specification](https://specifications.openehr.org/releases/query_language.html)
- **ANTLR4 Documentation:**
  - [ANTLR4 Official Documentation](https://github.com/antlr/antlr4/blob/master/doc/index.md)

## Example

Given the following AQL:

```sql
SELECT c/context/start_time/value AS start_time, 
       c/content[openEHR-EHR-OBSERVATION.probs_base_observation.v0]/data[at0001]/events[at0002]/data[at0003]/items[openEHR-EHR-CLUSTER.test_request_screen.v0]/items/name/value AS prova_name, 
       c/content[openEHR-EHR-OBSERVATION.probs_base_observation.v0]/data[at0001]/events[at0002]/data[at0003]/items[openEHR-EHR-CLUSTER.test_request_screen.v0]/items/value/value AS prova_value, 
       c/archetype_details/template_id/value AS templateId, 
       c/uid/value AS compositionId 
FROM EHR e 
     CONTAINS COMPOSITION c[openEHR-EHR-COMPOSITION.probs_base_composition.v0] 
     CONTAINS (CLUSTER t[openEHR-EHR-CLUSTER.test_request_screen.v0]) 
WHERE c/context/other_context[at0001]/items[openEHR-EHR-CLUSTER.health_thread.v0]/items[at0003]/value/id = 'PROBS-ccf3f3c9-7524-422d-ba2e-9d62f4b9204b-7'
  AND e/ehr_id/value = 'ccf3f3c9-7524-422d-ba2e-9d62f4b9204b' 
ORDER BY c/context/start_time/value DESC 
LIMIT 10


The AST is constructed with keys:
	•	select: Mapping of each column specification.
	•	from: A main model type (e.g., { rmType: "EHR", alias: "e", archetype_node_id: "" }).
	•	contains: An array of contained entities with their rmType, alias, and archetype IDs.
	•	where: A nested object representing the boolean expression.
	•	orderBy: Ordering information with sort direction.
	•	limit/offset: Numeric values for pagination.


    {
  "select": {
    "0": {
      "path": "c/context/start_time/value",
      "alias": "start_time"
    },
    "1": {
      "path": "c/content[openEHR-EHR-OBSERVATION.probs_base_observation.v0]/data[at0001]/events[at0002]/data[at0003]/items[openEHR-EHR-CLUSTER.test_request_screen.v0]/items/name/value",
      "alias": "prova_name"
    },
    "2": {
      "path": "c/content[openEHR-EHR-OBSERVATION.probs_base_observation.v0]/data[at0001]/events[at0002]/data[at0003]/items[openEHR-EHR-CLUSTER.test_request_screen.v0]/items/value/value",
      "alias": "prova_value"
    },
    "3": {
      "path": "c/archetype_details/template_id/value",
      "alias": "templateId"
    },
    "4": {
      "path": "c/uid/value",
      "alias": "compositionId"
    }
  },
  "from": {
    "rmType": "EHR",
    "alias": "e",
    "archetype_node_id": ""
  },
  "contains": {
    "0": {
      "rmType": "COMPOSITION",
      "alias": "c",
      "archetype_node_id": "openEHR-EHR-COMPOSITION.probs_base_composition.v0"
    },
    "1": {
      "rmType": "CLUSTER",
      "alias": "t",
      "archetype_node_id": "openEHR-EHR-CLUSTER.test_request_screen.v0"
    }
  },
  "where": {
    "operator": "AND",
    "conditions": {
      "0": {
        "path": "c/context/other_context[at0001]/items[openEHR-EHR-CLUSTER.health_thread.v0]/items[at0003]/value/id",
        "operator": "=",
        "value": "PROBS-ccf3f3c9-7524-422d-ba2e-9d62f4b9204b-7"
      },
      "1": {
        "path": "e/ehr_id/value",
        "operator": "=",
        "value": "ccf3f3c9-7524-422d-ba2e-9d62f4b9204b"
      }
    }
  },
  "orderBy": {
    "0": {
      "path": "c/context/start_time/value",
      "direction": "DESC"
    }
  },
  "limit": 10,
  "offset": null
}


This project is a work in progress, and while the basic components are supported, the roadmap includes enhancing completeness and robustness to fully mirror the complexity of the AQL specification.
