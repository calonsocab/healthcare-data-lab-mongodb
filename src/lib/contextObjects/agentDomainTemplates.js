const DOMAIN_TEMPLATE_MAP = {
  clinical: {
    id: 'clinical',
    label: 'Clinical',
    description: 'Clinical care documentation, observations, and longitudinal care context.',
    focusAreas: ['clinical events', 'subject context', 'care context', 'assessment'],
    blockKeywords: ['vital', 'observation', 'problem', 'diagnosis', 'allergy', 'encounter', 'patient', 'performer'],
    keywords: [
      'clinical', 'vital', 'observation', 'diagnosis', 'problem', 'allergy', 'imaging',
      'laboratory', 'lab', 'result', 'encounter', 'episode', 'symptom',
      'patient', 'deterioration', 'news2', 'mews', 'sepsis', 'clinician', 'intervention',
      'triage', 'monitoring', 'escalation', 'care plan', 'care pathway'
    ],
    clarifications: [
      {
        id: 'care_setting',
        question: 'Which care setting is the main target?',
        options: [
          { value: 'inpatient', label: 'Inpatient' },
          { value: 'outpatient', label: 'Outpatient' },
          { value: 'emergency', label: 'Emergency' },
          { value: 'virtual', label: 'Virtual / Remote' }
        ],
        required: true,
        autoDetect: [
          { value: 'inpatient', patterns: [/inpatient|ward|admission/] },
          { value: 'outpatient', patterns: [/outpatient|ambulatory|clinic/] },
          { value: 'emergency', patterns: [/emergency|ed\b|er\b/] },
          { value: 'virtual', patterns: [/virtual|remote|telemedicine|telehealth/] }
        ]
      },
      {
        id: 'temporal_granularity',
        question: 'How temporal should the model be?',
        options: [
          { value: 'event_stream', label: 'Temporal events' },
          { value: 'snapshot', label: 'Point-in-time snapshot' },
          { value: 'mixed', label: 'Both snapshot + events' }
        ],
        required: true,
        autoDetect: [
          { value: 'event_stream', patterns: [/longitudinal|timeline|event|over time|trend/] },
          { value: 'snapshot', patterns: [/snapshot|single time|point in time|current state/] }
        ]
      },
      {
        id: 'include_metadata',
        question: 'Include document governance metadata?',
        options: [
          { value: 'full', label: 'Yes, full metadata' },
          { value: 'minimal', label: 'Minimal metadata' },
          { value: 'none', label: 'No metadata' }
        ],
        required: false,
        autoDetect: [
          { value: 'full', patterns: [/audit|provenance|governance|metadata/] },
          { value: 'none', patterns: [/no metadata|without metadata/] }
        ]
      }
    ],
    followUpPrompts: [
      'Specialize this model for my exact clinical workflow and mandatory fields',
      'Add terminology bindings and interoperability mappings (FHIR/openEHR)',
      'Propose which groups should become reusable blocks'
    ],
    promptTemplate: `Design a production-grade clinical ContextObject.
- Use clinically meaningful hierarchy and stable attributes.
- Use event_series/event when temporal progression is needed.
- Keep structure query-friendly and avoid unnecessary generic wrappers.`
  },
  claims: {
    id: 'claims',
    label: 'Claims & Revenue Cycle',
    description: 'Administrative and financial data models for claims, adjudication, and billing.',
    focusAreas: ['transaction header', 'line items', 'payer context', 'adjudication status'],
    blockKeywords: ['claim', 'payer', 'subscriber', 'provider', 'line item', 'coverage', 'service'],
    keywords: [
      'claim', 'x12', 'billing', 'payer', 'adjudication', 'invoice', 'coverage',
      'eligibility', 'remittance', 'prior auth', 'authorization',
      'cpt', 'hcpcs', 'icd', 'denial', 'appeal', 'member'
    ],
    clarifications: [
      {
        id: 'transaction_type',
        question: 'Which transaction type is primary?',
        options: [
          { value: 'claim_submission', label: 'Claim submission' },
          { value: 'prior_auth', label: 'Prior authorization' },
          { value: 'remittance', label: 'Remittance / adjudication' },
          { value: 'eligibility', label: 'Eligibility' }
        ],
        required: true
      },
      {
        id: 'line_item_depth',
        question: 'How detailed should line items be?',
        options: [
          { value: 'minimal', label: 'Minimal' },
          { value: 'standard', label: 'Standard' },
          { value: 'full', label: 'Full coding + amounts' }
        ],
        required: true
      },
      {
        id: 'coordination_of_benefits',
        question: 'Include coordination-of-benefits context?',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' }
        ],
        required: false
      }
    ],
    followUpPrompts: [
      'Add adjudication details and denial reason handling',
      'Add pricing and allowed amounts at line level',
      'Suggest reusable blocks for subscriber, provider, and service line'
    ],
    promptTemplate: `Design a production-grade claims ContextObject.
- Prefer transactional hierarchy: header + repeatable line items.
- Include lifecycle/status and payer interaction state.
- Keep coding/amount fields explicit and queryable.`
  },
  genomics: {
    id: 'genomics',
    label: 'Genomics',
    description: 'Genomics and molecular diagnostics structures for sequencing and variants.',
    focusAreas: ['specimen context', 'assay metadata', 'variants', 'interpretation'],
    blockKeywords: ['gene', 'variant', 'specimen', 'assay', 'interpretation', 'biomarker'],
    keywords: [
      'genomic', 'genetics', 'variant', 'sequencing', 'vcf', 'allele', 'transcript',
      'biomarker', 'molecular', 'hgvs', 'gene', 'somatic', 'germline',
      'cnv', 'fusion', 'pathogenic', 'assay'
    ],
    clarifications: [
      {
        id: 'sequencing_scope',
        question: 'What sequencing scope is needed?',
        options: [
          { value: 'targeted_panel', label: 'Targeted panel' },
          { value: 'wes', label: 'Whole exome' },
          { value: 'wgs', label: 'Whole genome' },
          { value: 'other', label: 'Other / mixed' }
        ],
        required: true
      },
      {
        id: 'variant_detail_level',
        question: 'How detailed should variant representation be?',
        options: [
          { value: 'summary', label: 'Summary' },
          { value: 'clinical', label: 'Clinical detail' },
          { value: 'bioinformatic', label: 'Bioinformatic detail' }
        ],
        required: true
      },
      {
        id: 'include_interpretation',
        question: 'Include structured interpretation and evidence?',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' }
        ],
        required: false
      }
    ],
    followUpPrompts: [
      'Add assay quality metrics and confidence evidence',
      'Propose reusable blocks for variant, transcript, and interpretation',
      'Add links to phenotype and treatment implications'
    ],
    promptTemplate: `Design a production-grade genomics ContextObject.
- Separate assay context, variant findings, and interpretation layers.
- Keep repeatable variant arrays and evidence traceability.
- Ensure structure supports cohort analytics and longitudinal updates.`
  },
  medication: {
    id: 'medication',
    label: 'Medication',
    description: 'Medication order and administration data models with lifecycle and safety context.',
    focusAreas: ['order metadata', 'dose instructions', 'administration events', 'safety checks'],
    blockKeywords: ['medication', 'dose', 'route', 'frequency', 'administration', 'dispense'],
    keywords: [
      'medication', 'drug', 'prescription', 'dosage', 'administration', 'route',
      'frequency', 'dispense', 'refill', 'med', 'mar', 'titration', 'infusion'
    ],
    clarifications: [
      {
        id: 'workflow_scope',
        question: 'Which medication workflow scope should be modeled?',
        options: [
          { value: 'order_only', label: 'Order only' },
          { value: 'order_and_admin', label: 'Order + administration' },
          { value: 'full_lifecycle', label: 'Full lifecycle' }
        ],
        required: true
      },
      {
        id: 'safety_checks',
        question: 'Include safety check structures?',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' }
        ],
        required: false
      }
    ],
    followUpPrompts: [
      'Add administration event timeline and adherence fields',
      'Add allergy/interaction checks and override rationale',
      'Suggest reusable blocks for dosage instructions and dispense details'
    ],
    promptTemplate: `Design a production-grade medication ContextObject.
- Model lifecycle and status transitions clearly.
- Support repeatable dosing and administration events when needed.
- Keep dose, route, frequency, and timing explicit.`
  },
  generic: {
    id: 'generic',
    label: 'Generic Healthcare',
    description: 'General healthcare semantic model when no specific domain is clear.',
    focusAreas: ['metadata', 'context', 'content', 'reusability'],
    blockKeywords: ['identifier', 'name', 'address', 'contact', 'context'],
    keywords: [],
    clarifications: [
      {
        id: 'primary_domain',
        question: 'Which primary domain should this model target?',
        options: [
          { value: 'clinical', label: 'Clinical' },
          { value: 'claims', label: 'Claims / revenue cycle' },
          { value: 'genomics', label: 'Genomics' },
          { value: 'medication', label: 'Medication-focused' }
        ],
        required: true
      }
    ],
    followUpPrompts: [
      'Specialize this generic structure for my exact domain',
      'Suggest reusable blocks for the current tree',
      'Add stricter constraints and mandatory cardinalities'
    ],
    promptTemplate: `Design a robust generic healthcare ContextObject scaffold.
- Keep it reusable across domains.
- Include context, temporal support, and governance-ready metadata.
- Avoid over-specific domain assumptions unless requested.`
  }
};

