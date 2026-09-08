// src/lib/domains/fhir/adapter.js
/**
 * FHIR Domain Adapter
 *
 * Handles HL7 FHIR R4 resources, profiles, and value sets
 */

import { DomainAdapter } from '../DomainAdapter';
import { DOMAINS, DATA_MODEL_SOURCES, FHIR_MODEL_TYPES, createDataModel } from '../../data-models/types';

/**
 * Common FHIR resource types for categorization
 */
const FHIR_RESOURCE_CATEGORIES = {
  clinical: [
    'Patient', 'Condition', 'Observation', 'Procedure', 'AllergyIntolerance',
    'DiagnosticReport', 'Immunization', 'MedicationRequest', 'MedicationStatement',
    'CarePlan', 'CareTeam', 'Goal', 'Encounter', 'EpisodeOfCare'
  ],
  administrative: [
    'Organization', 'Practitioner', 'PractitionerRole', 'Location', 'HealthcareService',
    'Schedule', 'Slot', 'Appointment', 'AppointmentResponse'
  ],
  financial: [
    'Claim', 'ClaimResponse', 'Coverage', 'ExplanationOfBenefit', 'Account',
    'ChargeItem', 'Invoice', 'PaymentNotice', 'PaymentReconciliation'
  ],
  workflow: [
    'Task', 'ServiceRequest', 'DeviceRequest', 'SupplyRequest', 'VisionPrescription',
    'NutritionOrder', 'ActivityDefinition', 'PlanDefinition'
  ],
  conformance: [
    'StructureDefinition', 'ValueSet', 'CodeSystem', 'ConceptMap', 'CapabilityStatement',
    'OperationDefinition', 'SearchParameter', 'CompartmentDefinition'
  ],
};

/**
 * FHIR Domain Adapter
 */
export class FHIRAdapter extends DomainAdapter {
  static domain = DOMAINS.FHIR;
  static displayName = 'FHIR®';
  static description = 'HL7 FHIR R4 resources for interoperable healthcare data';
  static color = '#e44e37';

  // ============================================
  // Detection & Parsing
  // ============================================

  /**
   * Check if content is FHIR
   */
  static canHandle(file, content) {
    if (typeof content !== 'object' || content === null) {
      return false;
    }

    // Standard FHIR resource check
    if (content.resourceType) {
      return true;
    }

    // FHIR Bundle
    if (content.type === 'Bundle' || content.type === 'bundle') {
      return true;
    }

    // FHIR version indicator
    if (content.fhirVersion) {
      return true;
    }

    // StructureDefinition or other conformance resources
    if (content.kind && content.abstract !== undefined && content.type) {
      return true;
    }

    return false;
  }

  /**
   * Parse FHIR content into a DataModel
   */
  static parse(content, options = {}) {
    try {
      const { fileName = '', source = DATA_MODEL_SOURCES.UPLOAD } = options;

      const resourceType = content.resourceType || 'Unknown';
      const name = content.name || content.title || content.id || fileName.replace(/\.json$/i, '') || resourceType;

      // Determine model type
      let modelType = FHIR_MODEL_TYPES.RESOURCE;
      if (resourceType === 'StructureDefinition') {
        modelType = FHIR_MODEL_TYPES.PROFILE;
      } else if (resourceType === 'ValueSet') {
        modelType = FHIR_MODEL_TYPES.VALUE_SET;
      } else if (resourceType === 'CodeSystem') {
        modelType = FHIR_MODEL_TYPES.CODE_SYSTEM;
      } else if (resourceType === 'Bundle') {
        modelType = FHIR_MODEL_TYPES.BUNDLE;
      }

      // Extract metadata
      const metadata = this.extractFHIRMetadata(content);

      const dataModel = createDataModel({
        name,
        description: content.description || content.text?.div || '',
        domain: DOMAINS.FHIR,
        modelType,
        source,
        version: content.version || '1.0.0',
        domainData: {
          resource: content,
          resourceType,
          id: content.id,
          url: content.url,
          fhirVersion: content.fhirVersion || 'R4',
        },
        metadata: {
          domainMetadata: metadata,
        },
      });

      return {
        success: true,
        dataModel,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to parse FHIR content',
      };
    }
  }

