// BlueprintBadge.jsx
// Small badge/tag component for labeling nodes

import React from 'react';

/**
 * Badge style presets
 */
const VARIANTS = {
  // Default gray
  default: {
    background: 'rgba(100, 116, 139, 0.2)',
    color: '#94a3b8',
    border: 'transparent',
  },
  // MongoDB green
  primary: {
    background: 'rgba(0, 237, 100, 0.15)',
    color: '#00ED64',
    border: 'rgba(0, 237, 100, 0.3)',
  },
  // Purple
  purple: {
    background: 'rgba(168, 85, 247, 0.15)',
    color: '#c084fc',
    border: 'rgba(168, 85, 247, 0.3)',
  },
  // Cyan/teal
  cyan: {
    background: 'rgba(13, 148, 136, 0.15)',
    color: '#2dd4bf',
    border: 'rgba(13, 148, 136, 0.3)',
  },
  // Blue
  blue: {
    background: 'rgba(59, 130, 246, 0.15)',
    color: '#60a5fa',
    border: 'rgba(59, 130, 246, 0.3)',
  },
  // Amber
  amber: {
    background: 'rgba(245, 158, 11, 0.15)',
    color: '#fbbf24',
    border: 'rgba(245, 158, 11, 0.3)',
  },
  // Pink
  pink: {
    background: 'rgba(236, 72, 153, 0.15)',
    color: '#f472b6',
    border: 'rgba(236, 72, 153, 0.3)',
  },
  // Success/done
  success: {
    background: 'rgba(34, 197, 94, 0.15)',
    color: '#4ade80',
    border: 'rgba(34, 197, 94, 0.3)',
  },
  // Atlas Search specific
  'atlas-search': {
    background: 'rgba(0, 237, 100, 0.1)',
    color: '#00ED64',
    border: 'rgba(0, 237, 100, 0.2)',
  },
  // B-tree index
  'btree': {
    background: 'rgba(59, 130, 246, 0.1)',
    color: '#60a5fa',
    border: 'rgba(59, 130, 246, 0.2)',
  },
  // Patient/user
  'patient': {
    background: 'rgba(168, 85, 247, 0.1)',
    color: '#c084fc',
    border: 'rgba(168, 85, 247, 0.2)',
  },
  // Population
  'population': {
    background: 'rgba(236, 72, 153, 0.1)',
    color: '#f472b6',
    border: 'rgba(236, 72, 153, 0.2)',
  },
};

/**
 * BlueprintBadge - Small tag/badge component
 *
 * @param {object} props
 * @param {string} props.label - Badge text
 * @param {string} props.variant - Style variant
 * @param {React.ReactNode} props.icon - Optional icon
 * @param {string} props.size - Size ('sm', 'md')
 * @param {string} props.className - Additional CSS classes
 * @param {object} props.style - Additional inline styles
 */
const BlueprintBadge = ({
  label,
  variant = 'default',
  icon: Icon,
  size = 'sm',
  className = '',
  style = {},
}) => {
  const colors = VARIANTS[variant] || VARIANTS.default;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={`blueprint-badge inline-flex items-center gap-1 font-medium rounded ${sizeClasses[size]} ${className}`}
      style={{
        background: colors.background,
        color: colors.color,
        border: `1px solid ${colors.border}`,
        ...style,
      }}
    >
      {Icon && (
        typeof Icon === 'function' ? (
          <Icon size={size === 'sm' ? 10 : 12} />
        ) : (
          Icon
        )
      )}
      {label}
    </span>
  );
};

// Export variants for reference
BlueprintBadge.VARIANTS = VARIANTS;

export default BlueprintBadge;
