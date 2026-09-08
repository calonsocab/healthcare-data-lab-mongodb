import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/data-model-catalog/[id]/analytics/route.js
import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { getCoreDb } from '@/lib/db/coreDb';
import { loadEnvironmentScope } from '@/lib/environments/access';
import {
  buildAnalyticsSearchRefresh,
  supportsSearchRefresh,
} from '@/lib/environments/searchRefresh';

async function flagSearchRefreshForActiveEnvironment({
  environment,
  userEmail,
  dataModelId,
  dataModelName,
  analyticsTemplate,
}) {
  if (!environment?.id || !userEmail) {
    return null;
  }

  const coreDb = await getCoreDb();
  const scope = await loadEnvironmentScope(coreDb, userEmail);
  if (!scope?.mode) {
    return null;
  }

  const holder = scope.mode === 'team' ? (scope.team || {}) : (scope.user || {});
  const environments = Array.isArray(holder.environments) ? [...holder.environments] : [];
  const envIdx = environments.findIndex((item) => item.id === environment.id);
  if (envIdx < 0) {
    return null;
  }

  const env = { ...environments[envIdx] };
  const strategyLinks = Array.isArray(env.strategyLinks) ? [...env.strategyLinks] : [];
  const nowIso = new Date().toISOString();
  const refreshState = buildAnalyticsSearchRefresh({
    dataModelId,
    dataModelName,
    templateId: analyticsTemplate?.templateId || analyticsTemplate?.id || null,
    fieldCount: Array.isArray(analyticsTemplate?.fields) ? analyticsTemplate.fields.length : null,
    userEmail,
    nowIso,
  });

  let flaggedCount = 0;
  env.strategyLinks = strategyLinks.map((link) => {
    if (!supportsSearchRefresh(link)) {
      return link;
    }
    flaggedCount += 1;
    return {
      ...link,
      searchRefresh: refreshState,
    };
  });

  if (!flaggedCount) {
    return null;
  }

  env.updatedAt = nowIso;
  environments[envIdx] = env;

  const targetCol = scope.mode === 'team' ? coreDb.collection('teams') : coreDb.collection('users');
  const filter = scope.mode === 'team' ? { _id: scope.user.teamId } : { _id: scope.user._id };
  await targetCol.updateOne(filter, { $set: { environments } });

  return {
    required: true,
    flaggedCount,
    environmentId: environment.id,
    state: refreshState,
  };
}

/**
 * PUT /api/data-model-catalog/[id]/analytics
 * Save or update the analyticsTemplate configuration for a data model
 */
export async function PUT(req, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Data model ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const { analyticsTemplate } = body;

    if (!analyticsTemplate) {
      return NextResponse.json({ error: 'analyticsTemplate is required' }, { status: 400 });
    }

    // Validate analyticsTemplate structure
    // Backward compatibility: accept templateId in place of id
    if (!analyticsTemplate.id && analyticsTemplate.templateId) {
      analyticsTemplate.id = analyticsTemplate.templateId;
    }

    if (!analyticsTemplate.id || !Array.isArray(analyticsTemplate.fields)) {
      return NextResponse.json({
        error: 'analyticsTemplate must have an id and fields array'
      }, { status: 400 });
    }

    const { db, environment } = await getActiveTenantDb(req, { session });
    const { ObjectId } = await import('mongodb');
    const dataModelObjectId = new ObjectId(id);
    const existingDoc = await db.collection('user-data-models').findOne(
      { _id: dataModelObjectId },
      { projection: { _id: 1, name: 1 } }
    );

    if (!existingDoc) {
      return NextResponse.json({ error: 'Data model not found' }, { status: 404 });
    }

    // Update the data model with the analytics configuration
    await db.collection('user-data-models').updateOne(
      { _id: dataModelObjectId },
      {
        $set: {
          analyticsTemplate,
          'audit.lastModified': new Date().toISOString(),
          'audit.lastModifiedBy': session.user.email || session.user.name
        }
      }
    );

    const refreshFlagged = await flagSearchRefreshForActiveEnvironment({
      environment,
      userEmail: session.user.email || session.user.name,
      dataModelId: existingDoc._id.toString(),
      dataModelName: existingDoc.name || analyticsTemplate.templateId || analyticsTemplate.id || id,
      analyticsTemplate,
    });

    return NextResponse.json({
      success: true,
      message: 'Analytics configuration saved',
      analyticsTemplate,
      refreshFlagged,
    });

  } catch (e) {
    console.error('PUT /api/data-model-catalog/[id]/analytics error:', e);
    const status = e.status && Number.isInteger(e.status) ? e.status : 500;
    return NextResponse.json({ error: e.message || 'Server error' }, { status });
  }
}

/**
 * GET /api/data-model-catalog/[id]/analytics
 * Get the analyticsTemplate configuration for a data model
 */
export async function GET(req, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Data model ID is required' }, { status: 400 });
    }

    const { db } = await getActiveTenantDb(req);
    const { ObjectId } = await import('mongodb');

    const doc = await db.collection('user-data-models').findOne(
      { _id: new ObjectId(id) },
      { projection: { analyticsTemplate: 1, name: 1 } }
    );

    if (!doc) {
      return NextResponse.json({ error: 'Data model not found' }, { status: 404 });
    }

    return NextResponse.json({
      templateId: doc._id.toString(),
      templateName: doc.name,
      analyticsTemplate: doc.analyticsTemplate || null
    });

  } catch (e) {
    console.error('GET /api/data-model-catalog/[id]/analytics error:', e);
    const status = e.status && Number.isInteger(e.status) ? e.status : 500;
    return NextResponse.json({ error: e.message || 'Server error' }, { status });
  }
}

/**
 * DELETE /api/data-model-catalog/[id]/analytics
 * Remove the analyticsTemplate configuration from a data model
 */
export async function DELETE(req, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'Data model ID is required' }, { status: 400 });
    }

    const { db, environment } = await getActiveTenantDb(req, { session });
    const { ObjectId } = await import('mongodb');
    const dataModelObjectId = new ObjectId(id);
    const existingDoc = await db.collection('user-data-models').findOne(
      { _id: dataModelObjectId },
      { projection: { _id: 1, name: 1, analyticsTemplate: 1 } }
    );

    if (!existingDoc) {
      return NextResponse.json({ error: 'Data model not found' }, { status: 404 });
    }

    await db.collection('user-data-models').updateOne(
      { _id: dataModelObjectId },
      {
        $unset: { analyticsTemplate: '' },
        $set: {
          'audit.lastModified': new Date().toISOString(),
          'audit.lastModifiedBy': session.user.email || session.user.name
        }
      }
    );

    const refreshFlagged = await flagSearchRefreshForActiveEnvironment({
      environment,
      userEmail: session.user.email || session.user.name,
      dataModelId: existingDoc._id.toString(),
      dataModelName: existingDoc.name || existingDoc.analyticsTemplate?.templateId || id,
      analyticsTemplate: existingDoc.analyticsTemplate || { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Analytics configuration removed',
      refreshFlagged,
    });

  } catch (e) {
    console.error('DELETE /api/data-model-catalog/[id]/analytics error:', e);
    const status = e.status && Number.isInteger(e.status) ? e.status : 500;
    return NextResponse.json({ error: e.message || 'Server error' }, { status });
  }
}
