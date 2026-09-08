import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { getCoreDb } from '@/lib/db/coreDb';
import { enforceUserRateLimit } from '@/lib/security/rateLimit';
import { enforceApiRateLimit, resolvePolicyContext } from '@/lib/security/teamPolicy';
import { parseJsonWithLimit, PayloadTooLargeError } from '@/lib/uploads/bodyLimit';
import {
  detectDomainFromText,
  getDomainTemplate,
  sanitizeClarificationAnswers,
  normalizeModelingPreferences,
  modelingPreferencesToClarificationAnswers,
  getUnifiedClarificationQuestions,
  buildDomainPromptTemplate,
  buildAgentProcess,
  suggestReusableBlockCandidates,
  toTemplateSummary,
  prioritizeBlocksForDomain
} from '@/lib/contextObjects/agentDomainTemplates';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AI_ASSIST_MAX_BODY_BYTES = 512 * 1024; // 512KB
const AI_ASSIST_DEFAULT_RPM = 10;
const MODEL_CANDIDATES = [
  process.env.OPENAI_ASSISTANT_MODEL,
  process.env.OPENAI_MODEL,
  'gpt-5.3',
  'gpt-5',
  'gpt-5-mini',
  'gpt-4.1'
].filter(Boolean);

const SYSTEM_PROMPT = `You are the AI co-designer for ContextObjects Builder in healthcare.
ContextObjects are the canonical semantic data-modeling layer used to unify healthcare modeling across domains (clinical, administrative such as claims/care gaps, and omics/genomics).
Your structures must support consistent instance storage and reliable querying.
Act as a senior healthcare semantic data modeler for production-grade applications.

You receive:
1) current semantic object tree
2) user request
3) reusable block catalog (sample + saved blocks)
4) optional chat history from prior turns
5) mainModelingPattern + patternGuidance
6) domainContext (detected domain template + clarifications)
7) modelingPreferences (global quality toggles for metadata/context/temporal/reuse)

Primary objective:
- Apply the user request using formal edit operations.
- Maximize reuse of existing blocks before creating new custom fields.
- For "create/build/design from scratch" requests, generate a comprehensive clinical model (not a flat minimal list).
- Preserve semantic queryability: stable attributes, coherent multi-level nesting, repeatable arrays for longitudinal data, and explicit temporal/event modeling when needed.
- Produce operationally robust models: explicit lifecycle/status, timestamps, context links, and realistic cardinalities.

You MUST run this internal process before final answer:
- Pass 1: understand target clinical structure.
- Pass 2: map concepts to available reusable blocks.
- Pass 3: fill only unavoidable gaps with minimal custom nodes.

Return JSON ONLY:
{
  "explanation": "short summary of design choices",
  "planSummary": "brief plan",
  "clarificationQuestions": ["optional question 1"],
  "suggestedPrompts": ["optional follow-up prompt 1"],
  "coverage": {
    "metadata": "covered|partial|missing|not_applicable|unknown"
  },
  "operations": [ ... ]
}

Allowed operations:
1) add_node
{
  "op":"add_node",
  "parentNodeId":"<existing nodeId>",
  "index": 0,
  "node": {
    "nodeId":"optional",
    "name":"...",
    "attribute":"camelCase",
    "role":"field|group|section|event|event_series|block",
    "dataType":"string|number|integer|boolean|date|datetime|object|array|code|quantity|reference",
    "occurrences":{"min":0,"max":1},
    "description":"...",
    "constraints":{},
    "timeRole":"timestamp|interval_start|interval_end",
    "blockId":"required when role=block",
    "versionRange":"required when role=block, use ^<version>"
  }
}

2) update_node
{
  "op":"update_node",
  "targetNodeId":"<existing nodeId>",
  "changes": { ... }
}

3) delete_node
{
  "op":"delete_node",
  "targetNodeId":"<existing nodeId>"
}

4) move_node
{
  "op":"move_node",
  "targetNodeId":"<existing nodeId>",
  "newParentNodeId":"<existing nodeId>",
  "newIndex":0
}

Rules:
- Prefer role="block" nodes when matching reusable blocks exist.
- role="block" nodes must include blockId and versionRange.
- For role="block", dataType must be "object" and children are empty.
- Keep attributes unique under same parent.
- Avoid deleting existing nodes unless user asks.
- Keep operations minimal and coherent.
- For creation intents, include clinically complete coverage with nested sections/groups and temporal modeling (event_series/event) when relevant.
- Build for production quality: prefer constraints and structure that improve validation, traceability, and interoperability readiness.
- Honor domainContext guidance when provided; use it to avoid vague structures and ensure domain-appropriate completeness.
- Honor modelingPreferences when provided, unless the latest user instruction explicitly overrides them.

Clinical-document completeness intent:
For any create/build request, ensure coverage of:
- metadata/lifecycle
- subject context
- care/encounter/request context
- clinical content body (repeatable when appropriate)
- temporal modeling (event_series/event when time progression matters)
- assessment/interpretation
- performer/author context
- notes/annotations
Prefer reusable blocks for each area whenever available.
If the domain is specific (lab, medications, discharge summary, imaging, claims, care gaps, genomics, etc.), adapt details but keep the same completeness principles.
Never force a domain-specific preset unless the user explicitly asks for an example/sample/demo scaffold.
If the user request is broad, build a neutral multi-domain structure and include clarificationQuestions.
When ambiguity affects safety or data quality, add clarificationQuestions and still provide a strong baseline structure.
Use mainModelingPattern to choose the dominant structure shape:
- event_stream: event_series/event and repeatable measurements
- transactional: header + repeatable line items
- snapshot: grouped point-in-time structure, do not force event series unless asked
- workflow: lifecycle + repeatable steps with actor/time/outcome
- registry: subject enrollment/status with repeatable findings/gaps/actions
For vital-signs focused requests, avoid analyte/data-point abstractions unless user explicitly asks for laboratory/analyte modeling.

If no structural change is needed, return operations: [] with explanation.`;

const COVERAGE_STATUSES = new Set(['covered', 'partial', 'missing', 'not_applicable', 'unknown']);
const CORE_COVERAGE_KEYS = [
  'metadata',
  'subjectContext',
  'careContext',
  'clinicalContent',
  'temporalModeling',
  'assessment',
  'performerContext',
  'notesAndAnnotations'
];
const CREATE_INTENT_RE = /\b(create|build|design|new|from scratch|complete|comprehensive|full|clinical|document|report|summary|order|panel|generate|record|capture|track|collect|register|intake|log)\b/i;
const MODELING_PATTERNS = ['event_stream', 'transactional', 'snapshot', 'workflow', 'registry'];

const FIELD_PATTERNS = {
  '\\b(id|identifier|external id)\\b': { name: 'Identifier', attribute: 'identifier', dataType: 'string', required: false },
  '\\b(name|title|label)\\b': { name: 'Name', attribute: 'name', dataType: 'string', required: false },
  '\\b(status|state|category|type|code)\\b': { name: 'Status', attribute: 'status', dataType: 'code', required: false },
  '\\b(date|time|timestamp|recorded|authored|issued)\\b': { name: 'Timestamp', attribute: 'timestamp', dataType: 'datetime', required: false, timeRole: 'timestamp' },
  '\\b(amount|value|quantity|score|count|number|rate|ratio|percent)\\b': { name: 'Value', attribute: 'value', dataType: 'quantity', required: false },
  '\\b(reference|ref|link|uri)\\b': { name: 'Reference', attribute: 'reference', dataType: 'reference', required: false },
  '\\b(note|notes|comment|description|details)\\b': { name: 'Notes', attribute: 'notes', dataType: 'string', required: false },
  '\\b(flag|is|has)\\b': { name: 'Flag', attribute: 'flag', dataType: 'boolean', required: false },
};

function makeNodeId() {
  return `n-ai-${Math.random().toString(36).slice(2, 10)}`;
}

function getRootNode(semanticObject) {
  return (semanticObject?.nodes || []).find((n) => n.parentNodeId === null) || null;
}

function attributeExists(nodes, attribute, parentNodeId = null) {
  return (nodes || []).some((n) => n.parentNodeId === parentNodeId && (n.attribute || '').toLowerCase() === `${attribute}`.toLowerCase());
}

function findBestBlock(blocks, patterns) {
  return (blocks || []).find((b) => patterns.some((re) => re.test(`${b.name} ${b.blockId} ${b.description || ''}`)));
}

