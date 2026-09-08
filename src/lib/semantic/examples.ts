// examples.ts — ContextObjects (co/1) examples with reusable blocks

import {
  // Keep the same names to reduce churn; your updated ./types
  // should alias these to the new CO/CONode types.
  SemanticObject,
  SemanticNode,
  ContextObject,
  ContextSubject,
  ContextInterval
} from './types';

/** Stable node IDs for UI authoring / debug paths */
function generateNodeId(): string {
  return 'n-' + Math.random().toString(36).substr(2, 9);
}

/* ============================================================================
   Reusable Building Block: Analyte Result
   ---------------------------------------------------------------------------
   Scope: building_block
   ID:    AnalyteResult (v1.0.0)
   This is referenced from LabResultPanel via a node with role="block".
============================================================================ */

export function createAnalyteResultBlock(): SemanticObject {
  const rootId = generateNodeId();
  const analyteNameId = generateNodeId();
  const analyteValueId = generateNodeId();
  const analyteUnitId = generateNodeId();
  const refRangeId = generateNodeId();
  const refLowId = generateNodeId();
  const refHighId = generateNodeId();

  const nodes: SemanticNode[] = [
    {
      nodeId: rootId,
      parentNodeId: null,
      childrenNodeIds: [analyteNameId, analyteValueId, analyteUnitId, refRangeId],
      role: 'group',
      name: 'Analyte Result',
      attribute: 'analyte',
      dataType: 'object',
      occurrences: { min: 1, max: 1 },
      description: 'Single lab test result (name, value, unit, optional range)'
    },
    {
      nodeId: analyteNameId,
      parentNodeId: rootId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Analyte Name',
      attribute: 'analyteName',
      dataType: 'code',
      occurrences: { min: 1, max: 1 },
      description: 'LOINC code for the specific analyte',
      terminologyBindings: [
        { system: 'LOINC', code: '2093-3', display: 'Cholesterol [Mass/volume] in Serum or Plasma' },
        { system: 'LOINC', code: '2571-8', display: 'Triglyceride [Mass/volume] in Serum or Plasma' }
      ],
      structuralBindings: [
        { model: 'FHIR', path: 'Observation.code.coding[0].code' },
        { model: 'openEHR', path: '/content[openEHR-EHR-OBSERVATION.laboratory_test_result.v1]/data/events/data/items[at0001]/value/defining_code' }
      ]
    },
    {
      nodeId: analyteValueId,
      parentNodeId: rootId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Value',
      attribute: 'value',
      dataType: 'quantity',
      occurrences: { min: 1, max: 1 },
      constraints: { minValue: 0, maxValue: 1000 },
      structuralBindings: [{ model: 'FHIR', path: 'Observation.valueQuantity.value' }]
    },
    {
      nodeId: analyteUnitId,
      parentNodeId: rootId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Unit',
      attribute: 'unit',
      dataType: 'code',
      occurrences: { min: 1, max: 1 },
      description: 'Unit of measurement (UCUM)',
      constraints: { allowedValues: ['mg/dL', 'mmol/L', 'g/L'] },
      terminologyBindings: [{ system: 'UCUM', code: 'mg/dL', display: 'milligrams per deciliter' }]
    },
    {
      nodeId: refRangeId,
      parentNodeId: rootId,
      childrenNodeIds: [refLowId, refHighId],
      role: 'group',
      name: 'Reference Range',
      attribute: 'referenceRange',
      dataType: 'object',
      occurrences: { min: 0, max: 1 },
      description: 'Normal reference range'
    },
    {
      nodeId: refLowId,
      parentNodeId: refRangeId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Low',
      attribute: 'low',
      dataType: 'number',
      occurrences: { min: 0, max: 1 }
    },
    {
      nodeId: refHighId,
      parentNodeId: refRangeId,
      childrenNodeIds: [],
      role: 'field',
      name: 'High',
      attribute: 'high',
      dataType: 'number',
      occurrences: { min: 0, max: 1 }
    }
  ];

  return {
    id: 'AnalyteResult',
    name: 'Analyte Result',
    description: 'Reusable analyte result building block',
    scope: 'building_block',
    origin: 'custom',
    version: '1.0.0',
    status: 'active',
    schema: { version: 'co/1', pathDialect: 'coql/v1' },
    nodes,
    metadata: {
      tags: ['lab', 'analyte', 'building-block'],
      createdBy: 'system',
      createdAt: new Date().toISOString()
    }
  };
}

/* ============================================================================
   Semantic Definition: Laboratory Result Panel (uses the block above)
============================================================================ */

