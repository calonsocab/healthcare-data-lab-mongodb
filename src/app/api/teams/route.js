import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/teams/route.js
import { getCoreDb } from '@/lib/db/coreDb';
import { sealSecret } from '@/lib/crypto/secrets.mjs';
import {
  getConnectionValidationMessage,
  getEnvironmentSaveErrorMessage,
  validateMongoEnvironmentConnection
} from '@/lib/db/environmentConnectionValidation';
import { normalizeStrategyLinks } from '@/lib/environments/normalizeStrategyLinks';
import { sanitizeDomainDatabases } from '@/lib/environments/domainDatabases';
import { listEnvironmentSecretDocs } from '@/lib/environments/secretScope';
import { syncEnvironmentSecrets } from '@/lib/environments/syncSecrets';
import { normalizeTeamPolicy } from '@/lib/security/teamPolicy';
import { buildTeamVisibilityPayload, getTeamViewerAccess } from '@/lib/teams/teamVisibility';
import { ObjectId } from 'mongodb';
import { parseJsonWithLimit, PayloadTooLargeError } from '@/lib/uploads/bodyLimit';

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_TEAM_JSON_BYTES = 7 * 1024 * 1024; // supports 2x 2MB images + base64 overhead
const ALLOWED_LOGO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
]);

function getBase64ByteLength(base64 = '') {
  const sanitized = base64.replace(/\s+/g, '');
  const padding = sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0;
  return Math.floor((sanitized.length * 3) / 4) - padding;
}

function validateLogoDataUrl(value, fieldName) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return `${fieldName} must be a base64 data URL string`;
  if (!value.startsWith('data:')) return `${fieldName} must be a base64 data URL string`;

  const match = value.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return `${fieldName} is not a valid base64 data URL`;

  const mimeType = match[1]?.toLowerCase();
  const base64Payload = match[2] || '';

  if (!ALLOWED_LOGO_MIME_TYPES.has(mimeType)) {
    return `${fieldName} must be a JPEG, PNG, GIF, WebP, or SVG image`;
  }

  const bytes = getBase64ByteLength(base64Payload);
  if (bytes > MAX_LOGO_BYTES) {
    return `${fieldName} exceeds ${Math.round(MAX_LOGO_BYTES / 1024 / 1024)}MB limit`;
  }

  return null;
}