const HEALTHCARE_CENTRICITIES = ['patient', 'participant', 'member', 'specimen'];

export const DEFAULT_PROJECT_SETTINGS = {
  defaultCentricity: 'patient',
  defaultHeaderProfileId: 'header.patient.v1',
  defaultTerminologyProfileId: '',
  governanceDefaults: {
    sensitivity: 'moderate',
    allowedPurposes: ['care_delivery']
  },
  requiredAnchors: {
    requireSubjectEhrId: true,
    allowEncounter: true,
    allowEpisodeOfCare: true,
    allowClaim: false,
    allowCoverage: false,
    allowStudy: false,
    allowVisit: true,
    allowProtocol: false,
    allowSample: false,
    allowRun: false
  }
};

const TEMPLATE_ENRICHMENTS = {
  clinical: {
    intent: 'care_delivery',
    primaryAnchor: 'patient',
    allowedSecondaryAnchors: ['episodeOfCare', 'encounter', 'visit'],
    recommendedHeaderProfileId: 'header.patient.v1',
    recommendedTerminologyProfileId: 'term.clinical.core.v1',
    recommendedBlockPriority: ['context_header', 'clinical_event', 'observation', 'assessment'],
    requiredBlocks: ['ContextHeader'],
    skeletonGroups: ['clinicalContent', 'events', 'assessment'],
    requiredSkeletonGroups: ['clinicalContent'],
    blockReusePolicy: [
      'Prefer saved blocks over samples',
      'Prefer clinical event blocks before generic observation blocks'
    ],
    terminologySuggestionsByGroup: {
      observation: ['LOINC', 'UCUM'],
      vitals: ['LOINC', 'UCUM'],
      diagnosis: ['SNOMED-CT', 'ICD-10'],
      problem: ['SNOMED-CT', 'ICD-10'],
      medications: ['RxNorm', 'ATC']
    }
  },
  claims: {
    intent: 'payer_claims',
    primaryAnchor: 'member',
    allowedSecondaryAnchors: ['claim', 'coverage', 'encounter'],
    recommendedHeaderProfileId: 'header.member.v1',
    recommendedTerminologyProfileId: 'term.claims.core.v1',
    recommendedBlockPriority: ['context_header', 'claim_header', 'line_item', 'adjudication'],
    requiredBlocks: ['ContextHeader'],
    skeletonGroups: ['claimsContent', 'events', 'assessment'],
    requiredSkeletonGroups: ['claimsContent'],
    blockReusePolicy: [
      'Prefer saved blocks over samples',
      'Prefer claim and adjudication blocks before generic financial groups'
    ],
    terminologySuggestionsByGroup: {
      diagnosis: ['ICD-10'],
      procedures: ['CPT', 'HCPCS'],
      claims: ['ICD-10', 'CPT', 'HCPCS']
    }
  },
  genomics: {
    intent: 'genomics_pipeline',
    primaryAnchor: 'specimen',
    allowedSecondaryAnchors: ['sample', 'run', 'study', 'visit'],
    recommendedHeaderProfileId: 'header.specimen.v1',
    recommendedTerminologyProfileId: 'term.genomics.core.v1',
    recommendedBlockPriority: ['context_header', 'specimen', 'assay', 'variant', 'interpretation'],
    requiredBlocks: ['ContextHeader'],
    skeletonGroups: ['genomicsContent', 'events', 'assessment'],
    requiredSkeletonGroups: ['genomicsContent'],
    blockReusePolicy: [
      'Prefer saved blocks over samples',
      'Prefer specimen and assay blocks before generic observations'
    ],
    terminologySuggestionsByGroup: {
      variants: ['HGVS', 'Sequence Ontology'],
      labs: ['LOINC', 'UCUM']
    }
  },
  medication: {
    intent: 'care_delivery',
    primaryAnchor: 'patient',
    allowedSecondaryAnchors: ['encounter', 'visit', 'episodeOfCare'],
    recommendedHeaderProfileId: 'header.patient.v1',
    recommendedTerminologyProfileId: 'term.medication.core.v1',
    recommendedBlockPriority: ['context_header', 'medication_order', 'administration', 'safety'],
    requiredBlocks: ['ContextHeader'],
    skeletonGroups: ['medicationContent', 'events', 'assessment'],
    requiredSkeletonGroups: ['medicationContent'],
    blockReusePolicy: [
      'Prefer saved blocks over samples',
      'Prefer medication lifecycle blocks before generic groups'
    ],
    terminologySuggestionsByGroup: {
      medications: ['RxNorm', 'ATC'],
      adverseEvents: ['MedDRA', 'CTCAE']
    }
  },
  generic: {
    intent: 'care_delivery',
    primaryAnchor: 'patient',
    allowedSecondaryAnchors: ['encounter', 'episodeOfCare', 'visit', 'study', 'protocol', 'sample', 'run'],
    recommendedHeaderProfileId: 'header.patient.v1',
    recommendedTerminologyProfileId: 'term.healthcare.generic.v1',
    recommendedBlockPriority: ['context_header', 'observation', 'assessment'],
    requiredBlocks: ['ContextHeader'],
    skeletonGroups: ['clinicalContent', 'events', 'assessment'],
    requiredSkeletonGroups: ['clinicalContent'],
    blockReusePolicy: ['Prefer saved blocks over samples'],
    terminologySuggestionsByGroup: {
      labs: ['LOINC', 'UCUM'],
      diagnosis: ['SNOMED-CT', 'ICD-10'],
      medications: ['RxNorm', 'ATC']
    }
  }
};