function isCreationIntentText(message) {
  return CREATE_INTENT_RE.test(`${message || ''}`.toLowerCase());
}

function inferMainModelingPattern(description = '') {
  const text = `${description || ''}`.toLowerCase();

  if (/\b(claim|billing|invoice|charge|adjudication|coverage|payer|payment|line item|encounter claim)\b/.test(text)) {
    return 'transactional';
  }
  if (/\b(order|authorization|task|workflow|care plan|care pathway|step|state transition)\b/.test(text)) {
    return 'workflow';
  }
  if (/\b(registry|cohort|enrollment|care gap|gap closure|population health)\b/.test(text)) {
    return 'registry';
  }
  if (/\b(summary|snapshot|baseline|problem list|medication list|allergy list)\b/.test(text)) {
    return 'snapshot';
  }
  if (/\b(observation|vital|lab|result|trend|monitor|time series|event|measurement)\b/.test(text)) {
    return 'event_stream';
  }
  return 'event_stream';
}

function buildPatternGuidance(pattern) {
  switch (pattern) {
    case 'transactional':
      return 'Prefer header plus repeatable lineItems/item with codes, amounts, status, and service/effective dates.';
    case 'workflow':
      return 'Prefer lifecycle and repeatable steps with actor, timestamp, and outcome fields.';
    case 'registry':
      return 'Prefer subject identity + enrollment/status + repeatable findings/gaps/interventions.';
    case 'snapshot':
      return 'Prefer grouped point-in-time sections; avoid forcing event-series unless explicitly requested.';
    case 'event_stream':
    default:
      return 'Prefer temporal event_series/event and repeatable measurement data points.';
  }
}

function isLabStyleRequest(text = '') {
  const lower = `${text || ''}`.toLowerCase();
  return /\b(lab|laboratory|analyte|biomarker|specimen|microbiology|chemistry panel|reference range)\b/.test(lower);
}

function isVitalSignsRequest(text = '') {
  const lower = `${text || ''}`.toLowerCase();
  return /\b(vital\s*sign|blood\s*pressure|bp|temperature|heart\s*rate|pulse|respiratory\s*rate|spo2|oxygen\s*saturation)\b/.test(lower);
}

function hasOverGenericVitalOperations(operations = []) {
  if (!Array.isArray(operations) || operations.length === 0) return false;
  return operations.some((op) => {
    if (op?.op !== 'add_node') return false;
    const node = op?.node || {};
    const attr = `${node?.attribute || ''}`.toLowerCase();
    const name = `${node?.name || ''}`.toLowerCase();
    const role = `${node?.role || ''}`.toLowerCase();
    const blockHint = `${node?.blockId || ''} ${node?.name || ''} ${node?.description || ''}`.toLowerCase();

    if (['datapoints', 'datapoint', 'analyte', 'analytes'].includes(attr)) return true;
    if (/\b(data\s*point|analyte)\b/.test(name)) return true;
    if (role === 'block' && /\b(analyte|laboratory|lab)\b/.test(blockHint)) return true;
    return false;
  });
}

async function loadReusableBlocks(request) {
  const blockMap = new Map();

  try {
    const coreDb = await getCoreDb();
    const coreBlocks = await coreDb.collection('sample_co_blocks')
      .find({}, { projection: { _id: 0, blockId: 1, version: 1, name: 1, description: 1 } })
      .limit(300)
      .toArray();

    coreBlocks.forEach((b) => {
      blockMap.set(`${b.blockId}:${b.version}`, { ...b, source: 'sample', _readOnly: true });
    });
  } catch (error) {
    console.warn('Could not load core blocks for AI:', error.message);
  }

  try {
    const { db } = await getActiveTenantDb(request);
    const tenantBlocks = await db.collection('co_blocks')
      .find({}, { projection: { _id: 0, blockId: 1, version: 1, name: 1, description: 1 } })
      .limit(300)
      .toArray();

    tenantBlocks.forEach((b) => {
      blockMap.set(`${b.blockId}:${b.version}`, { ...b, source: 'saved', _readOnly: false });
    });
  } catch (error) {
    console.warn('Could not load tenant blocks for AI:', error.message);
  }

  return Array.from(blockMap.values()).sort((a, b) => `${a.name}`.localeCompare(`${b.name}`));
}

function buildLabReportFallback(semanticObject, availableBlocks) {
  const operations = [];
  const root = getRootNode(semanticObject);
  if (!root) {
    return {
      explanation: 'Could not find a root node to add laboratory-report structure.',
      operations: []
    };
  }

  const rootId = root.nodeId;
  const nodes = semanticObject.nodes || [];

  const sectionSpecs = [
    { key: 'reportMetadata', name: 'Report Metadata' },
    { key: 'subject', name: 'Subject' },
    { key: 'request', name: 'Request' },
    { key: 'specimen', name: 'Specimen' },
    { key: 'results', name: 'Results' },
    { key: 'interpretation', name: 'Interpretation' },
    { key: 'performer', name: 'Performer' }
  ];

  const sectionNodeIds = new Map();

  sectionSpecs.forEach((section) => {
    const existing = nodes.find((n) => n.parentNodeId === rootId && (n.attribute || '').toLowerCase() === section.key.toLowerCase());
    if (existing) {
      sectionNodeIds.set(section.key, existing.nodeId);
      return;
    }

    const nodeId = makeNodeId();
    sectionNodeIds.set(section.key, nodeId);
    operations.push({
      op: 'add_node',
      parentNodeId: rootId,
      node: {
        nodeId,
        name: section.name,
        attribute: section.key,
        role: 'section',
        dataType: 'object',
        occurrences: { min: 0, max: 1 },
        description: `${section.name} section`
      }
    });
  });

  const reusablePlacement = [
    { section: 'subject', patterns: [/patient/i, /person/i, /demographic/i, /identifier/i] },
    { section: 'request', patterns: [/request/i, /order/i, /requisition/i] },
    { section: 'specimen', patterns: [/specimen/i, /sample/i] },
    { section: 'results', patterns: [/analyte/i, /lab/i, /result/i, /test/i] },
    { section: 'interpretation', patterns: [/interpretation/i, /conclusion/i, /diagnosis/i] },
    { section: 'performer', patterns: [/performer/i, /provider/i, /organization/i, /laboratory/i] }
  ];

  reusablePlacement.forEach((placement) => {
    const parentNodeId = sectionNodeIds.get(placement.section);
    if (!parentNodeId) return;

    const block = findBestBlock(availableBlocks, placement.patterns);
    if (!block) return;

    const attribute = `${placement.section}Block`;
    const exists = nodes.some((n) => n.parentNodeId === parentNodeId && n.role === 'block' && n.blockId === block.blockId);
    if (exists) return;

    operations.push({
      op: 'add_node',
      parentNodeId,
      node: {
        nodeId: makeNodeId(),
        name: block.name,
        attribute,
        role: 'block',
        dataType: 'object',
        occurrences: { min: 0, max: placement.section === 'results' ? '*' : 1 },
        blockId: block.blockId,
        versionRange: `^${block.version || '1.0.0'}`,
        description: `Reference to reusable block ${block.name}`
      }
    });
  });

  const reportMetadataParent = sectionNodeIds.get('reportMetadata') || rootId;
  if (!attributeExists(nodes, 'reportStatus', reportMetadataParent)) {
    operations.push({
      op: 'add_node',
      parentNodeId: reportMetadataParent,
      node: {
        nodeId: makeNodeId(),
        name: 'Report Status',
        attribute: 'reportStatus',
        role: 'field',
        dataType: 'code',
        occurrences: { min: 1, max: 1 },
        description: 'Draft, preliminary, final, amended'
      }
    });
  }

  if (!attributeExists(nodes, 'issuedAt', reportMetadataParent)) {
    operations.push({
      op: 'add_node',
      parentNodeId: reportMetadataParent,
      node: {
        nodeId: makeNodeId(),
        name: 'Issued At',
        attribute: 'issuedAt',
        role: 'field',
        dataType: 'datetime',
        occurrences: { min: 1, max: 1 },
        timeRole: 'timestamp',
        description: 'Report release timestamp'
      }
    });
  }

  return {
    explanation: 'Created a laboratory-report structure with key sections and maximized reusable block references where available. Added only essential custom fields for report metadata.',
    planSummary: 'Created core lab-report sections, reused available blocks, and added minimal metadata fields.',
    clarificationQuestions: [],
    suggestedPrompts: [
      'Make results repeatable events with collection and validation timestamps',
      'Add microbiology-specific sections for organisms and susceptibility panels',
      'Add regulatory metadata (accession number, ordering clinician, laboratory identifiers)'
    ],
    coverage: {
      metadata: 'covered',
      subjectContext: 'covered',
      careContext: 'covered',
      clinicalContent: 'covered',
      temporalModeling: 'covered',
      assessment: 'covered',
      performerContext: 'covered',
      notesAndAnnotations: 'partial'
    },
    operations
  };
}

