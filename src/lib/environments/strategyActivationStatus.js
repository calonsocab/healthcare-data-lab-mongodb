import { normalizeSearchRefresh } from './searchRefresh.js';

function normalizeDomain(domain) {
  return typeof domain === 'string' ? domain.trim().toLowerCase() : '';
}

function resolveActivationId(link) {
  return link?.kehrnel?.activationId || link?.activationId || null;
}

function resolveStrategyId(link) {
  return link?.kehrnel?.strategyId || link?.strategyId || null;
}

function resolveConfigHash(link) {
  return link?.kehrnel?.configHash || link?.configHash || null;
}

function resolveManifestDigest(link) {
  return link?.kehrnel?.manifestDigest || link?.manifestDigest || null;
}

function isoNow() {
  return new Date().toISOString();
}

function isNonEmptyObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
}

function countFromResult(value) {
  if (Array.isArray(value)) return value.length;
  if (value && typeof value === 'object' && Number.isFinite(value.count)) return Number(value.count);
  return 0;
}

function summarizeArtifacts(initialization) {
  const artifacts = initialization?.artifacts;
  if (!artifacts) {
    return {
      status: 'skipped',
      message: 'No storage initialization details were reported.',
      details: null,
    };
  }

  const createdCollections = Array.isArray(artifacts.created) ? artifacts.created : [];
  const warnings = Array.isArray(artifacts.warnings) ? artifacts.warnings : [];
  const skipped = Array.isArray(artifacts.skipped) ? artifacts.skipped : [];

  const detail = {
    createdCollections,
    warnings,
    skipped,
  };

  if (artifacts.ok === false || artifacts.error) {
    return {
      status: 'error',
      message: artifacts.warning || artifacts.error || 'Storage artifact initialization failed.',
      details: detail,
    };
  }

  if (warnings.length > 0 || skipped.length > 0) {
    return {
      status: 'warning',
      message: `Collections ensured with ${warnings.length} warning${warnings.length === 1 ? '' : 's'} and ${skipped.length} skipped item${skipped.length === 1 ? '' : 's'}.`,
      details: detail,
    };
  }

  return {
    status: 'completed',
    message: `Ensured ${createdCollections.length} collection${createdCollections.length === 1 ? '' : 's'} and related indexes.`,
    details: detail,
  };
}

function summarizeDictionaries(initialization) {
  const dictionaries = initialization?.dictionaries;
  if (!dictionaries) {
    return {
      status: 'skipped',
      message: 'No dictionary bootstrap was required.',
      details: null,
    };
  }

  const seeded = dictionaries?.seeded && typeof dictionaries.seeded === 'object'
    ? dictionaries.seeded
    : {};
  const ensuredCollections = dictionaries?.ensured_collections && typeof dictionaries.ensured_collections === 'object'
    ? dictionaries.ensured_collections
    : {};
  const warnings = Array.isArray(dictionaries?.warnings) ? dictionaries.warnings : [];
  const seededCount = countFromResult(seeded);
  const ensuredCount = countFromResult(ensuredCollections);

  if (dictionaries.ok === false) {
    return {
      status: 'warning',
      message: dictionaries.warning || 'Dictionary bootstrap reported a warning.',
      details: { seeded, ensuredCollections, warnings },
    };
  }

  return {
    status: warnings.length > 0 ? 'warning' : 'completed',
    message:
      seededCount > 0 || ensuredCount > 0
        ? `Dictionary bootstrap ensured ${ensuredCount} collection${ensuredCount === 1 ? '' : 's'} and seeded ${seededCount} dataset${seededCount === 1 ? '' : 's'}.`
        : 'Dictionary bootstrap completed.',
    details: { seeded, ensuredCollections, warnings },
  };
}

function validationStepStatus(validation) {
  switch (validation?.status) {
    case 'activated':
      return 'completed';
    case 'missing':
    case 'mismatch':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'pending';
  }
}

function workflowStatusFrom(validation, artifactStatus, dictionaryStatus) {
  if (validation?.status === 'error' || artifactStatus === 'error') {
    return 'failed';
  }
  if (validation?.status === 'activated' && artifactStatus !== 'warning' && dictionaryStatus !== 'warning') {
    return 'activated';
  }
  if (validation?.status === 'activated') {
    return 'activated_with_warnings';
  }
  if (validation?.status === 'missing' || validation?.status === 'mismatch') {
    return 'attention_required';
  }
  return 'pending';
}

