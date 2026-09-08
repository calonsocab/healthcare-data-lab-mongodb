// src/app/api/kehrnel/redoc/domains/[domain]/route.js
/**
 * ReDoc HTML Page Proxy
 *
 * Serves a self-contained ReDoc page whose OpenAPI spec is proxied through
 * Next.js, so the browser never needs to reach the internal Kehrnel hostname.
 */
import { NextResponse } from 'next/server';

const VALID_DOMAINS = new Set(['openehr', 'fhir', 'genomics', 'contextobjects']);

export async function GET(req, props) {
  const params = await props.params;
  const { domain } = params;

  if (!domain || !VALID_DOMAINS.has(domain.toLowerCase())) {
    return new NextResponse('Invalid domain', { status: 400 });
  }

  const safeDomain = domain.toLowerCase();
  // Spec is fetched via our server-side proxy — same origin, no CORS issues.
  const specUrl = `/api/kehrnel/openapi/domains/${safeDomain}`;

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeDomain.toUpperCase()} API Docs — Kehrnel</title>
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
