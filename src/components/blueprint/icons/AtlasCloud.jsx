// AtlasCloud.jsx - MongoDB Atlas cloud icon

import React from 'react';

const AtlasCloud = ({ size = 24, color = '#00ED64', className = '', style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={style}
  >
    {/* Cloud shape */}
    <path
      d="M19 18H6c-2.2 0-4-1.8-4-4 0-1.9 1.3-3.4 3.1-3.9C5 9.7 5 9.4 5 9c0-2.2 1.8-4 4-4 1.5 0 2.8 0.8 3.5 2 0.5-0.3 1-0.5 1.5-0.5 1.4 0 2.5 1.1 2.5 2.5 0 0.2 0 0.4-0.1 0.5C18.6 9.8 20 11.2 20 13c0 2.8-2.2 5-5 5h4z"
      fill={color}
      opacity="0.3"
    />
    <path
      d="M19 18H6c-2.2 0-4-1.8-4-4 0-1.9 1.3-3.4 3.1-3.9C5 9.7 5 9.4 5 9c0-2.2 1.8-4 4-4 1.5 0 2.8 0.8 3.5 2 0.5-0.3 1-0.5 1.5-0.5 1.4 0 2.5 1.1 2.5 2.5 0 0.2 0 0.4-0.1 0.5C18.6 9.8 20 11.2 20 13c0 2.8-2.2 5-5 5h4z"
      stroke={color}
      strokeWidth="1.5"
      fill="none"
    />
    {/* Leaf inside */}
    <path
      d="M12 11c0 0-0.3 1.2-0.3 2.2s0.3 1.7 0.3 2.7c0 0.8-0.2 1.5-0.2 1.5s0.2-0.7 0.2-1.5c0-1-0.3-1.7-0.3-2.7s0.3-2.2 0.3-2.2z"
      fill={color}
    />
  </svg>
);

export default AtlasCloud;
