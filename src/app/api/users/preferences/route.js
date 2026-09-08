import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/users/preferences/route.js
import { getCoreDb } from '@/lib/db/coreDb';
import { sealSecret } from '@/lib/crypto/secrets.mjs';
import {
  getConnectionValidationMessage,
  getEnvironmentSaveErrorMessage,
  validateMongoEnvironmentConnection
} from '@/lib/db/environmentConnectionValidation';
import { normalizeStrategyLinks } from '@/lib/environments/normalizeStrategyLinks';
import { sanitizeDomainDatabases } from '@/lib/environments/domainDatabases';
import { listEnvironmentSecretDocs } from '@/lib/environments/secretScope';
import { syncEnvironmentSecrets } from '@/lib/environments/syncSecrets';
import { normalizeTeamPolicy } from '@/lib/security/teamPolicy';
import { ObjectId } from 'mongodb';

function sanitizeKehrnelConfig(config = null) {
  if (!config) return { useDefault: true, apiUrl: '', connectionId: null, envKey: null };
  return {
    useDefault: config.useDefault !== false,
    apiUrl: config.apiUrl || '',
    connectionId: config.connectionId || null,
    envKey: config.envKey || null
  };
}

function sanitizeEnvironments(envs = []) {
  return envs.map(({ id, name, description, database, domainDatabases, isActive, createdAt, updatedAt, strategyLinks, kehrnel }) => ({
    id,
    name,
    description,
    database,
    domainDatabases: sanitizeDomainDatabases(domainDatabases),
    isActive: !!isActive,
    createdAt,
    updatedAt,
    strategyLinks: normalizeStrategyLinks(strategyLinks || []),
    kehrnel: sanitizeKehrnelConfig(kehrnel),
  }));
}

function normalizeActive(list = []) {
  if (!list.length) return list;
  const firstActiveIdx = list.findIndex(e => e.isActive);
  if (firstActiveIdx === -1) {
    // none active -> make first active
    return [{ ...list[0], isActive: true }, ...list.slice(1).map(e => ({ ...e, isActive: false }))];
  }
  // ensure only one active (keep the first that was active)
  return list.map((e, i) => ({ ...e, isActive: i === firstActiveIdx }));
}

function toTeamQuery(teamId) {
  if (typeof teamId === 'string' && ObjectId.isValid(teamId)) {
    return { _id: new ObjectId(teamId) };
  }
  return { _id: teamId };
}

