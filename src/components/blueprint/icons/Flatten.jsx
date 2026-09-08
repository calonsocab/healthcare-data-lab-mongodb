// Flatten.jsx - Document flattening icon

import React from 'react';

const Flatten = ({ size = 24, color = '#00ED64', className = '', style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={style}
  >
    {/* Nested structure (input) */}
    <rect x="2" y="4" width="8" height="6" rx="1" stroke={color} strokeWidth="1.5" fill="none" />
    <rect x="4" y="6" width="4" height="2" rx="0.5" fill={color} opacity="0.5" />
    <rect x="2" y="11" width="8" height="6" rx="1" stroke={color} strokeWidth="1.5" fill="none" />
    <rect x="4" y="13" width="4" height="2" rx="0.5" fill={color} opacity="0.5" />

    {/* Arrow */}
    <path d="M11 10h3" stroke={color} strokeWidth="1.5" />
    <path d="M12 8l2 2-2 2" stroke={color} strokeWidth="1.5" fill="none" />

    {/* Flattened output (multiple rows) */}
    <rect x="15" y="4" width="7" height="3" rx="0.5" stroke={color} strokeWidth="1" fill="none" />
    <rect x="15" y="8" width="7" height="3" rx="0.5" stroke={color} strokeWidth="1" fill="none" />
    <rect x="15" y="12" width="7" height="3" rx="0.5" stroke={color} strokeWidth="1" fill="none" />
    <rect x="15" y="16" width="7" height="3" rx="0.5" stroke={color} strokeWidth="1" fill="none" />
  </svg>
);

export default Flatten;
