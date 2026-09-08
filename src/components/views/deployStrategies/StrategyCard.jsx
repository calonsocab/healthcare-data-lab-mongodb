// src/components/views/deployStrategies/StrategyCard.jsx
"use client";

import React from 'react';
import {
  Database,
  Search,
  Zap,
  FileInput,
  GitBranch,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { LicenseNotice } from '@/components/common/TrademarkDisclaimers';

// Domain display names with trademark symbols
const domainDisplayNames = {
  openEHR: 'openEHR®',
  openehr: 'openEHR®',
  FHIR: 'FHIR®',
  fhir: 'FHIR®',
  genomics: 'Genomics',
  x12: 'X12',
};

// Domain color themes
const domainThemes = {
  openEHR: {
    bg: 'from-blue-600/20 to-blue-800/10',
    border: 'border-blue-500/40',
    badge: 'bg-blue-600/30 text-blue-300',
    icon: 'text-blue-400',
  },
  openehr: {
    bg: 'from-blue-600/20 to-blue-800/10',
    border: 'border-blue-500/40',
    badge: 'bg-blue-600/30 text-blue-300',
    icon: 'text-blue-400',
  },
  FHIR: {
    bg: 'from-orange-600/20 to-orange-800/10',
    border: 'border-orange-500/40',
    badge: 'bg-orange-600/30 text-orange-300',
    icon: 'text-orange-400',
  },
  fhir: {
    bg: 'from-orange-600/20 to-orange-800/10',
    border: 'border-orange-500/40',
    badge: 'bg-orange-600/30 text-orange-300',
    icon: 'text-orange-400',
  },
  genomics: {
    bg: 'from-green-600/20 to-green-800/10',
    border: 'border-green-500/40',
    badge: 'bg-green-600/30 text-green-300',
    icon: 'text-green-400',
  },
  default: {
    bg: 'from-purple-600/20 to-purple-800/10',
    border: 'border-purple-500/40',
    badge: 'bg-purple-600/30 text-purple-300',
    icon: 'text-purple-400',
  },
};

// Maturity badge styles
const maturityStyles = {
  stable: 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50',
  ga: 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50',
  beta: 'bg-blue-600/30 text-blue-300 border-blue-500/50',
  alpha: 'bg-amber-600/30 text-amber-300 border-amber-500/50',
  experimental: 'bg-red-600/30 text-red-300 border-red-500/50',
  default: 'bg-slate-600/30 text-slate-300 border-slate-500/50',
};

// Capability icons
const capabilityIcons = {
  ingest: { icon: FileInput, label: 'Ingest' },
  transform: { icon: Zap, label: 'Transform' },
  query: { icon: Database, label: 'Query' },
  search: { icon: Search, label: 'Search' },
  validate: { icon: CheckCircle2, label: 'Validate' },
};

/**
 * StrategyCard - Visual card for a single strategy
 */
const StrategyCard = ({ strategy, isActive, onClick }) => {
  const theme = domainThemes[strategy.domain] || domainThemes.default;
  const maturityStyle = maturityStyles[strategy.maturity] || maturityStyles.default;

  const capabilities = strategy.capabilities || [];
  const displayedCapabilities = capabilities.slice(0, 4);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-5 rounded-xl border-2 bg-gradient-to-br transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-900/20 ${theme.bg} ${theme.border} ${
        isActive ? 'ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-slate-900' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${theme.badge}`}>
            {domainDisplayNames[strategy.domain] || strategy.domain}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${maturityStyle}`}>
            {strategy.maturity || 'unknown'}
          </span>
          <LicenseNotice variant="badge" />
        </div>
        {isActive && (
          <div className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-600/20 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            Active
          </div>
        )}
      </div>

      {/* Name & Version */}
      <h3 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
        {strategy.name || strategy.id}
        <span className="text-xs font-normal text-slate-500">v{strategy.version}</span>
      </h3>

      {/* ID */}
      <code className="text-xs text-slate-500 font-mono mb-3 block">
        {strategy.id}
      </code>

      {/* Description */}
      <p className="text-sm text-slate-400 mb-4 line-clamp-2">
        {strategy.summary || strategy.description || 'No description available'}
      </p>

      {/* Capabilities */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {displayedCapabilities.map(cap => {
          const capInfo = capabilityIcons[cap];
          if (!capInfo) return null;
          const Icon = capInfo.icon;
          return (
            <div
              key={cap}
              className="flex items-center gap-1 text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded"
              title={capInfo.label}
            >
              <Icon className="w-3 h-3" />
              <span>{capInfo.label}</span>
            </div>
          );
        })}
        {capabilities.length > 4 && (
          <span className="text-xs text-slate-500">
            +{capabilities.length - 4} more
          </span>
        )}
      </div>

      {/* Tags */}
      {strategy.ui?.tags && strategy.ui.tags.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {strategy.ui.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="text-xs text-slate-500 bg-slate-800/30 px-1.5 py-0.5 rounded"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-700/50">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {strategy.adapters?.storage && (
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3" />
              {Array.isArray(strategy.adapters.storage)
                ? strategy.adapters.storage.join(', ')
                : strategy.adapters.storage}
            </span>
          )}
        </div>
        <span className="text-xs text-purple-400 flex items-center gap-1">
          View details
          <ExternalLink className="w-3 h-3" />
        </span>
      </div>
    </button>
  );
};

export default StrategyCard;
