function asTrimmedString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    const normalized = asTrimmedString(value);
    if (normalized) return normalized;
  }
  return '';
}

function parseVersionFromUid(uid) {
  const normalizedUid = asTrimmedString(uid);
  if (!normalizedUid) return '';
  const match = normalizedUid.match(/::(\d+)$/);
  return match?.[1] || '';
}

function asIsoString(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }
  if (value && typeof value === 'object' && typeof value.$date === 'string') {
    return asIsoString(value.$date);
  }
  return '';
}

export function getCompositionTemplateId(composition = {}) {
  return firstNonEmptyString(
    composition?.archetype_details?.template_id?.value,
    composition?.archetype_details?.template_id,
    composition?.template_id,
    composition?.templateId
  );
}

export function getCompositionArchetypeNodeId(composition = {}) {
  return firstNonEmptyString(
    composition?.archetype_node_id,
    composition?.archetype_details?.archetype_id?.value
  );
}

export function getCompositionUid(composition = {}) {
  return firstNonEmptyString(
    composition?.uid?.value,
    composition?.uid,
    composition?.version_uid,
    composition?.composition_uid
  );
}

export function getCompositionVersionNumber(composition = {}, metadata = {}) {
  return firstNonEmptyString(
    metadata?.composition_version,
    metadata?.compositionVersion,
    metadata?.version,
    metadata?.versionNumber,
    composition?.composition_version,
    composition?.version,
    parseVersionFromUid(getCompositionUid(composition)),
    '1'
  );
}

export function getCompositionCommittedTime(composition = {}, metadata = {}) {
  return firstNonEmptyString(
    asIsoString(metadata?.commit_audit?.time_committed?.value),
    asIsoString(metadata?.version?.commit_audit?.time_committed?.value),
    asIsoString(metadata?.audit?.time_committed?.value),
    asIsoString(metadata?.time_committed),
    asIsoString(metadata?.timeCommitted),
    asIsoString(metadata?.committedAt),
    asIsoString(metadata?.timestamp),
    asIsoString(composition?.commit_audit?.time_committed?.value),
    asIsoString(composition?.time_committed),
    asIsoString(composition?.context?.start_time?.value),
    new Date().toISOString()
  );
}

export function summarizeCompositionForIngest(composition = {}, metadata = {}) {
  const canonicalTemplateId = firstNonEmptyString(
    composition?.archetype_details?.template_id?.value,
    composition?.archetype_details?.template_id
  );
  const templateId = getCompositionTemplateId(composition);
  const archetypeNodeId = getCompositionArchetypeNodeId(composition);
  const uid = getCompositionUid(composition);
  const compositionVersion = getCompositionVersionNumber(composition, metadata);
  const timeCommitted = getCompositionCommittedTime(composition, metadata);
  const warnings = [];
  const errors = [];

  if (!templateId) {
    errors.push('Missing template id at archetype_details.template_id.value');
  }

  if (!canonicalTemplateId && templateId && archetypeNodeId && templateId === archetypeNodeId) {
    errors.push('Template id resolves to the composition archetype_node_id instead of the canonical template id.');
  }

  if (templateId && archetypeNodeId && templateId === archetypeNodeId) {
    warnings.push('Template id matches composition archetype_node_id; this usually indicates incorrect ingest metadata.');
  }

  return {
    templateId,
    archetypeNodeId,
    uid,
    compositionVersion,
    timeCommitted,
    warnings,
    errors
  };
}

export function normalizeCompositionForIngest(composition = {}, metadata = {}) {
  const normalized = {
    ...(composition && typeof composition === 'object' ? composition : {})
  };
  const summary = summarizeCompositionForIngest(normalized, metadata);

  if (summary.templateId) {
    normalized.template_id = summary.templateId;
    normalized.templateId = normalized.templateId || summary.templateId;
    normalized.archetype_details = {
      ...(normalized.archetype_details && typeof normalized.archetype_details === 'object'
        ? normalized.archetype_details
        : {}),
      template_id:
        normalized?.archetype_details?.template_id && typeof normalized.archetype_details.template_id === 'object'
          ? {
              ...normalized.archetype_details.template_id,
              value: normalized.archetype_details.template_id.value || summary.templateId
            }
          : { value: summary.templateId }
    };
  }

  if (summary.archetypeNodeId && !normalized.archetype_node_id) {
    normalized.archetype_node_id = summary.archetypeNodeId;
  }

  if (summary.uid) {
    normalized.composition_uid = normalized.composition_uid || summary.uid;
    normalized.version_uid = normalized.version_uid || summary.uid;
  }

  if (summary.compositionVersion) {
    normalized.composition_version = normalized.composition_version || summary.compositionVersion;
    normalized.version = normalized.version || summary.compositionVersion;
  }

  if (summary.timeCommitted) {
    normalized.time_committed = normalized.time_committed || summary.timeCommitted;
    normalized.commit_audit = {
      ...(normalized.commit_audit && typeof normalized.commit_audit === 'object'
        ? normalized.commit_audit
        : {}),
      time_committed:
        normalized?.commit_audit?.time_committed && typeof normalized.commit_audit.time_committed === 'object'
          ? {
              ...normalized.commit_audit.time_committed,
              value: normalized.commit_audit.time_committed.value || summary.timeCommitted
            }
          : { value: summary.timeCommitted }
    };
  }

  return {
    composition: normalized,
    summary
  };
}
