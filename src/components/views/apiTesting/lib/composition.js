export function getCompositionTemplateId(composition) {
  if (!composition || typeof composition !== 'object') return '';

  const candidates = [
    composition?.archetype_details?.template_id?.value,
    typeof composition?.archetype_details?.template_id === 'string'
      ? composition.archetype_details.template_id
      : '',
    composition?.template_id,
    composition?.templateId,
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

export function normalizeCompositionSummary(composition) {
  const uid = composition?.uid ||
    composition?.c_uid_value ||
    composition?.c_uid ||
    composition?.['c/uid/value'] ||
    composition?.compositionUid ||
    composition?.id ||
    composition?.[0] ||
    '';

  const name = composition?.name ||
    composition?.c_name_value ||
    composition?.c_name ||
    composition?.['c/name/value'] ||
    composition?.data?.name?.value ||
    composition?.[1] ||
    '';

  const templateId = composition?.templateId ||
    composition?.c_archetype_details_template_id_value ||
    composition?.c_archetype_details ||
    composition?.['c/archetype_details/template_id/value'] ||
    getCompositionTemplateId(composition?.data || composition) ||
    composition?.[2] ||
    '';

  return {
    uid: typeof uid === 'string' ? uid : '',
    name: typeof name === 'string' ? name : '',
    templateId: typeof templateId === 'string' ? templateId : '',
  };
}

export function mergeCompositionSummaries(...groups) {
  const merged = new Map();
  for (const group of groups) {
    for (const item of Array.isArray(group) ? group : []) {
      const normalized = normalizeCompositionSummary(item);
      if (!normalized.uid) continue;
      const current = merged.get(normalized.uid) || { uid: normalized.uid, name: '', templateId: '' };
      merged.set(normalized.uid, {
        uid: normalized.uid,
        name: normalized.name || current.name,
        templateId: normalized.templateId || current.templateId,
      });
    }
  }
  return Array.from(merged.values());
}

export function withTemplateId(composition, templateId) {
  const next = composition && typeof composition === 'object' ? { ...composition } : {};
  next._type = next._type || 'COMPOSITION';
  next.archetype_details = {
    ...(next.archetype_details && typeof next.archetype_details === 'object' ? next.archetype_details : {}),
    template_id: { value: templateId }
  };
  return next;
}

export function parseCompositionEntriesFromText(text, sourceLabel) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`${sourceLabel}: ${error.message}`);
  }

  const toEntry = (payload, index = null) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      const labelSuffix = index === null ? '' : ` item ${index + 1}`;
      throw new Error(`${sourceLabel}${labelSuffix} must be a JSON object.`);
    }
    return {
      id: crypto.randomUUID(),
      label: index === null ? sourceLabel : `${sourceLabel} #${index + 1}`,
      payload,
    };
  };

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw new Error(`${sourceLabel}: JSON array cannot be empty.`);
    }
    return parsed.map((payload, index) => toEntry(payload, index));
  }
  return [toEntry(parsed)];
}

export function extractEhrIdHintFromAql(queryText) {
  if (typeof queryText !== 'string') return '';
  const match = queryText.match(/ehr_id\/value\s*=\s*['"]([^'"]+)['"]/i);
  return match?.[1]?.trim() || '';
}
