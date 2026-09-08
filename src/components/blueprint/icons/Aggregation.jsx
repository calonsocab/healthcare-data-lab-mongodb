// Aggregation.jsx - Pipeline/Aggregation icon

import React from 'react';

const Aggregation = ({ size = 24, color = '#00ED64', className = '', style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={style}
  >
    {/* Pipeline stages */}
    <rect x="2" y="4" width="6" height="4" rx="1" fill={color} opacity="0.4" />
    <rect x="9" y="4" width="6" height="4" rx="1" fill={color} opacity="0.6" />
    <rect x="16" y="4" width="6" height="4" rx="1" fill={color} opacity="0.8" />

    {/* Connecting arrows */}
    <path d="M8 6h1" stroke={color} strokeWidth="1.5" />
    <path d="M15 6h1" stroke={color} strokeWidth="1.5" />

    {/* $match icon */}
    <text x="5" y="7" textAnchor="middle" fill={color} fontSize="5" fontFamily="monospace">$m</text>

    {/* $group icon */}
    <text x="12" y="7" textAnchor="middle" fill={color} fontSize="5" fontFamily="monospace">$g</text>

    {/* $project icon */}
    <text x="19" y="7" textAnchor="middle" fill={color} fontSize="5" fontFamily="monospace">$p</text>

    {/* Input documents */}
    <rect x="2" y="12" width="4" height="3" rx="0.5" stroke={color} strokeWidth="1" fill="none" />
    <rect x="3" y="13" width="4" height="3" rx="0.5" stroke={color} strokeWidth="1" fill="none" />
    <rect x="4" y="14" width="4" height="3" rx="0.5" stroke={color} strokeWidth="1" fill="none" />

    {/* Arrow through pipeline */}
    <path d="M9 15.5h6" stroke={color} strokeWidth="1.5" markerEnd="url(#arrow)" />
    <path d="M13 14l2 1.5-2 1.5" stroke={color} strokeWidth="1.5" fill="none" />

    {/* Output document */}
    <rect x="17" y="13" width="5" height="5" rx="1" fill={color} opacity="0.3" stroke={color} strokeWidth="1" />
  </svg>
);

export default Aggregation;
