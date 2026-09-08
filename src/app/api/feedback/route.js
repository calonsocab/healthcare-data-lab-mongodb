// src/app/api/feedback/route.js
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { ObjectId } from 'mongodb';
import { parseJsonWithLimit, PayloadTooLargeError } from '@/lib/uploads/bodyLimit';
import { requirePlatformAdmin } from '@/lib/security/admin';
import { getOptionalRelaxedAuthenticatedSession } from '@/lib/security/api';

export const dynamic = 'force-dynamic';
const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
const FEEDBACK_MAX_BODY_BYTES = 9 * 1024 * 1024; // allows 5MB image + base64 overhead
const SCREENSHOT_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml'
];

function getBase64ByteLength(base64 = '') {
  const sanitized = String(base64).replace(/\s+/g, '');
  const padding = sanitized.endsWith('==') ? 2 : sanitized.endsWith('=') ? 1 : 0;
  return Math.floor((sanitized.length * 3) / 4) - padding;
}

function sanitizeText(value, maxLen) {
  if (value == null) return null;
  let s = String(value);
  // Remove low control chars (including null bytes) that can cause storage/logging issues.
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  s = s.trim();
  if (typeof maxLen === 'number' && maxLen > 0 && s.length > maxLen) s = s.slice(0, maxLen);
  return s || null;
}

function sanitizeContextObject(obj, spec) {
  if (!obj || typeof obj !== 'object') return null;
  const out = {};
  for (const [key, maxLen] of Object.entries(spec)) {
    out[key] = sanitizeText(obj[key], maxLen);
  }
  return out;
}

/**
 * POST /api/feedback
 * Submit user feedback (bugs, ideas, opinions)
 */
export async function POST(request) {
  try {
    // Optional auth context for attribution only (submission remains anonymous-friendly).
    const session = await getOptionalRelaxedAuthenticatedSession();

    const body = await parseJsonWithLimit(request, FEEDBACK_MAX_BODY_BYTES);
    const { type, title, description, screenshot, context, page, appContext } = body;

    // Validate required fields
    if (!type || !title || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: type, title, description' },
        { status: 400 }
      );
    }

    const sanitizedTitle = sanitizeText(title, 100);
    const sanitizedDescription = sanitizeText(description, 2000);
    if (!sanitizedTitle || !sanitizedDescription) {
      return NextResponse.json(
        { error: 'Title and description cannot be empty' },
        { status: 400 }
      );
    }

    // Validate feedback type
    const validTypes = ['bug', 'idea', 'opinion'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid feedback type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate lengths
    if (title.length > 100) {
      return NextResponse.json(
        { error: 'Title must be 100 characters or less' },
        { status: 400 }
      );
    }
    if (description.length > 2000) {
      return NextResponse.json(
        { error: 'Description must be 2000 characters or less' },
        { status: 400 }
      );
    }

    if (page && String(page).length > 80) {
      return NextResponse.json(
        { error: 'Page must be 80 characters or less' },
        { status: 400 }
      );
    }

    // Validate screenshot size/type (if provided)
    if (screenshot) {
      if (typeof screenshot !== 'string' || !screenshot.startsWith('data:')) {
        return NextResponse.json(
          { error: 'Screenshot must be a base64 data URL' },
          { status: 400 }
        );
      }
      const match = screenshot.match(/^data:([^;]+);base64,(.*)$/);
      if (!match) {
        return NextResponse.json(
          { error: 'Screenshot is not a valid base64 data URL' },
          { status: 400 }
        );
      }
      const mimeType = match[1]?.toLowerCase();
      const base64Payload = match[2] || '';
      if (!SCREENSHOT_MIME_TYPES.includes(mimeType)) {
        return NextResponse.json(
          { error: 'Screenshot must be an image (JPEG, PNG, GIF, WebP, SVG)' },
          { status: 400 }
        );
      }
      const screenshotSize = getBase64ByteLength(base64Payload);
      if (screenshotSize > SCREENSHOT_MAX_BYTES) {
        return NextResponse.json(
          { error: 'Screenshot must be less than 5MB' },
          { status: 400 }
        );
      }
    }

    const db = await getCoreDb();
    const feedbackCollection = db.collection('feedback');

    const sanitizedContext = sanitizeContextObject(context, {
      url: 500,
      pathname: 200,
      userAgent: 512,
      screenSize: 32,
      timestamp: 40
    }) || {};

    // Client-provided app context (untrusted). We sanitize and keep it small for tracking.
    const sanitizedAppContext = appContext && typeof appContext === 'object' ? {
      page: sanitizeContextObject(appContext.page, {
        id: 80,
        label: 80,
        sectionId: 80,
        sectionLabel: 80
      }),
      team: sanitizeContextObject(appContext.team, {
        id: 80,
        name: 120
      }),
      reporter: sanitizeContextObject(appContext.reporter, {
        id: 80,
        name: 120,
        email: 160
      }),
      activeEnvironment: sanitizeContextObject(appContext.activeEnvironment, {
        id: 80,
        name: 120
      }),
      activeStrategy: sanitizeContextObject(appContext.activeStrategy, {
        id: 120,
        name: 200,
        domain: 40
      })
    } : null;

    // Create feedback document
    const feedbackDoc = {
      _id: new ObjectId(),
      type,
      title: sanitizedTitle,
      description: sanitizedDescription,
      screenshot: screenshot || null,
      page: sanitizeText(page, 80) || 'General',
      appContext: sanitizedAppContext,
      context: {
        url: sanitizedContext.url || null,
        pathname: sanitizedContext.pathname || null,
        userAgent: sanitizedContext.userAgent || null,
        screenSize: sanitizedContext.screenSize || null,
        timestamp: sanitizedContext.timestamp || new Date().toISOString()
      },
      user: session?.user ? {
        email: sanitizeText(session.user.email, 160),
        name: sanitizeText(session.user.name, 120),
        image: sanitizeText(session.user.image, 500)
      } : null,
      status: 'new', // new, reviewed, in_progress, resolved, closed
      priority: null, // low, medium, high, critical (to be set by admin)
      adminNotes: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await feedbackCollection.insertOne(feedbackDoc);

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
      id: feedbackDoc._id.toString()
    });

  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    console.error('Error submitting feedback:', error);
    return NextResponse.json(
      { error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/feedback
 * Get all feedback (admin only)
 */
export async function GET(request) {
  try {
    const admin = await requirePlatformAdmin();
    if (!admin.ok) return admin.response;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const skip = parseInt(searchParams.get('skip') || '0');

    const db = admin.db || await getCoreDb();
    const feedbackCollection = db.collection('feedback');

    // Build query
    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;

    const [feedback, total] = await Promise.all([
      feedbackCollection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      feedbackCollection.countDocuments(query)
    ]);

    // Remove screenshot data from list view to reduce payload
    const feedbackList = feedback.map(f => ({
      ...f,
      hasScreenshot: !!f.screenshot,
      screenshot: undefined
    }));

    return NextResponse.json({
      feedback: feedbackList,
      total,
      limit,
      skip
    });

  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    );
  }
}
