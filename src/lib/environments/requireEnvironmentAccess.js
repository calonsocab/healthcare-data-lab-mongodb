import { NextResponse } from 'next/server';
import { findAccessibleEnvironment } from './access.js';

export async function requireAccessibleEnvironment(coreDb, userEmail, envId) {
  const accessible = await findAccessibleEnvironment(coreDb, userEmail, envId);
  if (!accessible?.environment) {
    return {
      ok: false,
      accessible,
      response: NextResponse.json({ error: 'Environment not found' }, { status: 404 }),
    };
  }

  return {
    ok: true,
    accessible,
  };
}
