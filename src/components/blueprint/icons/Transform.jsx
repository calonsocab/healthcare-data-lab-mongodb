// Transform.jsx - Data transformation icon

import React from 'react';

const Transform = ({ size = 24, color = '#00ED64', className = '', style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={style}
  >
    {/* Input shape */}
    <rect x="2" y="8" width="6" height="8" rx="1" stroke={color} strokeWidth="1.5" fill="none" />
    {/* Arrow */}
    <path d="M9 12h6" stroke={color} strokeWidth="1.5" />
    <path d="M13 10l2 2-2 2" stroke={color} strokeWidth="1.5" fill="none" />
    {/* Output shape (different) */}
    <circle cx="19" cy="12" r="4" stroke={color} strokeWidth="1.5" fill="none" />
    {/* Transformation symbol */}
    <text x="5" y="13.5" textAnchor="middle" fill={color} fontSize="6" fontFamily="monospace">A</text>
    <text x="19" y="14" textAnchor="middle" fill={color} fontSize="6" fontFamily="monospace">B</text>
  </svg>
);

export default Transform;
