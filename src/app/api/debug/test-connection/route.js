import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/debug/test-connection/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { loadEnvironmentScope } from '@/lib/environments/access';
import { findEnvironmentSecretDoc } from '@/lib/environments/secretScope';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    if (process.env.ENABLE_DEBUG_ENDPOINTS !== 'true') {
      return NextResponse.json({ error: 'Endpoint disabled' }, { status: 403 });
    }
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const results = {
      coreConnection: false,
      tenantConnection: false,
      details: {}
    };

    // ---- Core DB connection test ----
    try {
      const coreDb = await getCoreDb();
      const collections = await coreDb.listCollections().toArray();

      results.coreConnection = true;
      results.details.coreDb = {
        name: coreDb.databaseName,
        collections: collections.map(c => c.name)
      };

      // ---- Scope + environments (sanitized) ----
      const scope = await loadEnvironmentScope(coreDb, session.user.email);
      const envs = scope.environments || [];

      const activeEnv = envs.find(e => e.isActive) || envs[0] || null;
      results.details.environments = envs.map(e => ({
        id: e.id, name: e.name, database: e.database, isActive: !!e.isActive
      }));
      results.details.activeEnvironment = activeEnv
        ? { id: activeEnv.id, name: activeEnv.name, database: activeEnv.database }
        : null;

      // Secret presence (we don’t expose it, just indicate if it exists)
      if (activeEnv) {
        const secretDoc = await findEnvironmentSecretDoc(coreDb, scope, activeEnv.id, {
          projection: { _id: 0, sealedUri: 1, updatedAt: 1 }
        });
        results.details.secretPresentForActiveEnv = !!secretDoc?.sealedUri;
      }
    } catch (error) {
      results.details.coreError = error.message;
    }

    // ---- Tenant DB connection test via getActiveTenantDb ----
    try {
      const { db: tenantDb, environment } = await getActiveTenantDb(request);
      const tenantCollections = await tenantDb.listCollections().toArray();

      results.tenantConnection = true;
      results.details.tenantDb = {
        name: tenantDb.databaseName,
        collections: tenantCollections.map(c => c.name)
      };
      results.details.tenantEnvironment = {
        id: environment?.id,
        name: environment?.name,
        database: environment?.database
      };
    } catch (error) {
      // Typical failures: no active env, missing secret, invalid URI, etc.
      results.details.tenantError = error.message;
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Test connection error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
