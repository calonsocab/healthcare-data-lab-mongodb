// src/lib/uploads/bodyLimit.js
// Utilities to enforce request body size limits before parsing (JSON / multipart form-data).

export class PayloadTooLargeError extends Error {
  constructor(message = 'Payload too large', { maxBytes, actualBytes } = {}) {
    super(message);
    this.name = 'PayloadTooLargeError';
    this.status = 413;
    this.code = 'PAYLOAD_TOO_LARGE';
    this.maxBytes = maxBytes;
    this.actualBytes = actualBytes;
  }
}

function parseContentLengthHeader(value) {
  const n = Number.parseInt(String(value || '').trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function getDeclaredContentLength(request) {
  return parseContentLengthHeader(request?.headers?.get?.('content-length'));
}

export async function readBodyBytesWithLimit(request, maxBytes) {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new Error('maxBytes must be a positive number');
  }

  const declared = getDeclaredContentLength(request);
  if (declared !== null && declared > maxBytes) {
    throw new PayloadTooLargeError('Request body exceeds limit', { maxBytes, actualBytes: declared });
  }

  if (!request?.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = value instanceof Uint8Array ? value : new Uint8Array(value || []);
    total += chunk.byteLength;
    if (total > maxBytes) {
      throw new PayloadTooLargeError('Request body exceeds limit', { maxBytes, actualBytes: total });
    }
    chunks.push(chunk);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export async function parseJsonWithLimit(request, maxBytes) {
  const bytes = await readBodyBytesWithLimit(request, maxBytes);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (e) {
    const err = new Error('Invalid JSON body');
    err.status = 400;
    err.cause = e;
    throw err;
  }
}

export async function parseFormDataWithLimit(request, maxBytes) {
  const bytes = await readBodyBytesWithLimit(request, maxBytes);

  const headers = new Headers(request.headers);
  // Let the runtime compute length for the new body.
  headers.delete('content-length');

  const cloned = new Request(request.url, {
    method: request.method,
    headers,
    body: bytes
  });
  return cloned.formData();
}

