// src/lib/utils.js

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combines multiple class names using clsx and ensures Tailwind classes are properly merged
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Escapes special regex characters in a string for safe use in RegExp
 * @param {string} str - String to escape
 * @returns {string} - Escaped string safe for regex
 */
export function escapeRegex(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const TAG_COLORS = {
  // Domain-specific tag colors
  air: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/50' },
  clinical: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/50' },
  lab: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/50' },
  medication: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/50' },
  patient: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/50' },
  
  // Status tags
  wip: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/50' },
  deprecated: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/50' },
  stable: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/50' },
  
  // Event tags
  adverse: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/50' },
  reaction: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/50' },
  
  // Custom color map (to match TagColorPicker options)
  blue: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/50' },
  sky: { bg: 'bg-sky-500/20', text: 'text-sky-300', border: 'border-sky-500/50' },
  cyan: { bg: 'bg-cyan-500/20', text: 'text-cyan-300', border: 'border-cyan-500/50' },
  indigo: { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/50' },
  green: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/50' },
  emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/50' },
  teal: { bg: 'bg-teal-500/20', text: 'text-teal-300', border: 'border-teal-500/50' },
  red: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/50' },
  pink: { bg: 'bg-pink-500/20', text: 'text-pink-300', border: 'border-pink-500/50' },
  rose: { bg: 'bg-rose-500/20', text: 'text-rose-300', border: 'border-rose-500/50' },
  yellow: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500/50' },
  amber: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/50' },
  orange: { bg: 'bg-orange-500/20', text: 'text-orange-300', border: 'border-orange-500/50' },
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/50' },
  violet: { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/50' },
  fuchsia: { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-300', border: 'border-fuchsia-500/50' },
  slate: { bg: 'bg-slate-500/20', text: 'text-slate-300', border: 'border-slate-500/50' },
  gray: { bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500/50' },
  zinc: { bg: 'bg-zinc-500/20', text: 'text-zinc-300', border: 'border-zinc-500/50' },
  
  // Default color for unmatched tags
  default: { bg: 'bg-slate-600', text: 'text-slate-300', border: 'border-slate-500' }
};

/**
 * Get the color classes for a tag based on its name or custom color
 * @param {string} tagName - Tag name to get colors for
 * @param {string} customColor - Optional custom color name
 * @returns {object} - Object with bg, text, and border classes
 */
export const getTagColors = (tagName, customColor = null) => {
  // First priority: custom color if specified
  if (customColor && TAG_COLORS[customColor]) {
    return TAG_COLORS[customColor];
  }
  
  if (!tagName) return TAG_COLORS.default;
  
  const lowercaseTag = tagName.toLowerCase();
  
  // Second priority: exact matches
  for (const [key, value] of Object.entries(TAG_COLORS)) {
    if (lowercaseTag === key) {
      return value;
    }
  }
  
  // Third priority: prefix matches
  for (const [key, value] of Object.entries(TAG_COLORS)) {
    if (lowercaseTag.startsWith(key + '-') || lowercaseTag.startsWith(key + ':')) {
      return value;
    }
  }
  
  // Fourth priority: generate a color based on the name for consistency
  const colors = [
    { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-800' },
    { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', border: 'border-green-300 dark:border-green-800' },
    { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-800' },
    { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-300 dark:border-yellow-800' },
    { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', border: 'border-red-300 dark:border-red-800' },
    { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-300 dark:border-indigo-800' },
    { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-300 dark:border-pink-800' }
  ];
  
  // Generate a deterministic index based on the tag name
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

/**
 * Validates if a string is a valid UUID
 * @param {string} str String to validate
 * @returns {boolean} True if valid UUID
 */
export function isValidUUID(str) {
  if (!str) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Formats a date to a human-readable string
 * @param {Date|string} date Date to format
 * @param {boolean} includeTime Whether to include time
 * @returns {string} Formatted date string
 */
export function formatDate(date, includeTime = false) {
  if (!date) return '';
  
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(d.getTime())) return '';
  
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };
  
  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }
  
  return d.toLocaleDateString('en-US', options);
}

/**
 * Truncates text to a specified length and adds ellipsis if needed
 * @param {string} text Text to truncate
 * @param {number} maxLength Maximum length
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * @param {Function} func Function to debounce
 * @param {number} wait Milliseconds to wait
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}