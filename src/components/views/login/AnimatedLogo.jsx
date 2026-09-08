// src/components/views/login/AnimatedLogo.jsx
"use client";

import { useState, useEffect } from 'react';

export default function AnimatedLogo({ className = "w-32 h-32" }) {
  const [showBraces, setShowBraces] = useState(true);

  useEffect(() => {
    // Toggle braces every 1.5 seconds
    const interval = setInterval(() => {
      setShowBraces(prev => !prev);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`relative ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px'
      }}
    >
      {/* Left brace */}
      <span
        style={{
          fontSize: '1rem',
          fontFamily: 'ui-monospace, monospace',
          fontWeight: 300,
          lineHeight: 1,
          color: '#00ED64',
          opacity: showBraces ? 1 : 0,
          transition: 'opacity 500ms ease-in-out'
        }}
      >
        {'{'}
      </span>

      {/* Waves only */}
      <svg
        viewBox="0 0 48 24"
        style={{ width: '40px', height: '20px', flexShrink: 0 }}
        fill="none"
      >
        {/* Top wave */}
        <path
          d="M0 8 Q6 4, 12 8 Q18 12, 24 8 Q30 4, 36 8 Q42 12, 48 8"
          stroke="#00ED64"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
          className="animate-wave"
        />
        {/* Bottom wave */}
        <path
          d="M0 16 Q6 12, 12 16 Q18 20, 24 16 Q30 12, 36 16 Q42 20, 48 16"
          stroke="#00ED64"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          opacity="0.5"
          className="animate-wave-delayed"
        />
      </svg>

      {/* Right brace */}
      <span
        style={{
          fontSize: '1rem',
          fontFamily: 'ui-monospace, monospace',
          fontWeight: 300,
          lineHeight: 1,
          color: '#00ED64',
          opacity: showBraces ? 1 : 0,
          transition: 'opacity 500ms ease-in-out'
        }}
      >
        {'}'}
      </span>
    </div>
  );
}
