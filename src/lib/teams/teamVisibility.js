function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

function normalizeRole(value = '') {
  return String(value || '').trim().toLowerCase();
}

function displayMemberName(member = {}) {
  const name = String(member?.name || '').trim();
  if (name) return name;

  const email = String(member?.email || '').trim();
  if (email) return email.split('@')[0];

  return 'Team administrator';
}

export function getTeamViewerAccess(team = {}, viewerEmail = '') {
  const members = Array.isArray(team?.members) ? team.members : [];
  const normalizedViewer = normalizeEmail(viewerEmail);
  const currentMember = members.find(
    (member) => normalizeEmail(member?.email) === normalizedViewer
  ) || null;

  const currentUserRole = normalizeRole(
    currentMember?.role ||
    team?.currentUserRole ||
    team?.userRole ||
    'member'
  ) || 'member';

  const isAdmin = currentUserRole === 'owner' || currentUserRole === 'admin';
  const seenAdminKeys = new Set();
  const adminContacts = members
    .filter((member) => {
      const role = normalizeRole(member?.role);
      return role === 'owner' || role === 'admin';
    })
    .map((member) => {
      const role = normalizeRole(member?.role) || 'admin';
      return {
        name: displayMemberName(member),
        role
      };
    })
    .filter((contact) => {
      const key = `${contact.role}:${contact.name.toLowerCase()}`;
      if (seenAdminKeys.has(key)) return false;
      seenAdminKeys.add(key);
      return true;
    });

  return {
    currentMember,
    currentUserRole,
    isAdmin,
    memberCount: members.length,
    adminContacts
  };
}

export function buildTeamVisibilityPayload(team = {}, viewerEmail = '') {
  const access = getTeamViewerAccess(team, viewerEmail);
  return {
    currentUserRole: access.currentUserRole,
    membersVisible: access.isAdmin,
    memberCount: access.memberCount,
    adminContacts: access.adminContacts,
    inviteCode: access.isAdmin ? (team?.inviteCode || '') : '',
    members: access.isAdmin ? (Array.isArray(team?.members) ? team.members : []) : [],
    pendingInvites: access.isAdmin ? (Array.isArray(team?.pendingInvites) ? team.pendingInvites : []) : []
  };
}
