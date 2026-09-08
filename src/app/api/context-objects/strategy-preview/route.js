import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { getCoreDb } from '@/lib/db/coreDb';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '@/lib/security/environmentControls';
import {
  previewCon2LArtifact,
  previewObjectMapAsset,
  previewScenarioPack,
} from '@/lib/contextObjects/strategyPreview';
import {
  runCon2LArtifactRuntime,
  runContextMapRuntime,
} from '@/lib/contextObjects/strategyRuntime';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { type, id, artifact = null, runtime: runtimeOptions = {} } = body || {};
    if (!type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }

    const { db, environment } = await getActiveTenantDb(request);
    const coreDb = await getCoreDb();
    const userEmail = auth.session?.user?.email || 'unknown';

    const requiresOps =
      type === 'con2lArtifact' || type === 'objectMap';
    if (requiresOps) {
      const envGate = await enforceEnvironmentControl(coreDb, environment?.id, ENV_CONTROL_CAPABILITY.OPS);
      if (envGate) return envGate;
    }

    if (type === 'con2lArtifact') {
      if (!id && !artifact) {
        return NextResponse.json({ error: 'id or artifact is required for con2lArtifact' }, { status: 400 });
      }
      const preview = await previewCon2LArtifact(db, artifact || id, {
        semanticConfirmation: runtimeOptions?.semanticConfirmation || null,
      });
      const runtime = await runCon2LArtifactRuntime({
        coreDb,
        tenantDb: db,
        environment,
        userEmail,
        artifactId: id || artifact?.id || 'adhoc.con2l',
        artifact,
        strategyId: runtimeOptions?.strategyId || null,
        connectionId: runtimeOptions?.connectionId || null,
        semanticConfirmation: runtimeOptions?.semanticConfirmation || null,
      });
      return NextResponse.json({ ...preview, runtime });
    }

    if (type === 'objectMap') {
      if (!id) {
        return NextResponse.json({ error: 'id is required for objectMap' }, { status: 400 });
      }
      const preview = await previewObjectMapAsset(db, id);
      const runtime = await runContextMapRuntime({
        coreDb,
        tenantDb: db,
        environment,
        userEmail,
        assetId: id,
        strategyId: runtimeOptions?.strategyId || null,
        connectionId: runtimeOptions?.connectionId || null,
      });
      return NextResponse.json({ ...preview, runtime });
    }

    if (type === 'scenarioPack') {
      if (!id) {
        return NextResponse.json({ error: 'id is required for scenarioPack' }, { status: 400 });
      }
      return NextResponse.json(await previewScenarioPack(db, id));
    }

    return NextResponse.json({ error: `Unsupported preview type: ${type}` }, { status: 400 });
  } catch (error) {
    console.error('POST /api/context-objects/strategy-preview error:', error);
    return safeErrorResponse(error, 'Failed to preview strategy asset');
  }
}