function randomId(prefix) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${rand}-${Date.now()}`;
}

function sanitizeKehrnelConfig(config = null) {
  if (!config) return { useDefault: true, apiUrl: '', connectionId: null, envKey: null };
  return {
    useDefault: config.useDefault !== false,
    apiUrl: config.apiUrl || '',
    connectionId: config.connectionId || null,
    envKey: config.envKey || null
  };
}

function toEnvDoc(e) {
  const trimmedConnection = typeof e.connectionString === 'string' ? e.connectionString.trim() : '';
  const sealed = trimmedConnection ? sealSecret(trimmedConnection) : e.sealedUri;
  return {
    id: e.id || randomId('env'),
    name: e.name,
    description: e.description || '',
    database: e.database,
    domainDatabases: sanitizeDomainDatabases(e.domainDatabases),
    isActive: !!e.isActive,
    createdAt: e.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    strategyLinks: normalizeStrategyLinks(e.strategyLinks || []),
    kehrnel: sanitizeKehrnelConfig(e.kehrnel),
    ...(sealed ? { sealedUri: sealed } : {})
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

function normalizeActive(list) {
  if (!list.length) return list;
  // if none active, make first active; if multiple active, keep the first active only
  const firstActiveIdx = list.findIndex(e => e.isActive);
  if (firstActiveIdx === -1) list[0].isActive = true;
  else {
    list = list.map((e, i) => ({ ...e, isActive: i === firstActiveIdx }));
  }
  return list;
}

function toTeamQuery(teamId) {
  if (typeof teamId === 'string' && ObjectId.isValid(teamId)) {
    return { _id: new ObjectId(teamId) };
  }
  return { _id: teamId };
}

function normalizeSlug(slug) {
  if (!slug) return null;
  const value = String(slug).trim().toLowerCase();
  return value || null;
}

function normalizeJoinPolicy(joinPolicy) {
  return joinPolicy === 'open' ? 'open' : 'invite_only';
}

function normalizeOnboarding(onboarding = null) {
  return {
    allowDirectJoin: onboarding?.allowDirectJoin === true
  };
}

async function validateEnvironmentInputs(coreDb, ownerScope, environments = [], existingById = new Map()) {
  const envIds = environments.map((env) => env.id).filter(Boolean);
  const existingSecretDocs = envIds.length > 0
    ? await listEnvironmentSecretDocs(coreDb, ownerScope, envIds, {
      projection: { envId: 1, sealedUri: 1 }
    })
    : [];
  const existingSecretByEnvId = new Map(existingSecretDocs.map((doc) => [doc.envId, doc]));

  for (const env of environments) {
    const prev = env.id ? existingById.get(env.id) : null;
    const id = env.id || null;
    const name = env.name ?? prev?.name ?? id ?? 'environment';
    const database = env.database ?? prev?.database ?? '';
    const trimmedConnection = typeof env.connectionString === 'string' ? env.connectionString.trim() : '';
    const hasStoredSecret = !!(env.sealedUri || prev?.sealedUri || (id && existingSecretByEnvId.get(id)?.sealedUri));

    if (!trimmedConnection && !hasStoredSecret) {
      return {
        ok: false,
        error: getEnvironmentSaveErrorMessage(name, 'connection string is required before saving')
      };
    }

    if (!trimmedConnection) continue;

    try {
      await validateMongoEnvironmentConnection({
        connectionString: trimmedConnection,
        database
      });
    } catch (error) {
      return {
        ok: false,
        error: getEnvironmentSaveErrorMessage(name, getConnectionValidationMessage(database, error))
      };
    }
  }

  return { ok: true };
}

// GET /api/teams - Get user's team (sanitized)
export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const db = await getCoreDb();
    const user = await db.collection('users').findOne({ email: session.user.email });

    if (!user?.teamId) {
      return Response.json(null);
    }

    // Handle both ObjectId and string formats for teamId
    const teamQuery = toTeamQuery(user.teamId);

    const team = await db.collection('teams').findOne(teamQuery);
    if (!team) {
      // Clean up orphaned teamId
      await db.collection('users').updateOne(
        { email: session.user.email },
        { $unset: { teamId: '' } }
      );
      return Response.json(null);
    }

    const access = getTeamViewerAccess(team, session.user.email);
    const visibility = buildTeamVisibilityPayload(team, session.user.email);

    const safeTeam = {
      _id: team._id,
      name: team.name,
      slug: normalizeSlug(team.slug),
      joinPolicy: normalizeJoinPolicy(team.joinPolicy),
      onboarding: normalizeOnboarding(team.onboarding),
      logo: team.logo || null,
      logoIcon: team.logoIcon || null,
      theme: team.theme || null,
      policy: normalizeTeamPolicy(team.policy),
      environments: sanitizeEnvironments(team.environments || []),
      inviteCode: visibility.inviteCode,
      members: visibility.members,
      pendingInvites: visibility.pendingInvites,
      currentUserRole: access.currentUserRole,
      memberCount: access.memberCount,
      adminContacts: access.adminContacts,
      membersVisible: visibility.membersVisible,
      syntheticDataPreviewOnly: team.syntheticDataPreviewOnly === true || team.syntheticDataPreviewOnly === 'true',
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };

    return Response.json(safeTeam);
  } catch (error) {
    console.error('GET /api/teams error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Default theme for new teams (MongoDB Healthcare Data Lab)
const DEFAULT_TEAM_THEME = {
  name: "Dark Mode",
  primary: "#01ec63",
  primaryHover: "#01694a",
  background: "#011e2b",
  surface: "#053e3a",
  surfaceHover: "#011e2b",
  border: "#334155",
  text: "#F1F5F9",
  textSecondary: "#e7ff98",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444"
};

// POST /api/teams - Create new team (sanitize environments; secrets set via /api/environments/secure)
export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await parseJsonWithLimit(request, MAX_TEAM_JSON_BYTES);
    const db = await getCoreDb();

    // Generate unique invite code
    let inviteCode;
    while (true) {
      inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const exists = await db.collection('teams').findOne({ inviteCode });
      if (!exists) break;
    }

    // Sanitize environments (NO connectionString)
    const validation = await validateEnvironmentInputs(db, body.environments || []);
    if (!validation.ok) {
      return Response.json({ error: validation.error }, { status: 400 });
    }

    let envs = (body.environments || []).map(toEnvDoc);
    envs = normalizeActive(envs);

    const ownerEmail = session.user.email;
    const team = {
      name: body.name,
      slug: normalizeSlug(body.slug),
      joinPolicy: normalizeJoinPolicy(body.joinPolicy),
      onboarding: normalizeOnboarding(body.onboarding),
      logo: body.logo || null,
      logoIcon: body.logoIcon || null,
      theme: body.theme || DEFAULT_TEAM_THEME,
      policy: normalizeTeamPolicy(body.policy),
      environments: envs,
      inviteCode,
      ownerUserId: session.user.id,
      members: [{
        userId: session.user.id,
        email: ownerEmail,
        name: session.user.name || '',
        role: 'owner',
        joinedAt: new Date()
      }],
      pendingInvites: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Logo validation (body can include base64 data URLs)
    {
      const err = validateLogoDataUrl(team.logo, 'logo') || validateLogoDataUrl(team.logoIcon, 'logoIcon');
      if (err) return Response.json({ error: err }, { status: 400 });
    }

    if (team.slug) {
      const existingSlug = await db.collection('teams').findOne({ slug: team.slug }, { projection: { _id: 1 } });
      if (existingSlug) {
        return Response.json({ error: 'Team slug already exists' }, { status: 409 });
      }
    }

    const result = await db.collection('teams').insertOne(team);
    team._id = result.insertedId;

    await syncEnvironmentSecrets(db, { mode: 'team', team }, team.environments || [], []);

    // Link user to team & switch to team account type
    // Note: We no longer delete individual settings so users can switch back
    await db.collection('users').updateOne(
      { email: session.user.email },
      {
        $set: { teamId: team._id, accountType: 'team', updatedAt: new Date() },
        $setOnInsert: {
          createdAt: new Date(),
          email: session.user.email,
          name: session.user.name || ''
        }
      },
      { upsert: true }
    );

    // Return sanitized team
    const access = getTeamViewerAccess(team, session.user.email);
    const visibility = buildTeamVisibilityPayload(team, session.user.email);
    const safeTeam = {
      _id: team._id,
      name: team.name,
      slug: normalizeSlug(team.slug),
      joinPolicy: normalizeJoinPolicy(team.joinPolicy),
      onboarding: normalizeOnboarding(team.onboarding),
      logo: team.logo,
      logoIcon: team.logoIcon,
      theme: team.theme,
      policy: normalizeTeamPolicy(team.policy),
      environments: team.environments,
      inviteCode: visibility.inviteCode,
      members: visibility.members,
      pendingInvites: visibility.pendingInvites,
      currentUserRole: access.currentUserRole,
      memberCount: access.memberCount,
      adminContacts: access.adminContacts,
      membersVisible: visibility.membersVisible,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };

    return Response.json(safeTeam);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return Response.json({ error: 'Request body too large' }, { status: 413 });
    }
    console.error('POST /api/teams error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/teams - Update team (sanitize environments; never accept connection strings here)
export async function PUT(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const updates = await parseJsonWithLimit(request, MAX_TEAM_JSON_BYTES);
    const db = await getCoreDb();

    // Get user & team
    const user = await db.collection('users').findOne({ email: session.user.email });

    // If user doesn’t belong to a team, allow updating their own prefs (theme/environments) as a convenience.
    if (!user?.teamId) {
      if (user?.accountType === 'individual') {
        const patch = { updatedAt: new Date() };
        if (updates.theme !== undefined) patch.theme = updates.theme;
        if (Array.isArray(updates.environments)) {
          let envs = sanitizeEnvironments(updates.environments);
          envs = normalizeActive(envs);
          patch.environments = envs;
        }
        await db.collection('users').updateOne({ email: session.user.email }, { $set: patch });
        const updatedUser = await db.collection('users').findOne({ email: session.user.email });
        return Response.json({
          theme: updatedUser.theme || null,
          environments: sanitizeEnvironments(updatedUser.environments || []),
        });
      }
      return Response.json({ error: 'User does not belong to a team' }, { status: 400 });
    }

    // Load current team so we can merge & preserve sealedUri
    const currentTeam = await db.collection('teams').findOne(toTeamQuery(user.teamId));
    if (!currentTeam) {
      return Response.json({ error: 'Team not found' }, { status: 404 });
    }

    // Check if user is admin/owner before allowing updates
    const requester = (currentTeam.members || []).find(
      m => m.email?.toLowerCase() === session.user.email.toLowerCase()
    );
    if (!requester) {
      return Response.json({ error: 'Not a team member' }, { status: 403 });
    }

    const isAdmin = requester.role === 'owner' || requester.role === 'admin';
    if (!isAdmin) {
      return Response.json({ error: 'Only admins can update team settings' }, { status: 403 });
    }

    const existingById = new Map(
      (currentTeam?.environments || []).map(e => [e.id, e])
    );
    const previousEnvironments = Array.isArray(currentTeam?.environments) ? currentTeam.environments : [];

    if (Array.isArray(updates.environments)) {
      const validation = await validateEnvironmentInputs(
        db,
        { mode: 'team', user, team: currentTeam },
        updates.environments || [],
        existingById
      );
      if (!validation.ok) {
        return Response.json({ error: validation.error }, { status: 400 });
      }
    }

    // Team update
    const allowed = ['name', 'logo', 'logoIcon', 'theme', 'environments', 'syntheticDataPreviewOnly', 'policy', 'slug', 'joinPolicy', 'onboarding'];
    const patch = { updatedAt: new Date() };
    for (const k of allowed) {
      if (updates[k] === undefined) continue;

      if (k !== 'environments') {
        if (k === 'logo' || k === 'logoIcon') {
          const error = validateLogoDataUrl(updates[k], k);
          if (error) {
            return Response.json({ error }, { status: 400 });
          }
        }
        if (k === 'policy') {
          patch[k] = normalizeTeamPolicy(updates[k]);
        } else if (k === 'slug') {
          patch[k] = normalizeSlug(updates[k]);
        } else if (k === 'joinPolicy') {
          patch[k] = normalizeJoinPolicy(updates[k]);
        } else if (k === 'onboarding') {
          patch[k] = normalizeOnboarding(updates[k]);
        } else {
          patch[k] = updates[k];
        }
        continue;
      }

      // Build new env list with sealing + preservation
      const nowIso = new Date().toISOString();
      let nextEnvs = (updates.environments || []).map(e => {
        const prev = e.id ? existingById.get(e.id) : null;
        const id = e.id || randomId('env');

        // If a new connectionString is supplied, seal it; else keep previous sealedUri
        const sealed =
          (typeof e.connectionString === 'string' && e.connectionString.trim()) ? sealSecret(e.connectionString.trim())
            : (e.sealedUri ?? prev?.sealedUri); // client never needs to send sealedUri, but allow it

        return {
          id,
          name: e.name ?? prev?.name ?? '',
          description: e.description ?? prev?.description ?? '',
          database: e.database ?? prev?.database ?? '',
          domainDatabases: sanitizeDomainDatabases(e.domainDatabases ?? prev?.domainDatabases),
          isActive: !!(e.isActive ?? prev?.isActive),
          createdAt: prev?.createdAt || e.createdAt || nowIso,
          updatedAt: nowIso,
          strategyLinks: normalizeStrategyLinks(e.strategyLinks || prev?.strategyLinks || []),
          kehrnel: sanitizeKehrnelConfig(e.kehrnel ?? prev?.kehrnel),
          ...(sealed ? { sealedUri: sealed } : {})
        };
      });

      // Ensure exactly one active
      nextEnvs = normalizeActive(nextEnvs);
      patch.environments = nextEnvs;
    }

    if (patch.slug) {
      const existingSlug = await db.collection('teams').findOne({
        slug: patch.slug,
        _id: { $ne: currentTeam._id }
      }, { projection: { _id: 1 } });
      if (existingSlug) {
        return Response.json({ error: 'Team slug already exists' }, { status: 409 });
      }
    }

    await db.collection('teams').updateOne(toTeamQuery(user.teamId), { $set: patch });

    if (Array.isArray(patch.environments)) {
      await syncEnvironmentSecrets(
        db,
        { mode: 'team', user, team: currentTeam },
        patch.environments,
        previousEnvironments
      );
    }

    const team = await db.collection('teams').findOne(toTeamQuery(user.teamId));
    const access = getTeamViewerAccess(team, session.user.email);
    const visibility = buildTeamVisibilityPayload(team, session.user.email);
    const safeTeam = {
      _id: team._id,
      name: team.name,
      slug: normalizeSlug(team.slug),
      joinPolicy: normalizeJoinPolicy(team.joinPolicy),
      onboarding: normalizeOnboarding(team.onboarding),
      logo: team.logo || null,
      logoIcon: team.logoIcon || null,
      theme: team.theme || null,
      policy: normalizeTeamPolicy(team.policy),
      environments: sanitizeEnvironments(team.environments || []),
      inviteCode: visibility.inviteCode,
      members: visibility.members,
      pendingInvites: visibility.pendingInvites,
      currentUserRole: access.currentUserRole,
      memberCount: access.memberCount,
      adminContacts: access.adminContacts,
      membersVisible: visibility.membersVisible,
      syntheticDataPreviewOnly: team.syntheticDataPreviewOnly === true || team.syntheticDataPreviewOnly === 'true',
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };

    return Response.json(safeTeam);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return Response.json({ error: 'Request body too large' }, { status: 413 });
    }
    console.error('PUT /api/teams error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
