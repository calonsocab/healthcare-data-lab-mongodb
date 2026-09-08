/**
 * Parses an AQL query and converts it into a MongoDB projection object.
 * Extracts `SELECT` fields and their corresponding aliases.
 */
 const parseAqlSelect = (aqlQuery) => {
    const projection = {}; // MongoDB Projection Object

    // Extract the SELECT clause (handles cases with or without FROM)
    const regex = /SELECT\s+([\s\S]+?)(\s+FROM|\s*$)/i;
    const match = aqlQuery.match(regex);

    if (!match) {
        throw new Error("Invalid AQL: No valid SELECT statement found. Ensure syntax is correct.");
    }

    const selectClause = match[1].trim(); // Extract the SELECT portion

    // Process each selected field
    selectClause.split(",").forEach((field) => {
        const parts = field.trim().split(/\s+AS\s+/i); // Case-insensitive split on "AS"
        if (parts.length < 2) {
            throw new Error(`Invalid AQL: Missing alias for field '${field.trim()}'`);
        }

        const aqlPath = parts[0].trim();
        const alias = parts[1].trim();
        projection[alias] = parseAqlToMql(aqlPath); // Convert AQL path to MQL
    });

    return projection; // ✅ Return the final projection object
};

/**
 * Converts a single AQL path into a MongoDB `$let` projection object.
 */
const parseAqlToMql = (aqlPath) => {
    const pathSegments = aqlPath.split("/").filter(segment => segment); // Remove empty segments
    let basePath = "$c.context.other_context"; // ✅ Correct root path
    let letStructure = { "$let": { vars: {}, in: null } };
    let reference = letStructure["$let"]; // Track the current level

    pathSegments.forEach((segment) => {
        if (segment.includes("[") && segment.includes("]")) {
            const match = segment.match(/(.+?)\[(.+?)\]?/); // Allow missing `]`
            if (!match) {
                throw new Error(`Invalid AQL syntax: Check brackets in '${segment}'`);
            }

            const field = match[1]; // Example: `context/other_context`
            const archetype = match[2]; // Example: `openEHR-EHR-CLUSTER.admin_salut.v0`

            // Construct MongoDB `$filter`
            reference.vars["node"] = {
                $first: {
                    $filter: {
                        input: `${basePath}.${field}.items`,  // Path inside canonical JSON
                        as: "item",
                        cond: { $eq: ["$$item.archetype_node_id", archetype] }
                    }
                }
            };

            basePath = `$$node`; // Update reference for next nesting
        }
    });

    // Assign the final "in" value correctly
    reference.in = basePath;
    return letStructure;
};

/**
 * Handles conversion from AQL to MongoDB projection in the UI.
 */
const handleConvertToMQL = () => {
    try {
        const mongoProjection = parseAqlSelect(aqlInput);
        setMqlOutput(JSON.stringify(mongoProjection, null, 2));  // ✅ Correctly formatted JSON output
    } catch (error) {
        setMqlOutput(`Error: ${error.message}`);
    }
};

// **TEST CASES**
console.log(
  JSON.stringify(parseAqlSelect("SELECT c/context/other_context[at0004]/items[openEHR-EHR-CLUSTER.admin_salut.v0] AS centre FROM EHR e CONTAINS COMPOSITION c"), null, 2)
);

// Export the function for external use
export default parseAqlSelect;