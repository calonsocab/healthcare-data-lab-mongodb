const AUTHORING_LAYER_LIST_FIELDS = [
  'valueSetCatalogs',
  'ontologySources',
  'matchingHints',
  'confirmationPrompts',
];

function isObjectRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function uniqueStrings(values = []) {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => `${value || ''}`.trim())
        .filter(Boolean)
    )
  );
}

export function normalizeSemanticAuthoringLayer(layer = {}) {
  if (!isObjectRecord(layer)) return {};

  const normalized = {};
  AUTHORING_LAYER_LIST_FIELDS.forEach((field) => {
    const values = uniqueStrings(layer[field]);
    if (values.length > 0) normalized[field] = values;
  });

  return normalized;
}

export function getSemanticAuthoringLayer(definition = {}, metadata = {}) {
  const definitionLayer = isObjectRecord(definition?.semanticLayer)
    ? definition.semanticLayer
    : null;
  const metadataLayer = isObjectRecord(metadata?.semanticLayer)
    ? metadata.semanticLayer
    : null;

  return normalizeSemanticAuthoringLayer(definitionLayer || metadataLayer || {});
}

export function applySemanticAuthoringLayer(definition, metadata, semanticLayer, options = {}) {
  const normalizedLayer = normalizeSemanticAuthoringLayer(semanticLayer);
  const persistInDefinition = Boolean(options.persistInDefinition);

  const nextDefinition = isObjectRecord(definition) ? { ...definition } : definition;
  const nextMetadata = isObjectRecord(metadata) ? { ...metadata } : {};

  if (isObjectRecord(nextDefinition) && 'semanticLayer' in nextDefinition) {
    delete nextDefinition.semanticLayer;
  }
  if ('semanticLayer' in nextMetadata) {
    delete nextMetadata.semanticLayer;
  }

  if (Object.keys(normalizedLayer).length > 0) {
    if (persistInDefinition) {
      if (isObjectRecord(nextDefinition)) {
        nextDefinition.semanticLayer = normalizedLayer;
      }
    } else {
      nextMetadata.semanticLayer = normalizedLayer;
    }
  }

  return {
    definition: nextDefinition,
    metadata: nextMetadata,
  };
}

function hasNonEmptyList(value) {
  return Array.isArray(value) && value.length > 0;
}

function countNodesWith(nodes = [], predicate) {
  return nodes.reduce((total, node) => total + (predicate(node) ? 1 : 0), 0);
}

function resolveNodeSemanticConfirmation(node = {}) {
  const confirmation = isObjectRecord(node?.annotations?.semanticConfirmation)
    ? node.annotations.semanticConfirmation
    : {};
  const policy = `${confirmation.policy || 'inherit'}`.trim() || 'inherit';
  const ontologySource = typeof confirmation.ontologySource === 'string'
    ? confirmation.ontologySource.trim()
    : '';
  const prompt = typeof confirmation.prompt === 'string'
    ? confirmation.prompt.trim()
    : '';

  return {
    policy,
    ontologySource,
    prompt,
  };
}

