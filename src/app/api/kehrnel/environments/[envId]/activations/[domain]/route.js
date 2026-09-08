import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/kehrnel/environments/[envId]/activations/[domain]/route.js
import { NextResponse } from 'next/server';
import { isTestModeBypassEnabled } from '@/lib/security/testMode';
import { getCoreDb } from '../../../../../../../lib/db/coreDb.js';
import { requireAccessibleEnvironment } from '../../../../../../../lib/environments/requireEnvironmentAccess.js';
import { createKehrnelService } from '../../../../../../../lib/kehrnel/KehrnelService.js';
import { safeUpstreamError } from '../../../../../../../lib/security/api.js';
import { enforceEnvironmentControl, ENV_CONTROL_CAPABILITY } from '../../../../../../../lib/security/environmentControls.js';

export const dynamic = 'force-dynamic';

/**
 * Load user/team scope to find the right collection and document
 */
async function loadScope(coreDb, email) {
  const user = await coreDb.collection('users').findOne({ email });
  if (!user) throw new Error('User not found');
  if (user.teamId && (user.accountType === 'team' || user.accountType === 'demo')) {
    const team = await coreDb.collection('teams').findOne({ _id: user.teamId });
    return { mode: 'team', user, team };
  }
  return { mode: 'individual', user, team: null };
}

/**
 * DELETE - Deactivate a strategy for a domain
 * Also removes the strategyLink from MongoDB to keep HDL in sync with Kehrnel
 */
export async function DELETE(req, props) {
  const params = await props.params;
  try {
    let session = { user: { email: 'test@example.com' } };
    if (!isTestModeBypassEnabled()) {
      const auth = await requireAuthenticatedUser();
      if (!auth.ok) return auth.response;
      session = auth.session;
    }

    const { envId, domain } = params;
    if (!envId || !domain) {
      return NextResponse.json({ error: 'envId and domain are required' }, { status: 400 });
    }
    const requestId = req.headers.get('x-request-id') || req.headers.get('request-id') || null;

    const db = await getCoreDb();
    if (!isTestModeBypassEnabled()) {
      const access = await requireAccessibleEnvironment(db, session?.user?.email, envId);
      if (!access.ok) return access.response;
    }
    const envGate = await enforceEnvironmentControl(db, envId, ENV_CONTROL_CAPABILITY.OPS, {
      route: 'api/kehrnel/environments/activations/delete'
    });
    if (envGate) return envGate;

    const service = createKehrnelService(db);
    let targetCol = null;
    let filter = null;
    let environments = [];
    let envIdx = -1;
    let env = null;

    try {
      const { mode, user, team } = await loadScope(db, session.user.email);
      targetCol = mode === 'team' ? db.collection('teams') : db.collection('users');
      filter = mode === 'team' ? { _id: user.teamId } : { _id: user._id };
      const holder = mode === 'team' ? (team || {}) : (user || {});
      environments = Array.isArray(holder.environments) ? [...holder.environments] : [];
      envIdx = environments.findIndex((item) => item.id === envId);
      env = envIdx >= 0 ? environments[envIdx] : null;
    } catch (scopeError) {
      if (!isTestModeBypassEnabled()) {
        throw scopeError;
      }
    }

    const envKehrnel = env?.kehrnel || {};
    const envKey = envKehrnel.envKey || envId;

    // Try to delete from Kehrnel (may fail if already deleted or never existed)
    let kehrnelResult = null;
    let kehrnelError = null;
    try {
      kehrnelResult = await service.deleteActivation(envKey, domain, {
        requestId,
        connectionId: envKehrnel.connectionId || null,
        envKehrnel,
      });
    } catch (err) {
      // Store the error but continue - we still want to clean up MongoDB
      kehrnelError = err;
      console.warn(`Kehrnel deleteActivation warning: ${err.message}`);
    }

    // Always remove the strategyLink from MongoDB (users or teams collection)
    // This keeps HDL in sync even if Kehrnel had no activation
    if (targetCol && filter && envIdx >= 0) {
      const strategyLinks = Array.isArray(env.strategyLinks) ? [...env.strategyLinks] : [];

      // Remove the link for this domain (case-insensitive match)
      // Handle cases where domain might be undefined - extract from link.id as fallback
      const normalizedDomain = domain.toLowerCase();
      const updatedLinks = strategyLinks.filter(link => {
        // Try multiple ways to identify the domain
        const linkDomain = link.domain?.toLowerCase()
          || link.kehrnel?.domain?.toLowerCase()
          // Extract from id pattern: link-{domain}-{timestamp}
          || (link.id?.startsWith('link-') ? link.id.split('-')[1]?.toLowerCase() : null);

        return linkDomain !== normalizedDomain;
      });

      const updatedAt = new Date();

      // Save back to MongoDB without rewriting the full environments array.
      await targetCol.updateOne(
        {
          ...filter,
          'environments.id': envId,
        },
        {
          $set: {
            'environments.$.strategyLinks': updatedLinks,
            'environments.$.updatedAt': updatedAt.toISOString(),
            updatedAt,
          }
        }
      );
    }

    // Audit log
    try {
      const collection = db?.collection ? db.collection('audit_events') : null;
      if (collection?.insertOne) {
        await collection.insertOne({
          type: 'activation',
          action: 'delete',
          envId,
          domain,
          user: session.user?.email || 'system',
          createdAt: new Date().toISOString(),
          requestId,
          kehrnelResult,
          kehrnelError: kehrnelError?.message || null,
          mongoUpdated: !!(targetCol && envIdx >= 0)
        });
      }
    } catch (err) {
      console.warn('audit log failed (delete)', err.message);
    }

    // Return success even if Kehrnel had no activation
    // The important thing is that MongoDB is now clean
    return NextResponse.json({
      ok: true,
      message: `Strategy deactivated for ${domain}`,
      kehrnelResult,
      kehrnelError: kehrnelError?.message || null
    });
  } catch (error) {
    return safeUpstreamError(error, 'Delete activation failed');
  }
}
