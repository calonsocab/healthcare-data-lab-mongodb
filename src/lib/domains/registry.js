// src/lib/domains/registry.js
/**
 * Domain Registry
 *
 * Central registry for all domain adapters.
 * Provides detection, parsing, and adapter lookup functionality.
 */

import { DOMAINS, DOMAIN_INFO } from '../data-models/types';
import { OpenEHRAdapter } from './openehr/adapter';
import { FHIRAdapter } from './fhir/adapter';
import { ContextObjectAdapter } from './context/adapter';

/**
 * Registry of all domain adapters
 */
export const domainAdapters = {
  [DOMAINS.OPENEHR]: OpenEHRAdapter,
  [DOMAINS.FHIR]: FHIRAdapter,
  [DOMAINS.CONTEXT]: ContextObjectAdapter,
};

/**
 * Order of detection (most specific first)
 */
const DETECTION_ORDER = [
  DOMAINS.OPENEHR,   // Check OpenEHR first (has specific patterns)
  DOMAINS.FHIR,      // Then FHIR (has resourceType)
  DOMAINS.CONTEXT,   // Then Context Objects (has scope/nodes)
];

/**
 * Get adapter for a specific domain
 * @param {string} domain - Domain identifier
 * @returns {typeof import('./DomainAdapter').DomainAdapter | null}
 */
export function getAdapter(domain) {
  return domainAdapters[domain] || null;
}

/**
 * Get all registered domain adapters
 * @returns {Object}
 */
export function getAllAdapters() {
  return { ...domainAdapters };
}

/**
 * Get list of enabled domains
 * @returns {string[]}
 */
export function getEnabledDomains() {
  return Object.keys(domainAdapters);
}

/**
 * Get domain info with adapter capabilities
 * @param {string} domain - Domain identifier
 * @returns {Object}
 */
export function getDomainConfig(domain) {
  const adapter = getAdapter(domain);
  const info = DOMAIN_INFO[domain] || {};

  return {
    ...info,
    domain,
    adapter,
    enabled: !!adapter,
    displayName: adapter?.displayName || info.name || domain,
    description: adapter?.description || info.description || '',
    color: adapter?.color || info.color || '#64748b',
    icon: adapter?.getIcon() || { type: 'icon', value: 'File' },
  };
}

/**
 * Get all domain configs
 * @returns {Object[]}
 */
export function getAllDomainConfigs() {
  return Object.keys(DOMAINS)
    .map(key => getDomainConfig(DOMAINS[key]))
    .filter(config => config.enabled);
}

/**
 * Auto-detect domain from file and content
 * @param {File|null} file - The uploaded file (if available)
 * @param {Object|string} content - The parsed content
 * @returns {{ domain: string | null, adapter: typeof import('./DomainAdapter').DomainAdapter | null, confidence: number }}
 */
export function detectDomain(file, content) {
  for (const domain of DETECTION_ORDER) {
    const adapter = domainAdapters[domain];
    if (adapter && adapter.canHandle(file, content)) {
      return {
        domain,
        adapter,
        confidence: 1.0,
      };
    }
  }

  return {
    domain: null,
    adapter: null,
    confidence: 0,
  };
}

/**
 * Parse content using auto-detection
 * @param {Object|string} content - The content to parse
 * @param {Object} options - Parsing options
 * @returns {Promise<{ success: boolean, dataModel?: Object, domain?: string, error?: string }>}
 */
export async function parseWithAutoDetect(content, options = {}) {
  const { file, fileName, source } = options;

  // Detect domain
  const detection = detectDomain(file, content);

  if (!detection.adapter) {
    return {
      success: false,
      error: 'Unable to detect domain. Please select a domain manually.',
    };
  }

  // Parse with detected adapter
  const result = await detection.adapter.parse(content, {
    fileName: fileName || file?.name,
    source,
  });

  if (result.success) {
    return {
      ...result,
      domain: detection.domain,
    };
  }

  return result;
}

/**
 * Parse content with a specific domain adapter
 * @param {string} domain - Domain identifier
 * @param {Object|string} content - The content to parse
 * @param {Object} options - Parsing options
 * @returns {Promise<{ success: boolean, dataModel?: Object, error?: string }>}
 */
export async function parseWithDomain(domain, content, options = {}) {
  const adapter = getAdapter(domain);

  if (!adapter) {
    return {
      success: false,
      error: `Unknown domain: ${domain}`,
    };
  }

  return adapter.parse(content, options);
}

