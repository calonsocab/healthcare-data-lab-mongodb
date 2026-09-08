// src/lib/data-models/types.js
/**
 * DataModel Type Definitions
 *
 * A DataModel is a unified representation of data schemas across different
 * healthcare and semantic domains (OpenEHR, FHIR, Context Objects, etc.)
 */

/**
 * @typedef {'openehr' | 'fhir' | 'context' | 'snomed' | 'dicom' | 'custom'} Domain
 */

/**
 * @typedef {'upload' | 'builder' | 'sample' | 'import'} DataModelSource
 */

/**
 * @typedef {'draft' | 'active' | 'deprecated'} DataModelStatus
 */

/**
 * Domain-specific constants
 */
export const DOMAINS = {
  OPENEHR: 'openehr',
  FHIR: 'fhir',
  CONTEXT: 'context',
  SNOMED: 'snomed',
  DICOM: 'dicom',
  CUSTOM: 'custom',
};

export const DATA_MODEL_SOURCES = {
  UPLOAD: 'upload',
  BUILDER: 'builder',
  SAMPLE: 'sample',
  IMPORT: 'import',
};

export const DATA_MODEL_STATUSES = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  DEPRECATED: 'deprecated',
};

/**
 * OpenEHR-specific model types
 */
export const OPENEHR_MODEL_TYPES = {
  COMPOSITION: 'composition',
  TEMPLATE: 'template',
  ARCHETYPE: 'archetype',
};

/**
 * FHIR-specific model types
 */
export const FHIR_MODEL_TYPES = {
  RESOURCE: 'resource',
  PROFILE: 'profile',
  VALUE_SET: 'valueset',
  CODE_SYSTEM: 'codesystem',
  BUNDLE: 'bundle',
};

/**
 * Context Object-specific model types (scopes)
 */
export const CONTEXT_MODEL_TYPES = {
  BUILDING_BLOCK: 'building_block',
  BUSINESS_OBJECT: 'business_object',
  TECHNICAL: 'technical',
};

/**
 * Domain display information
 */
export const DOMAIN_INFO = {
  [DOMAINS.OPENEHR]: {
    name: 'openEHR®',
    description: 'Clinical templates for structured data capture',
    color: '#00a99d',
    externalLink: 'https://tools.openehr.org/designer/',
    externalLinkText: 'openEHR® Designer',
  },
  [DOMAINS.FHIR]: {
    name: 'FHIR®',
    description: 'HL7 FHIR R4 resources for interoperable healthcare data',
    color: '#e44e37',
    externalLink: 'https://www.hl7.org/fhir/',
    externalLinkText: 'FHIR® Documentation',
  },
  [DOMAINS.CONTEXT]: {
    name: 'ContextObjects',
    description: 'Custom semantic definitions built with the ContextObject Builder',
    color: '#00ED64',
    externalLink: null,
    externalLinkText: 'Open Builder',
    isInternal: true,
  },
  [DOMAINS.SNOMED]: {
    name: 'SNOMED CT',
    description: 'Clinical terminology and ontology',
    icon: '/images/snomed.png',
    color: '#0072bc',
    externalLink: 'https://browser.ihtsdotools.org/',
    externalLinkText: 'SNOMED Browser',
  },
  [DOMAINS.DICOM]: {
    name: 'DICOM',
    description: 'Medical imaging data standards',
    icon: '/images/dicom.png',
    color: '#ffb81c',
    externalLink: 'https://www.dicomstandard.org/',
    externalLinkText: 'DICOM Standard',
  },
  [DOMAINS.CUSTOM]: {
    name: 'Custom',
    description: 'Custom data models',
    icon: null,
    color: '#64748b',
    externalLink: null,
    externalLinkText: null,
  },
};

/**
 * @typedef {Object} DataModelAudit
 * @property {Date} createdAt
 * @property {string} createdBy
 * @property {Date} [updatedAt]
 * @property {string} [updatedBy]
 */

