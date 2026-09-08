lib/aqlToMql/
├── grammar/
│   ├── AqlLexer.js
│   ├── AqlParser.js
│   └── AqlParserVisitor.js
│
├── parser/
│   └── parseAqlAST.js        // Contains functions for parsing AQL into a canonical AST.
│
├── schema/
│   ├── baseSchemas.js        // Contains definitions of known/supported schemas (e.g. single collection, distributed)
│   └── indexRecommendations.js  // Contains recommendations for Atlas Search indexes or denormalized fields.
│
├── translator/
│   ├── single.js             // Translator for the "single" data model (one collection with compositions).
│   ├── distributed.js        // Translator for the "distributed" data model (separate collections, lookups, etc.).
│   └── index.js              // Main translator dispatcher that selects which sub-translator to call based on user input.
│
└── tests/
    ├── parser.test.js        // Unit tests for parsing functions.
    ├── schema.test.js        // Tests to validate the schema definitions and recommendations.
    └── translator.test.js    // Unit tests for the translator functions.


Explanation
	•	grammar/
Contains the ANTLR-generated lexer, parser, and visitor files. These files define the AQL grammar and are used by your parser code.
	•	parser/
Contains the file (e.g. parseAqlAST.js) that uses the grammar (lexer, parser, visitor) to convert an AQL string into a canonical AST. This file focuses on the syntax and structure of the AQL.
	•	schema/
Holds definitions of the known or supported MongoDB schemas (or data models). For instance, you can define:
	•	A “single collection” schema, with recommendations on how to store full compositions.
	•	A “distributed” (or denormalized) schema, where entries might be in separate collections or as embedded documents.
You can also store recommendations (e.g. which fields should have Atlas Search indexes, which fields to denormalize for performance, etc.) in this folder.
	•	translator/
Contains the main translator code that converts the canonical AST into a MongoDB aggregation pipeline. The folder is further divided into sub-files:
	•	One translator function per supported schema (e.g. single.js for a single collection, distributed.js for a distributed data model).
	•	An index.js file that acts as a dispatcher. It selects which translator to use based on user input (or a configuration setting), ensuring that the translation logic can be easily extended to support additional models later.
	•	tests/
Contains unit tests for each module. For example:
	•	Tests for your parser functions (to ensure that an AQL query correctly produces the canonical AST).
	•	Tests for your schema definitions (to verify that your index recommendations and denormalization guidelines match your expectations).
	•	Tests for the translator functions (to ensure that, given a canonical AST and a selected schema, the correct aggregation pipeline is produced).