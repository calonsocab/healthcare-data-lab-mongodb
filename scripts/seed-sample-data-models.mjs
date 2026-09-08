#!/usr/bin/env node
/**
 * Seed Sample Data Models
 *
 * Populates the core database with sample FHIR and Context Object data models.
 * These samples appear in the Catalog's sample library for users to import.
 *
 * Usage:
 *   node scripts/seed-sample-data-models.mjs [--dry-run]
 *   node scripts/seed-sample-data-models.mjs --uri="mongodb://..." --db="openehr_core"
 *
 * Options:
 *   --dry-run    Preview what would be inserted without writing to database
 *   --uri        MongoDB connection string (or use CORE_MONGODB_URL env var)
 *   --db         Database name (or use CORE_DATABASE_NAME env var)
 *   --clear      Clear existing sample-data-models before seeding
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load .env.local from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '..', '.env.local') });

import { MongoClient } from 'mongodb';

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const clearFirst = args.includes('--clear');
const uriArg = args.find(a => a.startsWith('--uri='));
const dbArg = args.find(a => a.startsWith('--db='));

// Get and clean MongoDB URI (remove surrounding quotes if present)
// Try MONGODB_URI first since CORE_MONGODB_URL may be a variable reference
let MONGODB_URI = uriArg?.split('=')[1] || process.env.MONGODB_URI || process.env.CORE_MONGODB_URL;
if (MONGODB_URI) {
  MONGODB_URI = MONGODB_URI.replace(/^["']|["']$/g, '');
}
const MONGODB_DB = dbArg?.split('=')[1] || process.env.CORE_DATABASE_NAME || 'openehr_core';

if (!MONGODB_URI) {
  console.error('Error: MongoDB URI required. Use --uri=xxx or set CORE_MONGODB_URL env var');
  process.exit(1);
}

const COLLECTION_NAME = 'sample-data-models';

/**
 * FHIR R4 Sample Data Models
 */
