import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/kehrnel/environments/[envId]/activations/[domain]/upgrade/route.js
import { NextResponse } from 'next/server';
import { isTestModeBypassEnabled } from '@/lib/security/testMode';
import { getCoreDb } from '../../../../../../../../lib/db/coreDb.js';
import { requireAccessibleEnvironment } from '../../../../../../../../lib/environments/requireEnvironmentAccess.js';
import { createKehrnelService } from '../../../../../../../../lib/kehrnel/KehrnelService.js';
import { safeUpstreamError } from '../../../../../../../../lib/security/api.js';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '../../../../../../../../lib/security/environmentControls.js';

export const dynamic = 'force-dynamic';

export async function POST(req, props) {
  const params = await props.params;
  try {
    let session = { user: { email: 'test@example.com' } };
    if (!isTestModeBypassEnabled()) {
      const auth = await requireAuthenticatedUser();
      if (!auth.ok) return auth.response;
      session = auth.session;
    }

    const { envId, domain } = params;
    if (!envId || !domain) {
      return NextResponse.json({ error: 'envId and domain are required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const reason = body?.reason || null;
    const requestId = req.headers.get('x-request-id') || req.headers.get('request-id') || null;

    const db = await getCoreDb();
    if (!isTestModeBypassEnabled()) {
      const access = await requireAccessibleEnvironment(db, session?.user?.email, envId);
      if (!access.ok) return access.response;
    }
    const envGate = await enforceEnvironmentControl(db, envId, ENV_CONTROL_CAPABILITY.OPS, {
      route: 'api/kehrnel/environments/activations/upgrade'
    });
    if (envGate) return envGate;

    const service = createKehrnelService(db);
    const result = await service.upgradeActivation(envId, domain, { reason, requestId });

    try {
      const collection = db?.collection ? db.collection('audit_events') : null;
      if (collection?.insertOne) {
        await collection.insertOne({
          type: 'activation',
          action: 'upgrade',
          envId,
          domain,
          user: session.user?.email || 'system',
          createdAt: new Date().toISOString(),
          requestId,
          result
        });
      }
    } catch (err) {
      console.warn('audit log failed (upgrade)', err.message);
    }

    return NextResponse.json(result);
  } catch (error) {
    return safeUpstreamError(error, 'Upgrade failed');
  }
}
