//src/components/views/lab/strategies/SchemaVisualization.jsx 
'use client';

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Database, Code, FileJson } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/common/Tabs";
import CollapsibleSection from '../../../common/CollapsibleSection';

/**
 * Component that visualizes the semi-flattened document structure
 */
const SchemaVisualization = ({ schema }) => {
  const [activeTab, setActiveTab] = useState('structure');
  
  return (
    <div className="dark-banner bg-slate-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-slate-200 mb-4 flex items-center">
        <Database className="mr-2 text-blue-400" size={18} />
        Semi-Flattened Document Structure
      </h2>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="structure" className="text-sm">
            Structure
          </TabsTrigger>
          <TabsTrigger value="example" className="text-sm">
            Example
          </TabsTrigger>
          <TabsTrigger value="queries" className="text-sm">
            Query Patterns
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="structure">
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-900 rounded-lg p-3">
                <h3 className="text-sm font-medium text-slate-200 mb-2 flex items-center">
                  <FileJson className="mr-1 text-green-400" size={14} />
                  Document Structure
                </h3>
                
                <div className="rounded-lg overflow-auto text-xs text-slate-300 whitespace-pre">
                  <DocumentStructure />
                </div>
              </div>
              
              <div className="bg-slate-900 rounded-lg p-3">
                <h3 className="text-sm font-medium text-slate-200 mb-2 flex items-center">
                  <Code className="mr-1 text-green-400" size={14} />
                  Node Structure
                </h3>
                
                <div className="rounded-lg overflow-auto text-xs text-slate-300 whitespace-pre">
                  <NodeStructure />
                </div>
              </div>
            </div>
            
            <CollapsibleSection
              title="Structure Analysis & Benefits"
              isExpanded={false}
              onToggle={() => {}}
            >
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-slate-900 p-3 rounded-lg">
                    <h4 className="text-blue-400 font-medium mb-2">Key Structure Elements</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex gap-2">
                        <span className="text-green-400 font-medium">path:</span>
                        <span className="text-slate-300">Absolute dot-notation path for flat access</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-400 font-medium">archetype_path:</span>
                        <span className="text-slate-300">Standard openEHR path with at-codes</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-400 font-medium">ancestors:</span>
                        <span className="text-slate-300">Allows hierarchical traversal and context</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-green-400 font-medium">node_data:</span>
                        <span className="text-slate-300">Original content preserving all attributes</span>
                      </li>
                    </ul>
                  </div>
                  
                  <div className="bg-slate-900 p-3 rounded-lg">
                    <h4 className="text-blue-400 font-medium mb-2">Query Performance Benefits</h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex gap-2">
                        <span className="text-yellow-400 font-medium">Efficient Array Querying:</span>
                        <span className="text-slate-300">Using $elemMatch for targeted node search</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-yellow-400 font-medium">Path Resolution:</span>
                        <span className="text-slate-300">Fast lookup with path indexes and regex</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-yellow-400 font-medium">Context Preservation:</span>
                        <span className="text-slate-300">Ancestors array maintains hierarchical relationships</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-yellow-400 font-medium">Optimized Indexes:</span>
                        <span className="text-slate-300">Array-specific indexes for common query patterns</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </CollapsibleSection>
          </div>
        </TabsContent>
        
        <TabsContent value="example">
          <div className="bg-slate-900 rounded-lg p-3 overflow-auto max-h-[500px]">
            <h3 className="text-sm font-medium text-slate-200 mb-2">Sample Document</h3>
            <pre className="text-xs text-slate-300 whitespace-pre-wrap">
              {`{
  "_id": ObjectId("5f9e4c5b2c4d7e3a1b0e8d7a"),
  "ehr_id": "029c57f-fcf8-4c66-aae9-b4d7bb5c1cc",
  "comp_id": ObjectId("6762a570f384ceb8faaf8cb7"),
  "composition_date": ISODate("2016-07-04T06:02:19.000Z"),
  "archetype_node_id": "openEHR-EHR-COMPOSITION.vaccination_list.v0",
  "nodes": [
    {
      "path": "CanonicalJSON",
      "archetype_path": "CanonicalJSON",
      "ancestors": [
        "openEHR-EHR-COMPOSITION.vaccination_list.v0"
      ],
      "node_data": {
        "_type": "COMPOSITION",
        "name": {
          "_type": "DV_TEXT",
          "value": "HC3 Immunization List"
        },
        "archetype_details": {
          "archetype_id": {
            "value": "openEHR-EHR-COMPOSITION.vaccination_list.v0"
          },
          "template_id": {
            "value": "HC3 Immunization List v0.5"
          },
          "rm_version": "1.0.4"
        },
        "uid": {
          "_type": "OBJECT_VERSION_ID",
          "value": "00c33737-7a1f-4d7f-b247-5e15dad946ee::ehrbase.ehrbase.org::1"
        }
      }
    },
    {
      "path": "CanonicalJSON.content[0].items[0]",
      "archetype_path": "CanonicalJSON.content[openEHR-EHR-SECTION.immunisation_list.v0].items[openEHR-EHR-ACTION.medication.v1]",
      "ancestors": [
        "openEHR-EHR-COMPOSITION.vaccination_list.v0",
        "openEHR-EHR-SECTION.immunisation_list.v0",
        "openEHR-EHR-ACTION.medication.v1"
      ],
      "node_data": {
        "_type": "ACTION",
        "name": {
          "_type": "DV_TEXT",
          "value": "Immunization management"
        },
        "time": {
          "_type": "DV_DATE_TIME",
          "value": "2010-02-22T23:00:00.000Z"
        },
        "archetype_node_id": "openEHR-EHR-ACTION.medication.v1"
      }
    },
    {
      "path": "CanonicalJSON.content[0].items[0].description.items[0]",
      "archetype_path": "CanonicalJSON.content[openEHR-EHR-SECTION.immunisation_list.v0].items[openEHR-EHR-ACTION.medication.v1].description[at0017].items[at0020]",
      "ancestors": [
        "openEHR-EHR-COMPOSITION.vaccination_list.v0",
        "openEHR-EHR-SECTION.immunisation_list.v0",
        "openEHR-EHR-ACTION.medication.v1",
        "at0017",
        "at0020"
      ],
      "node_data": {
        "_type": "ELEMENT",
        "name": {
          "_type": "DV_TEXT",
          "value": "Immunization item"
        },
        "value": {
          "_type": "DV_CODED_TEXT",
          "value": "Haemophilus influenzae tipus b",
          "defining_code": {
            "_type": "CODE_PHRASE",
            "terminology_id": {
              "_type": "TERMINOLOGY_ID",
              "value": "E0FC202C-9D9B-11DC-BA79-9FB156D89593"
            },
            "code_string": "Hib"
          }
        },
        "archetype_node_id": "at0020"
      }
    },
    {
      "path": "CanonicalJSON.content[0].items[0].description.items[1].items[0]",
      "archetype_path": "CanonicalJSON.content[openEHR-EHR-SECTION.immunisation_list.v0].items[openEHR-EHR-ACTION.medication.v1].description[at0017].items[openEHR-EHR-CLUSTER.medication.v2].items[at0132]",
      "ancestors": [
        "openEHR-EHR-COMPOSITION.vaccination_list.v0",
        "openEHR-EHR-SECTION.immunisation_list.v0",
        "openEHR-EHR-ACTION.medication.v1",
        "at0017",
        "openEHR-EHR-CLUSTER.medication.v2",
        "at0132"
      ],
      "node_data": {
        "_type": "ELEMENT",
        "name": {
          "_type": "DV_TEXT",
          "value": "Name"
        },
        "value": {
          "_type": "DV_CODED_TEXT",
          "value": "657452",
          "defining_code": {
            "_type": "CODE_PHRASE",
            "terminology_id": {
              "_type": "TERMINOLOGY_ID",
              "value": "2.16.840.1.113883.4.292.10.5"
            },
            "code_string": "657452"
          }
        },
        "archetype_node_id": "at0132"
      }
    }
  ]
}`}
            </pre>
          </div>
        </TabsContent>
        
        <TabsContent value="queries">
          <div className="space-y-4">
            <CollapsibleSection
              title="Finding Compositions by Archetype"
              isExpanded={false}
              onToggle={() => {}}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900 p-3 rounded-lg">
                  <h4 className="text-blue-400 font-medium mb-2">AQL</h4>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                    {`SELECT c
FROM EHR e
CONTAINS COMPOSITION c[openEHR-EHR-COMPOSITION.encounter.v1]`}
                  </pre>
                </div>
                
                <div className="bg-slate-900 p-3 rounded-lg">
                  <h4 className="text-green-400 font-medium mb-2">MongoDB Query</h4>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                    {`{
  $match: {
    "nodes": {
      $elemMatch: {
        "node_data._type": "COMPOSITION",
        "node_data.archetype_details.archetype_id.value": 
          "openEHR-EHR-COMPOSITION.encounter.v1"
      }
    }
  }
}`}
                  </pre>
                </div>
              </div>
            </CollapsibleSection>
            
            <CollapsibleSection
              title="Finding Observations with Value Constraints"
              isExpanded={false}
              onToggle={() => {}}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900 p-3 rounded-lg">
                  <h4 className="text-blue-400 font-medium mb-2">AQL</h4>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                    {`SELECT 
  o/data[at0001]/events[at0006]/data[at0003]/items[at0004]/value/magnitude as systolic
FROM EHR e
CONTAINS COMPOSITION c
CONTAINS OBSERVATION o[openEHR-EHR-OBSERVATION.blood_pressure.v1]
WHERE 
  o/data[at0001]/events[at0006]/data[at0003]/items[at0004]/value/magnitude > 140`}
                  </pre>
                </div>
                
                <div className="bg-slate-900 p-3 rounded-lg">
                  <h4 className="text-green-400 font-medium mb-2">MongoDB Query</h4>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                    {`{
  $match: {
    $and: [
      {
        "nodes": {
          $elemMatch: {
            "node_data._type": "OBSERVATION",
            "node_data.archetype_details.archetype_id.value": 
              "openEHR-EHR-OBSERVATION.blood_pressure.v1"
          }
        }
      },
      {
        "nodes": {
          $elemMatch: {
            "archetype_path": { 
              $regex: "data\\\\[at0001\\\\]/events\\\\[at0006\\\\]/data\\\\[at0003\\\\]/items\\\\[at0004\\\\]/value/magnitude" 
            },
            "ancestors": { 
              $in: ["openEHR-EHR-OBSERVATION.blood_pressure.v1"] 
            },
            "node_data.value.magnitude": { $gt: 140 }
          }
        }
      }
    ]
  }
}`}
                  </pre>
                </div>
              </div>
            </CollapsibleSection>
            
            <CollapsibleSection
              title="Complex Query with Multiple Constraints"
              isExpanded={false}
              onToggle={() => {}}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-900 p-3 rounded-lg">
                  <h4 className="text-blue-400 font-medium mb-2">AQL</h4>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                    {`SELECT 
  c/uid/value as composition_id,
  med_ac/time/value as administration_date,
  med_ac/description[at0017]/items[openEHR-EHR-CLUSTER.medication.v2]/items[at0150]/value/value as lot_number,
  admin_salut/items[at0007]/items[at0014]/value/defining_code/code_string as publishing_center
FROM EHR e[ehr_id/value=$ehr_id]
  CONTAINS COMPOSITION c[openEHR-EHR-COMPOSITION.vaccination_list.v0]
  CONTAINS SECTION s[openEHR-EHR-SECTION.immunisation_list.v0]
  CONTAINS ACTION med_ac[openEHR-EHR-ACTION.medication.v1]
  CONTAINS CLUSTER admin_salut[openEHR-EHR-CLUSTER.admin_salut.v0]
WHERE
  med_ac/time/value >= $startDate
  AND med_ac/time/value <= $endDate
  AND admin_salut/items[at0007]/items[at0014]/value/defining_code/code_string = $centre_code
ORDER BY
  med_ac/time/value DESC`}
                  </pre>
                </div>
                
                <div className="bg-slate-900 p-3 rounded-lg">
                  <h4 className="text-green-400 font-medium mb-2">MongoDB Query</h4>
                  <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                    {`[
  {
    $match: {
      $and: [
        { "ehr_id": { $eq: "$ehr_id" } },
        {
          "nodes": {
            $elemMatch: {
              "node_data._type": "COMPOSITION",
              "node_data.archetype_details.archetype_id.value": "openEHR-EHR-COMPOSITION.vaccination_list.v0"
            }
          }
        },
        {
          "nodes": {
            $elemMatch: {
              "node_data._type": "SECTION",
              "node_data.archetype_details.archetype_id.value": "openEHR-EHR-SECTION.immunisation_list.v0"
            }
          }
        },
        {
          "nodes": {
            $elemMatch: {
              "node_data._type": "ACTION",
              "node_data.archetype_details.archetype_id.value": "openEHR-EHR-ACTION.medication.v1",
              "node_data.time.value": { $gte: "$startDate", $lte: "$endDate" }
            }
          }
        },
        {
          "nodes": {
            $elemMatch: {
              "node_data._type": "CLUSTER",
              "node_data.archetype_details.archetype_id.value": "openEHR-EHR-CLUSTER.admin_salut.v0"
            }
          }
        },
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
  {
    $addFields: {
      "c": {
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
      // ... Additional fields for med_ac and admin_salut
    }
  },
  {
    $project: {
      composition_id: "$c.node_data.uid.value",
      administration_date: "$med_ac.node_data.time.value",
      lot_number: "$med.node_data.value.value",
      publishing_center:"$admin_salut.node_data.value.defining_code.code_string"
    }
  },
  {
    $sort: {
      administration_date: -1
    }
  }
]`}
                  </pre>
                </div>
              </div>
            </CollapsibleSection>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Document structure visualization
const DocumentStructure = () => (
  <div className="pl-4 text-xs">
    <div className="flex items-center text-blue-400 font-medium mb-1">Document</div>
    <div className="pl-4">
      <div className="flex">
        <span className="text-yellow-400">_id</span>
        <span className="text-slate-500 mx-1">:</span>
        <span className="text-green-400">ObjectId()</span>
      </div>
      <div className="flex">
        <span className="text-yellow-400">ehr_id</span>
        <span className="text-slate-500 mx-1">:</span>
        <span className="text-green-400">String</span>
        <span className="text-slate-500 ml-2">{"// Index: true"}</span>
      </div>
      <div className="flex">
        <span className="text-yellow-400">comp_id</span>
        <span className="text-slate-500 mx-1">:</span>
        <span className="text-green-400">ObjectId()</span>
        <span className="text-slate-500 ml-2">{"// Index: true"}</span>
      </div>
      <div className="flex">
        <span className="text-yellow-400">composition_date</span>
        <span className="text-slate-500 mx-1">:</span>
        <span className="text-green-400">ISODate()</span>
        <span className="text-slate-500 ml-2">{"// Index: true"}</span>
      </div>
      <div className="flex">
        <span className="text-yellow-400">archetype_node_id</span>
        <span className="text-slate-500 mx-1">:</span>
        <span className="text-green-400">String</span>
        <span className="text-slate-500 ml-2">{"// Index: true"}</span>
      </div>
      <div className="flex items-center mb-1">
        <span className="text-yellow-400">nodes</span>
        <span className="text-slate-500 mx-1">:</span>
        <span className="text-blue-400">Array</span>
        <span className="text-slate-500 ml-2">{"// Contains flattened nodes"}</span>
      </div>
      <div className="pl-4">
        <div className="text-blue-400">[</div>
        <div className="pl-4">
          <div className="text-blue-400">{"{ /* Node 1 */ }"}</div>
          <div className="text-blue-400">{"{ /* Node 2 */ }"}</div>
          <div className="text-blue-400">{"{ /* Node 3 */ }"}</div>
          <div className="text-slate-500">{"// More nodes..."}</div>
        </div>
        <div className="text-blue-400">]</div>
      </div>
    </div>
  </div>
);

// Node structure visualization
const NodeStructure = () => (
  <div className="pl-4 text-xs">
    <div className="flex items-center text-blue-400 font-medium mb-1">Node</div>
    <div className="pl-4">
      <div className="flex">
        <span className="text-yellow-400">path</span>
        <span className="text-slate-500 mx-1">:</span>
        <span className="text-green-400">String</span>
        <span className="text-slate-500 ml-2">{"// Absolute dot path"}</span>
      </div>
      <div className="flex">
        <span className="text-yellow-400">archetype_path</span>
        <span className="text-slate-500 mx-1">:</span>
        <span className="text-green-400">String</span>
        <span className="text-slate-500 ml-2">{"// Path with at-codes"}</span>
      </div>
      <div className="flex items-center mb-1">
        <span className="text-yellow-400">ancestors</span>
        <span className="text-slate-500 mx-1">:</span>
        <span className="text-blue-400">Array</span>
        <span className="text-slate-500 ml-2">{"// Parent archetypes"}</span>
      </div>
      <div className="pl-4">
        <div className="text-blue-400">[</div>
        <div className="pl-4">
          <div className="text-green-400">&quot;openEHR-EHR-COMPOSITION.encounter.v1&quot;,</div>
          <div className="text-green-400">&quot;openEHR-EHR-OBSERVATION.blood_pressure.v1&quot;,</div>
          <div className="text-green-400">&quot;at0001&quot;</div>
          <div className="text-slate-500">{"// More ancestors..."}</div>
        </div>
        <div className="text-blue-400">]</div>
      </div>
      <div className="flex items-center mt-1 mb-1">
        <span className="text-yellow-400">node_data</span>
        <span className="text-slate-500 mx-1">:</span>
        <span className="text-blue-400">Object</span>
        <span className="text-slate-500 ml-2">{"// Original node content"}</span>
      </div>
      <div className="pl-4">
        <div className="text-blue-400">{`{`}</div>
        <div className="pl-4">
          <div className="flex">
            <span className="text-yellow-400">_type</span>
            <span className="text-slate-500 mx-1">:</span>
            <span className="text-green-400">&quot;ELEMENT&quot;</span>
          </div>
          <div className="flex">
            <span className="text-yellow-400">name</span>
            <span className="text-slate-500 mx-1">:</span>
            <span className="text-blue-400">{`{ "_type": "DV_TEXT", "value": "..." }`}</span>
          </div>
          <div className="flex">
            <span className="text-yellow-400">archetype_node_id</span>
            <span className="text-slate-500 mx-1">:</span>
            <span className="text-green-400">&quot;at0004&quot;</span>
          </div>
          <div className="flex">
            <span className="text-yellow-400">value</span>
            <span className="text-slate-500 mx-1">:</span>
            <span className="text-blue-400">{`{ "_type": "DV_QUANTITY", "magnitude": 120, "units": "mm[Hg]" }`}</span>
          </div>
        </div>
        <div className="text-blue-400">{`}`}</div>
      </div>
    </div>
  </div>
);

export default SchemaVisualization;