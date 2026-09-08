import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/analytics/activity/route.js
/**
 * GET /api/analytics/activity
 *
 * Returns activity analytics data for the current user's team.
 * This data can be used to create Atlas Charts dashboards.
 *
 * Query params:
 *   - days: Number of days to look back (default: 30, max: 90)
 *   - type: Filter by activity type (e.g., 'login', 'team_join')
 *   - groupBy: Group results by 'day', 'hour', 'type', or 'user'
 */
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { ActivityType } from '@/lib/db/activityLog';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days') || '30'), 90);
    const type = searchParams.get('type');
    const groupBy = searchParams.get('groupBy') || 'day';

    const db = await getCoreDb();

    // Get user's team
    const user = await db.collection('users').findOne(
      { email: session.user.email },
      { projection: { teamId: 1 } }
    );

    // Build query
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const matchQuery = {
      timestamp: { $gte: startDate },
    };

    // If user has a team, filter by teamId; otherwise filter by user email
    if (user?.teamId) {
      matchQuery.teamId = user.teamId.toString();
    } else {
      matchQuery.email = session.user.email?.toLowerCase();
    }

    if (type) {
      matchQuery.type = type;
    }

    // Build aggregation pipeline based on groupBy
    let groupStage;
    let sortStage;

    switch (groupBy) {
      case 'hour':
        groupStage = {
          $group: {
            _id: {
              date: '$date',
              hour: '$hour',
            },
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$email' },
          },
        };
        sortStage = { $sort: { '_id.date': 1, '_id.hour': 1 } };
        break;

      case 'type':
        groupStage = {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            successCount: {
              $sum: { $cond: ['$success', 1, 0] },
            },
            failureCount: {
              $sum: { $cond: ['$success', 0, 1] },
            },
            uniqueUsers: { $addToSet: '$email' },
          },
        };
        sortStage = { $sort: { count: -1 } };
        break;

      case 'user':
        groupStage = {
          $group: {
            _id: {
              email: '$email',
              name: { $first: '$name' },
            },
            totalActivities: { $sum: 1 },
            loginCount: {
              $sum: { $cond: [{ $eq: ['$type', 'login'] }, 1, 0] },
            },
            lastActivity: { $max: '$timestamp' },
            types: { $addToSet: '$type' },
          },
        };
        sortStage = { $sort: { lastActivity: -1 } };
        break;

      case 'day':
      default:
        groupStage = {
          $group: {
            _id: '$date',
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$email' },
            types: {
              $push: '$type',
            },
          },
        };
        sortStage = { $sort: { _id: 1 } };
        break;
    }

    const pipeline = [
      { $match: matchQuery },
      groupStage,
      sortStage,
      { $limit: 1000 },
    ];

    const results = await db.collection('activity_logs').aggregate(pipeline).toArray();

    // Transform results for easier consumption
    const transformed = results.map((item) => {
      if (groupBy === 'day' || groupBy === 'hour') {
        return {
          ...item,
          uniqueUserCount: item.uniqueUsers?.length || 0,
          uniqueUsers: undefined, // Remove array for privacy
        };
      }
      if (groupBy === 'type') {
        return {
          type: item._id,
          count: item.count,
          successCount: item.successCount,
          failureCount: item.failureCount,
          uniqueUserCount: item.uniqueUsers?.length || 0,
        };
      }
      if (groupBy === 'user') {
        return {
          email: item._id.email,
          name: item._id.name,
          totalActivities: item.totalActivities,
          loginCount: item.loginCount,
          lastActivity: item.lastActivity,
          activityTypes: item.types,
        };
      }
      return item;
    });

    // Also return summary stats
    const summary = await db.collection('activity_logs').aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          uniqueUsers: { $addToSet: '$email' },
          loginCount: {
            $sum: { $cond: [{ $eq: ['$type', 'login'] }, 1, 0] },
          },
          teamJoinCount: {
            $sum: { $cond: [{ $eq: ['$type', 'team_join'] }, 1, 0] },
          },
          teamJoinFailedCount: {
            $sum: { $cond: [{ $eq: ['$type', 'team_join_failed'] }, 1, 0] },
          },
        },
      },
    ]).toArray();

    const summaryData = summary[0] || {
      totalEvents: 0,
      uniqueUsers: [],
      loginCount: 0,
      teamJoinCount: 0,
      teamJoinFailedCount: 0,
    };

    return NextResponse.json({
      data: transformed,
      summary: {
        totalEvents: summaryData.totalEvents,
        uniqueUserCount: summaryData.uniqueUsers?.length || 0,
        loginCount: summaryData.loginCount,
        teamJoinCount: summaryData.teamJoinCount,
        teamJoinFailedCount: summaryData.teamJoinFailedCount,
        dateRange: {
          start: startDate.toISOString(),
          end: new Date().toISOString(),
        },
      },
      activityTypes: Object.values(ActivityType),
    });
  } catch (error) {
    console.error('GET /api/analytics/activity error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity analytics' },
      { status: 500 }
    );
  }
}
