// src/components/views/settings/TeamManagement.jsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Mail, XCircle, Users, Copy, Check } from 'lucide-react';

const POLICY_FIELDS = [
  {
    key: 'maxDataModels',
    label: 'Max data models',
    help: 'Maximum number of models stored in the tenant catalog.',
    enforcedOn: 'Enforced on model create APIs',
    min: 1
  },
  {
    key: 'maxApiRequestsPerMinute',
    label: 'Max API requests / minute',
    help: 'Shared per-team API request budget in a 60s window.',
    enforcedOn: 'Enforced on synthetic/model/import/ingest/transform routes',
    min: 1
  },
  {
    key: 'maxSyntheticPatientsPerJob',
    label: 'Max synthetic patients / job',
    help: 'Upper bound for patient_count in a single synthetic job.',
    enforcedOn: 'Enforced on synthetic job submission',
    min: 1
  },
  {
    key: 'maxSyntheticPatientsPerDay',
    label: 'Max synthetic patients / day',
    help: 'Daily team allowance of generated patients (dry-run excluded).',
    enforcedOn: 'Enforced on synthetic job submission',
    min: 1
  },
  {
    key: 'maxSyntheticJobsPerHour',
    label: 'Max synthetic jobs / hour',
    help: 'Maximum synthetic job submissions per team per rolling hour bucket.',
    enforcedOn: 'Enforced on synthetic job submission',
    min: 1
  },
  {
    key: 'maxSyntheticPayloadBytesMB',
    label: 'Max synthetic payload (MB)',
    help: 'Maximum JSON payload size sent to create synthetic jobs.',
    enforcedOn: 'Enforced on synthetic job submission',
    min: 1
  },
  {
    key: 'maxUploadFileBytesMB',
    label: 'Max upload file size (MB)',
    help: 'Maximum upload size for model imports and transform/import files.',
    enforcedOn: 'Enforced on model/import/transform uploads',
    min: 1
  },
  {
    key: 'maxIngestDocumentBytesMB',
    label: 'Max ingest document size (MB)',
    help: 'Maximum composition JSON size per document in batch ingest.',
    enforcedOn: 'Enforced on ingest-compositions',
    min: 1
  },
  {
    key: 'maxIngestDocumentsPerRequest',
    label: 'Max ingest docs / request',
    help: 'Maximum number of compositions accepted in one ingest request.',
    enforcedOn: 'Enforced on ingest-compositions',
    min: 1
  }
];

