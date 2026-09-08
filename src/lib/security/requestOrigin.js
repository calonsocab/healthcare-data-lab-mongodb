const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const DEFAULT_EXEMPT_PREFIXES = Object.freeze(['/api/auth']);

function normalizeHeaderValue(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const first = raw.split(',')[0];
  return String(first || '').trim() || null;
}

function normalizeOrigin(value) {
  const raw = normalizeHeaderValue(value);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol !== 'https:' && protocol !== 'http:') return null;
    return `${protocol}//${parsed.host.toLowerCase()}`;
  } catch {
    return null;
  }
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function addOrigin(set, value) {
  const normalized = normalizeOrigin(value);
  if (normalized) set.add(normalized);
}

export function resolveAllowedOrigins(request, options = {}) {
  const set = new Set();
  const headers = request?.headers;

  addOrigin(set, request?.nextUrl?.origin);

  const forwardedHost = normalizeHeaderValue(headers?.get?.('x-forwarded-host'));
  const host = forwardedHost || normalizeHeaderValue(headers?.get?.('host'));
  const forwardedProto = normalizeHeaderValue(headers?.get?.('x-forwarded-proto'));
  const requestProto = String(request?.nextUrl?.protocol || '').replace(/:$/, '');
  const proto = (forwardedProto || requestProto || 'https').toLowerCase();
  if (host && (proto === 'http' || proto === 'https')) {
    addOrigin(set, `${proto}://${host}`);
  }

  addOrigin(set, process.env.APP_ORIGIN);
  addOrigin(set, process.env.APP_BASE_URL);
  addOrigin(set, process.env.NEXTAUTH_URL);
  addOrigin(set, process.env.NEXT_PUBLIC_APP_URL);
  addOrigin(set, process.env.NEXT_PUBLIC_SITE_URL);
  if (process.env.VERCEL_URL) {
    addOrigin(set, `https://${String(process.env.VERCEL_URL).trim()}`);
  }

  const configured = parseCsv(process.env.CSRF_TRUSTED_ORIGINS);
  for (const origin of configured) {
    addOrigin(set, origin);
  }

  const additional = Array.isArray(options.additionalOrigins) ? options.additionalOrigins : [];
  for (const origin of additional) {
    addOrigin(set, origin);
  }

  return set;
}

function isExemptPath(pathname, exemptPrefixes = DEFAULT_EXEMPT_PREFIXES) {
  return exemptPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function evaluateApiMutationRequestOrigin(request, options = {}) {
  const method = String(request?.method || 'GET').toUpperCase();
  const pathname = String(request?.nextUrl?.pathname || '/');
  if (!pathname.startsWith('/api/')) return { ok: true };
  if (!MUTATING_METHODS.has(method)) return { ok: true };

  const exemptPrefixes = Array.isArray(options.exemptPrefixes)
    ? options.exemptPrefixes
    : DEFAULT_EXEMPT_PREFIXES;
  if (isExemptPath(pathname, exemptPrefixes)) return { ok: true, exempt: true };

  const headers = request?.headers;
  const secFetchSite = String(headers?.get?.('sec-fetch-site') || '').toLowerCase().trim();
  if (secFetchSite && secFetchSite !== 'same-origin' && secFetchSite !== 'none') {
    return { ok: false, code: 'CSRF_CROSS_SITE_BLOCKED', reason: `sec-fetch-site=${secFetchSite}` };
  }

  const allowedOrigins = resolveAllowedOrigins(request, options);
  const origin = normalizeOrigin(headers?.get?.('origin'));
  if (origin) {
    if (allowedOrigins.has(origin)) return { ok: true };
    return { ok: false, code: 'CSRF_ORIGIN_MISMATCH', reason: `origin=${origin}` };
  }

  const refererOrigin = normalizeOrigin(headers?.get?.('referer'));
  if (refererOrigin) {
    if (allowedOrigins.has(refererOrigin)) return { ok: true };
    return { ok: false, code: 'CSRF_REFERER_MISMATCH', reason: `referer=${refererOrigin}` };
  }

  if (secFetchSite === 'same-origin' || secFetchSite === 'none') {
    return { ok: true };
  }

  return {
    ok: false,
    code: 'CSRF_ORIGIN_REQUIRED',
    reason: 'missing origin/referer for mutating request'
  };
}
