import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { getDb } from '@/lib/db/connectionManager';
import { resolveEnvByIdForUser } from '@/lib/db/tenantDb';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '@/lib/security/environmentControls';
import {
  PROMOTABLE_ENVIRONMENT_ASSETS,
  buildTargetEnvironmentAfterPromotion,
  prepareDocumentsForPromotion,
} from '@/lib/environments/promotion';

export const dynamic = 'force-dynamic';

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isAdminRole(role = '') {
  return role === 'owner' || role === 'admin';
}

async function loadScope(coreDb, email) {
  const normalizedEmail = normalizeEmail(email);
  const user = await coreDb.collection('users').findOne({ email: normalizedEmail });
  if (!user) {
    throw new Error('User not found');
  }

  if (user.teamId && (user.accountType === 'team' || user.accountType === 'demo')) {
    const team = await coreDb.collection('teams').findOne({ _id: user.teamId });
    const requester = (team?.members || []).find((member) => normalizeEmail(member.email) === normalizedEmail);
    return {
      mode: 'team',
      user,
      team,
      requesterRole: requester?.role || null,
    };
  }

  return {
    mode: 'individual',
    user,
    team: null,
    requesterRole: 'owner',
  };
}

function summarizeEnvironment(environment = {}) {
  return {
    id: environment.id,
    name: environment.name,
    database: environment.database,
  };
}

async function openResolvedEnvironment(envId) {
  const resolved = await resolveEnvByIdForUser(undefined, envId);
  const db = await getDb({ uri: resolved.uri, dbName: resolved.environment.database });
  return {
    db,
    environment: resolved.environment,
    uri: resolved.uri,
  };
}

async function replaceCollectionDocuments({
  collectionName,
  label,
  sourceDb,
  targetDb,
  sourceEnvironment,
  targetEnvironment,
}) {
  const sourceCollection = sourceDb.collection(collectionName);
  const targetCollection = targetDb.collection(collectionName);

  const sourceDocuments = await sourceCollection.find({}).toArray();
  const preparedDocuments = prepareDocumentsForPromotion(collectionName, sourceDocuments, {
    sourceEnvironment,
    targetEnvironment,
  });
  const replacedCount = await targetCollection.countDocuments({});

  await targetCollection.deleteMany({});
  if (preparedDocuments.length > 0) {
    await targetCollection.insertMany(preparedDocuments);
  }

  return {
    collection: collectionName,
    label,
    sourceCount: preparedDocuments.length,
    replacedCount,
  };
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();
    const scope = await loadScope(coreDb, session.user.email);

    if (scope.mode === 'team' && !scope.requesterRole) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (scope.mode === 'team' && !isAdminRole(scope.requesterRole)) {
      return NextResponse.json({ error: 'Only team admins can promote environment assets' }, { status: 403 });
    }

    const body = await request.json();
    const sourceEnvId = String(body?.sourceEnvId || '').trim();
    const targetEnvId = String(body?.targetEnvId || '').trim();
    const includeRuntimeConfig = body?.includeRuntimeConfig === true;

    if (!sourceEnvId || !targetEnvId) {
      return NextResponse.json({ error: 'sourceEnvId and targetEnvId are required' }, { status: 400 });
    }

    if (sourceEnvId === targetEnvId) {
      return NextResponse.json({ error: 'Choose different source and target environments' }, { status: 400 });
    }

    const scopeEnvironments = scope.mode === 'team'
      ? (scope.team?.environments || [])
      : (scope.user?.environments || []);

    const sourceEnvironmentSummary = scopeEnvironments.find((environment) => environment.id === sourceEnvId);
    const targetEnvironmentSummary = scopeEnvironments.find((environment) => environment.id === targetEnvId);

    if (!sourceEnvironmentSummary || !targetEnvironmentSummary) {
      return NextResponse.json({ error: 'Source or target environment is not accessible' }, { status: 404 });
    }

    const envGate = await enforceEnvironmentControl(coreDb, targetEnvId, ENV_CONTROL_CAPABILITY.OPS);
    if (envGate) return envGate;

    const [sourceContext, targetContext] = await Promise.all([
      openResolvedEnvironment(sourceEnvId),
      openResolvedEnvironment(targetEnvId),
    ]);

    if (
      sourceContext.uri === targetContext.uri &&
      sourceContext.environment.database === targetContext.environment.database
    ) {
      return NextResponse.json(
        { error: 'Source and target point to the same database, so promotion is not necessary.' },
        { status: 400 }
      );
    }

    const promotedCollections = [];
    for (const asset of PROMOTABLE_ENVIRONMENT_ASSETS) {
      const result = await replaceCollectionDocuments({
        collectionName: asset.collection,
        label: asset.label,
        sourceDb: sourceContext.db,
        targetDb: targetContext.db,
        sourceEnvironment: sourceContext.environment,
        targetEnvironment: targetContext.environment,
      });
      promotedCollections.push(result);
    }

    let updatedTargetEnvironment = targetEnvironmentSummary;
    if (includeRuntimeConfig) {
      const nowIso = new Date().toISOString();
      updatedTargetEnvironment = buildTargetEnvironmentAfterPromotion(
        sourceEnvironmentSummary,
        targetEnvironmentSummary,
        {
          includeRuntimeConfig: true,
          nowIso,
        }
      );

      const nextEnvironments = scopeEnvironments.map((environment) =>
        environment.id === targetEnvId ? updatedTargetEnvironment : environment
      );

      const targetCollection = scope.mode === 'team'
        ? coreDb.collection('teams')
        : coreDb.collection('users');
      const filter = scope.mode === 'team'
        ? { _id: scope.user.teamId }
        : { _id: scope.user._id };

      await targetCollection.updateOne(filter, { $set: { environments: nextEnvironments } });
    }

    return NextResponse.json({
      success: true,
      source: summarizeEnvironment(sourceEnvironmentSummary),
      target: summarizeEnvironment(updatedTargetEnvironment),
      targetEnvironment: updatedTargetEnvironment,
      includeRuntimeConfig,
      promotedCollections,
      totalDocumentsPromoted: promotedCollections.reduce((total, item) => total + item.sourceCount, 0),
    });
  } catch (error) {
    console.error('POST /api/environments/promote error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to promote environment assets' },
      { status: 500 }
    );
  }
}
