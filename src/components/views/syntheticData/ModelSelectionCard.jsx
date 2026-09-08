"use client";

import React from 'react';
import { Check, UserRound, Share2, Dna, Boxes } from 'lucide-react';
import { cn } from '@/lib/utils';

// Domain configuration matching DataModelCard style
const DOMAIN_CONFIG = {
  openehr: {
    icon: UserRound,
    color: '#00a99d',
    name: 'openEHR'
  },
  fhir: {
    icon: Share2,
    color: '#e44e37',
    name: 'FHIR'
  },
  genomics: {
    icon: Dna,
    color: '#6c5ce7',
    name: 'Genomics'
  },
  contextobject: {
    icon: Boxes,
    color: '#00ED64',
    name: 'ContextObjects'
  },
  default: {
    icon: UserRound,
    color: '#a855f7',
    name: 'Custom'
  },
};

const getDomainConfig = (domain) => {
  const key = (domain || '').toLowerCase();
  return DOMAIN_CONFIG[key] || DOMAIN_CONFIG.default;
};

/**
 * ModelSelectionCard - Clean card for data model selection matching DataModelCard style
 */
const ModelSelectionCard = ({
  model,
  selected = false,
  onToggle,
  domain = 'openehr',
}) => {
  const domainConfig = getDomainConfig(domain);
  const DomainIcon = domainConfig.icon;

  // Extract metadata from model
  const modelName = model.name || model.template_id || model.model_id;
  const templateId = model.template_id || model.model_id;
  const modelType = model.type || 'composition';
  const version = model.version || '1.0';
  const description = model.description || model.summary || '';
  const rmType = model.rm_type || model.rmType || 'COMPOSITION';

  return (
    <div
      onClick={() => onToggle?.(model.model_id)}
      className={cn(
        "relative rounded-lg border p-3 cursor-pointer transition-all min-w-0 overflow-hidden",
        selected
          ? "border-primary bg-primary/5 hover:border-primary/80"
          : "border-theme hover:border-primary/30"
      )}
    >
      {/* Selection indicator */}
      <div className={cn(
        "absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
        selected
          ? "border-primary bg-primary"
          : "border-theme/40"
      )}>
        {selected && <Check className="w-3 h-3 text-primary-text" />}
      </div>

      {/* Domain badge */}
      <div className="mb-2">
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border"
          style={{
            backgroundColor: `${domainConfig.color}15`,
            color: domainConfig.color,
            borderColor: `${domainConfig.color}30`
          }}
        >
          <DomainIcon size={10} />
          {domainConfig.name}
        </span>
      </div>

      {/* Name */}
      <h3
        className="font-semibold text-theme-primary text-sm leading-tight pr-6 mb-1 break-all line-clamp-2"
        title={modelName}
      >
        {modelName}
      </h3>

      {/* Template ID - subtle */}
      <p
        className="text-[10px] text-theme-secondary font-mono truncate mb-2 break-all"
        title={templateId}
      >
        {templateId}
      </p>

      {/* Description - only if exists, very compact */}
      {description && (
        <p className="text-xs text-theme-secondary line-clamp-2 mb-2">
          {description}
        </p>
      )}

      {/* Metadata badges */}
      <div className="flex items-center flex-wrap gap-1.5">
        <span className="px-1.5 py-0.5 text-[10px] rounded bg-surface border border-theme text-theme-secondary">
          {rmType}
        </span>
        <span className="px-1.5 py-0.5 text-[10px] rounded bg-surface border border-theme text-theme-secondary">
          {modelType}
        </span>
        <span className="px-1.5 py-0.5 text-[10px] rounded bg-surface border border-theme text-theme-secondary">
          v{version}
        </span>
      </div>
    </div>
  );
};

export default ModelSelectionCard;