function buildMedicationOrderFallback(semanticObject, availableBlocks) {
  const operations = [];
  const root = getRootNode(semanticObject);
  if (!root) {
    return {
      explanation: 'Could not find a root node to add medication-order structure.',
      operations: []
    };
  }

  const rootId = root.nodeId;
  const nodes = semanticObject.nodes || [];

  const sectionSpecs = [
    { key: 'orderMetadata', name: 'Order Metadata' },
    { key: 'subject', name: 'Subject' },
    { key: 'medication', name: 'Medication Details' },
    { key: 'dosageInstructions', name: 'Dosage Instructions' },
    { key: 'validity', name: 'Validity' },
    { key: 'prescriber', name: 'Prescriber' }
  ];

  const sectionNodeIds = new Map();

  sectionSpecs.forEach((section) => {
    const existing = nodes.find((n) => n.parentNodeId === rootId && (n.attribute || '').toLowerCase() === section.key.toLowerCase());
    if (existing) {
      sectionNodeIds.set(section.key, existing.nodeId);
      return;
    }

    const nodeId = makeNodeId();
    sectionNodeIds.set(section.key, nodeId);
    operations.push({
      op: 'add_node',
      parentNodeId: rootId,
      node: {
        nodeId,
        name: section.name,
        attribute: section.key,
        role: 'section',
        dataType: 'object',
        occurrences: { min: 0, max: 1 },
        description: `${section.name} section`
      }
    });
  });

  const reusablePlacement = [
    { section: 'subject', patterns: [/patient/i, /person/i, /demographic/i, /identifier/i], attr: 'subjectBlock' },
    { section: 'medication', patterns: [/medication/i, /drug/i, /prescription/i], attr: 'medicationBlock' },
    { section: 'dosageInstructions', patterns: [/dose/i, /timing/i, /schedule/i, /frequency/i], attr: 'dosageBlock' },
    { section: 'prescriber', patterns: [/provider/i, /practitioner/i, /prescriber/i, /organization/i], attr: 'prescriberBlock' }
  ];

  reusablePlacement.forEach((placement) => {
    const parentNodeId = sectionNodeIds.get(placement.section);
    if (!parentNodeId) return;

    const block = findBestBlock(availableBlocks, placement.patterns);
    if (!block) return;

    const exists = nodes.some((n) => n.parentNodeId === parentNodeId && n.role === 'block' && n.blockId === block.blockId);
    if (exists) return;

    operations.push({
      op: 'add_node',
      parentNodeId,
      node: {
        nodeId: makeNodeId(),
        name: block.name,
        attribute: placement.attr,
        role: 'block',
        dataType: 'object',
        occurrences: { min: 0, max: 1 },
        blockId: block.blockId,
        versionRange: `^${block.version || '1.0.0'}`,
        description: `Reference to reusable block ${block.name}`
      }
    });
  });

  const metadataParent = sectionNodeIds.get('orderMetadata') || rootId;
  if (!attributeExists(nodes, 'orderId', metadataParent)) {
    operations.push({
      op: 'add_node',
      parentNodeId: metadataParent,
      node: {
        nodeId: makeNodeId(),
        name: 'Order ID',
        attribute: 'orderId',
        role: 'field',
        dataType: 'string',
        occurrences: { min: 1, max: 1 }
      }
    });
  }
  if (!attributeExists(nodes, 'status', metadataParent)) {
    operations.push({
      op: 'add_node',
      parentNodeId: metadataParent,
      node: {
        nodeId: makeNodeId(),
        name: 'Order Status',
        attribute: 'status',
        role: 'field',
        dataType: 'code',
        occurrences: { min: 1, max: 1 }
      }
    });
  }
  if (!attributeExists(nodes, 'authoredOn', metadataParent)) {
    operations.push({
      op: 'add_node',
      parentNodeId: metadataParent,
      node: {
        nodeId: makeNodeId(),
        name: 'Authored On',
        attribute: 'authoredOn',
        role: 'field',
        dataType: 'datetime',
        timeRole: 'timestamp',
        occurrences: { min: 1, max: 1 }
      }
    });
  }

  const validityParent = sectionNodeIds.get('validity') || rootId;
  if (!attributeExists(nodes, 'startDate', validityParent)) {
    operations.push({
      op: 'add_node',
      parentNodeId: validityParent,
      node: {
        nodeId: makeNodeId(),
        name: 'Start Date',
        attribute: 'startDate',
        role: 'field',
        dataType: 'datetime',
        timeRole: 'interval_start',
        occurrences: { min: 0, max: 1 }
      }
    });
  }
  if (!attributeExists(nodes, 'endDate', validityParent)) {
    operations.push({
      op: 'add_node',
      parentNodeId: validityParent,
      node: {
        nodeId: makeNodeId(),
        name: 'End Date',
        attribute: 'endDate',
        role: 'field',
        dataType: 'datetime',
        timeRole: 'interval_end',
        occurrences: { min: 0, max: 1 }
      }
    });
  }

  return {
    explanation: 'Created a comprehensive medication-order structure with core sections, reusable blocks where available, and essential order/timing fields.',
    planSummary: 'Built a clinically complete medication-order model with metadata, subject, medication, dosage instructions, validity, and prescriber context.',
    clarificationQuestions: [],
    suggestedPrompts: [
      'Add dispense and refill details',
      'Add administration event series for medication administration tracking',
      'Add safety checks (allergy interaction and contraindication notes)'
    ],
    coverage: {
      metadata: 'covered',
      subjectContext: 'covered',
      careContext: 'covered',
      clinicalContent: 'covered',
      temporalModeling: 'covered',
      assessment: 'partial',
      performerContext: 'covered',
      notesAndAnnotations: 'partial'
    },
    operations
  };
}

