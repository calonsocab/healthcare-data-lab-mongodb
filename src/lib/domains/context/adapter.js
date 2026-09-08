// src/lib/domains/context/adapter.js
/**
 * Context Object Domain Adapter
 *
 * Handles semantic objects (Context Objects) created in the Builder
 */

import { DomainAdapter } from '../DomainAdapter';
import { DOMAINS, DATA_MODEL_SOURCES, CONTEXT_MODEL_TYPES, createDataModel } from '../../data-models/types';

/**
 * Valid Context Object values
 */
const VALID_SCOPES = ['building_block', 'business_object', 'technical'];
const VALID_ORIGINS = ['custom', 'openehr', 'fhir', 'other'];
const VALID_STATUSES = ['draft', 'active', 'deprecated'];
const VALID_ROLES = ['field', 'group', 'section', 'event', 'event_series'];

/**
 * Context Object Domain Adapter
 */
export class ContextObjectAdapter extends DomainAdapter {
  static domain = DOMAINS.CONTEXT;
  static displayName = 'ContextObjects';
  static description = 'Custom semantic definitions built with the ContextObject Builder';
  static color = '#00ED64';
  static iconPath = null;
  static iconName = null;

  // ============================================
  // Detection & Parsing
  // ============================================

  /**
   * Check if content is a Context Object
   */
  static canHandle(file, content) {
    if (typeof content !== 'object' || content === null) {
      return false;
    }

    // Check for semantic object ID pattern
    if (content.id?.startsWith('so-')) {
      return true;
    }

    // Check for scope field (building_block, business_object, technical)
    if (content.scope && VALID_SCOPES.includes(content.scope)) {
      return true;
    }

    // Check for nodes array with semantic object structure
    if (Array.isArray(content.nodes) && content.nodes.length > 0) {
      const firstNode = content.nodes[0];
      // Context objects have nodes with nodeId, attribute, role, dataType
      if (firstNode.nodeId && firstNode.role && firstNode.dataType) {
        return true;
      }
    }

    return false;
  }

