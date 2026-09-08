// src/components/views/strategyStudio/StrategyManager/components/ActiveStrategyBanner.jsx
"use client";

import React from 'react';
import { Check, ChevronRight, Layers, Clock, ArrowUpCircle, RotateCcw, Trash2, RefreshCw, Server, Hash, FileKey, Link, UserRound, Share2, Dna, ScanLine, Receipt, Boxes, Puzzle } from 'lucide-react';
import { getStrategyTheme, getDomainDisplayName } from '../constants/domainThemes';

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
 * Prominent banner showing the currently active strategy
 * Domain-first model - uses strategy.domain directly, not blueprint
 */
const ActiveStrategyBanner = ({
  strategy,
  onViewDetails,
  onUpgrade,
  onRollback,
  onDeleteActivation,
  activating = false
}) => {
  if (!strategy) {
    return (
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 border-2 border-dashed border-slate-600 rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-slate-700/50 border-2 border-slate-600 flex items-center justify-center">
              <Layers className="w-7 h-7 text-slate-500" />
            </div>
            <div>
              <p className="text-sm text-slate-400 uppercase tracking-wider font-medium">Active Strategy</p>
              <p className="text-xl font-semibold text-slate-300">No strategy selected</p>
              <p className="text-sm text-slate-500 mt-1">Select a strategy from the catalog below to activate it</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const theme = getStrategyTheme(strategy);
  // Domain-first: use strategy.domain directly
  const domain = strategy.domain || 'Custom';

  // Get protocol-specific color
  const getProtocolStyles = () => {
    switch (domain?.toLowerCase()) {
      case 'openehr':
        return {
          gradient: 'from-teal-900/40 via-slate-900 to-slate-900',
          border: 'border-teal-500/50',
          badge: 'bg-teal-900/50 border-teal-500/50 text-teal-300',
          icon: 'text-teal-400'
        };
      case 'fhir':
        return {
          gradient: 'from-red-900/40 via-slate-900 to-slate-900',
          border: 'border-red-500/50',
          badge: 'bg-red-900/50 border-red-500/50 text-red-300',
          icon: 'text-red-400'
        };
      case 'genomics':
        return {
          gradient: 'from-purple-900/40 via-slate-900 to-slate-900',
          border: 'border-purple-500/50',
          badge: 'bg-purple-900/50 border-purple-500/50 text-purple-300',
          icon: 'text-purple-400'
        };
      default:
        return {
          gradient: 'from-blue-900/40 via-slate-900 to-slate-900',
          border: 'border-blue-500/50',
          badge: 'bg-blue-900/50 border-blue-500/50 text-blue-300',
          icon: 'text-blue-400'
        };
    }
  };

  const styles = getProtocolStyles();
  const kehrnelInfo = strategy.kehrnel;
  const endpointsCount = kehrnelInfo?.endpoints ? Object.keys(kehrnelInfo.endpoints).length : 0;

  return (
    <div className={`relative overflow-hidden bg-gradient-to-r ${styles.gradient} border-2 ${styles.border} rounded-xl`}>
      {/* Active indicator glow effect */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" />

      <div className="p-6">
        <div className="flex items-start justify-between gap-6">
          {/* Left: Icon + Info */}
          <div className="flex items-start gap-5 flex-1">
            {/* Icon Box */}
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center border-2 bg-slate-900/60 flex-shrink-0"
              style={{ borderColor: theme.primary }}
            >
              {(() => {
                if (theme.iconPath) {
                  return <img src={theme.iconPath} alt={`${domain} icon`} className="w-8 h-8 object-contain" />;
                }
                const IconComponent = DOMAIN_ICONS[theme.icon] || UserRound;
                return <IconComponent className="w-8 h-8" style={{ color: theme.primary }} />;
              })()}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {/* Top badges row */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className="px-2.5 py-1 rounded-md text-xs font-semibold"
                  style={{
                    backgroundColor: `${theme.primary}20`,
                    color: theme.primary,
                    border: `1px solid ${theme.primary}40`
                  }}
                >
                  {getDomainDisplayName(domain)}
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-900/40 border border-emerald-500/40 text-emerald-300">
                  <Check className="w-3.5 h-3.5" />
                  Active
                </span>
                {kehrnelInfo?.activatedAt && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 border border-slate-600 text-slate-300">
                    <Clock className="w-3 h-3" />
                    Since {new Date(kehrnelInfo.activatedAt).toLocaleDateString()}
                  </span>
                )}
                {strategy.version && (
                  <span className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 border border-slate-600 text-slate-300">
                    v{strategy.version}
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-bold text-white mb-2 truncate">{strategy.name}</h2>

              <p className="text-slate-300 text-sm leading-relaxed max-w-2xl line-clamp-2">
                {strategy.description}
              </p>

              {/* Kehrnel activation metadata chips */}
              {kehrnelInfo && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {/* Strategy ID */}
                  {kehrnelInfo.strategyId && (
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/80 border border-slate-600/50 text-slate-300 text-xs" title={`Strategy: ${kehrnelInfo.strategyId}`}>
                      <Server className="w-3 h-3 text-slate-400" />
                      {kehrnelInfo.strategyId}
                    </span>
                  )}
                  {/* Activation ID */}
                  {kehrnelInfo.activationId && (
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/80 border border-slate-600/50 text-slate-300 text-xs" title={`Activation: ${kehrnelInfo.activationId}`}>
                      <Hash className="w-3 h-3 text-slate-400" />
                      {kehrnelInfo.activationId.slice(0, 8)}…
                    </span>
                  )}
                  {/* Manifest Digest */}
                  {kehrnelInfo.manifestDigest && (
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/80 border border-slate-600/50 text-slate-300 text-xs" title={`Digest: ${kehrnelInfo.manifestDigest}`}>
                      <FileKey className="w-3 h-3 text-slate-400" />
                      {kehrnelInfo.manifestDigest.slice(0, 8)}…
                    </span>
                  )}
                  {/* Config Hash */}
                  {kehrnelInfo.configHash && (
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800/80 border border-slate-600/50 text-slate-300 text-xs" title={`Config: ${kehrnelInfo.configHash}`}>
                      <Hash className="w-3 h-3 text-slate-400" />
                      {kehrnelInfo.configHash.slice(0, 8)}…
                    </span>
                  )}
                  {/* Endpoints Count */}
                  {endpointsCount > 0 && (
                    <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-900/50 border border-emerald-600/50 text-emerald-300 text-xs">
                      <Link className="w-3 h-3" />
                      {endpointsCount} endpoints
                    </span>
                  )}
                </div>
              )}

              {/* Lifecycle action buttons */}
              {kehrnelInfo && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => onUpgrade?.(strategy)}
                    disabled={activating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-900/50 hover:bg-blue-900/70 border border-blue-600/50 text-blue-300 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {activating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ArrowUpCircle className="w-3 h-3" />}
                    Upgrade
                  </button>
                  <button
                    onClick={() => onRollback?.(strategy)}
                    disabled={activating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-900/50 hover:bg-amber-900/70 border border-amber-600/50 text-amber-300 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {activating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                    Rollback
                  </button>
                  <button
                    onClick={() => onDeleteActivation?.(strategy)}
                    disabled={activating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-900/50 hover:bg-red-900/70 border border-red-600/50 text-red-300 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {activating ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    Delete Activation
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: View Details Button */}
          <button
            onClick={() => onViewDetails?.(strategy)}
            className="flex-shrink-0 px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium text-sm flex items-center gap-2 transition-all hover:gap-3"
          >
            View Details
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActiveStrategyBanner;