export async function validateStrategyLinkCoherence({
  service,
  env,
  envId,
  link,
  requestId = null,
}) {
  const checkedAt = isoNow();
  const normalizedDomain = normalizeDomain(link?.domain);
  const envKehrnel = env?.kehrnel || {};
  const envKey = envKehrnel.envKey || envId;
  const expectedStrategyId = link?.kehrnel?.strategyId || link?.strategyId || null;
  const expectedConfigHash = link?.kehrnel?.configHash || link?.configHash || null;
  const expectedManifestDigest = link?.kehrnel?.manifestDigest || link?.manifestDigest || null;
  const expectedTargetDatabase = link?.targetDatabase || env?.domainDatabases?.[normalizedDomain] || env?.database || null;
  const base = {
    envId,
    envKey,
    domain: normalizedDomain || null,
    checkedAt,
    checks: {
      activationFound: false,
      strategyMatch: false,
      configHashMatch: true,
      manifestDigestMatch: true,
      endpointsAvailable: false,
      targetDatabaseAvailable: !!expectedTargetDatabase,
    },
    expected: {
      strategyId: expectedStrategyId,
      configHash: expectedConfigHash,
      manifestDigest: expectedManifestDigest,
      targetDatabase: expectedTargetDatabase,
    },
    actual: {
      strategyId: null,
      configHash: null,
      manifestDigest: null,
      activationId: null,
      activatedAt: null,
      targetDatabase: expectedTargetDatabase,
    },
    mismatches: [],
  };

  if (!service || !envId || !normalizedDomain) {
    return {
      ...base,
      status: 'error',
      message: 'The strategy link is missing a valid domain for coherence validation.',
    };
  }

  let activation = null;
  let endpoints = null;

  try {
    const activationsResult = await service.listActivations(envKey, {
      connectionId: envKehrnel.connectionId,
      envKehrnel,
      requestId,
    });
    const activations = Array.isArray(activationsResult?.activations)
      ? activationsResult.activations
      : (Array.isArray(activationsResult) ? activationsResult : []);

    activation = activations.find(
      (entry) => normalizeDomain(entry?.domain) === normalizedDomain
    ) || null;
  } catch (error) {
    if (error?.status === 404) {
      activation = null;
    } else {
      return {
        ...base,
        status: 'error',
        message: error?.message || 'Activation validation failed.',
        error: {
          code: error?.code || null,
          status: error?.status || null,
          details: error?.details || null,
        },
      };
    }
  }

  const actualStrategyId = activation?.strategy_id || activation?.strategyId || null;
  const actualConfigHash = activation?.config_hash || activation?.configHash || null;
  const actualManifestDigest = activation?.manifest_digest || activation?.manifestDigest || null;
  const actualActivationId = activation?.activation_id || activation?.activationId || null;
  const actualActivatedAt = activation?.activated_at || activation?.activatedAt || null;

  base.checks.activationFound = !!activation;
  base.checks.strategyMatch = !!activation && (!expectedStrategyId || actualStrategyId === expectedStrategyId);
  base.checks.configHashMatch = !expectedConfigHash || !actualConfigHash || actualConfigHash === expectedConfigHash;
  base.checks.manifestDigestMatch = !expectedManifestDigest || !actualManifestDigest || actualManifestDigest === expectedManifestDigest;
  base.actual = {
    strategyId: actualStrategyId,
    configHash: actualConfigHash,
    manifestDigest: actualManifestDigest,
    activationId: actualActivationId,
    activatedAt: actualActivatedAt,
    targetDatabase: expectedTargetDatabase,
  };

  if (!activation) {
    base.mismatches.push('Activation is missing in Kehrnel.');
    return {
      ...base,
      status: 'missing',
      message: `No activation was found for ${normalizedDomain} in this environment.`,
    };
  }

  if (!base.checks.strategyMatch) {
    base.mismatches.push('The active strategy in Kehrnel does not match the environment link.');
  }
  if (!base.checks.configHashMatch) {
    base.mismatches.push('The active configuration hash in Kehrnel differs from HDL.');
  }
  if (!base.checks.manifestDigestMatch) {
    base.mismatches.push('The active manifest digest in Kehrnel differs from HDL.');
  }

  try {
    const endpointsResult = await service.getEndpoints(envKey, {
      domain: normalizedDomain,
      connectionId: envKehrnel.connectionId,
      envKehrnel,
      requestId,
    });
    endpoints = endpointsResult.endpoints || endpointsResult || null;
    base.checks.endpointsAvailable = isNonEmptyObject(endpoints);
  } catch (error) {
    base.mismatches.push(error?.message || 'Endpoints are not available for this activation.');
  }

  if (!base.checks.endpointsAvailable) {
    base.mismatches.push('The runtime did not publish endpoints for this activation.');
  }

  if (base.mismatches.length > 0) {
    return {
      ...base,
      status: 'mismatch',
      message: 'The environment link and runtime activation are not fully aligned yet.',
      endpoints,
    };
  }

  return {
    ...base,
    status: 'activated',
    message: 'The strategy is activated and coherent with this environment.',
    endpoints,
  };
}

