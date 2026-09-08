import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { getDb } from '@/lib/db/connectionManager';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';
import { normalizeCompositionForIngest } from '@/lib/openehr/compositionIngest';
import { buildCompositionRepairPlan } from '@/lib/openehr/compositionStorageRepair';
import { resolveRuntimeContext } from '@/lib/kehrnel/runtimeContext';
import {
  enforceApiRateLimit,
  enforceNumericLimit,
  resolvePolicyContext
} from '@/lib/security/teamPolicy';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '@/lib/security/environmentControls';

function parseKehrnelError(payload, fallbackMessage) {
  if (!payload || typeof payload !== 'object') return { message: fallbackMessage };
  const err = payload.error && typeof payload.error === 'object' ? payload.error : payload;
  return {
    code: err.code || null,
    message: err.message || err.error || fallbackMessage,
    details: err.details || null
  };
}

function isActivationMissing(err) {
  const code = (err?.code || '').toString().toUpperCase();
  const message = (err?.message || '').toString();
  return code === 'ACTIVATION_NOT_FOUND' || /ACTIVATION_NOT_FOUND|activation/i.test(message);
}

async function repairStoredCompositionMetadata({ uri, runtime, summary }) {
  const plan = buildCompositionRepairPlan(runtime, summary);
  if (!plan || !uri) {
    return { repaired: false, skipped: true, reason: 'repair-not-applicable' };
  }

  const db = await getDb({ uri, dbName: plan.targetDatabase });
  const result = await db.collection(plan.collection).updateOne(plan.filter, plan.update);
  return {
    repaired: result.matchedCount > 0,
    skipped: false,
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    targetDatabase: plan.targetDatabase,
    collection: plan.collection
  };
}


