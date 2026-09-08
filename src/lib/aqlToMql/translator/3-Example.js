/**
 * Example of how the semi-flattened strategy would handle the provided AQL query:
 * 
 * SELECT
 *     c/uid/value AS composition_id,
 *     med_ac/time/value AS administration_date,
 *     med_ac/description[at0017]/items[openEHR-EHR-CLUSTER.medication.v2]/items[at0150]/value/value AS lot_number,
 *     admin_salut/items[at0007]/items[at0014]/value/defining_code/code_string AS publishing_center
 * FROM EHR e[ehr_id/value=$ehr_id]
 *   CONTAINS COMPOSITION c[openEHR-EHR-COMPOSITION.vaccination_list.v0]
 *   CONTAINS SECTION s[openEHR-EHR-SECTION.immunisation_list.v0]
 *   CONTAINS ACTION med_ac[openEHR-EHR-ACTION.medication.v1]
 *   CONTAINS CLUSTER admin_salut[openEHR-EHR-CLUSTER.admin_salut.v0]
 * WHERE
 *   med_ac/time/value >= $startDate
 *   AND med_ac/time/value <= $endDate
 *   AND admin_salut/items[at0007]/items[at0014]/value/defining_code/code_string = $centre_code
 * ORDER BY
 *   med_ac/time/value DESC
 */

// The resulting MongoDB pipeline would look like:
const examplePipeline = [
    // MATCH STAGE - From the FROM/CONTAINS and WHERE clauses
    {
      $match: {
        $and: [
          // Match on ehr_id from variable
          { "ehr_id": { $eq: "$ehr_id" } },
          
          // Match COMPOSITION with appropriate archetype
          {
            "nodes": {
              $elemMatch: {
                "node_data._type": "COMPOSITION",
                "node_data.archetype_details.archetype_id.value": "openEHR-EHR-COMPOSITION.vaccination_list.v0"
              }
            }
          },
          
          // Match SECTION with appropriate archetype
          {
            "nodes": {
              $elemMatch: {
                "node_data._type": "SECTION",
                "node_data.archetype_details.archetype_id.value": "openEHR-EHR-SECTION.immunisation_list.v0"
              }
            }
          },
          
          // Match ACTION with appropriate archetype
          {
            "nodes": {
              $elemMatch: {
                "node_data._type": "ACTION",
                "node_data.archetype_details.archetype_id.value": "openEHR-EHR-ACTION.medication.v1",
                "node_data.time.value": { $gte: "$startDate", $lte: "$endDate" }
              }
            }
          },
          
          // Match CLUSTER with appropriate archetype
          {
            "nodes": {
              $elemMatch: {
                "node_data._type": "CLUSTER",
                "node_data.archetype_details.archetype_id.value": "openEHR-EHR-CLUSTER.admin_salut.v0"
              }
            }
          },
          
          // Match on the specific code_string in admin_salut
          {
            "nodes": {
              $elemMatch: {
                "node_data._type": "ELEMENT",
                "node_data.archetype_node_id": "at0014",
                "ancestors": { $all: ['at0007'] },
                "node_data.value.defining_code.code_string": "$centre_code"
              }
            }
          }
        ]
      }
    },
    
    // ADD FIELDS STAGE - Extract the referenced entities
    {
      $addFields: {
        c: {
          $let: {
            vars: {
              composition: {
                $first: {
                  $filter: {
                    input: "$nodes",
                    as: "nodes",
                    cond: {
                      $and: [{
                        $eq: ["$$nodes.node_data._type", "COMPOSITION"],
                      }, {
                        $eq: ["$$nodes.node_data.archetype_details.archetype_id.value", "openEHR-EHR-COMPOSITION.vaccination_list.v0"],
                      }]
                    }
                  }
                }
              }
            },
            in: "$$composition"
          }
        },
        med_ac: {
          $let: {
            vars: {
              med_ac: {
                $first: {
                  $filter: {
                    input: "$nodes",
                    as: "nodes",
                    cond: {
                      $and: [{
                        $eq: ["$$nodes.node_data._type", "ACTION"],
                      }, {
                        $eq: ["$$nodes.node_data.archetype_details.archetype_id.value", "openEHR-EHR-ACTION.medication.v1"],
                      }, {
                        $gte: ["$$nodes.node_data.time.value", "$startDate"]
                      }, {
                        $lte: ["$$nodes.node_data.time.value", "$endDate"]
                      }]
                    }
                  }
                }
              }
            },
            in: "$$med_ac"
          }
        },
        // Extract med_ac_element (for lot number)
        med: {
          $let: {
            vars: {
              med_ac_el: {
                $first: {
                  $filter: {
                    input: "$nodes",
                    as: "nodes",
                    cond: {
                      $and: [{
                        $eq: ["$$nodes.node_data._type", "ELEMENT"],
                      }
                      , {
                        $eq: ["$$nodes.node_data.archetype_node_id", "at0132"],
                      },
                      {
                        $and: [{
                          $in: ["openEHR-EHR-ACTION.medication.v1", "$$nodes.ancestors",]
                        }, {
                          $in: ["openEHR-EHR-CLUSTER.medication.v2", "$$nodes.ancestors",]
                        }]
                      },
                      {
                        $eq: [{ $substr: ["$$nodes.archetype_path", 0, { $strLenCP: "$med_ac.archetype_path" }] }, "$med_ac.archetype_path"]
                      },
                      {
                        $gt: [{ $indexOfCP: ["$$nodes.archetype_path", "description[at0017].items[openEHR-EHR-CLUSTER.medication.v2].items[at0132]"] }, 0]
                      }
                      ]
                    }
                  }
                }
              }
            },
            in: "$$med_ac_el"
          }
        },
        // Extract admin_salut element (for publishing center)
        admin_salut: {
          $let: {
            vars: {
              admin_salut_el: {
                $first: {
                  $filter: {
                    input: "$nodes",
                    as: "nodes",
                    cond: {
                      $and: [{
                        $eq: ["$$nodes.node_data._type", "ELEMENT"],
                      }
                      , {
                        $eq: ["$$nodes.node_data.archetype_node_id", "at0014"],
                      },
                      {
                        $and: [{
                          $in: ["at0007", "$$nodes.ancestors"]
                        },{
                          $in: ["openEHR-EHR-CLUSTER.admin_salut.v0", "$$nodes.ancestors"]
                        }]
                      }
                      ]
                    }
                  }
                }
              }
            },
            in: "$$admin_salut_el"
          }
        }
      }
    },
    
    // PROJECT STAGE - From the SELECT clause
    {
      $project: {
        composition_id: "$c.node_data.uid.value",
        administration_date: "$med_ac.node_data.time.value",
        lot_number: "$med.node_data.value.value",
        publishing_center:"$admin_salut.node_data.value.defining_code.code_string"
      }
    },
    
    // SORT STAGE - From the ORDER BY clause
    {
      $sort: {
        administration_date: -1
      }
    }
  ];
  
  // This is similar to the query example provided in your source document