import test from 'node:test';
import assert from 'node:assert/strict';

import { buildTeamVisibilityPayload, getTeamViewerAccess } from '../src/lib/teams/teamVisibility.js';

const sampleTeam = {
  inviteCode: 'ABC123',
  members: [
    { name: 'Ada Admin', email: 'ada@example.com', role: 'owner' },
    { name: 'Bea Boss', email: 'bea@example.com', role: 'admin' },
    { name: 'Max Member', email: 'max@example.com', role: 'member' },
    { name: 'Vic Viewer', email: 'vic@example.com', role: 'viewer' }
  ],
  pendingInvites: [
    { _id: 'invite-1', email: 'pending@example.com', status: 'pending' }
  ]
};

test('non-admin viewers receive only a team summary payload', () => {
  const access = getTeamViewerAccess(sampleTeam, 'vic@example.com');
  const visibility = buildTeamVisibilityPayload(sampleTeam, 'vic@example.com');

  assert.equal(access.currentUserRole, 'viewer');
  assert.equal(access.isAdmin, false);
  assert.equal(access.memberCount, 4);
  assert.deepEqual(access.adminContacts, [
    { name: 'Ada Admin', role: 'owner' },
    { name: 'Bea Boss', role: 'admin' }
  ]);

  assert.equal(visibility.membersVisible, false);
  assert.equal(visibility.memberCount, 4);
  assert.equal(visibility.inviteCode, '');
  assert.deepEqual(visibility.members, []);
  assert.deepEqual(visibility.pendingInvites, []);
  assert.deepEqual(visibility.adminContacts, access.adminContacts);
});

test('admins keep full member visibility and invite-management data', () => {
  const access = getTeamViewerAccess(sampleTeam, 'bea@example.com');
  const visibility = buildTeamVisibilityPayload(sampleTeam, 'bea@example.com');

  assert.equal(access.currentUserRole, 'admin');
  assert.equal(access.isAdmin, true);
  assert.equal(visibility.membersVisible, true);
  assert.equal(visibility.inviteCode, 'ABC123');
  assert.equal(visibility.members.length, 4);
  assert.equal(visibility.pendingInvites.length, 1);
  assert.deepEqual(visibility.adminContacts, [
    { name: 'Ada Admin', role: 'owner' },
    { name: 'Bea Boss', role: 'admin' }
  ]);
});
