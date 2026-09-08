// src/lib/kehrnel/url.js
function cleanUrl(value = '') {
  return String(value || '').trim().replace(/\/+$/, '');
}

/**
 * Resolve the public Kehrnel base URL for client-side usage.
 * Returns empty string when no public URL is configured.
 */
export function getPublicKehrnelBaseUrl() {
  return cleanUrl(
    process.env.NEXT_PUBLIC_BACKEND_URL
      || process.env.NEXT_PUBLIC_KEHRNEL_AQL_ENDPOINT
      || process.env.NEXT_PUBLIC_DEFAULT_KEHRNEL_URL
      || ''
  );
}

/**
 * Resolve the server-side Kehrnel base URL.
 * Returns empty string when no backend URL is configured.
 */
export function getServerKehrnelBaseUrl() {
  return cleanUrl(
    process.env.BACKEND_URL
      || process.env.KEHRNEL_URL
      || process.env.NEXT_PUBLIC_BACKEND_URL
      || process.env.NEXT_PUBLIC_KEHRNEL_AQL_ENDPOINT
      || process.env.NEXT_PUBLIC_DEFAULT_KEHRNEL_URL
      || ''
  );
}

