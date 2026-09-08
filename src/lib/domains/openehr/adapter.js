// src/lib/domains/openehr/adapter.js
/**
 * OpenEHR Domain Adapter
 *
 * Handles OpenEHR templates (Web Templates and OPT files)
 */

import { DomainAdapter } from '../DomainAdapter';
import { DOMAINS, DATA_MODEL_SOURCES, OPENEHR_MODEL_TYPES, createDataModel } from '../../data-models/types';
import { computeWebTemplateMetadata, groupTemplatesByName, groupTemplatesByComposition, collectTemplateFacets } from '../../templates';
import { convertOPTtoWebTemplate } from '../../templates/opt';

/**
 * OpenEHR Domain Adapter
 */
export class OpenEHRAdapter extends DomainAdapter {
  static domain = DOMAINS.OPENEHR;
  static displayName = 'openEHR®';
  static description = 'Clinical templates for structured data capture';
  static color = '#00a99d';

  // ============================================
  // Detection & Parsing
  // ============================================

  /**
   * Check if this adapter can handle the given file/content
   * Detects OpenEHR Web Templates and OPT files
   */
  static canHandle(file, content) {
    const fileName = file?.name?.toLowerCase() || '';

    // OPT files (XML)
    if (fileName.endsWith('.opt') || fileName.endsWith('.xml')) {
      if (typeof content === 'string') {
        return content.includes('<template') ||
          content.includes('openehr') ||
          content.includes('openEHR') ||
          content.includes('archetype_id');
      }
      return false;
    }

    // JSON Web Templates
    if (typeof content === 'object' && content !== null) {
      // Direct web template structure
      if (content.templateId && content.tree) {
        return true;
      }

      // Web template with wrapper
      if (content.webTemplate?.templateId || content.webTemplate?.tree) {
        return true;
      }

      // Tree with OpenEHR nodeId pattern
      if (content.tree?.nodeId?.includes('openEHR') || content.nodeId?.includes('openEHR')) {
        return true;
      }

      // Check for rmType typical of OpenEHR
      const rmType = content.rmType || content.tree?.rmType || '';
      if (['COMPOSITION', 'OBSERVATION', 'EVALUATION', 'INSTRUCTION', 'ACTION'].includes(rmType)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Parse OpenEHR content into a DataModel
   */
  static async parse(content, options = {}) {
    try {
      const { fileName = '', source = DATA_MODEL_SOURCES.UPLOAD } = options;
      const isOPT = fileName.toLowerCase().endsWith('.opt') ||
        fileName.toLowerCase().endsWith('.xml') ||
        (typeof content === 'string' && content.trim().startsWith('<'));

      let webTemplate;
      let sourceInfo;

      if (isOPT) {
        // Parse OPT XML to Web Template
        const converted = await convertOPTtoWebTemplate(content);
        webTemplate = converted;
        sourceInfo = {
          type: 'opt',
          fileName,
          contentType: 'application/xml',
          xml: content, // Store original XML
        };
      } else {
        // JSON Web Template
        webTemplate = content.webTemplate || content;
        sourceInfo = {
          type: 'web',
          fileName,
          contentType: 'application/json',
        };
      }

      // Extract template metadata
      const tree = webTemplate.tree || webTemplate;
      const metadata = computeWebTemplateMetadata(tree, {
        templateId: webTemplate.templateId,
        defaultLanguage: webTemplate.defaultLanguage,
      });

      const name = webTemplate.templateId ||
        metadata.templateId ||
        tree.name ||
        fileName.replace(/\.(json|opt|xml)$/i, '') ||
        'Untitled Template';

      // Determine model type based on rmType
      const rmType = tree.rmType?.toUpperCase() || 'COMPOSITION';
      let modelType = OPENEHR_MODEL_TYPES.TEMPLATE;
      if (rmType === 'COMPOSITION') {
        modelType = OPENEHR_MODEL_TYPES.COMPOSITION;
      }

      const dataModel = createDataModel({
        name,
        description: metadata.description || '',
        domain: DOMAINS.OPENEHR,
        modelType,
        source,
        domainData: {
          webTemplate: tree,
          templateId: webTemplate.templateId,
          semVer: webTemplate.semVer,
          version: webTemplate.version,
          defaultLanguage: webTemplate.defaultLanguage,
          languages: webTemplate.languages,
        },
        metadata: {
          domainMetadata: {
            ...metadata,
            source: sourceInfo,
          },
        },
      });

      return {
        success: true,
        dataModel,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to parse OpenEHR content',
      };
    }
  }

  /**
   * Validate an OpenEHR DataModel
   */
  static validate(dataModel) {
    const baseValidation = super.validate(dataModel);
    const errors = [...baseValidation.errors];

    // Check for required OpenEHR-specific data
    if (!dataModel.domainData?.webTemplate) {
      errors.push('Missing webTemplate in domainData');
    }

    const tree = dataModel.domainData?.webTemplate;
    if (tree && !tree.nodeId) {
      errors.push('Missing nodeId in webTemplate tree');
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
      [OPENEHR_MODEL_TYPES.COMPOSITION]: 'Composition',
      [OPENEHR_MODEL_TYPES.TEMPLATE]: 'Template',
      [OPENEHR_MODEL_TYPES.ARCHETYPE]: 'Archetype',
    };
    return names[modelType] || modelType;
  }

  /**
   * Get badges for display on cards
   */
  static getBadges(dataModel) {
    const badges = [];
    const md = dataModel.metadata?.domainMetadata || {};

    // Composition kind (event/persistent)
    if (md.compositionKind) {
      badges.push({
        label: md.compositionKind,
        color: md.compositionKind === 'event' ? 'blue' : 'purple',
      });
    }

    // Entry RM types
    const entryTypes = (md.archetypes || [])
      .filter(a => a.rmType && a.rmType.toUpperCase() !== 'COMPOSITION')
      .map(a => a.rmType);
    const uniqueEntryTypes = [...new Set(entryTypes)];

    uniqueEntryTypes.slice(0, 3).forEach(type => {
      badges.push({
        label: type,
        color: 'gray',
      });
    });

    // Languages
    if (md.languages?.length > 0) {
      badges.push({
        label: `${md.languages.length} lang`,
        color: 'green',
      });
    }

    // Datatypes count
    if (md.datatypes?.length > 0) {
      badges.push({
        label: `${md.datatypes.length} types`,
        color: 'yellow',
      });
    }

    return badges;
  }

  /**
   * Get description for display
   */
  static getDescription(dataModel) {
    return dataModel.metadata?.domainMetadata?.description || dataModel.description || '';
  }

  /**
   * Get detail tabs for OpenEHR templates
   */
  static getDetailTabs(dataModel) {
    const tabs = [
      { id: 'structure', label: 'Structure', icon: 'Layers' },
      { id: 'mindmap', label: 'Mind Map', icon: 'Network' },
      { id: 'tree', label: 'Tree View', icon: 'GitBranch' },
      { id: 'json', label: 'WebTemplate', icon: 'FileJson' },
    ];

    // Add OPT tab if available
    const hasOpt = dataModel.metadata?.domainMetadata?.source?.type === 'opt';
    if (hasOpt) {
      tabs.push({ id: 'opt', label: 'OPT', icon: 'FileCode' });
    }

    tabs.push({ id: 'analytics', label: 'Analytics', icon: 'BarChart2' });

    return tabs;
  }

  // ============================================
  // Filtering
  // ============================================

  /**
   * Get filter options for OpenEHR domain
   */
  static getFilterOptions(dataModels) {
    const facets = this.extractFacets(dataModels);

    return [
      {
        id: 'archetypes',
        label: 'Archetypes',
        type: 'multiselect',
        options: facets.archetypes.map(a => ({ value: a.nodeId, label: a.name || a.nodeId })),
      },
      {
        id: 'compositions',
        label: 'Compositions',
        type: 'multiselect',
        options: facets.compositions.map(c => ({ value: c, label: c })),
      },
      {
        id: 'languages',
        label: 'Languages',
        type: 'multiselect',
        options: facets.languages.map(l => ({ value: l, label: l.toUpperCase() })),
      },
      {
        id: 'terminologies',
        label: 'Terminologies',
        type: 'multiselect',
        options: facets.terminologies.map(t => ({ value: t, label: t })),
      },
      {
        id: 'hasOpt',
        label: 'Has OPT',
        type: 'boolean',
      },
    ];
  }

  /**
   * Check if a DataModel matches the given filters
   */
  static matchesFilter(dataModel, filters) {
    const md = dataModel.metadata?.domainMetadata || {};

    // Archetypes filter
    if (filters.archetypes?.length > 0) {
      const modelArchetypes = (md.archetypes || []).map(a => a.nodeId);
      if (!filters.archetypes.some(a => modelArchetypes.includes(a))) {
        return false;
      }
    }

    // Compositions filter
    if (filters.compositions?.length > 0) {
      const nodeId = dataModel.domainData?.webTemplate?.nodeId;
      if (!filters.compositions.includes(nodeId)) {
        return false;
      }
    }

    // Languages filter
    if (filters.languages?.length > 0) {
      const modelLangs = md.languages || [];
      if (!filters.languages.every(l => modelLangs.includes(l))) {
        return false;
      }
    }

    // Terminologies filter
    if (filters.terminologies?.length > 0) {
      const modelTerms = md.terminologies || [];
      if (!filters.terminologies.every(t => modelTerms.includes(t))) {
        return false;
      }
    }

    // Has OPT filter
    if (filters.hasOpt) {
      if (md.source?.type !== 'opt') {
        return false;
      }
    }

    return true;
  }

  /**
   * Extract facets from DataModels
   */
  static extractFacets(dataModels) {
    const archetypeMap = new Map();
    const compositions = new Set();
    const languages = new Set();
    const terminologies = new Set();

    dataModels.forEach(model => {
      const md = model.metadata?.domainMetadata || {};

      // Archetypes
      (md.archetypes || []).forEach(a => {
        if (a.nodeId && !archetypeMap.has(a.nodeId)) {
          archetypeMap.set(a.nodeId, a);
        }
      });

      // Compositions
      const nodeId = model.domainData?.webTemplate?.nodeId;
      if (nodeId) compositions.add(nodeId);

      // Languages
      (md.languages || []).forEach(l => languages.add(l));

      // Terminologies
      (md.terminologies || []).forEach(t => terminologies.add(t));
    });

    return {
      archetypes: Array.from(archetypeMap.values()).sort((a, b) =>
        (a.name || a.nodeId).localeCompare(b.name || b.nodeId)
      ),
      compositions: Array.from(compositions).sort(),
      languages: Array.from(languages).sort(),
      terminologies: Array.from(terminologies).sort(),
    };
  }

  // ============================================
  // Grouping
  // ============================================

  /**
   * Get available grouping options
   */
  static getGroupingOptions() {
    return [
      { id: 'none', label: 'No Grouping' },
      { id: 'name', label: 'By Name' },
      { id: 'composition', label: 'By Composition' },
    ];
  }

  /**
   * Group DataModels
   */
  static groupDataModels(dataModels, groupingMode) {
    if (groupingMode === 'none') {
      return null;
    }

    // Convert DataModels to legacy template format for existing grouping functions
    const asTemplates = dataModels.map(m => ({
      ...m,
      webTemplate: m.domainData?.webTemplate,
      metadata: m.metadata?.domainMetadata || {},
    }));

    if (groupingMode === 'name') {
      return groupTemplatesByName(asTemplates);
    }

    if (groupingMode === 'composition') {
      return groupTemplatesByComposition(asTemplates);
    }

    return null;
  }

  // ============================================
  // Sample Data
  // ============================================

  /**
   * Get sample data categories
   */
  static getSampleCategories() {
    return [
      {
        id: 'clinical',
        label: 'Clinical Templates',
        description: 'Templates for clinical observations, evaluations, and instructions',
        count: 20,
      },
      {
        id: 'all',
        label: 'All Sample Templates',
        description: 'Complete collection of sample OpenEHR templates',
        count: 50,
      },
    ];
  }

  /**
   * Load sample DataModels
   */
  static async loadSamples(category = 'all') {
    try {
      const response = await fetch(`/api/sample-templates?hasOpt=true&limit=200`);
      if (!response.ok) {
        throw new Error('Failed to fetch sample templates');
      }

      const templates = await response.json();

      // Convert to DataModel format
      return templates.map(template => {
        const metadata = computeWebTemplateMetadata(template.webTemplate || template.tree, {
          templateId: template.template_id || template.name,
        });

        return createDataModel({
          name: template.name || template.template_id,
          description: metadata.description,
          domain: DOMAINS.OPENEHR,
          modelType: OPENEHR_MODEL_TYPES.COMPOSITION,
          source: DATA_MODEL_SOURCES.SAMPLE,
          domainData: {
            webTemplate: template.webTemplate || template.tree,
            templateId: template.template_id,
          },
          metadata: {
            domainMetadata: {
              ...metadata,
              source: template.source || { type: 'web' },
            },
          },
        });
      });
    } catch (error) {
      console.error('Failed to load OpenEHR samples:', error);
      return [];
    }
  }

  // ============================================
  // Export
  // ============================================

  /**
   * Export to native format
   */
  static export(dataModel) {
    // Return the full web template structure
    return {
      templateId: dataModel.domainData?.templateId,
      semVer: dataModel.domainData?.semVer,
      version: dataModel.domainData?.version,
      defaultLanguage: dataModel.domainData?.defaultLanguage,
      languages: dataModel.domainData?.languages,
      tree: dataModel.domainData?.webTemplate,
    };
  }

  /**
   * Get export file extension
   */
  static getExportExtension() {
    return 'json';
  }
}

export default OpenEHRAdapter;