  /**
   * Parse Context Object content into a DataModel
   */
  static parse(content, options = {}) {
    try {
      const { fileName = '', source = DATA_MODEL_SOURCES.UPLOAD } = options;

      const name = content.name || fileName.replace(/\.json$/i, '') || 'Untitled ContextObject';
      const scope = content.scope || CONTEXT_MODEL_TYPES.BUILDING_BLOCK;

      // Extract metadata
      const metadata = this.extractContextMetadata(content);

      const dataModel = createDataModel({
        name,
        description: content.description || '',
        domain: DOMAINS.CONTEXT,
        modelType: scope,
        source: content.origin === 'builder' ? DATA_MODEL_SOURCES.BUILDER : source,
        status: content.status || 'active',
        version: content.versionString || `${Math.floor((content.version || 1000) / 1000)}.0.0`,
        domainData: {
          semanticObject: content,
          id: content.id,
          scope: content.scope,
          origin: content.origin,
          nodes: content.nodes,
          terminologyBindings: content.terminologyBindings,
          structuralBindings: content.structuralBindings,
        },
        metadata: {
          tags: content.metadata?.tags || [],
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
        error: error.message || 'Failed to parse ContextObject',
      };
    }
  }

  /**
   * Extract Context Object metadata
   */
  static extractContextMetadata(obj) {
    const nodes = obj.nodes || [];
    const rootNode = nodes.find(n => !n.parentNodeId);

    // Count nodes by role
    const roleCounts = {};
    const dataTypeCounts = {};

    nodes.forEach(node => {
      // Count roles
      if (node.role) {
        roleCounts[node.role] = (roleCounts[node.role] || 0) + 1;
      }
      // Count data types
      if (node.dataType) {
        dataTypeCounts[node.dataType] = (dataTypeCounts[node.dataType] || 0) + 1;
      }
    });

    return {
      id: obj.id,
      scope: obj.scope,
      origin: obj.origin,
      status: obj.status,
      version: obj.version,
      versionString: obj.versionString,
      nodeCount: nodes.length,
      fieldCount: roleCounts.field || 0,
      groupCount: roleCounts.group || 0,
      sectionCount: roleCounts.section || 0,
      roleCounts,
      dataTypeCounts,
      hasTerminologyBindings: (obj.terminologyBindings?.length || 0) > 0,
      hasStructuralBindings: (obj.structuralBindings?.length || 0) > 0,
      rootNodeId: rootNode?.nodeId,
      tags: obj.metadata?.tags || [],
      createdBy: obj.metadata?.createdBy,
      createdAt: obj.metadata?.createdAt,
      updatedAt: obj.metadata?.updatedAt,
    };
  }

  /**
   * Validate Context Object DataModel
   */
  static validate(dataModel) {
    const baseValidation = super.validate(dataModel);
    const errors = [...baseValidation.errors];

    const obj = dataModel.domainData?.semanticObject;

    if (!obj) {
      errors.push('Missing semanticObject in domainData');
      return { valid: false, errors };
    }

    // Validate scope
    if (obj.scope && !VALID_SCOPES.includes(obj.scope)) {
      errors.push(`Invalid scope: ${obj.scope}. Must be one of: ${VALID_SCOPES.join(', ')}`);
    }

    // Validate origin
    if (obj.origin && !VALID_ORIGINS.includes(obj.origin)) {
      errors.push(`Invalid origin: ${obj.origin}. Must be one of: ${VALID_ORIGINS.join(', ')}`);
    }

    // Validate status
    if (obj.status && !VALID_STATUSES.includes(obj.status)) {
      errors.push(`Invalid status: ${obj.status}. Must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    // Validate nodes exist
    if (!Array.isArray(obj.nodes) || obj.nodes.length === 0) {
      errors.push('ContextObject must have at least one node');
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
      [CONTEXT_MODEL_TYPES.BUILDING_BLOCK]: 'Building Block',
      [CONTEXT_MODEL_TYPES.BUSINESS_OBJECT]: 'Business Object',
      [CONTEXT_MODEL_TYPES.TECHNICAL]: 'Technical',
    };
    return names[modelType] || modelType;
  }

  /**
   * Get badges for display
   */
  static getBadges(dataModel) {
    const badges = [];
    const md = dataModel.metadata?.domainMetadata || {};

    // Scope
    const scopeColors = {
      building_block: 'blue',
      business_object: 'purple',
      technical: 'gray',
    };
    badges.push({
      label: this.getModelTypeDisplayName(md.scope),
      color: scopeColors[md.scope] || 'gray',
    });

    // Origin
    if (md.origin && md.origin !== 'custom') {
      const originColors = {
        openehr: 'teal',
        fhir: 'red',
        other: 'gray',
      };
      badges.push({
        label: md.origin,
        color: originColors[md.origin] || 'gray',
      });
    }

    // Status
    if (md.status) {
      const statusColors = {
        active: 'green',
        draft: 'yellow',
        deprecated: 'gray',
      };
      badges.push({
        label: md.status,
        color: statusColors[md.status] || 'gray',
      });
    }

    // Node count
    if (md.nodeCount) {
      badges.push({
        label: `${md.nodeCount} nodes`,
        color: 'gray',
      });
    }

    // Field count
    if (md.fieldCount) {
      badges.push({
        label: `${md.fieldCount} fields`,
        color: 'indigo',
      });
    }

    return badges;
  }

  /**
   * Get detail tabs
   */
  static getDetailTabs(dataModel) {
    return [
      { id: 'structure', label: 'Structure', icon: 'Layers' },
      { id: 'tree', label: 'Tree View', icon: 'GitBranch' },
      { id: 'fields', label: 'Fields', icon: 'List' },
      { id: 'json', label: 'JSON', icon: 'FileJson' },
    ];
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
        id: 'scope',
        label: 'Scope',
        type: 'multiselect',
        options: facets.scopes.map(s => ({
          value: s,
          label: this.getModelTypeDisplayName(s),
        })),
      },
      {
        id: 'origin',
        label: 'Origin',
        type: 'multiselect',
        options: facets.origins.map(o => ({ value: o, label: o })),
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

    if (filters.scope?.length > 0) {
      if (!filters.scope.includes(md.scope)) {
        return false;
      }
    }

    if (filters.origin?.length > 0) {
      if (!filters.origin.includes(md.origin)) {
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
    const scopes = new Set();
    const origins = new Set();
    const statuses = new Set();

    dataModels.forEach(model => {
      const md = model.metadata?.domainMetadata || {};
      if (md.scope) scopes.add(md.scope);
      if (md.origin) origins.add(md.origin);
      if (md.status) statuses.add(md.status);
    });

    return {
      scopes: Array.from(scopes),
      origins: Array.from(origins),
      statuses: Array.from(statuses),
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
      { id: 'scope', label: 'By Scope' },
      { id: 'origin', label: 'By Origin' },
      { id: 'status', label: 'By Status' },
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

      if (groupingMode === 'scope') {
        key = this.getModelTypeDisplayName(md.scope) || 'Unknown';
      } else if (groupingMode === 'origin') {
        key = md.origin || 'custom';
      } else if (groupingMode === 'status') {
        key = md.status || 'draft';
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
        id: 'building_blocks',
        label: 'Building Blocks',
        description: 'Reusable semantic building blocks for common data patterns',
        count: 5,
      },
      {
        id: 'business_objects',
        label: 'Business Objects',
        description: 'Complete business entities for clinical workflows',
        count: 3,
      },
    ];
  }

  /**
   * Load samples
   */
  static async loadSamples(category = 'building_blocks') {
    try {
      const response = await fetch('/api/semantic-objects?status=active&limit=50');
      if (!response.ok) {
        throw new Error('Failed to fetch semantic objects');
      }

      const objects = await response.json();

      return objects.map(obj => {
        const result = this.parse(obj, { source: DATA_MODEL_SOURCES.SAMPLE });
        return result.success ? result.dataModel : null;
      }).filter(Boolean);
    } catch (error) {
      console.error('Failed to load Context Object samples:', error);
      return [];
    }
  }

  // ============================================
  // Builder Integration
  // ============================================

  /**
   * Sync with Context Object Builder
   * Called when objects are created/updated in the Builder
   */
  static async syncFromBuilder(semanticObjectId) {
    try {
      const response = await fetch(`/api/semantic-objects/${semanticObjectId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch semantic object');
      }

      const obj = await response.json();
      return this.parse(obj, { source: DATA_MODEL_SOURCES.BUILDER });
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================
  // Export
  // ============================================

  /**
   * Export to native format
   */
  static export(dataModel) {
    return dataModel.domainData?.semanticObject || {};
  }
}

export default ContextObjectAdapter;
