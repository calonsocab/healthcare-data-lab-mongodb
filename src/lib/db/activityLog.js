// src/lib/db/activityLog.js
// Comprehensive activity logging for user sessions, team membership, and all user actions
// This data can be visualized in Atlas Charts for monitoring and analytics

import { getCoreDb } from './coreDb';

/**
 * Activity event types for tracking
 */
export const ActivityType = {
  // Authentication events
  LOGIN: 'login',
  LOGOUT: 'logout',
  SESSION_START: 'session_start',
  SESSION_HEARTBEAT: 'session_heartbeat',
  SESSION_END: 'session_end',
  TOKEN_REFRESH: 'token_refresh',

  // Team membership events
  TEAM_JOIN: 'team_join',
  TEAM_JOIN_FAILED: 'team_join_failed',
  TEAM_JOIN_ATTEMPT: 'team_join_attempt',
  TEAM_LEAVE: 'team_leave',
  TEAM_INVITE_SENT: 'team_invite_sent',
  TEAM_INVITE_ACCEPTED: 'team_invite_accepted',
  TEAM_MEMBER_REMOVED: 'team_member_removed',
  TEAM_ROLE_CHANGED: 'team_role_changed',

  // Account events
  ACCOUNT_CREATED: 'account_created',
  ACCOUNT_TYPE_CHANGED: 'account_type_changed',
  PREFERENCES_UPDATED: 'preferences_updated',

  // Feature usage events
  PAGE_VIEW: 'page_view',
  FEATURE_USED: 'feature_used',
  API_CALLED: 'api_called',

  // Environment events
  ENVIRONMENT_CREATED: 'environment_created',
  ENVIRONMENT_ACTIVATED: 'environment_activated',
  ENVIRONMENT_QUERY: 'environment_query',

  // Onboarding / access policy decisions
  ONBOARDING_ACCESS: 'onboarding_access',
};

/**
 * Log an activity event to the activity_logs collection
 *
 * @param {Object} params - Activity parameters
 * @param {string} params.type - Activity type from ActivityType enum
 * @param {string} params.userId - User ID (Google ID or email)
 * @param {string} params.email - User email
 * @param {string} [params.name] - User display name
 * @param {string} [params.teamId] - Team ID if applicable
 * @param {string} [params.teamName] - Team name if applicable
 * @param {string} [params.sessionId] - Session identifier for grouping
 * @param {Object} [params.metadata] - Additional event-specific data
 * @param {string} [params.ip] - Client IP address
 * @param {string} [params.userAgent] - Client user agent
 * @param {boolean} [params.success] - Whether the action succeeded
 * @param {string} [params.errorMessage] - Error message if failed
 */
export async function logActivity({
  type,
  userId,
  email,
  name = null,
  teamId = null,
  teamName = null,
  sessionId = null,
  metadata = {},
  ip = null,
  userAgent = null,
  success = true,
  errorMessage = null,
}) {
  try {
    const db = await getCoreDb();

    const logEntry = {
      type,
      userId,
      email: email?.toLowerCase(),
      name,
      teamId,
      teamName,
      sessionId,
      metadata,
      ip,
      userAgent,
      success,
      errorMessage,
      timestamp: new Date(),
      // Date fields for easier Atlas Charts aggregation
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      hour: new Date().getHours(),
      dayOfWeek: new Date().getDay(), // 0 = Sunday
    };

    await db.collection('activity_logs').insertOne(logEntry);

    return logEntry;
  } catch (error) {
    // Don't throw - logging should never break the main flow
    console.error('Failed to log activity:', error);
    return null;
  }
}

/**
 * Log a login event
 */
export async function logLogin({ userId, email, name, ip, userAgent, isNewUser = false }) {
  return logActivity({
    type: ActivityType.LOGIN,
    userId,
    email,
    name,
    ip,
    userAgent,
    metadata: { isNewUser },
  });
}

/**
 * Log a logout event
 */
export async function logLogout({ userId, email, name, sessionDurationMs = null }) {
  return logActivity({
    type: ActivityType.LOGOUT,
    userId,
    email,
    name,
    metadata: { sessionDurationMs },
  });
}

/**
 * Log a team join event
 */
export async function logTeamJoin({ userId, email, name, teamId, teamName, joinMethod, inviteCode = null }) {
  return logActivity({
    type: ActivityType.TEAM_JOIN,
    userId,
    email,
    name,
    teamId,
    teamName,
    metadata: { joinMethod, inviteCode },
  });
}

/**
 * Log a failed team join attempt
 */
export async function logTeamJoinFailed({ userId, email, name, inviteCode, reason, teamName = null }) {
  return logActivity({
    type: ActivityType.TEAM_JOIN_FAILED,
    userId,
    email,
    name,
    teamName,
    success: false,
    errorMessage: reason,
    metadata: { inviteCode },
  });
}

/**
 * Log a team join attempt (before validation)
 */
export async function logTeamJoinAttempt({ userId, email, name, inviteCode, source = 'manual' }) {
  return logActivity({
    type: ActivityType.TEAM_JOIN_ATTEMPT,
    userId,
    email,
    name,
    metadata: { inviteCode, source },
  });
}

/**
 * Log account creation
 */
export async function logAccountCreated({ userId, email, name, accountType, ip, userAgent }) {
  return logActivity({
    type: ActivityType.ACCOUNT_CREATED,
    userId,
    email,
    name,
    metadata: { accountType },
    ip,
    userAgent,
  });
}

/**
 * Log a session heartbeat (for tracking active sessions)
 */
export async function logSessionHeartbeat({ userId, email, sessionId, currentView, teamId }) {
  return logActivity({
    type: ActivityType.SESSION_HEARTBEAT,
    userId,
    email,
    sessionId,
    teamId,
    metadata: { currentView },
  });
}

/**
 * Get user activity summary for dashboard
 */
export async function getUserActivitySummary(email, days = 30) {
  try {
    const db = await getCoreDb();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const summary = await db.collection('activity_logs').aggregate([
      {
        $match: {
          email: email?.toLowerCase(),
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          lastOccurrence: { $max: '$timestamp' },
        },
      },
    ]).toArray();

    return summary;
  } catch (error) {
    console.error('Failed to get activity summary:', error);
    return [];
  }
}

/**
 * Get team membership activity
 */
export async function getTeamMembershipActivity(teamId, days = 30) {
  try {
    const db = await getCoreDb();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const activity = await db.collection('activity_logs').aggregate([
      {
        $match: {
          teamId: teamId?.toString(),
          timestamp: { $gte: startDate },
          type: { $in: [ActivityType.TEAM_JOIN, ActivityType.TEAM_LEAVE, ActivityType.LOGIN, ActivityType.LOGOUT] },
        },
      },
      {
        $sort: { timestamp: -1 },
      },
      {
        $limit: 100,
      },
    ]).toArray();

    return activity;
  } catch (error) {
    console.error('Failed to get team activity:', error);
    return [];
  }
}

/**
 * Get daily active users for a team
 */
export async function getTeamDailyActiveUsers(teamId, days = 30) {
  try {
    const db = await getCoreDb();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dau = await db.collection('activity_logs').aggregate([
      {
        $match: {
          teamId: teamId?.toString(),
          timestamp: { $gte: startDate },
          type: ActivityType.LOGIN,
        },
      },
      {
        $group: {
          _id: {
            date: '$date',
            email: '$email',
          },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          uniqueUsers: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]).toArray();

    return dau;
  } catch (error) {
    console.error('Failed to get DAU:', error);
    return [];
  }
}