const FHIR_SAMPLES = [
  {
    name: 'Patient',
    domain: 'fhir',
    modelType: 'resource',
    description: 'Demographics and administrative information about a person receiving care.',
    domainData: {
      resourceType: 'Patient',
      category: 'administrative',
      version: 'R4',
      structure: {
        identifier: { type: 'array', items: 'Identifier' },
        active: { type: 'boolean' },
        name: { type: 'array', items: 'HumanName' },
        telecom: { type: 'array', items: 'ContactPoint' },
        gender: { type: 'code', binding: 'administrative-gender' },
        birthDate: { type: 'date' },
        address: { type: 'array', items: 'Address' },
        maritalStatus: { type: 'CodeableConcept' },
        contact: { type: 'array', items: 'BackboneElement' },
        communication: { type: 'array', items: 'BackboneElement' },
        generalPractitioner: { type: 'array', items: 'Reference' },
        managingOrganization: { type: 'Reference' },
      },
    },
    metadata: {
      tags: ['administrative', 'demographics', 'core'],
      domainMetadata: {
        resourceType: 'Patient',
        category: 'administrative',
        maturityLevel: 'normative',
        fhirVersion: '4.0.1',
      },
    },
    audit: {
      createdAt: new Date(),
      createdBy: 'system',
    },
  },
  {
    name: 'Observation',
    domain: 'fhir',
    modelType: 'resource',
    description: 'Measurements and simple assertions made about a patient, device, or other subject.',
    domainData: {
      resourceType: 'Observation',
      category: 'clinical',
      version: 'R4',
      structure: {
        identifier: { type: 'array', items: 'Identifier' },
        basedOn: { type: 'array', items: 'Reference' },
        status: { type: 'code', binding: 'observation-status' },
        category: { type: 'array', items: 'CodeableConcept' },
        code: { type: 'CodeableConcept', required: true },
        subject: { type: 'Reference' },
        encounter: { type: 'Reference' },
        effectiveDateTime: { type: 'dateTime' },
        valueQuantity: { type: 'Quantity' },
        valueCodeableConcept: { type: 'CodeableConcept' },
        valueString: { type: 'string' },
        interpretation: { type: 'array', items: 'CodeableConcept' },
        referenceRange: { type: 'array', items: 'BackboneElement' },
        component: { type: 'array', items: 'BackboneElement' },
      },
    },
    metadata: {
      tags: ['clinical', 'diagnostics', 'vitals'],
      domainMetadata: {
        resourceType: 'Observation',
        category: 'clinical',
        maturityLevel: 'normative',
        fhirVersion: '4.0.1',
      },
    },
    audit: {
      createdAt: new Date(),
      createdBy: 'system',
    },
  },
  {
    name: 'Condition',
    domain: 'fhir',
    modelType: 'resource',
    description: 'Clinical condition, problem, diagnosis, or other event/situation identified as relevant.',
    domainData: {
      resourceType: 'Condition',
      category: 'clinical',
      version: 'R4',
      structure: {
        identifier: { type: 'array', items: 'Identifier' },
        clinicalStatus: { type: 'CodeableConcept' },
        verificationStatus: { type: 'CodeableConcept' },
        category: { type: 'array', items: 'CodeableConcept' },
        severity: { type: 'CodeableConcept' },
        code: { type: 'CodeableConcept' },
        bodySite: { type: 'array', items: 'CodeableConcept' },
        subject: { type: 'Reference', required: true },
        encounter: { type: 'Reference' },
        onsetDateTime: { type: 'dateTime' },
        abatementDateTime: { type: 'dateTime' },
        recordedDate: { type: 'dateTime' },
        recorder: { type: 'Reference' },
        asserter: { type: 'Reference' },
        evidence: { type: 'array', items: 'BackboneElement' },
        note: { type: 'array', items: 'Annotation' },
      },
    },
    metadata: {
      tags: ['clinical', 'problem-list', 'diagnosis'],
      domainMetadata: {
        resourceType: 'Condition',
        category: 'clinical',
        maturityLevel: 'trial-use',
        fhirVersion: '4.0.1',
      },
    },
    audit: {
      createdAt: new Date(),
      createdBy: 'system',
    },
  },
  {
    name: 'MedicationRequest',
    domain: 'fhir',
    modelType: 'resource',
    description: 'Order or request for medication, device, or other treatment.',
    domainData: {
      resourceType: 'MedicationRequest',
      category: 'clinical',
      version: 'R4',
      structure: {
        identifier: { type: 'array', items: 'Identifier' },
        status: { type: 'code', binding: 'medicationrequest-status', required: true },
        intent: { type: 'code', binding: 'medicationrequest-intent', required: true },
        category: { type: 'array', items: 'CodeableConcept' },
        priority: { type: 'code' },
        medicationCodeableConcept: { type: 'CodeableConcept' },
        medicationReference: { type: 'Reference' },
        subject: { type: 'Reference', required: true },
        encounter: { type: 'Reference' },
        authoredOn: { type: 'dateTime' },
        requester: { type: 'Reference' },
        dosageInstruction: { type: 'array', items: 'Dosage' },
        dispenseRequest: { type: 'BackboneElement' },
      },
    },
    metadata: {
      tags: ['clinical', 'pharmacy', 'prescriptions'],
      domainMetadata: {
        resourceType: 'MedicationRequest',
        category: 'clinical',
        maturityLevel: 'trial-use',
        fhirVersion: '4.0.1',
      },
    },
    audit: {
      createdAt: new Date(),
      createdBy: 'system',
    },
  },
  {
    name: 'Encounter',
    domain: 'fhir',
    modelType: 'resource',
    description: 'An interaction during which services are provided to the patient.',
    domainData: {
      resourceType: 'Encounter',
      category: 'administrative',
      version: 'R4',
      structure: {
        identifier: { type: 'array', items: 'Identifier' },
        status: { type: 'code', binding: 'encounter-status', required: true },
        class: { type: 'Coding', required: true },
        type: { type: 'array', items: 'CodeableConcept' },
        serviceType: { type: 'CodeableConcept' },
        priority: { type: 'CodeableConcept' },
        subject: { type: 'Reference' },
        participant: { type: 'array', items: 'BackboneElement' },
        period: { type: 'Period' },
        reasonCode: { type: 'array', items: 'CodeableConcept' },
        diagnosis: { type: 'array', items: 'BackboneElement' },
        hospitalization: { type: 'BackboneElement' },
        location: { type: 'array', items: 'BackboneElement' },
      },
    },
    metadata: {
      tags: ['administrative', 'visits', 'workflow'],
      domainMetadata: {
        resourceType: 'Encounter',
        category: 'administrative',
        maturityLevel: 'trial-use',
        fhirVersion: '4.0.1',
      },
    },
    audit: {
      createdAt: new Date(),
      createdBy: 'system',
    },
  },
  {
    name: 'DiagnosticReport',
    domain: 'fhir',
    modelType: 'resource',
    description: 'Findings and interpretation of diagnostic tests performed on patients.',
    domainData: {
      resourceType: 'DiagnosticReport',
      category: 'clinical',
      version: 'R4',
      structure: {
        identifier: { type: 'array', items: 'Identifier' },
        basedOn: { type: 'array', items: 'Reference' },
        status: { type: 'code', binding: 'diagnostic-report-status', required: true },
        category: { type: 'array', items: 'CodeableConcept' },
        code: { type: 'CodeableConcept', required: true },
        subject: { type: 'Reference' },
        encounter: { type: 'Reference' },
        effectiveDateTime: { type: 'dateTime' },
        issued: { type: 'instant' },
        performer: { type: 'array', items: 'Reference' },
        result: { type: 'array', items: 'Reference' },
        conclusion: { type: 'string' },
        conclusionCode: { type: 'array', items: 'CodeableConcept' },
        presentedForm: { type: 'array', items: 'Attachment' },
      },
    },
    metadata: {
      tags: ['clinical', 'diagnostics', 'labs'],
      domainMetadata: {
        resourceType: 'DiagnosticReport',
        category: 'clinical',
        maturityLevel: 'trial-use',
        fhirVersion: '4.0.1',
      },
    },
    audit: {
      createdAt: new Date(),
      createdBy: 'system',
    },
  },
  {
    name: 'Procedure',
    domain: 'fhir',
    modelType: 'resource',
    description: 'An action that is or was performed on or for a patient.',
    domainData: {
      resourceType: 'Procedure',
      category: 'clinical',
      version: 'R4',
      structure: {
        identifier: { type: 'array', items: 'Identifier' },
        status: { type: 'code', binding: 'event-status', required: true },
        category: { type: 'CodeableConcept' },
        code: { type: 'CodeableConcept' },
        subject: { type: 'Reference', required: true },
        encounter: { type: 'Reference' },
        performedDateTime: { type: 'dateTime' },
        performedPeriod: { type: 'Period' },
        performer: { type: 'array', items: 'BackboneElement' },
        location: { type: 'Reference' },
        reasonCode: { type: 'array', items: 'CodeableConcept' },
        bodySite: { type: 'array', items: 'CodeableConcept' },
        outcome: { type: 'CodeableConcept' },
        complication: { type: 'array', items: 'CodeableConcept' },
        note: { type: 'array', items: 'Annotation' },
      },
    },
    metadata: {
      tags: ['clinical', 'procedures', 'interventions'],
      domainMetadata: {
        resourceType: 'Procedure',
        category: 'clinical',
        maturityLevel: 'trial-use',
        fhirVersion: '4.0.1',
      },
    },
    audit: {
      createdAt: new Date(),
      createdBy: 'system',
    },
  },
  {
    name: 'AllergyIntolerance',
    domain: 'fhir',
    modelType: 'resource',
    description: 'Risk of harmful or undesirable physiological response to a substance.',
    domainData: {
      resourceType: 'AllergyIntolerance',
      category: 'clinical',
      version: 'R4',
      structure: {
        identifier: { type: 'array', items: 'Identifier' },
        clinicalStatus: { type: 'CodeableConcept' },
        verificationStatus: { type: 'CodeableConcept' },
        type: { type: 'code' },
        category: { type: 'array', items: 'code' },
        criticality: { type: 'code' },
        code: { type: 'CodeableConcept' },
        patient: { type: 'Reference', required: true },
        encounter: { type: 'Reference' },
        onsetDateTime: { type: 'dateTime' },
        recordedDate: { type: 'dateTime' },
        recorder: { type: 'Reference' },
        asserter: { type: 'Reference' },
        reaction: { type: 'array', items: 'BackboneElement' },
      },
    },
    metadata: {
      tags: ['clinical', 'allergies', 'safety'],
      domainMetadata: {
        resourceType: 'AllergyIntolerance',
        category: 'clinical',
        maturityLevel: 'trial-use',
        fhirVersion: '4.0.1',
      },
    },
    audit: {
      createdAt: new Date(),
      createdBy: 'system',
    },
  },
];

