import { requireAuthenticatedUser } from '@/lib/security/api';
// POST /api/definitions/suggest-from-text
// OpenAI-powered assistant to suggest Context Object/Block structure from natural language

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { getCoreDb } from '@/lib/db/coreDb';
import { generateNodeId } from '@/lib/definitions/types';
import { enforceUserRateLimit } from '@/lib/security/rateLimit';
import { enforceApiRateLimit, resolvePolicyContext } from '@/lib/security/teamPolicy';
import { parseJsonWithLimit, PayloadTooLargeError } from '@/lib/uploads/bodyLimit';
import {
  detectDomainFromText,
  buildDetectionResult,
  getDomainTemplate,
  sanitizeClarificationAnswers,
  getUnifiedClarificationQuestions,
  buildDomainPromptTemplate,
  buildAgentProcess,
  suggestReusableBlockCandidates,
  toTemplateSummary,
  prioritizeBlocksForDomain,
  modelingPreferencesToClarificationAnswers,
  resolveProjectSettings
} from '@/lib/contextObjects/agentDomainTemplates';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL_CANDIDATES = [
  process.env.OPENAI_ASSISTANT_MODEL,
  process.env.OPENAI_MODEL,
  'gpt-5.3',
  'gpt-5',
  'gpt-5-mini',
  'gpt-4.1'
].filter(Boolean);
const SUGGEST_FROM_TEXT_MAX_BODY_BYTES = 512 * 1024; // 512KB
const SUGGEST_FROM_TEXT_DEFAULT_RPM = 10;

const VALID_ROLES = new Set(['field', 'group', 'section', 'event', 'event_series', 'block']);
const HEALTHCARE_PRIMARY_ANCHORS = new Set(['patient', 'participant', 'member', 'specimen']);
const HEADER_STATE_VALUES = new Set(['inherited', 'extended', 'local']);
const HEADER_ARRAY_ALLOWED_ATTRIBUTES = new Set(['sourceSystems', 'links']);
const VALID_DATA_TYPES = new Set([
  'string', 'number', 'integer', 'boolean', 'date', 'datetime',
  'object', 'array', 'code', 'quantity', 'reference'
]);

const SUGGEST_SYSTEM_PROMPT = `You are an expert clinical data model architect for ContextObjects Builder.

Goal:
Given a user request and available reusable blocks, produce a complete suggestion for an object structure.
If currentNodes are provided, treat the task as an ITERATIVE REFINEMENT and return the full updated structure.
If domainContext is provided, use it as mandatory guidance for domain scope, clarifications, and quality expectations.
ContextObjects are the canonical semantic modeling layer for healthcare data, including clinical, administrative (e.g., claims, care gaps), and omics/genomics use cases.
Design so instances can be stored consistently and queried reliably through stable semantic structure.
Act as a senior healthcare semantic data modeler building production-grade applications, not a demo-only assistant.

Hard requirements:
1) Reuse existing blocks aggressively. Prefer role="block" nodes whenever an available block covers the concept.
2) Return exactly one root node (parentNodeId=null) with:
   - role: "section"
   - dataType: "object"
   - attribute: "root"
   - occurrences: {"min":1,"max":1}
3) For block references:
   - role must be "block"
   - dataType must be "object"
   - include blockId and versionRange (use ^<version> from selected block)
4) For non-block fields:
   - role in {field, group, section, event, event_series}
   - dataType from allowed set
   - attribute in camelCase and unique among siblings
5) Provide nodes as a flat list with parentNodeId references.
6) Add only essential custom fields not already covered by reusable blocks.
7) In refinement mode, preserve existing nodes unless the user explicitly asks to remove or replace them.
8) When user asks to "create/build/design" an object, produce a comprehensive structure, not a minimal flat list.
9) Prefer clinically meaningful nesting: sections/groups, and event_series/event for temporal observations when applicable.
10) Preserve semantic queryability: stable attributes, coherent nesting, repeatable arrays for longitudinal/repeatable data, and reusable block references when possible.
11) Prefer production-ready semantics: clear cardinalities, explicit data types, lifecycle/status fields, timestamps, and identifiable context links.
12) If modelingPreferences is provided, honor it exactly for optional sections (metadata, subject, care context, performer context, temporal events, assessment/notes, reusable-block preference), unless the user explicitly overrides in text.
13) mainModelingPattern will be provided (event_stream|transactional|snapshot|workflow|registry). Use it to choose the primary structure shape.
14) Always include a root-level ContextHeader reusable block (attribute: contextHeader, role: block, blockKind: project_header). This header is inherited by default.
15) Keep header metadata compact (0..1 objects/fields); avoid arrays in header except optional sourceSystems[] and links[].
16) Respect domain template intent + skeleton groups from domainContext; LLM augments predefined skeleton instead of inventing random top-level containers.

Pattern guidance:
- event_stream: temporal/event-centric clinical observations (event_series -> event -> data points)
- transactional: header + repeatable line items (claims/orders/payments style)
- snapshot: grouped state at point-in-time (problem list/summary style), no forced events unless asked
- workflow: lifecycle/status + ordered steps with actor/time/outcome
- registry: subject enrollment/status + repeatable gaps/findings/interventions
- vital-signs focus: avoid analyte/dataPoint abstractions unless user explicitly asks for laboratory/analyte modeling.

Clinical document completeness checklist (use for any create/build request):
- document metadata (id, status, recorded/authored time)
- subject/patient context
- care/encounter/request context
- clinical content body (often repeatable)
- temporal model when observations evolve over time
- assessment/interpretation/conclusion
- performer/author/organization context
- notes/annotations when appropriate

You must iterate internally in 3 passes before finalizing:
- Pass 1: derive full clinical scope
- Pass 2: maximize block reuse using available blocks
- Pass 3: fill unavoidable gaps with minimal custom fields

Production-grade quality gates:
- Interoperability-ready shape: keep nodes compatible with terminology/structural bindings (FHIR, openEHR, and other mappings when needed).
- Data quality by design: add constraints/cardinality where they materially improve correctness.
- Governance-ready semantics: ensure model supports versioning, lifecycle, and audit/provenance metadata.
- Query-first structure: avoid flat lists when temporal or repeatable clinical patterns require nested arrays/events.
- Safety on ambiguity: when requirements are unclear, return a robust baseline plus neutral assumptions in description.

If the domain is specific (e.g., lab report, medication order, care gaps, claims, genomics), adapt the checklist but keep the same completeness principles.
Do not force a domain-specific preset unless the user explicitly asks for an example/sample/demo.
For broad requests, produce a neutral multi-domain scaffold with repeatable events and nested data points.

Return ONLY JSON with shape:
{
  "suggestedName": "...",
  "description": "...",
  "nodes": [ ... ]
}
No markdown.`;

const CREATE_INTENT_RE = /\b(create|build|design|new|from scratch|complete|comprehensive|full|clinical|document|report|summary|order|panel|generate|record|capture|track|collect|register|intake|log)\b/i;
const METADATA_SECTION_ATTRIBUTES = new Set(['metadata', 'documentmetadata', 'reportmetadata', 'ordermetadata']);
const DEFAULT_MODELING_PREFERENCES = {
  includeDocumentMetadata: true,
  includeSubjectContext: true,
  includeCareContext: true,
  includePerformerContext: true,
  includeTemporalEvents: true,
  includeAssessmentAndNotes: true,
  preferReusableBlocks: true
};
const MODELING_PATTERNS = ['event_stream', 'transactional', 'snapshot', 'workflow', 'registry'];

function normalizeModelingPreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ...DEFAULT_MODELING_PREFERENCES };
  }

  const normalized = { ...DEFAULT_MODELING_PREFERENCES };
  Object.keys(DEFAULT_MODELING_PREFERENCES).forEach((key) => {
    if (typeof input[key] === 'boolean') {
      normalized[key] = input[key];
    }
  });
  return normalized;
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
      return 'Prefer header + repeatable lineItems/item structure, explicit amounts/codes/status, and service/effective dates.';
    case 'workflow':
      return 'Prefer lifecycle/status and ordered steps with actor, timestamp, and outcome. Use repeatable steps for process execution.';
    case 'registry':
      return 'Prefer stable subject identity + enrollment/status periods + repeatable gap/findings/actions tracking.';
    case 'snapshot':
      return 'Prefer grouped sections and repeatable findings without forcing event-series unless explicit temporal progression is requested.';
    case 'event_stream':
    default:
      return 'Prefer event_series/event temporal structure with repeatable observations and per-event data points.';
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

