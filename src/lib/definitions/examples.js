// Example Semantic Objects for demonstration
import { generateNodeId, nodesToJsonSchema } from './types';

/**
 * Creates a Patient Allergy example
 */
export function createPatientAllergyExample() {
  const rootId = generateNodeId();
  const allergenId = generateNodeId();
  const reactionId = generateNodeId();
  const severityId = generateNodeId();
  const onsetDateId = generateNodeId();
  const verifiedById = generateNodeId();
  const statusId = generateNodeId();
  const notesId = generateNodeId();

  const nodes = [
    {
      nodeId: rootId,
      name: 'Patient Allergy',
      attribute: 'root',
      description: 'Root of the Patient Allergy object',
      parentNodeId: null,
      dataType: 'object',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [allergenId, reactionId, severityId, onsetDateId, verifiedById, statusId, notesId],
      canonicalPath: `/root[${rootId}]`
    },
    {
      nodeId: allergenId,
      name: 'Allergen',
      attribute: 'allergen',
      description: 'The substance causing the allergic reaction',
      parentNodeId: rootId,
      dataType: 'string',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/allergen[${allergenId}]`
    },
    {
      nodeId: reactionId,
      name: 'Reaction Type',
      attribute: 'reactionType',
      description: 'Type of allergic reaction (e.g., rash, anaphylaxis)',
      parentNodeId: rootId,
      dataType: 'string',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/reactionType[${reactionId}]`
    },
    {
      nodeId: severityId,
      name: 'Severity',
      attribute: 'severity',
      description: 'Severity level: mild, moderate, severe, life-threatening',
      parentNodeId: rootId,
      dataType: 'code',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/severity[${severityId}]`
    },
    {
      nodeId: onsetDateId,
      name: 'Onset Date',
      attribute: 'onsetDate',
      description: 'When the allergy was first identified',
      parentNodeId: rootId,
      dataType: 'date',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/onsetDate[${onsetDateId}]`
    },
    {
      nodeId: verifiedById,
      name: 'Verified By',
      attribute: 'verifiedBy',
      description: 'Healthcare provider who verified the allergy',
      parentNodeId: rootId,
      dataType: 'string',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/verifiedBy[${verifiedById}]`
    },
    {
      nodeId: statusId,
      name: 'Status',
      attribute: 'status',
      description: 'Current status: active, inactive, resolved',
      parentNodeId: rootId,
      dataType: 'code',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/status[${statusId}]`
    },
    {
      nodeId: notesId,
      name: 'Clinical Notes',
      attribute: 'clinicalNotes',
      description: 'Additional clinical notes about the allergy',
      parentNodeId: rootId,
      dataType: 'string',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/clinicalNotes[${notesId}]`
    }
  ];

  return {
    id: 'example-patient-allergy',
    kind: 'archetype',
    origin: 'custom',
    externalId: null,
    name: 'Patient Allergy',
    description: 'Records patient allergies including allergen, reaction type, severity, and clinical notes',
    rmType: null,
    version: '1.0.0',
    status: 'active',
    definitionFormat: 'INTERNAL-JSON',
    definition: nodesToJsonSchema(nodes),
    slots: [],
    nodes,
    metadata: {
      tags: ['allergy', 'patient-safety', 'clinical'],
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * Creates a Medication Order example
 */
export function createMedicationOrderExample() {
  const rootId = generateNodeId();
  const medicationNameId = generateNodeId();
  const doseId = generateNodeId();
  const doseUnitId = generateNodeId();
  const frequencyId = generateNodeId();
  const routeId = generateNodeId();
  const startDateId = generateNodeId();
  const endDateId = generateNodeId();
  const prescriberId = generateNodeId();
  const indicationId = generateNodeId();
  const instructionsId = generateNodeId();

  const nodes = [
    {
      nodeId: rootId,
      name: 'Medication Order',
      attribute: 'root',
      description: 'Root of the Medication Order object',
      parentNodeId: null,
      dataType: 'object',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [medicationNameId, doseId, doseUnitId, frequencyId, routeId, startDateId, endDateId, prescriberId, indicationId, instructionsId],
      canonicalPath: `/root[${rootId}]`
    },
    {
      nodeId: medicationNameId,
      name: 'Medication Name',
      attribute: 'medicationName',
      description: 'Name of the medication',
      parentNodeId: rootId,
      dataType: 'string',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/medicationName[${medicationNameId}]`
    },
    {
      nodeId: doseId,
      name: 'Dose Amount',
      attribute: 'doseAmount',
      description: 'Numeric dose amount',
      parentNodeId: rootId,
      dataType: 'number',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/doseAmount[${doseId}]`
    },
    {
      nodeId: doseUnitId,
      name: 'Dose Unit',
      attribute: 'doseUnit',
      description: 'Unit of measurement (mg, ml, etc.)',
      parentNodeId: rootId,
      dataType: 'string',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/doseUnit[${doseUnitId}]`
    },
    {
      nodeId: frequencyId,
      name: 'Frequency',
      attribute: 'frequency',
      description: 'How often the medication is taken (e.g., BID, TID, Q8H)',
      parentNodeId: rootId,
      dataType: 'string',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/frequency[${frequencyId}]`
    },
    {
      nodeId: routeId,
      name: 'Route',
      attribute: 'route',
      description: 'Route of administration (oral, IV, IM, etc.)',
      parentNodeId: rootId,
      dataType: 'code',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/route[${routeId}]`
    },
    {
      nodeId: startDateId,
      name: 'Start Date',
      attribute: 'startDate',
      description: 'When to start the medication',
      parentNodeId: rootId,
      dataType: 'date',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/startDate[${startDateId}]`
    },
    {
      nodeId: endDateId,
      name: 'End Date',
      attribute: 'endDate',
      description: 'When to stop the medication (if applicable)',
      parentNodeId: rootId,
      dataType: 'date',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/endDate[${endDateId}]`
    },
    {
      nodeId: prescriberId,
      name: 'Prescriber',
      attribute: 'prescriber',
      description: 'Healthcare provider who prescribed the medication',
      parentNodeId: rootId,
      dataType: 'string',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/prescriber[${prescriberId}]`
    },
    {
      nodeId: indicationId,
      name: 'Indication',
      attribute: 'indication',
      description: 'Medical reason for prescribing',
      parentNodeId: rootId,
      dataType: 'string',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/indication[${indicationId}]`
    },
    {
      nodeId: instructionsId,
      name: 'Special Instructions',
      attribute: 'specialInstructions',
      description: 'Additional instructions (take with food, etc.)',
      parentNodeId: rootId,
      dataType: 'string',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/specialInstructions[${instructionsId}]`
    }
  ];

  return {
    id: 'example-medication-order',
    kind: 'archetype',
    origin: 'custom',
    externalId: null,
    name: 'Medication Order',
    description: 'Captures medication prescription details including dosage, frequency, route, and prescriber information',
    rmType: null,
    version: '1.0.0',
    status: 'active',
    definitionFormat: 'INTERNAL-JSON',
    definition: nodesToJsonSchema(nodes),
    slots: [],
    nodes,
    metadata: {
      tags: ['medication', 'prescription', 'pharmacy'],
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * Creates a Vital Signs example with nested structure
 */
export function createVitalSignsExample() {
  const rootId = generateNodeId();
  const measurementDateId = generateNodeId();
  const bloodPressureId = generateNodeId();
  const systolicId = generateNodeId();
  const diastolicId = generateNodeId();
  const heartRateId = generateNodeId();
  const temperatureId = generateNodeId();
  const tempValueId = generateNodeId();
  const tempUnitId = generateNodeId();
  const respiratoryRateId = generateNodeId();
  const oxygenSaturationId = generateNodeId();
  const recordedById = generateNodeId();

  const nodes = [
    {
      nodeId: rootId,
      name: 'Vital Signs',
      attribute: 'root',
      description: 'Root of the Vital Signs object',
      parentNodeId: null,
      dataType: 'object',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [measurementDateId, bloodPressureId, heartRateId, temperatureId, respiratoryRateId, oxygenSaturationId, recordedById],
      canonicalPath: `/root[${rootId}]`
    },
    {
      nodeId: measurementDateId,
      name: 'Measurement Date/Time',
      attribute: 'measurementDateTime',
      description: 'When the vital signs were measured',
      parentNodeId: rootId,
      dataType: 'date',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/measurementDateTime[${measurementDateId}]`
    },
    {
      nodeId: bloodPressureId,
      name: 'Blood Pressure',
      attribute: 'bloodPressure',
      description: 'Blood pressure measurement',
      parentNodeId: rootId,
      dataType: 'object',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [systolicId, diastolicId],
      canonicalPath: `/root[${rootId}]/bloodPressure[${bloodPressureId}]`
    },
    {
      nodeId: systolicId,
      name: 'Systolic',
      attribute: 'systolic',
      description: 'Systolic blood pressure in mmHg',
      parentNodeId: bloodPressureId,
      dataType: 'number',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/bloodPressure[${bloodPressureId}]/systolic[${systolicId}]`
    },
    {
      nodeId: diastolicId,
      name: 'Diastolic',
      attribute: 'diastolic',
      description: 'Diastolic blood pressure in mmHg',
      parentNodeId: bloodPressureId,
      dataType: 'number',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/bloodPressure[${bloodPressureId}]/diastolic[${diastolicId}]`
    },
    {
      nodeId: heartRateId,
      name: 'Heart Rate',
      attribute: 'heartRate',
      description: 'Heart rate in beats per minute',
      parentNodeId: rootId,
      dataType: 'number',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/heartRate[${heartRateId}]`
    },
    {
      nodeId: temperatureId,
      name: 'Temperature',
      attribute: 'temperature',
      description: 'Body temperature measurement',
      parentNodeId: rootId,
      dataType: 'object',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [tempValueId, tempUnitId],
      canonicalPath: `/root[${rootId}]/temperature[${temperatureId}]`
    },
    {
      nodeId: tempValueId,
      name: 'Value',
      attribute: 'value',
      description: 'Temperature value',
      parentNodeId: temperatureId,
      dataType: 'number',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/temperature[${temperatureId}]/value[${tempValueId}]`
    },
    {
      nodeId: tempUnitId,
      name: 'Unit',
      attribute: 'unit',
      description: 'Temperature unit (Celsius or Fahrenheit)',
      parentNodeId: temperatureId,
      dataType: 'code',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/temperature[${temperatureId}]/unit[${tempUnitId}]`
    },
    {
      nodeId: respiratoryRateId,
      name: 'Respiratory Rate',
      attribute: 'respiratoryRate',
      description: 'Breaths per minute',
      parentNodeId: rootId,
      dataType: 'number',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/respiratoryRate[${respiratoryRateId}]`
    },
    {
      nodeId: oxygenSaturationId,
      name: 'Oxygen Saturation',
      attribute: 'oxygenSaturation',
      description: 'SpO2 percentage',
      parentNodeId: rootId,
      dataType: 'number',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/oxygenSaturation[${oxygenSaturationId}]`
    },
    {
      nodeId: recordedById,
      name: 'Recorded By',
      attribute: 'recordedBy',
      description: 'Person who recorded the vital signs',
      parentNodeId: rootId,
      dataType: 'string',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/recordedBy[${recordedById}]`
    }
  ];

  return {
    id: 'example-vital-signs',
    kind: 'archetype',
    origin: 'custom',
    externalId: null,
    name: 'Vital Signs',
    description: 'Records patient vital signs including blood pressure, heart rate, temperature, respiratory rate, and oxygen saturation',
    rmType: null,
    version: '1.0.0',
    status: 'active',
    definitionFormat: 'INTERNAL-JSON',
    definition: nodesToJsonSchema(nodes),
    slots: [],
    nodes,
    metadata: {
      tags: ['vitals', 'clinical', 'monitoring'],
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * Creates a Lab Result example
 */
export function createLabResultExample() {
  const rootId = generateNodeId();
  const testNameId = generateNodeId();
  const testCodeId = generateNodeId();
  const valueId = generateNodeId();
  const unitId = generateNodeId();
  const referenceRangeId = generateNodeId();
  const rangeMinId = generateNodeId();
  const rangeMaxId = generateNodeId();
  const interpretationId = generateNodeId();
  const collectionDateId = generateNodeId();
  const resultDateId = generateNodeId();
  const specimenTypeId = generateNodeId();
  const labId = generateNodeId();

  const nodes = [
    {
      nodeId: rootId,
      name: 'Lab Result',
      attribute: 'root',
      description: 'Root of the Lab Result object',
      parentNodeId: null,
      dataType: 'object',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [testNameId, testCodeId, valueId, unitId, referenceRangeId, interpretationId, collectionDateId, resultDateId, specimenTypeId, labId],
      canonicalPath: `/root[${rootId}]`
    },
    {
      nodeId: testNameId,
      name: 'Test Name',
      attribute: 'testName',
      description: 'Name of the laboratory test',
      parentNodeId: rootId,
      dataType: 'string',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/testName[${testNameId}]`
    },
    {
      nodeId: testCodeId,
      name: 'Test Code',
      attribute: 'testCode',
      description: 'LOINC or other standard code for the test',
      parentNodeId: rootId,
      dataType: 'code',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/testCode[${testCodeId}]`
    },
    {
      nodeId: valueId,
      name: 'Result Value',
      attribute: 'resultValue',
      description: 'Numeric or text result value',
      parentNodeId: rootId,
      dataType: 'quantity',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/resultValue[${valueId}]`
    },
    {
      nodeId: unitId,
      name: 'Unit',
      attribute: 'unit',
      description: 'Unit of measurement',
      parentNodeId: rootId,
      dataType: 'string',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/unit[${unitId}]`
    },
    {
      nodeId: referenceRangeId,
      name: 'Reference Range',
      attribute: 'referenceRange',
      description: 'Normal reference range for the test',
      parentNodeId: rootId,
      dataType: 'object',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [rangeMinId, rangeMaxId],
      canonicalPath: `/root[${rootId}]/referenceRange[${referenceRangeId}]`
    },
    {
      nodeId: rangeMinId,
      name: 'Minimum',
      attribute: 'min',
      description: 'Minimum normal value',
      parentNodeId: referenceRangeId,
      dataType: 'number',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/referenceRange[${referenceRangeId}]/min[${rangeMinId}]`
    },
    {
      nodeId: rangeMaxId,
      name: 'Maximum',
      attribute: 'max',
      description: 'Maximum normal value',
      parentNodeId: referenceRangeId,
      dataType: 'number',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/referenceRange[${referenceRangeId}]/max[${rangeMaxId}]`
    },
    {
      nodeId: interpretationId,
      name: 'Interpretation',
      attribute: 'interpretation',
      description: 'Clinical interpretation (normal, high, low, critical)',
      parentNodeId: rootId,
      dataType: 'code',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/interpretation[${interpretationId}]`
    },
    {
      nodeId: collectionDateId,
      name: 'Collection Date',
      attribute: 'collectionDate',
      description: 'When the specimen was collected',
      parentNodeId: rootId,
      dataType: 'date',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/collectionDate[${collectionDateId}]`
    },
    {
      nodeId: resultDateId,
      name: 'Result Date',
      attribute: 'resultDate',
      description: 'When the result was available',
      parentNodeId: rootId,
      dataType: 'date',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/resultDate[${resultDateId}]`
    },
    {
      nodeId: specimenTypeId,
      name: 'Specimen Type',
      attribute: 'specimenType',
      description: 'Type of specimen (blood, urine, etc.)',
      parentNodeId: rootId,
      dataType: 'code',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/specimenType[${specimenTypeId}]`
    },
    {
      nodeId: labId,
      name: 'Laboratory',
      attribute: 'laboratory',
      description: 'Name of the laboratory that performed the test',
      parentNodeId: rootId,
      dataType: 'string',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/laboratory[${labId}]`
    }
  ];

  return {
    id: 'example-lab-result',
    kind: 'archetype',
    origin: 'custom',
    externalId: null,
    name: 'Lab Result',
    description: 'Records laboratory test results including test details, values, reference ranges, and interpretation',
    rmType: null,
    version: '1.0.0',
    status: 'active',
    definitionFormat: 'INTERNAL-JSON',
    definition: nodesToJsonSchema(nodes),
    slots: [],
    nodes,
    metadata: {
      tags: ['laboratory', 'diagnostic', 'results'],
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * Creates a Patient Demographics example
 */
export function createPatientDemographicsExample() {
  const rootId = generateNodeId();
  const patientIdId = generateNodeId();
  const nameId = generateNodeId();
  const firstNameId = generateNodeId();
  const lastNameId = generateNodeId();
  const middleNameId = generateNodeId();
  const dobId = generateNodeId();
  const genderId = generateNodeId();
  const contactId = generateNodeId();
  const phoneId = generateNodeId();
  const emailId = generateNodeId();
  const addressId = generateNodeId();
  const streetId = generateNodeId();
  const cityId = generateNodeId();
  const stateId = generateNodeId();
  const zipId = generateNodeId();

  const nodes = [
    {
      nodeId: rootId,
      name: 'Patient Demographics',
      attribute: 'root',
      description: 'Root of the Patient Demographics object',
      parentNodeId: null,
      dataType: 'object',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [patientIdId, nameId, dobId, genderId, contactId, addressId],
      canonicalPath: `/root[${rootId}]`
    },
    {
      nodeId: patientIdId,
      name: 'Patient ID',
      attribute: 'patientId',
      description: 'Unique patient identifier',
      parentNodeId: rootId,
      dataType: 'string',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/patientId[${patientIdId}]`
    },
    {
      nodeId: nameId,
      name: 'Name',
      attribute: 'name',
      description: 'Patient full name',
      parentNodeId: rootId,
      dataType: 'object',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [firstNameId, lastNameId, middleNameId],
      canonicalPath: `/root[${rootId}]/name[${nameId}]`
    },
    {
      nodeId: firstNameId,
      name: 'First Name',
      attribute: 'firstName',
      description: 'Patient first/given name',
      parentNodeId: nameId,
      dataType: 'string',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/name[${nameId}]/firstName[${firstNameId}]`
    },
    {
      nodeId: lastNameId,
      name: 'Last Name',
      attribute: 'lastName',
      description: 'Patient last/family name',
      parentNodeId: nameId,
      dataType: 'string',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/name[${nameId}]/lastName[${lastNameId}]`
    },
    {
      nodeId: middleNameId,
      name: 'Middle Name',
      attribute: 'middleName',
      description: 'Patient middle name (optional)',
      parentNodeId: nameId,
      dataType: 'string',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/name[${nameId}]/middleName[${middleNameId}]`
    },
    {
      nodeId: dobId,
      name: 'Date of Birth',
      attribute: 'dateOfBirth',
      description: 'Patient date of birth',
      parentNodeId: rootId,
      dataType: 'date',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/dateOfBirth[${dobId}]`
    },
    {
      nodeId: genderId,
      name: 'Gender',
      attribute: 'gender',
      description: 'Patient gender',
      parentNodeId: rootId,
      dataType: 'code',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/gender[${genderId}]`
    },
    {
      nodeId: contactId,
      name: 'Contact Information',
      attribute: 'contact',
      description: 'Patient contact details',
      parentNodeId: rootId,
      dataType: 'object',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [phoneId, emailId],
      canonicalPath: `/root[${rootId}]/contact[${contactId}]`
    },
    {
      nodeId: phoneId,
      name: 'Phone Number',
      attribute: 'phone',
      description: 'Primary phone number',
      parentNodeId: contactId,
      dataType: 'string',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/contact[${contactId}]/phone[${phoneId}]`
    },
    {
      nodeId: emailId,
      name: 'Email',
      attribute: 'email',
      description: 'Email address',
      parentNodeId: contactId,
      dataType: 'string',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/contact[${contactId}]/email[${emailId}]`
    },
    {
      nodeId: addressId,
      name: 'Address',
      attribute: 'address',
      description: 'Patient home address',
      parentNodeId: rootId,
      dataType: 'object',
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: [streetId, cityId, stateId, zipId],
      canonicalPath: `/root[${rootId}]/address[${addressId}]`
    },
    {
      nodeId: streetId,
      name: 'Street',
      attribute: 'street',
      description: 'Street address',
      parentNodeId: addressId,
      dataType: 'string',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/address[${addressId}]/street[${streetId}]`
    },
    {
      nodeId: cityId,
      name: 'City',
      attribute: 'city',
      description: 'City name',
      parentNodeId: addressId,
      dataType: 'string',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/address[${addressId}]/city[${cityId}]`
    },
    {
      nodeId: stateId,
      name: 'State',
      attribute: 'state',
      description: 'State or province',
      parentNodeId: addressId,
      dataType: 'string',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/address[${addressId}]/state[${stateId}]`
    },
    {
      nodeId: zipId,
      name: 'ZIP Code',
      attribute: 'zipCode',
      description: 'Postal/ZIP code',
      parentNodeId: addressId,
      dataType: 'string',
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: [],
      canonicalPath: `/root[${rootId}]/address[${addressId}]/zipCode[${zipId}]`
    }
  ];

  return {
    id: 'example-patient-demographics',
    kind: 'archetype',
    origin: 'custom',
    externalId: null,
    name: 'Patient Demographics',
    description: 'Comprehensive patient demographic information including name, contact details, and address',
    rmType: null,
    version: '1.0.0',
    status: 'active',
    definitionFormat: 'INTERNAL-JSON',
    definition: nodesToJsonSchema(nodes),
    slots: [],
    nodes,
    metadata: {
      tags: ['patient', 'demographics', 'administrative'],
      createdBy: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };
}

/**
 * Get all example definitions
 */
export function getAllExamples() {
  return [
    createPatientAllergyExample(),
    createMedicationOrderExample(),
    createVitalSignsExample(),
    createLabResultExample(),
    createPatientDemographicsExample()
  ];
}