export function createLabResultPanelDefinition(): SemanticObject {
  const rootId = generateNodeId();
  const patientRefId = generateNodeId();
  const panelCodeId = generateNodeId();
  const eventSeriesId = generateNodeId();
  const eventId = generateNodeId();
  const eventTimeId = generateNodeId();
  const analytesArrayId = generateNodeId();
  const statusId = generateNodeId();
  const performerId = generateNodeId();
  const notesId = generateNodeId();

  const nodes: SemanticNode[] = [
    {
      nodeId: rootId,
      parentNodeId: null,
      childrenNodeIds: [patientRefId, panelCodeId, eventSeriesId],
      role: 'section',
      name: 'Laboratory Result Panel',
      attribute: 'labPanel',
      dataType: 'object',
      occurrences: { min: 1, max: 1 },
      description: 'Complete laboratory test panel with multiple analytes over time'
    },
    {
      nodeId: patientRefId,
      parentNodeId: rootId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Patient Reference',
      attribute: 'patientRef',
      dataType: 'reference',
      occurrences: { min: 1, max: 1 },
      terminologyBindings: [{ system: 'FHIR', code: 'Patient', display: 'Patient Resource Reference' }]
    },
    {
      nodeId: panelCodeId,
      parentNodeId: rootId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Panel Code',
      attribute: 'panelCode',
      dataType: 'code',
      occurrences: { min: 1, max: 1 },
      description: 'LOINC code identifying the lab panel',
      terminologyBindings: [{ system: 'LOINC', code: '24331-1', display: 'Lipid panel - Serum or Plasma' }],
      constraints: { pattern: '^[0-9]{4,5}-[0-9]$' }
    },
    {
      nodeId: eventSeriesId,
      parentNodeId: rootId,
      childrenNodeIds: [eventId],
      role: 'event_series',
      name: 'Observation Events',
      attribute: 'events',
      dataType: 'array',
      occurrences: { min: 1, max: '*' },
      description: 'Series of observation events, each with timestamp and measurements'
    },
    {
      nodeId: eventId,
      parentNodeId: eventSeriesId,
      childrenNodeIds: [eventTimeId, analytesArrayId, statusId, performerId, notesId],
      role: 'event',
      name: 'Observation Event',
      attribute: 'event',
      dataType: 'object',
      occurrences: { min: 1, max: 1 },
      description: 'Single observation event with timestamp'
    },
    {
      nodeId: eventTimeId,
      parentNodeId: eventId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Event Time',
      attribute: 'eventTime',
      dataType: 'datetime',
      occurrences: { min: 1, max: 1 },
      timeRole: 'timestamp',
      description: 'When this observation was taken'
    },
    {
      nodeId: analytesArrayId,
      parentNodeId: eventId,
      // IMPORTANT: model the array, items are blocks
      childrenNodeIds: [],
      role: 'group',
      name: 'Analytes',
      attribute: 'analytes',
      dataType: 'array',
      occurrences: { min: 1, max: '*' },
      description: 'Individual analyte measurements (items reference a reusable block)',
      // Each array item is a block reference. The UI will render this as
      // an items-spec using role:"block" with blockId on the item.
      // We encode that by setting role:"block" in an implicit child spec:
      // in your UI/types this is represented as "itemSpec".
      itemSpec: {
        role: 'block',
        name: 'Analyte Result',
        attribute: 'analyte',
        dataType: 'object',
        occurrences: { min: 1, max: 1 },
        blockId: 'AnalyteResult',
        versionRange: '^1.0.0'
      } as unknown as SemanticNode
    },
    {
      nodeId: statusId,
      parentNodeId: eventId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Result Status',
      attribute: 'status',
      dataType: 'code',
      occurrences: { min: 1, max: 1 },
      constraints: { allowedValues: ['preliminary', 'final', 'amended', 'corrected', 'cancelled'] },
      terminologyBindings: [{ system: 'FHIR', code: 'ObservationStatus', display: 'Observation Status Code System' }]
    },
    {
      nodeId: performerId,
      parentNodeId: eventId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Performed By',
      attribute: 'performer',
      dataType: 'reference',
      occurrences: { min: 0, max: 1 },
      description: 'Laboratory or practitioner who performed the test'
    },
    {
      nodeId: notesId,
      parentNodeId: eventId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Clinical Notes',
      attribute: 'notes',
      dataType: 'string',
      occurrences: { min: 0, max: 1 },
      constraints: { maxLength: 1000 }
    }
  ];

  return {
    id: 'LabResultPanel',
    name: 'Laboratory Result Panel',
    description: 'Comprehensive laboratory test panel supporting multiple analytes, temporal observations, and full FHIR/openEHR bindings',
    scope: 'business_object',
    origin: 'custom',
    version: '1.2.0',
    status: 'active',
    schema: { version: 'co/1', pathDialect: 'coql/v1' },
    nodes,
    terminologyBindings: [{ system: 'SNOMED-CT', code: '117015009', display: 'Laboratory test finding (finding)' }],
    metadata: {
      tags: ['laboratory', 'observation', 'clinical', 'FHIR', 'openEHR'],
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

/* ============================================================================
   Example ContextObject instance (open class) that conforms to the panel
============================================================================ */

export function createLabResultContextInstance(): ContextObject {
  return {
    id: 'ctx-550e8400-e29b-41d4-a716-446655440001',
    path: '/ehr/compositions/lab_results/2024-01-15/001',

    semanticObjectId: 'LabResultPanel',
    semanticObjectVersion: '1.2.0',

    subjects: [
      { type: 'patient', id: 'Patient/12345', name: 'John Doe', mrn: 'MRN-12345-67890' } as ContextSubject
    ],

    interval: { start: '2024-01-15T08:30:00Z', end: '2024-01-15T08:45:00Z' } as ContextInterval,

    labPanel: {
      patientRef: 'Patient/12345',
      panelCode: '24331-1',
      events: [
        {
          event: {
            eventTime: '2024-01-15T08:30:00Z',
            analytes: [
              {
                // Block instance shape from AnalyteResult
                analyte: {
                  analyteName: '2093-3',
                  value: 195,
                  unit: 'mg/dL',
                  referenceRange: { low: 125, high: 200 }
                }
              },
              {
                analyte: {
                  analyteName: '2571-8',
                  value: 150,
                  unit: 'mg/dL',
                  referenceRange: { low: 0, high: 150 }
                }
              }
            ],
            status: 'final',
            performer: 'Organization/lab-123',
            notes: 'Fasting sample. Results within normal limits.'
          }
        }
      ]
    },

    orderingPhysician: 'Dr. Smith',
    facility: 'General Hospital Lab',
    accessionNumber: 'LAB-2024-001234',
    priority: 'routine',
    reportedAt: '2024-01-15T09:00:00Z',
    verified: true,
    verifiedBy: 'Dr. Johnson',
    comments: 'Patient was fasting for 12 hours prior to test',

    createdBy: 'lab-system-001',
    createdAt: '2024-01-15T08:45:00Z',
    updatedAt: '2024-01-15T09:00:00Z'
  };
}

/* ============================================================================
   Another reusable block: Vital Signs (unchanged concept, updated meta)
============================================================================ */

export function createVitalSignsBuildingBlock(): SemanticObject {
  const rootId = generateNodeId();
  const bpSystolicId = generateNodeId();
  const bpDiastolicId = generateNodeId();
  const heartRateId = generateNodeId();
  const temperatureId = generateNodeId();
  const measurementTimeId = generateNodeId();

  const nodes: SemanticNode[] = [
    {
      nodeId: rootId,
      parentNodeId: null,
      childrenNodeIds: [bpSystolicId, bpDiastolicId, heartRateId, temperatureId, measurementTimeId],
      role: 'group',
      name: 'Vital Signs',
      attribute: 'vitalSigns',
      dataType: 'object',
      occurrences: { min: 1, max: 1 },
      description: 'Basic vital signs measurements'
    },
    {
      nodeId: bpSystolicId,
      parentNodeId: rootId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Blood Pressure Systolic',
      attribute: 'bpSystolic',
      dataType: 'quantity',
      occurrences: { min: 0, max: 1 },
      terminologyBindings: [{ system: 'LOINC', code: '8480-6', display: 'Systolic blood pressure' }],
      constraints: { minValue: 50, maxValue: 250 }
    },
    {
      nodeId: bpDiastolicId,
      parentNodeId: rootId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Blood Pressure Diastolic',
      attribute: 'bpDiastolic',
      dataType: 'quantity',
      occurrences: { min: 0, max: 1 },
      terminologyBindings: [{ system: 'LOINC', code: '8462-4', display: 'Diastolic blood pressure' }],
      constraints: { minValue: 30, maxValue: 150 }
    },
    {
      nodeId: heartRateId,
      parentNodeId: rootId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Heart Rate',
      attribute: 'heartRate',
      dataType: 'quantity',
      occurrences: { min: 0, max: 1 },
      terminologyBindings: [{ system: 'LOINC', code: '8867-4', display: 'Heart rate' }],
      constraints: { minValue: 30, maxValue: 250 }
    },
    {
      nodeId: temperatureId,
      parentNodeId: rootId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Body Temperature',
      attribute: 'temperature',
      dataType: 'quantity',
      occurrences: { min: 0, max: 1 },
      terminologyBindings: [{ system: 'LOINC', code: '8310-5', display: 'Body temperature' }],
      constraints: { minValue: 35.0, maxValue: 42.0 }
    },
    {
      nodeId: measurementTimeId,
      parentNodeId: rootId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Measurement Time',
      attribute: 'measurementTime',
      dataType: 'datetime',
      occurrences: { min: 1, max: 1 },
      timeRole: 'timestamp'
    }
  ];

  return {
    id: 'VitalSigns',
    name: 'Vital Signs',
    description: 'Reusable vital signs building block',
    scope: 'building_block',
    origin: 'custom',
    version: '1.0.0',
    status: 'active',
    schema: { version: 'co/1', pathDialect: 'coql/v1' },
    nodes,
    metadata: {
      tags: ['vital-signs', 'observation', 'building-block'],
      createdBy: 'system',
      createdAt: new Date().toISOString()
    }
  };
}

/* ============================================================================
   Seed exports
============================================================================ */

export const SEMANTIC_OBJECT_EXAMPLES: SemanticObject[] = [
  createAnalyteResultBlock(),      // block goes to the library
  createVitalSignsBuildingBlock(), // another reusable block
  createLabResultPanelDefinition() // full context object uses the block
];

export const CONTEXT_OBJECT_EXAMPLES: ContextObject[] = [
  createLabResultContextInstance()
];