function toCamelCase(value, fallback = 'field') {
  const raw = `${value || ''}`
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();
  if (!raw) return fallback;
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  const [first, ...rest] = parts;
  return `${first.toLowerCase()}${rest.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`).join('')}`;
}

function metadataCanonicalAttribute(attribute) {
  const lower = `${attribute || ''}`.toLowerCase();
  if (['documentid', 'documentidentifier', 'identifier'].includes(lower)) return 'documentId';
  if (['recordedtime', 'recordedtimestamp', 'timestamp'].includes(lower)) return 'recordedAt';
  if (['authoredtime', 'authoringtime'].includes(lower)) return 'authoredAt';
  if (['issuedtime'].includes(lower)) return 'issuedAt';
  if (['state'].includes(lower)) return 'status';
  return attribute;
}

function enforceRoleDataType(node) {
  const role = VALID_ROLES.has(node?.role) ? node.role : 'field';
  const normalized = { ...node, role };

  if (role === 'block') {
    if (typeof node?.blockId === 'string' && node.blockId.trim()) {
      normalized.blockId = node.blockId.trim();
      normalized.versionRange = (typeof node?.versionRange === 'string' && node.versionRange.trim())
        ? node.versionRange.trim()
        : '^1.0.0';
      normalized.dataType = 'object';
      return normalized;
    }
    normalized.role = 'group';
    normalized.dataType = 'object';
    delete normalized.blockId;
    delete normalized.versionRange;
    return normalized;
  }

  if (role === 'event_series') {
    normalized.dataType = 'array';
    return normalized;
  }

  if (role === 'section' || role === 'group' || role === 'event') {
    normalized.dataType = 'object';
    return normalized;
  }

  const candidateType = VALID_DATA_TYPES.has(node?.dataType) ? node.dataType : 'string';
  if (candidateType === 'object') {
    normalized.role = 'group';
    normalized.dataType = 'object';
    return normalized;
  }

  normalized.dataType = candidateType;
  return normalized;
}

function toPrimaryAnchor(value, fallback = 'patient') {
  const candidate = `${value || ''}`.trim().toLowerCase();
  if (HEALTHCARE_PRIMARY_ANCHORS.has(candidate)) return candidate;
  return fallback;
}

function normalizeHeaderState(value) {
  const candidate = `${value || ''}`.trim().toLowerCase();
  if (HEADER_STATE_VALUES.has(candidate)) return candidate;
  return 'inherited';
}

function skeletonGroupBlueprint(groupId) {
  const key = `${groupId || ''}`.trim();
  const defaults = {
    name: 'Clinical Content',
    attribute: 'clinicalContent',
    role: 'section',
    dataType: 'object',
    occurrences: { min: 0, max: 1 }
  };
  const map = {
    clinicalContent: defaults,
    claimsContent: {
      name: 'Claims Content',
      attribute: 'claimsContent',
      role: 'section',
      dataType: 'object',
      occurrences: { min: 0, max: 1 }
    },
    genomicsContent: {
      name: 'Genomics Content',
      attribute: 'genomicsContent',
      role: 'section',
      dataType: 'object',
      occurrences: { min: 0, max: 1 }
    },
    medicationContent: {
      name: 'Medication Content',
      attribute: 'medicationContent',
      role: 'section',
      dataType: 'object',
      occurrences: { min: 0, max: 1 }
    },
    events: {
      name: 'Events',
      attribute: 'events',
      role: 'event_series',
      dataType: 'array',
      occurrences: { min: 0, max: '*' }
    },
    assessment: {
      name: 'Assessment',
      attribute: 'assessment',
      role: 'section',
      dataType: 'object',
      occurrences: { min: 0, max: 1 }
    }
  };
  return map[key] || defaults;
}

function enforceHeaderFieldCardinality(nodes, headerNodeId) {
  if (!headerNodeId) return;
  const nodeMap = new Map(nodes.map((node) => [node.nodeId, node]));
  const stack = [headerNodeId];
  while (stack.length > 0) {
    const currentId = stack.pop();
    const children = nodes.filter((node) => node.parentNodeId === currentId);
    children.forEach((node) => {
      const attr = `${node.attribute || ''}`.trim();
      if (!HEADER_ARRAY_ALLOWED_ATTRIBUTES.has(attr)) {
        const max = node?.occurrences?.max;
        if (max === '*' || (typeof max === 'number' && max > 1)) {
          node.occurrences = { ...(node.occurrences || { min: 0, max: 1 }), max: 1 };
        }
        if (node.role === 'event_series') {
          node.role = 'group';
          node.dataType = 'object';
        }
        if (node.dataType === 'array') {
          node.dataType = 'object';
        }
      }
      if (nodeMap.has(node.nodeId)) {
        stack.push(node.nodeId);
      }
    });
  }
}

function nodeQualityScore(node) {
  let score = 0;
  if (typeof node?.description === 'string' && node.description.trim()) score += 2;
  if ((node?.occurrences?.min || 0) > 0) score += 1;
  if (node?.role === 'block' && node?.blockId) score += 3;
  if (node?.dataType === 'object' && ['section', 'group', 'event', 'block'].includes(node?.role)) score += 1;
  if (node?.dataType === 'array' && node?.role === 'event_series') score += 1;
  return score;
}

function inferSemanticDataType(name, attribute, currentDataType) {
  const hint = `${name || ''} ${attribute || ''}`.toLowerCase();
  if (/(^|[^a-z])(id|identifier|uuid|mrn|accession|encounterid|subjectid|performerid)($|[^a-z])/.test(hint)) return 'string';
  if (/(text|note|comment|description|narrative)/.test(hint)) return 'string';
  if (/(recorded|authored|issued|event).*time|timestamp|date/.test(hint)) return 'datetime';
  if (/(unit|ucum)/.test(hint)) return 'code';
  if (/(status|severity|gender|code|category)/.test(hint)) return 'code';
  if (/(amount|value|quantity|number|score|count|rate|ratio|percent|pct|magnitude)/.test(hint)) return 'quantity';
  return currentDataType;
}

function normalizeOccurrences(occ) {
  const min = typeof occ?.min === 'number' && occ.min >= 0 ? occ.min : 0;
  const max = occ?.max === '*' || (typeof occ?.max === 'number' && occ.max >= min) ? occ.max : 1;
  return { min, max };
}

const ROLE_SORT_ORDER = {
  section: 0,
  event_series: 1,
  event: 2,
  group: 3,
  block: 4,
  field: 5
};

const TOP_LEVEL_SECTION_ORDER = [
  'contextheader',
  'documentmetadata',
  'subjectcontext',
  'carecontext',
  'clinicalcontent',
  'assessment',
  'performercontext'
];

function valueOrderIndex(value, orderedValues) {
  const index = orderedValues.indexOf(`${value || ''}`.toLowerCase());
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function nodeSortRank(node, parentNode) {
  const parentAttr = `${parentNode?.attribute || ''}`.toLowerCase();
  const attr = `${node?.attribute || ''}`.toLowerCase();
  const role = `${node?.role || ''}`.toLowerCase();

  if (parentNode?.parentNodeId === null) {
    const topLevelRank = valueOrderIndex(attr, TOP_LEVEL_SECTION_ORDER);
    if (topLevelRank !== Number.MAX_SAFE_INTEGER) return topLevelRank;
  }

  if (parentAttr === 'documentmetadata') {
    const rank = valueOrderIndex(attr, ['documentid', 'status', 'recordedat', 'recordedtime', 'authoredat', 'issuedat']);
    if (rank !== Number.MAX_SAFE_INTEGER) return rank;
  }

  if (parentAttr === 'event') {
    const rank = valueOrderIndex(attr, ['eventtime', 'status', 'datapoints', 'datapoint']);
    if (rank !== Number.MAX_SAFE_INTEGER) return rank;
  }

  if (parentAttr === 'datapoint') {
    const rank = valueOrderIndex(attr, ['code', 'value', 'valuetext', 'unit', 'interpretation', 'bloodpressure', 'temperature']);
    if (rank !== Number.MAX_SAFE_INTEGER) return rank;
  }

  const roleRank = ROLE_SORT_ORDER[role] ?? 99;
  return 100 + roleRank;
}

function sortSiblings(parentNode, childIds, nodeById) {
  const sorted = [...childIds].sort((aId, bId) => {
    const a = nodeById.get(aId);
    const b = nodeById.get(bId);
    const rankDiff = nodeSortRank(a, parentNode) - nodeSortRank(b, parentNode);
    if (rankDiff !== 0) return rankDiff;

    const nameA = `${a?.name || a?.attribute || ''}`.toLowerCase();
    const nameB = `${b?.name || b?.attribute || ''}`.toLowerCase();
    return nameA.localeCompare(nameB);
  });
  return sorted;
}

function normalizeSuggestion(raw, fallbackName) {
  const suggestedName = `${raw?.suggestedName || fallbackName || 'ContextObject'}`.trim() || 'ContextObject';
  const description = `${raw?.description || ''}`.trim();
  const inputNodes = Array.isArray(raw?.nodes) ? raw.nodes : [];

  if (inputNodes.length === 0) {
    const rootId = generateNodeId();
    return {
      suggestedName,
      description,
      nodes: [
        {
          nodeId: rootId,
          parentNodeId: null,
          childrenNodeIds: [],
          role: 'section',
          name: suggestedName,
          attribute: 'root',
          dataType: 'object',
          occurrences: { min: 1, max: 1 },
          description: description || `Root of ${suggestedName}`
        }
      ]
    };
  }

  const usedIds = new Set();
  let nodes = inputNodes.map((node, index) => {
    let nodeId = typeof node?.nodeId === 'string' && node.nodeId.trim() ? node.nodeId.trim() : generateNodeId();
    while (usedIds.has(nodeId)) nodeId = generateNodeId();
    usedIds.add(nodeId);

    const role = VALID_ROLES.has(node?.role) ? node.role : 'field';
    const initialDataType = VALID_DATA_TYPES.has(node?.dataType) ? node.dataType : (role === 'block' ? 'object' : 'string');

    let attribute = typeof node?.attribute === 'string' && node.attribute.trim()
      ? node.attribute.trim()
      : `field${index + 1}`;

    if (index === 0 && (!node?.parentNodeId || node.parentNodeId === null)) {
      attribute = 'root';
    }

    const rawParent = node?.parentNodeId;
    const parentNodeId = typeof rawParent === 'string'
      ? (rawParent.trim() ? rawParent.trim() : null)
      : (rawParent === null ? null : null);

    const normalized = {
      nodeId,
      parentNodeId,
      childrenNodeIds: [],
      role,
      name: `${node?.name || attribute}`,
      attribute,
      dataType: inferSemanticDataType(node?.name || attribute, attribute, initialDataType),
      occurrences: normalizeOccurrences(node?.occurrences),
      description: typeof node?.description === 'string' ? node.description : undefined
    };

    if (typeof node?.blockKind === 'string' && node.blockKind.trim()) {
      normalized.blockKind = node.blockKind.trim();
    }
    if (typeof node?.headerState === 'string' && node.headerState.trim()) {
      normalized.headerState = normalizeHeaderState(node.headerState);
    }
    if (typeof node?.headerProfileId === 'string' && node.headerProfileId.trim()) {
      normalized.headerProfileId = node.headerProfileId.trim();
    }
    if (typeof node?.terminologyProfileId === 'string') {
      normalized.terminologyProfileId = node.terminologyProfileId.trim();
    }
    if (node?.centricity && typeof node.centricity === 'object' && !Array.isArray(node.centricity)) {
      normalized.centricity = {
        primary: toPrimaryAnchor(node.centricity.primary, 'patient'),
        secondary: Array.isArray(node.centricity.secondary) ? node.centricity.secondary : []
      };
    }
    if (node?.governanceDefaults && typeof node.governanceDefaults === 'object' && !Array.isArray(node.governanceDefaults)) {
      normalized.governanceDefaults = { ...node.governanceDefaults };
    }
    if (node?.requiredAnchors && typeof node.requiredAnchors === 'object' && !Array.isArray(node.requiredAnchors)) {
      normalized.requiredAnchors = { ...node.requiredAnchors };
    }

    if (normalized.role === 'field' && normalized.dataType === 'object') {
      normalized.role = 'group';
    }

    if (role === 'block') {
      if (typeof node?.blockId === 'string' && node.blockId.trim()) {
        normalized.blockId = node.blockId.trim();
      }
      if (normalized.blockId) {
        if (typeof node?.versionRange === 'string' && node.versionRange.trim()) {
          normalized.versionRange = node.versionRange.trim();
        } else {
          normalized.versionRange = '^1.0.0';
        }
        normalized.dataType = 'object';
      } else {
        // Keep suggestions save-safe: if block reference is incomplete, fall back to group.
        normalized.role = 'group';
        normalized.dataType = 'object';
      }
    }

    return normalized;
  });

  // Ensure exactly one root
  let root = nodes.find((n) => n.parentNodeId === null);
  if (!root) {
    const rootId = generateNodeId();
    root = {
      nodeId: rootId,
      parentNodeId: null,
      childrenNodeIds: [],
      role: 'section',
      name: suggestedName,
      attribute: 'root',
      dataType: 'object',
      occurrences: { min: 1, max: 1 },
      description: description || `Root of ${suggestedName}`
    };
    nodes.unshift(root);
    nodes.forEach((n) => {
      if (n.nodeId !== rootId && n.parentNodeId === null) n.parentNodeId = rootId;
    });
  }

  const allRoots = nodes.filter((n) => n.parentNodeId === null);
  if (allRoots.length > 1) {
    const keep = allRoots[0];
    allRoots.slice(1).forEach((r) => {
      r.parentNodeId = keep.nodeId;
    });
    root = keep;
  }

  root.attribute = 'root';
  root.role = 'section';
  root.dataType = 'object';
  root.occurrences = { min: 1, max: 1 };
  root.name = suggestedName;

  let nodeById = new Map(nodes.map((n) => [n.nodeId, n]));
  nodes.forEach((node, index) => {
    if (node.parentNodeId && !nodeById.has(node.parentNodeId)) {
      node.parentNodeId = root.nodeId;
    }

    if (node.nodeId === root.nodeId) return;
    const parentNode = nodeById.get(node.parentNodeId) || null;

    let normalizedAttribute = toCamelCase(node.attribute || node.name || `field${index + 1}`, `field${index + 1}`);
    if (METADATA_SECTION_ATTRIBUTES.has(`${parentNode?.attribute || ''}`.toLowerCase())) {
      normalizedAttribute = metadataCanonicalAttribute(normalizedAttribute);
    }

    node.attribute = normalizedAttribute;
    node.dataType = inferSemanticDataType(node?.name || normalizedAttribute, normalizedAttribute, node?.dataType || 'string');
    Object.assign(node, enforceRoleDataType(node));
  });

  // Re-home top-level context fields into canonical sections when present.
  const findRootChildSection = (attribute) => nodes.find(
    (n) => n.parentNodeId === root.nodeId && `${n.attribute || ''}`.toLowerCase() === `${attribute}`.toLowerCase()
  );

  const metadataSection = findRootChildSection('documentMetadata');
  const subjectSection = findRootChildSection('subjectContext');
  const performerSection = findRootChildSection('performerContext');
  const clinicalContentSection = findRootChildSection('clinicalContent');

  nodes.forEach((node) => {
    if (node.nodeId === root.nodeId || node.parentNodeId !== root.nodeId) return;
    if (node.role === 'section') return;

    const attr = `${node.attribute || ''}`.toLowerCase();
    if (metadataSection && ['recordedtime', 'recordedat', 'status', 'documentid', 'issuedat', 'authoredat'].includes(attr)) {
      node.parentNodeId = metadataSection.nodeId;
      node.attribute = metadataCanonicalAttribute(node.attribute);
      return;
    }
    if (subjectSection && ['patientcontext', 'subject', 'subjectcontext', 'patient', 'person'].includes(attr)) {
      node.parentNodeId = subjectSection.nodeId;
      return;
    }
    if (performerSection && ['performer', 'performercontext', 'author', 'provider'].includes(attr)) {
      node.parentNodeId = performerSection.nodeId;
      return;
    }
    if (clinicalContentSection && ['vitalsigns', 'contentblock', 'entrydata', 'result', 'results'].includes(attr)) {
      node.parentNodeId = clinicalContentSection.nodeId;
    }
  });

  // Deduplicate siblings by canonical attribute intent (including metadata aliases).
  nodeById = new Map(nodes.map((n) => [n.nodeId, n]));
  const removedNodeIds = new Set();
  const siblingKeysByParent = new Map();

  const siblingDedupeKey = (node) => {
    const parent = nodeById.get(node.parentNodeId) || null;
    const parentAttr = `${parent?.attribute || ''}`.toLowerCase();
    let attr = `${node.attribute || ''}`.toLowerCase();
    if (METADATA_SECTION_ATTRIBUTES.has(parentAttr)) {
      attr = `${metadataCanonicalAttribute(attr)}`.toLowerCase();
    }
    if (node.role === 'block') {
      const blockId = `${node.blockId || ''}`.toLowerCase();
      return `block:${blockId || attr}`;
    }
    return `${node.role}:${attr}`;
  };

  nodes.forEach((node) => {
    if (node.nodeId === root.nodeId || removedNodeIds.has(node.nodeId)) return;
    const parentId = node.parentNodeId || root.nodeId;
    if (!siblingKeysByParent.has(parentId)) siblingKeysByParent.set(parentId, new Map());
    const keyMap = siblingKeysByParent.get(parentId);
    const dedupeKey = siblingDedupeKey(node);
    const existingNodeId = keyMap.get(dedupeKey);

    if (!existingNodeId) {
      keyMap.set(dedupeKey, node.nodeId);
      return;
    }

    const existing = nodeById.get(existingNodeId);
    if (!existing) {
      keyMap.set(dedupeKey, node.nodeId);
      return;
    }

    const keep = nodeQualityScore(existing) >= nodeQualityScore(node) ? existing : node;
    const drop = keep.nodeId === existing.nodeId ? node : existing;
    keyMap.set(dedupeKey, keep.nodeId);

    if (!keep.description && drop.description) keep.description = drop.description;
    if ((drop.occurrences?.min || 0) > (keep.occurrences?.min || 0)) {
      keep.occurrences = { ...keep.occurrences, min: drop.occurrences.min };
    }

    nodes.forEach((candidate) => {
      if (candidate.parentNodeId === drop.nodeId) {
        candidate.parentNodeId = keep.nodeId;
      }
    });

    removedNodeIds.add(drop.nodeId);
  });

  nodes = nodes.filter((node) => !removedNodeIds.has(node.nodeId));

  // Ensure sibling attributes are unique (case-insensitive) after dedup.
  const siblingAttributes = new Map();
  nodes.forEach((node, index) => {
    if (node.nodeId === root.nodeId) return;
    const parentId = node.parentNodeId || root.nodeId;
    if (!siblingAttributes.has(parentId)) siblingAttributes.set(parentId, new Set());
    const seen = siblingAttributes.get(parentId);
    const baseAttribute = toCamelCase(node.attribute || node.name || `field${index + 1}`, `field${index + 1}`);
    let nextAttribute = baseAttribute;
    let suffix = 2;
    while (seen.has(nextAttribute.toLowerCase())) {
      nextAttribute = `${baseAttribute}${suffix}`;
      suffix += 1;
    }
    node.attribute = nextAttribute;
    seen.add(nextAttribute.toLowerCase());
  });

  const childrenMap = new Map(nodes.map((n) => [n.nodeId, []]));
  nodes.forEach((node) => {
    if (node.parentNodeId && childrenMap.has(node.parentNodeId)) {
      childrenMap.get(node.parentNodeId).push(node.nodeId);
    }
  });

  // Sort children from general to concrete and flatten node list in hierarchy order.
  const refreshedNodeById = new Map(nodes.map((n) => [n.nodeId, n]));
  for (const [parentId, childIds] of childrenMap.entries()) {
    const parent = refreshedNodeById.get(parentId);
    const sorted = sortSiblings(parent, childIds, refreshedNodeById);
    childrenMap.set(parentId, sorted);
  }

  const orderedNodes = [];
  const visited = new Set();
  const walk = (nodeId) => {
    if (!nodeId || visited.has(nodeId)) return;
    const node = refreshedNodeById.get(nodeId);
    if (!node) return;
    visited.add(nodeId);
    node.childrenNodeIds = childrenMap.get(nodeId) || [];
    orderedNodes.push(node);
    node.childrenNodeIds.forEach((childId) => walk(childId));
  };

  walk(root.nodeId);
  nodes.forEach((node) => {
    if (!visited.has(node.nodeId)) {
      node.childrenNodeIds = childrenMap.get(node.nodeId) || [];
      orderedNodes.push(node);
    }
  });

  return { suggestedName, description, nodes: orderedNodes };
}

function roleDataTypeToRmType(node) {
  const role = `${node?.role || ''}`.toLowerCase();
  const dataType = `${node?.dataType || ''}`.toLowerCase();

  if (role === 'section') return 'SECTION';
  if (role === 'event_series') return 'HISTORY';
  if (role === 'event') return 'EVENT';
  if (role === 'group') return 'CLUSTER';
  if (role === 'block') return 'CLUSTER';

  if (dataType === 'code') return 'DV_CODED_TEXT';
  if (dataType === 'quantity') return 'DV_QUANTITY';
  if (dataType === 'date') return 'DV_DATE';
  if (dataType === 'datetime') return 'DV_DATE_TIME';
  if (dataType === 'integer') return 'DV_COUNT';
  if (dataType === 'number') return 'DV_COUNT';
  if (dataType === 'boolean') return 'DV_BOOLEAN';
  if (dataType === 'reference') return 'DV_IDENTIFIER';
  if (dataType === 'array') return 'CLUSTER';
  if (dataType === 'object') return 'CLUSTER';
  return 'DV_TEXT';
}

function rmTypeToInputs(rmType, node) {
  if (rmType === 'DV_CODED_TEXT') {
    const terms = Array.isArray(node?.terminologyBindings) ? node.terminologyBindings : [];
    if (terms.length > 0) {
      return terms.map((binding) => ({
        terminology: `${binding?.system || 'local'}`.toLowerCase(),
        list: binding?.code
          ? [{ code: binding.code, label: binding.display || binding.code }]
          : []
      }));
    }
    return [{ terminology: 'local', list: [] }];
  }
  if (rmType === 'DV_QUANTITY') {
    return [
      { suffix: 'magnitude', type: 'DECIMAL' },
      { suffix: 'units', type: 'TEXT' }
    ];
  }
  if (rmType === 'DV_DATE_TIME') return [{ type: 'DATETIME' }];
  if (rmType === 'DV_DATE') return [{ type: 'DATE' }];
  if (rmType === 'DV_COUNT') return [{ type: 'INTEGER' }];
  if (rmType === 'DV_BOOLEAN') return [{ type: 'BOOLEAN' }];
  if (rmType === 'DV_IDENTIFIER') return [{ type: 'TEXT' }];
  if (rmType.startsWith('DV_')) return [{ type: 'TEXT' }];
  return [];
}

function sanitizeTemplateId(value = 'ContextObjectTemplate') {
  return `${value || 'ContextObjectTemplate'}`
    .replace(/[^A-Za-z0-9]+/g, '')
    .replace(/^\d+/, '')
    || 'ContextObjectTemplate';
}

function buildWebTemplateFromNodes({ suggestion, domainTemplate }) {
  const normalized = normalizeSuggestion(suggestion, suggestion?.suggestedName || 'ContextObject');
  const nodes = normalized.nodes || [];
  const root = nodes.find((node) => node.parentNodeId === null);
  if (!root) return null;

  const childMap = new Map(nodes.map((node) => [node.nodeId, []]));
  nodes.forEach((node) => {
    if (node.parentNodeId && childMap.has(node.parentNodeId)) {
      childMap.get(node.parentNodeId).push(node.nodeId);
    }
  });

  const nodeById = new Map(nodes.map((node) => [node.nodeId, node]));
  const buildTreeNode = (nodeId, parentAqlPath = '') => {
    const node = nodeById.get(nodeId);
    if (!node) return null;
    const rmType = roleDataTypeToRmType(node);
    const max = node?.occurrences?.max === '*' ? -1 : (node?.occurrences?.max ?? 1);
    const min = node?.occurrences?.min ?? 0;
    const attribute = `${node.attribute || ''}`.trim();
    const aqlPath = node.parentNodeId === null
      ? ''
      : `${parentAqlPath}/${attribute || 'value'}`;
    const children = (childMap.get(node.nodeId) || [])
      .map((childId) => buildTreeNode(childId, aqlPath))
      .filter(Boolean);
    const treeNode = {
      name: node.name || attribute || 'Node',
      localizedName: node.name || attribute || 'Node',
      rmType,
      nodeId: node.nodeId,
      min,
      max,
      localizedNames: { en: node.name || attribute || 'Node' },
      localizedDescriptions: {},
      aqlPath,
      children,
      ...(rmType.startsWith('DV_') ? { inputs: rmTypeToInputs(rmType, node) } : {})
    };
    return treeNode;
  };

  const children = (childMap.get(root.nodeId) || [])
    .map((childId) => buildTreeNode(childId, ''))
    .filter(Boolean);
  const templateLabel = normalized.suggestedName || root.name || 'ContextObject';
  const templateId = sanitizeTemplateId(templateLabel);
  const templateNodeId = root.nodeId || `co.${templateId.toLowerCase()}.v1`;
  const valueNodeCount = nodes.filter((node) => roleDataTypeToRmType(node).startsWith('DV_')).length;
  const repeatingNodeCount = nodes.filter((node) => node?.occurrences?.max === '*' || node?.occurrences?.max === -1 || (typeof node?.occurrences?.max === 'number' && node.occurrences.max > 1)).length;
  const rmTypes = Array.from(new Set(nodes.map((node) => roleDataTypeToRmType(node))));
  const terminologies = Array.from(new Set(
    nodes.flatMap((node) => (Array.isArray(node.terminologyBindings) ? node.terminologyBindings : []))
      .map((binding) => `${binding?.system || ''}`.toLowerCase())
      .filter(Boolean)
  ));
  const templateSummary = toTemplateSummary(domainTemplate);

  return {
    id: templateId,
    name: templateLabel,
    localizedName: templateLabel,
    rmType: 'COMPOSITION',
    nodeId: templateNodeId,
    min: 1,
    max: 1,
    localizedNames: { en: templateLabel },
    localizedDescriptions: {},
    aqlPath: '',
    children,
    metadata: {
      templateId,
      description: normalized.description || '',
      intent: templateSummary.intent,
      primaryAnchor: templateSummary.primaryAnchor,
      datatypes: rmTypes.filter((rmType) => rmType.startsWith('DV_')),
      terminologies,
      counts: {
        nodeCount: nodes.length,
        valueNodeCount,
        repeatingNodeCount
      }
    }
  };
}

function enforceProjectHeaderAndSkeleton({
  suggestion,
  domainTemplate,
  projectSettings,
  clarificationAnswers = {}
}) {
  const normalized = normalizeSuggestion(suggestion, suggestion?.suggestedName || 'ContextObject');
  const nodes = normalized.nodes.map((node) => ({ ...node }));
  const root = nodes.find((node) => node.parentNodeId === null);
  if (!root) return normalized;

  const templateSummary = toTemplateSummary(domainTemplate);
  const settings = resolveProjectSettings(projectSettings);
  const requestedAnchor = clarificationAnswers?.primary_anchor;
  const defaultAnchor = toPrimaryAnchor(
    requestedAnchor || templateSummary.primaryAnchor || settings.defaultCentricity,
    settings.defaultCentricity
  );
  const headerProfileId = settings.defaultHeaderProfileId || templateSummary.recommendedHeaderProfileId || 'header.patient.v1';
  const terminologyProfileId = settings.defaultTerminologyProfileId || templateSummary.recommendedTerminologyProfileId || '';

  const rootChildren = nodes.filter((node) => node.parentNodeId === root.nodeId);
  const headerCandidates = rootChildren.filter((node) =>
    node.blockKind === 'project_header' ||
    `${node.role || ''}`.toLowerCase() === 'header_block' ||
    (`${node.role || ''}`.toLowerCase() === 'block' && /contextheader|context_header|projectheader|project_header/i.test(`${node.blockId || ''} ${node.name || ''} ${node.attribute || ''}`))
  );

  let headerNode = headerCandidates[0];
  if (!headerNode) {
    headerNode = {
      nodeId: generateNodeId(),
      parentNodeId: root.nodeId,
      childrenNodeIds: [],
      role: 'block',
      name: 'Context Header',
      attribute: 'contextHeader',
      dataType: 'object',
      occurrences: { min: 1, max: 1 },
      blockId: 'ContextHeader',
      versionRange: '^1.0.0',
      blockKind: 'project_header',
      headerState: 'inherited',
      headerProfileId,
      terminologyProfileId,
      centricity: {
        primary: defaultAnchor,
        secondary: []
      },
      governanceDefaults: settings.governanceDefaults,
      requiredAnchors: settings.requiredAnchors,
      description: 'Project-level context header (inherited by default)'
    };
    nodes.push(headerNode);
  } else {
    headerNode.role = 'block';
    headerNode.dataType = 'object';
    headerNode.attribute = 'contextHeader';
    headerNode.name = headerNode.name || 'Context Header';
    headerNode.occurrences = { min: 1, max: 1 };
    headerNode.parentNodeId = root.nodeId;
    headerNode.blockId = headerNode.blockId || 'ContextHeader';
    headerNode.versionRange = headerNode.versionRange || '^1.0.0';
    headerNode.blockKind = 'project_header';
    headerNode.headerState = normalizeHeaderState(headerNode.headerState);
    headerNode.headerProfileId = `${headerNode.headerProfileId || headerProfileId}`.trim() || headerProfileId;
    headerNode.terminologyProfileId = `${headerNode.terminologyProfileId || terminologyProfileId}`.trim();
    const existingPrimary = headerNode?.centricity?.primary;
    headerNode.centricity = {
      primary: toPrimaryAnchor(existingPrimary || defaultAnchor, defaultAnchor),
      secondary: Array.isArray(headerNode?.centricity?.secondary) ? headerNode.centricity.secondary : []
    };
    headerNode.governanceDefaults = headerNode.governanceDefaults || settings.governanceDefaults;
    headerNode.requiredAnchors = headerNode.requiredAnchors || settings.requiredAnchors;
  }

  headerCandidates.slice(1).forEach((duplicate) => {
    nodes.forEach((node) => {
      if (node.parentNodeId === duplicate.nodeId) {
        node.parentNodeId = headerNode.nodeId;
      }
    });
  });

  const duplicateHeaderIds = new Set(headerCandidates.slice(1).map((node) => node.nodeId));
  const dedupedNodes = nodes.filter((node) => !duplicateHeaderIds.has(node.nodeId));
  const existingAttributes = new Set(
    dedupedNodes
      .filter((node) => node.parentNodeId === root.nodeId && node.nodeId !== headerNode.nodeId)
      .map((node) => `${node.attribute || ''}`.toLowerCase())
  );

  const requiredGroups = Array.isArray(templateSummary.requiredSkeletonGroups)
    ? templateSummary.requiredSkeletonGroups
    : [];
  const optionalGroups = Array.isArray(templateSummary.skeletonGroups)
    ? templateSummary.skeletonGroups
    : [];
  const groupsToEnsure = Array.from(new Set([...requiredGroups, ...optionalGroups]));

  groupsToEnsure.forEach((groupId) => {
    const blueprint = skeletonGroupBlueprint(groupId);
    if (existingAttributes.has(`${blueprint.attribute}`.toLowerCase())) return;
    dedupedNodes.push({
      nodeId: generateNodeId(),
      parentNodeId: root.nodeId,
      childrenNodeIds: [],
      role: blueprint.role,
      name: blueprint.name,
      attribute: blueprint.attribute,
      dataType: blueprint.dataType,
      occurrences: blueprint.occurrences,
      description: `${blueprint.name} skeleton group`
    });
    existingAttributes.add(`${blueprint.attribute}`.toLowerCase());
  });

  enforceHeaderFieldCardinality(dedupedNodes, headerNode.nodeId);

  return normalizeSuggestion(
    {
      suggestedName: normalized.suggestedName,
      description: normalized.description,
      nodes: dedupedNodes
    },
    normalized.suggestedName
  );
}

function isComprehensiveCreateIntent(text) {
  return CREATE_INTENT_RE.test(`${text || ''}`);
}

function hasStrongComprehensiveCoverage(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) return false;
  const root = nodes.find((n) => n.parentNodeId === null);
  if (!root) return false;

  const rootChildren = nodes.filter((n) => n.parentNodeId === root.nodeId);
  const attrs = new Set(rootChildren.map((n) => `${n.attribute || ''}`.toLowerCase()));
  const hasTemporalModel = nodes.some((n) => n.role === 'event_series') && nodes.some((n) => n.role === 'event');
  const nonRootCount = nodes.filter((n) => n.parentNodeId !== null).length;

  const coverageGroups = [
    ['metadata', 'documentmetadata', 'reportmetadata', 'ordermetadata'],
    ['subjectcontext', 'subject', 'patient', 'patientcontext'],
    ['carecontext', 'encountercontext', 'requestcontext', 'episodecontext'],
    ['clinicalcontent', 'content', 'results', 'findings', 'entries'],
    ['assessment', 'interpretation', 'conclusion'],
    ['performercontext', 'performer', 'authorcontext', 'providercontext']
  ];

  const coveredAreas = coverageGroups.reduce((count, group) => (
    count + (group.some((key) => attrs.has(key)) ? 1 : 0)
  ), 0);

  return nonRootCount >= 10 && coveredAreas >= 4 && hasTemporalModel;
}

function hasRequestedMeasurementDetail(description, nodes) {
  const lower = `${description || ''}`.toLowerCase();
  const needsBloodPressure = /\bblood\s*pressure\b|\bbp\b/.test(lower);
  const needsTemperature = /\btemperature\b|\btemp\b/.test(lower);

  if (!needsBloodPressure && !needsTemperature) return true;
  if (!Array.isArray(nodes) || nodes.length === 0) return false;

  const hasField = (pattern) => nodes.some(
    (n) => pattern.test(`${n.attribute || ''}`.toLowerCase()) || pattern.test(`${n.name || ''}`.toLowerCase())
  );

  if (needsBloodPressure) {
    if (!hasField(/\bsystolic\b/) || !hasField(/\bdiastolic\b/)) return false;
  }
  if (needsTemperature) {
    if (!hasField(/\btemperature\b/)) return false;
  }
  return true;
}

function hasOverGenericVitalArtifacts(nodes = []) {
  if (!Array.isArray(nodes) || nodes.length === 0) return false;
  return nodes.some((node) => {
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

function compactVitalSuggestion({
  description,
  suggestion,
  objectName,
  reusableBlocks,
  modelingPreferences = null
}) {
  const lower = `${description || ''}`.toLowerCase();
  const vitalFocus = isVitalSignsRequest(lower) && !isLabStyleRequest(lower);
  if (!vitalFocus) return normalizeSuggestion(suggestion, objectName || 'ContextObject');

  const normalized = normalizeSuggestion(suggestion, objectName || 'ContextObject');
  const hasBloodPressureIntent = /\bblood\s*pressure\b|\bbp\b/.test(lower);
  const hasTemperatureIntent = /\btemperature\b|\btemp\b/.test(lower);
  const needsCompaction =
    hasOverGenericVitalArtifacts(normalized.nodes) ||
    (hasBloodPressureIntent && !normalized.nodes.some((n) => /\bsystolic\b/i.test(`${n?.name || ''} ${n?.attribute || ''}`))) ||
    (hasBloodPressureIntent && !normalized.nodes.some((n) => /\bdiastolic\b/i.test(`${n?.name || ''} ${n?.attribute || ''}`))) ||
    (hasTemperatureIntent && !normalized.nodes.some((n) => /\btemperature\b/i.test(`${n?.name || ''} ${n?.attribute || ''}`)));

  if (!needsCompaction) return normalized;

  const childrenMap = new Map(normalized.nodes.map((node) => [node.nodeId, []]));
  normalized.nodes.forEach((node) => {
    if (node.parentNodeId && childrenMap.has(node.parentNodeId)) {
      childrenMap.get(node.parentNodeId).push(node.nodeId);
    }
  });

  const rootsToPrune = normalized.nodes
    .filter((node) => {
      const attr = `${node?.attribute || ''}`.toLowerCase();
      const name = `${node?.name || ''}`.toLowerCase();
      const role = `${node?.role || ''}`.toLowerCase();
      const blockHint = `${node?.blockId || ''} ${node?.name || ''} ${node?.description || ''}`.toLowerCase();
      if (['datapoints', 'datapoint', 'analyte', 'analytes'].includes(attr)) return true;
      if (/\b(data\s*point|analyte)\b/.test(name)) return true;
      if (role === 'block' && /\b(analyte|laboratory|lab)\b/.test(blockHint)) return true;
      return false;
    })
    .map((node) => node.nodeId);

  const removedIds = new Set();
  const markSubtree = (nodeId) => {
    if (!nodeId || removedIds.has(nodeId)) return;
    removedIds.add(nodeId);
    const children = childrenMap.get(nodeId) || [];
    children.forEach((childId) => markSubtree(childId));
  };
  rootsToPrune.forEach((nodeId) => markSubtree(nodeId));

  const filteredNodes = normalized.nodes.filter((node) => !removedIds.has(node.nodeId));
  const compacted = normalizeSuggestion(
    {
      suggestedName: normalized.suggestedName,
      description: normalized.description,
      nodes: filteredNodes
    },
    objectName || normalized.suggestedName || 'ContextObject'
  );

  return normalizeSuggestion(
    fallbackRefineSuggestion(
      description,
      compacted.suggestedName || objectName || 'ContextObject',
      compacted.nodes,
      reusableBlocks,
      modelingPreferences
    ),
    objectName || compacted.suggestedName || 'ContextObject'
  );
}


function simpleFallbackSuggestion(description, objectName, reusableBlocks = [], modelingPreferences = null) {
  const suggestedName = objectName || 'Clinical Document';
  const preferences = normalizeModelingPreferences(modelingPreferences);
  const lower = `${description || ''}`.toLowerCase();
  const vitalFocus = isVitalSignsRequest(lower) && !isLabStyleRequest(lower);
  const rootId = generateNodeId();

  const nodes = [
    {
      nodeId: rootId,
      parentNodeId: null,
      childrenNodeIds: [],
      role: 'section',
      name: suggestedName,
      attribute: 'root',
      dataType: 'object',
      occurrences: { min: 1, max: 1 },
      description: `Root of ${suggestedName}`
    }
  ];

  const addChild = (node) => {
    nodes[0].childrenNodeIds.push(node.nodeId);
    nodes.push(node);
  };

  const findBlock = (patterns) => reusableBlocks.find((b) =>
    patterns.some((re) => re.test(`${b.name} ${b.blockId} ${b.description || ''}`))
  );

  const createSection = (name, attribute) => {
    const section = {
      nodeId: generateNodeId(),
      parentNodeId: rootId,
      childrenNodeIds: [],
      role: 'section',
      name,
      attribute,
      dataType: 'object',
      occurrences: { min: 0, max: 1 },
      description: `${name} section`
    };
    addChild(section);
    return section;
  };

  const addBlockOrGroup = (parentNodeId, name, attribute, patterns, repeatable = false) => {
    const block = preferences.preferReusableBlocks ? findBlock(patterns) : null;
    const nodeId = generateNodeId();
    if (block) {
      addChild({
        nodeId,
        parentNodeId,
        childrenNodeIds: [],
        role: 'block',
        name,
        attribute,
        dataType: 'object',
        occurrences: { min: 0, max: repeatable ? '*' : 1 },
        blockId: block.blockId,
        versionRange: `^${block.version || '1.0.0'}`,
        description: `Reference to ${block.name}`
      });
      return null;
    }

    const group = {
      nodeId,
      parentNodeId,
      childrenNodeIds: [],
      role: 'group',
      name,
      attribute,
      dataType: 'object',
      occurrences: { min: 0, max: repeatable ? '*' : 1 },
      description: `${name} group`
    };
    addChild(group);
    return group;
  };

  const metadata = preferences.includeDocumentMetadata ? createSection('Document Metadata', 'documentMetadata') : null;
  const subject = preferences.includeSubjectContext ? createSection('Subject', 'subjectContext') : null;
  const careContext = preferences.includeCareContext ? createSection('Care Context', 'careContext') : null;
  const clinicalContent = createSection('Clinical Content', 'clinicalContent');
  const assessment = preferences.includeAssessmentAndNotes ? createSection('Assessment', 'assessment') : null;
  const performer = preferences.includePerformerContext ? createSection('Performer', 'performerContext') : null;

  if (subject && preferences.preferReusableBlocks) {
    addBlockOrGroup(subject.nodeId, 'Subject Block', 'subjectBlock', [/patient/i, /person/i, /demographic/i, /identifier/i]);
  }
  if (careContext && preferences.preferReusableBlocks) {
    addBlockOrGroup(careContext.nodeId, 'Context Block', 'contextBlock', [/encounter/i, /visit/i, /request/i, /order/i, /episode/i]);
  }
  if (performer && preferences.preferReusableBlocks) {
    addBlockOrGroup(performer.nodeId, 'Performer Block', 'performerBlock', [/performer/i, /provider/i, /practitioner/i, /organization/i, /author/i]);
  }

  if (metadata) {
    addChild({
      nodeId: generateNodeId(),
      parentNodeId: metadata.nodeId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Document ID',
      attribute: 'documentId',
      dataType: 'string',
      occurrences: { min: 1, max: 1 },
      description: 'Unique identifier for this document'
    });
    addChild({
      nodeId: generateNodeId(),
      parentNodeId: metadata.nodeId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Status',
      attribute: 'status',
      dataType: 'code',
      occurrences: { min: 1, max: 1 },
      description: 'Lifecycle status'
    });
    addChild({
      nodeId: generateNodeId(),
      parentNodeId: metadata.nodeId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Recorded At',
      attribute: 'recordedAt',
      dataType: 'datetime',
      occurrences: { min: 1, max: 1 },
      description: 'Document timestamp'
    });
  }

  if (preferences.includeTemporalEvents) {
    const eventSeries = {
      nodeId: generateNodeId(),
      parentNodeId: clinicalContent.nodeId,
      childrenNodeIds: [],
      role: 'event_series',
      name: 'Clinical Events',
      attribute: 'events',
      dataType: 'array',
      occurrences: { min: 0, max: '*' },
      description: 'Repeatable clinical events'
    };
    addChild(eventSeries);

    const event = {
      nodeId: generateNodeId(),
      parentNodeId: eventSeries.nodeId,
      childrenNodeIds: [],
      role: 'event',
      name: 'Clinical Event',
      attribute: 'event',
      dataType: 'object',
      occurrences: { min: 1, max: 1 },
      description: 'Single clinical event'
    };
    addChild(event);

    addChild({
      nodeId: generateNodeId(),
      parentNodeId: event.nodeId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Event Time',
      attribute: 'eventTime',
      dataType: 'datetime',
      occurrences: { min: 1, max: 1 },
      description: 'When this event occurred'
    });

    if (!vitalFocus) {
      addBlockOrGroup(event.nodeId, 'Entry Data', 'entryData', [/result/i, /observation/i, /finding/i, /diagnosis/i, /medication/i], false);
    }
  } else {
    if (!vitalFocus) {
      addBlockOrGroup(clinicalContent.nodeId, 'Entry Data', 'entryData', [/result/i, /observation/i, /finding/i, /diagnosis/i, /medication/i], true);
    }
  }

  if (vitalFocus) {
    const parentNodeId = preferences.includeTemporalEvents
      ? nodes.find((n) => n.parentNodeId && n.attribute === 'event')?.nodeId
      : clinicalContent.nodeId;
    if (parentNodeId) {
      addBlockOrGroup(parentNodeId, 'Vital Signs Panel', 'vitalSignsPanel', [/vital/i, /blood pressure/i, /temperature/i], false);
    }
  }

  if (assessment) {
    addChild({
      nodeId: generateNodeId(),
      parentNodeId: assessment.nodeId,
      childrenNodeIds: [],
      role: 'field',
      name: 'Clinical Notes',
      attribute: 'notes',
      dataType: 'string',
      occurrences: { min: 0, max: 1 },
      description: 'Interpretation, impression, or notes'
    });
  }

  return {
    suggestedName,
    description: `Suggested structure for ${suggestedName}`,
    nodes
  };
}

function makeUniqueAttribute(nodes, parentNodeId, desired) {
  let candidate = desired;
  let i = 2;
  while (nodes.some((n) => n.parentNodeId === parentNodeId && `${n.attribute}`.toLowerCase() === `${candidate}`.toLowerCase())) {
    candidate = `${desired}${i}`;
    i += 1;
  }
  return candidate;
}

function fallbackRefineSuggestion(description, objectName, currentNodes, reusableBlocks = [], modelingPreferences = null) {
  const preferences = normalizeModelingPreferences(modelingPreferences);
  const base = normalizeSuggestion(
    { suggestedName: objectName || 'ContextObject', description: '', nodes: currentNodes || [] },
    objectName || 'ContextObject'
  );
  const lower = `${description || ''}`.toLowerCase();
  const vitalFocus = isVitalSignsRequest(lower) && !isLabStyleRequest(lower);
  const nodes = base.nodes.map((n) => ({ ...n }));
  const root = nodes.find((n) => n.parentNodeId === null);

  if (!root) {
    return simpleFallbackSuggestion(description, objectName || 'ContextObject', reusableBlocks, preferences);
  }

  const addChild = (node) => {
    nodes.push(node);
  };

  const getOrCreateSection = (attribute, name) => {
    const existing = nodes.find((n) => n.parentNodeId === root.nodeId && `${n.attribute}`.toLowerCase() === attribute.toLowerCase());
    if (existing) return existing;

    const node = {
      nodeId: generateNodeId(),
      parentNodeId: root.nodeId,
      childrenNodeIds: [],
      role: 'section',
      name,
      attribute: makeUniqueAttribute(nodes, root.nodeId, attribute),
      dataType: 'object',
      occurrences: { min: 0, max: 1 },
      description: `${name} section`
    };
    addChild(node);
    return node;
  };

  const addBlockIfMissing = (section, patterns, defaultAttr) => {
    const block = reusableBlocks.find((b) => patterns.some((re) => re.test(`${b.name} ${b.blockId} ${b.description || ''}`)));
    if (!block) return;
    const exists = nodes.some(
      (n) =>
        n.parentNodeId === section.nodeId &&
        n.role === 'block' &&
        `${n.blockId || ''}`.toLowerCase() === `${block.blockId}`.toLowerCase()
    );
    if (exists) return;

    addChild({
      nodeId: generateNodeId(),
      parentNodeId: section.nodeId,
      childrenNodeIds: [],
      role: 'block',
      name: block.name,
      attribute: makeUniqueAttribute(nodes, section.nodeId, defaultAttr),
      dataType: 'object',
      occurrences: { min: 0, max: section.attribute === 'results' ? '*' : 1 },
      blockId: block.blockId,
      versionRange: `^${block.version || '1.0.0'}`,
      description: `Reference to ${block.name}`
    });
  };

  const wantsComprehensive =
    /create|build|design|complete|comprehensive|document|report|clinical|order|record|capture|track|collect|register|intake|log/.test(lower);

  if (wantsComprehensive) {
    const metadata = preferences.includeDocumentMetadata ? getOrCreateSection('documentMetadata', 'Document Metadata') : null;
    const subject = preferences.includeSubjectContext ? getOrCreateSection('subjectContext', 'Subject') : null;
    const careContext = preferences.includeCareContext ? getOrCreateSection('careContext', 'Care Context') : null;
    const clinicalContent = getOrCreateSection('clinicalContent', 'Clinical Content');
    const assessment = preferences.includeAssessmentAndNotes ? getOrCreateSection('assessment', 'Assessment') : null;
    const performer = preferences.includePerformerContext ? getOrCreateSection('performerContext', 'Performer') : null;

    if (preferences.preferReusableBlocks) {
      if (subject) addBlockIfMissing(subject, [/patient/i, /person/i, /demographic/i, /identifier/i], 'subjectBlock');
      if (careContext) addBlockIfMissing(careContext, [/encounter/i, /visit/i, /request/i, /order/i, /episode/i], 'contextBlock');
      if (!vitalFocus) {
        addBlockIfMissing(clinicalContent, [/observation/i, /result/i, /finding/i, /diagnosis/i, /medication/i], 'contentBlock');
      }
      if (assessment) addBlockIfMissing(assessment, [/assessment/i, /interpretation/i, /conclusion/i], 'assessmentBlock');
      if (performer) addBlockIfMissing(performer, [/performer/i, /provider/i, /practitioner/i, /organization/i, /author/i], 'performerBlock');
    }

    const ensureField = (parent, attribute, name, dataType, required = false) => {
      if (!parent) return;
      const exists = nodes.some((n) => n.parentNodeId === parent.nodeId && `${n.attribute}`.toLowerCase() === attribute.toLowerCase());
      if (exists) return;
      addChild({
        nodeId: generateNodeId(),
        parentNodeId: parent.nodeId,
        childrenNodeIds: [],
        role: 'field',
        name,
        attribute,
        dataType,
        occurrences: { min: required ? 1 : 0, max: 1 },
        description: `${name} field`
      });
    };

    ensureField(metadata, 'documentId', 'Document ID', 'string', true);
    ensureField(metadata, 'status', 'Status', 'code', true);
    ensureField(metadata, 'recordedAt', 'Recorded At', 'datetime', true);
    ensureField(assessment, 'notes', 'Clinical Notes', 'string', false);

    const getOrCreateNode = (parentNodeId, attribute, factory) => {
      const existing = nodes.find(
        (n) => n.parentNodeId === parentNodeId && `${n.attribute}`.toLowerCase() === attribute.toLowerCase()
      );
      if (existing) return existing;
      const created = factory();
      addChild(created);
      return created;
    };

    const wantsVitalSigns = /\bvital\s*sign/.test(lower);
    const wantsBloodPressure = /\bblood\s*pressure\b|\bbp\b/.test(lower);
    const wantsTemperature = /\btemperature\b|\btemp\b/.test(lower);

    if (preferences.includeTemporalEvents) {
      const existingSeries = nodes.find(
        (n) => n.parentNodeId === clinicalContent.nodeId && `${n.attribute}`.toLowerCase() === 'events'
      );
      const seriesNode = existingSeries || {
        nodeId: generateNodeId(),
        parentNodeId: clinicalContent.nodeId,
        childrenNodeIds: [],
        role: 'event_series',
        name: 'Clinical Events',
        attribute: 'events',
        dataType: 'array',
        occurrences: { min: 0, max: '*' },
        description: 'Repeatable clinical events'
      };
      if (!existingSeries) addChild(seriesNode);

      const existingEvent = nodes.find(
        (n) => n.parentNodeId === seriesNode.nodeId && `${n.attribute}`.toLowerCase() === 'event'
      );
      const eventNode = existingEvent || {
        nodeId: generateNodeId(),
        parentNodeId: seriesNode.nodeId,
        childrenNodeIds: [],
        role: 'event',
        name: 'Clinical Event',
        attribute: 'event',
        dataType: 'object',
        occurrences: { min: 1, max: 1 },
        description: 'Single clinical event'
      };
      if (!existingEvent) addChild(eventNode);

      const hasEventTime = nodes.some(
        (n) => n.parentNodeId === eventNode.nodeId && `${n.attribute}`.toLowerCase() === 'eventtime'
      );
      if (!hasEventTime) {
        addChild({
          nodeId: generateNodeId(),
          parentNodeId: eventNode.nodeId,
          childrenNodeIds: [],
          role: 'field',
          name: 'Event Time',
          attribute: 'eventTime',
          dataType: 'datetime',
          occurrences: { min: 1, max: 1 },
          description: 'When this event occurred'
        });
      }

      if (!vitalFocus) {
        const dataPoints = getOrCreateNode(eventNode.nodeId, 'dataPoints', () => ({
          nodeId: generateNodeId(),
          parentNodeId: eventNode.nodeId,
          childrenNodeIds: [],
          role: 'group',
          name: 'Data Points',
          attribute: 'dataPoints',
          dataType: 'array',
          occurrences: { min: 1, max: '*' },
          description: 'Repeatable data points captured for this event'
        }));

        const dataPoint = getOrCreateNode(dataPoints.nodeId, 'dataPoint', () => ({
          nodeId: generateNodeId(),
          parentNodeId: dataPoints.nodeId,
          childrenNodeIds: [],
          role: 'group',
          name: 'Data Point',
          attribute: 'dataPoint',
          dataType: 'object',
          occurrences: { min: 1, max: 1 },
          description: 'One measurement or observation item'
        }));

        ensureField(dataPoint, 'code', 'Code', 'code', true);
        ensureField(dataPoint, 'value', 'Value', 'quantity', false);
        ensureField(dataPoint, 'valueText', 'Value Text', 'string', false);
        ensureField(dataPoint, 'unit', 'Unit', 'code', false);
        ensureField(dataPoint, 'interpretation', 'Interpretation', 'code', false);
      }
      ensureField(eventNode, 'status', 'Status', 'code', true);

      if (wantsVitalSigns || wantsBloodPressure || wantsTemperature) {
        const vitalSignsPanel = getOrCreateNode(eventNode.nodeId, 'vitalSignsPanel', () => ({
          nodeId: generateNodeId(),
          parentNodeId: eventNode.nodeId,
          childrenNodeIds: [],
          role: 'group',
          name: 'Vital Signs Panel',
          attribute: 'vitalSignsPanel',
          dataType: 'object',
          occurrences: { min: 1, max: 1 },
          description: 'Clinical vital sign measurements'
        }));

        if (wantsBloodPressure) {
          const bloodPressureGroup = getOrCreateNode(vitalSignsPanel.nodeId, 'bloodPressure', () => ({
            nodeId: generateNodeId(),
            parentNodeId: vitalSignsPanel.nodeId,
            childrenNodeIds: [],
            role: 'group',
            name: 'Blood Pressure',
            attribute: 'bloodPressure',
            dataType: 'object',
            occurrences: { min: 0, max: 1 },
            description: 'Blood pressure measurement'
          }));

          ensureField(bloodPressureGroup, 'systolic', 'Systolic', 'quantity', true);
          ensureField(bloodPressureGroup, 'diastolic', 'Diastolic', 'quantity', true);
          ensureField(bloodPressureGroup, 'bpUnit', 'Blood Pressure Unit', 'code', false);
        }

        if (wantsTemperature) {
          ensureField(vitalSignsPanel, 'temperature', 'Temperature', 'quantity', false);
          ensureField(vitalSignsPanel, 'temperatureUnit', 'Temperature Unit', 'code', false);
        }
      }
    } else {
      if (!vitalFocus) {
        const clinicalDataPoints = getOrCreateNode(clinicalContent.nodeId, 'dataPoints', () => ({
          nodeId: generateNodeId(),
          parentNodeId: clinicalContent.nodeId,
          childrenNodeIds: [],
          role: 'group',
          name: 'Data Points',
          attribute: 'dataPoints',
          dataType: 'array',
          occurrences: { min: 1, max: '*' },
          description: 'Repeatable observation entries'
        }));
        const dataPoint = getOrCreateNode(clinicalDataPoints.nodeId, 'dataPoint', () => ({
          nodeId: generateNodeId(),
          parentNodeId: clinicalDataPoints.nodeId,
          childrenNodeIds: [],
          role: 'group',
          name: 'Data Point',
          attribute: 'dataPoint',
          dataType: 'object',
          occurrences: { min: 1, max: 1 },
          description: 'Single coded data point'
        }));
        ensureField(dataPoint, 'code', 'Code', 'code', true);
        ensureField(dataPoint, 'value', 'Value', 'quantity', false);
        ensureField(dataPoint, 'valueText', 'Value Text', 'string', false);
        ensureField(dataPoint, 'unit', 'Unit', 'code', false);
        ensureField(dataPoint, 'interpretation', 'Interpretation', 'code', false);
      }

      if (wantsVitalSigns || wantsBloodPressure || wantsTemperature) {
        const vitalSignsPanel = getOrCreateNode(clinicalContent.nodeId, 'vitalSignsPanel', () => ({
          nodeId: generateNodeId(),
          parentNodeId: clinicalContent.nodeId,
          childrenNodeIds: [],
          role: 'group',
          name: 'Vital Signs Panel',
          attribute: 'vitalSignsPanel',
          dataType: 'object',
          occurrences: { min: 1, max: 1 },
          description: 'Clinical vital sign measurements'
        }));

        if (wantsBloodPressure) {
          const bloodPressureGroup = getOrCreateNode(vitalSignsPanel.nodeId, 'bloodPressure', () => ({
            nodeId: generateNodeId(),
            parentNodeId: vitalSignsPanel.nodeId,
            childrenNodeIds: [],
            role: 'group',
            name: 'Blood Pressure',
            attribute: 'bloodPressure',
            dataType: 'object',
            occurrences: { min: 0, max: 1 },
            description: 'Blood pressure measurement'
          }));

          ensureField(bloodPressureGroup, 'systolic', 'Systolic', 'quantity', true);
          ensureField(bloodPressureGroup, 'diastolic', 'Diastolic', 'quantity', true);
          ensureField(bloodPressureGroup, 'bpUnit', 'Blood Pressure Unit', 'code', false);
        }

        if (wantsTemperature) {
          ensureField(vitalSignsPanel, 'temperature', 'Temperature', 'quantity', false);
          ensureField(vitalSignsPanel, 'temperatureUnit', 'Temperature Unit', 'code', false);
        }
      }
    }
  }

  return normalizeSuggestion(
    {
      suggestedName: base.suggestedName,
      description: base.description || `Updated structure for ${base.suggestedName}`,
      nodes
    },
    base.suggestedName
  );
}

async function loadReusableBlocks(request) {
  const blockMap = new Map();

  try {
    const coreDb = await getCoreDb();
    const coreBlocks = await coreDb.collection('sample_co_blocks')
      .find({}, { projection: { _id: 0, blockId: 1, version: 1, name: 1, description: 1 } })
      .limit(300)
      .toArray();

    coreBlocks.forEach((block) => {
      blockMap.set(`${block.blockId}:${block.version}`, { ...block, source: 'sample' });
    });
  } catch (error) {
    console.warn('Could not load core reusable blocks:', error.message);
  }

  try {
    const { db } = await getActiveTenantDb(request);
    const tenantBlocks = await db.collection('co_blocks')
      .find({}, { projection: { _id: 0, blockId: 1, version: 1, name: 1, description: 1 } })
      .limit(300)
      .toArray();

    tenantBlocks.forEach((block) => {
      // tenant block overrides sample block with same blockId+version
      blockMap.set(`${block.blockId}:${block.version}`, { ...block, source: 'saved' });
    });
  } catch (error) {
    console.warn('Could not load tenant reusable blocks:', error.message);
  }

  return Array.from(blockMap.values())
    .sort((a, b) => `${a.name}`.localeCompare(`${b.name}`));
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

async function callOpenAISuggestion({
  description,
  objectName,
  reusableBlocks,
  currentNodes = [],
  chatHistory = [],
  targetKind = 'context_object',
  modelingPreferences = null,
  mainModelingPattern = null,
  domainContext = null,
  projectSettings = null
}) {
  if (!OPENAI_API_KEY) return null;

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const isRefinement = Array.isArray(currentNodes) && currentNodes.length > 0;
  const resolvedPattern = MODELING_PATTERNS.includes(mainModelingPattern)
    ? mainModelingPattern
    : inferMainModelingPattern(description);

  const userPayload = {
    request: description,
    objectName: objectName || null,
    targetKind,
    isRefinement,
    mainModelingPattern: resolvedPattern,
    patternGuidance: buildPatternGuidance(resolvedPattern),
    modelingPreferences: normalizeModelingPreferences(modelingPreferences),
    projectSettings: projectSettings || null,
    domainContext,
    chatHistory: sanitizeChatHistory(chatHistory),
    currentNodes: isRefinement ? currentNodes : [],
    availableReusableBlocks: reusableBlocks
  };

  const messages = [
    { role: 'system', content: SUGGEST_SYSTEM_PROMPT },
    { role: 'user', content: JSON.stringify(userPayload) }
  ];

  for (const model of MODEL_CANDIDATES) {
    try {
      const response = await openai.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: 7000,
        response_format: { type: 'json_object' },
        messages
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) continue;

      const parsed = JSON.parse(content);
      return normalizeSuggestion(parsed, objectName || 'ContextObject');
    } catch (error) {
      console.warn(`OpenAI suggest-from-text failed with model ${model}:`, error.message);
    }
  }

  return null;
}

async function callOpenAIDomainDisambiguation({
  description,
  candidateTemplates = [],
  stageAResult = null
}) {
  if (!OPENAI_API_KEY) return null;
  if (!Array.isArray(candidateTemplates) || candidateTemplates.length === 0) return null;

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const allowedTemplateIds = candidateTemplates.map((item) => item.templateId).filter(Boolean);
  if (allowedTemplateIds.length === 0) return null;

  const disambiguationPrompt = [
    'Select exactly one templateId from allowedTemplateIds.',
    'Do not invent values.',
    'Return strict JSON with keys:',
    '{ "templateId": string, "primaryAnchor": "patient|participant|member|specimen|", "careSetting": "inpatient|outpatient|emergency|virtual|", "temporal": "snapshot|events|both|", "governance": "full|minimal|none|" }'
  ].join('\n');

  const payload = {
    request: description,
    allowedTemplateIds,
    candidateTemplates,
    stageAResult: stageAResult || null
  };

  for (const model of MODEL_CANDIDATES) {
    try {
      const response = await openai.chat.completions.create({
        model,
        temperature: 0,
        max_tokens: 250,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: disambiguationPrompt },
          { role: 'user', content: JSON.stringify(payload) }
        ]
      });
      const content = response.choices?.[0]?.message?.content;
      if (!content) continue;
      const parsed = JSON.parse(content);
      const templateId = `${parsed?.templateId || ''}`.trim();
      if (!allowedTemplateIds.includes(templateId)) continue;
      return {
        templateId,
        extracted: {
          primaryAnchor: `${parsed?.primaryAnchor || ''}`.trim() || undefined,
          careSetting: `${parsed?.careSetting || ''}`.trim() || undefined,
          temporal: `${parsed?.temporal || ''}`.trim() || undefined,
          governance: `${parsed?.governance || ''}`.trim() || undefined
        }
      };
    } catch (error) {
      console.warn(`OpenAI domain disambiguation failed with model ${model}:`, error.message);
    }
  }
  return null;
}

function enforceComprehensiveCreateSuggestion({
  suggestion,
  description,
  objectName,
  reusableBlocks,
  targetKind,
  modelingPreferences = null
}) {
  const normalized = normalizeSuggestion(suggestion, objectName || 'ContextObject');
  if (targetKind === 'block') return normalized;

  if (!hasRequestedMeasurementDetail(description, normalized.nodes)) {
    return fallbackRefineSuggestion(
      description,
      normalized.suggestedName || objectName || 'ContextObject',
      normalized.nodes,
      reusableBlocks,
      modelingPreferences
    );
  }

  if (!isComprehensiveCreateIntent(description)) return normalized;
  if (hasStrongComprehensiveCoverage(normalized.nodes)) return normalized;

  return fallbackRefineSuggestion(
    description,
    normalized.suggestedName || objectName || 'ContextObject',
    normalized.nodes,
    reusableBlocks,
    modelingPreferences
  );
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();
    const limitPerMinuteRaw = Number.parseInt(process.env.OPENAI_AI_ASSIST_MAX_RPM || '', 10);
    const limitPerMinute = Number.isFinite(limitPerMinuteRaw) && limitPerMinuteRaw > 0
      ? limitPerMinuteRaw
      : SUGGEST_FROM_TEXT_DEFAULT_RPM;
    await enforceUserRateLimit(coreDb, session.user.email, 'openai:definitions:suggest-from-text', limitPerMinute);
    const policyContext = await resolvePolicyContext(coreDb, session.user.email);
    await enforceApiRateLimit(coreDb, policyContext, 'definitions:suggest-from-text');

    const body = await parseJsonWithLimit(request, SUGGEST_FROM_TEXT_MAX_BODY_BYTES);
    const {
      description,
      objectName,
      currentNodes,
      chatHistory,
      targetKind,
      modelingPreferences,
      mainModelingPattern,
      clarificationAnswers,
      skipClarifications,
      projectSettings,
      forcedTemplateId
    } = body || {};

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'description is required and must be a string' },
        { status: 400 }
      );
    }
    const normalizedDescription = description.trim();
    if (!normalizedDescription) {
      return NextResponse.json(
        { error: 'description cannot be empty' },
        { status: 400 }
      );
    }

    const normalizedCurrentNodes = Array.isArray(currentNodes) && currentNodes.length > 0
      ? normalizeSuggestion(
        {
          suggestedName: objectName || 'ContextObject',
          description: '',
          nodes: currentNodes
        },
        objectName || 'ContextObject'
      ).nodes
      : [];
    const isRefinement = normalizedCurrentNodes.length > 0;
    const resolvedPattern = MODELING_PATTERNS.includes(mainModelingPattern)
      ? mainModelingPattern
      : inferMainModelingPattern(normalizedDescription);
    const normalizedPreferences = normalizeModelingPreferences(modelingPreferences);
    const hasExplicitTemporalPreference = typeof modelingPreferences?.includeTemporalEvents === 'boolean';
    if (!hasExplicitTemporalPreference) {
      normalizedPreferences.includeTemporalEvents = resolvedPattern === 'event_stream';
    }

    const preferenceClarificationAnswers = modelingPreferencesToClarificationAnswers(normalizedPreferences);
    const safeClarificationAnswers = sanitizeClarificationAnswers({
      ...preferenceClarificationAnswers,
      ...(clarificationAnswers || {})
    });
    const hasProjectHeaderProfile = !!(
      projectSettings &&
      typeof projectSettings === 'object' &&
      !Array.isArray(projectSettings) &&
      typeof projectSettings.defaultHeaderProfileId === 'string' &&
      projectSettings.defaultHeaderProfileId.trim()
    );
    const resolvedProjectSettings = resolveProjectSettings(projectSettings);
    const stageADetection = detectDomainFromText(normalizedDescription, normalizedCurrentNodes);
    const candidates = Array.isArray(stageADetection.candidateTemplates)
      ? stageADetection.candidateTemplates
      : [];
    const forcedTemplate = typeof forcedTemplateId === 'string' && forcedTemplateId.trim()
      ? forcedTemplateId.trim()
      : null;
    const shouldDisambiguate =
      !forcedTemplate &&
      !isRefinement &&
      stageADetection?.domainId !== 'generic' &&
      (
        (typeof stageADetection?.confidence === 'number' && stageADetection.confidence < 0.75) ||
        (typeof stageADetection?.scoreMargin === 'number' && stageADetection.scoreMargin < 2)
      );
    const disambiguation = shouldDisambiguate
      ? await callOpenAIDomainDisambiguation({
        description: normalizedDescription,
        candidateTemplates: candidates,
        stageAResult: stageADetection
      })
      : null;

    const selectedDomainId = forcedTemplate
      || disambiguation?.templateId
      || stageADetection.domainId;
    const domainTemplate = getDomainTemplate(selectedDomainId);
    const detectionResult = buildDetectionResult({
      selectedTemplateId: selectedDomainId,
      confidence: forcedTemplate
        ? Math.max(0.85, Number(stageADetection.confidence) || 0.85)
        : (typeof stageADetection.confidence === 'number' ? stageADetection.confidence : 0.2),
      matchedKeywords: stageADetection.matchedKeywords || [],
      text: normalizedDescription,
      candidateTemplates: candidates,
      extractedOverrides: disambiguation?.extracted || {}
    });
    const templateCandidates = candidates.map((candidate) => {
      const summary = toTemplateSummary(getDomainTemplate(candidate.templateId));
      return {
        templateId: summary.id,
        label: summary.label,
        description: summary.description,
        requiredAnchors: [summary.primaryAnchor].filter(Boolean),
        confidence: Math.min(1, (candidate.score || 0) / Math.max(1, (candidates[0]?.score || 1))),
        rationale: candidate.rationale || []
      };
    });
    const domainPromptTemplate = buildDomainPromptTemplate(domainTemplate, safeClarificationAnswers);
    const missingClarifications = getUnifiedClarificationQuestions({
      domainTemplate,
      answers: safeClarificationAnswers,
      userText: normalizedDescription,
      chatHistory: sanitizeChatHistory(chatHistory),
      includeGlobal: true,
      hasProjectHeaderProfile,
      detectionConfidence: detectionResult.confidence,
      detectedDomain: selectedDomainId
    });
    const pendingClarifications = missingClarifications.slice(0, 2);
    const shouldRequireClarification =
      !isRefinement &&
      (targetKind || 'context_object') !== 'block' &&
      isComprehensiveCreateIntent(normalizedDescription) &&
      !skipClarifications &&
      pendingClarifications.length > 0;

    if (shouldRequireClarification) {
      const clarificationTemplate = buildWebTemplateFromNodes({
        suggestion: {
          suggestedName: objectName || 'ContextObject',
          description: '',
          nodes: normalizedCurrentNodes
        },
        domainTemplate
      });
      return NextResponse.json({
        suggestedName: objectName || 'ContextObject',
        description: '',
        webTemplate: clarificationTemplate,
        clarificationQuestions: pendingClarifications.map((question) => ({
          id: question.id,
          question: question.question,
          options: question.options || [],
          required: !!question.required
        })),
        suggestedPrompts: domainTemplate.followUpPrompts || [],
        agent: {
          stage: 'clarification_required',
          detectedDomain: selectedDomainId,
          confidence: detectionResult.confidence,
          matchedKeywords: stageADetection.matchedKeywords,
          detectionResult,
          templateCandidates,
          process: buildAgentProcess('clarification_required'),
          domainTemplate: toTemplateSummary(domainTemplate),
          projectSettings: resolvedProjectSettings,
          reusableBlockCandidates: []
        }
      });
    }

    const reusableBlocks = await loadReusableBlocks(request);
    const prioritizedReusableBlocks = prioritizeBlocksForDomain(reusableBlocks, domainTemplate, 250);

    // OpenAI-first
    let suggestion = await callOpenAISuggestion({
      description: normalizedDescription,
      objectName: objectName || 'ContextObject',
      reusableBlocks: prioritizedReusableBlocks,
      currentNodes: normalizedCurrentNodes,
      chatHistory,
      targetKind,
      modelingPreferences: normalizedPreferences,
      mainModelingPattern: resolvedPattern,
      projectSettings: resolvedProjectSettings,
      domainContext: {
        detectedDomain: selectedDomainId,
        confidence: detectionResult.confidence,
        matchedKeywords: stageADetection.matchedKeywords,
        detectionResult,
        templateCandidates,
        clarificationAnswers: safeClarificationAnswers,
        projectSettings: resolvedProjectSettings,
        domainPromptTemplate,
        domainTemplate: toTemplateSummary(domainTemplate)
      }
    });

    // Deterministic fallback (no API key / model error)
    if (!suggestion) {
      if (isRefinement) {
        suggestion = fallbackRefineSuggestion(
          normalizedDescription,
          objectName || 'ContextObject',
          normalizedCurrentNodes,
          prioritizedReusableBlocks,
          normalizedPreferences
        );
      } else {
        suggestion = simpleFallbackSuggestion(
          normalizedDescription,
          objectName || 'ContextObject',
          prioritizedReusableBlocks,
          normalizedPreferences
        );
      }
      suggestion = normalizeSuggestion(suggestion, objectName || 'ContextObject');
    }

    suggestion = enforceComprehensiveCreateSuggestion({
      suggestion,
      description: normalizedDescription,
      objectName: objectName || 'ContextObject',
      reusableBlocks: prioritizedReusableBlocks,
      targetKind: targetKind || 'context_object',
      modelingPreferences: normalizedPreferences
    });

    suggestion = compactVitalSuggestion({
      description: normalizedDescription,
      suggestion,
      objectName: objectName || 'ContextObject',
      reusableBlocks: prioritizedReusableBlocks,
      modelingPreferences: normalizedPreferences
    });
    suggestion = enforceProjectHeaderAndSkeleton({
      suggestion,
      domainTemplate,
      projectSettings: resolvedProjectSettings,
      clarificationAnswers: safeClarificationAnswers
    });
    const reusableBlockCandidates = suggestReusableBlockCandidates(suggestion.nodes, {
      domainId: selectedDomainId,
      maxCandidates: 6
    });
    const webTemplate = buildWebTemplateFromNodes({ suggestion, domainTemplate });

    return NextResponse.json({
      suggestedName: suggestion.suggestedName,
      description: suggestion.description,
      webTemplate,
      clarificationQuestions: [],
      suggestedPrompts: domainTemplate.followUpPrompts || [],
      agent: {
        stage: 'proposal_ready',
        detectedDomain: selectedDomainId,
        confidence: detectionResult.confidence,
        matchedKeywords: stageADetection.matchedKeywords,
        detectionResult,
        templateCandidates,
        process: buildAgentProcess('proposal_ready'),
        domainTemplate: toTemplateSummary(domainTemplate),
        projectSettings: resolvedProjectSettings,
        reusableBlockCandidates
      }
    });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }

    console.error('Error suggesting from text:', error);
    const status = Number.isInteger(error?.status) ? error.status : 500;
    const message = status >= 500
      ? 'Failed to generate suggestion'
      : (error?.message || 'Request failed');
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
