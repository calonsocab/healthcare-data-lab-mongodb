export function normalizeDomainKey(domain) {
  return typeof domain === 'string' ? domain.trim().toLowerCase() : '';
}

export function sanitizeDomainDatabases(domainDatabases = null) {
  if (!domainDatabases || typeof domainDatabases !== 'object') return {};
  const cleaned = {};
  for (const [rawDomain, rawDatabase] of Object.entries(domainDatabases)) {
    const domain = normalizeDomainKey(rawDomain);
    const database = typeof rawDatabase === 'string' ? rawDatabase.trim() : '';
    if (!domain || !database) continue;
    cleaned[domain] = database;
  }
  return cleaned;
}

export function resolveDomainTargetDatabase(environment, domain, _linkTargetDatabase = null) {
  const normalizedDomain = normalizeDomainKey(domain);
  const cleanedMap = sanitizeDomainDatabases(environment?.domainDatabases);
  const environmentDb = typeof environment?.database === 'string' ? environment.database.trim() : '';

  // Product policy: synthetic and strategy runtime writes always target the
  // customer base database, independent of domain-specific DB mappings.
  // Keep domainDatabases payload intact for backward compatibility/UI display.
  if (environmentDb) {
    return {
      targetDatabase: environmentDb,
      domainDatabases: cleanedMap
    };
  }

  if (normalizedDomain && cleanedMap[normalizedDomain]) {
    return {
      targetDatabase: cleanedMap[normalizedDomain],
      domainDatabases: cleanedMap
    };
  }

  if (!environmentDb || !normalizedDomain) {
    return {
      targetDatabase: environmentDb || null,
      domainDatabases: cleanedMap
    };
  }
  return {
    targetDatabase: environmentDb,
    domainDatabases: cleanedMap
  };
}
