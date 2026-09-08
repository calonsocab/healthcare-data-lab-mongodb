// src/app/api/healthz/route.js
import { NextResponse } from 'next/server';
import { getServerKehrnelBaseUrl } from '@/lib/kehrnel/url';

const BACKEND_URL = getServerKehrnelBaseUrl();

/**
 * Legacy health alias used by some UI components.
 * Internally this now calls Kehrnel's canonical `/health` endpoint.
 */
export async function GET() {
  try {
    if (!BACKEND_URL) {
      return NextResponse.json(
        {
          healthy: false,
          error: 'Backend URL not configured',
          message: 'Configure BACKEND_URL or NEXT_PUBLIC_BACKEND_URL to enable Kehrnel health checks.'
        },
        { status: 500 }
      );
    }

    // Canonical Kehrnel health endpoint is /health.
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json().catch(() => ({ status: 'ok' }));
      return NextResponse.json(
        {
          healthy: true,
          ...data
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { healthy: false, error: `Backend returned ${response.status}` },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Healthz proxy error:', error);
    
    // Check if it's a connection error
    if (error.code === 'ECONNREFUSED' || error.cause?.code === 'ECONNREFUSED') {
      return NextResponse.json(
        { 
          healthy: false,
          error: 'Backend Unavailable', 
          message: 'Cannot connect to the Kehrnel backend service.'
        }, 
        { status: 503 }
      );
    }

    return NextResponse.json(
      { 
        healthy: false,
        error: 'Health Check Failed', 
        message: 'Unable to complete backend health check'
      }, 
      { status: 500 }
    );
  }
}
