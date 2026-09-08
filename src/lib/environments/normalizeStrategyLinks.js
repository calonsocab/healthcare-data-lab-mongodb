/**
 * Normalize strategy links to be domain-keyed and deduplicated.
 */
import { normalizeSearchRefresh } from './searchRefresh.js';
import { normalizeActivationRuntimeState } from './strategyActivationStatus.js';

export function normalizeStrategyLinks(links = []) {
  const cleaned = links
    .filter(link => !!(link?.strategyId || link?.kehrnel?.strategyId))
    .map(link => {
      const legacyKey = Object.keys(link || {}).find(k => k.toLowerCase().includes('product') && k.toLowerCase().includes('type'));
      const legacyDomain = legacyKey ? link[legacyKey] : null;
      const domain = link.domain || legacyDomain || 'openEHR';
      const normalizedStrategyId = link.strategyId || link.kehrnel?.strategyId || null;
      return {
        id: link.id || `link-${domain.toLowerCase()}-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`,
        domain,
        strategyId: normalizedStrategyId,
        strategyName: link.strategyName || '',
        targetDatabase: link.targetDatabase || null,
        strategyVersion: link.strategyVersion || null,
        activationId: link.activationId || link.kehrnel?.activationId || null,
        manifestDigest: link.manifestDigest || null,
        configHash: link.configHash || null,
        configOverrides: link.configOverrides || {}, // Custom config overrides (diff from default)
        mergedConfig: link.mergedConfig || null,
        contexts: {
          synthetic: link.contexts?.synthetic !== false, // Default true
          query: link.contexts?.query !== false, // Default true
          api: !!link.contexts?.api,
        },
        notes: link.notes || '',
        searchRefresh: normalizeSearchRefresh(link.searchRefresh),
        // Kehrnel activation metadata (preserved if present)
        kehrnel: normalizeActivationRuntimeState(link.kehrnel),
      };
    });

  // Group by domain - enforce ONE strategy per domain
  const byDomain = {};
  for (const link of cleaned) {
    byDomain[link.domain] = link; // Last one wins if duplicates
  }
  return Object.values(byDomain);
}

export default normalizeStrategyLinks;
