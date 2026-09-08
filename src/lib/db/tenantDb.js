import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getCoreDb } from './coreDb';
import { getDb } from './connectionManager';
import { openSecret } from '@/lib/crypto/secrets.mjs';
import { findAccessibleEnvironment, loadEnvironmentScope } from '@/lib/environments/access';
import { findEnvironmentSecretDoc } from '@/lib/environments/secretScope';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readActiveEnvId(request) {
  const hdr = request?.headers?.get?.('x-active-env');
  if (hdr) return hdr;
  const cookieHeader = request?.headers?.get?.('cookie') || '';
  const m = /(?:^|;\s*)active_env=([^;]+)/.exec(cookieHeader);
  if (m) return decodeURIComponent(m[1]);
  try {
    const url = new URL(request.url);
    return url.searchParams.get('env') || url.searchParams.get('environmentId') || null;
  } catch { return null; }
}

function pickActiveEnvironment({ environments }, requestedEnvId) {
  const list = environments || [];
  if (!list.length) return null;
  if (requestedEnvId) return list.find(e => e.id === requestedEnvId) || list.find(e => e.isActive) || list[0];
  return list.find(e => e.isActive) || list[0];
}

/** Primary entry for API routes: returns pooled { db, environment } or throws HttpError */
export async function getActiveTenantDb(request, options = {}) {
  const session = options.session || await getServerSession(authOptions);
  if (!session?.user?.email) throw new HttpError(401, 'Unauthorized');

  const coreDb = options.coreDb || await getCoreDb();
  const scope = await loadEnvironmentScope(coreDb, session.user.email);
  const envId =
    typeof options.envId === 'string' && options.envId.trim()
      ? options.envId.trim()
      : readActiveEnvId(request);
  const env = pickActiveEnvironment(scope, envId);
  if (!env) throw new HttpError(400, 'No active environment configured');

  // 1) Back-compat: allow inline sealedUri if present
  let sealedUri = env.sealedUri;

  // 2) Preferred path: fetch from core.environment_secrets
  if (!sealedUri) {
    const secretDoc = await findEnvironmentSecretDoc(coreDb, scope, env.id);
    if (!secretDoc?.sealedUri) {
      throw new HttpError(400, 'This environment is missing its connection secret');
    }
    sealedUri = secretDoc.sealedUri;
  }

  const uri = openSecret(sealedUri);
  if (!uri) throw new HttpError(400, 'Invalid environment secret');
  if (!env.database) throw new HttpError(400, 'Environment is missing its database name');

  const db = await getDb({ uri, dbName: env.database });
  return { db, environment: env, uri };
}

/**
 * Resolve an env (the current user must have access) and return summary + decrypted URI.
 * Server-only; never serialize the URI.
 */
export async function resolveEnvByIdForUser(_request, envId) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new HttpError(401, 'Unauthorized');

  const coreDb = await getCoreDb();
  const accessible = await findAccessibleEnvironment(coreDb, session.user.email, envId);
  if (!accessible.user) throw new HttpError(404, 'User not found');

  const env = accessible.environment;
  if (!env) throw new HttpError(404, 'Environment not found or not accessible');

  let sealedUri = env.sealedUri;
  if (!sealedUri) {
    const sec = await findEnvironmentSecretDoc(coreDb, accessible, envId);
    if (!sec?.sealedUri) throw new HttpError(400, 'This environment is missing its connection secret');
    sealedUri = sec.sealedUri;
  }

  const uri = openSecret(sealedUri);
  if (!uri) throw new HttpError(400, 'Invalid environment secret');
  if (!env.database) throw new HttpError(400, 'Environment missing database name');

  const environmentRecord = {
    id: env.id,
    name: env.name,
    description: env.description || '',
    database: env.database,
    isActive: !!env.isActive,
    strategyLinks: Array.isArray(env.strategyLinks) ? env.strategyLinks : [],
    kehrnel: env.kehrnel || null,
  };

  return {
    summary: environmentRecord,
    environment: environmentRecord,
    uri, // server-side only
  };
}

/**
 * Open a tenant DB by envId WITHOUT checking the current user.
 * Caller must validate permissions themselves.
 */
export async function openTenantDbByEnvId(envId) {
  const coreDb = await getCoreDb();

  // Find environment summary on users or teams (minimal projection)
  const userOwner = await coreDb.collection('users').findOne(
    { 'environments.id': envId },
    { projection: { _id: 1, environments: 1 } }
  );
  const teamOwner = userOwner
    ? null
    : await coreDb.collection('teams').findOne(
      { 'environments.id': envId },
      { projection: { _id: 1, environments: 1 } }
    );

  const owner = userOwner || teamOwner;
  if (!owner) throw new HttpError(404, 'Environment owner not found');

  const env = (owner.environments || []).find((e) => e.id === envId);
  if (!env) throw new HttpError(404, 'Environment not found');

  const ownerScope = userOwner
    ? { mode: 'individual', user: userOwner, team: null }
    : { mode: 'team', user: null, team: teamOwner };
  const sec = await findEnvironmentSecretDoc(coreDb, ownerScope, envId);
  if (!sec?.sealedUri) throw new HttpError(400, 'This environment is missing its connection secret');

  const uri = openSecret(sec.sealedUri);
  if (!uri) throw new HttpError(400, 'Invalid environment secret');
  if (!env.database) throw new HttpError(400, 'Environment missing connection info');

  const db = await getDb({ uri, dbName: env.database });
  return { db, summary: { id: env.id, name: env.name, database: env.database } };
}
