import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';
import { requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';

export const dynamic = 'force-dynamic';

/**
 * Available domains with local fallback configs
 */
const LOCAL_DOMAINS = ['X12', 'FHIR', 'openEHR', 'generic'];

/**
 * GET /api/kehrnel/agentic - List available agentic domains
 *
 * Returns domains from Kehrnel merged with local fallbacks.
 */
export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    let kehrnelDomains = [];

    // Try Kehrnel first
    try {
      const coreDb = await getCoreDb();
      const service = createKehrnelService(coreDb);
      const result = await service.listAgenticDomains();
      kehrnelDomains = result.domains || [];
    } catch (kehrnelError) {
      console.warn('Could not fetch domains from Kehrnel:', kehrnelError.message);
    }

    // Merge with local domains (dedupe)
    const allDomains = [...new Set([...kehrnelDomains, ...LOCAL_DOMAINS])];

    return NextResponse.json({
      domains: allDomains.sort(),
      counts: {
        kehrnel: kehrnelDomains.length,
        local: LOCAL_DOMAINS.length,
        total: allDomains.length
      }
    });
  } catch (error) {
    console.error('Error listing agentic domains:', error);
    return safeErrorResponse(error, 'Failed to list domains');
  }
}
