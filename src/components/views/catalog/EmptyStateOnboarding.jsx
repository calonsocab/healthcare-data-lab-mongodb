// src/components/views/catalog/EmptyStateOnboarding.jsx
"use client";

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Upload,
  ExternalLink,
  Boxes,
  BookOpen,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { DomainIcon, DOMAIN_CONFIG } from './DomainTabs';
import { cn } from '@/lib/utils';

/**
 * DomainCard - Card for introducing a domain
 */
const DomainCard = ({
  domain,
  title,
  description,
  sampleCount,
  onLoadSamples,
  externalLink,
  externalLinkText,
  internalAction,
  internalActionText,
  loading = false,
}) => {
  const config = DOMAIN_CONFIG[domain] || {};

  return (
    <div
      className="flex flex-col border border-theme rounded-lg p-5 bg-surface hover:border-primary/30 transition-all duration-200"
      style={{ borderTopColor: config.color, borderTopWidth: '3px' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center"
          style={{
            backgroundColor: `${config.color}20`,
          }}
        >
          <DomainIcon domain={domain} size={28} />
        </div>
        <h3 className="text-lg font-bold text-theme-primary">{title}</h3>
      </div>

      {/* Description */}
      <p className="text-sm text-theme-secondary mb-4 flex-1">{description}</p>

      {/* Actions */}
      <div className="space-y-2">
        {/* Load samples button */}
        {onLoadSamples && (
          <button
            onClick={onLoadSamples}
            disabled={loading || sampleCount === 0}
            className="w-full px-4 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: sampleCount > 0 ? config.color : 'var(--color-surface-hover)',
              color: sampleCount > 0 ? 'white' : 'var(--color-text-secondary)',
            }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Loading...
              </>
            ) : sampleCount > 0 ? (
              <>
                <Sparkles size={16} />
                Load {sampleCount} Samples
              </>
            ) : (
              <>
                <Sparkles size={16} />
                No Samples Available
              </>
            )}
          </button>
        )}

        {/* Internal action (e.g., Open Builder) */}
        {internalAction && (
          <button
            onClick={internalAction}
            className="w-full px-4 py-2 rounded-lg border border-theme flex items-center justify-center gap-2 text-theme-primary hover:bg-surface-hover transition-colors"
          >
            <Boxes size={16} />
            {internalActionText || 'Open Builder'}
          </button>
        )}

        {/* External link */}
        {externalLink && (
          <a
            href={externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full px-4 py-2 rounded-lg border border-theme flex items-center justify-center gap-2 text-theme-secondary hover:text-theme-primary hover:bg-surface-hover transition-colors"
          >
            <ExternalLink size={14} />
            {externalLinkText || 'Learn more'}
          </a>
        )}
      </div>
    </div>
  );
};

/**
 * EmptyStateOnboarding - Shown when the catalog is empty
 */
const EmptyStateOnboarding = ({
  onLoadOpenEHRSamples,
  onLoadFHIRSamples,
  onLoadContextSamples,
  onOpenBuilder,
  onUpload,
  loadingDomain = null,
}) => {
  const [sampleCounts, setSampleCounts] = useState({
    openehr: 0,
    fhir: 0,
    context: 0,
  });

  // Fetch actual sample counts on mount
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const res = await fetch('/api/sample-data-models?limit=1');
        if (res.ok) {
          const data = await res.json();
          setSampleCounts({
            openehr: data.counts?.byDomain?.openehr || 0,
            fhir: data.counts?.byDomain?.fhir || 0,
            context: data.counts?.byDomain?.context || 0,
          });
        }
      } catch (e) {
        console.warn('Failed to fetch sample counts:', e);
      }
    };
    fetchCounts();
  }, []);

  return (
    <div className="space-y-8 py-8">
      {/* Welcome message */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/20 flex items-center justify-center">
          <BookOpen size={32} className="text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-theme-primary mb-2">
          Welcome to the Data Catalog
        </h2>
        <p className="text-theme-secondary">
          This is where you manage your data models across different healthcare standards.
          Get started by exploring sample data or uploading your own.
        </p>
      </div>

      {/* Domain cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <DomainCard
          domain="openehr"
          title="openEHR®"
          description="Clinical templates for structured data capture. Build data models with archetypes and compositions."
          sampleCount={sampleCounts.openehr}
          onLoadSamples={onLoadOpenEHRSamples}
          externalLink="https://tools.openehr.org/designer/"
          externalLinkText="openEHR® Designer"
          loading={loadingDomain === 'openehr'}
        />

        <DomainCard
          domain="fhir"
          title="FHIR®"
          description="HL7 FHIR R4 resources for interoperable healthcare data. Patient, Observation, Condition, and more."
          sampleCount={sampleCounts.fhir}
          onLoadSamples={onLoadFHIRSamples}
          externalLink="https://www.hl7.org/fhir/"
          externalLinkText="FHIR® Documentation"
          loading={loadingDomain === 'fhir'}
        />

        <DomainCard
          domain="context"
          title="ContextObjects"
          description="Build your own semantic definitions with the ContextObject Builder. Create reusable building blocks."
          sampleCount={sampleCounts.context}
          onLoadSamples={onLoadContextSamples}
          internalAction={onOpenBuilder}
          internalActionText="Open Builder"
          loading={loadingDomain === 'context'}
        />
      </div>

      {/* Upload section */}
      <div className="max-w-2xl mx-auto">
        <div className="text-center text-theme-secondary text-sm mb-4">
          <span className="inline-block border-b border-theme px-4 pb-1">
            OR
          </span>
        </div>

        <button
          onClick={onUpload}
          className="w-full p-8 border-2 border-dashed border-theme rounded-lg hover:border-primary/50 hover:bg-surface-hover transition-all duration-200 group"
        >
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Upload size={24} className="text-primary" />
            </div>
            <div>
              <p className="text-theme-primary font-medium">
                Drop files here or click to upload
              </p>
              <p className="text-sm text-theme-secondary mt-1">
                Supports: .json, .xml, .opt
              </p>
              <p className="text-xs text-theme-secondary mt-1">
                Auto-detects: openEHR®, FHIR®, ContextObjects
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Help links */}
      <div className="text-center">
        <p className="text-theme-secondary text-sm mb-2">
          Don't know where to start?
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <a
            href="https://tools.openehr.org/designer/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            What is openEHR®?
            <ArrowRight size={14} />
          </a>
          <a
            href="https://www.hl7.org/fhir/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            What is FHIR®?
            <ArrowRight size={14} />
          </a>
          <button
            onClick={onOpenBuilder}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            ContextObjects Guide
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

EmptyStateOnboarding.propTypes = {
  onLoadOpenEHRSamples: PropTypes.func,
  onLoadFHIRSamples: PropTypes.func,
  onLoadContextSamples: PropTypes.func,
  onOpenBuilder: PropTypes.func,
  onUpload: PropTypes.func,
  loadingDomain: PropTypes.string,
};

DomainCard.propTypes = {
  domain: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  sampleCount: PropTypes.number,
  onLoadSamples: PropTypes.func,
  externalLink: PropTypes.string,
  externalLinkText: PropTypes.string,
  internalAction: PropTypes.func,
  internalActionText: PropTypes.string,
  loading: PropTypes.bool,
};

export { EmptyStateOnboarding, DomainCard };
export default EmptyStateOnboarding;
