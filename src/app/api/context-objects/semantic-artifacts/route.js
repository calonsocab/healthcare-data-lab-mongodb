import { NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/security/api';
import { getCoreDb } from '@/lib/db/coreDb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { compileOpenEhrSemanticArtifacts } from '@/lib/contextObjects/openehrSemanticArtifacts';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '@/lib/security/environmentControls';

const DEFINITIONS_COLLECTION = 'semantic_objects';
const ARTIFACTS_COLLECTION = 'context_object_semantic_artifacts';

function isObjectRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asNonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

async function ensureIndexes(db) {
  await db.collection(ARTIFACTS_COLLECTION).createIndexes([
    { key: { definitionId: 1 }, name: 'definitionId_1', unique: true, sparse: true },
    { key: { sourceTemplateId: 1 }, name: 'sourceTemplateId_1' },
    { key: { 'metadata.updatedAt': -1 }, name: 'metadata.updatedAt_desc' }
  ]);
}

function unpackSemanticInput(body = {}) {
  if (isObjectRecord(body?.definition) && (body.definition.root || body.definition.sourceModel)) {
    return {
      semanticObject: isObjectRecord(body?.semanticObject) ? body.semanticObject : null,
      definition: body.definition
    };
  }

  if (isObjectRecord(body?.definition) && isObjectRecord(body.definition.definition)) {
    return {
      semanticObject: body.definition,
      definition: body.definition.definition
    };
  }

  if (isObjectRecord(body) && isObjectRecord(body.definition)) {
    return {
      semanticObject: body,
      definition: body.definition
    };
  }

  if (isObjectRecord(body) && (body.root || body.sourceModel)) {
    return {
      semanticObject: null,
      definition: body
    };
  }

  return {
    semanticObject: null,
    definition: null
  };
}

function buildPersistedArtifactDoc({ definitionId, semanticObject, artifacts, actorEmail }) {
  const now = new Date().toISOString();
  return {
    definitionId: definitionId || null,
    definitionName: asNonEmptyString(semanticObject?.name) || artifacts?.source?.templateLabel || null,
    definitionVersion: asNonEmptyString(semanticObject?.versionString || semanticObject?.version) || null,
    sourceTemplateId: artifacts?.source?.templateId || null,
    sourceFamily: artifacts?.source?.family || 'openEHR',
    artifacts,
    metadata: {
      createdBy: actorEmail || 'unknown',
      updatedBy: actorEmail || 'unknown',
      updatedAt: now
    }
  };
}

export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const definitionId = asNonEmptyString(searchParams.get('definitionId'));
    if (!definitionId) {
      return NextResponse.json({ error: 'definitionId is required' }, { status: 400 });
    }

    const { db, environment } = await getActiveTenantDb(request);
    await ensureIndexes(db);

    const doc = await db.collection(ARTIFACTS_COLLECTION).findOne(
      { definitionId },
      { projection: { _id: 0 } }
    );

    if (!doc) {
      return NextResponse.json({ error: 'Semantic artifacts not found' }, { status: 404 });
    }

    return NextResponse.json(doc);
  } catch (error) {
    console.error('GET /api/context-objects/semantic-artifacts error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load semantic artifacts' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();
    const requestedDefinitionId = asNonEmptyString(body?.definitionId);
    const { semanticObject: postedSemanticObject, definition: postedDefinition } = unpackSemanticInput(body);

    const { db } = await getActiveTenantDb(request);
    await ensureIndexes(db);

    let semanticObject = postedSemanticObject;
    let definition = postedDefinition;
    let definitionId = requestedDefinitionId || asNonEmptyString(postedSemanticObject?.id);

    if (!definition && definitionId) {
      semanticObject = await db.collection(DEFINITIONS_COLLECTION).findOne(
        { id: definitionId },
        { projection: { _id: 0 } }
      );

      if (!semanticObject) {
        return NextResponse.json({ error: 'ContextObject not found' }, { status: 404 });
      }

      definition = semanticObject.definition || null;
    }

    if (!definition) {
      return NextResponse.json(
        { error: 'A definition or definitionId is required to generate semantic artifacts' },
        { status: 400 }
      );
    }

    definitionId = definitionId || asNonEmptyString(semanticObject?.id) || null;
    const artifacts = compileOpenEhrSemanticArtifacts(definition, {
      templateId: asNonEmptyString(semanticObject?.metadata?.definitionLifecycle?.sourceArtifactId)
        || asNonEmptyString(semanticObject?.metadata?.importSource?.sourceArtifactId)
        || asNonEmptyString(definition?.sourceModel?.templateId)
        || undefined,
      contextContract: semanticObject?.metadata?.contextContract || definition?.metadata?.contextContract || {},
      definitionKind: semanticObject?.kind || definition?.kind || 'context_object'
    });

    const persist = body?.persist === true && !!definitionId;
    let persisted = false;

    if (persist) {
      const coreDb = await getCoreDb();
      const envGate = await enforceEnvironmentControl(coreDb, environment?.id, ENV_CONTROL_CAPABILITY.WRITE);
      if (envGate) return envGate;

      const doc = buildPersistedArtifactDoc({
        definitionId,
        semanticObject,
        artifacts,
        actorEmail: session?.user?.email || session?.user?.name || 'unknown'
      });

      await db.collection(ARTIFACTS_COLLECTION).updateOne(
        { definitionId },
        { $set: doc },
        { upsert: true }
      );
      persisted = true;
    }

    return NextResponse.json({
      definitionId,
      definitionName: asNonEmptyString(semanticObject?.name) || null,
      persisted,
      artifacts
    });
  } catch (error) {
    console.error('POST /api/context-objects/semantic-artifacts error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate semantic artifacts' },
      { status: 500 }
    );
  }
}
