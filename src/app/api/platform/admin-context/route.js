import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const email = String(session.user.email).toLowerCase();

    let isDbAdmin = false;
    try {
      const db = await getCoreDb();
      const user = await db.collection('users').findOne(
        { email },
        { projection: { platformRoles: 1 } }
      );
      isDbAdmin = user?.platformRoles?.admin === true;
    } catch {
      isDbAdmin = false;
    }

    return NextResponse.json({
      ok: true,
      isAdmin: isDbAdmin
    });
  } catch (error) {
    console.error('GET /api/platform/admin-context error:', error);
    return NextResponse.json({ ok: false, error: 'Failed to load admin context' }, { status: 500 });
  }
}
