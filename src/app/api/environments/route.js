import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/environments/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { normalizeStrategyLinks } from '@/lib/environments/normalizeStrategyLinks';
import { sanitizeDomainDatabases } from '@/lib/environments/domainDatabases';
import { deleteEnvironmentSecretDoc } from '@/lib/environments/secretScope';
import { getPublicKehrnelBaseUrl } from '@/lib/kehrnel/url';

// Disable caching to always return fresh data
export const dynamic = 'force-dynamic';

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function isAdminRole(role) {
  return role === 'owner' || role === 'admin';
}

/**
 * Normalize Kehrnel link metadata
 */
function normalizeKehrnelLink(kehrnel) {
  if (!kehrnel) return null;
  return {
    // New fields
    connectionId: kehrnel.connectionId || null,
    runtimeUrl: kehrnel.runtimeUrl || null,
    strategyId: kehrnel.strategyId || null,
    activatedAt: kehrnel.activatedAt || null,
    lastStatus: kehrnel.lastStatus || null,
    endpoints: kehrnel.endpoints || null,
    error: kehrnel.error || null,
    // Legacy fields (backward compatibility)
    activationId: kehrnel.activationId || null,
    endpoint: kehrnel.endpoint || null,
    endpointName: kehrnel.endpointName || null,
  };
}

/**
 * Sanitize environment-level Kehrnel config
 * Extended to support connectionId and envKey
 */
function sanitizeKehrnelConfig(config = null) {
  const defaultKehrnelUrl = getPublicKehrnelBaseUrl();
  
  if (!config) return { useDefault: true, apiUrl: defaultKehrnelUrl, connectionId: null, envKey: null };
  
  // If useDefault is true, use the default Kehrnel URL
  const apiUrl = config.useDefault !== false ? defaultKehrnelUrl : (config.apiUrl || '');
  
  return {
    useDefault: config.useDefault !== false,
    apiUrl,
    // New fields for Kehrnel integration
    connectionId: config.connectionId || null, // Reference to kehrnel_instances._id
    envKey: config.envKey || null, // Environment identifier for Kehrnel
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

async function loadScope(coreDb, email) {
  const normalizedEmail = normalizeEmail(email);
  const user = await coreDb.collection('users').findOne({ email: normalizedEmail });
  if (!user) throw new Error('User not found');
  if (user.teamId && (user.accountType === 'team' || user.accountType === 'demo')) {
    const team = await coreDb.collection('teams').findOne({ _id: user.teamId });
    const requester = (team?.members || []).find((member) => normalizeEmail(member.email) === normalizedEmail);
    return { mode: 'team', user, team, requesterRole: requester?.role || null };
  }
  return { mode: 'individual', user, team: null, requesterRole: 'owner' };
}

// GET -> list sanitized environments for current user/team
export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();
    const { mode, user, team, requesterRole } = await loadScope(coreDb, session.user.email);
    if (mode === 'team' && !requesterRole) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const envs = mode === 'team' ? (team?.environments || []) : (user?.environments || []);
    return NextResponse.json({ environments: sanitizeEnvironments(envs) });
  } catch (error) {
    console.error('GET /api/environments error:', error);
    return NextResponse.json({ error: 'Failed to fetch environments' }, { status: 500 });
  }
}

// POST -> upsert sanitized summary (no connection strings here)
export async function POST(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();
    const { mode, user, team, requesterRole } = await loadScope(coreDb, session.user.email);
    if (mode === 'team' && !requesterRole) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (mode === 'team' && !isAdminRole(requesterRole)) {
      return NextResponse.json({ error: 'Only admins can modify environments' }, { status: 403 });
    }
    const data = await req.json();

    if (!data.name || !data.database) {
      return NextResponse.json({ error: 'name and database are required' }, { status: 400 });
    }

    const targetCol = mode === 'team' ? coreDb.collection('teams') : coreDb.collection('users');
    const filter = mode === 'team' ? { _id: user.teamId } : { _id: user._id };
    const holder = mode === 'team' ? (team || {}) : (user || {});
    const list = Array.isArray(holder.environments) ? [...holder.environments] : [];

    const nowIso = new Date().toISOString();
    const envId = data.id || `env-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const summary = {
      id: envId,
      name: data.name,
      description: data.description || '',
      database: data.database,
      domainDatabases: sanitizeDomainDatabases(data.domainDatabases),
      isActive: !!data.isActive,
      createdAt: data.createdAt || nowIso,
      updatedAt: nowIso,
      strategyLinks: normalizeStrategyLinks(data.strategyLinks || []),
      kehrnel: sanitizeKehrnelConfig(data.kehrnel),
    };

    const idx = list.findIndex(e => e.id === envId);
    if (idx >= 0) list[idx] = { ...list[idx], ...summary };
    else list.push(summary);

    if (summary.isActive) {
      for (const e of list) e.isActive = e.id === envId;
    } else if (!list.some(e => e.isActive) && list.length) {
      list[0].isActive = true;
    }

    await targetCol.updateOne(filter, { $set: { environments: list } });
    return NextResponse.json({ success: true, environment: summary });
  } catch (error) {
    console.error('POST /api/environments error:', error);
    return NextResponse.json({ error: 'Failed to save environment' }, { status: 500 });
  }
}

// DELETE -> remove summary and its encrypted secret
export async function DELETE(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();
    const { mode, user, team, requesterRole } = await loadScope(coreDb, session.user.email);
    if (mode === 'team' && !requesterRole) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (mode === 'team' && !isAdminRole(requesterRole)) {
      return NextResponse.json({ error: 'Only admins can delete environments' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'env id is required' }, { status: 400 });

    const targetCol = mode === 'team' ? coreDb.collection('teams') : coreDb.collection('users');
    const filter = mode === 'team' ? { _id: user.teamId } : { _id: user._id };
    const holder = mode === 'team' ? (team || {}) : (user || {});
    const list = Array.isArray(holder.environments) ? [...holder.environments] : [];

    const next = list.filter(e => e.id !== id);
    await targetCol.updateOne(filter, { $set: { environments: next } });

    await deleteEnvironmentSecretDoc(coreDb, { mode, user, team }, id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/environments error:', error);
    return NextResponse.json({ error: 'Failed to delete environment' }, { status: 500 });
  }
}