export function buildActivationWorkflow({
  confirmedAt = isoNow(),
  activation = null,
  initialization = null,
  validation = null,
}) {
  const artifactSummary = summarizeArtifacts(initialization);
  const dictionarySummary = summarizeDictionaries(initialization);
  const status = workflowStatusFrom(validation, artifactSummary.status, dictionarySummary.status);
  const completedAt = validation?.checkedAt || isoNow();

  return {
    status,
    progress: 100,
    confirmedAt,
    completedAt,
    steps: [
      {
        id: 'confirm_configuration',
        label: 'Configuration confirmed',
        status: 'completed',
        message: 'The environment configuration was reviewed before activation.',
        completedAt: confirmedAt,
      },
      {
        id: 'activate_strategy',
        label: 'Runtime activation',
        status: activation ? 'completed' : 'error',
        message: activation
          ? `Activated ${activation.strategyId || activation.strategy_id || 'strategy'} for ${activation.domain || 'the domain'}.`
          : 'Activation did not complete.',
        completedAt,
        details: activation ? {
          activationId: activation.activationId || activation.activation_id || null,
          strategyId: activation.strategyId || activation.strategy_id || null,
          domain: activation.domain || null,
        } : null,
      },
      {
        id: 'initialize_storage',
        label: 'Collections and indexes',
        status: artifactSummary.status,
        message: artifactSummary.message,
        completedAt,
        details: artifactSummary.details,
      },
      {
        id: 'bootstrap_dictionaries',
        label: 'Dictionary bootstrap',
        status: dictionarySummary.status,
        message: dictionarySummary.message,
        completedAt,
        details: dictionarySummary.details,
      },
      {
        id: 'validate_environment',
        label: 'Environment coherence',
        status: validationStepStatus(validation),
        message: validation?.message || 'Environment validation is pending.',
        completedAt: validation?.checkedAt || completedAt,
        details: validation ? {
          checks: validation.checks,
          mismatches: validation.mismatches,
        } : null,
      },
    ],
  };
}

export function mergeValidationIntoWorkflow(existingWorkflow, validation) {
  const workflow = existingWorkflow && typeof existingWorkflow === 'object'
    ? JSON.parse(JSON.stringify(existingWorkflow))
    : { steps: [] };

  const nextSteps = Array.isArray(workflow.steps) ? [...workflow.steps] : [];
  const nextStep = {
    id: 'validate_environment',
    label: 'Environment coherence',
    status: validationStepStatus(validation),
    message: validation?.message || 'Environment validation is pending.',
    completedAt: validation?.checkedAt || isoNow(),
    details: validation ? {
      checks: validation.checks,
      mismatches: validation.mismatches,
    } : null,
  };
  const index = nextSteps.findIndex((step) => step?.id === 'validate_environment');
  if (index >= 0) nextSteps[index] = nextStep;
  else nextSteps.push(nextStep);

  const artifactStatus = nextSteps.find((step) => step?.id === 'initialize_storage')?.status || 'pending';
  const dictionaryStatus = nextSteps.find((step) => step?.id === 'bootstrap_dictionaries')?.status || 'pending';

  return {
    ...workflow,
    status: workflowStatusFrom(validation, artifactStatus, dictionaryStatus),
    progress: 100,
    completedAt: validation?.checkedAt || workflow.completedAt || isoNow(),
    steps: nextSteps,
  };
}

