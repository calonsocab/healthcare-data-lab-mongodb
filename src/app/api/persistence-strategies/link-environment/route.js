import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/persistence-strategies/link-environment/route.js
/**
 * Link Strategy to Environment - Kehrnel-sourced
 *
 * Links a Kehrnel strategy to an environment.
 * Strategy definitions come from Kehrnel.
 *
 * NOTE: Consider using PUT /api/environments/strategy instead,
 * which also handles Kehrnel activation.
 */
import { getCoreDb } from '@/lib/db/coreDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';

function buildUserContext(session, userDoc) {
  return {
    email: session.user.email,
    userId: userDoc?._id?.toString() || session.user.id || session.user.email,
    teamId: userDoc?.teamId ? userDoc.teamId.toString() : null,
  };
}

function normalizeStrategyLink({ strategyId, strategyName, domain = 'openEHR' }) {
  return {
    id: `link-${domain.toLowerCase()}-${Date.now()}`,
    domain,
    strategyId,
    strategyName: strategyName || strategyId,
    alias: strategyName || strategyId,
    contexts: { synthetic: true, query: true, api: true },
    apiBasePath: '',
    endpointId: null,
    notes: ''
  };
}

export async function PUT(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();
    const { strategyId, envId, domain = 'openEHR' } = body || {};

    if (!envId) {
      return Response.json({ error: 'envId is required' }, { status: 400 });
    }
    if (!strategyId || typeof strategyId !== 'string') {
      return Response.json({ error: 'strategyId is required' }, { status: 400 });
    }

    const db = await getCoreDb();
    const service = createKehrnelService(db);

    // Fetch strategy from Kehrnel
    let manifest = null;
    try {
      manifest = await service.getStrategy(strategyId);
    } catch (err) {
      if (err.status === 404) {
        // Try listing and finding by ID
        const result = await service.listStrategies();
        const strategies = result.strategies || [];
        manifest = strategies.find(s =>
          s.id === strategyId ||
          s.strategy_id === strategyId ||
          s.name === strategyId
        );
      }
    }

    if (!manifest) {
      return Response.json({ error: 'Strategy not found in Kehrnel' }, { status: 404 });
    }

    const userDoc = await db.collection('users').findOne({ email: session.user.email });
    if (!userDoc) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const isTeam = userDoc.teamId && userDoc.accountType === 'team';
    const holder = isTeam
      ? await db.collection('teams').findOne({ _id: userDoc.teamId })
      : userDoc;
    const envs = Array.isArray(holder?.environments) ? [...holder.environments] : [];
    const idx = envs.findIndex(e => e.id === envId);
    if (idx < 0) {
      return Response.json({ error: 'Environment not found' }, { status: 404 });
    }

    const strategyName = manifest.name || manifest.display_name || strategyId;
    const newLink = normalizeStrategyLink({ strategyId, strategyName, domain });

    // Replace or add the link for this domain
    const existingLinks = envs[idx].strategyLinks || [];
    const existingIdx = existingLinks.findIndex(l => l.domain === domain);
    if (existingIdx >= 0) {
      existingLinks[existingIdx] = newLink;
    } else {
      existingLinks.push(newLink);
    }

    const updatedEnv = {
      ...envs[idx],
      updatedAt: new Date().toISOString(),
      strategyLinks: existingLinks
    };
    envs[idx] = updatedEnv;

    const targetCol = isTeam ? db.collection('teams') : db.collection('users');
    const filter = isTeam ? { _id: userDoc.teamId } : { _id: userDoc._id };
    await targetCol.updateOne(filter, { $set: { environments: envs } });

    return Response.json({
      strategy: {
        _id: strategyId,
        id: strategyId,
        name: strategyName,
        source: 'kehrnel'
      },
      environment: { id: updatedEnv.id, name: updatedEnv.name, strategyLinks: updatedEnv.strategyLinks }
    });
  } catch (error) {
    console.error('PUT /api/persistence-strategies/link-environment error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