const PROCESS_STEPS = [
  {
    id: 'capture_prompt',
    label: 'Capture prompt',
    description: 'Parse the user intent, constraints, and target data product scope from the latest instruction and recent chat turns.'
  },
  {
    id: 'detect_domain',
    label: 'Hybrid detect domain',
    description: 'Run deterministic domain/template scoring first, then optional constrained LLM disambiguation when confidence is low.'
  },
  {
    id: 'clarify_gaps',
    label: 'Clarify product gaps',
    description: 'Ask template-owned, product-specific questions (for example boundary and temporal behavior) while reusing project header defaults.'
  },
  {
    id: 'scan_blocks',
    label: 'Scan reusable blocks',
    description: 'Prioritize candidate reusable blocks from sample and saved libraries to maximize reuse before creating custom nodes.'
  },
  {
    id: 'generate_structure',
    label: 'Apply skeleton + LLM fill',
    description: 'Apply deterministic template skeleton (including ContextHeader) and then use LLM only to enrich allowed subtrees.'
  },
  {
    id: 'recommend_blocks',
    label: 'Lint + recommend blocks',
    description: 'Run healthcare/webtemplate lint checks with safe fixes, then identify cohesive subtrees for reusable block extraction.'
  },
  {
    id: 'refine_and_save',
    label: 'Refine manually/AI and save draft',
    description: 'Iterate with manual or AI edits, then save the resulting ContextObject draft for continued evolution and governance.'
  }
];

export const MODELING_PATTERNS = ['event_stream', 'transactional', 'snapshot', 'workflow', 'registry'];

export const DEFAULT_MODELING_PREFERENCES = {
  includeDocumentMetadata: true,
  includeSubjectContext: true,
  includeCareContext: true,
  includePerformerContext: true,
  includeTemporalEvents: true,
  includeAssessmentAndNotes: true,
  preferReusableBlocks: true
};

const GLOBAL_QUALITY_CLARIFICATIONS = [
  {
    id: 'primary_anchor',
    question: 'What is the primary anchor for this model?',
    options: [
      { value: 'patient', label: 'Patient' },
      { value: 'participant', label: 'Participant' },
      { value: 'member', label: 'Member / Beneficiary' },
      { value: 'specimen', label: 'Specimen' }
    ],
    required: true,
    autoDetect: [
      { value: 'patient', patterns: [/\bpatient\b/] },
      { value: 'participant', patterns: [/\bparticipant\b|\bsubject\b|\btrial\b/] },
      { value: 'member', patterns: [/\bmember\b|\bbeneficiary\b|\bpayer\b|\bclaim\b/] },
      { value: 'specimen', patterns: [/\bspecimen\b|\bsample\b|\bsequencing\b|\bgenomic/] }
    ]
  },
  {
    id: 'documentation_intent',
    question: 'What is the primary documentation intent?',
    options: [
      { value: 'care_delivery', label: 'Care delivery' },
      { value: 'clinical_trials', label: 'Clinical trial' },
      { value: 'observational_research', label: 'Observational research' },
      { value: 'payer_claims', label: 'Claims / payer' },
      { value: 'genomics_pipeline', label: 'Genomics pipeline' }
    ],
    required: true,
    autoDetect: [
      { value: 'care_delivery', patterns: [/\bclinical\b|\bcare\b|\bencounter\b/] },
      { value: 'clinical_trials', patterns: [/\btrial\b|\brandomized\b|\bctcae\b|\bmeddra\b/] },
      { value: 'observational_research', patterns: [/\bobservational\b|\bcohort\b|\bresearch\b/] },
      { value: 'payer_claims', patterns: [/\bclaim\b|\bpayer\b|\bbilling\b|\badjudication\b/] },
      { value: 'genomics_pipeline', patterns: [/\bgenomic\b|\bsequencing\b|\bvariant\b|\bassay\b/] }
    ]
  },
  {
    id: 'pref_include_document_metadata',
    question: 'Include document governance metadata in the first structure?',
    options: [
      { value: 'yes', label: 'Yes, include metadata' },
      { value: 'minimal', label: 'Minimal metadata only' },
      { value: 'no', label: 'No metadata for now' }
    ],
    required: true,
    autoDetect: [
      { value: 'yes', patterns: [/metadata|governance|provenance|audit/] },
      { value: 'no', patterns: [/no metadata|without metadata|skip metadata/] }
    ]
  },
  {
    id: 'pref_include_temporal_events',
    question: 'Should temporal/event modeling be included from the start?',
    options: [
      { value: 'yes', label: 'Yes, include temporal events' },
      { value: 'no', label: 'No, snapshot first' }
    ],
    required: true,
    autoDetect: [
      { value: 'yes', patterns: [/timeline|over time|event|longitudinal|trend|time series/] },
      { value: 'no', patterns: [/snapshot|point in time|single state|current state/] }
    ]
  },
  {
    id: 'pref_reuse_blocks_first',
    question: 'Prioritize reusable blocks before custom fields?',
    options: [
      { value: 'yes', label: 'Yes, reuse first' },
      { value: 'balanced', label: 'Balanced reuse + custom' },
      { value: 'no', label: 'No, custom-first' }
    ],
    required: true,
    autoDetect: [
      { value: 'yes', patterns: [/reusable|reuse blocks|maximize reuse/] },
      { value: 'no', patterns: [/custom first|no reusable|avoid blocks/] }
    ]
  }
];

