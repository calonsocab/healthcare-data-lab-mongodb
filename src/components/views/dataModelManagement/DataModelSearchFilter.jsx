// src/components/views/dataModelManagement/DataModelSearchFilter.jsx
"use client";

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Search,
  Tag,
  X,
  Filter,
  FileText,
  Database,
  Activity,
  ClipboardList,
  AlertCircle,
  PlayCircle,
  ShieldAlert,
  FileSpreadsheet,
  Heart,
  Boxes
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Domain configuration for tabs (text-only, no icons for branding consistency)
const DOMAINS = [
  { id: 'openehr', label: 'openEHR®' },
  { id: 'fhir', label: 'FHIR®' },
  { id: 'context', label: 'ContextObjects' },
];

// List of entry-level archetype node id patterns
const ENTRY_LEVEL_PATTERNS = [
  'openEHR-EHR-EVALUATION',
  'openEHR-EHR-OBSERVATION',
  'openEHR-EHR-INSTRUCTION',
  'openEHR-EHR-ACTION',
  'openEHR-EHR-ADMIN_ENTRY',
  'EVALUATION',
  'OBSERVATION',
  'INSTRUCTION',
  'ACTION',
  'ADMIN_ENTRY'
];

// Function to check if an archetype is an entry
const isEntryLevelArchetype = (nodeId) => {
  return ENTRY_LEVEL_PATTERNS.some(pattern => nodeId.includes(pattern));
};

// Icon mapping for entry types
const getEntryTypeIcon = (nodeId) => {
  if (nodeId.includes('EVALUATION')) return <ClipboardList size={10} className="text-primary" />;
  if (nodeId.includes('ADMIN')) return <ShieldAlert size={10} className="text-error" />;
  if (nodeId.includes('INSTRUCTION')) return <AlertCircle size={10} className="text-warning" />;
  if (nodeId.includes('ACTION')) return <PlayCircle size={10} className="text-success" />;
  if (nodeId.includes('OBSERVATION')) return <Activity size={10} className="text-primary" />;
  return <FileText size={10} className="text-theme-secondary" />;
};