// GET /api/users/preferences
export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const db = await getCoreDb();

    const user = await db.collection('users').findOne({ email: session.user.email });
    if (!user) {
      return Response.json({
        accountType: null,
        theme: null,
        environments: [],
      });
    }

    // Team users: pull theme/envs from team, but NEVER return connection strings
    if (user.teamId && (user.accountType === 'team' || user.accountType === 'demo')) {
      const team = await db.collection('teams').findOne(toTeamQuery(user.teamId));
      return Response.json({
        _id: user._id,
        email: user.email,
        name: user.name,
        accountType: 'team',
        theme: team?.theme || null,
        teamPolicy: normalizeTeamPolicy(team?.policy),
        environments: sanitizeEnvironments(team?.environments || []),
        teamId: user.teamId,
        teamName: team?.name || null,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    }

    // Individual users: return sanitized envs (no connectionString)
    return Response.json({
      _id: user._id,
      email: user.email,
      name: user.name,
      accountType: user.accountType || 'individual',
      theme: user.theme || null,
      environments: sanitizeEnvironments(user.environments || []),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error('GET /api/users/preferences error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/users/preferences
export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const input = await request.json();
    const db = await getCoreDb();

    const existing = await db.collection('users').findOne({ email: session.user.email });
    const existingEnvironmentsById = new Map(
      (existing?.environments || []).map((env) => [env.id, env])
    );
    const previousEnvironments = Array.isArray(existing?.environments) ? existing.environments : [];
    const patch = { updatedAt: new Date() };

    // Always allow accountType updates
    if (input.accountType !== undefined) {
      patch.accountType = input.accountType;
    }

    if (existing?.teamId && (existing?.accountType === 'team' || existing?.accountType === 'demo')) {
      // Team members cannot override shared theme/environments here
      // (Team settings go through /api/teams)
      // Do nothing for theme/environments
    } else {
      // Individual user: can update theme & environments (we will store connectionString server-side)
      if (input.theme !== undefined) {
        patch.theme = input.theme;
      }

      if (Array.isArray(input.environments)) {
        const incomingEnvIds = input.environments.map((env) => env.id).filter(Boolean);
        const ownerScope = existing?._id ? { mode: 'individual', user: existing } : null;
        const existingSecretDocs = incomingEnvIds.length > 0
          ? await listEnvironmentSecretDocs(db, ownerScope, incomingEnvIds, {
            projection: { envId: 1, sealedUri: 1 }
          })
          : [];
        const existingSecretByEnvId = new Map(existingSecretDocs.map((doc) => [doc.envId, doc]));
        const nowIso = new Date().toISOString();

        for (const rawEnv of input.environments) {
          const prev = rawEnv.id ? existingEnvironmentsById.get(rawEnv.id) : null;
          const id = rawEnv.id || `env-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const name = rawEnv.name ?? prev?.name ?? id;
          const database = rawEnv.database ?? prev?.database ?? '';
          const trimmedConnection = typeof rawEnv.connectionString === 'string' ? rawEnv.connectionString.trim() : '';
          const existingSecret = existingSecretByEnvId.get(id)?.sealedUri;
          const sealed = trimmedConnection
            ? sealSecret(trimmedConnection)
            : (rawEnv.sealedUri ?? prev?.sealedUri ?? existingSecret);

          if (!sealed) {
            return Response.json({
              error: getEnvironmentSaveErrorMessage(name, 'connection string is required before saving')
            }, { status: 400 });
          }

          if (!trimmedConnection) continue;
          try {
            await validateMongoEnvironmentConnection({
              connectionString: trimmedConnection,
              database
            });
          } catch (error) {
            return Response.json({
              error: getEnvironmentSaveErrorMessage(name, getConnectionValidationMessage(database, error))
            }, { status: 400 });
          }
        }

        let envs = input.environments.map(env => {
          const prev = env.id ? existingEnvironmentsById.get(env.id) : null;
          const id = env.id || `env-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const name = env.name ?? prev?.name ?? id;
          const database = env.database ?? prev?.database ?? '';
          const trimmedConnection = typeof env.connectionString === 'string' ? env.connectionString.trim() : '';
          const existingSecret = existingSecretByEnvId.get(id)?.sealedUri;
          const sealed = trimmedConnection
            ? sealSecret(trimmedConnection)
            : (env.sealedUri ?? prev?.sealedUri ?? existingSecret);

          return {
            id,
            name,
            description: env.description ?? prev?.description ?? '',
            database,
            domainDatabases: sanitizeDomainDatabases(env.domainDatabases ?? prev?.domainDatabases),
            isActive: !!env.isActive,
            createdAt: prev?.createdAt || env.createdAt || nowIso,
            updatedAt: nowIso,
            strategyLinks: normalizeStrategyLinks(env.strategyLinks || prev?.strategyLinks || []),
            kehrnel: sanitizeKehrnelConfig(env.kehrnel ?? prev?.kehrnel),
            ...(sealed ? { sealedUri: sealed } : {})
          };
        });
      
        envs = normalizeActive(envs);
        patch.environments = envs;
      }
    }

    await db.collection('users').updateOne(
      { email: session.user.email },
      {
        $set: patch,
        $setOnInsert: {
          email: session.user.email,
          name: session.user.name || '',
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    const updated = await db.collection('users').findOne({ email: session.user.email });
    if (Array.isArray(patch.environments)) {
      await syncEnvironmentSecrets(
        db,
        { mode: 'individual', user: updated },
        patch.environments,
        previousEnvironments
      );
    }

    // Respond with sanitized view

    if (updated?.teamId && (updated?.accountType === 'team' || updated?.accountType === 'demo')) {
      const team = await db.collection('teams').findOne(toTeamQuery(updated.teamId));
      return Response.json({
        _id: updated._id,
        email: updated.email,
        name: updated.name,
        accountType: 'team',
        theme: team?.theme || null,
        teamPolicy: normalizeTeamPolicy(team?.policy),
        environments: sanitizeEnvironments(team?.environments || []),
        teamId: updated.teamId,
        teamName: team?.name || null,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    }

    return Response.json({
      _id: updated._id,
      email: updated.email,
      name: updated.name,
      accountType: updated.accountType || 'individual',
      theme: updated.theme || null,
      environments: sanitizeEnvironments(updated.environments || []),
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error('POST /api/users/preferences error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
