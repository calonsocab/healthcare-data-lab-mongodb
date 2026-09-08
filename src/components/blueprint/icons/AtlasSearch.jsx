// AtlasSearch.jsx - Atlas Search icon

import React from 'react';

const AtlasSearch = ({ size = 24, color = '#00ED64', className = '', style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={style}
  >
    {/* Magnifying glass */}
    <circle
      cx="10"
      cy="10"
      r="6"
      stroke={color}
      strokeWidth="2"
      fill="none"
    />
    <line
      x1="14.5"
      y1="14.5"
      x2="20"
      y2="20"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* Search lines inside */}
    <line x1="7" y1="8" x2="13" y2="8" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="7" y1="11" x2="11" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default AtlasSearch;