/**
 * @typedef {Object} DataModelMetadata
 * @property {string[]} [tags] - User-defined tags
 * @property {string} [folder] - Folder/category for organization
 * @property {Object} [domainMetadata] - Domain-specific metadata (archetypes, languages, etc.)
 */

/**
 * @typedef {Object} DataModel
 * @property {string} _id - MongoDB ObjectId
 * @property {string} name - Display name
 * @property {string} [description] - Description
 * @property {Domain} domain - The domain (openehr, fhir, context, etc.)
 * @property {string} modelType - Domain-specific type (composition, resource, building_block)
 * @property {DataModelSource} source - How the model was added
 * @property {DataModelStatus} status - Current status
 * @property {string} [version] - Version string
 * @property {Object} domainData - Domain-specific payload (webTemplate, fhirResource, etc.)
 * @property {DataModelMetadata} metadata - Metadata including tags and domain-specific info
 * @property {DataModelAudit} audit - Audit information
 */

/**
 * Create a new DataModel object with defaults
 * @param {Partial<DataModel>} data - Partial data model
 * @returns {DataModel}
 */
export function createDataModel(data) {
  return {
    name: data.name || 'Untitled',
    description: data.description || '',
    domain: data.domain || DOMAINS.CUSTOM,
    modelType: data.modelType || 'unknown',
    source: data.source || DATA_MODEL_SOURCES.UPLOAD,
    status: data.status || DATA_MODEL_STATUSES.ACTIVE,
    version: data.version || '1.0.0',
    domainData: data.domainData || {},
    metadata: {
      tags: data.metadata?.tags || [],
      folder: data.metadata?.folder || null,
      domainMetadata: data.metadata?.domainMetadata || {},
      ...data.metadata,
    },
    audit: {
      createdAt: data.audit?.createdAt || new Date(),
      createdBy: data.audit?.createdBy || 'system',
      updatedAt: data.audit?.updatedAt || null,
      updatedBy: data.audit?.updatedBy || null,
    },
  };
}

/**
 * Validate a DataModel object
 * @param {DataModel} model
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateDataModel(model) {
  const errors = [];

  if (!model.name || typeof model.name !== 'string') {
    errors.push('Name is required and must be a string');
  }

  if (!model.domain || !Object.values(DOMAINS).includes(model.domain)) {
    errors.push(`Invalid domain: ${model.domain}. Must be one of: ${Object.values(DOMAINS).join(', ')}`);
  }

  if (!model.source || !Object.values(DATA_MODEL_SOURCES).includes(model.source)) {
    errors.push(`Invalid source: ${model.source}. Must be one of: ${Object.values(DATA_MODEL_SOURCES).join(', ')}`);
  }

  if (!model.status || !Object.values(DATA_MODEL_STATUSES).includes(model.status)) {
    errors.push(`Invalid status: ${model.status}. Must be one of: ${Object.values(DATA_MODEL_STATUSES).join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get domain info by domain key
 * @param {Domain} domain
 * @returns {Object}
 */
export function getDomainInfo(domain) {
  return DOMAIN_INFO[domain] || DOMAIN_INFO[DOMAINS.CUSTOM];
}

/**
 * Check if a domain is enabled/supported
 * @param {Domain} domain
 * @returns {boolean}
 */
export function isDomainEnabled(domain) {
  // For now, all listed domains are enabled
  // This can be controlled by feature flags in the future
  return Object.values(DOMAINS).includes(domain);
}

export default {
  DOMAINS,
  DATA_MODEL_SOURCES,
  DATA_MODEL_STATUSES,
  OPENEHR_MODEL_TYPES,
  FHIR_MODEL_TYPES,
  CONTEXT_MODEL_TYPES,
  DOMAIN_INFO,
  createDataModel,
  validateDataModel,
  getDomainInfo,
  isDomainEnabled,
};
