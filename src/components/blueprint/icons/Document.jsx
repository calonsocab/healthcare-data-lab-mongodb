// Document.jsx - Single document/JSON icon

import React from 'react';

const Document = ({ size = 24, color = '#00ED64', className = '', style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={style}
  >
    {/* Document shape */}
    <path
      d="M14 2H6c-1.1 0-2 0.9-2 2v16c0 1.1 0.9 2 2 2h12c1.1 0 2-0.9 2-2V8l-6-6z"
      stroke={color}
      strokeWidth="1.5"
      fill="none"
    />
    {/* Folded corner */}
    <path
      d="M14 2v6h6"
      stroke={color}
      strokeWidth="1.5"
      fill="none"
    />
    {/* JSON braces */}
    <text
      x="12"
      y="16"
      textAnchor="middle"
      fill={color}
      fontSize="8"
      fontFamily="monospace"
      fontWeight="bold"
    >
      {'{ }'}
    </text>
  </svg>
);

export default Document;
