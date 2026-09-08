import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    if (process.env.ENABLE_DEBUG_ENDPOINTS !== 'true') {
      return NextResponse.json({ error: 'Endpoint disabled' }, { status: 403 });
    }

    return NextResponse.json({
      message: "This is a test",
    });
  } catch (error) {
    return NextResponse.json({ error: 'Test endpoint failed' }, { status: 400 });
  }
}
