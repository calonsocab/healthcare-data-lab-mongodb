// BlueprintLabel.jsx
// Text label/annotation component for architecture diagrams

import React from 'react';

/**
 * Label style presets
 */
const VARIANTS = {
  // Default muted text
  default: {
    color: '#94a3b8',
    fontSize: '12px',
    fontWeight: '400',
  },
  // Emphasized text
  emphasis: {
    color: '#e2e8f0',
    fontSize: '12px',
    fontWeight: '600',
  },
  // Small caption
  caption: {
    color: '#64748b',
    fontSize: '10px',
    fontWeight: '400',
  },
  // Code/technical
  code: {
    color: '#a855f7',
    fontSize: '11px',
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  // MongoDB green
  primary: {
    color: '#00ED64',
    fontSize: '12px',
    fontWeight: '500',
  },
  // Info callout
  info: {
    color: '#581c87',
    fontSize: '12px',
    fontWeight: '400',
    background: '#faf5ff',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #e9d5ff',
  },
  // Cyan callout
  cyan: {
    color: '#0d9488',
    fontSize: '12px',
    fontWeight: '400',
    background: 'rgba(13, 148, 136, 0.1)',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(13, 148, 136, 0.2)',
  },
};

/**
 * BlueprintLabel - Text annotation component
 *
 * @param {object} props
 * @param {string} props.text - Label text
 * @param {string} props.variant - Style variant
 * @param {string} props.align - Text alignment
 * @param {React.ReactNode} props.icon - Optional icon
 * @param {string} props.className - Additional CSS classes
 * @param {object} props.style - Additional inline styles
 */
const BlueprintLabel = ({
  text,
  children,
  variant = 'default',
  align = 'left',
  icon: Icon,
  className = '',
  style = {},
}) => {
  const variantStyles = VARIANTS[variant] || VARIANTS.default;

  return (
    <div
      className={`blueprint-label inline-flex items-center gap-1.5 ${className}`}
      style={{
        textAlign: align,
        ...variantStyles,
        ...style,
      }}
    >
      {Icon && (
        typeof Icon === 'function' ? (
          <Icon size={14} style={{ color: variantStyles.color }} />
        ) : (
          Icon
        )
      )}
      {text || children}
    </div>
  );
};

// Export variants for reference
BlueprintLabel.VARIANTS = VARIANTS;

export default BlueprintLabel;
