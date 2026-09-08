// src/lib/domains/DomainAdapter.js
/**
 * Domain Adapter Interface
 *
 * Each domain (OpenEHR, FHIR, Context Objects, etc.) implements this interface
 * to provide domain-specific functionality while maintaining a unified API.
 */

/**
 * @typedef {Object} ParseResult
 * @property {boolean} success - Whether parsing succeeded
 * @property {Object} [dataModel] - The parsed DataModel object
 * @property {string} [error] - Error message if parsing failed
 */

/**
 * @typedef {Object} FilterOption
 * @property {string} id - Unique identifier for the filter
 * @property {string} label - Display label
 * @property {string} type - Filter type: 'select', 'multiselect', 'boolean', 'text'
 * @property {Array} [options] - Available options for select/multiselect
 */

/**
 * @typedef {Object} Action
 * @property {string} id - Action identifier
 * @property {string} label - Display label
 * @property {string} [icon] - Lucide icon name
 * @property {Function} handler - Action handler function
 */

/**
 * @typedef {Object} Tab
 * @property {string} id - Tab identifier
 * @property {string} label - Display label
 * @property {string} [icon] - Lucide icon name
 * @property {React.Component} component - Tab content component
 */

/**
 * @typedef {Object} SampleCategory
 * @property {string} id - Category identifier
 * @property {string} label - Display label
 * @property {string} description - Category description
 * @property {number} count - Number of samples available
 */

/**
 * Base Domain Adapter class
 * All domain-specific adapters should extend this class
 */
export class DomainAdapter {
  /**
   * Domain identifier
   * @type {string}
   */
  static domain = 'unknown';

  /**
   * Human-readable domain name
   * @type {string}
   */
  static displayName = 'Unknown Domain';

  /**
   * Domain description
   * @type {string}
   */
  static description = '';

  /**
   * Domain color (hex)
   * @type {string}
   */
  static color = '#64748b';

  /**
   * Path to domain icon image, or null for Lucide icon
   * @type {string|null}
   */
  static iconPath = null;

  /**
   * Lucide icon name (if iconPath is null)
   * @type {string}
   */
  static iconName = 'File';

  // ============================================
  // Detection & Parsing
  // ============================================

  /**
   * Check if this adapter can handle the given file/content
   * @param {File|null} file - The uploaded file (if available)
   * @param {Object|string} content - The parsed content
   * @returns {boolean}
   */
  static canHandle(file, content) {
    throw new Error('DomainAdapter.canHandle must be implemented');
  }

  /**
   * Parse content into a DataModel object
   * @param {Object|string} content - The raw content to parse
   * @param {Object} options - Parsing options
   * @param {string} [options.fileName] - Original file name
   * @param {string} [options.source] - Source of the content (upload, sample, etc.)
   * @returns {ParseResult}
   */
  static parse(content, options = {}) {
    throw new Error('DomainAdapter.parse must be implemented');
  }

  /**
   * Validate a DataModel object for this domain
   * @param {Object} dataModel - The DataModel to validate
   * @returns {{ valid: boolean, errors: string[] }}
   */
  static validate(dataModel) {
    const errors = [];

    if (!dataModel.name) {
      errors.push('Name is required');
    }

    if (dataModel.domain !== this.domain) {
      errors.push(`Domain mismatch: expected ${this.domain}, got ${dataModel.domain}`);
    }

    return { valid: errors.length === 0, errors };
  }

  // ============================================
  // Display
  // ============================================

  /**
   * Get domain icon configuration
   * @returns {{ type: 'image' | 'icon', value: string }}
   */
  static getIcon() {
    if (this.iconPath) {
      return { type: 'image', value: this.iconPath };
    }
    return { type: 'icon', value: this.iconName };
  }

  /**
   * Get the model type display name
   * @param {string} modelType - The model type identifier
   * @returns {string}
   */
  static getModelTypeDisplayName(modelType) {
    return modelType || 'Unknown';
  }

  /**
   * Get domain-specific badges/tags to display on cards
   * @param {Object} dataModel - The DataModel
   * @returns {Array<{ label: string, color?: string }>}
   */
  static getBadges(dataModel) {
    return [];
  }

  /**
   * Get detailed description for a DataModel
   * @param {Object} dataModel - The DataModel
   * @returns {string}
   */
  static getDescription(dataModel) {
    return dataModel.description || '';
  }

  /**
   * Get domain-specific detail tabs
   * @param {Object} dataModel - The DataModel
   * @returns {Tab[]}
   */
  static getDetailTabs(dataModel) {
    return [
      {
        id: 'json',
        label: 'JSON',
        icon: 'FileJson',
      },
    ];
  }

  // ============================================
  // Filtering
  // ============================================

  /**
   * Get filter options for this domain
   * @param {Object[]} dataModels - All DataModels of this domain
   * @returns {FilterOption[]}
   */
  static getFilterOptions(dataModels) {
    return [];
  }

  /**
   * Check if a DataModel matches the given filters
   * @param {Object} dataModel - The DataModel to check
   * @param {Object} filters - The active filters
   * @returns {boolean}
   */
  static matchesFilter(dataModel, filters) {
    return true;
  }

  /**
   * Extract facets from DataModels for filter dropdowns
   * @param {Object[]} dataModels - DataModels to extract facets from
   * @returns {Object} - Facets object with arrays of unique values
   */
  static extractFacets(dataModels) {
    return {};
  }

  // ============================================
  // Actions
  // ============================================

  /**
   * Get available actions for a DataModel
   * @param {Object} dataModel - The DataModel
   * @returns {Action[]}
   */
  static getActions(dataModel) {
    return [];
  }

  // ============================================
  // Sample Data
  // ============================================

  /**
   * Get sample data categories
   * @returns {SampleCategory[]}
   */
  static getSampleCategories() {
    return [];
  }

  /**
   * Load sample DataModels
   * @param {string} [category] - Optional category to filter by
   * @returns {Promise<Object[]>}
   */
  static async loadSamples(category) {
    return [];
  }

  // ============================================
  // Grouping
  // ============================================

  /**
   * Get available grouping options for this domain
   * @returns {Array<{ id: string, label: string }>}
   */
  static getGroupingOptions() {
    return [
      { id: 'none', label: 'No Grouping' },
      { id: 'name', label: 'By Name' },
    ];
  }

  /**
   * Group DataModels by the specified grouping mode
   * @param {Object[]} dataModels - DataModels to group
   * @param {string} groupingMode - Grouping mode identifier
   * @returns {Object} - Object with group keys as keys and arrays of DataModels as values
   */
  static groupDataModels(dataModels, groupingMode) {
    if (groupingMode === 'none') {
      return null;
    }

    if (groupingMode === 'name') {
      const groups = {};
      dataModels.forEach((model) => {
        const key = model.name?.charAt(0)?.toUpperCase() || '#';
        groups[key] = groups[key] || [];
        groups[key].push(model);
      });
      return groups;
    }

    return null;
  }

  // ============================================
  // Export/Import
  // ============================================

  /**
   * Export a DataModel to its native format
   * @param {Object} dataModel - The DataModel to export
   * @returns {Object|string} - The exported content
   */
  static export(dataModel) {
    return dataModel.domainData || {};
  }

  /**
   * Get the file extension for exports
   * @returns {string}
   */
  static getExportExtension() {
    return 'json';
  }

  /**
   * Get the MIME type for exports
   * @returns {string}
   */
  static getExportMimeType() {
    return 'application/json';
  }
}

export default DomainAdapter;