const DOMAIN_SIGNAL_PATTERNS = {
  clinical: [
    /\bnews2\b/i,
    /\bmews?\b/i,
    /\bearly warning\b/i,
    /\bdeterioration\b/i,
    /\bclinical\b/i,
    /\bpatient\b/i,
    /\bclinician\b/i,
    /\bintervention\b/i,
    /\bescalation\b/i,
    /\bvital\s*sign/i,
    /\bencounter\b/i,
    /\bepisode of care\b/i
  ],
  claims: [
    /\bprior[\s-]?auth(?:orization)?\b/i,
    /\bclaim\b/i,
    /\badjudication\b/i,
    /\bremittance\b/i,
    /\bbilling\b/i,
    /\bpayer\b/i,
    /\bline item\b/i,
    /\bdenial\b/i,
    /\bappeal\b/i,
    /\b(?:x12|837|835)\b/i
  ],
  genomics: [
    /\bgenomics?\b/i,
    /\bgenetic[s]?\b/i,
    /\bvariant\b/i,
    /\bhgvs\b/i,
    /\bvcf\b/i,
    /\bsomatic\b/i,
    /\bgermline\b/i,
    /\bcnv\b/i,
    /\bfusion\b/i
  ],
  medication: [
    /\bmedication\b/i,
    /\bprescription\b/i,
    /\bdose|dosage\b/i,
    /\broute\b/i,
    /\bfrequency\b/i,
    /\badministration\b/i,
    /\bdispense\b/i,
    /\bmar\b/i,
    /\binfusion\b/i,
    /\btitration\b/i
  ]
};

const DOMAIN_INTENTS = {
  clinical: 'clinical-care',
  claims: 'claims',
  genomics: 'genomics',
  medication: 'clinical-care',
  generic: 'clinical-care'
};

function inferClinicalIntent(text = '') {
  const source = `${text || ''}`.toLowerCase();
  if (/\b(trial|protocol|randomized|arm|ctcae|meddra|visit schedule)\b/.test(source)) {
    return 'clinical-trials';
  }
  if (/\b(research|observational|cohort|registry|participant)\b/.test(source)) {
    return 'clinical-research';
  }
  return 'clinical-care';
}

function inferPrimaryAnchor(text = '', fallback = 'patient') {
  const source = `${text || ''}`.toLowerCase();
  if (/\bparticipant\b|\bsubject\b|\btrial\b/.test(source)) return 'participant';
  if (/\bmember\b|\bbeneficiary\b|\bpayer\b|\bclaim\b|\bcoverage\b/.test(source)) return 'member';
  if (/\bspecimen\b|\bsample\b|\bsequencing\b|\bvariant\b/.test(source)) return 'specimen';
  return HEALTHCARE_CENTRICITIES.includes(fallback) ? fallback : 'patient';
}

function inferCareSetting(text = '') {
  const source = `${text || ''}`.toLowerCase();
  if (/\bemergency\b|\bed\b|\ber\b/.test(source)) return 'emergency';
  if (/\binpatient\b|\bward\b|\badmission\b/.test(source)) return 'inpatient';
  if (/\bvirtual\b|\bremote\b|\btelehealth\b|\btelemedicine\b/.test(source)) return 'virtual';
  if (/\boutpatient\b|\bambulatory\b|\bclinic\b/.test(source)) return 'outpatient';
  return undefined;
}

function inferTemporal(text = '') {
  const source = `${text || ''}`.toLowerCase();
  const hasEvents = /\b(event|timeline|over time|longitudinal|trend|time series)\b/.test(source);
  const hasSnapshot = /\b(snapshot|point in time|single time|current state|baseline)\b/.test(source);
  if (hasEvents && hasSnapshot) return 'both';
  if (hasEvents) return 'events';
  if (hasSnapshot) return 'snapshot';
  return undefined;
}

function inferGovernance(text = '') {
  const source = `${text || ''}`.toLowerCase();
  if (/\bno metadata\b|\bwithout metadata\b|\bskip metadata\b/.test(source)) return 'none';
  if (/\bminimal metadata\b|\blight metadata\b/.test(source)) return 'minimal';
  if (/\bmetadata\b|\bgovernance\b|\bprovenance\b|\baudit\b/.test(source)) return 'full';
  return undefined;
}

function inferKeyEntities(text = '') {
  const source = `${text || ''}`.toLowerCase();
  const entities = {};
  const instrumentMatch = source.match(/\b(phq-9|gad-7|news2|mews|iqpaq)\b/);
  if (instrumentMatch) entities.instrument = instrumentMatch[1].toUpperCase();
  if (/\bloinc\b/.test(source)) entities.terminologyHint = 'LOINC';
  if (/\bsnomed\b/.test(source)) entities.terminologyHint = 'SNOMED-CT';
  return entities;
}

