import { getSemanticAuthoringLayer } from '@/lib/contextObjects/semanticMatching';

const RESOLVABLE_KINDS = ['context_object', 'resource-definition', 'archetype', 'template'];
const STOP_TOKENS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'into',
  'then',
  'than',
  'over',
  'under',
  'about',
  'after',
  'before',
  'show',
  'list',
  'give',
  'need',
  'find',
  'what',
  'when',
  'where',
  'which',
  'who',
  'will',
  'would',
  'could',
  'should',
  'have',
  'has',
  'had',
  'patient',
  'patients',
  'subject',
  'subjects',
  'data',
  'context',
  'object',
]);

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isObjectRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      safeArray(values)
        .map((value) => `${value || ''}`.trim())
        .filter(Boolean)
    )
  );
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function normalizeText(value) {
  return `${value || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(values = []) {
  return Array.from(
    new Set(
      safeArray(values)
        .flatMap((value) => normalizeText(value).split(' '))
        .map((token) => token.trim())
        .filter((token) => token.length >= 3 && !STOP_TOKENS.has(token))
    )
  );
}

function prettifySignal(value) {
  return `${value || ''}`
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function scoreText(profile, values, { phraseWeight = 8, tokenWeight = 2, maxTokenHits = 8, label } = {}) {
  const haystack = normalizeText(safeArray(values).join(' '));
  if (!haystack) return { score: 0, matchedSignals: [] };

  const matchedSignals = [];
  let score = 0;

  profile.phrases.forEach((phrase) => {
    if (!phrase || phrase.length < 3) return;
    if (haystack.includes(phrase)) {
      score += phraseWeight;
      matchedSignals.push(`${label || 'text'}:${phrase}`);
    }
  });

  let tokenHits = 0;
  profile.tokens.forEach((token) => {
    if (tokenHits >= maxTokenHits) return;
    if (!token || token.length < 3) return;
    if (haystack.includes(token)) {
      tokenHits += 1;
      score += tokenWeight;
      matchedSignals.push(`${label || 'text'}:${token}`);
    }
  });

  return {
    score,
    matchedSignals: uniqueStrings(matchedSignals),
  };
}

function extractArtifactProfile(artifact = {}) {
  const phrases = uniqueStrings([
    artifact?.title,
    artifact?.naturalLanguage,
    ...safeArray(artifact?.draft?.focus),
    ...safeArray(artifact?.draft?.evidence),
    ...safeArray(artifact?.draft?.groupBy),
    ...safeArray(artifact?.resolved?.predicates),
    ...safeArray(artifact?.executable?.contains),
    artifact?.resolved?.contextContract,
    artifact?.executable?.from,
    artifact?.executable?.output,
    ...safeArray(artifact?.executable?.where).flatMap((row) => [row?.field, row?.value]),
  ]);

  return {
    subject: `${artifact?.draft?.subject || ''}`.trim(),
    ask: `${artifact?.draft?.ask || ''}`.trim(),
    phrases: phrases.map((value) => normalizeText(value)).filter(Boolean),
    tokens: tokenize(phrases),
  };
}

function resolveDefinitionClarificationPolicy(definition = {}) {
  const resolutionPolicy = definition?.metadata?.contextContract?.resolutionPolicy || {};
  return {
    clarificationPolicy: `${resolutionPolicy.clarificationPolicy || 'on_ambiguity'}`.trim() || 'on_ambiguity',
    confidenceThreshold: Number.isFinite(Number(resolutionPolicy.confidenceThreshold))
      ? Number(resolutionPolicy.confidenceThreshold)
      : 0.65,
  };
}

function resolveNodeConfirmation(node = {}, inheritedPolicy = 'on_ambiguity', inheritedOntologySources = []) {
  const confirmation = isObjectRecord(node?.annotations?.semanticConfirmation)
    ? node.annotations.semanticConfirmation
    : {};
  const policy = `${confirmation.policy || 'inherit'}`.trim() || 'inherit';

  return {
    policy,
    effectivePolicy: policy === 'inherit' ? inheritedPolicy : policy,
    ontologySource:
      typeof confirmation.ontologySource === 'string' && confirmation.ontologySource.trim()
        ? confirmation.ontologySource.trim()
        : uniqueStrings(inheritedOntologySources)[0] || '',
    prompt:
      typeof confirmation.prompt === 'string' && confirmation.prompt.trim()
        ? confirmation.prompt.trim()
        : '',
    conceptLabel:
      typeof confirmation.conceptLabel === 'string' && confirmation.conceptLabel.trim()
        ? confirmation.conceptLabel.trim()
        : (node?.name || node?.attribute || node?.nodeId || ''),
  };
}

function buildNodeCandidate(node = {}, profile, definition = {}) {
  const inheritedPolicy = resolveDefinitionClarificationPolicy(definition).clarificationPolicy;
  const authoringLayer = getSemanticAuthoringLayer(definition?.definition, definition?.metadata);
  const confirmation = resolveNodeConfirmation(node, inheritedPolicy, authoringLayer.ontologySources);
  const segments = [
    scoreText(profile, [node.name, node.attribute], { phraseWeight: 12, tokenWeight: 3, maxTokenHits: 6, label: 'node' }),
    scoreText(profile, [node.description, node.localizedName, node.displayName], { phraseWeight: 8, tokenWeight: 2, maxTokenHits: 5, label: 'description' }),
    scoreText(profile, [...safeArray(node.aliases), ...safeArray(node.synonyms), ...safeArray(node.semanticLabels)], { phraseWeight: 10, tokenWeight: 3, maxTokenHits: 6, label: 'semantic' }),
    scoreText(profile, [...safeArray(node.matchingHints), ...safeArray(node.queryHints)], { phraseWeight: 9, tokenWeight: 2, maxTokenHits: 6, label: 'hint' }),
    scoreText(profile, [...safeArray(node.semanticEmbeddingRefs), ...safeArray(node.semanticVectors)], { phraseWeight: 7, tokenWeight: 2, maxTokenHits: 4, label: 'embedding' }),
    scoreText(profile, [
      node.valueSet,
      ...safeArray(node.valueSets),
      ...safeArray(node.terminologyBindings).flatMap((binding) => [binding?.system, binding?.code, binding?.display, binding?.valueSet]),
      node.ontologyRef,
    ], { phraseWeight: 8, tokenWeight: 2, maxTokenHits: 6, label: 'terminology' }),
  ];

  const score = segments.reduce((sum, segment) => sum + segment.score, 0);
  if (score <= 0) return null;

  return {
    nodeId: node.nodeId,
    name: node.name || node.attribute || node.nodeId,
    attribute: node.attribute || node.nodeId,
    sourcePath: node.sourcePath || node.path || null,
    ontologySource: confirmation.ontologySource,
    prompt: confirmation.prompt,
    conceptLabel: confirmation.conceptLabel,
    policy: confirmation.policy,
    effectivePolicy: confirmation.effectivePolicy,
    score,
    matchedSignals: uniqueStrings(segments.flatMap((segment) => segment.matchedSignals)).slice(0, 8),
  };
}

function buildDefinitionCandidate(definition = {}, profile) {
  const contract = definition?.metadata?.contextContract || {};
  const authoringLayer = getSemanticAuthoringLayer(definition?.definition, definition?.metadata);
  const definitionSegments = [
    scoreText(profile, [definition.id, definition.name], { phraseWeight: 12, tokenWeight: 3, maxTokenHits: 6, label: 'definition' }),
    scoreText(profile, [definition.description], { phraseWeight: 8, tokenWeight: 2, maxTokenHits: 6, label: 'description' }),
    scoreText(profile, [contract.contextType, contract.primaryAnchor, definition.kind, definition.scope], { phraseWeight: 8, tokenWeight: 2, maxTokenHits: 5, label: 'contract' }),
    scoreText(profile, [...safeArray(contract.contains), ...safeArray(contract.outputFamilies), ...safeArray(contract.viewFamilies)], { phraseWeight: 9, tokenWeight: 2, maxTokenHits: 7, label: 'output' }),
    scoreText(profile, [
      ...safeArray(contract.terminologyBindings),
      ...safeArray(contract?.terminologyPolicy?.preferredSystems),
      ...safeArray(contract?.terminologyPolicy?.conceptExpansion),
      ...safeArray(contract?.terminologyPolicy?.descriptionSources),
      ...safeArray(authoringLayer.matchingHints),
      ...safeArray(authoringLayer.ontologySources),
      ...safeArray(authoringLayer.confirmationPrompts),
    ], { phraseWeight: 8, tokenWeight: 2, maxTokenHits: 8, label: 'semantic' }),
    scoreText(profile, safeArray(definition?.terminologyBindings).flatMap((binding) => [binding?.system, binding?.code, binding?.display, binding?.valueSet]), {
      phraseWeight: 8,
      tokenWeight: 2,
      maxTokenHits: 6,
      label: 'terminology',
    }),
  ];

  let score = definitionSegments.reduce((sum, segment) => sum + segment.score, 0);
  const matchedSignals = uniqueStrings(definitionSegments.flatMap((segment) => segment.matchedSignals));

  if (profile.subject) {
    const subject = normalizeText(profile.subject);
    if (normalizeText(contract.primaryAnchor).includes(subject) || normalizeText(contract.contextType).includes(subject)) {
      score += 10;
    }
  }

  if (profile.ask) {
    const ask = normalizeText(profile.ask);
    if (
      safeArray(contract.outputFamilies).some((value) => normalizeText(value).includes(ask))
      || safeArray(contract.viewFamilies).some((value) => normalizeText(value).includes(ask))
    ) {
      score += 8;
    }
  }

  const nodeCandidates = safeArray(definition?.nodes)
    .map((node) => buildNodeCandidate(node, profile, definition))
    .filter(Boolean)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);

  if (nodeCandidates[0]) {
    score += Math.min(30, nodeCandidates[0].score * 0.45);
  }

  return {
    definitionId: definition.id,
    name: definition.name || definition.id,
    kind: definition.kind || null,
    scope: definition.scope || null,
    contextType: contract.contextType || null,
    primaryAnchor: contract.primaryAnchor || null,
    clarificationPolicy: resolveDefinitionClarificationPolicy(definition).clarificationPolicy,
    confidenceThreshold: resolveDefinitionClarificationPolicy(definition).confidenceThreshold,
    ontologySources: uniqueStrings(authoringLayer.ontologySources),
    confirmationPrompts: uniqueStrings(authoringLayer.confirmationPrompts),
    score,
    matchedSignals: matchedSignals.slice(0, 10),
    nodeCandidates,
  };
}

function computeConfidence(definitionCandidates = [], selectedDefinition = null, selectedNodes = []) {
  const best = selectedDefinition || definitionCandidates[0] || null;
  const second = definitionCandidates.find((candidate) => candidate.definitionId !== best?.definitionId) || null;
  const bestNode = selectedNodes[0] || best?.nodeCandidates?.[0] || null;
  const secondNode = best?.nodeCandidates?.find((node) => node.nodeId !== bestNode?.nodeId) || null;

  const definitionStrength = clamp((best?.score || 0) / 80, 0, 1);
  const nodeStrength = clamp((bestNode?.score || 0) / 45, 0, 1);
  const definitionMargin = best
    ? clamp(((best.score || 0) - (second?.score || 0)) / 18, 0, 1)
    : 0;
  const nodeMargin = bestNode
    ? clamp(((bestNode.score || 0) - (secondNode?.score || 0)) / 12, 0, 1)
    : 0;

  return clamp((definitionStrength * 0.4) + (nodeStrength * 0.25) + (definitionMargin * 0.2) + (nodeMargin * 0.15), 0, 1);
}

function buildConfirmationReason({ ambiguousDefinition, ambiguousNode, lowConfidence, selectedDefinition }) {
  if (!selectedDefinition) {
    return 'No strong semantic match was found for this Con2L request.';
  }
  if (ambiguousDefinition || ambiguousNode) {
    return 'Multiple semantic targets are plausible, so a confirmation step is required before execution.';
  }
  if (lowConfidence) {
    return 'The semantic match is below the configured confidence threshold and needs operator confirmation.';
  }
  return 'Confirmation is required by the current semantic policy.';
}

function selectDefinitionCandidate(definitionCandidates, semanticConfirmation) {
  if (semanticConfirmation?.definitionId) {
    return definitionCandidates.find((candidate) => candidate.definitionId === semanticConfirmation.definitionId) || definitionCandidates[0] || null;
  }
  return definitionCandidates[0] || null;
}

function selectNodeCandidates(definitionCandidate, semanticConfirmation) {
  const nodeCandidates = safeArray(definitionCandidate?.nodeCandidates);
  if (!nodeCandidates.length) return [];

  if (safeArray(semanticConfirmation?.nodeIds).length > 0) {
    const selected = nodeCandidates.filter((node) => semanticConfirmation.nodeIds.includes(node.nodeId));
    if (selected.length > 0) return selected;
  }

  const [first, second, third] = nodeCandidates;
  const selected = [first].filter(Boolean);
  if (second && (first.score - second.score) <= 4) selected.push(second);
  if (third && (second?.score || 0) > 0 && (first.score - third.score) <= 6) selected.push(third);
  return selected;
}

function buildResolutionArtifact(artifact = {}, resolution = {}) {
  const selectedDefinition = resolution.selectedDefinition || null;
  const selectedNodes = safeArray(resolution.selectedNodes);
  const selectedNodeAttributes = uniqueStrings(selectedNodes.map((node) => node.attribute));
  const semanticResolution = {
    status: resolution.confirmed ? 'confirmed' : resolution.confirmationRequired ? 'pending_confirmation' : 'resolved',
    confidence: resolution.confidence,
    policy: resolution.effectivePolicy,
    threshold: resolution.threshold,
    selectedDefinition: selectedDefinition
      ? {
          id: selectedDefinition.definitionId,
          name: selectedDefinition.name,
          contextType: selectedDefinition.contextType,
          primaryAnchor: selectedDefinition.primaryAnchor,
        }
      : null,
    selectedNodes: selectedNodes.map((node) => ({
      nodeId: node.nodeId,
      name: node.name,
      attribute: node.attribute,
      ontologySource: node.ontologySource || null,
      conceptLabel: node.conceptLabel || node.name,
    })),
  };

  return {
    ...artifact,
    resolved: {
      ...(artifact?.resolved || {}),
      contextContract: selectedDefinition?.definitionId || artifact?.resolved?.contextContract || artifact?.executable?.from || null,
      semanticTargets: selectedNodeAttributes,
      semanticResolution,
    },
    executable: {
      ...(artifact?.executable || {}),
      from: selectedDefinition?.definitionId || artifact?.executable?.from || artifact?.resolved?.contextContract || 'context_contract',
      contains: uniqueStrings([...(artifact?.executable?.contains || []), ...selectedNodeAttributes]),
      meta: {
        ...(artifact?.executable?.meta || {}),
        semanticResolution,
      },
    },
  };
}

function buildConfirmationPayload({
  selectedDefinition,
  definitionCandidates,
  selectedNodes,
  effectivePolicy,
  confidence,
  threshold,
  reason,
  confirmed,
}) {
  if (confirmed || !selectedDefinition) return null;

  const prompt =
    selectedNodes[0]?.prompt
    || selectedDefinition.confirmationPrompts?.[0]
    || 'Confirm the intended semantic concept before HDL compiles this request.';

  return {
    required: true,
    policy: effectivePolicy,
    confidence,
    threshold,
    reason,
    prompt,
    candidates: definitionCandidates.slice(0, 4).map((candidate) => ({
      definitionId: candidate.definitionId,
      name: candidate.name,
      kind: candidate.kind,
      scope: candidate.scope,
      contextType: candidate.contextType,
      primaryAnchor: candidate.primaryAnchor,
      score: candidate.score,
      matchedSignals: candidate.matchedSignals,
      nodes: safeArray(candidate.nodeCandidates).slice(0, 4).map((node) => ({
        nodeId: node.nodeId,
        name: node.name,
        attribute: node.attribute,
        score: node.score,
        matchedSignals: node.matchedSignals,
        ontologySource: node.ontologySource || null,
        conceptLabel: node.conceptLabel || node.name,
        prompt: node.prompt || '',
        policy: node.effectivePolicy,
      })),
    })),
  };
}

export async function listResolvableContextDefinitions(db, limit = 160) {
  return db
    .collection('semantic_objects')
    .find({
      kind: { $in: RESOLVABLE_KINDS },
      status: { $in: ['active', 'draft'] },
    })
    .sort({ 'metadata.updatedAt': -1 })
    .limit(limit)
    .toArray();
}

export function resolveCon2LSemanticBindings({
  artifact,
  definitions = [],
  semanticConfirmation = null,
} = {}) {
  const profile = extractArtifactProfile(artifact);
  const definitionCandidates = safeArray(definitions)
    .map((definition) => buildDefinitionCandidate(definition, profile))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 12);

  const selectedDefinition = selectDefinitionCandidate(definitionCandidates, semanticConfirmation);
  const selectedNodes = selectNodeCandidates(selectedDefinition, semanticConfirmation);
  const confidence = computeConfidence(definitionCandidates, selectedDefinition, selectedNodes);
  const threshold = selectedDefinition?.confidenceThreshold ?? 0.65;
  const effectivePolicy = selectedNodes[0]?.effectivePolicy || selectedDefinition?.clarificationPolicy || 'on_ambiguity';
  const secondDefinition = definitionCandidates.find((candidate) => candidate.definitionId !== selectedDefinition?.definitionId) || null;
  const secondNode = selectedDefinition?.nodeCandidates?.find((node) => node.nodeId !== selectedNodes[0]?.nodeId) || null;
  const ambiguousDefinition = Boolean(selectedDefinition && secondDefinition && ((selectedDefinition.score - secondDefinition.score) <= 10));
  const ambiguousNode = Boolean(selectedNodes[0] && secondNode && ((selectedNodes[0].score - secondNode.score) <= 6));
  const lowConfidence = confidence < threshold;
  const confirmed = Boolean(semanticConfirmation?.definitionId);

  const confirmationRequired = !confirmed && (
    effectivePolicy === 'on_ambiguity'
      ? (ambiguousDefinition || ambiguousNode || lowConfidence)
      : effectivePolicy === 'on_low_confidence'
        ? lowConfidence
        : false
  );

  const reason = buildConfirmationReason({
    ambiguousDefinition,
    ambiguousNode,
    lowConfidence,
    selectedDefinition,
  });

  const enrichedArtifact = buildResolutionArtifact(artifact, {
    selectedDefinition,
    selectedNodes,
    confidence,
    effectivePolicy,
    threshold,
    confirmationRequired,
    confirmed,
  });

  return {
    profile,
    definitionCandidates,
    selectedDefinition,
    selectedNodes,
    confidence,
    threshold,
    effectivePolicy,
    confirmationRequired,
    confirmed,
    reason,
    confirmation: buildConfirmationPayload({
      selectedDefinition,
      definitionCandidates,
      selectedNodes,
      effectivePolicy,
      confidence,
      threshold,
      reason,
      confirmed,
    }),
    enrichedArtifact,
    warnings:
      definitionCandidates.length === 0
        ? ['No tenant ContextObjects currently provide a strong semantic match for this request.']
        : confirmationRequired
          ? [reason]
          : [],
  };
}

export function summarizeDefinitionResolution(candidate = {}) {
  return {
    id: candidate.definitionId,
    name: candidate.name,
    kind: candidate.kind,
    scope: candidate.scope,
    contextType: candidate.contextType,
    primaryAnchor: candidate.primaryAnchor,
    score: candidate.score,
    matchedSignals: uniqueStrings(candidate.matchedSignals).map(prettifySignal),
    matchedNodes: safeArray(candidate.nodeCandidates).slice(0, 4).map((node) => ({
      nodeId: node.nodeId,
      name: node.name,
      attribute: node.attribute,
      score: node.score,
      ontologySource: node.ontologySource || null,
      conceptLabel: node.conceptLabel || node.name,
      matchedSignals: uniqueStrings(node.matchedSignals).map(prettifySignal),
    })),
  };
}
