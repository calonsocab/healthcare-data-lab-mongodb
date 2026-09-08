// BlueprintCanvas.jsx
// Container component for MongoDB-style architecture diagrams

import React from 'react';

/**
 * BlueprintCanvas - Main container for architecture diagrams
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Child components
 * @param {number} props.width - Canvas width (default: 100%)
 * @param {number} props.height - Canvas height (default: auto)
 * @param {boolean} props.showGrid - Show grid background (default: false)
 * @param {string} props.gridColor - Grid line color
 * @param {number} props.gridSize - Grid cell size in pixels
 * @param {string} props.background - Background color
 * @param {string} props.className - Additional CSS classes
 * @param {object} props.style - Additional inline styles
 */
const BlueprintCanvas = ({
  children,
  width = '100%',
  height = 'auto',
  minHeight = 400,
  showGrid = false,
  gridColor = 'rgba(255,255,255,0.05)',
  gridSize = 20,
  background = 'transparent',
  className = '',
  style = {},
  padding = 24,
}) => {
  const gridStyle = showGrid ? {
    backgroundImage: `
      linear-gradient(${gridColor} 1px, transparent 1px),
      linear-gradient(90deg, ${gridColor} 1px, transparent 1px)
    `,
    backgroundSize: `${gridSize}px ${gridSize}px`,
  } : {};

  return (
    <div
      className={`blueprint-canvas relative ${className}`}
      style={{
        width,
        height,
        minHeight,
        background,
        padding,
        ...gridStyle,
        ...style,
      }}
    >
      {/* SVG layer for connectors - rendered behind nodes */}
      <svg
        className="blueprint-connectors absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <defs>
          {/* Arrow marker for connector ends */}
          <marker
            id="blueprint-arrow"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#6b7280" />
          </marker>
          <marker
            id="blueprint-arrow-green"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#00ED64" />
          </marker>
          <marker
            id="blueprint-arrow-purple"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#a855f7" />
          </marker>
          {/* Dot marker for connection points */}
          <marker
            id="blueprint-dot"
            markerWidth="8"
            markerHeight="8"
            refX="4"
            refY="4"
            orient="auto"
          >
            <circle cx="4" cy="4" r="3" fill="#1a1a2e" stroke="#6b7280" strokeWidth="1.5" />
          </marker>
          <marker
            id="blueprint-dot-green"
            markerWidth="8"
            markerHeight="8"
            refX="4"
            refY="4"
            orient="auto"
          >
            <circle cx="4" cy="4" r="3" fill="#001e2b" stroke="#00ED64" strokeWidth="1.5" />
          </marker>
        </defs>
      </svg>

      {/* Content layer for nodes */}
      <div className="blueprint-content relative" style={{ zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
};

export default BlueprintCanvas;
