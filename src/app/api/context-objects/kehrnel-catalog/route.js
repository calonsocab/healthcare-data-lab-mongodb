import { NextResponse } from 'next/server';

import { requireAuthenticatedUser } from '@/lib/security/api';
import { getCoreDb } from '@/lib/db/coreDb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '@/lib/security/environmentControls';
import {
  buildKehrnelContextCatalog,
  publishKehrnelContextCatalog,
} from '@/lib/contextObjects/kehrnelCatalog';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const includeDraft = new URL(request.url).searchParams.get('includeDraft') !== 'false';
    const { db, environment } = await getActiveTenantDb(request);
    const catalog = await buildKehrnelContextCatalog(db, environment, { includeDraft });
    return NextResponse.json(catalog);
  } catch (error) {
    console.error('Error building kehrnel context catalog:', error);
    return NextResponse.json(
      { error: 'Failed to build kehrnel context catalog', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json().catch(() => ({}));
    const includeDraft = body?.includeDraft !== false;
    const { db, environment } = await getActiveTenantDb(request);
    const coreDb = await getCoreDb();
    const envGate = await enforceEnvironmentControl(coreDb, environment?.id, ENV_CONTROL_CAPABILITY.WRITE);
    if (envGate) return envGate;
    const result = await publishKehrnelContextCatalog(
      db,
      environment,
      session?.user?.email || session?.user?.name || 'unknown',
      { includeDraft }
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error publishing kehrnel context catalog:', error);
    return NextResponse.json(
      { error: 'Failed to publish kehrnel context catalog', details: error.message },
      { status: 500 }
    );
  }
}
