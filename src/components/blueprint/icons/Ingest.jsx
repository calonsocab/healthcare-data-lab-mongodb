// Ingest.jsx - Data ingest/input icon

import React from 'react';

const Ingest = ({ size = 24, color = '#00ED64', className = '', style = {} }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
    style={style}
  >
    {/* Incoming arrow */}
    <path d="M4 12h12" stroke={color} strokeWidth="2" />
    <path d="M12 8l4 4-4 4" stroke={color} strokeWidth="2" fill="none" />
    {/* Database/storage */}
    <ellipse cx="19" cy="8" rx="3" ry="2" stroke={color} strokeWidth="1.5" fill="none" />
    <path d="M16 8v8c0 1.1 1.3 2 3 2s3-0.9 3-2V8" stroke={color} strokeWidth="1.5" fill="none" />
    <ellipse cx="19" cy="12" rx="3" ry="1" stroke={color} strokeWidth="0.5" fill="none" opacity="0.5" />
  </svg>
);

export default Ingest;
