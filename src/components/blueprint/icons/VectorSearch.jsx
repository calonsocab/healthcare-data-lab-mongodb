// VectorSearch.jsx - Vector/embedding search icon

import React from 'react';

const VectorSearch = ({ size = 24, color = '#00ED64', className = '', style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={style}
  >
    {/* Vector representation (dots in space) */}
    <circle cx="6" cy="6" r="1.5" fill={color} opacity="0.4" />
    <circle cx="10" cy="8" r="1.5" fill={color} opacity="0.6" />
    <circle cx="8" cy="12" r="1.5" fill={color} opacity="0.5" />
    <circle cx="12" cy="14" r="1.5" fill={color} opacity="0.7" />
    <circle cx="6" cy="16" r="1.5" fill={color} opacity="0.4" />

    {/* Target/query point */}
    <circle cx="9" cy="10" r="2" stroke={color} strokeWidth="2" fill="none" />

    {/* Search magnifier */}
    <circle cx="16" cy="10" r="4" stroke={color} strokeWidth="1.5" fill="none" />
    <line x1="19" y1="13" x2="22" y2="16" stroke={color} strokeWidth="1.5" strokeLinecap="round" />

    {/* Connection lines representing nearest neighbors */}
    <line x1="9" y1="10" x2="10" y2="8" stroke={color} strokeWidth="1" strokeDasharray="2,2" opacity="0.5" />
    <line x1="9" y1="10" x2="8" y2="12" stroke={color} strokeWidth="1" strokeDasharray="2,2" opacity="0.5" />
    <line x1="9" y1="10" x2="6" y2="6" stroke={color} strokeWidth="1" strokeDasharray="2,2" opacity="0.3" />
  </svg>
);

export default VectorSearch;
