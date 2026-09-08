// src/lib/email.js
// No outbound email sending: this project intentionally avoids SMTP/nodemailer.
// Instead, generate an email draft (subject + body) that admins can copy-paste.

function env(name, fallback = undefined) {
  const v = process.env[name];
  return v === undefined ? fallback : v;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildInviteEmailDraft({ to, teamName, inviteCode }) {
  const APP_BASE_URL = env('APP_BASE_URL', 'http://localhost:3000');

  const normalizedInviteCode = String(inviteCode || '').trim().toUpperCase();
  const inviteUrl = `${APP_BASE_URL}?joinCode=${encodeURIComponent(normalizedInviteCode)}`;

  const safeTo = String(to || '').trim();
  const safeTeamName = String(teamName || '').trim();

  const subject = `You're invited to join ${safeTeamName}`;
  const text = [
    `You've been invited to join the team "${safeTeamName}".`,
    ``,
    `Invite code: ${normalizedInviteCode}`,
    ``,
    `To join:`,
    `1. Go to: ${APP_BASE_URL}`,
    `2. Click "Join Team with Code"`,
    `3. Enter the code: ${normalizedInviteCode}`,
    `4. Sign in with your Google account (${safeTo})`,
    ``,
    `Or use this link: ${inviteUrl}`,
    ``,
    `Important: You must sign in with the email address ${safeTo} to accept this invitation.`,
  ].join('\n');

  const htmlTo = escapeHtml(safeTo);
  const htmlTeamName = escapeHtml(safeTeamName);
  const htmlInviteCode = escapeHtml(normalizedInviteCode);

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#3B82F6">You're invited to ${htmlTeamName}</h2>
      <p>You've been invited to join the team <strong>${htmlTeamName}</strong>.</p>

      <div style="background:#f1f5f9;padding:20px;border-radius:8px;margin:20px 0">
        <p style="margin:0 0 10px 0;font-weight:bold">Invite code:</p>
        <p style="font-family:monospace;font-size:22px;letter-spacing:2px;color:#3B82F6;margin:0">${htmlInviteCode}</p>
      </div>

      <h3>How to join</h3>
      <ol>
        <li>Go to <a href="${APP_BASE_URL}">${APP_BASE_URL}</a></li>
        <li>Click "Join Team with Code"</li>
        <li>Enter the code: <strong>${htmlInviteCode}</strong></li>
        <li>Sign in with your Google account</li>
      </ol>

      <p><a href="${inviteUrl}" style="display:inline-block;background:#3B82F6;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold">Get Started</a></p>

      <p style="color:#666;font-size:12px;margin-top:20px">
        <strong>Important:</strong> You must sign in with the email address <strong>${htmlTo}</strong> to accept this invitation.
      </p>
    </div>
  `;

  return { to: safeTo, subject, text, html, inviteUrl, appBaseUrl: APP_BASE_URL, inviteCode: normalizedInviteCode };
}

// Backwards-compatible name: this no longer sends email, it only returns a draft.
export async function sendInviteEmail({ to, teamName, inviteCode }) {
  return buildInviteEmailDraft({ to, teamName, inviteCode });
}