const TeamManagement = ({ team, user }) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteCode, setInviteCode] = useState(team?.inviteCode || '');
  const [members, setMembers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState(team?.currentUserRole || team?.userRole || 'member');
  const [memberCount, setMemberCount] = useState(team?.memberCount || 0);
  const [adminContacts, setAdminContacts] = useState(team?.adminContacts || []);
  const [membersVisible, setMembersVisible] = useState(team?.membersVisible === true);
  const [teamPolicy, setTeamPolicy] = useState(null);
  const [policyDraft, setPolicyDraft] = useState({
    maxDataModels: '',
    maxSyntheticPatientsPerJob: '',
    maxSyntheticPatientsPerDay: '',
    maxSyntheticJobsPerHour: '',
    maxApiRequestsPerMinute: '',
    maxUploadFileBytesMB: '',
    maxIngestDocumentBytesMB: '',
    maxIngestDocumentsPerRequest: '',
    maxSyntheticPayloadBytesMB: ''
  });
  const [policySaving, setPolicySaving] = useState(false);

  const fetchTeamData = useCallback(async () => {
    if (!team?._id) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/teams/${team._id}/team`);
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
        setMembersVisible(data.membersVisible === true);
        setMemberCount(
          typeof data.memberCount === 'number'
            ? data.memberCount
            : (Array.isArray(data.members) ? data.members.length : 0)
        );
        setAdminContacts(Array.isArray(data.adminContacts) ? data.adminContacts : []);
        setCurrentUserRole(data.currentUserRole || team?.currentUserRole || team?.userRole || 'member');

        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

        const validPendingInvites = (data.pendingInvites || []).filter((invite) => {
          const inviteDate = new Date(invite.createdAt);
          return inviteDate > fifteenDaysAgo && invite.status === 'pending';
        });

        setPendingInvites(validPendingInvites);
        setInviteCode(data.inviteCode || generateInviteCode());
        const limits = data.policy?.limits || {};
        setTeamPolicy(data.policy || null);
        setPolicyDraft({
          maxDataModels: limits.maxDataModels ?? '',
          maxSyntheticPatientsPerJob: limits.maxSyntheticPatientsPerJob ?? '',
          maxSyntheticPatientsPerDay: limits.maxSyntheticPatientsPerDay ?? '',
          maxSyntheticJobsPerHour: limits.maxSyntheticJobsPerHour ?? '',
          maxApiRequestsPerMinute: limits.maxApiRequestsPerMinute ?? '',
          maxUploadFileBytesMB: limits.maxUploadFileBytes ? Math.round(limits.maxUploadFileBytes / (1024 * 1024)) : '',
          maxIngestDocumentBytesMB: limits.maxIngestDocumentBytes ? Math.round(limits.maxIngestDocumentBytes / (1024 * 1024)) : '',
          maxIngestDocumentsPerRequest: limits.maxIngestDocumentsPerRequest ?? '',
          maxSyntheticPayloadBytesMB: limits.maxSyntheticPayloadBytes ? Math.round(limits.maxSyntheticPayloadBytes / (1024 * 1024)) : ''
        });
      }
    } catch (error) {
      console.error('Failed to fetch team data:', error);
    } finally {
      setLoading(false);
    }
  }, [team?._id, team?.currentUserRole, team?.userRole]);

  useEffect(() => {
    fetchTeamData();
  }, [fetchTeamData]);

  const generateInviteCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const sendInvite = async () => {
    if (!inviteEmail) return;

    try {
      const response = await fetch(`/api/teams/${team._id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail })
      });

      const data = await response.json();

      if (response.ok) {
        const draftText = data?.inviteDraft?.text || null;
        const draftSubject = data?.inviteDraft?.subject || null;
        const code = data?.inviteCode || inviteCode;

        setInviteEmail('');
        fetchTeamData();

        if (draftText) {
          alert(
            `Invite created.\n\nSubject:\n${draftSubject || ''}\n\nMessage:\n${draftText}\n`
          );
        } else {
          alert(
            `Invite created.\n\nShare this code with ${inviteEmail}:\n\n${code}\n\nThey can join by:\n1. Going to the login page\n2. Clicking "Join Team with Code"\n3. Entering the code: ${code}`
          );
        }
      } else if (data.error === 'Invite already sent') {
        alert(`An invitation has already been sent to ${inviteEmail}. Check the pending invites below.`);
      } else {
        alert(data.error || 'Failed to create invitation');
      }
    } catch (error) {
      console.error('Failed to send invite:', error);
      alert('Failed to send invitation. Please try again.');
    }
  };

  const revokeInvite = async (inviteId) => {
    try {
      const response = await fetch(`/api/teams/${team._id}/invite/${inviteId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchTeamData();
      }
    } catch (error) {
      console.error('Failed to revoke invite:', error);
    }
  };

  const removeMember = async (_memberId, memberEmail) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      const response = await fetch(`/api/teams/${team._id}/members/${encodeURIComponent(memberEmail)}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchTeamData();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Failed to remove member:', error);
      alert('Failed to remove member');
    }
  };

  const updateMemberRole = async (memberEmail, newRole) => {
    try {
      const response = await fetch(`/api/teams/${team._id}/members/${encodeURIComponent(memberEmail)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });

      if (response.ok) {
        fetchTeamData();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update role');
      }
    } catch (error) {
      console.error('Failed to update role:', error);
      alert('Failed to update role');
    }
  };

  const handleLeaveTeam = async () => {
    if (!confirm('Are you sure you want to leave this team? You will lose access to team environments.')) return;

    try {
      const response = await fetch(`/api/teams/${team._id}/leave`, {
        method: 'POST'
      });

      if (response.ok) {
        alert('You have left the team. Reloading...');
        window.location.reload();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to leave team');
      }
    } catch (error) {
      console.error('Failed to leave team:', error);
      alert('Failed to leave team');
    }
  };

  const isAdmin = currentUserRole === 'owner' || currentUserRole === 'admin';
  const adminNames = adminContacts
    .map((contact) => String(contact?.name || '').trim())
    .filter(Boolean);

  const formatAdminNames = (names = []) => {
    if (names.length === 0) return 'your team administrators';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  };

  const adminContactSummary = formatAdminNames(adminNames);

  const copyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const updatePolicyField = (field, value) => {
    setPolicyDraft((prev) => ({ ...prev, [field]: value }));
  };

  const savePolicy = async () => {
    if (!team?._id || !isAdmin) return;
    setPolicySaving(true);
    try {
      const payload = {
        policy: {
          limits: {
            maxDataModels: policyDraft.maxDataModels === '' ? null : Number(policyDraft.maxDataModels),
            maxSyntheticPatientsPerJob: policyDraft.maxSyntheticPatientsPerJob === '' ? null : Number(policyDraft.maxSyntheticPatientsPerJob),
            maxSyntheticPatientsPerDay: policyDraft.maxSyntheticPatientsPerDay === '' ? null : Number(policyDraft.maxSyntheticPatientsPerDay),
            maxSyntheticJobsPerHour: policyDraft.maxSyntheticJobsPerHour === '' ? null : Number(policyDraft.maxSyntheticJobsPerHour),
            maxApiRequestsPerMinute: policyDraft.maxApiRequestsPerMinute === '' ? null : Number(policyDraft.maxApiRequestsPerMinute),
            maxUploadFileBytes: policyDraft.maxUploadFileBytesMB === '' ? null : Number(policyDraft.maxUploadFileBytesMB) * 1024 * 1024,
            maxIngestDocumentBytes: policyDraft.maxIngestDocumentBytesMB === '' ? null : Number(policyDraft.maxIngestDocumentBytesMB) * 1024 * 1024,
            maxIngestDocumentsPerRequest: policyDraft.maxIngestDocumentsPerRequest === '' ? null : Number(policyDraft.maxIngestDocumentsPerRequest),
            maxSyntheticPayloadBytes: policyDraft.maxSyntheticPayloadBytesMB === '' ? null : Number(policyDraft.maxSyntheticPayloadBytesMB) * 1024 * 1024
          }
        }
      };
      const response = await fetch(`/api/teams/${team._id}/policy`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to save team policy');
      }
      setTeamPolicy(data.policy || payload.policy);
      alert('Team permissions updated');
    } catch (error) {
      console.error('Failed to save team policy:', error);
      alert(error.message || 'Failed to save team policy');
    } finally {
      setPolicySaving(false);
    }
  };

  if (loading && members.length === 0 && memberCount === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-theme-primary mb-6">Team Management</h1>
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-theme-secondary">Loading team data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-theme-primary mb-6">Team Management</h1>

      <div className="space-y-6">
        {isAdmin && (
          <div className="bg-surface rounded-lg p-6 border border-theme">
            <h2 className="text-lg font-semibold text-theme-primary mb-4">Invite Team Members</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-theme-primary mb-2">
                  Invite by Email
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="flex-1 p-3 bg-surface-hover border border-theme rounded-lg text-theme-primary"
                  />
                  <button
                    onClick={sendInvite}
                    className="px-4 py-3 bg-primary text-theme-primary rounded-lg hover:opacity-90 flex items-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Send Invite
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-primary mb-2">
                  Team Invite Code
                </label>
                <div className="flex items-center gap-2 p-3 bg-surface-hover rounded-lg">
                  <code className="flex-1 text-xl font-mono text-blue-400">{inviteCode}</code>
                  <button
                    onClick={copyInviteCode}
                    className="px-3 py-1 bg-surface text-theme-primary rounded hover:bg-surface-hover flex items-center gap-2"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-theme-secondary mt-1">
                  Share this code with team members to let them join your team
                </p>
              </div>
            </div>
          </div>
        )}

        {!isAdmin && (
          <div className="bg-surface rounded-lg p-6 border border-theme">
            <h2 className="text-lg font-semibold text-theme-primary mb-4">Team Information</h2>
            <p className="text-theme-secondary text-sm">
              Only team admins can invite new members or manage the team directory. Reach out to {adminContactSummary} if you need help with membership changes.
            </p>
          </div>
        )}

        <div className="bg-surface rounded-lg p-6 border border-theme">
          <h2 className="text-lg font-semibold text-theme-primary mb-4">Team Members</h2>

          {loading ? (
            <div className="text-center py-8 text-theme-secondary">Loading...</div>
          ) : !membersVisible ? (
            <div className="rounded-lg border border-theme bg-surface-hover p-4 text-theme-secondary">
              <div className="text-sm text-theme-primary font-medium mb-2">
                {memberCount} team member{memberCount === 1 ? '' : 's'}
              </div>
              <p className="text-sm">
                Member names and emails are visible only to team admins.
              </p>
              <p className="text-sm mt-2">
                If you need invites or team-management changes, contact {adminContactSummary}.
              </p>
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-8 text-theme-secondary">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No team members yet. Invite your colleagues to collaborate!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member._id || member.email} className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <div>
                    <p className="font-medium text-theme-primary">{member.name || member.email}</p>
                    <p className="text-sm text-theme-secondary">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {member.role === 'owner' ? (
                      <span className="px-2 py-1 bg-purple-900/50 text-purple-400 text-xs rounded-full">Owner</span>
                    ) : member.role === 'admin' ? (
                      <span className="px-2 py-1 bg-blue-900/50 text-blue-400 text-xs rounded-full">Admin</span>
                    ) : (
                      <span className="px-2 py-1 bg-surface text-theme-primary text-xs rounded-full">Member</span>
                    )}

                    {isAdmin && member.role !== 'owner' && member.email !== user?.email && (
                      <select
                        value={member.role}
                        onChange={(e) => updateMemberRole(member.email, e.target.value)}
                        className="text-xs bg-surface border border-theme rounded px-2 py-1 text-theme-primary"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}

                    {isAdmin && member.role !== 'owner' && member.email !== user?.email && (
                      <button
                        onClick={() => removeMember(member.userId, member.email)}
                        className="text-red-400 hover:text-red-300"
                        title="Remove member"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface rounded-lg p-6 border border-theme">
          <h2 className="text-lg font-semibold text-theme-primary mb-4">Team Permissions & Limits</h2>
          <p className="text-theme-secondary text-sm mb-4">
            Limits are enforced server-side for the whole team. Leave a field empty for unlimited.
          </p>
          {!isAdmin && (
            <p className="text-theme-secondary text-xs mb-4">
              View only. Only admins can modify these values.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {POLICY_FIELDS.map((field) => (
              <label key={field.key} className="text-xs text-theme-secondary">
                {field.label}
                <input
                  type="number"
                  min={field.min}
                  value={policyDraft[field.key]}
                  onChange={(e) => updatePolicyField(field.key, e.target.value)}
                  disabled={!isAdmin}
                  className="w-full mt-1 p-2 bg-surface-hover border border-theme rounded text-theme-primary"
                />
                <span className="block mt-1 text-[11px] text-theme-secondary opacity-85">{field.help}</span>
                <span className="block text-[11px] text-theme-secondary opacity-70">{field.enforcedOn}</span>
              </label>
            ))}
          </div>
          {teamPolicy?.updatedAt && (
            <p className="text-xs text-theme-secondary mt-3">
              Last updated: {new Date(teamPolicy.updatedAt).toLocaleString()} {teamPolicy.updatedBy ? `by ${teamPolicy.updatedBy}` : ''}
            </p>
          )}
          {isAdmin && (
            <button
              onClick={savePolicy}
              disabled={policySaving}
              className="mt-4 px-4 py-2 bg-primary text-theme-primary rounded-lg hover:opacity-90 disabled:opacity-60"
            >
              {policySaving ? 'Saving...' : 'Save Permissions'}
            </button>
          )}
        </div>

        {isAdmin && pendingInvites.length > 0 && (
          <div className="bg-surface rounded-lg p-6 border border-theme">
            <h2 className="text-lg font-semibold text-theme-primary mb-4">Pending Invites</h2>

            <div className="space-y-3">
              {pendingInvites.map((invite) => (
                <div key={invite._id} className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <div>
                    <p className="font-medium text-theme-primary">{invite.email}</p>
                    <p className="text-sm text-theme-secondary">Invited {new Date(invite.createdAt).toLocaleDateString()}</p>
                  </div>
                  <button
                    onClick={() => revokeInvite(invite._id)}
                    className="text-red-400 hover:text-red-300"
                    title="Revoke invite"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentUserRole !== 'owner' && (
          <div className="bg-surface rounded-lg p-6 border border-red-700/50">
            <h2 className="text-lg font-semibold text-theme-primary mb-4">Leave Team</h2>
            <p className="text-theme-secondary text-sm mb-4">
              If you leave the team, you will lose access to all team environments and settings.
              You can rejoin later if you receive a new invite.
            </p>
            <button
              onClick={handleLeaveTeam}
              className="px-4 py-2 bg-red-600 text-theme-primary rounded-lg hover:bg-red-700 transition-colors"
            >
              Leave Team
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamManagement;
