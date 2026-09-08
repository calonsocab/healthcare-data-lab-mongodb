/**
 * Centralized Navigation Configuration
 *
 * This config defines the structure of the left sidebar navigation.
 * All navigation items are organized into sections with flat headers.
 */

// Icon names map to lucide-react icons
// The ThemedLayout component will resolve these to actual icon components

export const NAVIGATION_CONFIG = {
  sections: [
    {
      id: 'home-section',
      label: 'Home',
      items: [
        { id: 'home', label: 'Overview', icon: 'Home', viewId: 'home' },
        { id: 'learn', label: 'Learn', icon: 'GraduationCap', viewId: 'learn', badge: 'New' },
        {
          id: 'kehrnel-docs',
          label: 'Kehrnel Docs',
          icon: 'BookOpen',
          externalUrl: process.env.NEXT_PUBLIC_KEHRNEL_DOCS_URL || '/api/kehrnel/docs/guide'
        },
      ]
    },
    {
      id: 'strategy-section',
      label: 'Data Strategy Studio',
      items: [
        { id: 'strategies', label: 'Strategy Studio', icon: 'Layers', viewId: 'strategies' },
        { id: 'deploy-strategies', label: 'Deploy Your Strategy', icon: 'Rocket', viewId: 'deploy-strategies' }
      ]
    },
    {
      id: 'data-models-section',
      label: 'Data Models',
      items: [
        { id: 'catalog', label: 'Data Model Catalog', icon: 'FileText', viewId: 'templates' },
        { id: 'contextObjects', label: 'ContextObject Builder', icon: 'Boxes', viewId: 'contextObjects' }
      ]
    },
    {
      id: 'data-factory-section',
      label: 'Data Factory',
      items: [
        { id: 'synthetic', label: 'Synthetic Data', icon: 'FlaskConical', viewId: 'synthetic' },
        { id: 'mapping', label: 'Mapping Studio', icon: 'FileCode2', viewId: 'mapping' },
        { id: 'history', label: 'Jobs History', icon: 'History', viewId: 'history' }
      ]
    },
    {
      id: 'query-section',
      label: 'Query Studio',
      items: [
        { id: 'queries', label: 'Library', icon: 'Tag', viewId: 'queries' },
        { id: 'lab', label: 'Query Lab', icon: 'FlaskConical', viewId: 'lab', badge: 'Beta' },
        { id: 'builder', label: 'Query Builder', icon: 'Code', viewId: 'builder' }
      ]
    },
    {
      id: 'copilots-section',
      label: 'Copilots',
      items: [
        { id: 'copilot-questions', label: 'Question Library', icon: 'MessagesSquare', viewId: 'copilot-questions' },
        { id: 'copilot-products', label: 'Semantic Products', icon: 'Boxes', viewId: 'copilot-products' },
        { id: 'copilot-tools', label: 'Tools and Plans', icon: 'Wrench', viewId: 'copilot-tools' },
        { id: 'copilot-answers', label: 'Answer Models', icon: 'LayoutTemplate', viewId: 'copilot-answers' },
        { id: 'copilot-control', label: 'Control Plane', icon: 'Activity', viewId: 'copilot-control', badge: 'New' }
      ]
    },
    {
      id: 'api-sandbox-section',
      label: 'API & Sandbox',
      items: [
        { id: 'api', label: 'API', icon: 'Plug', viewId: 'api-docs' },
        { id: 'sandbox', label: 'Sandbox', icon: 'FlaskConical', viewId: 'sandbox' }
      ]
    },
    {
      id: 'apps-section',
      label: 'App Gallery',
      items: [
        { id: 'app-gallery', label: 'App Gallery', icon: 'Sparkles', viewId: 'app-gallery', badge: 'New' }
      ]
    }
  ]
};

/**
 * Get all navigation items as a flat array (for backward compatibility)
 * @returns {Array} Flat array of all navigation items
 */
export function getAllNavigationItems() {
  return NAVIGATION_CONFIG.sections.flatMap(section => section.items);
}

/**
 * Find a navigation item by its id
 * @param {string} id - The item id to find
 * @returns {Object|null} The navigation item or null
 */
export function findNavigationItem(id) {
  for (const section of NAVIGATION_CONFIG.sections) {
    const item = section.items.find(item => item.id === id);
    if (item) return item;
  }
  return null;
}

/**
 * Get the view id for a given navigation item id
 * @param {string} id - The navigation item id
 * @returns {string} The view id (defaults to the id if not found)
 */
export function getViewId(id) {
  const item = findNavigationItem(id);
  return item?.viewId || id;
}
