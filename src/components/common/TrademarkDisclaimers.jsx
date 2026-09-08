// src/components/common/TrademarkDisclaimers.jsx
"use client";

import React from 'react';
import PropTypes from 'prop-types';
import { cn } from '@/lib/utils';

/**
 * Trademark disclaimer text constants
 */
export const TRADEMARK_DISCLAIMERS = {
  fhir: 'HL7 and FHIR are the registered trademarks of Health Level Seven International and their use does not constitute endorsement by HL7.',
  openehr: 'openEHR is the registered trademark of the openEHR Foundation and use of the mark does not constitute endorsement by openEHR International or openEHR Foundation.',
};

/**
 * CC BY 4.0 License notice for strategies
 */
export const CC_BY_LICENSE = {
  short: 'This material is licensed under CC BY 4.0.',
  full: 'This material is licensed under the Creative Commons Attribution 4.0 License. To view a copy of this license, visit https://creativecommons.org/licenses/by/4.0/.',
  url: 'https://creativecommons.org/licenses/by/4.0/',
  strategyNotice: 'This material is licensed under the Creative Commons Attribution 4.0 License.',
};

/**
 * TrademarkDisclaimers - Displays trademark notices for FHIR and openEHR
 *
 * @param {string} variant - 'inline' | 'block' | 'compact'
 * @param {boolean} showFhir - Show FHIR disclaimer
 * @param {boolean} showOpenehr - Show openEHR disclaimer
 */
const TrademarkDisclaimers = ({
  variant = 'block',
  showFhir = true,
  showOpenehr = true,
  className = '',
}) => {
  if (!showFhir && !showOpenehr) return null;

  if (variant === 'compact') {
    return (
      <p className={cn('text-[10px] text-theme-secondary/70 leading-relaxed', className)}>
        {showFhir && showOpenehr ? (
          <>
            FHIR® is a registered trademark of HL7. openEHR® is a registered trademark
            of the openEHR Foundation. Use does not constitute endorsement.
          </>
        ) : showFhir ? (
          <>FHIR® is a registered trademark of HL7.</>
        ) : (
          <>openEHR® is a registered trademark of the openEHR Foundation.</>
        )}
      </p>
    );
  }

  if (variant === 'inline') {
    return (
      <span className={cn('text-xs text-theme-secondary', className)}>
        {showFhir && TRADEMARK_DISCLAIMERS.fhir}
        {showFhir && showOpenehr && ' '}
        {showOpenehr && TRADEMARK_DISCLAIMERS.openehr}
      </span>
    );
  }

  // Block variant (default)
  return (
    <div className={cn('space-y-1 text-xs text-theme-secondary/80', className)}>
      {showFhir && <p>{TRADEMARK_DISCLAIMERS.fhir}</p>}
      {showOpenehr && <p>{TRADEMARK_DISCLAIMERS.openehr}</p>}
    </div>
  );
};

TrademarkDisclaimers.propTypes = {
  variant: PropTypes.oneOf(['inline', 'block', 'compact']),
  showFhir: PropTypes.bool,
  showOpenehr: PropTypes.bool,
  className: PropTypes.string,
};

/**
 * LicenseNotice - Displays CC BY 4.0 license information for strategies
 *
 * Variants:
 * - 'badge': Small inline badge
 * - 'short': One-line notice with link
 * - 'full': Complete license text
 * - 'banner': Prominent banner for strategy pages
 */
export const LicenseNotice = ({ variant = 'short', className = '' }) => {
  if (variant === 'badge') {
    return (
      <a
        href={CC_BY_LICENSE.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium',
          'bg-amber-500/10 text-amber-600 border border-amber-500/20 hover:bg-amber-500/20 transition-colors',
          className
        )}
      >
        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
        </svg>
        CC BY 4.0
      </a>
    );
  }

  if (variant === 'banner') {
    return (
      <div className={cn(
        'flex items-start gap-3 p-4 rounded-lg border',
        'bg-amber-500/5 border-amber-500/20',
        className
      )}>
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-amber-500" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-slate-300 leading-relaxed">
            {CC_BY_LICENSE.strategyNotice} To view a copy of this license, visit{' '}
            <a
              href={CC_BY_LICENSE.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 underline underline-offset-2"
            >
              {CC_BY_LICENSE.url}
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className={cn('text-xs text-theme-secondary', className)}>
        <p>
          {CC_BY_LICENSE.full.split('https://')[0]}
          <a
            href={CC_BY_LICENSE.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {CC_BY_LICENSE.url}
          </a>
          .
        </p>
      </div>
    );
  }

  // Short variant (default)
  return (
    <p className={cn('text-xs text-theme-secondary', className)}>
      {CC_BY_LICENSE.short}{' '}
      <a
        href={CC_BY_LICENSE.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline"
      >
        View license
      </a>
    </p>
  );
};

LicenseNotice.propTypes = {
  variant: PropTypes.oneOf(['short', 'full', 'badge', 'banner']),
  className: PropTypes.string,
};

export default TrademarkDisclaimers;
