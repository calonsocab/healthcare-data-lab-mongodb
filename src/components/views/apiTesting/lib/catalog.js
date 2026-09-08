export function getCatalogTemplateId(model) {
  const candidates = [
    model?.metadata?.templateId,
    model?.templateId,
    model?.name,
  ];
  return candidates.find((value) => typeof value === 'string' && value.trim())?.trim() || '';
}

export function getCatalogTemplateSourceType(model) {
  const sourceType = model?.source?.type;
  if (typeof sourceType === 'string' && sourceType.trim()) {
    return sourceType.trim().toLowerCase();
  }
  return typeof model?.source?.xml === 'string' && model.source.xml.trim() ? 'opt' : '';
}

export function isCatalogTemplateImportable(model) {
  return getCatalogTemplateSourceType(model) === 'opt';
}
