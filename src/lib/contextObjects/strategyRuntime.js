import { AGENTIC_COPILOT_STRATEGY } from '@/config/agenticCopilotStrategy';
import {
  listResolvableContextDefinitions,
  resolveCon2LSemanticBindings,
} from '@/lib/contextObjects/con2lSemanticResolver';
import { publishKehrnelContextCatalog } from '@/lib/contextObjects/kehrnelCatalog';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';
import { normalizeDomain, resolveRuntimeContext } from '@/lib/kehrnel/runtimeContext';

const CONTEXT_RUNTIME_STRATEGIES = new Set([
  'fhir.contextobjects.vitals_window',
  'x12.co_single',
]);

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function slugify(value) {
  return `${value || ''}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function findCon2LArtifact(artifactId) {
  return AGENTIC_COPILOT_STRATEGY.retrieval.con2lArtifacts.find((item) => item.id === artifactId) || null;
}

function resolveCon2LArtifact(artifactOrId) {
  if (artifactOrId && typeof artifactOrId === 'object' && !Array.isArray(artifactOrId)) {
    return artifactOrId;
  }
  return findCon2LArtifact(artifactOrId);
}

function findContextMapAsset(assetId) {
  return AGENTIC_COPILOT_STRATEGY.factory.contextMaps.find((item) => item.id === assetId) || null;
}

function inferQuestionFromArtifact(artifact) {
  const titleToken = slugify(artifact?.title);
  const example = AGENTIC_COPILOT_STRATEGY.retrieval.examples.find(
    (item) =>
      slugify(item.id).includes(titleToken) ||
      titleToken.includes(slugify(item.id)) ||
      slugify(item.title) === titleToken
  );
  return example?.naturalLanguage || artifact?.title || 'Resolve this context request';
}

function toRequestedPoints(artifact) {
  const draft = artifact?.draft || {};
  const semanticTargets = safeArray(artifact?.resolved?.semanticTargets);
  return Array.from(
    new Set(
      [...safeArray(draft.focus), ...safeArray(draft.evidence), ...safeArray(draft.groupBy), ...semanticTargets].filter(Boolean)
    )
  );
}

function toCon2LDraft(artifact) {
  const draft = artifact?.draft || {};
  const resolved = artifact?.resolved || {};
  return {
    stage: 'draft',
    utterance: inferQuestionFromArtifact(artifact),
    request_ir: {
      task: draft.ask || null,
      scope: draft.subject || null,
      temporal: draft.window || null,
      aggregate: draft.ask || null,
      assertion_type: resolved.assertionType || null,
      requested_points: toRequestedPoints(artifact),
    },
    hints: {
      originalDraft: draft,
      resolvedSignals: resolved,
      semanticResolution: resolved?.semanticResolution || null,
    },
  };
}

function toCon2LExecutable(artifact) {
  const executable = artifact?.executable || {};
  const semanticResolution = executable?.meta?.semanticResolution || artifact?.resolved?.semanticResolution || null;
  const predicates = safeArray(executable.where).map((item) => ({
    field: item?.field || item?.predicate || 'unknown',
    op: item?.op || 'eq',
    value: item?.value ?? true,
  }));
  return {
    stage: 'executable',
    source_definition: executable.from || artifact?.resolved?.contextContract || 'unknown_context_contract',
    scope:
      executable?.subject?.anchor === 'patient'
        ? 'subject'
        : artifact?.draft?.subject === 'population'
          ? 'population'
          : artifact?.draft?.subject || 'subject',
    subject_filter: {},
    predicates,
    projection: executable.output ? { _id: 1, output: executable.output } : {},
    sort: {},
    limit: null,
    meta: {
      dialect: executable.dialect || 'con2l/v1',
      originalExecutable: executable,
      semanticResolution,
    },
  };
}

function toContextMapPayload(asset) {
  return {
    id: asset.id,
    title: asset.name,
    source_type: asset.source,
    target_definition: asset.target,
    rules: safeArray(asset.blocks).map((block) => ({
      source: `source.${slugify(block)}`,
      target: `blocks.${slugify(block)}`,
      transform: null,
      required: true,
    })),
    terminology_bindings: [],
    notes: asset.outcome ? [asset.outcome] : [],
  };
}

function pickRuntimeTarget(environment, requested = {}) {
  const strategyLinks = safeArray(environment?.strategyLinks);
  const requestedStrategyId = requested.strategyId || null;
  const requestedDomain = normalizeDomain(requested.domain || 'contextobjects');

  let strategyLink = null;
  if (requestedStrategyId) {
    strategyLink =
      strategyLinks.find(
        (link) =>
          link?.strategyId === requestedStrategyId || link?.kehrnel?.strategyId === requestedStrategyId
      ) || null;
  }

  if (!strategyLink && requestedDomain) {
    strategyLink =
      strategyLinks.find((link) => normalizeDomain(link?.domain) === requestedDomain) || null;
  }

  if (!strategyLink) {
    strategyLink =
      strategyLinks.find((link) =>
        CONTEXT_RUNTIME_STRATEGIES.has(link?.kehrnel?.strategyId || link?.strategyId || '')
      ) || null;
  }

  const strategyId =
    requestedStrategyId ||
    strategyLink?.kehrnel?.strategyId ||
    strategyLink?.strategyId ||
    null;

  return {
    strategyId,
    domain: normalizeDomain(strategyLink?.domain) || requestedDomain || null,
    strategyLink,
  };
}

async function prepareRuntime({
  coreDb,
  tenantDb,
  environment,
  userEmail,
  requestedDomain,
  strategyId,
  connectionId,
}) {
  const target = pickRuntimeTarget(environment, { domain: requestedDomain, strategyId });
  const catalog = await publishKehrnelContextCatalog(tenantDb, environment, userEmail, { includeDraft: true });

  if (!target.strategyId) {
    return {
      available: false,
      status: 'unavailable',
      catalog,
      target,
      reason: 'No context-capable kehrnel strategy is linked to the active environment yet.',
    };
  }

  const service = createKehrnelService(coreDb);
  const runtime = await resolveRuntimeContext({
    coreDb,
    userEmail,
    envId: environment?.id,
    requestedDomain: target.domain,
    strategyId: target.strategyId,
    requestedConnectionId: connectionId,
  });

  const resolvedStrategyId =
    runtime?.autoActivate?.strategyId ||
    runtime?.strategyLink?.kehrnel?.strategyId ||
    runtime?.strategyLink?.strategyId ||
    target.strategyId;
  const resolvedDomain = runtime?.domain || target.domain;

  return {
    available: Boolean(resolvedStrategyId && resolvedDomain),
    status: resolvedStrategyId && resolvedDomain ? 'ready' : 'unavailable',
    catalog,
    target: {
      strategyId: resolvedStrategyId || null,
      domain: resolvedDomain || null,
      linkedDomain: target.domain || null,
    },
    runtime,
    service,
    connectionId: runtime?.connectionId || connectionId || null,
    envKey: runtime?.envKey || environment?.id,
  };
}

function unwrapOpResult(result) {
  return result?.result || result;
}

export async function runCon2LArtifactRuntime({
  coreDb,
  tenantDb,
  environment,
  userEmail,
  artifactId,
  artifact = null,
  strategyId = null,
  connectionId = null,
  semanticConfirmation = null,
}) {
  const resolvedArtifact = resolveCon2LArtifact(artifact || artifactId);
  if (!resolvedArtifact) {
    throw new Error(`Con2L artifact not found: ${artifactId}`);
  }

  const definitions = await listResolvableContextDefinitions(tenantDb, 160);
  const semanticResolution = resolveCon2LSemanticBindings({
    artifact: resolvedArtifact,
    definitions,
    semanticConfirmation,
  });
  const executableArtifact = semanticResolution.enrichedArtifact;

  if (semanticResolution.confirmationRequired && !semanticResolution.confirmed) {
    return {
      available: true,
      status: 'confirmation_required',
      semanticResolution: {
        confidence: semanticResolution.confidence,
        policy: semanticResolution.effectivePolicy,
        threshold: semanticResolution.threshold,
        reason: semanticResolution.reason,
        selectedDefinition: semanticResolution.selectedDefinition
          ? {
              id: semanticResolution.selectedDefinition.definitionId,
              name: semanticResolution.selectedDefinition.name,
            }
          : null,
        selectedNodes: semanticResolution.selectedNodes.map((node) => ({
          nodeId: node.nodeId,
          name: node.name,
          attribute: node.attribute,
          ontologySource: node.ontologySource || null,
        })),
      },
      confirmation: semanticResolution.confirmation,
      authoredExecutable: toCon2LExecutable(executableArtifact),
      warnings: semanticResolution.warnings,
    };
  }

  const runtime = await prepareRuntime({
    coreDb,
    tenantDb,
    environment,
    userEmail,
    requestedDomain: 'contextobjects',
    strategyId,
    connectionId,
  });

  if (!runtime.available) {
    return {
      available: false,
      status: runtime.status,
      reason: runtime.reason,
      catalog: runtime.catalog,
      target: runtime.target,
    };
  }

  try {
    const negotiated = await runtime.service.runOp(
      runtime.envKey,
      runtime.target.strategyId,
      'negotiate_con2l',
      {
        draft: toCon2LDraft(executableArtifact),
        catalog: { collection: 'kehrnel_context_catalog', includeDraft: true },
      },
      {
        connectionId: runtime.connectionId,
        domain: runtime.target.domain,
        autoActivate: runtime.runtime?.autoActivate || { strategyId: runtime.target.strategyId, config: {} },
      }
    );

    const authoredCompile = await runtime.service.runOp(
      runtime.envKey,
      runtime.target.strategyId,
      'compile_con2l',
      {
        con2lExecutable: toCon2LExecutable(executableArtifact),
      },
      {
        connectionId: runtime.connectionId,
        domain: runtime.target.domain,
        autoActivate: runtime.runtime?.autoActivate || { strategyId: runtime.target.strategyId, config: {} },
      }
    );

    return {
      available: true,
      status: 'ok',
      catalog: runtime.catalog,
      target: runtime.target,
      semanticResolution: {
        confidence: semanticResolution.confidence,
        policy: semanticResolution.effectivePolicy,
        threshold: semanticResolution.threshold,
        reason: semanticResolution.reason,
        selectedDefinition: semanticResolution.selectedDefinition
          ? {
              id: semanticResolution.selectedDefinition.definitionId,
              name: semanticResolution.selectedDefinition.name,
            }
          : null,
        selectedNodes: semanticResolution.selectedNodes.map((node) => ({
          nodeId: node.nodeId,
          name: node.name,
          attribute: node.attribute,
          ontologySource: node.ontologySource || null,
        })),
      },
      negotiated: unwrapOpResult(negotiated),
      authoredExecutable: unwrapOpResult(authoredCompile),
    };
  } catch (error) {
    return {
      available: true,
      status: 'error',
      catalog: runtime.catalog,
      target: runtime.target,
      semanticResolution: {
        confidence: semanticResolution.confidence,
        policy: semanticResolution.effectivePolicy,
        threshold: semanticResolution.threshold,
        reason: semanticResolution.reason,
      },
      error: error?.message || 'Failed to execute live Con2L runtime',
    };
  }
}

export async function runContextMapRuntime({
  coreDb,
  tenantDb,
  environment,
  userEmail,
  assetId,
  strategyId = null,
  connectionId = null,
}) {
  const asset = findContextMapAsset(assetId);
  if (!asset) {
    throw new Error(`Context Map asset not found: ${assetId}`);
  }

  const runtime = await prepareRuntime({
    coreDb,
    tenantDb,
    environment,
    userEmail,
    requestedDomain: 'contextobjects',
    strategyId,
    connectionId,
  });

  if (!runtime.available) {
    return {
      available: false,
      status: runtime.status,
      reason: runtime.reason,
      catalog: runtime.catalog,
      target: runtime.target,
    };
  }

  try {
    const summary = await runtime.service.runOp(
      runtime.envKey,
      runtime.target.strategyId,
      'summarize_object_map',
      {
        objectMap: toContextMapPayload(asset),
      },
      {
        connectionId: runtime.connectionId,
        domain: runtime.target.domain,
        autoActivate: runtime.runtime?.autoActivate || { strategyId: runtime.target.strategyId, config: {} },
      }
    );

    return {
      available: true,
      status: 'ok',
      catalog: runtime.catalog,
      target: runtime.target,
      summary: unwrapOpResult(summary),
    };
  } catch (error) {
    return {
      available: true,
      status: 'error',
      catalog: runtime.catalog,
      target: runtime.target,
      error: error?.message || 'Failed to execute live Context Map runtime',
    };
  }
}
