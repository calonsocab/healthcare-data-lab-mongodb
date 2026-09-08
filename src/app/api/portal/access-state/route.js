import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { DEFAULT_PORTAL_STATE, getPortalState, getDeploymentMode } from '@/lib/security/onboardingAccess';

export async function GET() {
  try {
    const db = await getCoreDb();
    const portalState = await getPortalState(db);
    return NextResponse.json({
      portalState,
      deploymentMode: getDeploymentMode()
    });
  } catch (error) {
    console.error('GET /api/portal/access-state error:', error);

    // Build a developer-friendly diagnostic for the error
    let diagnostic = null;
    if (process.env.NODE_ENV === 'development') {
      const errMsg = error?.message || String(error);
      if (!process.env.CORE_MONGODB_URL) {
        diagnostic = 'CORE_MONGODB_URL is not set in .env.local';
      } else if (/authentication failed/i.test(errMsg) || /auth/i.test(errMsg)) {
        diagnostic = `MongoDB authentication failed. Check the username/password in CORE_MONGODB_URL. Detail: ${errMsg}`;
      } else if (/ENOTFOUND|getaddrinfo|ETIMEDOUT|ECONNREFUSED/i.test(errMsg)) {
        diagnostic = `Cannot reach MongoDB host. Check your connection string and network/IP whitelist in Atlas. Detail: ${errMsg}`;
      } else if (/serverselectiontimeout/i.test(errMsg)) {
        diagnostic = `MongoDB server selection timed out. Likely causes: IP not whitelisted in Atlas, cluster paused, or wrong hostname. Detail: ${errMsg}`;
      } else {
        diagnostic = `MongoDB connection error: ${errMsg}`;
      }
    }

    return NextResponse.json({
      portalState: {
        mode: 'maintenance',
        message: diagnostic || DEFAULT_PORTAL_STATE.message,
      },
      deploymentMode: getDeploymentMode(),
      code: 'PORTAL_STATE_UNAVAILABLE',
      ...(diagnostic ? { diagnostic } : {})
    }, { status: 503 });
  }
}
