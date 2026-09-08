import { AGENTIC_COPILOT_STRATEGY } from '@/config/agenticCopilotStrategy';
import {
  listResolvableContextDefinitions,
  resolveCon2LSemanticBindings,
  summarizeDefinitionResolution,
} from '@/lib/contextObjects/con2lSemanticResolver';

const slugify = (value) =>
  `${value || ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

function fuzzyIncludes(haystack = '', needles = []) {
  const normalized = slugify(haystack);
  return needles.some((needle) => normalized.includes(slugify(needle)));
}

function summarizeDefinition(definition = {}) {
  return {
    id: definition.id,
    name: definition.name,
    kind: definition.kind,
    scope: definition.scope || null,
    contextType: definition?.metadata?.contextContract?.contextType || null,
    primaryAnchor: definition?.metadata?.contextContract?.primaryAnchor || null,
  };
}

function findContextContractAsset(ref) {
  return AGENTIC_COPILOT_STRATEGY.contextContracts.find((contract) => {
    const idMatch = slugify(contract.id) === slugify(ref);
    const nameMatch = slugify(contract.name) === slugify(ref);
    return idMatch || nameMatch;
  });
}

function resolveCon2LArtifact(artifactOrId) {
  if (artifactOrId && typeof artifactOrId === 'object' && !Array.isArray(artifactOrId)) {
    return artifactOrId;
  }

  return AGENTIC_COPILOT_STRATEGY.retrieval.con2lArtifacts.find((item) => item.id === artifactOrId) || null;
}

export async function previewCon2LArtifact(db, artifactId, options = {}) {
  const artifact = resolveCon2LArtifact(artifactId);
  if (!artifact) {
    throw new Error(`Con2L artifact not found: ${artifactId}`);
  }

  const contextAsset = findContextContractAsset(artifact.resolved?.contextContract);
  const candidates = await listResolvableContextDefinitions(db, 140);
  const semanticResolution = resolveCon2LSemanticBindings({
    artifact,
    definitions: candidates,
    semanticConfirmation: options?.semanticConfirmation || null,
  });
  const matchedDefinitions = semanticResolution.definitionCandidates.map(summarizeDefinitionResolution);
  const selectedDefinition = semanticResolution.selectedDefinition;
  const selectedNodes = semanticResolution.selectedNodes;
  const resolvedArtifact = semanticResolution.enrichedArtifact;

  return {
    kind: 'con2lArtifact',
    artifact: resolvedArtifact,
    semanticResolution: {
      confidence: semanticResolution.confidence,
      policy: semanticResolution.effectivePolicy,
      threshold: semanticResolution.threshold,
      confirmationRequired: semanticResolution.confirmationRequired,
      reason: semanticResolution.reason,
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
      })),
      confirmation: semanticResolution.confirmation,
    },
    matchedDefinitions: matchedDefinitions.slice(0, 8),
    summary: {
      contextContract: selectedDefinition?.name || contextAsset?.name || resolvedArtifact.resolved?.contextContract || null,
      retrievalMode: resolvedArtifact.resolved?.retrievalMode || resolvedArtifact.executable?.dialect || null,
      matchedDefinitionCount: matchedDefinitions.length,
      semanticConfidence: semanticResolution.confidence,
      clarificationStatus: semanticResolution.confirmationRequired ? 'confirmation_required' : 'resolved',
      semanticTarget: selectedNodes.map((node) => node.attribute).join(', ') || null,
      deterministicSignals: [
        resolvedArtifact.resolved?.assertionType || null,
        ...(resolvedArtifact.resolved?.predicates || []),
        ...selectedNodes.map((node) => node.attribute),
      ].filter(Boolean),
    },
    compiled: resolvedArtifact.executable,
    warnings: semanticResolution.warnings,
  };
}

export async function previewObjectMapAsset(db, objectMapId) {
  const contextMap = AGENTIC_COPILOT_STRATEGY.factory.contextMaps.find((item) => item.id === objectMapId);
  if (!contextMap) {
    throw new Error(`Context Map asset not found: ${objectMapId}`);
  }

  const blockDefs = await db.collection('semantic_objects').find({ kind: { $in: ['block', 'fragment'] } }).limit(120).toArray();
  const objectDefs = await listResolvableContextDefinitions(db, 120);

  const matchedBlocks = blockDefs.filter((definition) => fuzzyIncludes(definition.name, contextMap.blocks));
  const matchedTargets = objectDefs.filter((definition) => fuzzyIncludes(definition.name, [contextMap.target]));

  return {
    kind: 'objectMap',
    objectMap: contextMap,
    matchedBlocks: matchedBlocks.map(summarizeDefinition).slice(0, 8),
    matchedTargets: matchedTargets.map(summarizeDefinition).slice(0, 8),
    summary: {
      source: contextMap.source,
      target: contextMap.target,
      matchedBlockCount: matchedBlocks.length,
      matchedTargetCount: matchedTargets.length,
    },
    preview: {
      sourceType: contextMap.source,
      blockBindings: contextMap.blocks.map((blockName) => ({
        blockName,
        matched: matchedBlocks.some((definition) => fuzzyIncludes(definition.name, [blockName])),
      })),
      targetOutcome: contextMap.outcome,
    },
    warnings: [
      ...(matchedBlocks.length === 0 ? ['No reusable blocks currently match this Context Map.'] : []),
      ...(matchedTargets.length === 0 ? ['No target ContextObject definitions currently match this Context Map.'] : []),
    ],
  };
}

export async function previewScenarioPack(db, scenarioPackId) {
  const pack = AGENTIC_COPILOT_STRATEGY.factory.scenarioPacks.find((item) => item.id === scenarioPackId);
  if (!pack) {
    throw new Error(`Scenario pack not found: ${scenarioPackId}`);
  }

  const linkedQuestions = AGENTIC_COPILOT_STRATEGY.copilots.questionLibrary.filter((row) =>
    pack.usedBy.includes(row.expectedProduct)
  );
  const contextDefs = await listResolvableContextDefinitions(db, 120);

  return {
    kind: 'scenarioPack',
    pack,
    summary: {
      usedBy: pack.usedBy.length,
      emittedArtifacts: pack.emits.length,
      linkedQuestions: linkedQuestions.length,
      availableContextDefinitions: contextDefs.length,
    },
    linkedQuestions,
    warnings:
      linkedQuestions.length === 0
        ? ['This scenario pack is not yet linked to any seeded copilot questions.']
        : [],
  };
}
