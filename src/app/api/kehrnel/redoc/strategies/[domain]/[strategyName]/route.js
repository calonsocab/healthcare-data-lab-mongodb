// src/app/api/kehrnel/redoc/strategies/[domain]/[strategyName]/route.js
/**
 * Strategy ReDoc HTML Page Proxy
 *
 * Serves a self-contained ReDoc page whose OpenAPI spec is proxied through
 * Next.js, so the browser never needs to reach the internal Kehrnel hostname.
 */
import { NextResponse } from 'next/server';

const SEGMENT_RE = /^[a-zA-Z0-9._-]+$/;

export async function GET(req, props) {
  const params = await props.params;
  const { domain, strategyName } = params;

  if (!domain || !strategyName || !SEGMENT_RE.test(domain) || !SEGMENT_RE.test(strategyName)) {
    return new NextResponse('Invalid domain or strategy name', { status: 400 });
  }

  // Spec is fetched via the existing server-side proxy — same origin, no CORS issues.
  const specUrl = `/api/strategies/openapi?domain=${encodeURIComponent(domain)}&strategy=${encodeURIComponent(strategyName)}`;
  const title = `${domain}/${strategyName} API Docs — Kehrnel`;

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>body { margin: 0; padding: 0; }</style>
  </head>
  <body>
    <redoc spec-url="${specUrl}" hide-download-button="false"></redoc>
    <script src="https://cdn.jsdelivr.net/npm/redoc@2/bundles/redoc.standalone.js"></script>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
