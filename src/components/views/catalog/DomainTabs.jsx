// src/components/views/catalog/DomainTabs.jsx
"use client";

import React from 'react';
import PropTypes from 'prop-types';
import { Boxes, FileJson, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Domain configuration with display info
 */
const DOMAIN_CONFIG = {
  all: {
    id: 'all',
    name: 'All',
    color: '#64748b',
    icon: null,
  },
  openehr: {
    id: 'openehr',
    name: 'openEHR®',
    shortName: 'openEHR®',
    fullName: 'openEHR® Based',
    color: '#00a99d',
    iconPath: '/images/openehr.png',
  },
  fhir: {
    id: 'fhir',
    name: 'FHIR®',
    shortName: 'FHIR®',
    fullName: 'FHIR® Based',
    color: '#e44e37',
    IconComponent: Share2,
  },
  context: {
    id: 'context',
    name: 'ContextObjects',
    color: '#00ED64',
    IconComponent: Boxes,
  },
  // Alias for contextobject (used by API)
  contextobject: {
    id: 'contextobject',
    name: 'ContextObjects',
    color: '#00ED64',
    IconComponent: Boxes,
  },
};

/**
 * DomainIcon - Renders the appropriate icon for a domain
 */
const DomainIcon = ({ domain, size = 16, className = '' }) => {
  const config = DOMAIN_CONFIG[domain];

  if (!config) {
    return <FileJson size={size} className={className} />;
  }

  if (config.iconPath) {
    return (
      <img
        src={config.iconPath}
        alt={`${config.name} icon`}
        className={cn('object-contain', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  if (config.IconComponent) {
    const Icon = config.IconComponent;
    return <Icon size={size} className={className} style={{ color: config.color }} />;
  }

  return null;
};

/**
 * DomainTab - Individual tab button
 */
const DomainTab = ({ domain, count, isActive, onClick, equalWidth = false }) => {
  const config = DOMAIN_CONFIG[domain] || DOMAIN_CONFIG.all;

  return (
    <button
      onClick={() => onClick(domain)}
      className={cn(
        'flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all duration-200',
        'border-2',
        equalWidth && 'flex-1 min-w-0',
        isActive
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-transparent hover:bg-surface-hover text-theme-secondary hover:text-theme-primary'
      )}
      style={{
        borderColor: isActive ? config.color : undefined,
        backgroundColor: isActive ? `${config.color}15` : undefined,
        color: isActive ? config.color : undefined,
      }}
    >
      {domain !== 'all' && (
        <DomainIcon
          domain={domain}
          size={18}
          className={isActive ? '' : 'opacity-70'}
        />
      )}
      <span className="font-medium">{config.name}</span>
      {count !== undefined && (
        <span
          className={cn(
            'px-2 py-0.5 text-xs rounded-full',
            isActive
              ? 'bg-white/20'
              : 'bg-surface text-theme-secondary'
          )}
          style={{
            backgroundColor: isActive ? `${config.color}30` : undefined,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
};

/**
 * DomainTabs - Tab bar for filtering by domain
 */
const DomainTabs = ({
  activeDomain = 'all',
  onDomainChange,
  counts = {},
  enabledDomains = ['openehr', 'fhir', 'context'],
  showAll = true,
  equalWidth = false,
  className = '',
}) => {
  const totalCount = Object.values(counts).reduce((sum, c) => sum + c, 0);

  const domains = showAll ? ['all', ...enabledDomains] : enabledDomains;

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {domains.map((domain) => (
        <DomainTab
          key={domain}
          domain={domain}
          count={domain === 'all' ? totalCount : counts[domain]}
          isActive={activeDomain === domain}
          onClick={onDomainChange}
          equalWidth={equalWidth}
        />
      ))}
    </div>
  );
};

DomainTabs.propTypes = {
  activeDomain: PropTypes.string,
  onDomainChange: PropTypes.func.isRequired,
  counts: PropTypes.object,
  enabledDomains: PropTypes.arrayOf(PropTypes.string),
  showAll: PropTypes.bool,
  equalWidth: PropTypes.bool,
  className: PropTypes.string,
};

DomainIcon.propTypes = {
  domain: PropTypes.string.isRequired,
  size: PropTypes.number,
  className: PropTypes.string,
};

DomainTab.propTypes = {
  domain: PropTypes.string.isRequired,
  count: PropTypes.number,
  isActive: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
  equalWidth: PropTypes.bool,
};

export { DomainTabs, DomainIcon, DomainTab, DOMAIN_CONFIG };
export default DomainTabs;
