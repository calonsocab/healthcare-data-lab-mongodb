import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getCoreDb } from '@/lib/db/coreDb';
import { getDb } from '@/lib/db/connectionManager';
import { resolveEnvByIdForUser } from '@/lib/db/tenantDb';
import { parseFormDataWithLimit, PayloadTooLargeError } from '@/lib/uploads/bodyLimit';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '@/lib/security/environmentControls';
import {
  PROMOTABLE_ENVIRONMENT_ASSETS,
  buildTargetEnvironmentFromRuntimeConfig,
} from '@/lib/environments/promotion';
import {
  TEAM_ASSET_BUNDLE_FORMAT,
  TEAM_ASSET_BUNDLE_MAX_BYTES,
  TEAM_ASSET_BUNDLE_VERSION,
  getAssetCollectionFilePath,
  parseBundleCollectionDocuments,
} from '@/lib/environments/assetBundle';

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

function parseBoolean(value) {
  return value === true || value === 'true' || value === '1';
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
      return NextResponse.json({ error: 'Only team admins can import data bundles' }, { status: 403 });
    }

    const formData = await parseFormDataWithLimit(request, TEAM_ASSET_BUNDLE_MAX_BYTES + (1 * 1024 * 1024));
    const targetEnvId = String(formData.get('envId') || '').trim();
    const includeRuntimeConfig = parseBoolean(formData.get('includeRuntimeConfig'));
    const file = formData.get('bundle');

    if (!targetEnvId) {
      return NextResponse.json({ error: 'envId is required' }, { status: 400 });
    }

    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'bundle file is required' }, { status: 400 });
    }

    const scopeEnvironments = scope.mode === 'team'
      ? (scope.team?.environments || [])
      : (scope.user?.environments || []);
    const targetEnvironmentSummary = scopeEnvironments.find((environment) => environment.id === targetEnvId);
    if (!targetEnvironmentSummary) {
      return NextResponse.json({ error: 'Target environment is not accessible' }, { status: 404 });
    }

    const envGate = await enforceEnvironmentControl(coreDb, targetEnvId, ENV_CONTROL_CAPABILITY.OPS);
    if (envGate) return envGate;

    const zipBuffer = Buffer.from(await file.arrayBuffer());
    const zip = await JSZip.loadAsync(zipBuffer);
    const manifestEntry = zip.file('manifest.json');
    if (!manifestEntry) {
      return NextResponse.json({ error: 'Bundle is missing manifest.json' }, { status: 400 });
    }

    const manifest = JSON.parse(await manifestEntry.async('string'));
    if (manifest?.format !== TEAM_ASSET_BUNDLE_FORMAT) {
      return NextResponse.json({ error: 'Unsupported data bundle format' }, { status: 400 });
    }
    if (manifest?.version !== TEAM_ASSET_BUNDLE_VERSION) {
      return NextResponse.json({ error: 'Unsupported data bundle version' }, { status: 400 });
    }

    const { db: targetDb, environment: targetEnvironment } = await openResolvedEnvironment(targetEnvId);
    const importedCollections = [];

    for (const asset of PROMOTABLE_ENVIRONMENT_ASSETS) {
      const fileEntry = zip.file(getAssetCollectionFilePath(asset.collection));
      const serialized = fileEntry ? await fileEntry.async('string') : '';
      const documents = parseBundleCollectionDocuments(asset.collection, serialized, {
        targetEnvironment,
      });
      const targetCollection = targetDb.collection(asset.collection);
      const replacedCount = await targetCollection.countDocuments({});

      await targetCollection.deleteMany({});
      if (documents.length > 0) {
        await targetCollection.insertMany(documents);
      }

      importedCollections.push({
        collection: asset.collection,
        label: asset.label,
        importedCount: documents.length,
        replacedCount,
      });
    }

    let updatedTargetEnvironment = targetEnvironmentSummary;
    if (includeRuntimeConfig && manifest?.runtimeConfig) {
      const nowIso = new Date().toISOString();
      updatedTargetEnvironment = buildTargetEnvironmentFromRuntimeConfig(
        manifest.runtimeConfig,
        targetEnvironmentSummary,
        { nowIso }
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
      source: summarizeEnvironment(manifest?.sourceEnvironment || {}),
      target: summarizeEnvironment(updatedTargetEnvironment),
      targetEnvironment: updatedTargetEnvironment,
      includeRuntimeConfig,
      importedCollections,
      totalDocumentsImported: importedCollections.reduce((total, item) => total + item.importedCount, 0),
    });
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: 'Bundle file is too large' }, { status: 413 });
    }
    console.error('POST /api/environments/bundle/import error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import data bundle' },
      { status: 500 }
    );
  }
}
