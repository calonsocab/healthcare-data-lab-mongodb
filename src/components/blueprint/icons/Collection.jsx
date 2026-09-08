// Collection.jsx - MongoDB Collection icon (stacked documents)

import React from 'react';

const Collection = ({ size = 24, color = '#00ED64', className = '', style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={style}
  >
    {/* Back document */}
    <rect
      x="6"
      y="3"
      width="12"
      height="14"
      rx="2"
      fill={color}
      opacity="0.2"
    />
    {/* Middle document */}
    <rect
      x="5"
      y="5"
      width="12"
      height="14"
      rx="2"
      fill={color}
      opacity="0.4"
    />
    {/* Front document */}
    <rect
      x="4"
      y="7"
      width="12"
      height="14"
      rx="2"
      stroke={color}
      strokeWidth="1.5"
      fill="none"
    />
    {/* Document lines */}
    <line x1="7" y1="11" x2="13" y2="11" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="7" y1="14" x2="11" y2="14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <line x1="7" y1="17" x2="12" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default Collection;
