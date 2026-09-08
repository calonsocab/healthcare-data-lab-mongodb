// lib/aqlToMql/schema/dataModels.js

export const dataModels = {
    single: {
      rmType: "COMPOSITION",
      collection: "compositions",
      description: "A single collection containing full composition documents.",
      fields: [
        { name: "_id", type: "ObjectId", index: "unique" },
        { name: "ehr_id", type: "string", index: true },
        { name: "composition_date", type: "ISODate", index: true },
        { name: "composition_version", type: "string", index: true },
        { name: "archetype_node_id", type: "string", index: true },
        { name: "canonicalJSON", type: "object" }
      ],
      // Optionally, provide recommendations for Atlas Search indexes:
      atlasSearch: {
        fullTextFields: ["canonicalJSON.content"],
        vectorFields: [] // For example, if you index embeddings.
      }
    },
    distributed: {
      // (A second schema can be defined here.)
    }
  };