export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();
    const activeEnvId = (
      request.headers.get('x-active-env')
      || request.headers.get('x-env-id')
      || request.headers.get('x-environment-id')
      || body?.environment
      || body?.envId
      || ''
    ).toString().trim();
    const domain = String(body?.domain || 'openehr').trim().toLowerCase();
    const strategyId = String(body?.strategyId || '').trim() || null;
    const items = Array.isArray(body?.items) ? body.items : [];

    if (!items.length) {
      return NextResponse.json({ error: 'items array is required' }, { status: 400 });
    }

    const coreDb = await getCoreDb();
    const policyContext = await resolvePolicyContext(coreDb, session.user.email);
    await enforceApiRateLimit(coreDb, policyContext, 'ingest-compositions:post');
    enforceNumericLimit(
      policyContext?.policy?.limits?.maxIngestDocumentsPerRequest,
      items.length,
      {
        code: 'TEAM_INGEST_BATCH_LIMIT_EXCEEDED',
        status: 429,
        message: 'Ingest batch exceeds team policy limit',
        details: {
          documents: items.length,
          maxIngestDocumentsPerRequest: policyContext?.policy?.limits?.maxIngestDocumentsPerRequest
        }
      }
    );
    const maxIngestDocumentBytes = policyContext?.policy?.limits?.maxIngestDocumentBytes;
    if (Number.isFinite(maxIngestDocumentBytes) && maxIngestDocumentBytes > 0) {
      for (const entry of items) {
        const size = Buffer.byteLength(JSON.stringify(entry?.composition || {}), 'utf8');
        enforceNumericLimit(
          maxIngestDocumentBytes,
          size,
          {
            code: 'TEAM_INGEST_DOCUMENT_TOO_LARGE',
            status: 413,
            message: 'A composition exceeds team ingest document size policy',
            details: {
              fileName: entry?.fileName || null,
              documentId: entry?.documentId || null,
              bytes: size,
              maxIngestDocumentBytes
            }
          }
        );
      }
    }

    const service = createKehrnelService(coreDb);
    const { environment, uri } = await getActiveTenantDb(request);

    const envGate = await enforceEnvironmentControl(coreDb, environment?.id, ENV_CONTROL_CAPABILITY.WRITE);
    if (envGate) return envGate;

    const runtime = await resolveRuntimeContext({
      coreDb,
      userEmail: session.user.email,
      envId: environment?.id,
      requestedDomain: domain,
      strategyId
    });

    const conn = await service.resolveConnection({
      connectionId: runtime.connectionId || undefined,
      envKehrnel: environment?.kehrnel || {}
    });

    if (!conn?.url) {
      return NextResponse.json(
        { error: 'No Kehrnel connection available for active environment' },
        { status: 503 }
      );
    }

    const envKey = runtime?.envKey || environment?.id;
    if (!envKey) {
      return NextResponse.json({ error: 'No active environment selected' }, { status: 400 });
    }

    await service.ensureRuntimeReady(envKey, {
      strategyId: runtime?.autoActivate?.strategyId || strategyId || null,
      connectionId: runtime.connectionId || undefined,
      domain,
      envKehrnel: environment?.kehrnel || {},
      autoActivate: runtime.autoActivate || null
    });

    const ingestUrl = `${conn.url.replace(/\/$/, '')}/environments/${encodeURIComponent(envKey)}/ingest`;
    const requestHeaders = {
      'Content-Type': 'application/json',
      ...(conn.apiKey && { 'X-API-Key': conn.apiKey }),
      ...(activeEnvId && { 'x-active-env': activeEnvId }),
      ...(runtime?.envKey && { 'x-kehrnel-env': String(runtime.envKey) }),
      ...(domain && { 'x-kehrnel-domain': domain }),
      'x-authenticated-user': session.user.email
    };

    const runIngest = async (entry, normalized) => {
      const response = await fetch(ingestUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          domain,
          composition: normalized?.composition || entry.composition
        })
      });

      const text = await response.text().catch(() => '');
      const parsed = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;

      if (!response.ok) {
        const err = parseKehrnelError(parsed, `Kehrnel ingest failed (${response.status})`);
        const failure = new Error(err.message);
        failure.status = response.status;
        failure.code = err.code;
        failure.details = err.details;
        throw failure;
      }

      return parsed || {};
    };

    const tryIngestWithRecovery = async (entry, normalized) => {
      try {
        return await runIngest(entry, normalized);
      } catch (error) {
        if (!isActivationMissing(error) || !runtime?.autoActivate?.strategyId) {
          throw error;
        }
        await service.activateEnvironment(
          envKey,
          runtime.autoActivate.strategyId,
          runtime.autoActivate.config || {},
          {
            domain,
            connectionId: runtime.connectionId || undefined,
            envKehrnel: environment?.kehrnel || {},
            reason: 'activate-before-mapping-ingest',
            force: false
          }
        );
        await service.ensureRuntimeReady(envKey, {
          strategyId: runtime?.autoActivate?.strategyId,
          connectionId: runtime.connectionId || undefined,
          domain,
          envKehrnel: environment?.kehrnel || {},
          autoActivate: runtime.autoActivate || null
        });
        return runIngest(entry, normalized);
      }
    };

    const successes = [];
    const failures = [];
    for (const entry of items) {
      const normalized = normalizeCompositionForIngest(entry?.composition || {}, entry || {});
      if (normalized.summary.errors.length > 0) {
        failures.push({
          documentId: entry.documentId || null,
          fileName: entry.fileName || null,
          code: 'INVALID_COMPOSITION_METADATA',
          error: normalized.summary.errors.join(' '),
          details: {
            templateId: normalized.summary.templateId || null,
            archetypeNodeId: normalized.summary.archetypeNodeId || null,
            uid: normalized.summary.uid || null
          }
        });
        continue;
      }

      try {
        const result = await tryIngestWithRecovery(entry, normalized);
        let storageRepair = null;
        const warnings = [...normalized.summary.warnings];
        try {
          storageRepair = await repairStoredCompositionMetadata({
            uri,
            runtime,
            summary: normalized.summary
          });
          if (storageRepair?.skipped) {
            warnings.push('Stored composition metadata repair was skipped.');
          } else if (storageRepair?.repaired === false) {
            warnings.push('Stored composition metadata repair did not match the inserted document.');
          }
        } catch (repairError) {
          console.warn('Stored composition metadata repair failed:', repairError?.message || repairError);
          warnings.push(`Stored composition metadata repair failed: ${repairError?.message || 'unknown error'}`);
        }

        successes.push({
          documentId: entry.documentId || null,
          fileName: entry.fileName || null,
          inserted: result?.result?.inserted || result?.inserted || {},
          templateId: normalized.summary.templateId || null,
          archetypeNodeId: normalized.summary.archetypeNodeId || null,
          compositionUid: normalized.summary.uid || null,
          compositionVersion: normalized.summary.compositionVersion || null,
          timeCommitted: normalized.summary.timeCommitted || null,
          warnings,
          storageRepair
        });
      } catch (error) {
        failures.push({
          documentId: entry.documentId || null,
          fileName: entry.fileName || null,
          code: error?.code || null,
          error: error?.message || 'Ingest failed',
          details: error?.details || null
        });
      }
    }

    return NextResponse.json({
      environment: {
        id: environment?.id || null,
        name: environment?.name || null,
        envKey
      },
      domain,
      strategyId: runtime?.autoActivate?.strategyId || strategyId || null,
      total: items.length,
      ingested: successes.length,
      failed: failures.length,
      successes,
      failures
    });
  } catch (error) {
    console.error('POST /api/ingest-compositions error:', error);
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    return NextResponse.json(
      {
        code: error?.code || null,
        error: error?.message || 'Failed to ingest compositions',
        details: error?.details || null
      },
      { status }
    );
  }
}
