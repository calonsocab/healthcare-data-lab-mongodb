// MongoDBLeaf.jsx - MongoDB leaf logo icon

import React from 'react';

const MongoDBLeaf = ({ size = 24, color = '#00ED64', className = '', style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={style}
  >
    <path
      d="M12.001 2.5c0 0-0.5 2.5-0.5 4.5s0.5 3.5 0.5 5.5c0 2.5-0.5 4-0.5 6 0 1.5 0.5 3 0.5 3s0.5-1.5 0.5-3c0-2-0.5-3.5-0.5-6 0-2 0.5-3.5 0.5-5.5s-0.5-4.5-0.5-4.5z"
      fill={color}
    />
    <path
      d="M12.001 4c-1 1.5-3 3.5-3.5 6-0.5 2.5 0.5 5 2 7 0.5 0.5 1 1 1.5 1.5 0-0.5-0.5-2-0.5-3.5 0-1.5 0.5-3.5 0.5-5s-0.5-3.5-0.5-5c0.5-0.5 0.5-1 0.5-1z"
      fill={color}
      opacity="0.7"
    />
    <path
      d="M12.001 4c1 1.5 3 3.5 3.5 6 0.5 2.5-0.5 5-2 7-0.5 0.5-1 1-1.5 1.5 0-0.5 0.5-2 0.5-3.5 0-1.5-0.5-3.5-0.5-5s0.5-3.5 0.5-5c-0.5-0.5-0.5-1-0.5-1z"
      fill={color}
      opacity="0.7"
    />
  </svg>
);

export default MongoDBLeaf;
