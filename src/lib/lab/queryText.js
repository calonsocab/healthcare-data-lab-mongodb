export function resolveQueryAqlText(query, fallback = '') {
  const candidates = [
    query?.aqlText,
    query?.normalizedAQL,
    query?.aql,
    query?.aqlQuery,
    query?.queryText,
    query?.query?.aqlText,
    query?.query?.normalizedAQL,
    query?.query?.aql,
    query?.query?.aqlQuery,
    query?.query?.queryText,
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  return typeof fallback === 'string' ? fallback : '';
}