function matchesValidatedLink(currentLink, validation) {
  const currentDomain = normalizeDomain(currentLink?.domain);
  if (!currentDomain || currentDomain !== validation.domain) {
    return false;
  }

  const currentActivationId = resolveActivationId(currentLink);
  const currentStrategyId = resolveStrategyId(currentLink);
  const currentConfigHash = resolveConfigHash(currentLink);
  const currentManifestDigest = resolveManifestDigest(currentLink);

  if (validation.expectedActivationId) {
    return currentActivationId === validation.expectedActivationId;
  }

  if (validation.expectedStrategyId && currentStrategyId && currentStrategyId !== validation.expectedStrategyId) {
    return false;
  }

  if (validation.expectedConfigHash && currentConfigHash && currentConfigHash !== validation.expectedConfigHash) {
    return false;
  }

  if (
    validation.expectedManifestDigest &&
    currentManifestDigest &&
    currentManifestDigest !== validation.expectedManifestDigest
  ) {
    return false;
  }

  return true;
}

export function mergeCoherenceValidationsIntoStrategyLinks(currentLinks = [], validations = []) {
  const nextLinks = Array.isArray(currentLinks) ? [...currentLinks] : [];
  const results = [];
  let changed = false;

  for (const validation of Array.isArray(validations) ? validations : []) {
    const domain = normalizeDomain(validation?.domain);
    if (!domain || !validation?.coherence) {
      continue;
    }

    const index = nextLinks.findIndex((link) => matchesValidatedLink(link, { ...validation, domain }));
    if (index < 0) {
      results.push({
        domain,
        status: 'stale',
        message: 'Validation was skipped because the strategy link changed while the check was running.',
        applied: false,
      });
      continue;
    }

    const link = nextLinks[index];
    const coherence = validation.coherence;
    nextLinks[index] = {
      ...link,
      kehrnel: {
        ...(link?.kehrnel || {}),
        endpoints: coherence.endpoints || link?.kehrnel?.endpoints || null,
        endpointsSnapshot: coherence.endpoints || link?.kehrnel?.endpointsSnapshot || null,
        coherence,
        activationWorkflow: mergeValidationIntoWorkflow(link?.kehrnel?.activationWorkflow, coherence),
        lastStatus: coherence.status || link?.kehrnel?.lastStatus || null,
      }
    };
    changed = true;
    results.push({
      domain,
      status: coherence.status,
      message: coherence.message,
      applied: true,
    });
  }

  return {
    changed,
    strategyLinks: nextLinks,
    results,
  };
}

export function normalizeActivationRuntimeState(kehrnel = null) {
  if (!kehrnel || typeof kehrnel !== 'object') return null;
  return {
    connectionId: kehrnel.connectionId || null,
    runtimeUrl: kehrnel.runtimeUrl || null,
    strategyId: kehrnel.strategyId || null,
    config: kehrnel.config || null,
    activatedAt: kehrnel.activatedAt || null,
    lastStatus: kehrnel.lastStatus || null,
    runtimeStatus: kehrnel.runtimeStatus || null,
    endpoints: kehrnel.endpoints || null,
    endpointsSnapshot: kehrnel.endpointsSnapshot || null,
    activationId: kehrnel.activationId || null,
    endpoint: kehrnel.endpoint || null,
    endpointName: kehrnel.endpointName || null,
    manifestDigest: kehrnel.manifestDigest || null,
    configHash: kehrnel.configHash || null,
    strategyVersion: kehrnel.strategyVersion || null,
    replaced: !!kehrnel.replaced,
    previousActivationId: kehrnel.previousActivationId || null,
    error: kehrnel.error || null,
    initialization: kehrnel.initialization || null,
    coherence: kehrnel.coherence || null,
    activationWorkflow: kehrnel.activationWorkflow || null,
    searchRefresh: normalizeSearchRefresh(kehrnel.searchRefresh),
    alreadyActive: !!kehrnel.alreadyActive,
  };
}
