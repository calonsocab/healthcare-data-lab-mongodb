// BlueprintGroup.jsx
// Container component for grouping nodes together

import React from 'react';

/**
 * Group variants
 */
const VARIANTS = {
  // Default dark outline
  default: {
    background: 'transparent',
    border: '#334155',
    headerBg: 'transparent',
    headerText: '#94a3b8',
  },
  // Solid dark background
  solid: {
    background: '#1e293b',
    border: '#334155',
    headerBg: '#0f172a',
    headerText: '#e2e8f0',
  },
  // Purple/pink info style (like MongoDB examples)
  info: {
    background: '#faf5ff',
    border: '#e9d5ff',
    headerBg: '#f3e8ff',
    headerText: '#581c87',
  },
  // Cyan/teal style
  cyan: {
    background: 'rgba(13, 148, 136, 0.05)',
    border: 'rgba(13, 148, 136, 0.3)',
    headerBg: 'rgba(13, 148, 136, 0.1)',
    headerText: '#0d9488',
  },
  // Green MongoDB style
  primary: {
    background: 'rgba(0, 237, 100, 0.03)',
    border: 'rgba(0, 237, 100, 0.2)',
    headerBg: 'rgba(0, 237, 100, 0.1)',
    headerText: '#00ED64',
  },
  // Ghost/transparent style
  ghost: {
    background: 'rgba(255,255,255,0.02)',
    border: 'rgba(255,255,255,0.1)',
    headerBg: 'transparent',
    headerText: '#94a3b8',
  },
  // Dashed outline (like "Legacy App" in examples)
  dashed: {
    background: 'transparent',
    border: '#475569',
    borderStyle: 'dashed',
    headerBg: 'transparent',
    headerText: '#94a3b8',
  },
};

/**
 * BlueprintGroup - Container for grouping nodes
 *
 * @param {object} props
 * @param {string} props.title - Group title
 * @param {string} props.subtitle - Group subtitle
 * @param {string} props.variant - Style variant
 * @param {React.ReactNode} props.children - Child nodes
 * @param {string} props.layout - Layout direction ('row', 'column', 'grid')
 * @param {number} props.gap - Gap between children
 * @param {string} props.align - Alignment ('start', 'center', 'end', 'stretch')
 * @param {string} props.justify - Justification ('start', 'center', 'end', 'between', 'around')
 * @param {number} props.padding - Internal padding
 * @param {string} props.width - Group width
 * @param {string} props.height - Group height
 * @param {string} props.className - Additional CSS classes
 * @param {object} props.style - Additional inline styles
 */
const BlueprintGroup = ({
  title,
  subtitle,
  variant = 'default',
  children,
  layout = 'row',
  gap = 16,
  align = 'center',
  justify = 'center',
  padding = 16,
  width = 'auto',
  height = 'auto',
  borderRadius = '12px',
  className = '',
  style = {},
  headerPosition = 'top', // 'top', 'left', 'right', 'inside-top'
  id,
}) => {
  const colors = VARIANTS[variant] || VARIANTS.default;
  const isDashed = variant === 'dashed' || colors.borderStyle === 'dashed';

  const layoutClass = {
    row: 'flex-row',
    column: 'flex-col',
    grid: 'grid grid-cols-2',
  }[layout];

  const alignClass = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  }[align];

  const justifyClass = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
  }[justify];

  return (
    <div
      id={id}
      className={`blueprint-group ${className}`}
      style={{
        width,
        height,
        ...style,
      }}
      data-group-id={id}
    >
      {/* Header - outside top */}
      {title && headerPosition === 'top' && (
        <div
          className="blueprint-group-header px-3 py-1.5 mb-2 rounded-t-lg inline-block"
          style={{
            background: colors.headerBg,
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <span
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: colors.headerText }}
          >
            {title}
          </span>
          {subtitle && (
            <span
              className="text-xs ml-2 opacity-70"
              style={{ color: colors.headerText }}
            >
              {subtitle}
            </span>
          )}
        </div>
      )}

      {/* Main container */}
      <div
        className={`blueprint-group-content flex ${layoutClass} ${alignClass} ${justifyClass}`}
        style={{
          background: colors.background,
          border: `2px ${isDashed ? 'dashed' : 'solid'} ${colors.border}`,
          borderRadius,
          padding,
          gap,
        }}
      >
        {/* Header - inside top */}
        {title && headerPosition === 'inside-top' && (
          <div
            className="blueprint-group-header-inside w-full text-center pb-2 mb-2 border-b"
            style={{ borderColor: colors.border }}
          >
            <span
              className="text-sm font-semibold"
              style={{ color: colors.headerText }}
            >
              {title}
            </span>
            {subtitle && (
              <p
                className="text-xs mt-0.5 opacity-80"
                style={{ color: colors.headerText }}
              >
                {subtitle}
              </p>
            )}
          </div>
        )}

        {children}
      </div>

      {/* Header - right side callout (like MongoDB examples) */}
      {title && headerPosition === 'right' && (
        <div
          className="blueprint-group-callout absolute -right-4 top-1/2 -translate-y-1/2 translate-x-full"
          style={{
            background: colors.headerBg || '#faf5ff',
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            padding: '12px 16px',
            maxWidth: '200px',
          }}
        >
          <div
            className="text-sm font-semibold mb-1"
            style={{ color: colors.headerText }}
          >
            {title}
          </div>
          {subtitle && (
            <p
              className="text-xs opacity-80"
              style={{ color: colors.headerText }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// Export variants for reference
BlueprintGroup.VARIANTS = VARIANTS;

export default BlueprintGroup;
