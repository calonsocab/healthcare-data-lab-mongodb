import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/persistence-strategies/route.js
/**
 * Persistence Strategies API - Kehrnel-sourced Strategy Catalog
 *
 * Strategy definitions come exclusively from Kehrnel.
 * This endpoint proxies to Kehrnel's strategy catalog.
 *
 * Activations are tracked in:
 * - environments.strategyLinks (per environment/domain)
 * - Kehrnel's /environments/{envKey}/activations
 */
import { getCoreDb } from '@/lib/db/coreDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';

function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const db = await getCoreDb();
    const service = createKehrnelService(db);

    const url = new URL(request.url);
    const connectionId = url.searchParams.get('connectionId');
    const forceRefresh = url.searchParams.get('refresh') === 'true';
    const search = url.searchParams.get('search') || '';

    // Fetch strategies from Kehrnel
    let result;
    try {
      result = await service.listStrategies({ connectionId, forceRefresh });
    } catch (err) {
      console.error('Failed to fetch strategies from Kehrnel:', err.message);
      return Response.json({
        strategies: [],
        source: 'none',
        error: 'Kehrnel connection unavailable. Configure a Kehrnel instance to see available strategies.',
        details: err.message
      });
    }

    let strategies = result.strategies || [];

    // Apply search filter if provided
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      strategies = strategies.filter(s =>
        regex.test(s.name || '') ||
        regex.test(s.id || '') ||
        regex.test(s.description || '') ||
        regex.test(s.summary || '') ||
        (s.tags || []).some(t => regex.test(t)) ||
        (s.keywords || []).some(k => regex.test(k))
      );
    }

    // Transform to consistent response format
    const transformed = strategies.map(s => transformKehrnelStrategy(s));

    return Response.json({
      strategies: transformed,
      source: result.source || 'kehrnel',
      connectionId: result.connectionId,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('GET /api/persistence-strategies error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST - Strategy creation is NOT allowed.
 * Strategies are defined in Kehrnel only.
 */
export async function POST() {
  return Response.json(
    {
      error: 'Strategy creation is not allowed. Strategies are defined in Kehrnel. ' +
             'Use the Strategy Studio to activate a strategy for your environment.'
    },
    { status: 403 }
  );
}

/**
 * Transform Kehrnel strategy manifest to expected response format
 */
function transformKehrnelStrategy(manifest) {
  const id = manifest.id || manifest.strategy_id || manifest.name;

  // Extract protocol info for UI
  const protocol = manifest.protocols?.[0] || {};
  const domainName = protocol.name || manifest.domain?.[0] || 'Unknown';
  const protocolMeta = {
    standard: domainName,
    displayName: getProtocolDisplayName(domainName),
    version: protocol.version || manifest.version,
    color: getProtocolColor(domainName),
    icon: manifest.ui?.icon || 'Database'
  };

  return {
    // Core identity
    _id: id,
    id: id,
    kehrnelId: id,
    name: manifest.name || manifest.display_name || id,
    description: manifest.description || manifest.summary || '',
    summary: manifest.summary || '',
    story: manifest.story || manifest.ui?.story || '',

    // Narrative guidance
    benefits: manifest.benefits || manifest.ui?.benefits || [],
    pick_when: manifest.pick_when || manifest.ui?.pick_when || [],
    avoid_when: manifest.avoid_when || manifest.ui?.avoid_when || [],

    // Classification
    tags: manifest.tags || manifest.keywords || [],
    domain: manifest.domain || [],

    // Visual/UI metadata
    meta: {
      summary: manifest.summary || manifest.description || '',
      story: manifest.story || manifest.ui?.story || '',
      hero: {
        type: 'badge',
        protocol: {
          name: protocolMeta.displayName,
          tagline: manifest.summary || ''
        },
        caption: `${protocolMeta.displayName} ${protocolMeta.version || ''}`.trim()
      }
    },
    protocol: protocolMeta,

    // Kehrnel manifest data
    version: manifest.version,
    capabilities: manifest.capabilities || [],
    config_schema: manifest.config_schema,
    default_config: manifest.default_config,
    ops: manifest.ops || [],
    maturity: manifest.maturity || 'preview',

    // UI elements from Kehrnel
    tabs: manifest.ui?.tabs || buildDefaultTabs(manifest),
    icon: manifest.ui?.icon,
    accentColor: manifest.ui?.accent_color,

    // Source links
    source_links: manifest.ui?.links || {},

    // Blueprint for compatibility with existing UI
    blueprint: {
      id: id,
      display_name: manifest.display_name || manifest.name,
      domain: manifest.domain || [],
      summary: manifest.summary || manifest.description,
      complexity: manifest.complexity || 'medium',
      topology: manifest.topology || { modes: ['single'], default: 'single' },
      query_focus: manifest.query_focus || 'mixed',
      collections: manifest.collections || {},
      fields: manifest.fields || {},
      coding: manifest.coding || {},
      dictionaries: manifest.dictionaries || {},
      index_templates: manifest.index_templates || {},
      protocol: protocolMeta,
      kehrnel_library: {
        package: 'kehrnel',
        capabilities: manifest.capabilities || []
      }
    },

    // Mark as Kehrnel-sourced
    source: 'kehrnel',
    kehrnelManifest: manifest,

    // System strategy marker
    ownerType: 'system',
    visibility: 'public'
  };
}

/**
 * Get protocol display name with trademark symbol
 */
function getProtocolDisplayName(protocol) {
  const names = {
    'openEHR': 'openEHR®',
    'openehr': 'openEHR®',
    'FHIR': 'FHIR®',
    'fhir': 'FHIR®',
    'Genomics': 'Genomics',
    'genomics': 'Genomics',
    'X12': 'X12',
    'x12': 'X12',
    'HL7v2': 'HL7v2',
    'hl7v2': 'HL7v2',
    'ContextObjects': 'ContextObjects',
    'contextobjects': 'ContextObjects'
  };
  return names[protocol] || protocol || 'Custom';
}

/**
 * Get protocol accent color
 */
function getProtocolColor(protocol) {
  const colors = {
    'openEHR': '#00a99d',
    'openehr': '#00a99d',
    'FHIR': '#ff6b6b',
    'fhir': '#ff6b6b',
    'Genomics': '#6c5ce7',
    'genomics': '#6c5ce7',
    'X12': '#e67e22',
    'x12': '#e67e22',
    'HL7v2': '#3498db',
    'hl7v2': '#3498db'
  };
  return colors[protocol] || '#666666';
}

/**
 * Build default tabs structure for strategies without UI config
 */
function buildDefaultTabs(manifest) {
  return {
    overview: {
      hero: {
        title: manifest.name || manifest.display_name || 'Strategy',
        subtitle: manifest.summary || manifest.description || '',
        highlights: manifest.capabilities?.slice(0, 3) || []
      },
      cards: [
        {
          title: 'Capabilities',
          icon: 'Zap',
          items: manifest.capabilities || []
        }
      ]
    }
  };
}
