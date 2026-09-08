import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import JSZip from 'jszip';
import { getCoreDb } from '@/lib/db/coreDb';
import { getDb } from '@/lib/db/connectionManager';
import { resolveEnvByIdForUser } from '@/lib/db/tenantDb';
import {
  PROMOTABLE_ENVIRONMENT_ASSETS,
} from '@/lib/environments/promotion';
import {
  buildAssetBundleManifest,
  createAssetBundleFileName,
  getAssetCollectionFilePath,
  serializeBundleDocuments,
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
      return NextResponse.json({ error: 'Only team admins can export data bundles' }, { status: 403 });
    }

    const body = await request.json();
    const envId = String(body?.envId || '').trim();
    if (!envId) {
      return NextResponse.json({ error: 'envId is required' }, { status: 400 });
    }

    const scopeEnvironments = scope.mode === 'team'
      ? (scope.team?.environments || [])
      : (scope.user?.environments || []);
    const environmentSummary = scopeEnvironments.find((environment) => environment.id === envId);
    if (!environmentSummary) {
      return NextResponse.json({ error: 'Environment is not accessible' }, { status: 404 });
    }

    const { db, environment } = await openResolvedEnvironment(envId);
    const zip = new JSZip();
    const collectionSummaries = [];

    for (const asset of PROMOTABLE_ENVIRONMENT_ASSETS) {
      const documents = await db.collection(asset.collection).find({}).toArray();
      zip.file(getAssetCollectionFilePath(asset.collection), serializeBundleDocuments(documents));
      collectionSummaries.push({
        collection: asset.collection,
        count: documents.length,
      });
    }

    const manifest = buildAssetBundleManifest({
      sourceEnvironment: environment,
      exportedBy: session.user.email,
      collectionSummaries,
    });
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    const nodeStream = zip.generateNodeStream({
      type: 'nodebuffer',
      streamFiles: true,
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return new Response(Readable.toWeb(nodeStream), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${createAssetBundleFileName(environmentSummary.name)}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('POST /api/environments/bundle/export error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export data bundle' },
      { status: 500 }
    );
  }
}
