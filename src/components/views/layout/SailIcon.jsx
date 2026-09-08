// src/components/views/layout/SailIcon.jsx
export default function SailIcon({ className = "w-8 h-8" }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: 'transparent' }}
    >
      {/* Main sail */}
      <path
        d="M32 8 L32 56 L12 56 Q16 40, 20 28 Q24 16, 32 8 Z"
        fill="#00ED64"
      />
      {/* Sail highlight */}
      <path
        d="M32 16 L32 52"
        stroke="#8CEBB0"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Small flag */}
      <path
        d="M32 8 L40 12 L32 16 Z"
        fill="#00ED64"
      />
    </svg>
  );
}
