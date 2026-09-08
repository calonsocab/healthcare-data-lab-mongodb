// BlueprintConnector.jsx
// SVG connector/line component for drawing relationships between nodes

import React from 'react';

/**
 * Connector style presets
 */
const STYLES = {
  default: {
    stroke: '#6b7280',
    strokeWidth: 2,
  },
  primary: {
    stroke: '#00ED64',
    strokeWidth: 2,
  },
  purple: {
    stroke: '#a855f7',
    strokeWidth: 2,
  },
  cyan: {
    stroke: '#0d9488',
    strokeWidth: 2,
  },
  amber: {
    stroke: '#f59e0b',
    strokeWidth: 2,
  },
  subtle: {
    stroke: '#475569',
    strokeWidth: 1.5,
  },
  dashed: {
    stroke: '#6b7280',
    strokeWidth: 2,
    strokeDasharray: '6,4',
  },
  'dashed-primary': {
    stroke: '#00ED64',
    strokeWidth: 2,
    strokeDasharray: '6,4',
  },
};

/**
 * BlueprintConnector - SVG line/path between nodes
 *
 * This component is designed to be used within a BlueprintCanvas.
 * It renders an SVG path with optional arrows and labels.
 *
 * For simple usage, provide points array.
 * For automatic node connection, use fromId/toId (requires JS positioning).
 *
 * @param {object} props
 * @param {Array} props.points - Array of [x, y] coordinates
 * @param {string} props.variant - Style variant
 * @param {string} props.type - Path type ('straight', 'curved', 'elbow', 'step')
 * @param {boolean} props.arrow - Show arrow at end
 * @param {boolean} props.startDot - Show dot at start
 * @param {boolean} props.endDot - Show dot at end
 * @param {string} props.label - Text label on the line
 * @param {string} props.labelPosition - Label position ('start', 'middle', 'end')
 * @param {string} props.className - Additional CSS classes
 */
const BlueprintConnector = ({
  points = [],
  variant = 'default',
  type = 'straight',
  arrow = false,
  startDot = false,
  endDot = false,
  label = '',
  labelPosition = 'middle',
  className = '',
  style = {},
}) => {
  const colors = STYLES[variant] || STYLES.default;

  if (points.length < 2) return null;

  // Generate path based on type
  const generatePath = () => {
    const [start, ...rest] = points;
    const end = rest[rest.length - 1];

    switch (type) {
      case 'curved': {
        // Bezier curve - good for flowing connections
        if (points.length === 2) {
          const midX = (start[0] + end[0]) / 2;
          const midY = (start[1] + end[1]) / 2;
          const dx = end[0] - start[0];
          const dy = end[1] - start[1];

          // Create control points perpendicular to the line
          const ctrl1X = start[0] + dx * 0.25;
          const ctrl1Y = start[1] + dy * 0.5;
          const ctrl2X = end[0] - dx * 0.25;
          const ctrl2Y = end[1] - dy * 0.5;

          return `M ${start[0]} ${start[1]} C ${ctrl1X} ${ctrl1Y}, ${ctrl2X} ${ctrl2Y}, ${end[0]} ${end[1]}`;
        }
        // For multiple points, create smooth curve through all
        let d = `M ${start[0]} ${start[1]}`;
        for (let i = 0; i < rest.length; i++) {
          const p = rest[i];
          const prev = i === 0 ? start : rest[i - 1];
          const cpX = (prev[0] + p[0]) / 2;
          const cpY = (prev[1] + p[1]) / 2;
          d += ` Q ${prev[0]} ${prev[1]}, ${cpX} ${cpY}`;
        }
        d += ` T ${end[0]} ${end[1]}`;
        return d;
      }

      case 'elbow': {
        // Right-angle connections
        if (points.length === 2) {
          const midX = (start[0] + end[0]) / 2;
          return `M ${start[0]} ${start[1]} L ${midX} ${start[1]} L ${midX} ${end[1]} L ${end[0]} ${end[1]}`;
        }
        // Multiple points - connect with right angles
        let d = `M ${start[0]} ${start[1]}`;
        rest.forEach(p => {
          d += ` L ${p[0]} ${start[1]} L ${p[0]} ${p[1]}`;
        });
        return d;
      }

      case 'step': {
        // Stepped horizontal-first connection
        if (points.length === 2) {
          const stepX = start[0] + (end[0] - start[0]) * 0.5;
          return `M ${start[0]} ${start[1]} H ${stepX} V ${end[1]} H ${end[0]}`;
        }
        // Multiple points
        let d = `M ${start[0]} ${start[1]}`;
        for (let i = 0; i < rest.length; i++) {
          const p = rest[i];
          d += ` H ${p[0]} V ${p[1]}`;
        }
        return d;
      }

      case 'straight':
      default: {
        // Simple polyline
        let d = `M ${start[0]} ${start[1]}`;
        rest.forEach(p => {
          d += ` L ${p[0]} ${p[1]}`;
        });
        return d;
      }
    }
  };

  // Calculate label position
  const getLabelPosition = () => {
    if (points.length < 2) return { x: 0, y: 0 };

    const start = points[0];
    const end = points[points.length - 1];

    switch (labelPosition) {
      case 'start':
        return { x: start[0] + 10, y: start[1] - 8 };
      case 'end':
        return { x: end[0] - 10, y: end[1] - 8 };
      case 'middle':
      default:
        return {
          x: (start[0] + end[0]) / 2,
          y: (start[1] + end[1]) / 2 - 8,
        };
    }
  };

  const path = generatePath();
  const labelPos = getLabelPosition();

  // Determine markers
  const startMarker = startDot ? 'url(#blueprint-dot)' : undefined;
  const endMarker = arrow
    ? variant === 'primary'
      ? 'url(#blueprint-arrow-green)'
      : variant === 'purple'
      ? 'url(#blueprint-arrow-purple)'
      : 'url(#blueprint-arrow)'
    : endDot
    ? 'url(#blueprint-dot)'
    : undefined;

  return (
    <g className={`blueprint-connector ${className}`}>
      <path
        d={path}
        fill="none"
        stroke={colors.stroke}
        strokeWidth={colors.strokeWidth}
        strokeDasharray={colors.strokeDasharray}
        markerStart={startMarker}
        markerEnd={endMarker}
        style={style}
      />
      {label && (
        <text
          x={labelPos.x}
          y={labelPos.y}
          textAnchor="middle"
          className="text-xs fill-slate-400"
          style={{ fontSize: '11px' }}
        >
          {label}
        </text>
      )}
    </g>
  );
};

// Export styles for reference
BlueprintConnector.STYLES = STYLES;

export default BlueprintConnector;
