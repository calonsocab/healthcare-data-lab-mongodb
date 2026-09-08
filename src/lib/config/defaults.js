// src/lib/config/defaults.js
// Default configuration for new users
// These values are used when a new user sets up their individual workspace
import { normalizeTheme } from '@/lib/theme/themeUtils';
import { getPublicKehrnelBaseUrl } from '@/lib/kehrnel/url';

/**
 * Dark Mode theme (MongoDB Healthcare Data Lab)
 * This is a fixed preset maintained by the platform
 * MongoDB brand compliant - dark green with Evergreen accents
 */
export const DARK_THEME = {
  name: 'Dark Mode',
  // Primary brand colors
  primary: '#00ED64',        // MongoDB Evergreen
  primaryHover: '#00684A',   // MongoDB Evergreen Dark
  primaryMuted: '#00ED6420', // Evergreen with transparency for backgrounds

  // Background hierarchy
  background: '#001E2B',     // MongoDB Dark Green - main background
  surface: '#023430',        // Cards, panels - slightly lighter
  surfaceHover: '#034540',   // Hover state for surfaces
  surfaceAlt: '#012A23',     // Alternate surface (nested cards)
  surfaceMuted: '#011F1A',   // Muted backgrounds (tips, info sections)

  // Cards and elevated elements
  card: '#023430',           // Card backgrounds
  cardHover: '#034540',      // Card hover state
  cardAlt: '#013D35',        // Alternate card style

  // Borders
  border: '#1C4D47',         // Primary borders
  borderLight: '#164038',    // Subtle borders
  borderHover: '#00ED6440',  // Border on hover/focus

  // Text hierarchy
  text: '#FFFFFF',           // Primary text
  textSecondary: '#B8C4C2',  // Secondary text
  textMuted: '#7A8A87',      // Muted/disabled text
  textOnPrimary: '#001E2B',  // Text on primary colored backgrounds

  // Status colors
  success: '#00ED64',        // MongoDB Evergreen
  successMuted: '#00ED6420', // Success background
  warning: '#FFC010',        // MongoDB Yellow
  warningMuted: '#FFC01020', // Warning background
  error: '#FF6960',          // MongoDB Red (lighter for dark bg)
  errorMuted: '#FF696020',   // Error background
  info: '#0498EC',           // MongoDB Blue
  infoMuted: '#0498EC20',    // Info background

  // Accent colors for variety
  accent1: '#B45AF2',        // Purple accent
  accent2: '#FF7F50',        // Coral accent
  accent3: '#00D2FF',        // Cyan accent

  // Banner/Highlight colors (for info sections with dark backgrounds)
  // In dark mode, banners blend with the UI (use surface colors)
  bannerBg: '#023430',       // Same as surface - blends in dark mode
  bannerText: '#00ED64'      // Primary green for emphasis
};

/**
 * Light Mode theme (MongoDB Healthcare Data Lab)
 * This is a fixed preset maintained by the platform
 * MongoDB brand compliant - clean white like MongoDB Demo Portal
 */
