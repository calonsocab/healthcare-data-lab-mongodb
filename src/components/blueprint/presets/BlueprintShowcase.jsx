// BlueprintShowcase.jsx
// Showcase demonstrating MongoDB Blueprint styling capabilities
// Inspired by official MongoDB architecture diagrams

"use client";

import React from 'react';

// MongoDB Brand Colors
const C = {
  green: '#00ED64',
  greenDark: '#00684A',
  greenFaded: 'rgba(0, 237, 100, 0.15)',
  white: '#ffffff',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  textDark: '#64748b',
  slate: '#475569',
  slateLine: '#334155',
  bg: '#0f172a',
};

/**
 * BlueprintShowcase - Healthcare Data Platform Architecture
 * Demonstrates MongoDB Blueprint styling capabilities
 */
const BlueprintShowcase = ({ className = '', interactive = false, onNodeClick }) => {
  const click = (id) => interactive && onNodeClick?.(id);

  return (
    <div className={`blueprint-showcase ${className}`}>
      {/* Title */}
      <h2 className="text-xl font-bold text-white mb-2">Healthcare Data Platform</h2>
      <p className="text-sm text-slate-400 mb-8">End-to-end data flow from clinical sources to analytics</p>

      <svg viewBox="0 0 1000 600" className="w-full h-auto" style={{ maxHeight: '600px' }}>
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION: Data Sources (Top Row) */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        {/* Data Source Boxes - Pill style like FHIR diagram */}
        {[
          { x: 80, label: 'EHR' },
          { x: 200, label: 'Lab Systems' },
          { x: 340, label: 'Pharmacy' },
          { x: 470, label: 'Imaging' },
          { x: 590, label: 'Wearables' },
          { x: 720, label: 'Claims' },
        ].map((src, i) => (
          <g key={i} transform={`translate(${src.x}, 30)`}>
            <rect
              width="100"
              height="36"
              rx="18"
              fill={C.bg}
              stroke={C.slate}
              strokeWidth="1.5"
            />
            <text x="50" y="23" textAnchor="middle" fill={C.text} fontSize="11" fontWeight="500">
              {src.label}
            </text>
          </g>
        ))}

        {/* Vertical connectors from sources */}
        {[130, 250, 390, 520, 640, 770].map((x, i) => (
          <g key={i}>
            <line x1={x} y1="66" x2={x} y2="100" stroke={C.slateLine} strokeWidth="1.5" />
            <circle cx={x} cy="100" r="3" fill={C.slateLine} />
          </g>
        ))}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION: Ingest Layer */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        {/* Ingest Label - Pill filled green */}
        <g transform="translate(20, 115)">
          <rect width="70" height="28" rx="14" fill={C.green} />
          <text x="35" y="19" textAnchor="middle" fill={C.bg} fontSize="11" fontWeight="600">Ingest</text>
        </g>

        {/* Stream Processing Box */}
        <g transform="translate(110, 105)" onClick={() => click('stream')}>
          <rect
            width="280"
            height="50"
            rx="4"
            fill="transparent"
            stroke={C.green}
            strokeWidth="1.5"
          />
          <text x="140" y="30" textAnchor="middle" fill={C.text} fontSize="12">Stream Processing</text>
        </g>

        {/* Horizontal connector */}
        <line x1="390" y1="130" x2="420" y2="130" stroke={C.slateLine} strokeWidth="1.5" />
        <circle cx="420" cy="130" r="3" fill={C.slateLine} />

        {/* Batch Processing Box */}
        <g transform="translate(440, 105)" onClick={() => click('batch')}>
          <rect
            width="280"
            height="50"
            rx="4"
            fill="transparent"
            stroke={C.green}
            strokeWidth="1.5"
          />
          <text x="140" y="30" textAnchor="middle" fill={C.text} fontSize="12">Batch Processing</text>
        </g>

        {/* Connectors down from processing */}
        <line x1="250" y1="155" x2="250" y2="190" stroke={C.slateLine} strokeWidth="1.5" />
        <circle cx="250" cy="190" r="3" fill={C.slateLine} />
        <line x1="580" y1="155" x2="580" y2="190" stroke={C.slateLine} strokeWidth="1.5" />
        <circle cx="580" cy="190" r="3" fill={C.slateLine} />

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION: Process Layer */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        {/* Process Label */}
        <g transform="translate(20, 215)">
          <rect width="70" height="28" rx="14" fill={C.green} />
          <text x="35" y="19" textAnchor="middle" fill={C.bg} fontSize="11" fontWeight="600">Process</text>
        </g>

        {/* FHIR Validation Box - Large centered */}
        <g transform="translate(110, 195)" onClick={() => click('fhir')}>
          <rect
            width="450"
            height="60"
            rx="4"
            fill="transparent"
            stroke={C.green}
            strokeWidth="1.5"
          />
          <text x="225" y="25" textAnchor="middle" fill={C.text} fontSize="13" fontWeight="500">
            HL7 FHIR
          </text>
          <text x="225" y="45" textAnchor="middle" fill={C.textMuted} fontSize="11">
            Data Validation / Conformance / Transformation
          </text>
        </g>

        {/* MongoDB Atlas Box - Right side with logo */}
        <g transform="translate(620, 185)" onClick={() => click('atlas')}>
          <rect
            width="160"
            height="80"
            rx="4"
            fill="transparent"
            stroke={C.slate}
            strokeWidth="1"
          />
          {/* MongoDB Leaf */}
          <g transform="translate(55, 12)">
            <path
              d="M25 2c-1.5 3-3 5.5-3 9 0 6 4.5 11 4.5 11s.5-1.5.5-3c0-2-1-4-1-6s1-5 1-8c0-1-.5-2-2-3z"
              fill={C.green}
            />
            <path
              d="M25 2c1.5 3 3 5.5 3 9 0 6-4.5 11-4.5 11s-.5-1.5-.5-3c0-2 1-4 1-6s-1-5-1-8c0-1 .5-2 2-3z"
              fill={C.greenDark}
            />
          </g>
          <text x="80" y="55" textAnchor="middle" fill={C.text} fontSize="13" fontWeight="600">MongoDB</text>
          <text x="80" y="70" textAnchor="middle" fill={C.green} fontSize="11">Atlas</text>
        </g>

        {/* Dotted connector to MongoDB */}
        <line x1="560" y1="225" x2="620" y2="225" stroke={C.textDark} strokeWidth="1.5" strokeDasharray="4,4" />
        <circle cx="560" cy="225" r="3" fill={C.textDark} />
        <circle cx="620" cy="225" r="3" fill={C.textDark} />

        {/* Connector down from FHIR */}
        <line x1="335" y1="255" x2="335" y2="290" stroke={C.slateLine} strokeWidth="1.5" />
        <circle cx="335" cy="290" r="3" fill={C.slateLine} />

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION: Store Layer - MongoDB Services */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        {/* Store Label */}
        <g transform="translate(20, 330)">
          <rect width="70" height="28" rx="14" fill={C.green} />
          <text x="35" y="19" textAnchor="middle" fill={C.bg} fontSize="11" fontWeight="600">Store</text>
        </g>

        {/* MongoDB Services Container */}
        <g transform="translate(110, 295)">
          {/* Outer container */}
          <rect
            width="670"
            height="130"
            rx="6"
            fill="transparent"
            stroke={C.slate}
            strokeWidth="1"
          />

          {/* MongoDB Atlas header bar */}
          <rect width="670" height="30" rx="6" fill={C.greenFaded} />
          <rect width="670" height="15" y="15" fill={C.greenFaded} />
          <text x="335" y="20" textAnchor="middle" fill={C.green} fontSize="12" fontWeight="600">
            MongoDB Atlas
          </text>

          {/* Service boxes inside */}
          {[
            { x: 20, icon: 'doc', label: 'Document', sublabel: 'Model' },
            { x: 135, icon: 'search', label: 'Atlas', sublabel: 'Search' },
            { x: 250, icon: 'vector', label: 'Vector', sublabel: 'Search' },
            { x: 365, icon: 'stream', label: 'Change', sublabel: 'Streams' },
            { x: 480, icon: 'charts', label: 'Atlas', sublabel: 'Charts' },
            { x: 595, icon: 'trigger', label: 'App', sublabel: 'Services' },
          ].map((svc, i) => (
            <g key={i} transform={`translate(${svc.x}, 45)`} onClick={() => click(svc.label)}>
              <rect
                width="95"
                height="70"
                rx="4"
                fill={C.bg}
                stroke={C.slateLine}
                strokeWidth="1"
              />
              {/* Icons */}
              <g transform="translate(35, 8)">
                {svc.icon === 'doc' && (
                  <g stroke={C.text} strokeWidth="1.5" fill="none">
                    <path d="M6 2h8l4 4v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4a2 2 0 012-2z" />
                    <path d="M14 2v4h4" />
                  </g>
                )}
                {svc.icon === 'search' && (
                  <g stroke={C.text} strokeWidth="1.5" fill="none">
                    <circle cx="10" cy="10" r="7" />
                    <line x1="15" y1="15" x2="20" y2="20" />
                  </g>
                )}
                {svc.icon === 'vector' && (
                  <g stroke={C.text} strokeWidth="1.5" fill="none">
                    <circle cx="6" cy="6" r="3" />
                    <circle cx="18" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="18" r="3" />
                    <line x1="9" y1="6" x2="15" y2="6" />
                    <line x1="6" y1="9" x2="6" y2="15" />
                    <line x1="18" y1="9" x2="18" y2="15" />
                    <line x1="9" y1="18" x2="15" y2="18" />
                  </g>
                )}
                {svc.icon === 'stream' && (
                  <g stroke={C.text} strokeWidth="1.5" fill="none">
                    <path d="M4 12h16M4 12l4-4M4 12l4 4M20 12l-4-4M20 12l-4 4" />
                  </g>
                )}
                {svc.icon === 'charts' && (
                  <g stroke={C.text} strokeWidth="1.5" fill="none">
                    <rect x="3" y="10" width="4" height="10" />
                    <rect x="10" y="5" width="4" height="15" />
                    <rect x="17" y="8" width="4" height="12" />
                  </g>
                )}
                {svc.icon === 'trigger' && (
                  <g stroke={C.text} strokeWidth="1.5" fill="none">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </g>
                )}
              </g>
              <text x="47.5" y="50" textAnchor="middle" fill={C.text} fontSize="10">{svc.label}</text>
              <text x="47.5" y="62" textAnchor="middle" fill={C.textMuted} fontSize="9">{svc.sublabel}</text>
            </g>
          ))}
        </g>

        {/* Connector down from Store */}
        <line x1="445" y1="425" x2="445" y2="455" stroke={C.slateLine} strokeWidth="1.5" />
        <circle cx="445" cy="455" r="3" fill={C.slateLine} />

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION: Serve Layer */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        {/* Serve Label */}
        <g transform="translate(20, 475)">
          <rect width="70" height="28" rx="14" fill={C.green} />
          <text x="35" y="19" textAnchor="middle" fill={C.bg} fontSize="11" fontWeight="600">Serve</text>
        </g>

        {/* API Box */}
        <g transform="translate(110, 460)" onClick={() => click('api')}>
          <rect
            width="670"
            height="45"
            rx="4"
            fill="transparent"
            stroke={C.green}
            strokeWidth="1.5"
          />
          <text x="335" y="28" textAnchor="middle" fill={C.text} fontSize="12">RESTful APIs / GraphQL / FHIR R4 Endpoints</text>
        </g>

        {/* Connectors down to applications */}
        {[180, 310, 445, 580, 710].map((x, i) => (
          <g key={i}>
            <line x1={x} y1="505" x2={x} y2="530" stroke={C.slateLine} strokeWidth="1.5" />
            <circle cx={x} cy="530" r="3" fill={C.slateLine} />
          </g>
        ))}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION: Applications */}
        {/* ═══════════════════════════════════════════════════════════════════ */}

        {/* Apps Label */}
        <g transform="translate(20, 555)">
          <rect width="70" height="28" rx="14" fill={C.green} />
          <text x="35" y="19" textAnchor="middle" fill={C.bg} fontSize="11" fontWeight="600">Apps</text>
        </g>

        {/* Application boxes */}
        {[
          { x: 110, label: 'Patient Portal' },
          { x: 240, label: 'Clinical Dashboard' },
          { x: 380, label: 'Analytics' },
          { x: 510, label: 'AI/ML Models' },
          { x: 640, label: 'Research' },
        ].map((app, i) => (
          <g key={i} transform={`translate(${app.x}, 540)`}>
            <text x="65" y="30" textAnchor="middle" fill={C.textMuted} fontSize="11">{app.label}</text>
          </g>
        ))}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* RIGHT SIDE: MongoDB Leaf Watermark */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        <g transform="translate(870, 280)" opacity="0.15">
          <path
            d="M50 0c-6 12-12 22-12 36 0 24 18 44 18 44s2-6 2-12c0-8-4-16-4-24s4-20 4-32c0-4-2-8-8-12z"
            fill={C.green}
          />
          <path
            d="M50 0c6 12 12 22 12 36 0 24-18 44-18 44s-2-6-2-12c0-8 4-16 4-24s-4-20-4-32c0-4 2-8 8-12z"
            fill={C.greenDark}
          />
        </g>

      </svg>

      {/* Stats footer */}
      <div className="flex items-center gap-6 mt-6 text-xs text-slate-500">
        <span>6 data sources</span>
        <span>5 processing stages</span>
        <span>6 MongoDB services</span>
        <span>5 applications</span>
      </div>
    </div>
  );
};

export default BlueprintShowcase;
