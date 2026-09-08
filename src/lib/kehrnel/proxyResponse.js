function statusDisallowsBody(status) {
  return status === 204 || status === 205 || status === 304;
}

function buildProxyResponseHeaders(upstreamHeaders, { omitBody = false } = {}) {
  const headers = new Headers();
  upstreamHeaders.forEach((value, key) => {
    const normalized = String(key || '').toLowerCase();
    if (normalized === 'content-length') return;
    if (omitBody && normalized === 'content-type') return;
    headers.set(key, value);
  });
  return headers;
}

export function buildUpstreamProxyResponse({ method = 'GET', upstreamRes, text = '' }) {
  const methodUpper = String(method || 'GET').toUpperCase();
  const omitBody = methodUpper === 'HEAD' || statusDisallowsBody(upstreamRes.status);
  const headers = buildProxyResponseHeaders(upstreamRes.headers, { omitBody });

  if (omitBody) {
    return new Response(null, {
      status: upstreamRes.status,
      headers,
    });
  }

  return new Response(text, {
    status: upstreamRes.status,
    headers,
  });
}
