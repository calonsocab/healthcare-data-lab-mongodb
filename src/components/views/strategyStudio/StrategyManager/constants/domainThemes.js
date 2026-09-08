// Domain color themes for visual coding of strategies
// Icons are lucide-react icon names
export const DOMAIN_THEMES = {
  openEHR: {
    primary: '#00a99d',
    gradient: 'from-teal-500 to-cyan-600',
    bgGradient: 'bg-gradient-to-br from-teal-500/10 to-cyan-600/10',
    borderColor: 'border-teal-500/30',
    textColor: 'text-teal-400',
    displayName: 'openEHR®',
    icon: 'UserRound',
    iconPath: '/images/openehr.png' // Official openEHR brand icon
  },
  FHIR: {
    primary: '#e44e37',
    gradient: 'from-red-500 to-orange-600',
    bgGradient: 'bg-gradient-to-br from-red-500/10 to-orange-600/10',
    borderColor: 'border-red-500/30',
    textColor: 'text-red-400',
    displayName: 'FHIR®',
    icon: 'Share2' // Interoperability/exchange icon
  },
  Genomics: {
    primary: '#6c5ce7',
    gradient: 'from-purple-500 to-indigo-600',
    bgGradient: 'bg-gradient-to-br from-purple-500/10 to-indigo-600/10',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-400',
    displayName: 'Genomics',
    icon: 'Dna' // DNA icon for genomics
  },
  DICOM: {
    primary: '#0984e3',
    gradient: 'from-blue-500 to-cyan-600',
    bgGradient: 'bg-gradient-to-br from-blue-500/10 to-cyan-600/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-400',
    displayName: 'DICOM',
    icon: 'ScanLine' // Medical imaging icon
  },
  X12: {
    primary: '#5b4b9e',
    gradient: 'from-purple-600 to-blue-500',
    bgGradient: 'bg-gradient-to-br from-purple-600/10 to-blue-500/10',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-400',
    displayName: 'X12',
    icon: 'Receipt' // Claims/billing icon
  },
  ContextObjects: {
    primary: '#00ED64',
    gradient: 'from-green-500 to-emerald-600',
    bgGradient: 'bg-gradient-to-br from-green-500/10 to-emerald-600/10',
    borderColor: 'border-green-500/30',
    textColor: 'text-green-400',
    displayName: 'ContextObjects',
    icon: 'Boxes' // Semantic objects icon
  },
  Custom: {
    primary: '#fdcb6e',
    gradient: 'from-yellow-500 to-orange-600',
    bgGradient: 'bg-gradient-to-br from-yellow-500/10 to-orange-600/10',
    borderColor: 'border-yellow-500/30',
    textColor: 'text-yellow-400',
    displayName: 'Custom',
    icon: 'Puzzle' // Custom/flexible icon
  }
};

/**
 * Get theme for a strategy based on its domain
 * Domain-first model: uses strategy.domain directly (single string)
 * @param {object} strategy - Strategy object with domain field
 * @returns {object} Theme object with colors and gradients
 */
export function getStrategyTheme(strategy) {
  if (!strategy) {
    return DOMAIN_THEMES.Custom;
  }

  // Domain-first: use strategy.domain directly (single string)
  const domain = strategy.domain;
  if (domain && DOMAIN_THEMES[domain]) {
    return DOMAIN_THEMES[domain];
  }

  // Try case-insensitive match (openEHR vs openehr)
  if (domain) {
    const normalizedDomain = domain.toLowerCase();
    for (const [key, theme] of Object.entries(DOMAIN_THEMES)) {
      if (key.toLowerCase() === normalizedDomain) {
        return theme;
      }
    }
  }

  return DOMAIN_THEMES.Custom;
}

/**
 * Get display name for a domain (with ® symbol where appropriate)
 * @param {string} domain - Domain key (e.g., 'openEHR', 'FHIR', 'genomics')
 * @returns {string} Display name with trademark symbols
 */
export function getDomainDisplayName(domain) {
  if (!domain) return 'Custom';

  // First try exact match
  if (DOMAIN_THEMES[domain]) {
    return DOMAIN_THEMES[domain].displayName;
  }

  // Try case-insensitive match
  const normalizedDomain = domain.toLowerCase();
  for (const [key, theme] of Object.entries(DOMAIN_THEMES)) {
    if (key.toLowerCase() === normalizedDomain) {
      return theme.displayName;
    }
  }

  // Default: capitalize first letter
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

/**
 * Get all unique domains from a list of strategies
 * Domain-first model: uses strategy.domain directly
 * @param {Array} strategies - Array of strategy objects
 * @returns {Array} Array of {domain, displayName, count, theme} objects
 */
export function getDomainCounts(strategies) {
  const counts = {};

  strategies.forEach(strategy => {
    // Domain-first: use strategy.domain directly
    const domain = strategy.domain || 'Custom';
    counts[domain] = (counts[domain] || 0) + 1;
  });

  return Object.entries(counts).map(([domain, count]) => {
    const theme = DOMAIN_THEMES[domain] || DOMAIN_THEMES.Custom;
    return {
      domain,
      displayName: getDomainDisplayName(domain),
      count,
      theme
    };
  });
}