function buildGenericClinicalDocumentFallback(semanticObject, availableBlocks, userMessage = '', mainModelingPattern = null) {
  const operations = [];
  const root = getRootNode(semanticObject);
  if (!root) {
    return {
      explanation: 'Could not find a root node to add a comprehensive clinical-document structure.',
      operations: []
    };
  }

  const rootId = root.nodeId;
  const nodes = semanticObject.nodes || [];
  const lowerRequest = `${userMessage || ''}`.toLowerCase();
  const resolvedPattern = MODELING_PATTERNS.includes(mainModelingPattern)
    ? mainModelingPattern
    : inferMainModelingPattern(lowerRequest);
  const vitalFocus = isVitalSignsRequest(lowerRequest) && !isLabStyleRequest(lowerRequest);

  const sectionSpecs = [
    { key: 'metadata', name: 'Metadata' },
    { key: 'subjectContext', name: 'Subject Context' },
    { key: 'careContext', name: 'Care Context' },
    { key: 'clinicalContent', name: 'Clinical Content' },
    { key: 'assessment', name: 'Assessment' },
    { key: 'performerContext', name: 'Performer Context' }
  ];

  const sectionNodeIds = new Map();

  sectionSpecs.forEach((section) => {
    const existing = nodes.find((n) => n.parentNodeId === rootId && (n.attribute || '').toLowerCase() === section.key.toLowerCase());
    if (existing) {
      sectionNodeIds.set(section.key, existing.nodeId);
      return;
    }

    const nodeId = makeNodeId();
    sectionNodeIds.set(section.key, nodeId);
    operations.push({
      op: 'add_node',
      parentNodeId: rootId,
      node: {
        nodeId,
        name: section.name,
        attribute: section.key,
        role: 'section',
        dataType: 'object',
        occurrences: { min: 0, max: 1 },
        description: `${section.name} section`
      }
    });
  });

  const reusablePlacement = [
    { section: 'subjectContext', patterns: [/patient/i, /person/i, /demographic/i, /identifier/i], attr: 'subjectBlock' },
    { section: 'careContext', patterns: [/encounter/i, /visit/i, /episode/i, /request/i, /order/i], attr: 'contextBlock' },
    {
      section: 'clinicalContent',
      patterns: vitalFocus
        ? [/vital/i, /blood pressure/i, /temperature/i, /observation/i]
        : [/observation/i, /result/i, /finding/i, /diagnosis/i, /medication/i, /procedure/i],
      attr: 'contentBlock'
    },
    { section: 'performerContext', patterns: [/performer/i, /provider/i, /practitioner/i, /organization/i, /author/i], attr: 'performerBlock' }
  ];

  reusablePlacement.forEach((placement) => {
    const parentNodeId = sectionNodeIds.get(placement.section);
    if (!parentNodeId) return;

    const block = findBestBlock(availableBlocks, placement.patterns);
    if (!block) return;

    const exists = nodes.some((n) => n.parentNodeId === parentNodeId && n.role === 'block' && n.blockId === block.blockId);
    if (exists) return;

    operations.push({
      op: 'add_node',
      parentNodeId,
      node: {
        nodeId: makeNodeId(),
        name: block.name,
        attribute: placement.attr,
        role: 'block',
        dataType: 'object',
        occurrences: { min: 0, max: 1 },
        blockId: block.blockId,
        versionRange: `^${block.version || '1.0.0'}`,
        description: `Reference to reusable block ${block.name}`
      }
    });
  });

  const metadataParent = sectionNodeIds.get('metadata') || rootId;
  if (!attributeExists(nodes, 'documentId', metadataParent)) {
    operations.push({
      op: 'add_node',
      parentNodeId: metadataParent,
      node: {
        nodeId: makeNodeId(),
        name: 'Document ID',
        attribute: 'documentId',
        role: 'field',
        dataType: 'string',
        occurrences: { min: 1, max: 1 }
      }
    });
  }
  if (!attributeExists(nodes, 'status', metadataParent)) {
    operations.push({
      op: 'add_node',
      parentNodeId: metadataParent,
      node: {
        nodeId: makeNodeId(),
        name: 'Status',
        attribute: 'status',
        role: 'field',
        dataType: 'code',
        occurrences: { min: 1, max: 1 }
      }
    });
  }
  if (!attributeExists(nodes, 'recordedAt', metadataParent)) {
    operations.push({
      op: 'add_node',
      parentNodeId: metadataParent,
      node: {
        nodeId: makeNodeId(),
        name: 'Recorded At',
        attribute: 'recordedAt',
        role: 'field',
        dataType: 'datetime',
        timeRole: 'timestamp',
        occurrences: { min: 1, max: 1 }
      }
    });
  }

  const contentParent = sectionNodeIds.get('clinicalContent') || rootId;
  const explicitTemporalIntent = /\b(event|temporal|timeline|time series|longitudinal|trend)\b/.test(lowerRequest);
  const useEventSeries = resolvedPattern === 'event_stream' || explicitTemporalIntent;
  const useCompactVitalsModel = vitalFocus && !explicitTemporalIntent;
  let measurementContainerParentId = contentParent;

  const ensureChildNode = (parentNodeId, attribute, buildNode) => {
    const existing = nodes.find((n) => n.parentNodeId === parentNodeId && (n.attribute || '').toLowerCase() === attribute.toLowerCase());
    if (existing) return existing.nodeId;
    const node = buildNode();
    operations.push({ op: 'add_node', parentNodeId, node });
    return node.nodeId;
  };

  const ensureFieldInNode = (parentNodeId, attribute, name, dataType, required = false, timeRole = null) => {
    const exists = nodes.some((n) => n.parentNodeId === parentNodeId && (n.attribute || '').toLowerCase() === attribute.toLowerCase());
    if (exists) return;
    operations.push({
      op: 'add_node',
      parentNodeId,
      node: {
        nodeId: makeNodeId(),
        name,
        attribute,
        role: 'field',
        dataType,
        occurrences: { min: required ? 1 : 0, max: 1 },
        ...(timeRole ? { timeRole } : {})
      }
    });
  };

  if (useEventSeries) {
    const seriesId = ensureChildNode(contentParent, 'events', () => ({
      nodeId: makeNodeId(),
      name: 'Events',
      attribute: 'events',
      role: 'event_series',
      dataType: 'array',
      occurrences: { min: 0, max: '*' },
      description: 'Temporal sequence of clinical events'
    }));

    const eventId = ensureChildNode(seriesId, 'event', () => ({
      nodeId: makeNodeId(),
      name: 'Event',
      attribute: 'event',
      role: 'event',
      dataType: 'object',
      occurrences: { min: 1, max: 1 }
    }));
    ensureFieldInNode(eventId, 'eventTime', 'Event Time', 'datetime', true, 'timestamp');

    if (!useCompactVitalsModel) {
      const dataPointsId = ensureChildNode(eventId, 'dataPoints', () => ({
        nodeId: makeNodeId(),
        name: 'Data Points',
        attribute: 'dataPoints',
        role: 'group',
        dataType: 'array',
        occurrences: { min: 1, max: '*' },
        description: 'Repeatable observation entries for this event'
      }));

      const dataPointId = ensureChildNode(dataPointsId, 'dataPoint', () => ({
        nodeId: makeNodeId(),
        name: 'Data Point',
        attribute: 'dataPoint',
        role: 'group',
        dataType: 'object',
        occurrences: { min: 1, max: 1 },
        description: 'Single coded data point'
      }));

      ensureFieldInNode(dataPointId, 'code', 'Code', 'code', true);
      ensureFieldInNode(dataPointId, 'value', 'Value', 'quantity', false);
      ensureFieldInNode(dataPointId, 'valueText', 'Value Text', 'string', false);
      ensureFieldInNode(dataPointId, 'unit', 'Unit', 'code', false);
      ensureFieldInNode(dataPointId, 'interpretation', 'Interpretation', 'code', false);
    }
    measurementContainerParentId = eventId;
  } else if (resolvedPattern === 'transactional') {
    const lineItemsId = ensureChildNode(contentParent, 'lineItems', () => ({
      nodeId: makeNodeId(),
      name: 'Line Items',
      attribute: 'lineItems',
      role: 'group',
      dataType: 'array',
      occurrences: { min: 1, max: '*' },
      description: 'Repeatable transactional items'
    }));
    const lineItemId = ensureChildNode(lineItemsId, 'lineItem', () => ({
      nodeId: makeNodeId(),
      name: 'Line Item',
      attribute: 'lineItem',
      role: 'group',
      dataType: 'object',
      occurrences: { min: 1, max: 1 }
    }));
    ensureFieldInNode(lineItemId, 'code', 'Code', 'code', true);
    ensureFieldInNode(lineItemId, 'description', 'Description', 'string', false);
    ensureFieldInNode(lineItemId, 'quantity', 'Quantity', 'quantity', false);
    ensureFieldInNode(lineItemId, 'unitPrice', 'Unit Price', 'quantity', false);
    ensureFieldInNode(lineItemId, 'lineStatus', 'Line Status', 'code', false);
    measurementContainerParentId = lineItemId;
  } else if (resolvedPattern === 'workflow') {
    const stepsId = ensureChildNode(contentParent, 'steps', () => ({
      nodeId: makeNodeId(),
      name: 'Workflow Steps',
      attribute: 'steps',
      role: 'group',
      dataType: 'array',
      occurrences: { min: 1, max: '*' },
      description: 'Ordered workflow steps'
    }));
    const stepId = ensureChildNode(stepsId, 'step', () => ({
      nodeId: makeNodeId(),
      name: 'Step',
      attribute: 'step',
      role: 'group',
      dataType: 'object',
      occurrences: { min: 1, max: 1 }
    }));
    ensureFieldInNode(stepId, 'stepType', 'Step Type', 'code', true);
    ensureFieldInNode(stepId, 'stepStatus', 'Step Status', 'code', true);
    ensureFieldInNode(stepId, 'performedBy', 'Performed By', 'reference', false);
    ensureFieldInNode(stepId, 'performedAt', 'Performed At', 'datetime', false, 'timestamp');
    ensureFieldInNode(stepId, 'outcome', 'Outcome', 'string', false);
    measurementContainerParentId = stepId;
  } else {
    const findingsId = ensureChildNode(contentParent, 'findings', () => ({
      nodeId: makeNodeId(),
      name: 'Findings',
      attribute: 'findings',
      role: 'group',
      dataType: 'array',
      occurrences: { min: 1, max: '*' },
      description: 'Repeatable findings'
    }));
    const findingId = ensureChildNode(findingsId, 'finding', () => ({
      nodeId: makeNodeId(),
      name: 'Finding',
      attribute: 'finding',
      role: 'group',
      dataType: 'object',
      occurrences: { min: 1, max: 1 }
    }));
    ensureFieldInNode(findingId, 'code', 'Code', 'code', true);
    ensureFieldInNode(findingId, 'value', 'Value', 'quantity', false);
    ensureFieldInNode(findingId, 'status', 'Status', 'code', false);
    ensureFieldInNode(findingId, 'observedAt', 'Observed At', 'datetime', false, 'timestamp');
    measurementContainerParentId = findingId;
  }

  const wantsBloodPressure = /\bblood\s*pressure\b|\bbp\b/.test(lowerRequest);
  const wantsTemperature = /\btemperature\b|\btemp\b/.test(lowerRequest);
  const wantsVitalSigns = /\bvital\s*sign/.test(lowerRequest);

  if (wantsVitalSigns || wantsBloodPressure || wantsTemperature) {
    const panelId = ensureChildNode(measurementContainerParentId, 'vitalSignsPanel', () => ({
      nodeId: makeNodeId(),
      name: 'Vital Signs Panel',
      attribute: 'vitalSignsPanel',
      role: 'group',
      dataType: 'object',
      occurrences: { min: 0, max: 1 },
      description: 'Vital sign measurements'
    }));

    if (wantsBloodPressure) {
      const bpGroupId = ensureChildNode(panelId, 'bloodPressure', () => ({
        nodeId: makeNodeId(),
        name: 'Blood Pressure',
        attribute: 'bloodPressure',
        role: 'group',
        dataType: 'object',
        occurrences: { min: 0, max: 1 },
        description: 'Blood pressure with systolic and diastolic components'
      }));
      ensureFieldInNode(bpGroupId, 'systolic', 'Systolic', 'quantity', true);
      ensureFieldInNode(bpGroupId, 'diastolic', 'Diastolic', 'quantity', true);
      ensureFieldInNode(bpGroupId, 'bpUnit', 'Blood Pressure Unit', 'code', false);
    }

    if (wantsTemperature) {
      ensureFieldInNode(panelId, 'temperature', 'Temperature', 'quantity', false);
      ensureFieldInNode(panelId, 'temperatureUnit', 'Temperature Unit', 'code', false);
    }
  }

  const assessmentParent = sectionNodeIds.get('assessment') || rootId;
  if (!attributeExists(nodes, 'notes', assessmentParent)) {
    operations.push({
      op: 'add_node',
      parentNodeId: assessmentParent,
      node: {
        nodeId: makeNodeId(),
        name: 'Notes',
        attribute: 'notes',
        role: 'field',
        dataType: 'string',
        occurrences: { min: 0, max: 1 }
      }
    });
  }

  const temporalCoverage = useEventSeries || resolvedPattern === 'workflow' ? 'covered' : 'partial';
  const patternSummary = {
    event_stream: 'event-series temporal model',
    transactional: 'transactional line-item model',
    workflow: 'workflow-step model',
    snapshot: 'snapshot findings model',
    registry: 'registry findings model'
  }[resolvedPattern] || 'event-series temporal model';

  return {
    explanation: `Created a comprehensive clinical-document scaffold with reusable blocks where available and a ${patternSummary}.`,
    planSummary: `Added metadata, subject/care context, clinical content, assessment, performer context, and pattern-driven structure (${resolvedPattern}).`,
    clarificationQuestions: [
      'Which domain should this model focus on first (claims, care gaps, medication, vitals, or another)?',
      'Which sections must be mandatory in every instance?',
      'Do you want stricter cardinalities and value constraints now, or after structure review?'
    ],
    suggestedPrompts: [
      'Specialize this structure for my domain and keep all reusable blocks',
      'Add terminology bindings and structural bindings for FHIR/openEHR',
      'Add stricter constraints and cardinalities for required data quality'
    ],
    coverage: {
      metadata: 'covered',
      subjectContext: 'covered',
      careContext: 'covered',
      clinicalContent: 'covered',
      temporalModeling: temporalCoverage,
      assessment: 'covered',
      performerContext: 'covered',
      notesAndAnnotations: 'covered'
    },
    operations
  };
}

