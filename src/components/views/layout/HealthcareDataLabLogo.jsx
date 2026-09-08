// src/components/views/layout/brand/HealthcareDataLabLogo.jsx
export default function HealthcareDataLabLogo({ className = "h-14 w-full" }) {
    return (
      <svg
        viewBox="0 0 460 120"
        className={className}
        role="img"
        aria-label="MongoDB Healthcare Data Lab"
        preserveAspectRatio="xMidYMid meet"
        style={{ background: 'transparent' }}
        fill="none"
      >
        <title>MongoDB Healthcare Data Lab</title>
        <g transform="translate(8,12)">
          <path d="M26 114 C18 86, 18 58, 28 36 C38 16, 54 6, 66 4 C58 18, 52 36, 50 52 C48 70, 52 90, 62 114 Z" fill="#00ED64"/>
          <path d="M58 28 C56 54, 58 92, 66 116" stroke="#8CEBB0" strokeWidth="4" fill="none" strokeLinecap="round"/>
        </g>
        <g fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fontWeight="800" fontSize="44">
          <text x="110" y="68" fill="var(--color-logo-text, #FFFFFF)">MongoDB</text>
        </g>
        <g fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" fontWeight="700" fontSize="36">
          <text x="110" y="120" fill="#00ED64">Healthcare</text>
          <text x="302" y="120" fill="var(--color-logo-text, #FFFFFF)">Data Lab</text>
        </g>
      </svg>
    );
  }
