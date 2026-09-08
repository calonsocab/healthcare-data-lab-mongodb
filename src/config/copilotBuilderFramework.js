export const COPILOT_BUILDER_FRAMEWORK = {
  northStar:
    'Author copilots from governed ContextObjects first, preserve native source hierarchies when they come from openEHR or FHIR, enrich the semantic match layer deliberately, then bind approved semantic products to deterministic Con2L execution and continuous audit.',
  workflow: [
    {
      id: 'source-selection',
      title: 'Select source models',
      summary: 'Choose the imported data models that will feed the copilot.',
      outputs: ['source inventory', 'data richness profile', 'candidate anchors'],
    },
    {
      id: 'context-normalization',
      title: 'Normalize to ContextObjects',
      summary: 'Map every selected source shape into ContextObjects, Context Maps, and uniform instances while preserving the native source hierarchy as the canonical definition.',
      outputs: ['preserved native definitions', 'ContextObject projections', 'Context Maps', 'instance publication plan'],
    },
    {
      id: 'semantic-enrichment',
      title: 'Build the semantic layer',
      summary: 'Extend the preserved source layer with terminology bindings, value sets, descriptions, metadata, matching hints, and embeddings where needed.',
      outputs: ['value sets', 'terminology descriptions', 'matching metadata', 'embedding collections'],
    },
    {
      id: 'role-design',
      title: 'Define target roles',
      summary: 'Capture who the copilot serves, what decisions they make, and what evidence or UX handoff they require.',
      outputs: ['role catalog', 'decision profiles', 'access and risk policies'],
    },
    {
      id: 'question-factory',
      title: 'Generate question library',
      summary: 'Use model richness plus roles to generate question families, variants, and expected question volume.',
      outputs: ['question candidates', 'family clustering', 'coverage rationale'],
    },
    {
      id: 'evaluation-factory',
      title: 'Author expected answers',
      summary: 'For every approved question, store expected request shape, human expectation, answer rules, and clarification policy.',
      outputs: ['evaluation rows', 'answer expectations', 'route expectations'],
    },
    {
      id: 'product-binding',
      title: 'Cluster products and bind Con2L',
      summary: 'Group questions into semantic products with bounded inputs, allowed scopes, and deterministic Con2L execution.',
      outputs: ['semantic products', 'Con2L templates', 'query guardrails'],
    },
    {
      id: 'control-plane',
      title: 'Audit and improve',
      summary: 'Monitor coverage, verifier issues, unresolved demand, drift, and release readiness by family and product.',
      outputs: ['quality dashboards', 'backlog artifacts', 'release gates'],
    },
  ],
  deterministicPath: [
    {
      id: 'nlq',
      title: 'Natural language request',
      summary: 'User asks in role-specific language, with ambiguity preserved instead of guessed away.',
    },
    {
      id: 'con2l-negotiation',
      title: 'Con2L negotiation',
      summary: 'Resolve the request against preserved ContextObjects, anchors, time semantics, ontology hints, and allowed scopes.',
    },
    {
      id: 'semantic-binding',
      title: 'Semantic product binding',
      summary: 'Bind to the approved product family rather than routing directly to a raw query.',
    },
    {
      id: 'compiled-plan',
      title: 'Compiled execution plan',
      summary: 'Compile to deterministic Con2L and bounded execution steps with guardrails.',
    },
    {
      id: 'grounded-answer',
      title: 'Grounded answer model',
      summary: 'Render the answer through an approved answer contract, proof summary, and panel handoff.',
    },
  ],
  enrichmentLayers: [
    {
      id: 'valuesets',
      title: 'Value sets and bindings',
      summary: 'Attach value sets, local code mappings, and terminology bindings to context fields that matter for disambiguation.',
    },
    {
      id: 'descriptions',
      title: 'Terminology descriptions',
      summary: 'Store labels, synonyms, definitions, and domain descriptions to widen semantic matching safely.',
    },
    {
      id: 'metadata',
      title: 'Operational metadata',
      summary: 'Carry provenance, confidence, lifecycle status, update cadence, governance metadata, and source-preservation metadata at field and instance level.',
    },
    {
      id: 'embeddings',
      title: 'Embedding support',
      summary: 'Use embeddings as supportive enrichment and ranking, never as the final authority for deterministic binding.',
    },
    {
      id: 'ontology-review',
      title: 'Ontology browser and confirmation',
      summary: 'When confidence is weak, surface candidate concepts and let the operator confirm the intended semantic target.',
    },
  ],
  ambiguityPolicies: [
    {
      id: 'auto-accept',
      title: 'Compile directly',
      summary: 'If signals are strong and governance allows it, compile directly to Con2L and continue without interruption.',
    },
    {
      id: 'guided-confirmation',
      title: 'Ask for confirmation',
      summary: 'If multiple candidate concepts are plausible, show the closest ontology or context matches before running the plan.',
    },
    {
      id: 'safety-clarification',
      title: 'Clarify before query',
      summary: 'If the missing anchor, scope, or concept would widen the query unsafely, stop and ask explicitly.',
    },
  ],
  registryArtifacts: [
    {
      id: 'foundation',
      title: 'Foundation artifacts',
      items: ['source inventory', 'preserved native definitions', 'ContextObject projections', 'Context Maps', 'instance recipes'],
    },
    {
      id: 'semantics',
      title: 'Semantic layer artifacts',
      items: ['value sets', 'terminology descriptions', 'semantic catalog', 'matching metadata', 'embedding metadata'],
    },
    {
      id: 'copilot',
      title: 'Copilot contract artifacts',
      items: ['roles', 'question library', 'semantic products', 'answer models', 'Con2L templates'],
    },
    {
      id: 'control',
      title: 'Control artifacts',
      items: ['evaluation library', 'capability backlog', 'release gates', 'unresolved demand clusters'],
    },
  ],
  improvementLoops: [
    {
      id: 'coverage',
      title: 'Coverage loop',
      summary: 'Expand missing families, roles, and question shapes from observed demand.',
    },
    {
      id: 'binding',
      title: 'Binding loop',
      summary: 'Improve semantic matching, ontology support, and Con2L compilation where routing is unstable.',
    },
    {
      id: 'answer',
      title: 'Answer loop',
      summary: 'Tighten answer models, proof summaries, and panel handoffs where product fit is weak.',
    },
    {
      id: 'governance',
      title: 'Governance loop',
      summary: 'Track verifier issues, safety clarifications, approval requirements, and release readiness.',
    },
  ],
  modeFocus: {
    questions: {
      title: 'Question Factory Focus',
      summary: 'Start from roles plus data richness, then author approved question families with expected evaluation behavior.',
      checkpoints: ['role catalog', 'question families', 'evaluation expectations', 'coverage gaps'],
    },
    products: {
      title: 'Semantic Product Focus',
      summary: 'Cluster questions into products with sharp boundaries, parameter flexibility, and clear ContextObject requirements.',
      checkpoints: ['product boundaries', 'required ContextObjects', 'allowed scopes', 'product families'],
    },
    tools: {
      title: 'Deterministic Con2L Focus',
      summary: 'Bind products to Con2L templates, compile rules, and query guardrails before touching runtime collections.',
      checkpoints: ['Con2L templates', 'guardrails', 'clarification policy', 'execution limits'],
    },
    answers: {
      title: 'Answer Contract Focus',
      summary: 'Define how every product should lead, prove, soften, and hand off its result to the user.',
      checkpoints: ['narrative role', 'proof shape', 'widgets', 'panel handoff'],
    },
    control: {
      title: 'Audit and Improvement Focus',
      summary: 'Run a full loop over coverage, drift, verifier issues, unresolved demand, and product readiness.',
      checkpoints: ['coverage by family', 'binding failures', 'verifier issues', 'release gates'],
    },
  },
};

export const COPILOT_BUILDER_SUMMARY = {
  workflowSteps: COPILOT_BUILDER_FRAMEWORK.workflow.length,
  enrichmentLayers: COPILOT_BUILDER_FRAMEWORK.enrichmentLayers.length,
  artifactBuckets: COPILOT_BUILDER_FRAMEWORK.registryArtifacts.length,
  improvementLoops: COPILOT_BUILDER_FRAMEWORK.improvementLoops.length,
};
