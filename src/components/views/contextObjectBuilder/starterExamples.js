import {
  HIERARCHICAL_DEFINITION_FORMAT,
  flattenHierarchicalDefinition
} from '@/lib/contextObjects/hierarchicalDefinition';

const LABORATORY_FULL_HIERARCHICAL_DEFINITION = {
  definitionType: HIERARCHICAL_DEFINITION_FORMAT,
  archetypeId: 'splash.context_object.laboratory_result.v1',
  rmEntity: 'OBSERVATION',
  name: 'Laboratory Result',
  root: {
    nodeId: 'ex-root-lab',
    role: 'section',
    name: 'Laboratory Result',
    attribute: 'root',
    dataType: 'object',
    occurrences: { min: 1, max: 1 },
    structuralBindings: [
      {
        model: 'openEHR',
        path: '/content[openEHR-EHR-OBSERVATION.laboratory_test_result.v1]'
      }
    ],
    children: [
      {
        nodeId: 'ex-lab-metadata',
        role: 'section',
        name: 'Document Metadata',
        attribute: 'documentMetadata',
        dataType: 'object',
        occurrences: { min: 0, max: 1 },
        children: [
          {
            nodeId: 'ex-lab-doc-id',
            role: 'field',
            name: 'Document Identifier',
            attribute: 'documentId',
            dataType: 'identifier',
            occurrences: { min: 1, max: 1 },
            constraints: {
              pattern: '^LAB-[0-9]{6}$'
            }
          },
          {
            nodeId: 'ex-lab-doc-status',
            role: 'field',
            name: 'Document Status',
            attribute: 'status',
            dataType: 'coded_text',
            occurrences: { min: 1, max: 1 },
            constraints: {
              allowedValues: ['preliminary', 'final', 'corrected']
            },
            terminologyBindings: [
              {
                system: 'HL7',
                code: 'final',
                display: 'Final',
                valueSet: 'http://terminology.hl7.org/ValueSet/observation-status',
                bindingStrength: 'required'
              }
            ]
          },
          {
            nodeId: 'ex-lab-issued-at',
            role: 'field',
            name: 'Issued At',
            attribute: 'issuedAt',
            dataType: 'datetime',
            timeRole: 'timestamp',
            occurrences: { min: 1, max: 1 }
          },
          {
            nodeId: 'ex-lab-provenance',
            role: 'block',
            name: 'Provenance',
            attribute: 'provenance',
            dataType: 'object',
            occurrences: { min: 0, max: 1 },
            blockId: 'block.clinical.provenance',
            versionRange: '^1.0.0'
          }
        ]
      },
      {
        nodeId: 'ex-lab-subject',
        role: 'section',
        name: 'Subject Context',
        attribute: 'subjectContext',
        dataType: 'object',
        occurrences: { min: 1, max: 1 },
        children: [
          {
            nodeId: 'ex-lab-subject-id',
            role: 'field',
            name: 'Subject Reference',
            attribute: 'subjectId',
            dataType: 'reference',
            occurrences: { min: 1, max: 1 }
          },
          {
            nodeId: 'ex-lab-sex-at-birth',
            role: 'field',
            name: 'Sex at Birth',
            attribute: 'sexAtBirth',
            dataType: 'coded_text',
            occurrences: { min: 0, max: 1 },
            terminologyBindings: [
              {
                system: 'SNOMED-CT',
                code: '248153007',
                display: 'Male',
                valueSet: 'http://snomed.info/sct?fhir_vs=refset/446151000124109',
                bindingStrength: 'extensible'
              }
            ]
          }
        ]
      },
      {
        nodeId: 'ex-lab-care',
        role: 'section',
        name: 'Care Context',
        attribute: 'careContext',
        dataType: 'object',
        occurrences: { min: 0, max: 1 },
        children: [
          {
            nodeId: 'ex-lab-encounter-id',
            role: 'field',
            name: 'Encounter Identifier',
            attribute: 'encounterId',
            dataType: 'identifier',
            occurrences: { min: 1, max: 1 }
          },
          {
            nodeId: 'ex-lab-care-setting',
            role: 'field',
            name: 'Care Setting',
            attribute: 'careSetting',
            dataType: 'coded_text',
            occurrences: { min: 0, max: 1 },
            terminologyBindings: [
              {
                system: 'SNOMED-CT',
                code: '310065000',
                display: 'Inpatient service',
                valueSet: 'http://snomed.info/sct?fhir_vs=refset/32570581000036106',
                bindingStrength: 'preferred'
              }
            ]
          }
        ]
      },
      {
        nodeId: 'ex-lab-report',
        role: 'section',
        name: 'Laboratory Report',
        attribute: 'laboratoryReport',
        dataType: 'object',
        occurrences: { min: 1, max: 1 },
        structuralBindings: [
          {
            model: 'openEHR',
            path: '/data[at0001]/events'
          }
        ],
        children: [
          {
            nodeId: 'ex-lab-report-code',
            role: 'field',
            name: 'Report Code',
            attribute: 'reportCode',
            dataType: 'coded_text',
            occurrences: { min: 1, max: 1 },
            terminologyBindings: [
              {
                system: 'LOINC',
                code: '24323-8',
                display: 'Comprehensive metabolic 2000 panel - Serum or Plasma',
                valueSet: 'http://loinc.org/vs/LL3123-1',
                bindingStrength: 'required'
              }
            ]
          },
          {
            nodeId: 'ex-lab-specimen',
            role: 'group',
            name: 'Specimen',
            attribute: 'specimen',
            dataType: 'object',
            occurrences: { min: 0, max: 1 },
            children: [
              {
                nodeId: 'ex-lab-specimen-type',
                role: 'field',
                name: 'Specimen Type',
                attribute: 'specimenType',
                dataType: 'coded_text',
                occurrences: { min: 1, max: 1 },
                terminologyBindings: [
                  {
                    system: 'SNOMED-CT',
                    code: '122555007',
                    display: 'Venous blood specimen',
                    valueSet: 'http://snomed.info/sct?fhir_vs=refset/123038009',
                    bindingStrength: 'required'
                  }
                ]
              },
              {
                nodeId: 'ex-lab-collected-at',
                role: 'field',
                name: 'Collected At',
                attribute: 'collectedAt',
                dataType: 'datetime',
                timeRole: 'timestamp',
                occurrences: { min: 0, max: 1 }
              }
            ]
          },
          {
            nodeId: 'ex-lab-events',
            role: 'event_series',
            name: 'Result Events',
            attribute: 'events',
            dataType: 'array',
            occurrences: { min: 1, max: '*' },
            children: [
              {
                nodeId: 'ex-lab-event',
                role: 'event',
                name: 'Result Event',
                attribute: 'event',
                dataType: 'object',
                occurrences: { min: 1, max: 1 },
                children: [
                  {
                    nodeId: 'ex-lab-event-time',
                    role: 'field',
                    name: 'Event Time',
                    attribute: 'eventTime',
                    dataType: 'datetime',
                    timeRole: 'timestamp',
                    occurrences: { min: 1, max: 1 }
                  },
                  {
                    nodeId: 'ex-lab-analyzer-id',
                    role: 'field',
                    name: 'Analyzer Identifier',
                    attribute: 'analyzerId',
                    dataType: 'identifier',
                    occurrences: { min: 0, max: 1 }
                  },
                  {
                    nodeId: 'ex-lab-analyte',
                    role: 'group',
                    name: 'Analyte',
                    attribute: 'analyte',
                    dataType: 'object',
                    occurrences: { min: 1, max: '*' },
                    children: [
                      {
                        nodeId: 'ex-lab-analyte-code',
                        role: 'field',
                        name: 'Analyte Code',
                        attribute: 'analyteCode',
                        dataType: 'coded_text',
                        occurrences: { min: 1, max: 1 },
                        terminologyBindings: [
                          {
                            system: 'LOINC',
                            code: '718-7',
                            display: 'Hemoglobin [Mass/volume] in Blood',
                            valueSet: 'http://loinc.org/vs/LL1234-5',
                            bindingStrength: 'required'
                          }
                        ]
                      },
                      {
                        nodeId: 'ex-lab-value',
                        role: 'field',
                        name: 'Measured Value',
                        attribute: 'value',
                        dataType: 'quantity',
                        occurrences: { min: 1, max: 1 },
                        constraints: {
                          minValue: 0,
                          maxValue: 10000
                        }
                      },
                      {
                        nodeId: 'ex-lab-unit',
                        role: 'field',
                        name: 'Unit',
                        attribute: 'unit',
                        dataType: 'coded_text',
                        occurrences: { min: 1, max: 1 },
                        terminologyBindings: [
                          {
                            system: 'UCUM',
                            code: 'g/dL',
                            display: 'gram per deciliter',
                            valueSet: 'http://unitsofmeasure.org',
                            bindingStrength: 'required'
                          }
                        ]
                      },
                      {
                        nodeId: 'ex-lab-reference-range',
                        role: 'field',
                        name: 'Reference Range',
                        attribute: 'referenceRange',
                        dataType: 'interval',
                        occurrences: { min: 0, max: 1 }
                      },
                      {
                        nodeId: 'ex-lab-interpretation',
                        role: 'field',
                        name: 'Interpretation',
                        attribute: 'interpretation',
                        dataType: 'coded_text',
                        occurrences: { min: 0, max: 1 },
                        terminologyBindings: [
                          {
                            system: 'HL7',
                            code: 'N',
                            display: 'Normal',
                            valueSet: 'http://terminology.hl7.org/ValueSet/v3-ObservationInterpretation',
                            bindingStrength: 'preferred'
                          }
                        ]
                      },
                      {
                        nodeId: 'ex-lab-comment',
                        role: 'field',
                        name: 'Comment',
                        attribute: 'comment',
                        dataType: 'string',
                        occurrences: { min: 0, max: 1 },
                        constraints: {
                          maxLength: 500
                        }
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
};

const LABORATORY_FULL_NODES = flattenHierarchicalDefinition(LABORATORY_FULL_HIERARCHICAL_DEFINITION);

export const STARTER_EXAMPLES = [
  {
    id: 'vital-signs-starter',
    name: 'Vital Signs',
    category: 'Vitals',
    tags: ['vitals', 'observation', 'blood pressure', 'temperature'],
    description: 'Starter structure with temporal events and core vital signs.',
    nodes: (() => {
      const rootId = 'ex-root-vitals';
      const metadataId = 'ex-metadata';
      const subjectId = 'ex-subject';
      const clinicalId = 'ex-clinical';
      const eventsId = 'ex-events';
      const eventId = 'ex-event';
      const panelId = 'ex-vital-panel';
      const bpId = 'ex-bp';
      return [
        {
          nodeId: rootId,
          parentNodeId: null,
          role: 'section',
          name: 'Vital Signs Starter',
          attribute: 'root',
          dataType: 'object',
          occurrences: { min: 1, max: 1 }
        },
        {
          nodeId: metadataId,
          parentNodeId: rootId,
          role: 'section',
          name: 'Document Metadata',
          attribute: 'documentMetadata',
          dataType: 'object',
          occurrences: { min: 0, max: 1 }
        },
        {
          nodeId: 'ex-doc-id',
          parentNodeId: metadataId,
          role: 'field',
          name: 'Document ID',
          attribute: 'documentId',
          dataType: 'string',
          occurrences: { min: 1, max: 1 }
        },
        {
          nodeId: 'ex-status',
          parentNodeId: metadataId,
          role: 'field',
          name: 'Status',
          attribute: 'status',
          dataType: 'code',
          occurrences: { min: 1, max: 1 }
        },
        {
          nodeId: subjectId,
          parentNodeId: rootId,
          role: 'section',
          name: 'Subject Context',
          attribute: 'subjectContext',
          dataType: 'object',
          occurrences: { min: 0, max: 1 }
        },
        {
          nodeId: 'ex-subject-id',
          parentNodeId: subjectId,
          role: 'field',
          name: 'Subject ID',
          attribute: 'subjectId',
          dataType: 'reference',
          occurrences: { min: 1, max: 1 }
        },
        {
          nodeId: clinicalId,
          parentNodeId: rootId,
          role: 'section',
          name: 'Clinical Content',
          attribute: 'clinicalContent',
          dataType: 'object',
          occurrences: { min: 0, max: 1 }
        },
        {
          nodeId: eventsId,
          parentNodeId: clinicalId,
          role: 'event_series',
          name: 'Events',
          attribute: 'events',
          dataType: 'array',
          occurrences: { min: 0, max: '*' }
        },
        {
          nodeId: eventId,
          parentNodeId: eventsId,
          role: 'event',
          name: 'Event',
          attribute: 'event',
          dataType: 'object',
          occurrences: { min: 1, max: 1 }
        },
        {
          nodeId: 'ex-event-time',
          parentNodeId: eventId,
          role: 'field',
          name: 'Event Time',
          attribute: 'eventTime',
          dataType: 'datetime',
          occurrences: { min: 1, max: 1 }
        },
        {
          nodeId: panelId,
          parentNodeId: eventId,
          role: 'group',
          name: 'Vital Signs Panel',
          attribute: 'vitalSignsPanel',
          dataType: 'object',
          occurrences: { min: 0, max: 1 }
        },
        {
          nodeId: bpId,
          parentNodeId: panelId,
          role: 'group',
          name: 'Blood Pressure',
          attribute: 'bloodPressure',
          dataType: 'object',
          occurrences: { min: 0, max: 1 }
        },
        {
          nodeId: 'ex-systolic',
          parentNodeId: bpId,
          role: 'field',
          name: 'Systolic',
          attribute: 'systolic',
          dataType: 'quantity',
          occurrences: { min: 1, max: 1 }
        },
        {
          nodeId: 'ex-diastolic',
          parentNodeId: bpId,
          role: 'field',
          name: 'Diastolic',
          attribute: 'diastolic',
          dataType: 'quantity',
          occurrences: { min: 1, max: 1 }
        },
        {
          nodeId: 'ex-temperature',
          parentNodeId: panelId,
          role: 'field',
          name: 'Temperature',
          attribute: 'temperature',
          dataType: 'quantity',
          occurrences: { min: 0, max: 1 }
        }
      ];
    })()
  },
  {
    id: 'laboratory-result-starter',
    name: 'Laboratory',
    category: 'Laboratory',
    tags: ['laboratory', 'results', 'panel', 'analyte', 'hierarchical', 'splash'],
    description: 'Full hierarchical laboratory ContextObject definition (Splash-style) with terminology, constraints, relationships, and operational profile.',
    definitionFormat: HIERARCHICAL_DEFINITION_FORMAT,
    definition: LABORATORY_FULL_HIERARCHICAL_DEFINITION,
    nodes: LABORATORY_FULL_NODES,
    terminologyBindings: [
      {
        system: 'LOINC',
        code: '24323-8',
        display: 'Comprehensive metabolic 2000 panel - Serum or Plasma',
        valueSet: 'http://loinc.org/vs/LL3123-1',
        bindingStrength: 'required'
      }
    ],
    structuralBindings: [
      {
        model: 'openEHR',
        path: '/content[openEHR-EHR-OBSERVATION.laboratory_test_result.v1]'
      }
    ],
    relationships: [
      {
        relationshipId: 'rel-lab-subject-link',
        type: 'reference',
        sourceNodeId: 'ex-lab-subject-id',
        targetObjectId: 'context.subject',
        cardinality: 'one_to_one',
        description: 'Subject reference links this context object to a patient context object.'
      },
      {
        relationshipId: 'rel-lab-interpretation-derived',
        type: 'derived_from',
        sourceNodeId: 'ex-lab-interpretation',
        targetNodeId: 'ex-lab-value',
        cardinality: 'one_to_one',
        description: 'Interpretation is derived from measured value.'
      }
    ],
    metadata: {
      tags: ['laboratory', 'splash-hierarchical', 'reference-model-ready'],
      operationalProfile: {
        writeMode: 'append_only',
        readPatterns: ['timeline', 'latest'],
        queryAxes: ['subject', 'encounter', 'analyteCode'],
        optimizedPaths: [
          '/root/subjectContext/subjectId',
          '/root/laboratoryReport/events/event/eventTime',
          '/root/laboratoryReport/events/event/analyte/analyteCode'
        ]
      }
    }
  }
];

export function getStarterExampleById(exampleId) {
  if (!exampleId) return null;
  return STARTER_EXAMPLES.find((item) => item.id === exampleId) || null;
}
