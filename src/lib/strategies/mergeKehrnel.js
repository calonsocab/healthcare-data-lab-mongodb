// src/lib/strategies/mergeKehrnel.js
/**
 * Merge Kehrnel manifests into local strategies without losing local narrative/UX.
 * - Local strategies remain the source for narrative (tabs, pick/avoid, scorecards).
 * - Kehrnel manifests provide runtime bits: version, protocols, capabilities,
 *   config_schema/default_config, ui links/tags, code/docs links.
 */

const MANIFEST_FIELDS = [
  "version",
  "protocols",
  "capabilities",
  "config_schema",
  "default_config",
  "ui",
  "description",
  "summary",
  "keywords",
  "license",
  "maturity",
  "entrypoint",
  "adapters",
  "compatibility",
];

export function mergeKehrnelManifests(localStrategies = [], kehrnelManifests = []) {
  const manifestById = Object.fromEntries(
    (kehrnelManifests || []).map((m) => [m.id || m.strategy_id || m.name, m])
  );

  // Helper to find manifest by various ID formats
  const findManifest = (strategy) => {
    // Try exact kehrnelId first
    if (strategy.kehrnelId && manifestById[strategy.kehrnelId]) {
      return manifestById[strategy.kehrnelId];
    }
    // Try blueprint.id (might have underscore vs dot difference)
    const blueprintId = strategy.blueprint?.id;
    if (blueprintId) {
      // Try exact match
      if (manifestById[blueprintId]) return manifestById[blueprintId];
      // Try converting underscore to dot (openehr_rps_dual -> openehr.rps_dual)
      const dotVersion = blueprintId.replace(/_/g, '.');
      if (manifestById[dotVersion]) return manifestById[dotVersion];
      // Try converting dot to underscore
      const underscoreVersion = blueprintId.replace(/\./g, '_');
      if (manifestById[underscoreVersion]) return manifestById[underscoreVersion];
    }
    return null;
  };

  return localStrategies.map((s) => {
    const manifest = findManifest(s);
    if (!manifest) return s;

    const merged = { ...s, source: "kehrnel" };

    // overlay runtime fields from manifest
    for (const f of MANIFEST_FIELDS) {
      if (manifest[f] !== undefined) merged[f] = manifest[f];
    }

    // map ui.links into meta.links for UI consumption if present
    if (manifest.ui?.links) {
      merged.meta = merged.meta || {};
      merged.meta.links = manifest.ui.links;
    }

    // Extract source links from manifest for easy access
    if (manifest.ui?.links) {
      merged.source_links = {
        source: manifest.ui.links.source,
        docs: manifest.ui.links.docs,
        libs: manifest.ui.links.libs,
        // Additional component links
        ...(manifest.ui.links.flattener && { flattener: manifest.ui.links.flattener }),
        ...(manifest.ui.links.remap && { remap: manifest.ui.links.remap }),
      };
    }

    // Extract icon and accent color from manifest UI
    if (manifest.ui?.icon) {
      merged.icon = manifest.ui.icon;
    }
    if (manifest.ui?.accent_color) {
      merged.accentColor = manifest.ui.accent_color;
    }

    // ensure tags incorporate manifest tags
    const manifestTags = manifest.ui?.tags || manifest.tags || [];
    merged.tags = Array.from(new Set([...(s.tags || []), ...manifestTags]));

    // store manifest separately for debugging
    merged.kehrnelManifest = manifest;

    return merged;
  });
}

/**
 * Default GitHub configuration for Kehrnel source links
 */
export const DEFAULT_KEHRNEL_GITHUB = {
  repo: 'mongodb-industry-solutions/kehrnel',
  branch: 'main',
  baseUrl: 'https://github.com/mongodb-industry-solutions/kehrnel/blob/main'
};

/**
 * Build a full GitHub URL from a relative path
 * @param {string} path - Relative path in the repo (e.g., "src/strategies/openehr/rps_dual.py")
 * @param {object} githubConfig - GitHub configuration object
 * @returns {string} Full GitHub URL
 */
export function buildGitHubUrl(path, githubConfig = DEFAULT_KEHRNEL_GITHUB) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${githubConfig.baseUrl}/${path}`;
}

/**
 * Extract source links from a strategy with full GitHub URLs
 * @param {object} strategy - Strategy object (with kehrnelManifest or source_links)
 * @param {object} githubConfig - GitHub configuration object
 * @returns {object} Object with full GitHub URLs for source, docs, libs, etc.
 */
export function getStrategySourceLinks(strategy, githubConfig = DEFAULT_KEHRNEL_GITHUB) {
  const links = strategy?.source_links || strategy?.kehrnelManifest?.ui?.links || {};

  return {
    source: buildGitHubUrl(links.source, githubConfig),
    docs: buildGitHubUrl(links.docs, githubConfig),
    libs: buildGitHubUrl(links.libs, githubConfig),
    flattener: buildGitHubUrl(links.flattener, githubConfig),
    remap: buildGitHubUrl(links.remap, githubConfig),
  };
}

export default {
  mergeKehrnelManifests,
  DEFAULT_KEHRNEL_GITHUB,
  buildGitHubUrl,
  getStrategySourceLinks
};
