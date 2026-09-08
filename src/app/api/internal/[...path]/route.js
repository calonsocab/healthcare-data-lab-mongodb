import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/internal/[...path]/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { enforceApiRateLimit, resolvePolicyContext } from '@/lib/security/teamPolicy';
import { validateFileBasics } from '@/lib/uploads/validation';
import { parseFormDataWithLimit, parseJsonWithLimit, readBodyBytesWithLimit, PayloadTooLargeError } from '@/lib/uploads/bodyLimit';
import { getServerKehrnelBaseUrl } from '@/lib/kehrnel/url';

const BACKEND_URL = getServerKehrnelBaseUrl();
const INTERNAL_PROXY_ALLOWED_PREFIXES = (process.env.INTERNAL_PROXY_ALLOWED_PREFIXES || '')
  .split(',')
  .map((item) => item.trim().replace(/^\/+|\/+$/g, ''))
  .filter(Boolean);
const DEFAULT_PROXY_MAX_BYTES = 100 * 1024 * 1024; // 100MB

function hasUnsafePathSegment(segment) {
  let decoded = '';
  try {
    decoded = decodeURIComponent(segment || '');
  } catch {
    return true;
  }
  return (
    decoded === '.' ||
    decoded === '..' ||
    decoded.includes('..') ||
    decoded.includes('\\') ||
    decoded.includes('\0')
  );
}

