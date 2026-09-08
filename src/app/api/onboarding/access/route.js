import { NextResponse } from 'next/server';
import { requireRelaxedAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';
import { getCoreDb } from '@/lib/db/coreDb';
import { evaluateOnboardingAccess } from '@/lib/security/onboardingAccess';
import { getClientIpFromHeaders } from '@/lib/security/clientIp';
import { logActivity, ActivityType } from '@/lib/db/activityLog';

function teamAllowsDirectJoin(team) {
  return team?.onboarding?.allowDirectJoin === true || team?.joinPolicy === 'open';
}

export async function GET(request) {
  try {
    const auth = await requireRelaxedAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const db = await getCoreDb();
    const email = auth.session.user.email;
    const requestedTeamSlug = request.nextUrl.searchParams.get('team') || null;
    const clientIp = getClientIpFromHeaders(request.headers);
    const evaluation = await evaluateOnboardingAccess(db, email, requestedTeamSlug, clientIp);

    let suggestedTeam = null;
    if (evaluation.teamSlug) {
      const team = await db.collection('teams').findOne(
        { slug: evaluation.teamSlug },
        { projection: { _id: 1, name: 1, slug: 1, onboarding: 1, joinPolicy: 1 } }
      );
      if (team) {
        suggestedTeam = {
          id: team._id.toString(),
          name: team.name,
          slug: team.slug,
          allowsDirectJoin: teamAllowsDirectJoin(team)
        };
      }
    }

    // Audit: record allow/deny decisions server-side (not shown to end users).
    // This endpoint is called early in the boot flow, so it's a good single place
    // to capture access decisions without logging every API call.
    logActivity({
      type: ActivityType.ONBOARDING_ACCESS,
      userId: email,
      email,
      name: auth.session.user.name || null,
      ip: clientIp || null,
      userAgent: request.headers.get('user-agent') || null,
      success: evaluation.access === 'allowed',
      metadata: {
        decision: evaluation.access,
        access: evaluation.access,
        allowlisted: evaluation.allowlisted === true,
        emailAllowlisted: evaluation.emailAllowlisted === true,
        ipAllowlisted: evaluation.ipAllowlisted === true,
        effectiveMode: evaluation.effectiveMode || null,
        deploymentMode: evaluation.deploymentMode || null,
        policyMode: evaluation.policy?.mode || null,
        requestedTeamSlug
      }
    }).catch(() => {});

    return NextResponse.json({
      email,
      access: evaluation.access,
      policy: evaluation.policy,
      portalState: evaluation.portalState,
      deploymentMode: evaluation.deploymentMode,
      effectiveMode: evaluation.effectiveMode,
      allowlisted: evaluation.allowlisted,
      emailAllowlisted: evaluation.emailAllowlisted,
      ipAllowlisted: evaluation.ipAllowlisted,
      clientIp: evaluation.clientIp,
      userAccessStatus: evaluation.userAccessStatus,
      userAccessReason: evaluation.userAccessReason,
      latestRequest: evaluation.latestRequest,
      suggestedTeam
    });
  } catch (error) {
    console.error('GET /api/onboarding/access error:', error);
    return safeErrorResponse(error, 'Failed to evaluate onboarding access');
  }
}