const DataModelSearchFilter = ({
  onSearch,
  archetypeOptions = [],
  compositionOptions = [],
  availableLanguages = [],
  availableTerminologies = [],
  selectedArchetypes = [],
  selectedCompositions = [],
  selectedLanguages = [],
  selectedTerminologies = [],
  onArchetypeSelect,
  onCompositionSelect,
  onLanguageSelect,
  onTerminologySelect,
  onGroupingChange,
  onSortChange,
  currentGrouping = 'none',
  currentSort = 'name-asc',
  onResetFilters,
  hasAqlFilter = false,
  onHasAqlFilterChange,
  hasOptFilter = false,
  onHasOptFilterChange,
  // Domain filtering props
  activeDomain = 'openehr',
  onDomainChange,
  domainCounts = {},
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchetypeFilter, setShowArchetypeFilter] = useState(false);
  const [showCompositionFilter, setShowCompositionFilter] = useState(false);
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [showGroupOptions, setShowGroupOptions] = useState(false);
  const [archetypeFilterTerm, setArchetypeFilterTerm] = useState('');
  const [compositionFilterTerm, setCompositionFilterTerm] = useState('');
  const [archetypeType, setArchetypeType] = useState('entry');
  const [showLangs, setShowLangs] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const archetypes = React.useMemo(() => (
    Array.isArray(archetypeOptions) ? archetypeOptions : []
  ), [archetypeOptions]);

  const compositions = React.useMemo(() => (
    Array.isArray(compositionOptions) ? compositionOptions : []
  ), [compositionOptions]);

  const archetypeLabelById = React.useMemo(() => {
    const m = new Map();
    archetypes.forEach(o => m.set(o.value, o.label));
    return m;
  }, [archetypes]);

  const compositionLabelById = React.useMemo(() => {
    const m = new Map();
    compositions.forEach(o => m.set(o.value, o.label));
    return m;
  }, [compositions]);


  const closeAllPopovers = React.useCallback(() => {
    setShowArchetypeFilter(false);
    setShowCompositionFilter(false);
    setShowSortOptions(false);
    setShowGroupOptions(false);
    setShowLangs(false);
    setShowTerms(false);
  }, []);

  const openOnly = (setter, current) => {
    if (current) return setter(false);
    closeAllPopovers();
    setter(true);
  };

  // Filter by text and "entry" toggle
  const filteredArchetypes = React.useMemo(() => {
    const q = (archetypeFilterTerm || '').toLowerCase();
    return archetypes.filter(o => {
      const hitsText = (o.label + ' ' + o.value).toLowerCase().includes(q);
      const hitsType = (archetypeType === 'all') || isEntryLevelArchetype(o.value);
      return hitsText && hitsType;
    });
  }, [archetypes, archetypeFilterTerm, archetypeType]);

  const filteredCompositions = React.useMemo(() => {
    const q = (compositionFilterTerm || '').toLowerCase();
    return compositions.filter(o => (o.label + ' ' + o.value).toLowerCase().includes(q));
  }, [compositions, compositionFilterTerm]);

  // Determine if any filters are active
  const hasActiveFilters =
    selectedArchetypes.length > 0 ||
    selectedCompositions.length > 0 ||
    selectedLanguages.length > 0 ||
    selectedTerminologies.length > 0 ||
    currentGrouping !== 'none' ||
    hasAqlFilter ||
    hasOptFilter;

  // Handle search input change
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    closeAllPopovers();
    onSearch(value);
  };

  useEffect(() => {
    const handleClick = (e) => {
      if (e.target.closest('.filter-dropdown')) return; // clicked inside a popover
      closeAllPopovers();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [closeAllPopovers]);

  // Check if OpenEHR domain is active (for showing OpenEHR-specific filters)
  const isOpenEHR = activeDomain === 'openehr' || activeDomain === 'all';

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-theme-secondary" />
        <input
          type="text"
          placeholder="Search data models..."
          value={searchTerm}
          onChange={handleSearchChange}
          className="w-full pl-9 p-2 input"
        />
      </div>

      {/* Domain Tabs Row */}
      {onDomainChange && (
        <div className="flex rounded-md border border-theme overflow-hidden w-fit">
          {DOMAINS.map((domain) => {
            const count = domainCounts[domain.id] || 0;
            const isActive = activeDomain === domain.id;
            return (
              <button
                key={domain.id}
                onClick={() => onDomainChange(domain.id)}
                className={cn(
                  "px-4 py-2 text-sm flex items-center gap-2 transition-colors border-r border-theme last:border-r-0",
                  isActive
                    ? "bg-primary text-primary-text"
                    : "surface hover:surface-hover text-theme-primary"
                )}
                title={`${domain.label} (${count})`}
              >
                <span>{domain.label}</span>
                {count > 0 && (
                  <span className={cn(
                    "text-xs rounded-full px-1.5 min-w-[20px] text-center",
                    isActive ? "bg-primary-hover" : "bg-surface-hover"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Filter Options Row */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Grouping Button - always visible */}
        <div className="relative">
          <button
            onClick={() => openOnly(setShowGroupOptions, showGroupOptions)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm flex items-center gap-1",
              currentGrouping !== 'none'
                ? "bg-primary text-primary-text"
                : "btn-secondary"
            )}
          >
            <Tag size={14} />
            {currentGrouping === 'none' ? 'Group By' :
              currentGrouping === 'name' ? 'Grouped by Name' : 'Grouped by Composition'}
          </button>

          {showGroupOptions && (
            <div className="absolute left-0 mt-1 w-48 surface border border-theme rounded-md shadow-lg z-10 filter-dropdown">
              <div className="p-2">
                <button
                  onClick={() => {
                    onGroupingChange('none');
                    setShowGroupOptions(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded ${currentGrouping === 'none' ? 'bg-primary text-primary-text' : 'text-theme-primary hover:surface-hover'}`}
                >
                  No Grouping
                </button>
                <button
                  onClick={() => {
                    onGroupingChange('name');
                    setShowGroupOptions(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded ${currentGrouping === 'name' ? 'bg-primary text-primary-text' : 'text-theme-primary hover:surface-hover'}`}
                >
                  Group by Name/Version
                </button>
                <button
                  onClick={() => {
                    onGroupingChange('composition');
                    setShowGroupOptions(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded ${currentGrouping === 'composition' ? 'bg-primary text-primary-text' : 'text-theme-primary hover:surface-hover'}`}
                >
                  Group by Composition
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sort Button */}
        <div className="relative">
          <button
            onClick={() => openOnly(setShowSortOptions, showSortOptions)}
            className="btn-secondary text-sm flex items-center gap-1"
          >
            <Filter size={14} />
            {currentSort === 'name-asc' ? 'Name ↑' :
              currentSort === 'name-desc' ? 'Name ↓' :
                currentSort === 'date-asc' ? 'Date ↑' : 'Date ↓'}
          </button>

          {showSortOptions && (
            <div className="absolute left-0 mt-1 w-48 surface border border-theme rounded-md shadow-lg z-10 filter-dropdown">
              <div className="p-2">
                <button
                  onClick={() => {
                    onSortChange('name-asc');
                    setShowSortOptions(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded ${currentSort === 'name-asc' ? 'bg-primary text-primary-text' : 'text-theme-primary hover:surface-hover'}`}
                >
                  Name (A-Z)
                </button>
                <button
                  onClick={() => {
                    onSortChange('name-desc');
                    setShowSortOptions(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded ${currentSort === 'name-desc' ? 'bg-primary text-primary-text' : 'text-theme-primary hover:surface-hover'}`}
                >
                  Name (Z-A)
                </button>
                <button
                  onClick={() => {
                    onSortChange('date-asc');
                    setShowSortOptions(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded ${currentSort === 'date-asc' ? 'bg-primary text-primary-text' : 'text-theme-primary hover:surface-hover'}`}
                >
                  Date (Oldest First)
                </button>
                <button
                  onClick={() => {
                    onSortChange('date-desc');
                    setShowSortOptions(false);
                  }}
                  className={`w-full text-left px-2 py-1.5 text-sm rounded ${currentSort === 'date-desc' ? 'bg-primary text-primary-text' : 'text-theme-primary hover:surface-hover'}`}
                >
                  Date (Newest First)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* OpenEHR-specific filters - only shown when OpenEHR tab is active */}
        {isOpenEHR && (
          <>
            {/* Archetype Filter Button */}
            <div className="relative">
              <button
                onClick={() => openOnly(setShowArchetypeFilter, showArchetypeFilter)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm flex items-center gap-1",
                  selectedArchetypes.length > 0
                    ? "bg-primary text-primary-text"
                    : "btn-secondary"
                )}
              >
                <FileText size={14} />
                Archetypes
                {selectedArchetypes.length > 0 && (
                  <span className="bg-primary-hover text-primary-text text-xs rounded-full w-5 h-5 flex items-center justify-center ml-1">
                    {selectedArchetypes.length}
                  </span>
                )}
              </button>

              {showArchetypeFilter && (
                <div className="absolute left-0 mt-1 w-64 surface border border-theme rounded-md shadow-lg z-10 filter-dropdown">
                  <div className="p-2">
                    <div className="mb-2">
                      <input
                        type="text"
                        placeholder="Filter archetypes..."
                        value={archetypeFilterTerm}
                        onChange={(e) => setArchetypeFilterTerm(e.target.value)}
                        className="w-full px-2 py-1 bg-background border border-theme rounded text-theme-primary text-sm"
                      />
                    </div>

                    <div className="mb-2 flex gap-1">
                      <button
                        onClick={() => setArchetypeType('entry')}
                        className={`px-2 py-1 text-xs rounded flex-1 ${archetypeType === 'entry' ? 'bg-primary text-primary-text' : 'surface hover:surface-hover text-theme-primary'}`}
                      >
                        Entry Level
                      </button>
                      <button
                        onClick={() => setArchetypeType('all')}
                        className={`px-2 py-1 text-xs rounded flex-1 ${archetypeType === 'all' ? 'bg-primary text-primary-text' : 'surface hover:surface-hover text-theme-primary'}`}
                      >
                        All
                      </button>
                    </div>

                    <div className="max-h-60 overflow-y-auto border border-theme rounded">
                      {filteredArchetypes.length > 0 ? (
                        filteredArchetypes.map(opt => (
                          <div
                            key={opt.value}
                            className="flex items-center px-2 py-1 hover:surface-hover cursor-pointer text-sm"
                            onClick={() => onArchetypeSelect(opt.value)}
                            title={opt.value}
                          >
                            <input
                              type="checkbox"
                              checked={selectedArchetypes.includes(opt.value)}
                              readOnly
                              className="mr-2"
                            />
                            <div className="flex items-center overflow-hidden">
                              {getEntryTypeIcon(opt.value)}
                              <span className="ml-1 text-theme-primary truncate text-xs">{opt.label}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center p-2 text-theme-secondary text-xs">No matching archetypes</div>
                      )}
                    </div>

                    <div className="mt-2 flex justify-between">
                      <button
                        onClick={() => onArchetypeSelect([])}
                        className="px-2 py-1 text-xs text-theme-secondary hover:text-theme-primary"
                        disabled={selectedArchetypes.length === 0}
                      >
                        Clear Selection
                      </button>
                      <button
                        onClick={() => setShowArchetypeFilter(false)}
                        className="px-3 py-1 bg-primary text-primary-text text-xs rounded hover:bg-primary-hover"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Composition Filter Button */}
            <div className="relative">
              <button
                onClick={() => openOnly(setShowCompositionFilter, showCompositionFilter)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm flex items-center gap-1",
                  selectedCompositions.length > 0
                    ? "bg-primary text-primary-text"
                    : "btn-secondary"
                )}
              >
                <Database size={14} />
                Compositions
                {selectedCompositions.length > 0 && (
                  <span className="bg-primary-hover text-primary-text text-xs rounded-full w-5 h-5 flex items-center justify-center ml-1">
                    {selectedCompositions.length}
                  </span>
                )}
              </button>

              {showCompositionFilter && (
                <div className="absolute left-0 mt-1 w-64 surface border border-theme rounded-md shadow-lg z-10 filter-dropdown">
                  <div className="p-2">
                    <div className="mb-2">
                      <input
                        type="text"
                        placeholder="Filter compositions..."
                        value={compositionFilterTerm}
                        onChange={(e) => setCompositionFilterTerm(e.target.value)}
                        className="w-full px-2 py-1 bg-background border border-theme rounded text-theme-primary text-sm"
                      />
                    </div>

                    <div className="max-h-60 overflow-y-auto border border-theme rounded">
                      {filteredCompositions.length > 0 ? (
                        filteredCompositions.map(opt => (
                          <div
                            key={opt.value}
                            className="flex items-center px-2 py-1 hover:surface-hover cursor-pointer text-sm"
                            onClick={() => onCompositionSelect(opt.value)}
                            title={opt.value}
                          >
                            <input
                              type="checkbox"
                              checked={selectedCompositions.includes(opt.value)}
                              readOnly
                              className="mr-2"
                            />
                            <span className="text-theme-primary truncate text-xs">{opt.label}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center p-2 text-theme-secondary text-xs">No matching compositions</div>
                      )}
                    </div>

                    <div className="mt-2 flex justify-between">
                      <button
                        onClick={() => onCompositionSelect([])}
                        className="px-2 py-1 text-xs text-theme-secondary hover:text-theme-primary"
                        disabled={selectedCompositions.length === 0}
                      >
                        Clear Selection
                      </button>
                      <button
                        onClick={() => setShowCompositionFilter(false)}
                        className="px-3 py-1 bg-primary text-primary-text text-xs rounded hover:bg-primary-hover"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Languages (metadata.languages) */}
            {availableLanguages.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => openOnly(setShowLangs, showLangs)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm flex items-center gap-1",
                    selectedLanguages.length > 0 ? "bg-primary text-primary-text" : "btn-secondary"
                  )}
                >
                  Languages
                  {selectedLanguages.length > 0 && (
                    <span className="bg-primary-hover text-primary-text text-xs rounded-full w-5 h-5 flex items-center justify-center ml-1">
                      {selectedLanguages.length}
                    </span>
                  )}
                </button>
                {showLangs && (
                  <div className="absolute left-0 mt-1 w-56 surface border border-theme rounded-md shadow-lg z-10 filter-dropdown">
                    <div className="p-2 max-h-60 overflow-y-auto">
                      {availableLanguages.map(v => (
                        <div key={v}
                          className="flex items-center px-2 py-1 hover:surface-hover cursor-pointer text-sm"
                          onClick={() => onLanguageSelect(v)}
                        >
                          <input type="checkbox" readOnly className="mr-2" checked={selectedLanguages.includes(v)} />
                          <span className="text-theme-primary truncate text-xs">{v}</span>
                        </div>
                      ))}
                    </div>
                    <div className="p-2 flex justify-between">
                      <button className="text-xs text-theme-secondary hover:text-theme-primary" onClick={() => onLanguageSelect([])}>Clear</button>
                      <button className="px-3 py-1 bg-primary text-primary-text text-xs rounded hover:bg-primary-hover" onClick={() => setShowLangs(false)}>Apply</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Terminologies (metadata.terminologies) */}
            {availableTerminologies.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => openOnly(setShowTerms, showTerms)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-sm flex items-center gap-1",
                    selectedTerminologies.length > 0 ? "bg-primary text-primary-text" : "btn-secondary"
                  )}
                >
                  Terminologies
                  {selectedTerminologies.length > 0 && (
                    <span className="bg-primary-hover text-primary-text text-xs rounded-full w-5 h-5 flex items-center justify-center ml-1">
                      {selectedTerminologies.length}
                    </span>
                  )}
                </button>
                {showTerms && (
                  <div className="absolute left-0 mt-1 w-56 surface border border-theme rounded-md shadow-lg z-10 filter-dropdown">
                    <div className="p-2 max-h-60 overflow-y-auto">
                      {availableTerminologies.map(v => (
                        <div key={v}
                          className="flex items-center px-2 py-1 hover:surface-hover cursor-pointer text-sm"
                          onClick={() => onTerminologySelect(v)}
                        >
                          <input type="checkbox" readOnly className="mr-2" checked={selectedTerminologies.includes(v)} />
                          <span className="text-theme-primary truncate text-xs">{v}</span>
                        </div>
                      ))}
                    </div>
                    <div className="p-2 flex justify-between">
                      <button className="text-xs text-theme-secondary hover:text-theme-primary" onClick={() => onTerminologySelect([])}>Clear</button>
                      <button className="px-3 py-1 bg-primary text-primary-text text-xs rounded hover:bg-primary-hover" onClick={() => setShowTerms(false)}>Apply</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Has OPT Filter */}
            <button
              onClick={() => { closeAllPopovers(); onHasOptFilterChange(!hasOptFilter); }}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm flex items-center gap-1",
                hasOptFilter
                  ? "bg-primary text-primary-text"
                  : "btn-secondary"
              )}
              data-active={hasOptFilter}
            >
              <FileSpreadsheet size={14} />
              Has OPT
              {hasOptFilter && (
                <span className="ml-1 bg-primary-hover text-primary-text text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  ✓
                </span>
              )}
            </button>

            {/* Has AQL Queries Filter */}
            <button
              onClick={() => { closeAllPopovers(); onHasAqlFilterChange(!hasAqlFilter); }}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm flex items-center gap-1",
                hasAqlFilter
                  ? "bg-primary text-primary-text"
                  : "btn-secondary"
              )}
              data-active={hasAqlFilter}
            >
              <FileSpreadsheet size={14} />
              Has AQL Queries
              {hasAqlFilter && (
                <span className="ml-1 bg-primary-hover text-primary-text text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  ✓
                </span>
              )}
            </button>
          </>
        )}

        {/* Reset All Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={() => {
              onResetFilters();
              setSearchTerm('');
              closeAllPopovers();
            }}
            className="px-3 py-1.5 surface text-error rounded-md text-sm flex items-center gap-1 hover:surface-hover border border-error"
          >
            <X size={14} />
            Clear All
          </button>
        )}
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mt-2">
          {currentGrouping !== 'none' && (
            <div className="surface px-2 py-1 rounded-full text-xs flex items-center">
              <Tag size={10} className="mr-1 text-primary" />
              <span className="text-theme-primary">Group by: {currentGrouping === 'name' ? 'Name/Version' : 'Composition'}</span>
              <button
                onClick={() => onGroupingChange('none')}
                className="ml-1 text-theme-secondary hover:text-error"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {hasOptFilter && (
            <div className="bg-primary/20 px-2 py-1 rounded-full text-xs flex items-center">
              <FileSpreadsheet size={10} className="mr-1 text-primary" />
              <span className="text-primary font-medium">Has OPT</span>
              <button
                onClick={() => onHasOptFilterChange(false)}
                className="ml-1 text-theme-secondary hover:text-error"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {hasAqlFilter && (
            <div className="bg-primary/20 px-2 py-1 rounded-full text-xs flex items-center">
              <FileSpreadsheet size={10} className="mr-1 text-primary" />
              <span className="text-primary font-medium">Has AQL Queries</span>
              <button
                onClick={() => onHasAqlFilterChange(false)}
                className="ml-1 text-theme-secondary hover:text-error"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {selectedCompositions.map(v => (
            <div key={v} className="surface px-2 py-1 rounded-full text-xs flex items-center">
              <Database size={10} className="mr-1 text-success" />
              <span className="text-theme-primary max-w-[150px] truncate" title={v}>
                {compositionLabelById.get(v) || v}
              </span>
              <button onClick={() => onCompositionSelect(v)} className="ml-1 text-theme-secondary hover:text-error">
                <X size={12} />
              </button>
            </div>
          ))}

          {selectedArchetypes.map(v => (
            <div key={v} className="surface px-2 py-1 rounded-full text-xs flex items-center">
              {getEntryTypeIcon(v)}
              <span className="text-theme-primary ml-1 max-w-[150px] truncate" title={v}>
                {archetypeLabelById.get(v) || v}
              </span>
              <button onClick={() => onArchetypeSelect(v)} className="ml-1 text-theme-secondary hover:text-error">
                <X size={12} />
              </button>
            </div>
          ))}
          {selectedLanguages.map(v => (
            <div key={`lang-${v}`} className="surface px-2 py-1 rounded-full text-xs flex items-center">
              <span className="text-theme-primary ml-1 max-w-[150px] truncate" title={v}>{v}</span>
              <button onClick={() => onLanguageSelect(v)} className="ml-1 text-theme-secondary hover:text-error">
                <X size={12} />
              </button>
            </div>
          ))}
          {selectedTerminologies.map(v => (
            <div key={`term-${v}`} className="surface px-2 py-1 rounded-full text-xs flex items-center">
              <span className="text-theme-primary ml-1 max-w-[150px] truncate" title={v}>{v}</span>
              <button onClick={() => onTerminologySelect(v)} className="ml-1 text-theme-secondary hover:text-error">
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

DataModelSearchFilter.propTypes = {
  onSearch: PropTypes.func.isRequired,
  archetypeOptions: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
  })),
  compositionOptions: PropTypes.arrayOf(PropTypes.shape({
    value: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
  })),
  availableLanguages: PropTypes.array,
  availableTerminologies: PropTypes.array,
  selectedArchetypes: PropTypes.array,
  selectedCompositions: PropTypes.array,
  selectedLanguages: PropTypes.array,
  selectedTerminologies: PropTypes.array,
  onArchetypeSelect: PropTypes.func.isRequired,
  onCompositionSelect: PropTypes.func.isRequired,
  onLanguageSelect: PropTypes.func.isRequired,
  onTerminologySelect: PropTypes.func.isRequired,
  onGroupingChange: PropTypes.func.isRequired,
  onSortChange: PropTypes.func.isRequired,
  currentGrouping: PropTypes.string,
  currentSort: PropTypes.string,
  onResetFilters: PropTypes.func.isRequired,
  hasAqlFilter: PropTypes.bool,
  onHasAqlFilterChange: PropTypes.func,
  hasOptFilter: PropTypes.bool,
  onHasOptFilterChange: PropTypes.func,
  // Domain filtering props
  activeDomain: PropTypes.oneOf(['openehr', 'fhir', 'context', 'all']),
  onDomainChange: PropTypes.func,
  domainCounts: PropTypes.shape({
    openehr: PropTypes.number,
    fhir: PropTypes.number,
    context: PropTypes.number,
  }),
};

export default DataModelSearchFilter;