function parseToOperations(message, semanticObject, availableBlocks = [], mainModelingPattern = null) {
  const lowerMessage = `${message || ''}`.toLowerCase();
  const operations = [];
  const explanations = [];
  const isCreationIntent = isCreationIntentText(lowerMessage);
  const wantsExample = /\b(example|sample|demo)\b/.test(lowerMessage);

  if (wantsExample && (lowerMessage.includes('laboratory report') || lowerMessage.includes('lab report'))) {
    return buildLabReportFallback(semanticObject, availableBlocks);
  }
  if (wantsExample && (lowerMessage.includes('medication order') || lowerMessage.includes('prescription'))) {
    return buildMedicationOrderFallback(semanticObject, availableBlocks);
  }
  if (isCreationIntent) {
    return buildGenericClinicalDocumentFallback(
      semanticObject,
      availableBlocks,
      lowerMessage,
      mainModelingPattern
    );
  }

  const nodes = semanticObject.nodes || [];
  const rootNode = getRootNode(semanticObject);
  const parentId = rootNode?.nodeId || null;

  if (!parentId) {
    return {
      explanation: 'No root node found; I cannot apply structural changes.',
      operations: []
    };
  }

  // Repeatable updates
  if (lowerMessage.includes('repeatable') || lowerMessage.includes('array') || lowerMessage.includes('multiple')) {
    for (const node of nodes) {
      const nodeName = (node.name || '').toLowerCase();
      const nodeAttr = (node.attribute || '').toLowerCase();
      if ((lowerMessage.includes(nodeName) || lowerMessage.includes(nodeAttr)) && node.parentNodeId !== null) {
        operations.push({
          op: 'update_node',
          targetNodeId: node.nodeId,
          changes: { occurrences: { min: 0, max: '*' } }
        });
        explanations.push(`Made "${node.name}" repeatable`);
      }
    }
  }

  // Add known fields
  if (lowerMessage.includes('add')) {
    for (const [pattern, fieldDef] of Object.entries(FIELD_PATTERNS)) {
      const regex = new RegExp(pattern, 'i');
      if (!regex.test(lowerMessage)) continue;

      const exists = nodes.some((n) => (n.attribute || '').toLowerCase() === fieldDef.attribute.toLowerCase());
      if (exists) continue;

      operations.push({
        op: 'add_node',
        parentNodeId: parentId,
        node: {
          nodeId: makeNodeId(),
          name: fieldDef.name,
          attribute: fieldDef.attribute,
          dataType: fieldDef.dataType,
          role: fieldDef.dataType === 'object' ? 'group' : 'field',
          occurrences: fieldDef.repeatable ? { min: 0, max: '*' } : { min: fieldDef.required ? 1 : 0, max: 1 },
          ...(fieldDef.timeRole ? { timeRole: fieldDef.timeRole } : {})
        }
      });
      explanations.push(`Added "${fieldDef.name}"`);
    }
  }

  return {
    explanation: operations.length ? `${explanations.join('. ')}.` : 'I understood your request but no clear structural operation was identified. Try asking for explicit add/move/delete actions.',
    planSummary: operations.length ? 'Applied direct requested updates to the current structure.' : 'No safe structural edits detected from the current instruction.',
    clarificationQuestions: operations.length ? [] : [
      'Which section or node should be updated?',
      'Should the new element be required or optional?',
      'Do you want to reuse an existing block, or create custom fields?'
    ],
    suggestedPrompts: operations.length ? [
      'Add deeper nested sections and temporal event modeling',
      'Replace generic groups with reusable blocks from the library',
      'Add constraints and required fields for data quality'
    ] : [
      'Create a comprehensive clinical document with reusable blocks',
      'Design a multi-level model with event arrays and nested data points',
      'Use an example scaffold, then adapt it to my domain'
    ],
    operations
  };
}

function sanitizeStringArray(value, maxItems = 5) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => typeof v === 'string' && v.trim())
    .slice(0, maxItems)
    .map((v) => v.trim());
}

