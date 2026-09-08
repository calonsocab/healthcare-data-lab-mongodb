// BlueprintNode.jsx
// Basic node/box component for architecture diagrams

import React from 'react';

/**
 * Node variants matching MongoDB blueprint style
 */
const VARIANTS = {
  // Primary green MongoDB style
  primary: {
    background: '#00ED64',
    border: '#00ED64',
    text: '#001e2b',
    subtitleText: '#001e2b',
  },
  // Secondary green outline
  'primary-outline': {
    background: 'transparent',
    border: '#00ED64',
    text: '#00ED64',
    subtitleText: '#00ED64',
  },
  // Dark with green accent
  'primary-dark': {
    background: '#001e2b',
    border: '#00ED64',
    text: '#00ED64',
    subtitleText: '#00a956',
  },
  // Purple/pink info style
  info: {
    background: '#f3e8ff',
    border: '#e9d5ff',
    text: '#1e1b4b',
    subtitleText: '#4c1d95',
  },
  // Cyan/teal style
  cyan: {
    background: '#0d9488',
    border: '#0d9488',
    text: '#ffffff',
    subtitleText: '#ccfbf1',
  },
  'cyan-outline': {
    background: 'transparent',
    border: '#0d9488',
    text: '#0d9488',
    subtitleText: '#0d9488',
  },
  // Purple style
  purple: {
    background: '#a855f7',
    border: '#a855f7',
    text: '#ffffff',
    subtitleText: '#f3e8ff',
  },
  'purple-outline': {
    background: 'transparent',
    border: '#a855f7',
    text: '#a855f7',
    subtitleText: '#c084fc',
  },
  // Amber/yellow style
  amber: {
    background: '#f59e0b',
    border: '#f59e0b',
    text: '#1e1b4b',
    subtitleText: '#78350f',
  },
  // Slate/gray style
  slate: {
    background: '#334155',
    border: '#475569',
    text: '#f1f5f9',
    subtitleText: '#94a3b8',
  },
  'slate-outline': {
    background: 'transparent',
    border: '#475569',
    text: '#e2e8f0',
    subtitleText: '#94a3b8',
  },
  // Ghost/transparent style
  ghost: {
    background: 'rgba(255,255,255,0.05)',
    border: 'rgba(255,255,255,0.1)',
    text: '#e2e8f0',
    subtitleText: '#94a3b8',
  },
  // Pipeline step (dark with subtle border)
  pipeline: {
    background: '#1e293b',
    border: '#334155',
    text: '#e2e8f0',
    subtitleText: '#94a3b8',
  },
};

/**
 * BlueprintNode - Basic node/box component
 *
 * @param {object} props
 * @param {string} props.title - Main title text
 * @param {string} props.subtitle - Subtitle/description text
 * @param {React.ReactNode} props.icon - Icon component
 * @param {string} props.variant - Style variant (primary, info, cyan, etc.)
 * @param {Array} props.badges - Array of badge objects { label, color }
 * @param {number} props.width - Node width
 * @param {number} props.height - Node height (auto if not specified)
 * @param {string} props.borderRadius - Border radius
 * @param {boolean} props.dashed - Use dashed border
 * @param {function} props.onClick - Click handler
 * @param {React.ReactNode} props.children - Additional content
 * @param {string} props.className - Additional CSS classes
 * @param {object} props.style - Additional inline styles
 * @param {string} props.id - Node ID for connector targeting
 */
const BlueprintNode = ({
  title,
  subtitle,
  icon: Icon,
  variant = 'primary',
  badges = [],
  width = 'auto',
  minWidth = 120,
  height = 'auto',
  borderRadius = '8px',
  dashed = false,
  onClick,
  children,
  className = '',
  style = {},
  id,
  align = 'center', // 'left', 'center', 'right'
}) => {
  const colors = VARIANTS[variant] || VARIANTS.primary;

  const alignClass = {
    left: 'text-left items-start',
    center: 'text-center items-center',
    right: 'text-right items-end',
  }[align];

  return (
    <div
      id={id}
      className={`blueprint-node flex flex-col ${alignClass} justify-center gap-1 px-4 py-3 transition-all ${
        onClick ? 'cursor-pointer hover:scale-105' : ''
      } ${className}`}
      style={{
        width,
        minWidth,
        height,
        background: colors.background,
        border: `2px ${dashed ? 'dashed' : 'solid'} ${colors.border}`,
        borderRadius,
        ...style,
      }}
      onClick={onClick}
      data-node-id={id}
    >
      {/* Icon */}
      {Icon && (
        <div className="blueprint-node-icon mb-1">
          {typeof Icon === 'function' ? (
            <Icon size={24} color={colors.text} />
          ) : (
            Icon
          )}
        </div>
      )}

      {/* Title */}
      {title && (
        <div
          className="blueprint-node-title font-semibold text-sm leading-tight"
          style={{ color: colors.text }}
        >
          {title}
        </div>
      )}

      {/* Subtitle */}
      {subtitle && (
        <div
          className="blueprint-node-subtitle text-xs leading-tight mt-0.5"
          style={{ color: colors.subtitleText }}
        >
          {subtitle}
        </div>
      )}

      {/* Badges */}
      {badges.length > 0 && (
        <div className="blueprint-node-badges flex flex-wrap gap-1 mt-2 justify-center">
          {badges.map((badge, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 text-[10px] font-medium rounded"
              style={{
                background: badge.background || 'rgba(0,0,0,0.2)',
                color: badge.color || colors.text,
                border: badge.border ? `1px solid ${badge.border}` : 'none',
              }}
            >
              {badge.label}
            </span>
          ))}
        </div>
      )}

      {/* Custom content */}
      {children}
    </div>
  );
};

// Export variants for reference
BlueprintNode.VARIANTS = VARIANTS;

export default BlueprintNode;