/**
 * Context Object Sample Data Models
 */
const CONTEXT_SAMPLES = [
  {
    name: 'Patient Clinical Summary',
    domain: 'context',
    modelType: 'business_object',
    description: 'Aggregated clinical summary providing a 360-degree view of a patient, optimized for AI retrieval.',
    domainData: {
      scope: 'business_object',
      origin: 'aggregation',
      status: 'active',
      version: '1.0.0',
      nodes: [
        {
          id: 'demographics',
          type: 'data_block',
          label: 'Demographics',
          description: 'Patient demographic information',
          fields: ['name', 'birthDate', 'gender', 'address', 'contact'],
        },
        {
          id: 'conditions',
          type: 'data_block',
          label: 'Active Conditions',
          description: 'Current diagnoses and problems',
          fields: ['code', 'status', 'onset', 'severity'],
          cardinality: 'many',
        },
        {
          id: 'medications',
          type: 'data_block',
          label: 'Current Medications',
          description: 'Active prescriptions',
          fields: ['medication', 'dosage', 'frequency', 'prescriber'],
          cardinality: 'many',
        },
        {
          id: 'allergies',
          type: 'data_block',
          label: 'Allergies',
          description: 'Known allergies and intolerances',
          fields: ['substance', 'reaction', 'severity', 'status'],
          cardinality: 'many',
        },
        {
          id: 'recent_vitals',
          type: 'data_block',
          label: 'Recent Vitals',
          description: 'Latest vital signs',
          fields: ['bloodPressure', 'heartRate', 'temperature', 'weight', 'timestamp'],
        },
        {
          id: 'ai_summary',
          type: 'ai_artifact',
          label: 'AI Summary',
          description: 'Generated clinical summary for retrieval',
          fields: ['summary', 'embedding', 'generatedAt'],
        },
      ],
    },
    metadata: {
      tags: ['patient', 'summary', 'ai-ready', '360-view'],
      domainMetadata: {
        scope: 'business_object',
        origin: 'aggregation',
        aiReady: true,
        useCases: ['patient-lookup', 'clinical-decision-support', 'rag-retrieval'],
      },
    },
    audit: {
      createdAt: new Date(),
      createdBy: 'system',
    },
  },
  {
    name: 'Care Episode',
    domain: 'context',
    modelType: 'business_object',
    description: 'Complete care episode context including encounters, treatments, and outcomes.',
    domainData: {
      scope: 'business_object',
      origin: 'aggregation',
      status: 'active',
      version: '1.0.0',
      nodes: [
        {
          id: 'episode_info',
          type: 'data_block',
          label: 'Episode Information',
          description: 'Core episode metadata',
          fields: ['episodeId', 'type', 'startDate', 'endDate', 'status'],
        },
        {
          id: 'patient_ref',
          type: 'reference',
          label: 'Patient',
          description: 'Reference to patient context',
          referenceType: 'Patient Clinical Summary',
        },
        {
          id: 'encounters',
          type: 'data_block',
          label: 'Encounters',
          description: 'Visits and interactions during episode',
          fields: ['date', 'type', 'provider', 'location', 'notes'],
          cardinality: 'many',
        },
        {
          id: 'procedures',
          type: 'data_block',
          label: 'Procedures',
          description: 'Procedures performed',
          fields: ['code', 'date', 'performer', 'outcome'],
          cardinality: 'many',
        },
        {
          id: 'outcome',
          type: 'data_block',
          label: 'Episode Outcome',
          description: 'Resolution and outcome data',
          fields: ['disposition', 'followUp', 'notes'],
        },
      ],
    },
    metadata: {
      tags: ['episode', 'care-management', 'workflow'],
      domainMetadata: {
        scope: 'business_object',
        origin: 'aggregation',
        aiReady: true,
        useCases: ['care-coordination', 'episode-tracking', 'outcomes-analysis'],
      },
    },
    audit: {
      createdAt: new Date(),
      createdBy: 'system',
    },
  },
  {
    name: 'Lab Result Context',
    domain: 'context',
    modelType: 'building_block',
    description: 'Reusable building block for laboratory result data with AI enrichment.',
    domainData: {
      scope: 'building_block',
      origin: 'design',
      status: 'active',
      version: '1.0.0',
      nodes: [
        {
          id: 'result',
          type: 'data_block',
          label: 'Result Data',
          description: 'Core lab result values',
          fields: ['testCode', 'testName', 'value', 'unit', 'referenceRange'],
        },
        {
          id: 'interpretation',
          type: 'data_block',
          label: 'Interpretation',
          description: 'Clinical interpretation flags',
          fields: ['flag', 'interpretation', 'criticalValue'],
        },
        {
          id: 'specimen',
          type: 'data_block',
          label: 'Specimen Info',
          description: 'Sample collection details',
          fields: ['type', 'collectionDate', 'receivedDate'],
        },
        {
          id: 'context',
          type: 'data_block',
          label: 'Clinical Context',
          description: 'Contextual information',
          fields: ['orderReason', 'relatedConditions', 'previousResults'],
        },
      ],
    },
    metadata: {
      tags: ['lab', 'results', 'building-block', 'diagnostics'],
      domainMetadata: {
        scope: 'building_block',
        origin: 'design',
        aiReady: true,
        useCases: ['lab-reporting', 'trend-analysis', 'alerting'],
      },
    },
    audit: {
      createdAt: new Date(),
      createdBy: 'system',
    },
  },
  {
    name: 'Medication Context',
    domain: 'context',
    modelType: 'building_block',
    description: 'Comprehensive medication context including safety checks and AI enrichment.',
    domainData: {
      scope: 'building_block',
      origin: 'design',
      status: 'active',
      version: '1.0.0',
      nodes: [
        {
          id: 'medication',
          type: 'data_block',
          label: 'Medication Details',
          description: 'Core medication information',
          fields: ['code', 'name', 'form', 'strength', 'route'],
        },
        {
          id: 'dosing',
          type: 'data_block',
          label: 'Dosing Information',
          description: 'Dosage and timing',
          fields: ['dose', 'frequency', 'duration', 'instructions'],
        },
        {
          id: 'safety',
          type: 'data_block',
          label: 'Safety Checks',
          description: 'Interaction and allergy checks',
          fields: ['interactions', 'allergyWarnings', 'contraindications'],
        },
        {
          id: 'prescriber',
          type: 'reference',
          label: 'Prescriber',
          description: 'Ordering provider reference',
        },
      ],
    },
    metadata: {
      tags: ['medication', 'pharmacy', 'building-block', 'safety'],
      domainMetadata: {
        scope: 'building_block',
        origin: 'design',
        aiReady: true,
        useCases: ['prescription-management', 'drug-interactions', 'compliance'],
      },
    },
    audit: {
      createdAt: new Date(),
      createdBy: 'system',
    },
  },
  {
    name: 'Clinical Decision Support Context',
    domain: 'context',
    modelType: 'technical',
    description: 'Context object for CDS rules engine with patient state and recommendations.',
    domainData: {
      scope: 'technical',
      origin: 'aggregation',
      status: 'active',
      version: '1.0.0',
      nodes: [
        {
          id: 'patient_state',
          type: 'data_block',
          label: 'Patient State',
          description: 'Current patient clinical state',
          fields: ['conditions', 'medications', 'recentLabs', 'vitals'],
        },
        {
          id: 'trigger',
          type: 'data_block',
          label: 'Trigger Event',
          description: 'What triggered the CDS evaluation',
          fields: ['eventType', 'eventData', 'timestamp'],
        },
        {
          id: 'rules_evaluated',
          type: 'data_block',
          label: 'Rules Evaluated',
          description: 'CDS rules that were evaluated',
          fields: ['ruleId', 'ruleName', 'result', 'confidence'],
          cardinality: 'many',
        },
        {
          id: 'recommendations',
          type: 'data_block',
          label: 'Recommendations',
          description: 'Generated clinical recommendations',
          fields: ['type', 'message', 'priority', 'evidence', 'actions'],
          cardinality: 'many',
        },
        {
          id: 'audit_trail',
          type: 'data_block',
          label: 'Audit Trail',
          description: 'Decision audit information',
          fields: ['evaluatedAt', 'evaluatedBy', 'overrideReason'],
        },
      ],
    },
    metadata: {
      tags: ['cds', 'decision-support', 'technical', 'rules'],
      domainMetadata: {
        scope: 'technical',
        origin: 'aggregation',
        aiReady: true,
        useCases: ['clinical-alerts', 'guideline-adherence', 'best-practice-reminders'],
      },
    },
    audit: {
      createdAt: new Date(),
      createdBy: 'system',
    },
  },
];