function formatClarificationQuestion(question) {
  if (!question || typeof question !== 'object') return null;
  const text = `${question.question || ''}`.trim();
  if (!text) return null;
  const options = Array.isArray(question.options)
    ? question.options
      .map((option) => `${option?.label || option?.value || ''}`.trim())
      .filter(Boolean)
    : [];
  if (!options.length) return text;
  return `${text} Options: ${options.join(' | ')}`;
}

function normalizeCoverage(coverage) {
  const normalized = {};
  if (coverage && typeof coverage === 'object' && !Array.isArray(coverage)) {
    Object.entries(coverage).slice(0, 20).forEach(([rawKey, rawStatus]) => {
      const key = `${rawKey || ''}`.trim();
      const status = `${rawStatus || ''}`.trim().toLowerCase();
      if (!key) return;
      normalized[key] = COVERAGE_STATUSES.has(status) ? status : 'unknown';
    });
  }

  // Ensure stable keys for generic clinical-document coverage.
  CORE_COVERAGE_KEYS.forEach((key) => {
    if (!normalized[key]) normalized[key] = 'unknown';
  });

  return normalized;
}

function uniqueByBlockId(blocks = []) {
  const seen = new Set();
  const output = [];
  (Array.isArray(blocks) ? blocks : []).forEach((block) => {
    const blockId = `${block?.blockId || ''}`.trim();
    if (!blockId || seen.has(blockId)) return;
    seen.add(blockId);
    output.push(block);
  });
  return output;
}