export function summarizeSemanticMatchCoverage(item = {}) {
  const nodes = Array.isArray(item?.nodes) ? item.nodes : [];
  const contract = isObjectRecord(item?.metadata?.contextContract)
    ? item.metadata.contextContract
    : {};
  const terminologyPolicy = isObjectRecord(contract.terminologyPolicy)
    ? contract.terminologyPolicy
    : {};
  const enrichmentPolicy = isObjectRecord(contract.enrichmentPolicy)
    ? contract.enrichmentPolicy
    : {};
  const resolutionPolicy = isObjectRecord(contract.resolutionPolicy)
    ? contract.resolutionPolicy
    : {};
  const authoringLayer = getSemanticAuthoringLayer(item?.definition, item?.metadata);

  const descriptionSourceCount = uniqueStrings(terminologyPolicy.descriptionSources).length;
  const preferredSystemCount = uniqueStrings(terminologyPolicy.preferredSystems).length;
  const conceptExpansionCount = uniqueStrings(terminologyPolicy.conceptExpansion).length;
  const embeddingCollectionCount = uniqueStrings(enrichmentPolicy.embeddingCollections).length;
  const valueSetCatalogCount = uniqueStrings(authoringLayer.valueSetCatalogs).length;
  const ontologySourceCount = uniqueStrings(authoringLayer.ontologySources).length;
  const globalHintCount = uniqueStrings(authoringLayer.matchingHints).length;
  const confirmationPromptCount = uniqueStrings(authoringLayer.confirmationPrompts).length;

  const nodesWithTerminology = countNodesWith(nodes, (node) => hasNonEmptyList(node?.terminologyBindings));
  const nodesWithValueSets = countNodesWith(
    nodes,
    (node) =>
      typeof node?.valueSet === 'string'
      || hasNonEmptyList(node?.valueSets)
      || (Array.isArray(node?.terminologyBindings)
        && node.terminologyBindings.some((binding) => typeof binding?.valueSet === 'string' && binding.valueSet.trim()))
  );
  const nodesWithHints = countNodesWith(
    nodes,
    (node) =>
      hasNonEmptyList(node?.matchingHints)
      || hasNonEmptyList(node?.aliases)
      || hasNonEmptyList(node?.synonyms)
      || hasNonEmptyList(node?.semanticLabels)
      || hasNonEmptyList(node?.queryHints)
  );
  const nodesWithEmbeddings = countNodesWith(
    nodes,
    (node) => hasNonEmptyList(node?.semanticEmbeddingRefs) || hasNonEmptyList(node?.semanticVectors)
  );
  const nodesWithConfirmation = countNodesWith(nodes, (node) => {
    const confirmation = resolveNodeSemanticConfirmation(node);
    return (
      confirmation.policy !== 'inherit'
      || confirmation.ontologySource.length > 0
      || confirmation.prompt.length > 0
    );
  });

  const clarificationPolicy = `${resolutionPolicy.clarificationPolicy || 'on_ambiguity'}`;
  const confidenceThreshold = Number.isFinite(Number(resolutionPolicy.confidenceThreshold))
    ? Number(resolutionPolicy.confidenceThreshold)
    : 0.65;
  const useEmbeddings = Boolean(enrichmentPolicy.useEmbeddings) || embeddingCollectionCount > 0 || nodesWithEmbeddings > 0;

  const readinessSignals = {
    terminologyCoverage: preferredSystemCount > 0 || nodesWithTerminology > 0,
    descriptionCoverage: descriptionSourceCount > 0,
    valueSetCoverage: valueSetCatalogCount > 0 || nodesWithValueSets > 0,
    hintCoverage: globalHintCount > 0 || nodesWithHints > 0,
    embeddingCoverage: useEmbeddings,
    ontologyCoverage: ontologySourceCount > 0,
    confirmationCoverage: clarificationPolicy !== 'never' || confirmationPromptCount > 0 || nodesWithConfirmation > 0,
  };

  const readinessScore = Object.values(readinessSignals).filter(Boolean).length;
  const missingSignals = Object.entries(readinessSignals)
    .filter(([, present]) => !present)
    .map(([signal]) => signal);

  return {
    authoringLayer,
    descriptionSourceCount,
    preferredSystemCount,
    conceptExpansionCount,
    embeddingCollectionCount,
    valueSetCatalogCount,
    ontologySourceCount,
    globalHintCount,
    confirmationPromptCount,
    nodesWithTerminology,
    nodesWithValueSets,
    nodesWithHints,
    nodesWithEmbeddings,
    nodesWithConfirmation,
    clarificationPolicy,
    confidenceThreshold,
    useEmbeddings,
    readinessSignals,
    readinessScore,
    semanticReady: readinessScore >= 4,
    missingSignals,
  };
}
