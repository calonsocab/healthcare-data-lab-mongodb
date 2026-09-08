import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getCoreDb } from '@/lib/db/coreDb';
import { getCurrentAccessKey } from '@/lib/security/accessKey';

export async function getPlatformAdminContext() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const db = await getCoreDb();
  const email = session.user.email.toLowerCase();
  const accessState = await getCurrentAccessKey(db, email);
  const sessionAccessKey = String(session?.access?.key || '').trim() || null;
  if (!sessionAccessKey || sessionAccessKey !== accessState?.key) {
    return {
      ok: false,
      status: 401,
      error: 'Session access state is stale. Please sign in again.'
    };
  }

  const user = await db.collection('users').findOne(
    { email },
    { projection: { _id: 1, email: 1, platformRoles: 1 } }
  );

  const isDbAdmin = user?.platformRoles?.admin === true;
  const isAdmin = isDbAdmin;

  return {
    ok: true,
    session,
    db,
    user,
    isAdmin,
    isDbAdmin
  };
}

export async function requirePlatformAdmin() {
  const ctx = await getPlatformAdminContext();
  if (!ctx.ok) {
    return { ok: false, response: NextResponse.json({ error: ctx.error }, { status: ctx.status }) };
  }
  if (!ctx.isAdmin) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, ...ctx };
}