function matchReusableBlocksForRequest(userRequest = '', availableBlocks = []) {
  const text = `${userRequest || ''}`.toLowerCase();
  if (!text.trim()) return [];

  const scored = (availableBlocks || []).map((block) => {
    const haystack = `${block?.name || ''} ${block?.blockId || ''} ${block?.description || ''}`.toLowerCase();
    let score = 0;

    if (!haystack.trim()) return { block, score: 0 };

    if (/\bblood\s*pressure\b|\bbloodpressure\b|\bbp\b/.test(text) && /\bblood\s*pressure\b|\bbloodpressure\b|\bbp\b/.test(haystack)) {
      score += 5;
    }
    if (/\btemperature\b|\btemp\b/.test(text) && /\btemperature\b|\btemp\b/.test(haystack)) {
      score += 4;
    }
    if (/\bspo2\b|\boxy(gen|genation)?\b|\boxygen\s*saturation\b|\bsaturation\b/.test(text) && /\bspo2\b|\boxy(gen|genation)?\b|\boxygen\s*saturation\b|\bsaturation\b/.test(haystack)) {
      score += 4;
    }
    if (/\bvital\s*sign/.test(text) && /\bvital\s*sign|\bvitals?\b/.test(haystack)) {
      score += 3;
    }

    const tokens = text
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter((token) => token.length >= 4);
    tokens.forEach((token) => {
      if (haystack.includes(token)) score += 1;
    });

    return { block, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.block)
    .slice(0, 8);
}

function ensureReusableBlockUsage(response, semanticObject, availableBlocks, userRequest = '') {
  if (!response || !isCreationIntentText(userRequest)) return response;

  const operations = Array.isArray(response.operations) ? [...response.operations] : [];
  const currentNodes = Array.isArray(semanticObject?.nodes) ? semanticObject.nodes : [];
  const projectedNodes = projectNodesAfterOperations(currentNodes, operations);
  const rootNode = getRootNode({ nodes: projectedNodes });
  if (!rootNode?.nodeId) return response;

  const clinicalContentNode = projectedNodes.find((node) => node.parentNodeId === rootNode.nodeId && `${node.attribute || ''}`.toLowerCase() === 'clinicalcontent');
  const targetParentId = clinicalContentNode?.nodeId || rootNode.nodeId;
  const lower = `${userRequest || ''}`.toLowerCase();

  const requestedBloodPressure = /\bblood\s*pressure\b|\bbloodpressure\b|\bbp\b/.test(lower);
  const requestedTemperature = /\btemperature\b|\btemp\b/.test(lower);
  const requestedOxygen = /\bspo2\b|\boxy(gen|genation)?\b|\boxygen\s*saturation\b|\bsaturation\b/.test(lower);
  const requestedVitalSigns = /\bvital\s*sign/.test(lower);

  const bpBlock = findBestBlock(availableBlocks, [/\bblood\s*pressure\b/i, /\bbloodpressure\b/i, /\bbp\b/i]);
  const vitalSignsBlock = findBestBlock(availableBlocks, [/\bvital\s*sign/i, /\bvitals?\b/i, /\bblood\s*pressure\b/i, /\bbloodpressure\b/i, /\btemperature\b/i, /\bspo2\b/i]);
  const oxygenBlock = findBestBlock(availableBlocks, [/\bspo2\b/i, /\boxy(gen|genation)?\b/i, /\boxygen\s*saturation\b/i, /\bsaturation\b/i]);

  const hasBlockInTree = (blockId) => projectedNodes.some((node) => `${node.role || ''}`.toLowerCase() === 'block' && node.blockId === blockId);
  const hasBlockInOps = (blockId) => operations.some((op) => op?.op === 'add_node' && `${op?.node?.role || ''}`.toLowerCase() === 'block' && op?.node?.blockId === blockId);
  const hasAttrUnderParent = (attribute) => projectedNodes.some((node) => node.parentNodeId === targetParentId && `${node.attribute || ''}`.toLowerCase() === `${attribute}`.toLowerCase());

  const addReusableBlock = (attribute, block) => {
    if (!block?.blockId) return false;
    if (hasBlockInTree(block.blockId) || hasBlockInOps(block.blockId)) return false;
    if (hasAttrUnderParent(attribute)) return false;

    operations.push({
      op: 'add_node',
      parentNodeId: targetParentId,
      node: {
        nodeId: makeNodeId(),
        name: block.name || attribute,
        attribute,
        role: 'block',
        dataType: 'object',
        occurrences: { min: 0, max: 1 },
        blockId: block.blockId,
        versionRange: `^${block.version || '1.0.0'}`,
        description: `Reference to reusable block ${block.name || block.blockId}`
      }
    });
    return true;
  };

  let injected = 0;
  if (requestedBloodPressure) {
    injected += addReusableBlock('bloodPressureBlock', bpBlock) ? 1 : 0;
  }
  if (requestedTemperature || requestedVitalSigns) {
    injected += addReusableBlock('vitalSignsBlock', vitalSignsBlock) ? 1 : 0;
  }
  if (requestedOxygen) {
    injected += addReusableBlock('oxygenSaturationBlock', oxygenBlock) ? 1 : 0;
  }

  if (!injected) return response;

  return {
    ...response,
    operations,
    explanation: `${response.explanation} Added ${injected} reusable block reference${injected > 1 ? 's' : ''} based on your request.`
  };
}

function buildReusableBlockSummary(userRequest = '', availableBlocks = [], projectedNodes = [], operations = []) {
  const matched = uniqueByBlockId(matchReusableBlocksForRequest(userRequest, availableBlocks))
    .map((block) => ({
      blockId: block.blockId,
      name: block.name || block.blockId,
      version: block.version || '1.0.0',
      source: block.source || 'unknown'
    }));

  const appliedFromOps = (Array.isArray(operations) ? operations : [])
    .filter((op) => op?.op === 'add_node' && `${op?.node?.role || ''}`.toLowerCase() === 'block' && op?.node?.blockId)
    .map((op) => ({
      blockId: op.node.blockId,
      name: op.node.name || op.node.blockId,
      version: `${op.node.versionRange || ''}`.replace(/^\^/, '') || '1.0.0',
      source: 'operation'
    }));

  const appliedFromTree = (Array.isArray(projectedNodes) ? projectedNodes : [])
    .filter((node) => `${node?.role || ''}`.toLowerCase() === 'block' && node?.blockId)
    .map((node) => ({
      blockId: node.blockId,
      name: node.name || node.blockId,
      version: `${node.versionRange || ''}`.replace(/^\^/, '') || '1.0.0',
      source: 'tree'
    }));

  const applied = uniqueByBlockId([...appliedFromOps, ...appliedFromTree]).slice(0, 12);
  const appliedIds = new Set(applied.map((item) => item.blockId));
  const missed = matched.filter((item) => !appliedIds.has(item.blockId));

  return {
    matched,
    applied,
    missed,
    counts: {
      matched: matched.length,
      applied: applied.length,
      missed: missed.length
    }
  };
}

function normalizeAgentResponse(response) {
  const pendingNodeIds = new Map();
  let pendingCounter = 0;

  const operations = (Array.isArray(response?.operations) ? response.operations : []).map((op) => {
    if (op.op === 'add_node') {
      const tempId = op.node?.nodeId || makeNodeId();
      pendingNodeIds.set(`PENDING_${pendingCounter}`, tempId);
      pendingCounter += 1;

      if (op.parentNodeId && `${op.parentNodeId}`.startsWith('PENDING_')) {
        const resolvedId = pendingNodeIds.get(op.parentNodeId);
        if (resolvedId) op.parentNodeId = resolvedId;
      }

      let role = op.node?.role || 'field';
      let dataType = op.node?.dataType || 'string';
      if (role === 'event_series') dataType = 'array';
      if (['section', 'group', 'event', 'block'].includes(role)) dataType = 'object';
      if (role === 'field' && dataType === 'object') role = 'group';
      const normalizedNode = {
        ...op.node,
        nodeId: tempId,
        role,
        dataType,
        occurrences: op.node?.occurrences || { min: 0, max: 1 }
      };

      if (role === 'block' && op.node?.blockId) {
        Object.assign(normalizedNode, {
          blockId: op.node?.blockId,
          versionRange: op.node?.versionRange || '^1.0.0'
        });
      } else if (role === 'block' && !op.node?.blockId) {
        // Keep operations save-safe when LLM emits incomplete block references.
        normalizedNode.role = 'group';
        normalizedNode.dataType = 'object';
      }

      op.node = normalizedNode;
    }

    if (op.op === 'move_node' && `${op.newParentNodeId || ''}`.startsWith('PENDING_')) {
      const resolvedId = pendingNodeIds.get(op.newParentNodeId);
      if (resolvedId) op.newParentNodeId = resolvedId;
    }

    return op;
  });

  const dedupedOperations = [];
  const seenSiblingAdds = new Set();
  for (const op of operations) {
    if (op?.op !== 'add_node') {
      dedupedOperations.push(op);
      continue;
    }
    const parentKey = `${op.parentNodeId || ''}`;
    const attrKey = `${op.node?.attribute || ''}`.trim().toLowerCase();
    if (!parentKey || !attrKey) {
      dedupedOperations.push(op);
      continue;
    }
    const dedupeKey = `${parentKey}:${attrKey}`;
    if (seenSiblingAdds.has(dedupeKey)) continue;
    seenSiblingAdds.add(dedupeKey);
    dedupedOperations.push(op);
  }

  const explanation = `${response?.explanation || 'Applied requested structure updates.'}`;
  const planSummary = typeof response?.planSummary === 'string' ? response.planSummary.trim() : '';
  const clarificationQuestions = sanitizeStringArray(
    response?.clarificationQuestions || response?.questions,
    6
  );
  const suggestedPrompts = sanitizeStringArray(
    response?.suggestedPrompts || response?.nextPrompts,
    6
  );
  const coverage = normalizeCoverage(response?.coverage);
  const recommendedBlocks = Array.isArray(response?.recommendedBlocks)
    ? response.recommendedBlocks
      .filter((item) => item && typeof item === 'object')
      .slice(0, 8)
      .map((item) => ({
        nodeId: typeof item.nodeId === 'string' ? item.nodeId : null,
        name: typeof item.name === 'string' ? item.name : 'Reusable Block',
        suggestedBlockId: typeof item.suggestedBlockId === 'string' ? item.suggestedBlockId : null,
        reason: typeof item.reason === 'string' ? item.reason : ''
      }))
    : [];

  return {
    explanation,
    planSummary,
    clarificationQuestions,
    suggestedPrompts,
    coverage,
    recommendedBlocks,
    operations: dedupedOperations
  };
}

function projectNodesAfterOperations(nodes = [], operations = []) {
  const currentNodes = Array.isArray(nodes) ? nodes.map((node) => ({ ...node })) : [];
  const nodeMap = new Map(currentNodes.map((node) => [node.nodeId, node]));

  const ensureChildren = () => {
    const childrenMap = new Map(currentNodes.map((node) => [node.nodeId, []]));
    currentNodes.forEach((node) => {
      if (node.parentNodeId && childrenMap.has(node.parentNodeId)) {
        childrenMap.get(node.parentNodeId).push(node.nodeId);
      }
    });
    currentNodes.forEach((node) => {
      node.childrenNodeIds = childrenMap.get(node.nodeId) || [];
    });
  };

  ensureChildren();

  const removeSubtree = (rootNodeId) => {
    const removeIds = new Set();
    const stack = [rootNodeId];
    while (stack.length) {
      const nodeId = stack.pop();
      if (!nodeId || removeIds.has(nodeId)) continue;
      removeIds.add(nodeId);
      const node = nodeMap.get(nodeId);
      const children = node?.childrenNodeIds || [];
      children.forEach((childId) => stack.push(childId));
    }
    removeIds.forEach((nodeId) => {
      const index = currentNodes.findIndex((node) => node.nodeId === nodeId);
      if (index !== -1) currentNodes.splice(index, 1);
      nodeMap.delete(nodeId);
    });
  };

  (Array.isArray(operations) ? operations : []).forEach((op) => {
    if (!op || typeof op !== 'object') return;

    if (op.op === 'add_node' && op.node) {
      const node = {
        ...op.node,
        nodeId: op.node.nodeId || makeNodeId(),
        parentNodeId: op.parentNodeId || null,
        childrenNodeIds: []
      };
      currentNodes.push(node);
      nodeMap.set(node.nodeId, node);
      ensureChildren();
      return;
    }

    if (op.op === 'update_node' && op.targetNodeId && op.changes) {
      const existing = nodeMap.get(op.targetNodeId);
      if (!existing) return;
      Object.assign(existing, op.changes);
      ensureChildren();
      return;
    }

    if (op.op === 'move_node' && op.targetNodeId && op.newParentNodeId) {
      const existing = nodeMap.get(op.targetNodeId);
      if (!existing) return;
      existing.parentNodeId = op.newParentNodeId;
      ensureChildren();
      return;
    }

    if (op.op === 'delete_node' && op.targetNodeId) {
      removeSubtree(op.targetNodeId);
      ensureChildren();
    }
  });

  return currentNodes;
}

function shouldForceComprehensiveFallback(userRequest, semanticObject, response) {
  if (!response) return false;
  if (!isCreationIntentText(userRequest)) return false;

  const existingNodeCount = Array.isArray(semanticObject?.nodes) ? semanticObject.nodes.length : 0;
  const isSparseExistingModel = existingNodeCount <= 10;
  if (!isSparseExistingModel) return false;

  const operations = Array.isArray(response.operations) ? response.operations : [];
  const addOps = operations.filter((op) => op.op === 'add_node');
  const coveredAreas = CORE_COVERAGE_KEYS.filter((key) => response.coverage?.[key] === 'covered').length;
  const addsTemporalModel = addOps.some((op) => ['event_series', 'event'].includes(op?.node?.role));

  if (addOps.length === 0) return true;
  if (addOps.length < 8) return true;
  if (coveredAreas < 4) return true;
  if (!addsTemporalModel && coveredAreas < 6) return true;

  return false;
}

function sanitizeChatHistory(chatHistory) {
  if (!Array.isArray(chatHistory)) return [];
  return chatHistory
    .filter((msg) =>
      msg &&
      (msg.role === 'user' || msg.role === 'assistant') &&
      typeof msg.content === 'string' &&
      msg.content.trim()
    )
    .slice(-20)
    .map((msg) => ({ role: msg.role, content: msg.content.trim() }));
}

async function callOpenAIAPI(
  semanticObject,
  userRequest,
  availableBlocks,
  chatHistory = [],
  mainModelingPattern = null,
  domainContext = null,
  modelingPreferences = null
) {
  if (!OPENAI_API_KEY) return null;

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const resolvedPattern = MODELING_PATTERNS.includes(mainModelingPattern)
    ? mainModelingPattern
    : inferMainModelingPattern(userRequest);

  const userPayload = {
    userRequest,
    mainModelingPattern: resolvedPattern,
    patternGuidance: buildPatternGuidance(resolvedPattern),
    domainContext,
    modelingPreferences,
    chatHistory: sanitizeChatHistory(chatHistory),
    semanticObject,
    availableReusableBlocks: availableBlocks
  };

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify(userPayload) }
  ];

  for (const model of MODEL_CANDIDATES) {
    try {
      const response = await openai.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: 6000,
        response_format: { type: 'json_object' },
        messages
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) continue;

      const parsed = JSON.parse(content);
      if (!parsed || !Array.isArray(parsed.operations)) continue;

      return normalizeAgentResponse(parsed);
    } catch (error) {
      console.warn(`OpenAI ai-assist failed with model ${model}:`, error.message);
    }
  }

  return null;
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const {
      semanticObject,
      userRequest,
      chatHistory,
      mainModelingPattern,
      modelingPreferences = null,
      clarificationAnswers = {},
      skipClarifications = false
    } = await parseJsonWithLimit(request, AI_ASSIST_MAX_BODY_BYTES);

    if (!semanticObject || !userRequest) {
      return NextResponse.json(
        { error: 'semanticObject and userRequest are required' },
        { status: 400 }
      );
    }

    // Cost-control: rate limit AI calls per user (and per team policy if applicable).
    const coreDb = await getCoreDb();
    const limitPerMinuteRaw = Number.parseInt(process.env.OPENAI_AI_ASSIST_MAX_RPM || '', 10);
    const limitPerMinute = Number.isFinite(limitPerMinuteRaw) && limitPerMinuteRaw > 0
      ? limitPerMinuteRaw
      : AI_ASSIST_DEFAULT_RPM;
    await enforceUserRateLimit(coreDb, session.user.email, 'openai:semantic-objects:ai-assist', limitPerMinute);
    const policyContext = await resolvePolicyContext(coreDb, session.user.email);
    await enforceApiRateLimit(coreDb, policyContext, 'semantic-objects:ai-assist');

    const resolvedPattern = MODELING_PATTERNS.includes(mainModelingPattern)
      ? mainModelingPattern
      : inferMainModelingPattern(userRequest);
    const normalizedPreferences = normalizeModelingPreferences(modelingPreferences);
    const hasExplicitTemporalPreference = typeof modelingPreferences?.includeTemporalEvents === 'boolean';
    if (!hasExplicitTemporalPreference) {
      normalizedPreferences.includeTemporalEvents = resolvedPattern === 'event_stream';
    }
    const safeClarificationAnswers = sanitizeClarificationAnswers({
      ...modelingPreferencesToClarificationAnswers(normalizedPreferences),
      ...(clarificationAnswers || {})
    });

    const domainDetection = detectDomainFromText(userRequest, semanticObject?.nodes || []);
    const domainTemplate = getDomainTemplate(domainDetection.domainId);
    const missingClarifications = getUnifiedClarificationQuestions({
      domainTemplate,
      answers: safeClarificationAnswers,
      userText: userRequest,
      chatHistory: sanitizeChatHistory(chatHistory),
      includeGlobal: true
    });
    const shouldRequireClarification =
      isCreationIntentText(userRequest) &&
      !skipClarifications &&
      (Array.isArray(semanticObject?.nodes) ? semanticObject.nodes.length <= 10 : true) &&
      missingClarifications.length > 0;

    if (shouldRequireClarification) {
      const clarificationQuestions = missingClarifications
        .map((question) => formatClarificationQuestion(question))
        .filter(Boolean);
      return NextResponse.json({
        explanation: `I detected the domain as ${domainTemplate.label} and need clarifications before generating the full structure.`,
        planSummary: 'Clarification preflight is required to improve modeling quality and avoid ambiguous structure.',
        clarificationQuestions,
        suggestedPrompts: domainTemplate.followUpPrompts || [],
        coverage: normalizeCoverage({}),
        operations: [],
        recommendedBlocks: [],
        reusableBlocks: {
          matched: [],
          applied: [],
          missed: [],
          counts: { matched: 0, applied: 0, missed: 0 }
        },
        agent: {
          stage: 'clarification_required',
          detectedDomain: domainDetection.domainId,
          confidence: domainDetection.confidence,
          matchedKeywords: domainDetection.matchedKeywords,
          process: buildAgentProcess('clarification_required'),
          domainTemplate: toTemplateSummary(domainTemplate)
        }
      });
    }

    const availableBlocks = await loadReusableBlocks(request);
    const prioritizedBlocks = prioritizeBlocksForDomain(availableBlocks, domainTemplate, 250);
    const domainContext = {
      detectedDomain: domainDetection.domainId,
      confidence: domainDetection.confidence,
      matchedKeywords: domainDetection.matchedKeywords,
      clarificationAnswers: safeClarificationAnswers,
      modelingPreferences: normalizedPreferences,
      domainTemplate: toTemplateSummary(domainTemplate),
      domainPromptTemplate: buildDomainPromptTemplate(domainTemplate, safeClarificationAnswers)
    };

    let response = await callOpenAIAPI(
      semanticObject,
      userRequest,
      prioritizedBlocks,
      chatHistory,
      resolvedPattern,
      domainContext,
      normalizedPreferences
    );

    if (shouldForceComprehensiveFallback(userRequest, semanticObject, response)) {
      response = normalizeAgentResponse(
        parseToOperations(userRequest, semanticObject, prioritizedBlocks, resolvedPattern)
      );
    }

    const vitalFocus = isVitalSignsRequest(userRequest) && !isLabStyleRequest(userRequest);
    if (response && vitalFocus && hasOverGenericVitalOperations(response.operations)) {
      response = normalizeAgentResponse(
        parseToOperations(userRequest, semanticObject, prioritizedBlocks, resolvedPattern)
      );
    }

    if (!response) {
      response = normalizeAgentResponse(
        parseToOperations(userRequest, semanticObject, prioritizedBlocks, resolvedPattern)
      );
    }

    response = ensureReusableBlockUsage(response, semanticObject, prioritizedBlocks, userRequest);

    const projectedNodes = projectNodesAfterOperations(
      Array.isArray(semanticObject?.nodes) ? semanticObject.nodes : [],
      response.operations
    );
    const heuristicRecommendations = suggestReusableBlockCandidates(projectedNodes, {
      domainId: domainDetection.domainId,
      maxCandidates: 6
    });
    const existingRecommendations = Array.isArray(response.recommendedBlocks)
      ? response.recommendedBlocks
      : [];
    const recommendationMap = new Map();
    [...existingRecommendations, ...heuristicRecommendations].forEach((candidate) => {
      if (!candidate || typeof candidate !== 'object') return;
      const key = `${candidate.nodeId || ''}:${candidate.suggestedBlockId || candidate.name || ''}`;
      if (!key) return;
      if (!recommendationMap.has(key)) recommendationMap.set(key, candidate);
    });
    const recommendedBlocks = Array.from(recommendationMap.values()).slice(0, 8);
    const reusableBlocks = buildReusableBlockSummary(
      userRequest,
      prioritizedBlocks,
      projectedNodes,
      response.operations
    );
    const unresolvedClarificationQuestions = missingClarifications
      .map((question) => formatClarificationQuestion(question))
      .filter(Boolean);

    response = {
      ...response,
      clarificationQuestions: Array.from(new Set([
        ...(Array.isArray(response.clarificationQuestions) ? response.clarificationQuestions : []),
        ...unresolvedClarificationQuestions
      ])).slice(0, 8),
      suggestedPrompts: Array.from(new Set([
        ...(Array.isArray(response.suggestedPrompts) ? response.suggestedPrompts : []),
        ...(domainTemplate.followUpPrompts || [])
      ])).slice(0, 8),
      recommendedBlocks,
      reusableBlocks,
      agent: {
        stage: 'ready_for_refinement',
        detectedDomain: domainDetection.domainId,
        confidence: domainDetection.confidence,
        matchedKeywords: domainDetection.matchedKeywords,
        process: buildAgentProcess('ready_for_refinement'),
        domainTemplate: toTemplateSummary(domainTemplate)
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    console.error('AI assist error:', error);

    if (Number.isInteger(error?.status) && error.status === 429) {
      return NextResponse.json({ error: error.message, details: error.details || null }, { status: 429 });
    }
    return NextResponse.json({
      explanation: `I encountered an error processing your request: ${error.message}`,
      planSummary: 'Execution failed before structural planning was completed.',
      clarificationQuestions: [],
      suggestedPrompts: [],
      coverage: normalizeCoverage({}),
      operations: []
    });
  }
}
