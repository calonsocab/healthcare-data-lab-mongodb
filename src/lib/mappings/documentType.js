const DOCUMENT_TYPE_ALIASES = Object.freeze({
  laboratory_csv: 'biology_csv'
});

export function canonicalizeDocumentType(value) {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  const aliasHit = DOCUMENT_TYPE_ALIASES[raw.toLowerCase()];
  return aliasHit || raw;
}

export function getDocumentTypeVariants(value) {
  const canonical = canonicalizeDocumentType(value);
  if (!canonical) return [];

  const variants = new Set([canonical]);
  for (const [alias, target] of Object.entries(DOCUMENT_TYPE_ALIASES)) {
    if (target === canonical) {
      variants.add(alias);
    }
  }

  const raw = String(value || '').trim();
  if (raw) variants.add(raw);
  return Array.from(variants);
}

