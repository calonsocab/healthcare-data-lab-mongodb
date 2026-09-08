import { NextResponse } from 'next/server';
import { evaluateApiMutationRequestOrigin } from '@/lib/security/requestOrigin';

function getRequestProtocol(request) {
  const xfp = String(request?.headers?.get?.('x-forwarded-proto') || '').toLowerCase().trim();
  if (xfp) return xfp;
  return String(request?.nextUrl?.protocol || '').replace(/:$/, '').toLowerCase();
}

export function middleware(request) {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_INSECURE_HTTP !== 'true') {
    const protocol = getRequestProtocol(request);
    if (protocol && protocol !== 'https') {
      return NextResponse.json(
        { error: 'HTTPS is required', code: 'HTTPS_REQUIRED' },
        { status: 426 }
      );
    }
  }

  const verdict = evaluateApiMutationRequestOrigin(request);
  if (verdict.ok) return NextResponse.next();

  const body = {
    error: 'Invalid cross-site request',
    code: verdict.code || 'CSRF_BLOCKED'
  };
  if (process.env.NODE_ENV !== 'production') {
    body.reason = verdict.reason || null;
  }
  return NextResponse.json(body, { status: 403 });
}

export const config = {
  matcher: ['/api/:path*']
};