export const LIGHT_THEME = {
  name: 'Light Mode',
  // Primary brand colors
  primary: '#00684A',        // MongoDB Evergreen Dark (better contrast on light)
  primaryHover: '#004D36',   // Darker green for hover
  primaryMuted: '#E3FCF2',   // Very light green tint for backgrounds

  // Background hierarchy - PURE WHITE like MongoDB Demo Portal
  background: '#FFFFFF',     // Pure white - main background
  surface: '#FFFFFF',        // Cards, panels - WHITE (not gray!)
  surfaceHover: '#F9FAFB',   // Very subtle hover state
  surfaceAlt: '#F9FAFB',     // Alternate surface - barely visible gray
  surfaceMuted: '#F3F4F6',   // Muted backgrounds (tips, info sections) - light gray

  // Cards and elevated elements - WHITE with borders/shadows for definition
  card: '#FFFFFF',           // Card backgrounds - pure white
  cardHover: '#FAFAFA',      // Card hover state - barely visible
  cardAlt: '#FFFFFF',        // Alternate card style - white

  // Borders - subtle but visible
  border: '#E5E7EB',         // Light gray borders (like MongoDB Demo Portal)
  borderLight: '#F3F4F6',    // Very subtle borders
  borderHover: '#00684A',    // Green border on hover/focus

  // Text hierarchy - high contrast
  text: '#1F2937',           // Near black for maximum readability
  textSecondary: '#6B7280',  // Medium gray for secondary
  textMuted: '#9CA3AF',      // Light gray for muted/hints
  textOnPrimary: '#FFFFFF',  // White text on green buttons

  // Status colors - vivid but readable
  success: '#00684A',        // MongoDB Evergreen Dark
  successMuted: '#E3FCF2',   // Very light green
  warning: '#D97706',        // Amber/orange for contrast
  warningMuted: '#FEF3C7',   // Light yellow
  error: '#DC2626',          // Red
  errorMuted: '#FEE2E2',     // Light red/pink
  info: '#2563EB',           // Blue
  infoMuted: '#DBEAFE',      // Light blue

  // Accent colors for badges/tags
  accent1: '#7C3AED',        // Purple
  accent2: '#EA580C',        // Orange
  accent3: '#0891B2',        // Cyan

  // Banner/Highlight colors (for info sections with dark backgrounds)
  // In light mode, banners use MongoDB dark green for contrast
  bannerBg: '#001E2B',       // MongoDB Dark Green - stands out on white
  bannerText: '#00ED64'      // MongoDB Evergreen - readable on dark
};

/**
 * Available themes for individual users
 * These are the only options - no custom themes for individuals
 */
export const PRESET_THEMES = {
  dark: DARK_THEME,
  light: LIGHT_THEME
};

/**
 * Minimal color controls for custom workspace themes.
 * Secondary tones are derived automatically to keep the palette consistent.
 */
export const CUSTOM_THEME_CONFIG_KEYS = [
  'primary',
  'primaryHover',
  'background',
  'surface',
  'surfaceHover',
  'border',
  'text',
  'textSecondary',
  'success',
  'warning',
  'error',
  'info',
  'bannerBg',
  'bannerText'
];

/**
 * Normalize any stored/custom theme into a full runtime token set.
 * Supports legacy saved themes with many keys and new reduced custom themes.
 */
export const getNormalizedTheme = (theme = {}) => normalizeTheme(theme, LIGHT_THEME, DARK_THEME);

/**
 * Default theme (Dark Mode)
 */
export const DEFAULT_THEME = DARK_THEME;

/**
 * Public Teams Configuration
 * Teams listed here can be joined by anyone with the code - no invitation required.
 * The code is displayed prominently during signup for easy access.
 */
export const PUBLIC_TEAMS = [
  {
    name: 'Demo Team',
    code: 'WGHZN2',  // Existing team invite code
    description: 'Join our shared demo environment to explore the platform',
    featured: true   // Show prominently in signup
  }
];

/**
 * Default database name for new environments
 */
export const DEFAULT_DATABASE_NAME = 'hc-QueryBuilder';

/**
 * Get the default Kehrnel URL from environment
 * This is NEXT_PUBLIC_* so it's available on client side
 */
export function getDefaultKehrnelUrl() {
  return getPublicKehrnelBaseUrl();
}

/**
 * Creates a default environment configuration for new individual users
 * @param {string} kehrnelUrl - Optional override for Kehrnel API URL (defaults to env variable)
 * @returns {Object} Default environment configuration
 */
export function createDefaultEnvironment(kehrnelUrl) {
  return {
    id: `env-${Date.now()}`,
    name: 'DEV',
    description: 'Development environment',
    database: DEFAULT_DATABASE_NAME,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    strategyLinks: [], // No strategies by default - user will configure these
    kehrnel: {
      useDefault: false,
      apiUrl: kehrnelUrl || getDefaultKehrnelUrl()
    }
  };
}