  /**
   * Extract FHIR-specific metadata
   */
  static extractFHIRMetadata(resource) {
    const metadata = {
      resourceType: resource.resourceType,
      id: resource.id,
      url: resource.url,
      version: resource.version,
      status: resource.status,
      publisher: resource.publisher,
      date: resource.date,
      category: this.categorizeResource(resource.resourceType),
    };

    // StructureDefinition specific
    if (resource.resourceType === 'StructureDefinition') {
      metadata.kind = resource.kind;
      metadata.abstract = resource.abstract;
      metadata.baseDefinition = resource.baseDefinition;
      metadata.type = resource.type;
      metadata.elementCount = resource.differential?.element?.length ||
        resource.snapshot?.element?.length || 0;
    }

    // ValueSet specific
    if (resource.resourceType === 'ValueSet') {
      metadata.conceptCount = this.countValueSetConcepts(resource);
    }

    // CodeSystem specific
    if (resource.resourceType === 'CodeSystem') {
      metadata.conceptCount = resource.concept?.length || 0;
      metadata.content = resource.content;
    }

    // Bundle specific
    if (resource.resourceType === 'Bundle') {
      metadata.bundleType = resource.type;
      metadata.entryCount = resource.entry?.length || 0;
      metadata.resourceTypes = [...new Set(
        (resource.entry || []).map(e => e.resource?.resourceType).filter(Boolean)
      )];
    }

    return metadata;
  }

  /**
   * Categorize a resource type
   */
  static categorizeResource(resourceType) {
    for (const [category, types] of Object.entries(FHIR_RESOURCE_CATEGORIES)) {
      if (types.includes(resourceType)) {
        return category;
      }
    }
    return 'other';
  }

  /**
   * Count concepts in a ValueSet
   */
  static countValueSetConcepts(valueSet) {
    let count = 0;

    // Compose section
    if (valueSet.compose?.include) {
      valueSet.compose.include.forEach(inc => {
        if (inc.concept) {
          count += inc.concept.length;
        }
      });
    }

    // Expansion section
    if (valueSet.expansion?.contains) {
      count += valueSet.expansion.contains.length;
    }

    return count;
  }

