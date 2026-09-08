// src/lib/data-models/index.js
/**
 * Data Models System Exports
 *
 * Central export point for DataModel types and utilities.
 */

export {
  // Constants
  DOMAINS,
  DATA_MODEL_SOURCES,
  DATA_MODEL_STATUSES,
  OPENEHR_MODEL_TYPES,
  FHIR_MODEL_TYPES,
  CONTEXT_MODEL_TYPES,
  DOMAIN_INFO,

  // Factory functions
  createDataModel,

  // Validation
  validateDataModel,

  // Utilities
  getDomainInfo,
  isDomainEnabled,

  // Default export
  default,
} from './types';

export {
  getCachedDataModel,
  setCachedDataModel,
  primeDataModelSummaryList,
  fetchDataModelDetail,
  invalidateDataModelCache,
  clearDataModelCache,
} from './clientCache';
