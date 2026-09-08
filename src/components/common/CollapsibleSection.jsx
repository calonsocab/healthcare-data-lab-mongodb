//src/components/CollapsibleSection.jsx
"use client";

import React from 'react';
import PropTypes from 'prop-types';
import { ChevronDown, ChevronRight, Info } from 'lucide-react';

/**
 * A collapsible section component with toggle functionality
 * Uses a controlled approach for expansion state
 */
const CollapsibleSection = ({
  title,
  children,
  helpText,
  headerContent,
  isExpanded = false,
  onToggle,
  className = ""
}) => {
  return (
    <div className={`rounded-lg overflow-hidden border border-theme bg-surface ${className}`}>
      {/* Header with toggle button */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer bg-surface-hover hover:bg-surface-alt transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Expansion indicator */}
            <div className="text-theme-secondary">
              {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </div>

            {/* Section title */}
            <h3 className="font-medium text-theme-primary">{title}</h3>

            {/* Help text tooltip */}
            {helpText && (
              <div className="group relative">
                <Info size={14} className="text-theme-secondary" />
                <div className="absolute left-0 bottom-6 w-64 bg-surface border border-theme p-2 text-xs text-theme-secondary rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                  {helpText}
                </div>
              </div>
            )}
          </div>

          {headerContent && (
            <div className="mt-2 ml-6 min-w-0">
              {headerContent}
            </div>
          )}
        </div>
      </div>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="p-4 bg-surface-alt">
          {children}
        </div>
      )}
    </div>
  );
};

CollapsibleSection.propTypes = {
  title: PropTypes.node.isRequired,
  children: PropTypes.node,
  helpText: PropTypes.string,
  headerContent: PropTypes.node,
  isExpanded: PropTypes.bool,
  onToggle: PropTypes.func.isRequired,
  className: PropTypes.string
};

export default CollapsibleSection;