function isPathAllowed(path) {
  if (!path) return false;
  if (!INTERNAL_PROXY_ALLOWED_PREFIXES.length) return false;
  if (INTERNAL_PROXY_ALLOWED_PREFIXES.includes('*')) return true;
  return INTERNAL_PROXY_ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isBackendUrlSafe(rawUrl = '') {
  try {
    const parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    return true;
  } catch {
    return false;
  }
}

// Helper function to forward requests
async function forwardRequest(request, params, method) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;
    const coreDb = await getCoreDb();
    const policyContext = await resolvePolicyContext(coreDb, session.user.email);
    await enforceApiRateLimit(coreDb, policyContext, `internal-proxy:${method.toLowerCase()}`);
    if (!BACKEND_URL) {
      return NextResponse.json({ error: 'Kehrnel backend URL is not configured' }, { status: 500 });
    }
    if (!isBackendUrlSafe(BACKEND_URL)) {
      return NextResponse.json({ error: 'Backend URL is not configured safely' }, { status: 500 });
    }

    const pathSegments = Array.isArray(params?.path) ? params.path : [];
    if (!pathSegments.length) {
      return NextResponse.json({ error: 'Invalid internal path' }, { status: 400 });
    }
    if (pathSegments.some(hasUnsafePathSegment)) {
      return NextResponse.json({ error: 'Invalid internal path' }, { status: 400 });
    }

    const path = pathSegments.map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    }).join('/');
    if (!isPathAllowed(path)) {
      return NextResponse.json({
        error: 'Path not allowed by proxy policy',
        message: 'Configure INTERNAL_PROXY_ALLOWED_PREFIXES with an explicit allowlist.'
      }, { status: 403 });
    }

    const url = new URL(`/api/internal/${path}`, BACKEND_URL);
    
    // Forward query parameters
    const searchParams = request.nextUrl.searchParams;
    searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });

    // Prepare headers
    const headers = new Headers();
    
    // Forward specific headers but not all (to avoid issues)
    const headersToForward = [
      'accept',
      'accept-language',
      'user-agent',
      'x-active-env',
      'x-request-id'
    ];
    
    headersToForward.forEach(header => {
      const value = request.headers.get(header);
      if (value) {
        headers.set(header, value);
      }
    });
    headers.set('x-authenticated-user', session.user.email || 'unknown');

    if (process.env.BACKEND_INTERNAL_API_KEY) {
      headers.set('x-internal-api-key', process.env.BACKEND_INTERNAL_API_KEY);
    }

    // Prepare the fetch options
    const fetchOptions = {
      method,
      headers,
    };

    const policyMaxBytes = policyContext?.policy?.limits?.maxUploadFileBytes;
    const maxBytes = Number.isFinite(policyMaxBytes) && policyMaxBytes > 0
      ? policyMaxBytes
      : DEFAULT_PROXY_MAX_BYTES;

    // Handle body for POST, PUT, PATCH
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const contentType = request.headers.get('content-type');
      
      if (contentType?.includes('multipart/form-data')) {
        // For file uploads, we need to handle FormData
        try {
          const formData = await parseFormDataWithLimit(request, maxBytes + (1 * 1024 * 1024));
          
          // Create a new FormData instance for the backend
          const backendFormData = new FormData();
          
          // Copy all fields from the original FormData
          for (const [key, value] of formData.entries()) {
            if (value instanceof File) {
              const validationError = validateFileBasics(value, {
                maxBytes,
                allowMissingType: true,
                requireSafeName: true
              });
              if (validationError) {
                return NextResponse.json({ error: validationError }, { status: 400 });
              }
              // For files, create a Blob with the correct type
              const blob = new Blob([await value.arrayBuffer()], { type: value.type });
              backendFormData.append(key, blob, value.name);
            } else {
              backendFormData.append(key, value);
            }
          }
          
          fetchOptions.body = backendFormData;
          // Don't set Content-Type header, let fetch set it with boundary
        } catch (e) {
          console.error('Error processing FormData:', e);
          throw e;
        }
      } else if (contentType?.includes('application/json')) {
        // For JSON data
        try {
          const body = await parseJsonWithLimit(request, maxBytes);
          fetchOptions.body = JSON.stringify(body);
          headers.set('content-type', 'application/json');
        } catch (e) {
          console.error('Error parsing JSON:', e);
          throw e;
        }
      } else {
        // For other content types, forward as-is
        const bodyBytes = await readBodyBytesWithLimit(request, maxBytes);
        fetchOptions.body = bodyBytes;
        if (contentType) {
          headers.set('content-type', contentType);
        }
      }
    }

    console.log(`Proxying ${method} request to backend internal endpoint: /api/internal/${path}`);
    
    // Make the request to the backend
    const response = await fetch(url.toString(), fetchOptions);
    
    // Handle response based on content type
    const responseContentType = response.headers.get('content-type');
    
    // For non-2xx responses, always try to parse as JSON for error messages
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { detail: await response.text() };
      }
      
      return NextResponse.json(errorData, { 
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
        }
      });
    }
    
    // For successful responses
    if (responseContentType?.includes('application/json')) {
      const responseData = await response.json();
      return NextResponse.json(responseData, { 
        status: response.status,
        headers: {
          'Content-Type': 'application/json',
        }
      });
    } else {
      // For non-JSON responses (files, etc.)
      const responseData = await response.arrayBuffer();
      return new NextResponse(responseData, { 
        status: response.status,
        headers: {
          'Content-Type': responseContentType || 'application/octet-stream',
        }
      });
    }
    
  } catch (error) {
    console.error('API Proxy Error:', error);

    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json(
        { error: 'Upload too large' },
        { status: 413 }
      );
    }
    
    // Check if it's a connection error
    if (error.code === 'ECONNREFUSED') {
      return NextResponse.json(
        { 
          error: 'Backend Service Unavailable', 
          message: 'Cannot connect to the backend service. Please ensure the backend is running.'
        }, 
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        message: 'Proxy request failed'
      }, 
      { status: 500 }
    );
  }
}

// Handle GET requests
export async function GET(request, props) {
  const params = await props.params;
  return forwardRequest(request, params, 'GET');
}

// Handle POST requests
export async function POST(request, props) {
  const params = await props.params;
  return forwardRequest(request, params, 'POST');
}

// Handle PUT requests
export async function PUT(request, props) {
  const params = await props.params;
  return forwardRequest(request, params, 'PUT');
}

// Handle DELETE requests
export async function DELETE(request, props) {
  const params = await props.params;
  return forwardRequest(request, params, 'DELETE');
}

// Handle PATCH requests
export async function PATCH(request, props) {
  const params = await props.params;
  return forwardRequest(request, params, 'PATCH');
}
