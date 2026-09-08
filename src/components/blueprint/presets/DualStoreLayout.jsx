// DualStoreLayout.jsx
// Pre-built layout for the Reversed Path Search - Dual Collection strategy
// MongoDB Blueprint Style - Dark theme with green accents

"use client";

import React from 'react';

// MongoDB Brand Colors
const C = {
  green: '#00ED64',
  greenDark: '#00684A',
  greenFaded: 'rgba(0, 237, 100, 0.15)',
  purple: '#a855f7',
  purpleFaded: 'rgba(168, 85, 247, 0.15)',
  white: '#ffffff',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textDark: '#64748b',
  slate: '#475569',
  slateLine: '#334155',
  bg: '#0f172a',
};

/**
 * DualStoreLayout - MongoDB Blueprint style visualization
 * Reversed Path Search - Dual Collection Strategy
 */
const DualStoreLayout = ({
  title = 'Reversed Path Search - Dual Collection',
  description = 'Logical openEHR dual-store model with configurable physical encodings.',
  className = '',
  style = {},
  interactive = false,
  onNodeClick,
}) => {
  const click = (id) => interactive && onNodeClick?.(id);

  return (
    <div className={`dual-store-layout ${className}`} style={style}>
      {/* Description */}
      {description && (
        <p className="text-sm text-slate-400 mb-6">{description}</p>
      )}

      {/* Main SVG Diagram */}
      <svg viewBox="0 0 900 450" className="w-full h-auto" style={{ maxHeight: '450px' }}>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* INGEST NODE */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <g transform="translate(50, 50)" onClick={() => click('ingest')} style={{ cursor: interactive ? 'pointer' : 'default' }}>
          <rect width="130" height="85" rx="4" fill="transparent" stroke={C.slate} strokeWidth="1.5" />
          {/* Icon - Layers/Stack */}
          <g transform="translate(52, 15)">
            <path
              d="M12 2L2 7l10 5 10-5-10-5z"
              stroke={C.text}
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M2 12l10 5 10-5" stroke={C.text} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 17l10 5 10-5" stroke={C.text} strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <text x="65" y="55" textAnchor="middle" fill={C.text} fontSize="12" fontWeight="600">INGEST</text>
          <text x="65" y="72" textAnchor="middle" fill={C.textMuted} fontSize="10">Composition</text>
        </g>

        {/* Vertical connector */}
        <line x1="115" y1="135" x2="115" y2="160" stroke={C.slateLine} strokeWidth="1.5" />
        <circle cx="115" cy="160" r="3" fill={C.slateLine} />

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* FLATTEN NODE */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <g transform="translate(50, 170)" onClick={() => click('flatten')} style={{ cursor: interactive ? 'pointer' : 'default' }}>
          <rect width="130" height="85" rx="4" fill="transparent" stroke={C.slate} strokeWidth="1.5" />
          {/* Icon - Grid/Flatten */}
          <g transform="translate(47, 12)">
            <rect x="2" y="2" width="8" height="8" stroke={C.text} strokeWidth="1.5" fill="none" rx="1" />
            <rect x="14" y="2" width="8" height="8" stroke={C.text} strokeWidth="1.5" fill="none" rx="1" />
            <rect x="2" y="14" width="8" height="8" stroke={C.text} strokeWidth="1.5" fill="none" rx="1" />
            <rect x="14" y="14" width="8" height="8" stroke={C.text} strokeWidth="1.5" fill="none" rx="1" />
          </g>
          <text x="65" y="55" textAnchor="middle" fill={C.text} fontSize="12" fontWeight="600">FLATTEN</text>
          <text x="65" y="72" textAnchor="middle" fill={C.textMuted} fontSize="10">Document → Nodes</text>
        </g>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CONNECTOR LINES TO COLLECTIONS */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <circle cx="180" cy="212" r="3" fill={C.slateLine} />

        {/* Upper curve to Canonical */}
        <path
          d="M180,212 C270,212 270,105 360,105"
          stroke={C.slateLine}
          strokeWidth="1.5"
          fill="none"
        />
        <polygon points="360,105 352,101 352,109" fill={C.slateLine} />

        {/* Lower curve to Projection */}
        <path
          d="M180,212 C270,212 270,310 360,310"
          stroke={C.slateLine}
          strokeWidth="1.5"
          fill="none"
        />
        <polygon points="360,310 352,306 352,314" fill={C.slateLine} />

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CANONICAL COLLECTION - MongoDB Green filled */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <g transform="translate(370, 45)" onClick={() => click('canonical')} style={{ cursor: interactive ? 'pointer' : 'default' }}>
          <rect width="180" height="120" rx="4" fill={C.greenDark} stroke={C.green} strokeWidth="2" />
          <text x="90" y="28" textAnchor="middle" fill={C.white} fontSize="13" fontWeight="700">CANONICAL</text>
          <text x="90" y="48" textAnchor="middle" fill={C.green} fontSize="11">compositions</text>
          <text x="90" y="68" textAnchor="middle" fill={C.textMuted} fontSize="10">Full nodes (cn[])</text>

          {/* Badges */}
          <g transform="translate(25, 80)">
            <rect width="55" height="22" rx="4" fill={C.greenFaded} stroke={C.green} strokeWidth="1" />
            <text x="27.5" y="15" textAnchor="middle" fill={C.green} fontSize="10">B-tree</text>
          </g>
          <g transform="translate(100, 80)">
            <rect width="55" height="22" rx="4" fill={C.greenFaded} stroke={C.green} strokeWidth="1" />
            <text x="27.5" y="15" textAnchor="middle" fill={C.green} fontSize="10">Patient</text>
          </g>
        </g>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* JOIN INDICATOR */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <line x1="460" y1="170" x2="460" y2="245" stroke={C.textDark} strokeWidth="1.5" strokeDasharray="4,4" />
        <text x="485" y="210" fill={C.textMuted} fontSize="10">_id join</text>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* PROJECTION COLLECTION - Purple outline */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <g transform="translate(370, 250)" onClick={() => click('projection')} style={{ cursor: interactive ? 'pointer' : 'default' }}>
          <rect width="180" height="120" rx="4" fill="transparent" stroke={C.purple} strokeWidth="2" />
          <text x="90" y="28" textAnchor="middle" fill={C.purple} fontSize="13" fontWeight="700">PROJECTION</text>
          <text x="90" y="48" textAnchor="middle" fill={C.purple} fontSize="11">search</text>
          <text x="90" y="68" textAnchor="middle" fill={C.textMuted} fontSize="10">Slim nodes (sn[])</text>

          {/* Badges */}
          <g transform="translate(25, 80)">
            <rect width="55" height="22" rx="4" fill={C.purpleFaded} stroke={C.purple} strokeWidth="1" />
            <text x="27.5" y="15" textAnchor="middle" fill={C.purple} fontSize="10">Atlas</text>
          </g>
          <g transform="translate(100, 80)">
            <rect width="65" height="22" rx="4" fill={C.purpleFaded} stroke={C.purple} strokeWidth="1" />
            <text x="32.5" y="15" textAnchor="middle" fill={C.purple} fontSize="10">Population</text>
          </g>
        </g>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* CONNECTOR LINES TO QUERIES */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        {/* Canonical to Patient Query */}
        <circle cx="550" cy="105" r="3" fill={C.green} />
        <line x1="553" y1="105" x2="640" y2="105" stroke={C.green} strokeWidth="1.5" />
        <polygon points="640,105 632,101 632,109" fill={C.green} />

        {/* Projection to Population Query */}
        <circle cx="550" cy="310" r="3" fill={C.purple} />
        <line x1="553" y1="310" x2="640" y2="310" stroke={C.purple} strokeWidth="1.5" />
        <polygon points="640,310 632,306 632,314" fill={C.purple} />

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* PATIENT QUERY NODE */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <g transform="translate(650, 45)" onClick={() => click('patient-query')} style={{ cursor: interactive ? 'pointer' : 'default' }}>
          <rect width="160" height="120" rx="4" fill="transparent" stroke={C.green} strokeWidth="1.5" />
          {/* User Icon */}
          <g transform="translate(68, 15)">
            <circle cx="12" cy="8" r="5" stroke={C.green} strokeWidth="1.5" fill="none" />
            <path d="M4 24c0-6 4-10 8-10s8 4 8 10" stroke={C.green} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </g>
          <text x="80" y="65" textAnchor="middle" fill={C.green} fontSize="13" fontWeight="600">Patient Query</text>
          <text x="80" y="85" textAnchor="middle" fill={C.textMuted} fontSize="10">$match on ehr_id</text>
        </g>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* POPULATION QUERY NODE */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <g transform="translate(650, 250)" onClick={() => click('population-query')} style={{ cursor: interactive ? 'pointer' : 'default' }}>
          <rect width="160" height="120" rx="4" fill="transparent" stroke={C.purple} strokeWidth="1.5" />
          {/* Search Icon */}
          <g transform="translate(68, 15)">
            <circle cx="11" cy="11" r="7" stroke={C.purple} strokeWidth="1.5" fill="none" />
            <line x1="16" y1="16" x2="22" y2="22" stroke={C.purple} strokeWidth="1.5" strokeLinecap="round" />
          </g>
          <text x="80" y="60" textAnchor="middle" fill={C.purple} fontSize="12" fontWeight="600">Population</text>
          <text x="80" y="76" textAnchor="middle" fill={C.purple} fontSize="12" fontWeight="600">Query</text>
          <text x="80" y="96" textAnchor="middle" fill={C.textMuted} fontSize="10">$search on sn.p</text>
        </g>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* MongoDB Leaf Watermark */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <g transform="translate(830, 180)" opacity="0.1">
          <path
            d="M30 0c-3.6 7.2-7.2 13.2-7.2 21.6 0 14.4 10.8 26.4 10.8 26.4s1.2-3.6 1.2-7.2c0-4.8-2.4-9.6-2.4-14.4s2.4-12 2.4-19.2c0-2.4-1.2-4.8-4.8-7.2z"
            fill={C.green}
          />
          <path
            d="M30 0c3.6 7.2 7.2 13.2 7.2 21.6 0 14.4-10.8 26.4-10.8 26.4s-1.2-3.6-1.2-7.2c0-4.8 2.4-9.6 2.4-14.4s-2.4-12-2.4-19.2c0-2.4 1.2-4.8 4.8-7.2z"
            fill={C.greenDark}
          />
        </g>

      </svg>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Feature Cards - MongoDB Style */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-semibold" style={{ color: C.green }}>Reversed Paths</span>
          </div>
          <p className="text-sm text-slate-400">
            Leaf-to-root path encoding enables prefix matching for AQL CONTAINS without knowing depth.
          </p>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            <span className="font-semibold" style={{ color: C.green }}>Dual-Store</span>
          </div>
          <p className="text-sm text-slate-400">
            Separates patient-scoped (full fidelity) from cross-patient (slim) workloads.
          </p>
        </div>
      </div>

      {/* Stats footer */}
      <div className="flex items-center gap-6 mt-4 text-xs text-slate-500">
        <span>2 collections</span>
        <span>2 pipeline steps</span>
        <span>2 query patterns</span>
      </div>
    </div>
  );
};

export default DualStoreLayout;
