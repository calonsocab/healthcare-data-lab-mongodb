import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/environments/secure/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { openSecret, sealSecret } from '@/lib/crypto/secrets.mjs';
import {
  getConnectionValidationMessage,
  validateMongoEnvironmentConnection
} from '@/lib/db/environmentConnectionValidation';
import { findAccessibleEnvironment } from '@/lib/environments/access';
import { buildMaskedConnectionStringPreview } from '@/lib/environments/connectionStringPreview';
import { listEnvironmentSecretDocs, upsertEnvironmentSecretDoc } from '@/lib/environments/secretScope';
import { parseJsonWithLimit, PayloadTooLargeError } from '@/lib/uploads/bodyLimit';

const SECURE_ENV_MAX_BODY_BYTES = 256 * 1024;

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isAdminRole(role) {
  return role === 'owner' || role === 'admin';
}

function buildConfiguredSecretPayload(sealedUri, updatedAt = null, options = {}) {
  const { includePreview = true } = options;
  const payload = {
    hasSecret: true,
    updatedAt: updatedAt || null,
    preview: null
  };

  if (!sealedUri) {
    return payload;
  }

  if (!includePreview) {
    return payload;
  }

  try {
    payload.preview = buildMaskedConnectionStringPreview(openSecret(sealedUri));
  } catch (error) {
    console.warn('Could not build environment connection preview:', error?.message || error);
  }

  return payload;
}

async function loadScope(coreDb, email) {
  const normalizedEmail = normalizeEmail(email);
  const user = await coreDb.collection('users').findOne(
    { email: normalizedEmail },
    { projection: { _id: 1, environments: 1, teamId: 1, accountType: 1 } }
  );
  if (!user) return { mode: 'none', user: null, team: null, requesterRole: null };

  if (user.teamId && (user.accountType === 'team' || user.accountType === 'demo')) {
    const team = await coreDb.collection('teams').findOne(
      { _id: user.teamId },
      { projection: { _id: 1, environments: 1, members: 1 } }
    );
    const requester = (team?.members || []).find((member) => normalizeEmail(member.email) === normalizedEmail);
    return { mode: 'team', user, team, requesterRole: requester?.role || null };
  }

  return { mode: 'individual', user, team: null, requesterRole: 'owner' };
}

// GET - Check which environments have connection secrets configured
export async function GET(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const url = new URL(req.url);
    const envIds = url.searchParams.get('envIds')?.split(',').filter(Boolean) || [];

    if (envIds.length === 0) {
      return NextResponse.json({ configured: {} });
    }

    const coreDb = await getCoreDb();
    const scope = await loadScope(coreDb, session.user.email);
    if (scope.mode === 'none') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (scope.mode === 'team' && !scope.requesterRole) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allowedEnvIds = new Set(
      (scope.mode === 'team'
        ? (scope.team?.environments || [])
        : (scope.user?.environments || []))
        .map((env) => env.id)
        .filter(Boolean)
    );
    const scopeEnvironments = scope.mode === 'team'
      ? (scope.team?.environments || [])
      : (scope.user?.environments || []);
    const canViewPreview = scope.mode !== 'team' || isAdminRole(scope.requesterRole);
    const unauthorized = envIds.filter((id) => !allowedEnvIds.has(id));
    if (unauthorized.length > 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const configured = {};
    for (const env of scopeEnvironments) {
      if (envIds.includes(env.id) && env?.sealedUri) {
        configured[env.id] = buildConfiguredSecretPayload(env.sealedUri, env.updatedAt || null, {
          includePreview: canViewPreview
        });
      }
    }

    const secrets = await listEnvironmentSecretDocs(coreDb, scope, envIds, {
      projection: { envId: 1, sealedUri: 1, updatedAt: 1 }
    });

    for (const secret of secrets) {
      configured[secret.envId] = buildConfiguredSecretPayload(secret.sealedUri, secret.updatedAt, {
        includePreview: canViewPreview
      });
    }

    return NextResponse.json({ configured });
  } catch (e) {
    console.error('GET /api/environments/secure error:', e);
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { envId, connectionString } = await parseJsonWithLimit(req, SECURE_ENV_MAX_BODY_BYTES);
    if (!envId || !connectionString) {
      return NextResponse.json({ error: 'envId and connectionString required' }, { status: 400 });
    }

    const coreDb = await getCoreDb();
    const scope = await loadScope(coreDb, session.user.email);
    if (scope.mode === 'none') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (scope.mode === 'team') {
      if (!scope.requesterRole) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (!isAdminRole(scope.requesterRole)) {
        return NextResponse.json({ error: 'Only admins can update environment connection secrets' }, { status: 403 });
      }
    }

    const accessible = await findAccessibleEnvironment(coreDb, session.user.email, envId);
    if (!accessible.environment) {
      return NextResponse.json({
        error: 'Environment not found or not accessible'
      }, { status: 404 });
    }

    const trimmedConnection = connectionString.trim();
    try {
      await validateMongoEnvironmentConnection({
        connectionString: trimmedConnection,
        database: accessible.environment.database
      });
    } catch (error) {
      return NextResponse.json({
        error: getConnectionValidationMessage(accessible.environment.database, error)
      }, { status: 400 });
    }

    await upsertEnvironmentSecretDoc(
      coreDb,
      accessible,
      envId,
      sealSecret(trimmedConnection),
      new Date()
    );

    return NextResponse.json({
      ok: true,
      preview: buildMaskedConnectionStringPreview(trimmedConnection)
    });
  } catch (e) {
    if (e instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    console.error('POST /api/environments/secure error:', e);
    return NextResponse.json({ error: e.message || 'Server error' }, { status: 500 });
  }
}
