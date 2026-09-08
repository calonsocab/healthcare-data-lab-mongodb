// src/lib/domains/index.js
/**
 * Domain System Exports
 *
 * Central export point for all domain-related functionality.
 */

// Base adapter
export { DomainAdapter } from './DomainAdapter';

// Domain adapters
export { OpenEHRAdapter } from './openehr/adapter';
export { FHIRAdapter } from './fhir/adapter';
export { ContextObjectAdapter } from './context/adapter';

// Registry and utilities
export {
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
} from './registry';

// Default export
export { default } from './registry';
