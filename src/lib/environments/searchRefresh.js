function normalizeDomain(domain) {
  return typeof domain === 'string' ? domain.trim().toLowerCase() : '';
}

export function getStrategyLinkId(link = null) {
  return link?.kehrnel?.strategyId || link?.strategyId || null;
}

export function supportsSearchRefresh(link = null) {
  if (normalizeDomain(link?.domain) !== 'openehr') return false;

  const strategyId = getStrategyLinkId(link);
  if (!strategyId) return false;

  if (strategyId === 'openehr.rps_dual' || strategyId === 'openehr.rps_dual_ibm') {
    return true;
  }

  return !!link?.mergedConfig?.collections?.search?.enabled;
}

export function normalizeSearchRefresh(value = null) {
  if (!value || typeof value !== 'object') return null;
  if (value.required !== true) return null;

  const source = value.source && typeof value.source === 'object'
    ? {
        type: value.source.type || 'analytics-template',
        dataModelId: value.source.dataModelId || null,
        dataModelName: value.source.dataModelName || null,
        templateId: value.source.templateId || null,
        fieldCount: Number.isFinite(value.source.fieldCount) ? value.source.fieldCount : null,
      }
    : null;

  return {
    required: true,
    reason: value.reason || 'analytics-template-updated',
    flaggedAt: value.flaggedAt || null,
    flaggedBy: value.flaggedBy || null,
    source,
    lastAttemptAt: value.lastAttemptAt || null,
    lastAttemptBy: value.lastAttemptBy || null,
    lastError: value.lastError || null,
    jobId: value.jobId || value.job_id || null,
    jobStatus: value.jobStatus || value.job_status || null,
    jobQueuedAt: value.jobQueuedAt || value.job_queued_at || null,
    resolvedAt: value.resolvedAt || null,
  };
}

export function buildAnalyticsSearchRefresh({
  dataModelId = null,
  dataModelName = null,
  templateId = null,
  fieldCount = null,
  userEmail = null,
  nowIso = new Date().toISOString(),
} = {}) {
  return normalizeSearchRefresh({
    required: true,
    reason: 'analytics-template-updated',
    flaggedAt: nowIso,
    flaggedBy: userEmail || null,
    source: {
      type: 'analytics-template',
      dataModelId,
      dataModelName,
      templateId,
      fieldCount: Number.isFinite(fieldCount) ? fieldCount : null,
    },
  });
}