/**
 * Main seeding function
 */
async function seedSampleDataModels() {
  console.log('='.repeat(60));
  console.log('Seed Sample Data Models');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Database: ${MONGODB_DB}`);
  console.log(`Collection: ${COLLECTION_NAME}`);
  console.log('');

  const allSamples = [...FHIR_SAMPLES, ...CONTEXT_SAMPLES];

  console.log('Samples to seed:');
  console.log(`  FHIR resources: ${FHIR_SAMPLES.length}`);
  console.log(`  Context Objects: ${CONTEXT_SAMPLES.length}`);
  console.log(`  Total: ${allSamples.length}`);
  console.log('');

  if (dryRun) {
    console.log('DRY RUN - Previewing samples:');
    console.log('');

    console.log('FHIR Samples:');
    FHIR_SAMPLES.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.name} (${s.domainData.resourceType})`);
      console.log(`     ${s.description.substring(0, 60)}...`);
    });

    console.log('');
    console.log('Context Object Samples:');
    CONTEXT_SAMPLES.forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.name} (${s.domainData.scope})`);
      console.log(`     ${s.description.substring(0, 60)}...`);
    });

    console.log('');
    console.log('Run without --dry-run to insert these samples.');
    return;
  }

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(MONGODB_DB);
    const col = db.collection(COLLECTION_NAME);

    // Clear existing if requested
    if (clearFirst) {
      console.log('Clearing existing sample-data-models...');
      const deleteResult = await col.deleteMany({});
      console.log(`  Deleted ${deleteResult.deletedCount} documents`);
    }

    // Check for existing samples
    const existingNames = new Set();
    const existingDocs = await col.find({}, { projection: { name: 1 } }).toArray();
    existingDocs.forEach(doc => existingNames.add(doc.name));

    // Filter out already existing samples
    const toInsert = allSamples.filter(s => !existingNames.has(s.name));
    const skipped = allSamples.filter(s => existingNames.has(s.name));

    if (skipped.length > 0) {
      console.log(`Skipping ${skipped.length} existing samples:`);
      skipped.forEach(s => console.log(`  - ${s.name}`));
    }

    if (toInsert.length === 0) {
      console.log('');
      console.log('No new samples to insert. All samples already exist.');
      return;
    }

    console.log('');
    console.log(`Inserting ${toInsert.length} samples...`);

    // Create indexes
    await col.createIndex({ domain: 1 });
    await col.createIndex({ name: 1 });
    await col.createIndex({ domain: 1, name: 1 });
    await col.createIndex({ 'metadata.tags': 1 });

    // Insert samples
    const result = await col.insertMany(toInsert);
    console.log(`  Inserted ${result.insertedCount} documents`);

    // Verify
    const counts = await col.aggregate([
      { $group: { _id: '$domain', count: { $sum: 1 } } },
    ]).toArray();

    console.log('');
    console.log('Final counts by domain:');
    counts.forEach(c => {
      console.log(`  ${c._id}: ${c.count}`);
    });

    console.log('');
    console.log('Seeding complete!');

  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    await client.close();
    console.log('');
    console.log('Connection closed.');
  }
}

// Run seeding
seedSampleDataModels().catch(console.error);
