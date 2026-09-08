// Index.jsx - B-tree/Index icon

import React from 'react';

const Index = ({ size = 24, color = '#00ED64', className = '', style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={style}
  >
    {/* Root node */}
    <rect x="9" y="2" width="6" height="4" rx="1" fill={color} />
    {/* Lines to children */}
    <line x1="12" y1="6" x2="12" y2="8" stroke={color} strokeWidth="1.5" />
    <line x1="6" y1="8" x2="18" y2="8" stroke={color} strokeWidth="1.5" />
    <line x1="6" y1="8" x2="6" y2="10" stroke={color} strokeWidth="1.5" />
    <line x1="12" y1="8" x2="12" y2="10" stroke={color} strokeWidth="1.5" />
    <line x1="18" y1="8" x2="18" y2="10" stroke={color} strokeWidth="1.5" />
    {/* Level 2 nodes */}
    <rect x="3" y="10" width="6" height="4" rx="1" fill={color} opacity="0.7" />
    <rect x="9" y="10" width="6" height="4" rx="1" fill={color} opacity="0.7" />
    <rect x="15" y="10" width="6" height="4" rx="1" fill={color} opacity="0.7" />
    {/* Lines to leaf level */}
    <line x1="4" y1="14" x2="4" y2="16" stroke={color} strokeWidth="1" />
    <line x1="8" y1="14" x2="8" y2="16" stroke={color} strokeWidth="1" />
    <line x1="12" y1="14" x2="12" y2="16" stroke={color} strokeWidth="1" />
    <line x1="16" y1="14" x2="16" y2="16" stroke={color} strokeWidth="1" />
    <line x1="20" y1="14" x2="20" y2="16" stroke={color} strokeWidth="1" />
    {/* Leaf nodes */}
    <rect x="2" y="16" width="4" height="3" rx="0.5" fill={color} opacity="0.4" />
    <rect x="6" y="16" width="4" height="3" rx="0.5" fill={color} opacity="0.4" />
    <rect x="10" y="16" width="4" height="3" rx="0.5" fill={color} opacity="0.4" />
    <rect x="14" y="16" width="4" height="3" rx="0.5" fill={color} opacity="0.4" />
    <rect x="18" y="16" width="4" height="3" rx="0.5" fill={color} opacity="0.4" />
  </svg>
);

export default Index;