/**
 * Validate a DataModel using its domain adapter
 * @param {Object} dataModel - The DataModel to validate
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDataModel(dataModel) {
  const adapter = getAdapter(dataModel.domain);

  if (!adapter) {
    return {
      valid: false,
      errors: [`Unknown domain: ${dataModel.domain}`],
    };
  }

  return adapter.validate(dataModel);
}

/**
 * Get filter options for a domain
 * @param {string} domain - Domain identifier
 * @param {Object[]} dataModels - DataModels to extract facets from
 * @returns {Array}
 */
export function getFilterOptions(domain, dataModels) {
  const adapter = getAdapter(domain);
  return adapter ? adapter.getFilterOptions(dataModels) : [];
}

/**
 * Get filter options for all domains combined
 * @param {Object[]} dataModels - All DataModels
 * @returns {Object} - Filter options by domain
 */
export function getAllFilterOptions(dataModels) {
  const result = {};

  // Group DataModels by domain
  const byDomain = {};
  dataModels.forEach(model => {
    const domain = model.domain;
    byDomain[domain] = byDomain[domain] || [];
    byDomain[domain].push(model);
  });

  // Get filter options for each domain
  for (const [domain, models] of Object.entries(byDomain)) {
    result[domain] = getFilterOptions(domain, models);
  }

  return result;
}

/**
 * Group DataModels using domain-specific grouping
 * @param {Object[]} dataModels - DataModels to group
 * @param {string} groupingMode - Grouping mode
 * @param {string} [domain] - Optional domain for domain-specific grouping
 * @returns {Object | null}
 */
export function groupDataModels(dataModels, groupingMode, domain = null) {
  if (groupingMode === 'domain') {
    // Special grouping by domain
    const groups = {};
    dataModels.forEach(model => {
      const d = model.domain;
      const config = getDomainConfig(d);
      const key = config.displayName;
      groups[key] = groups[key] || [];
      groups[key].push(model);
    });
    return groups;
  }

  // If domain specified, use domain-specific grouping
  if (domain) {
    const adapter = getAdapter(domain);
    if (adapter) {
      const domainModels = dataModels.filter(m => m.domain === domain);
      return adapter.groupDataModels(domainModels, groupingMode);
    }
  }

  // Default: no grouping
  return null;
}

/**
 * Get grouping options for a domain
 * @param {string} domain - Domain identifier
 * @returns {Array}
 */
export function getGroupingOptions(domain) {
  const adapter = getAdapter(domain);
  const baseOptions = [
    { id: 'none', label: 'No Grouping' },
    { id: 'domain', label: 'By Domain' },
  ];

  if (adapter) {
    const domainOptions = adapter.getGroupingOptions();
    // Merge, avoiding duplicates
    const merged = [...baseOptions];
    domainOptions.forEach(opt => {
      if (!merged.find(m => m.id === opt.id)) {
        merged.push(opt);
      }
    });
    return merged;
  }

  return baseOptions;
}

/**
 * Get sample categories across all domains
 * @returns {Object[]}
 */
export function getAllSampleCategories() {
  const categories = [];

  for (const [domain, adapter] of Object.entries(domainAdapters)) {
    const domainCategories = adapter.getSampleCategories();
    categories.push(...domainCategories.map(cat => ({
      ...cat,
      domain,
      domainName: adapter.displayName,
    })));
  }

  return categories;
}

/**
 * Load samples for a specific domain
 * @param {string} domain - Domain identifier
 * @param {string} [category] - Optional category
 * @returns {Promise<Object[]>}
 */
export async function loadSamples(domain, category) {
  const adapter = getAdapter(domain);
  if (!adapter) {
    return [];
  }

  return adapter.loadSamples(category);
}

// Export for convenience
export {
  OpenEHRAdapter,
  FHIRAdapter,
  ContextObjectAdapter,
};

export default {
  domainAdapters,
  getAdapter,
  getAllAdapters,
  getEnabledDomains,
  getDomainConfig,
  getAllDomainConfigs,
  detectDomain,
  parseWithAutoDetect,
  parseWithDomain,
  validateDataModel,
  getFilterOptions,
  getAllFilterOptions,
  groupDataModels,
  getGroupingOptions,
  getAllSampleCategories,
  loadSamples,
};
