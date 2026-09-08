import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/kehrnel/environments/[envId]/endpoints/route.js
import { NextResponse } from 'next/server';
import { isTestModeBypassEnabled } from '@/lib/security/testMode';
import { getCoreDb } from '../../../../../../lib/db/coreDb.js';
import { requireAccessibleEnvironment } from '../../../../../../lib/environments/requireEnvironmentAccess.js';
import { createKehrnelService } from '../../../../../../lib/kehrnel/KehrnelService.js';
import { safeUpstreamError } from '../../../../../../lib/security/api.js';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '../../../../../../lib/security/environmentControls.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/kehrnel/environments/[envId]/endpoints
 * Query: ?domain=&connectionId=
 */
export async function GET(req, props) {
  const params = await props.params;
  try {
    let session = { user: { email: 'test@example.com' } };
    if (!isTestModeBypassEnabled()) {
      const auth = await requireAuthenticatedUser();
      if (!auth.ok) return auth.response;
      session = auth.session;
    }

    const { envId } = params;
    if (!envId) {
      return NextResponse.json({ error: 'envId is required' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain');
    const connectionId = searchParams.get('connectionId');

    const db = await getCoreDb();
    if (!isTestModeBypassEnabled()) {
      const access = await requireAccessibleEnvironment(db, session?.user?.email, envId);
      if (!access.ok) return access.response;
    }
    const envGate = await enforceEnvironmentControl(db, envId, ENV_CONTROL_CAPABILITY.READ, {
      route: 'api/kehrnel/environments/endpoints'
    });
    if (envGate) return envGate;

    const service = createKehrnelService(db);
    const result = await service.getEndpoints(envId, { domain, connectionId });

    return NextResponse.json(result);
  } catch (error) {
    console.error(`GET /api/kehrnel/environments/${params?.envId}/endpoints error:`, error);
    return safeUpstreamError(error, 'Failed to fetch endpoints');
  }
}
