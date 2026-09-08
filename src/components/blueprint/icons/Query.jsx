// Query.jsx - Query/Search users icon

import React from 'react';

const Query = ({ size = 24, color = '#00ED64', className = '', style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={style}
  >
    {/* User/person icon */}
    <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.5" fill="none" />
    <path
      d="M4 20c0-4 4-6 8-6s8 2 8 6"
      stroke={color}
      strokeWidth="1.5"
      fill="none"
    />
    {/* Search indicator */}
    <circle cx="18" cy="6" r="3" stroke={color} strokeWidth="1.5" fill="none" opacity="0.6" />
    <line x1="20" y1="8" x2="22" y2="10" stroke={color} strokeWidth="1.5" opacity="0.6" />
  </svg>
);

export default Query;