function toDetectionDomain(templateId, text = '') {
  if (templateId === 'claims') return 'claims';
  if (templateId === 'genomics') return 'genomics';
  if (templateId === 'clinical') return inferClinicalIntent(text);
  return DOMAIN_INTENTS[templateId] || 'clinical-care';
}

function buildTemplateRules(template) {
  const commonRules = [
    'Maximize reuse of existing blocks before introducing new custom nodes.',
    'Keep a stable semantic hierarchy with explicit cardinalities for queryability.',
    'Use temporal/event structures only when longitudinal behavior is required.',
    'Prefer production-grade fields for lifecycle/status, timestamps, and context links.'
  ];

  const domainSpecificRules = {
    clinical: [
      'Prefer clinically meaningful groupings and avoid generic wrappers.',
      'Represent repeated observations with event_series/event when clinically relevant.'
    ],
    claims: [
      'Use transactional shape: header + repeatable line items + adjudication outcomes.',
      'Keep coding and financial amounts explicit and analyzable.'
    ],
    genomics: [
      'Separate assay context, variant findings, and clinical interpretation layers.',
      'Model repeatable variant/evidence structures for cohort analytics.'
    ],
    medication: [
      'Model medication lifecycle transitions and administration traceability.',
      'Keep dose, route, frequency, and timing explicit.'
    ],
    generic: [
      'Start with a robust healthcare baseline and specialize quickly from clarifications.',
      'Avoid overfitting to one domain unless user intent is explicit.'
    ]
  };

  const templateDefaults = TEMPLATE_ENRICHMENTS[template?.id] || TEMPLATE_ENRICHMENTS.generic;
  return [
    ...commonRules,
    ...(domainSpecificRules[template?.id] || []),
    'ContextHeader is a required project-level reusable block at the root.',
    'Treat ContextHeader as inherited by default and allow per-object extension/fork only when explicitly requested.',
    ...(templateDefaults?.blockReusePolicy || [])
  ];
}

function withTemplateDefaults(template) {
  const input = template || DOMAIN_TEMPLATE_MAP.generic;
  const enrichment = TEMPLATE_ENRICHMENTS[input.id] || TEMPLATE_ENRICHMENTS.generic;
  return {
    ...input,
    intent: input.intent || enrichment.intent || 'care_delivery',
    primaryAnchor: HEALTHCARE_CENTRICITIES.includes(input.primaryAnchor) ? input.primaryAnchor : (enrichment.primaryAnchor || 'patient'),
    allowedSecondaryAnchors: input.allowedSecondaryAnchors || enrichment.allowedSecondaryAnchors || [],
    recommendedHeaderProfileId: input.recommendedHeaderProfileId || enrichment.recommendedHeaderProfileId || DEFAULT_PROJECT_SETTINGS.defaultHeaderProfileId,
    recommendedTerminologyProfileId: input.recommendedTerminologyProfileId || enrichment.recommendedTerminologyProfileId || DEFAULT_PROJECT_SETTINGS.defaultTerminologyProfileId,
    recommendedBlockPriority: input.recommendedBlockPriority || enrichment.recommendedBlockPriority || [],
    requiredBlocks: input.requiredBlocks || enrichment.requiredBlocks || ['ContextHeader'],
    skeletonGroups: input.skeletonGroups || enrichment.skeletonGroups || ['clinicalContent'],
    requiredSkeletonGroups: input.requiredSkeletonGroups || enrichment.requiredSkeletonGroups || ['clinicalContent'],
    blockReusePolicy: input.blockReusePolicy || enrichment.blockReusePolicy || [],
    terminologySuggestionsByGroup: input.terminologySuggestionsByGroup || enrichment.terminologySuggestionsByGroup || {}
  };
}

export function resolveProjectSettings(input) {
  const settings = {
    ...DEFAULT_PROJECT_SETTINGS,
    ...(input && typeof input === 'object' && !Array.isArray(input) ? input : {})
  };
  const requestedCentricity = `${settings.defaultCentricity || ''}`.toLowerCase();
  settings.defaultCentricity = HEALTHCARE_CENTRICITIES.includes(requestedCentricity)
    ? requestedCentricity
    : DEFAULT_PROJECT_SETTINGS.defaultCentricity;
  settings.defaultHeaderProfileId = `${settings.defaultHeaderProfileId || DEFAULT_PROJECT_SETTINGS.defaultHeaderProfileId}`.trim()
    || DEFAULT_PROJECT_SETTINGS.defaultHeaderProfileId;
  settings.defaultTerminologyProfileId = `${settings.defaultTerminologyProfileId || ''}`.trim();
  settings.governanceDefaults = {
    ...DEFAULT_PROJECT_SETTINGS.governanceDefaults,
    ...(settings.governanceDefaults && typeof settings.governanceDefaults === 'object' ? settings.governanceDefaults : {})
  };
  settings.requiredAnchors = {
    ...DEFAULT_PROJECT_SETTINGS.requiredAnchors,
    ...(settings.requiredAnchors && typeof settings.requiredAnchors === 'object' ? settings.requiredAnchors : {})
  };
  return settings;
}

function toWords(value = '') {
  return `${value || ''}`
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();
}

