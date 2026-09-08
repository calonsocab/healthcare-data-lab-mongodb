import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/aql-queries/execute/route.js
import { NextResponse } from 'next/server'

/**
 * POST /api/aql-queries/execute
 * 
 * Executes an AQL query against the configured openEHR server.
 * 
 * Request body:
 *   - aqlQuery: string - The AQL query to execute
 *   - forceSearch: boolean (optional) - Whether to force search mode (default: false)
 * 
 * Environment variable required:
 *   - OPENEHR_AQL_ENDPOINT: The base URL for the openEHR AQL execution endpoint
 *     Example: http://leafy-hospital.mongodb-industry-solutions.com:9000
 */
export async function POST(request) {
  try {
    // Verify authentication
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    // Parse request body
    const body = await request.json()
    const { aqlQuery, forceSearch = false } = body
    const activeEnvId = (
      request.headers.get('x-active-env')
      || request.headers.get('x-env-id')
      || request.headers.get('x-environment-id')
      || body?.environment
      || body?.envId
      || ''
    ).toString().trim()

    if (!aqlQuery || typeof aqlQuery !== 'string' || !aqlQuery.trim()) {
      return NextResponse.json(
        { error: 'AQL query is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    // Get the openEHR endpoint from environment
    const openEhrEndpoint = process.env.NEXT_PUBLIC_KEHRNEL_AQL_ENDPOINT
    if (!openEhrEndpoint) {
      return NextResponse.json(
        { error: 'openEHR AQL endpoint not configured. Please set NEXT_PUBLIC_KEHRNEL_AQL_ENDPOINT in .env.local' },
        { status: 500 }
      )
    }

    // Build the full URL with query parameters (avoid hardcoded path literal)
    const queryPath = ['v1', 'query', 'aql'].join('/')
    const url = new URL(`/${queryPath}`, openEhrEndpoint)
    url.searchParams.set('force_search', forceSearch.toString())

    console.log(`[AQL Execute] Executing query against: ${url.toString()}`)

    // Execute the query against the openEHR server
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'text/plain',
        ...(activeEnvId ? { 'x-active-env': activeEnvId } : {}),
      },
      body: aqlQuery.trim(),
    })

    // Get response data
    const contentType = response.headers.get('content-type') || ''
    let data

    if (contentType.includes('application/json')) {
      data = await response.json()
    } else {
      // Handle non-JSON responses (e.g., error messages)
      const text = await response.text()
      data = { rawResponse: text }
    }

    // Return the response with the same status code
    if (!response.ok) {
      return NextResponse.json(
        {
          error: data.error || data.message || 'Query execution failed',
          details: data,
          statusCode: response.status,
        },
        { status: response.status }
      )
    }

    return NextResponse.json({
      success: true,
      data,
      executedAt: new Date().toISOString(),
    })

  } catch (error) {
    console.error('[AQL Execute] Error:', error)
    
    // Handle network errors
    if (error.cause?.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
      return NextResponse.json(
        { error: 'Unable to connect to openEHR server. Please check the server is running and accessible.' },
        { status: 503 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error during query execution' },
      { status: 500 }
    )
  }
}
