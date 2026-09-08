import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/persistence-strategies/[id]/route.js
/**
 * Individual Strategy API - Kehrnel-sourced Strategy
 *
 * Strategy definitions come exclusively from Kehrnel.
 * This endpoint proxies to Kehrnel's strategy API.
 */
import { getCoreDb } from '@/lib/db/coreDb';
import { createKehrnelService } from '@/lib/kehrnel/KehrnelService';

export async function GET(request, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const strategyId = params?.id;
    if (!strategyId) {
      return Response.json({ error: 'Strategy ID is required' }, { status: 400 });
    }

    const db = await getCoreDb();
    const service = createKehrnelService(db);

    const url = new URL(request.url);
    const connectionId = url.searchParams.get('connectionId');

    // Try to fetch from Kehrnel first by direct ID
    let manifest = null;
    try {
      manifest = await service.getStrategy(strategyId, { connectionId });
    } catch (err) {
      // If direct fetch fails, try listing and finding by ID
      if (err.status === 404) {
        try {
          const result = await service.listStrategies({ connectionId });
          const strategies = result.strategies || [];
          manifest = strategies.find(s =>
            s.id === strategyId ||
            s.strategy_id === strategyId ||
            s.name === strategyId
          );
        } catch (listErr) {
          console.error('Failed to list strategies from Kehrnel:', listErr.message);
        }
      } else {
        console.error('Failed to fetch strategy from Kehrnel:', err.message);
      }
    }

    if (!manifest) {
      return Response.json({ error: 'Strategy not found' }, { status: 404 });
    }

    // Transform to expected response format
    const transformed = transformKehrnelStrategy(manifest);

    return Response.json(transformed);
  } catch (error) {
    console.error('GET /api/persistence-strategies/[id] error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT - Strategy updates are NOT allowed.
 * Strategies are defined in Kehrnel only.
 */
export async function PUT() {
  return Response.json(
    {
      error: 'Strategy modification is not allowed. Strategies are read-only definitions from Kehrnel. ' +
             'Use the environment strategy endpoint (PATCH /api/environments/strategy) to customize configuration.'
    },
    { status: 403 }
  );
}

/**
 * DELETE - Strategy deletion is NOT allowed.
 * Strategies are defined in Kehrnel only.
 */
export async function DELETE() {
  return Response.json(
    {
      error: 'Strategy deletion is not allowed. Strategies are read-only definitions from Kehrnel.'
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