function toPascalCase(value = '', fallback = 'ReusableBlock') {
  const text = toWords(value);
  if (!text) return fallback;
  const parts = text.split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  return parts.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`).join('');
}

function getDepth(nodes, nodeId) {
  const nodeMap = new Map(nodes.map((n) => [n.nodeId, n]));
  let depth = 0;
  let cursor = nodeMap.get(nodeId);
  while (cursor?.parentNodeId) {
    depth += 1;
    cursor = nodeMap.get(cursor.parentNodeId);
  }
  return depth;
}

function collectDescendantFieldCount(childrenMap, nodeMap, nodeId) {
  let total = 0;
  const walk = (id) => {
    const children = childrenMap.get(id) || [];
    children.forEach((childId) => {
      const child = nodeMap.get(childId);
      if (!child) return;
      if ((child.role || 'field') === 'field') total += 1;
      walk(childId);
    });
  };
  walk(nodeId);
  return total;
}

export function detectDomainFromText(text = '', nodes = []) {
  const source = `${text || ''}`.toLowerCase();
  const hintsFromNodes = Array.isArray(nodes)
    ? nodes.map((node) => `${node?.name || ''} ${node?.attribute || ''}`).join(' ').toLowerCase()
    : '';
  const searchable = `${source} ${hintsFromNodes}`;

  const scores = Object.values(DOMAIN_TEMPLATE_MAP)
    .filter((template) => template.id !== 'generic')
    .map((template) => {
      let score = 0;
      const matched = [];
      template.keywords.forEach((keyword) => {
        if (searchable.includes(keyword.toLowerCase())) {
          score += keyword.split(' ').length > 1 ? 2 : 1;
          matched.push(keyword);
        }
      });
      const signalPatterns = DOMAIN_SIGNAL_PATTERNS[template.id] || [];
      signalPatterns.forEach((pattern) => {
        if (pattern.test(searchable)) {
          score += 2;
          matched.push(pattern.source.replace(/\\b/g, ''));
        }
      });
      return { domainId: template.id, score, matchedKeywords: [...new Set(matched)] };
    })
    .sort((a, b) => b.score - a.score);

  const winner = scores[0];
  const runnerUp = scores[1];
  const candidateTemplates = scores.slice(0, 3).map((candidate) => ({
    templateId: candidate.domainId,
    domainId: candidate.domainId,
    score: candidate.score,
    rationale: candidate.matchedKeywords.slice(0, 6)
  }));

  if (!winner || winner.score <= 0) {
    const hasAnyHealthcareIntent = /\b(patient|care|clinical|health|hospital|provider|encounter|episode|diagnosis|lab|vital|medication|claim|genomic|therapy|intervention)\b/.test(searchable);
    if (hasAnyHealthcareIntent || searchable.trim().length > 0) {
      const detectionResult = buildDetectionResult({
        selectedTemplateId: 'clinical',
        confidence: 0.46,
        matchedKeywords: ['default_clinical_bias'],
        text: searchable,
        candidateTemplates
      });
      return {
        domainId: 'clinical',
        confidence: 0.46,
        matchedKeywords: ['default_clinical_bias'],
        candidateTemplates,
        scoreMargin: 0,
        detectionResult
      };
    }
    const detectionResult = buildDetectionResult({
      selectedTemplateId: 'generic',
      confidence: 0.2,
      matchedKeywords: [],
      text: searchable,
      candidateTemplates
    });
    return {
      domainId: 'generic',
      confidence: 0.2,
      matchedKeywords: [],
      candidateTemplates,
      scoreMargin: 0,
      detectionResult
    };
  }

  const margin = Math.max(0, winner.score - (runnerUp?.score || 0));
  const confidence = Math.min(0.97, 0.5 + (winner.score * 0.06) + (margin * 0.03));
  const detectionResult = buildDetectionResult({
    selectedTemplateId: winner.domainId,
    confidence,
    matchedKeywords: winner.matchedKeywords,
    text: searchable,
    candidateTemplates
  });

  return {
    domainId: winner.domainId,
    confidence,
    matchedKeywords: winner.matchedKeywords,
    candidateTemplates,
    scoreMargin: margin,
    detectionResult
  };
}

export function buildDetectionResult({
  selectedTemplateId = 'generic',
  confidence = 0.2,
  matchedKeywords = [],
  text = '',
  candidateTemplates = [],
  extractedOverrides = {}
} = {}) {
  const template = withTemplateDefaults(DOMAIN_TEMPLATE_MAP[selectedTemplateId] || DOMAIN_TEMPLATE_MAP.generic);
  const domain = toDetectionDomain(selectedTemplateId, text);
  const extracted = {
    primaryAnchor: extractedOverrides.primaryAnchor || inferPrimaryAnchor(text, template.primaryAnchor),
    careSetting: extractedOverrides.careSetting || inferCareSetting(text),
    temporal: extractedOverrides.temporal || inferTemporal(text),
    governance: extractedOverrides.governance || inferGovernance(text),
    keyEntities: extractedOverrides.keyEntities || inferKeyEntities(text)
  };

  const followUpQuestions = [];
  if (!extracted.primaryAnchor) {
    followUpQuestions.push('What is the primary anchor (patient, participant, member, specimen)?');
  }
  if (!extracted.temporal) {
    followUpQuestions.push('Should this model be snapshot, events, or both?');
  }

  return {
    domain,
    templateId: template.id,
    confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
    rationale: matchedKeywords.slice(0, 8),
    extracted,
    followUpQuestions: followUpQuestions.slice(0, 2),
    candidateTemplates: candidateTemplates.slice(0, 3)
  };
}

export function getDomainTemplate(domainId = 'generic') {
  return withTemplateDefaults(DOMAIN_TEMPLATE_MAP[domainId] || DOMAIN_TEMPLATE_MAP.generic);
}

export function sanitizeClarificationAnswers(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const normalized = {};
  Object.entries(input).forEach(([key, value]) => {
    if (typeof key !== 'string' || !key.trim()) return;
    if (typeof value === 'string' && value.trim()) normalized[key.trim()] = value.trim();
  });
  return normalized;
}

export function normalizeModelingPreferences(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ...DEFAULT_MODELING_PREFERENCES };
  }
  const normalized = { ...DEFAULT_MODELING_PREFERENCES };
  Object.keys(DEFAULT_MODELING_PREFERENCES).forEach((key) => {
    if (typeof input[key] === 'boolean') normalized[key] = input[key];
  });
  return normalized;
}

export function modelingPreferencesToClarificationAnswers(preferencesInput) {
  const preferences = normalizeModelingPreferences(preferencesInput);
  return {
    pref_include_document_metadata: preferences.includeDocumentMetadata ? 'yes' : 'no',
    pref_include_temporal_events: preferences.includeTemporalEvents ? 'yes' : 'no',
    pref_reuse_blocks_first: preferences.preferReusableBlocks ? 'yes' : 'no'
  };
}

function detectAnswerFromText(question, userText = '') {
  const lower = `${userText || ''}`.toLowerCase();

  if (Array.isArray(question?.options)) {
    for (const option of question.options) {
      const value = `${option?.value || ''}`.trim().toLowerCase();
      const label = `${option?.label || ''}`.trim().toLowerCase();
      if (!value && !label) continue;
      if (value && lower.includes(value)) return option.value;
      if (label && lower.includes(label)) return option.value;
    }
  }

  if (!question?.autoDetect?.length) return null;
  for (const detector of question.autoDetect) {
    if (!Array.isArray(detector.patterns)) continue;
    const matched = detector.patterns.some((pattern) => pattern.test(lower));
    if (matched) return detector.value;
  }
  return null;
}

function isDiagnosticBundleIntent(text = '') {
  const source = `${text || ''}`.toLowerCase();
  return /\b(diagnostic|investigation|workup|bundle|imaging|pathology|lab(?:oratory)?|clinical question|rule[- ]?out)\b/.test(source);
}

function buildDiagnosticBundleClarifications() {
  return [
    {
      id: 'temporal_granularity',
      question: 'How temporal should the model be?',
      options: [
        { value: 'event_stream', label: 'Lifecycle events (orders -> results -> interpretation)' },
        { value: 'snapshot', label: 'Point-in-time snapshot' },
        { value: 'mixed', label: 'Both snapshot + events' }
      ],
      required: true,
      autoDetect: [
        { value: 'event_stream', patterns: [/lifecycle|status|progress|orders?\s*->\s*results|over time|timeline/] },
        { value: 'snapshot', patterns: [/snapshot|single time|point in time|current state/] }
      ]
    },
    {
      id: 'bundle_boundary',
      question: 'What boundary defines one Diagnostic Investigation Bundle?',
      options: [
        { value: 'encounter', label: 'Encounter-based' },
        { value: 'episode', label: 'Episode-of-care based' },
        { value: 'problem', label: 'Problem / clinical-question based' },
        { value: 'longitudinal', label: 'Longitudinal (cross-encounter)' }
      ],
      required: true,
      autoDetect: [
        { value: 'encounter', patterns: [/\bencounter\b|\bvisit\b/] },
        { value: 'episode', patterns: [/\bepisode\b|\bepisode of care\b/] },
        { value: 'problem', patterns: [/\bclinical question\b|\bproblem\b|\brule[- ]?out\b|\bdifferential\b/] },
        { value: 'longitudinal', patterns: [/\blongitudinal\b|\bcross[- ]?encounter\b/] }
      ]
    },
    {
      id: 'interpretation_stage',
      question: 'Include preliminary and final interpretations?',
      options: [
        { value: 'both', label: 'Both preliminary + final' },
        { value: 'final_only', label: 'Final only' }
      ],
      required: false,
      autoDetect: [
        { value: 'both', patterns: [/preliminary.*final|prelim.*final|final.*prelim/] },
        { value: 'final_only', patterns: [/final only/] }
      ]
    },
    {
      id: 'diagnosis_linking',
      question: 'What should findings link to?',
      options: [
        { value: 'diagnosis', label: 'Diagnosis' },
        { value: 'differential', label: 'Differential diagnosis' },
        { value: 'rule_out', label: 'Rule-out list' }
      ],
      required: false,
      autoDetect: [
        { value: 'differential', patterns: [/\bdifferential\b/] },
        { value: 'rule_out', patterns: [/\brule[- ]?out\b/] },
        { value: 'diagnosis', patterns: [/\bdiagnosis\b/] }
      ]
    }
  ];
}

function getEffectiveClarificationQuestions({ domainTemplate, userText = '' }) {
  const template = domainTemplate || DOMAIN_TEMPLATE_MAP.generic;
  if (template.id === 'clinical' && isDiagnosticBundleIntent(userText)) {
    return buildDiagnosticBundleClarifications();
  }
  return Array.isArray(template.clarifications) ? template.clarifications : [];
}

export function getMissingClarifications({
  domainTemplate,
  answers = {},
  userText = '',
  chatHistory = []
}) {
  const safeAnswers = sanitizeClarificationAnswers(answers);
  const historyText = Array.isArray(chatHistory)
    ? chatHistory.map((msg) => `${msg?.content || ''}`).join('\n')
    : '';
  const mergedText = `${userText || ''}\n${historyText}`.toLowerCase();
  const template = domainTemplate || DOMAIN_TEMPLATE_MAP.generic;
  const clarifications = getEffectiveClarificationQuestions({ domainTemplate: template, userText: mergedText });

  return clarifications
    .map((question) => {
      const explicitAnswer = safeAnswers[question.id];
      const inferred = explicitAnswer || detectAnswerFromText(question, mergedText);
      return { ...question, inferredAnswer: inferred || null };
    })
    .filter((question) => question.required && !question.inferredAnswer);
}

export function getUnifiedClarificationQuestions({
  domainTemplate,
  answers = {},
  userText = '',
  chatHistory = [],
  includeGlobal = true,
  hasProjectHeaderProfile = false,
  detectionConfidence = 0,
  detectedDomain = 'generic'
}) {
  const safeAnswers = sanitizeClarificationAnswers(answers);
  const historyText = Array.isArray(chatHistory)
    ? chatHistory.map((msg) => `${msg?.content || ''}`).join('\n')
    : '';
  const mergedText = `${userText || ''}\n${historyText}`.toLowerCase();
  const template = domainTemplate || DOMAIN_TEMPLATE_MAP.generic;
  const domainQuestions = getEffectiveClarificationQuestions({ domainTemplate: template, userText: mergedText });
  const qualityQuestions = includeGlobal
    ? GLOBAL_QUALITY_CLARIFICATIONS.filter((question) => {
      if (question.id !== 'primary_anchor') return true;
      if (hasProjectHeaderProfile) return false;
      const highConfidenceDefault = detectionConfidence >= 0.75 && ['clinical', 'claims', 'genomics', 'medication'].includes(`${detectedDomain || ''}`);
      if (highConfidenceDefault) return false;
      return true;
    })
    : [];

  const mergedQuestions = [...domainQuestions, ...qualityQuestions];

  return mergedQuestions
    .map((question) => {
      const explicitAnswer = safeAnswers[question.id];
      const inferred = explicitAnswer || detectAnswerFromText(question, mergedText);
      return { ...question, inferredAnswer: inferred || null };
    })
    .filter((question) => question.required && !question.inferredAnswer);
}

export function buildDomainPromptTemplate(domainTemplate, clarificationAnswers = {}) {
  const template = withTemplateDefaults(domainTemplate || DOMAIN_TEMPLATE_MAP.generic);
  const safeAnswers = sanitizeClarificationAnswers(clarificationAnswers);
  const answeredLines = (template.clarifications || [])
    .map((question) => {
      const answer = safeAnswers[question.id];
      if (!answer) return null;
      const selected = (question.options || []).find((option) => option.value === answer);
      return `- ${question.question}: ${selected?.label || answer}`;
    })
    .filter(Boolean);

  const focus = (template.focusAreas || []).map((item) => `- ${item}`).join('\n');
  const answersSection = answeredLines.length
    ? `\nSelected clarifications:\n${answeredLines.join('\n')}`
    : '\nSelected clarifications:\n- none provided yet';

  return [
    `Domain template: ${template.label}`,
    `Template intent: ${template.intent}`,
    `Primary anchor default: ${template.primaryAnchor}`,
    `Required blocks: ${(template.requiredBlocks || []).join(', ') || 'ContextHeader'}`,
    template.promptTemplate,
    'Focus areas:',
    focus || '- general healthcare',
    answersSection
  ].join('\n');
}

export function buildAgentProcess(stage = 'prompt_received') {
  const stageOrder = {
    prompt_received: 1,
    clarification_required: 3,
    generating: 5,
    proposal_ready: 6,
    ready_for_refinement: 7
  };
  const current = stageOrder[stage] || 1;

  return PROCESS_STEPS.map((step, index) => {
    const ordinal = index + 1;
    if (ordinal < current) return { ...step, status: 'completed' };
    if (ordinal === current) return { ...step, status: 'in_progress' };
    return { ...step, status: 'pending' };
  });
}

export function suggestReusableBlockCandidates(nodes = [], { domainId = 'generic', maxCandidates = 5 } = {}) {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];
  const root = nodes.find((node) => node.parentNodeId === null);
  if (!root) return [];

  const excludedAttributes = new Set([
    'root',
    'documentmetadata',
    'metadata',
    'subjectcontext',
    'carecontext',
    'performercontext',
    'assessment'
  ]);

  const nodeMap = new Map(nodes.map((node) => [node.nodeId, node]));
  const childrenMap = new Map(nodes.map((node) => [node.nodeId, []]));
  nodes.forEach((node) => {
    if (node.parentNodeId && childrenMap.has(node.parentNodeId)) {
      childrenMap.get(node.parentNodeId).push(node.nodeId);
    }
  });

  const candidates = nodes
    .filter((node) => node.nodeId !== root.nodeId)
    .filter((node) => node.role !== 'block')
    .map((node) => {
      const attr = `${node.attribute || ''}`.toLowerCase();
      if (excludedAttributes.has(attr)) return null;
      const children = childrenMap.get(node.nodeId) || [];
      if (children.length < 2) return null;

      const descendantFieldCount = collectDescendantFieldCount(childrenMap, nodeMap, node.nodeId);
      if (descendantFieldCount < 2) return null;

      const repeatable = node.occurrences?.max === '*' || (typeof node.occurrences?.max === 'number' && node.occurrences.max > 1);
      const depth = getDepth(nodes, node.nodeId);
      const score = descendantFieldCount + (repeatable ? 3 : 0) + depth;
      const blockName = toPascalCase(node.name || node.attribute, 'ReusableBlock');

      return {
        nodeId: node.nodeId,
        name: node.name || blockName,
        attribute: node.attribute,
        role: node.role || 'group',
        repeatable,
        descendantFieldCount,
        suggestedBlockId: `block.${blockName}.v1`,
        reason: repeatable
          ? 'Repeatable and semantically cohesive subtree'
          : 'Cohesive subtree with multiple semantically related fields',
        domainId,
        score
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCandidates)
    .map(({ score, ...candidate }) => candidate);

  return candidates;
}

export function prioritizeBlocksForDomain(blocks = [], domainTemplate = null, limit = 200) {
  if (!Array.isArray(blocks) || blocks.length === 0) return [];
  const template = domainTemplate || DOMAIN_TEMPLATE_MAP.generic;
  const keywords = Array.isArray(template.blockKeywords) ? template.blockKeywords.map((k) => k.toLowerCase()) : [];

  return [...blocks]
    .map((block) => {
      const haystack = `${block?.name || ''} ${block?.blockId || ''} ${block?.description || ''}`.toLowerCase();
      const score = keywords.reduce((acc, keyword) => (haystack.includes(keyword) ? acc + 1 : acc), 0);
      return { block, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return `${a.block?.name || ''}`.localeCompare(`${b.block?.name || ''}`);
    })
    .slice(0, limit)
    .map((item) => item.block);
}

export function toTemplateSummary(domainTemplate) {
  const template = withTemplateDefaults(domainTemplate || DOMAIN_TEMPLATE_MAP.generic);
  return {
    id: template.id,
    label: template.label,
    description: template.description,
    intent: template.intent,
    primaryAnchor: template.primaryAnchor,
    allowedSecondaryAnchors: template.allowedSecondaryAnchors || [],
    recommendedHeaderProfileId: template.recommendedHeaderProfileId || DEFAULT_PROJECT_SETTINGS.defaultHeaderProfileId,
    recommendedTerminologyProfileId: template.recommendedTerminologyProfileId || '',
    recommendedBlockPriority: template.recommendedBlockPriority || [],
    requiredBlocks: template.requiredBlocks || ['ContextHeader'],
    skeletonGroups: template.skeletonGroups || [],
    requiredSkeletonGroups: template.requiredSkeletonGroups || [],
    blockReusePolicy: template.blockReusePolicy || [],
    terminologySuggestionsByGroup: template.terminologySuggestionsByGroup || {},
    promptTemplate: template.promptTemplate || '',
    rules: buildTemplateRules(template),
    focusAreas: template.focusAreas || [],
    keywords: template.keywords || [],
    blockKeywords: template.blockKeywords || [],
    clarifications: (template.clarifications || []).map((question) => ({
      id: question.id,
      question: question.question,
      options: question.options || [],
      required: !!question.required
    })),
    followUpPrompts: template.followUpPrompts || []
  };
}

export function listDomainTemplateSummaries() {
  return Object.values(DOMAIN_TEMPLATE_MAP)
    .map((template) => toTemplateSummary(template))
    .sort((a, b) => `${a.label || ''}`.localeCompare(`${b.label || ''}`));
}
