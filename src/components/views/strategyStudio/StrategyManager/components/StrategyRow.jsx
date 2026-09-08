// src/components/views/strategyStudio/StrategyManager/components/StrategyRow.jsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Check, ArrowRight, Sparkles, FlaskConical, X, Settings, UserRound, Share2, Dna, ScanLine, Receipt, Boxes, Puzzle } from 'lucide-react';
import { getStrategyTheme, getDomainDisplayName } from '../constants/domainThemes';
import { useTheme } from '@/components/views/layout/ThemeContext';

// Icon mapping for domain themes
const DOMAIN_ICONS = {
  UserRound,   // openEHR - patient/EHR persistence
  Share2,      // FHIR - interoperability
  Dna,         // Genomics
  ScanLine,    // DICOM - imaging
  Receipt,     // X12 - claims
  Boxes,       // ContextObjects
  Puzzle       // Custom
};

/**
 * Status indicator with popover for preview/example strategies
 * Shows the actual maturity status of the strategy
 */
const StatusIndicator = ({ status, maturity, message, theme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  // Use maturity field (preferred) or fall back to status
  const effectiveStatus = maturity || status || 'preview';

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Status configurations with colors and default messages
  const statusConfig = {
    published: {
      label: 'Published',
      color: '#10b981', // emerald
      bgColor: 'rgba(16, 185, 129, 0.1)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
      defaultMessage: "This strategy is published and ready for production use. It has been tested and validated."
    },
    development: {
      label: 'Development',
      color: '#3b82f6', // blue
      bgColor: 'rgba(59, 130, 246, 0.1)',
      borderColor: 'rgba(59, 130, 246, 0.3)',
      defaultMessage: "This strategy is under active development. Features may change. Use for testing and feedback."
    },
    preview: {
      label: 'Preview',
      color: '#f59e0b', // amber
      bgColor: 'rgba(245, 158, 11, 0.1)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
      defaultMessage: "This strategy is in preview. It showcases future capabilities. Want to contribute? Join our community!"
    },
  };

  const config = statusConfig[effectiveStatus] || statusConfig.preview;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded border transition-all hover:scale-105"
        style={{
          backgroundColor: config.bgColor,
          color: config.color,
          borderColor: config.borderColor,
        }}
        title="Click for details"
      >
        <FlaskConical className="w-3 h-3" />
        {config.label}
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          className="absolute z-50 top-full left-0 mt-2 w-80 p-4 rounded-xl bg-slate-800 border border-slate-600 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4" style={{ color: config.color }} />
              <span className="text-sm font-medium text-slate-200">{config.label}</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {message || config.defaultMessage}
          </p>
          <div className="mt-3 pt-3 border-t border-slate-700">
            <span className="text-xs text-slate-500">
              Help us build the future of healthcare data interoperability.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Strategy card row - Clinical-friendly, inviting design for browsing
 *
 * Strategies are READ-ONLY system templates. Users can:
 * - Click the row to view details (onSelect)
 * - Click "Activate" to activate for their environment (onActivate)
 */
const StrategyRow = ({ strategy, isActive, onSelect, onActivate }) => {
  const theme = getStrategyTheme(strategy);
  const { theme: appTheme } = useTheme();
  // Domain-first: use strategy.domain directly (from Kehrnel catalog)
  const domain = strategy.domain || 'Custom';
  const isLightMode = appTheme?.name === 'Light Mode';

  // Extract a "highlight" from the story or benefits for quick preview
  const story = strategy.story || strategy.ui?.story || '';
  const benefits = strategy.ui?.benefits || strategy.benefits || [];
  const capabilities = strategy.capabilities || [];
  const highlight = benefits[0] || (story ? story.split('.')[0] + '.' : '');
  const cardGradient = isLightMode
    ? 'var(--color-surface)'
    : `linear-gradient(135deg, ${theme.primary}08 0%, transparent 60%)`;

  return (
    <button
      onClick={() => onSelect(strategy)}
      className="group w-full text-left"
    >
      <div
        className="relative overflow-hidden rounded-xl border transition-all duration-200 hover:shadow-lg"
        style={{
          background: cardGradient,
          borderColor: isActive ? `${theme.primary}60` : 'rgba(51, 65, 85, 0.5)',
        }}
      >
        {/* Active indicator stripe */}
        {isActive && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1"
            style={{ backgroundColor: theme.primary }}
          />
        )}

        <div className={`p-5 transition-colors ${isLightMode ? '' : 'group-hover:bg-slate-800/30'}`}>
          <div className="flex items-start gap-4">
            {/* Icon Box */}
            <div className="flex-shrink-0">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${theme.primary}15 0%, ${theme.primary}08 100%)`,
                  border: `1.5px solid ${theme.primary}30`
                }}
              >
                {(() => {
                  if (theme.iconPath) {
                    return <img src={theme.iconPath} alt={`${domain} icon`} className="w-7 h-7 object-contain" />;
                  }
                  const IconComponent = DOMAIN_ICONS[theme.icon] || UserRound;
                  return <IconComponent className="w-7 h-7" style={{ color: theme.primary }} />;
                })()}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Domain chip row */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="px-2.5 py-1 rounded-md text-xs font-medium"
                  style={{
                    backgroundColor: `${theme.primary}20`,
                    color: theme.primary,
                    border: `1px solid ${theme.primary}40`
                  }}
                >
                  {getDomainDisplayName(domain)}
                </span>
                {/* Status indicator showing actual maturity level */}
                <StatusIndicator
                  status={strategy.ui?.status}
                  maturity={strategy.maturity}
                  message={strategy.ui?.status_message}
                  theme={theme}
                />
                {strategy.version && (
                  <span className="text-xs text-slate-500">v{strategy.version}</span>
                )}
                {isActive && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <Check className="w-3 h-3" />
                    Active
                  </span>
                )}
              </div>

              {/* Title */}
              <h3 className="text-base font-semibold text-slate-100 group-hover:text-white transition-colors leading-tight mb-2">
                {strategy.name}
              </h3>

              {/* Description - primary */}
              <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
                {strategy.description}
              </p>

              {/* Quick highlight from benefits - clinical value proposition */}
              {highlight && (
                <div className="mt-3 flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-500 line-clamp-1 italic">
                    {highlight}
                  </p>
                </div>
              )}

              {/* Footer: Capabilities + Actions */}
              <div className="flex items-center justify-between gap-4 mt-3 pt-3 border-t border-slate-700/30">
                <div className="flex items-center gap-2 flex-wrap">
                  {capabilities.slice(0, 3).map(cap => (
                    <span
                      key={cap}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded bg-slate-700/40 text-slate-400"
                    >
                      <Check className="w-2.5 h-2.5 text-emerald-500" />
                      {cap}
                    </span>
                  ))}
                  {capabilities.length > 3 && (
                    <span className="px-2 py-0.5 text-xs text-slate-500">
                      +{capabilities.length - 3}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Activate button - only shown for published strategies */}
                  {onActivate && !isActive && strategy.maturity === 'published' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onActivate(strategy);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-primary-text transition-colors shadow-sm"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      Review Setup
                    </button>
                  )}

                  {/* Learn more indicator */}
                  <span className="flex items-center gap-1 text-xs text-slate-500 group-hover:text-slate-300 transition-colors">
                    Learn more
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
};

export default StrategyRow;