  /**
   * Validate FHIR DataModel
   */
  static validate(dataModel) {
    const baseValidation = super.validate(dataModel);
    const errors = [...baseValidation.errors];

    if (!dataModel.domainData?.resource) {
      errors.push('Missing resource in domainData');
    }

    if (!dataModel.domainData?.resourceType) {
      errors.push('Missing resourceType');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ============================================
  // Display
  // ============================================

  /**
   * Get model type display name
   */
  static getModelTypeDisplayName(modelType) {
    const names = {
      [FHIR_MODEL_TYPES.RESOURCE]: 'Resource',
      [FHIR_MODEL_TYPES.PROFILE]: 'Profile',
      [FHIR_MODEL_TYPES.VALUE_SET]: 'ValueSet',
      [FHIR_MODEL_TYPES.CODE_SYSTEM]: 'CodeSystem',
      [FHIR_MODEL_TYPES.BUNDLE]: 'Bundle',
    };
    return names[modelType] || modelType;
  }

  /**
   * Get badges for display
   */
  static getBadges(dataModel) {
    const badges = [];
    const md = dataModel.metadata?.domainMetadata || {};

    // Resource type
    if (md.resourceType) {
      badges.push({
        label: md.resourceType,
        color: 'red',
      });
    }

    // Category
    if (md.category && md.category !== 'other') {
      badges.push({
        label: md.category,
        color: 'blue',
      });
    }

    // Status
    if (md.status) {
      const statusColors = {
        active: 'green',
        draft: 'yellow',
        retired: 'gray',
      };
      badges.push({
        label: md.status,
        color: statusColors[md.status] || 'gray',
      });
    }

    // FHIR version
    badges.push({
      label: dataModel.domainData?.fhirVersion || 'R4',
      color: 'purple',
    });

    // Element/concept counts
    if (md.elementCount) {
      badges.push({
        label: `${md.elementCount} elements`,
        color: 'gray',
      });
    }

    if (md.conceptCount) {
      badges.push({
        label: `${md.conceptCount} concepts`,
        color: 'gray',
      });
    }

    return badges;
  }

  /**
   * Get detail tabs
   */
  static getDetailTabs(dataModel) {
    const tabs = [
      { id: 'overview', label: 'Overview', icon: 'Info' },
      { id: 'json', label: 'JSON', icon: 'FileJson' },
    ];

    const md = dataModel.metadata?.domainMetadata || {};

    // Add structure tab for StructureDefinitions
    if (md.resourceType === 'StructureDefinition') {
      tabs.splice(1, 0, { id: 'elements', label: 'Elements', icon: 'List' });
    }

    // Add concepts tab for ValueSets and CodeSystems
    if (['ValueSet', 'CodeSystem'].includes(md.resourceType)) {
      tabs.splice(1, 0, { id: 'concepts', label: 'Concepts', icon: 'Tags' });
    }

    // Add entries tab for Bundles
    if (md.resourceType === 'Bundle') {
      tabs.splice(1, 0, { id: 'entries', label: 'Entries', icon: 'Layers' });
    }

    return tabs;
  }

  // ============================================
  // Filtering
  // ============================================

  /**
   * Get filter options
   */
  static getFilterOptions(dataModels) {
    const facets = this.extractFacets(dataModels);

    return [
      {
        id: 'resourceType',
        label: 'Resource Type',
        type: 'multiselect',
        options: facets.resourceTypes.map(t => ({ value: t, label: t })),
      },
      {
        id: 'category',
        label: 'Category',
        type: 'multiselect',
        options: facets.categories.map(c => ({
          value: c,
          label: c.charAt(0).toUpperCase() + c.slice(1),
        })),
      },
      {
        id: 'status',
        label: 'Status',
        type: 'multiselect',
        options: facets.statuses.map(s => ({ value: s, label: s })),
      },
    ];
  }

  /**
   * Match filter
   */
  static matchesFilter(dataModel, filters) {
    const md = dataModel.metadata?.domainMetadata || {};

    if (filters.resourceType?.length > 0) {
      if (!filters.resourceType.includes(md.resourceType)) {
        return false;
      }
    }

    if (filters.category?.length > 0) {
      if (!filters.category.includes(md.category)) {
        return false;
      }
    }

    if (filters.status?.length > 0) {
      if (!filters.status.includes(md.status)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Extract facets
   */
  static extractFacets(dataModels) {
    const resourceTypes = new Set();
    const categories = new Set();
    const statuses = new Set();

    dataModels.forEach(model => {
      const md = model.metadata?.domainMetadata || {};
      if (md.resourceType) resourceTypes.add(md.resourceType);
      if (md.category) categories.add(md.category);
      if (md.status) statuses.add(md.status);
    });

    return {
      resourceTypes: Array.from(resourceTypes).sort(),
      categories: Array.from(categories).sort(),
      statuses: Array.from(statuses).sort(),
    };
  }

  // ============================================
  // Grouping
  // ============================================

  /**
   * Get grouping options
   */
  static getGroupingOptions() {
    return [
      { id: 'none', label: 'No Grouping' },
      { id: 'resourceType', label: 'By Resource Type' },
      { id: 'category', label: 'By Category' },
    ];
  }

  /**
   * Group DataModels
   */
  static groupDataModels(dataModels, groupingMode) {
    if (groupingMode === 'none') {
      return null;
    }

    const groups = {};

    dataModels.forEach(model => {
      const md = model.metadata?.domainMetadata || {};
      let key;

      if (groupingMode === 'resourceType') {
        key = md.resourceType || 'Unknown';
      } else if (groupingMode === 'category') {
        key = md.category || 'other';
        key = key.charAt(0).toUpperCase() + key.slice(1);
      } else {
        return;
      }

      groups[key] = groups[key] || [];
      groups[key].push(model);
    });

    return groups;
  }

  // ============================================
  // Sample Data
  // ============================================

  /**
   * Get sample categories
   */
  static getSampleCategories() {
    return [
      {
        id: 'clinical',
        label: 'Clinical Resources',
        description: 'Patient, Condition, Observation, and other clinical data types',
        count: 15,
      },
      {
        id: 'conformance',
        label: 'Conformance Resources',
        description: 'StructureDefinitions, ValueSets, and CodeSystems',
        count: 10,
      },
    ];
  }

  /**
   * Load samples
   */
  static async loadSamples(category = 'clinical') {
    // Sample FHIR resources - in a real implementation, this would fetch from an API
    const sampleResources = [
      {
        resourceType: 'Patient',
        id: 'example-patient',
        name: [{ family: 'Doe', given: ['John'] }],
        gender: 'male',
        birthDate: '1970-01-01',
      },
      {
        resourceType: 'Observation',
        id: 'example-observation',
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', code: '29463-7', display: 'Body Weight' }],
        },
        valueQuantity: { value: 70, unit: 'kg' },
      },
      {
        resourceType: 'Condition',
        id: 'example-condition',
        clinicalStatus: {
          coding: [{ code: 'active' }],
        },
        code: {
          coding: [{ system: 'http://snomed.info/sct', code: '73211009', display: 'Diabetes mellitus' }],
        },
      },
    ];

    return sampleResources.map(resource => {
      const result = this.parse(resource, { source: DATA_MODEL_SOURCES.SAMPLE });
      return result.success ? result.dataModel : null;
    }).filter(Boolean);
  }

  // ============================================
  // Export
  // ============================================

  /**
   * Export to native format
   */
  static export(dataModel) {
    return dataModel.domainData?.resource || {};
  }
}

export default FHIRAdapter;
