"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, User, Clock, Check } from 'lucide-react';
import { getEhrId, getSubjectId, getTimeCreated } from '../lib/ehr';

const pickerLastChosenKey = (envId, scope) => `sandbox.ehrPicker.${scope}.lastChosen.${envId || 'default'}`;

function readLastChosen(envId, scope) {
  if (typeof window === 'undefined') return '';
  try { return window.localStorage.getItem(pickerLastChosenKey(envId, scope)) || ''; }
  catch { return ''; }
}

function writeLastChosen(envId, scope, value) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(pickerLastChosenKey(envId, scope), value || ''); }
  catch { /* ignore */ }
}

function ehrDisplayLabel(ehr) {
  const id = getEhrId(ehr) || '';
  const subject = getSubjectId(ehr);
  const created = getTimeCreated(ehr);
  const shortId = id ? id.substring(0, 8) : '';
  const parts = [];
  if (subject) parts.push(subject);
  if (shortId) parts.push(shortId);
  if (created) parts.push(created.toLocaleDateString());
  return parts.join(' · ') || id || 'Unknown EHR';
}

// Searchable EHR combobox. Shows subject · shortUid · date instead of the raw
// UUID, and remembers the last-used EHR per environment+scope in localStorage
// so tab switches feel continuous.
export default function EhrPicker({
  ehrRecords,
  value,
  onChange,
  envId,
  scope = 'default',
  disabled = false,
  autoRestoreLast = true,
  placeholder = 'Search by subject, UUID, or date…',
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-restore last-used EHR once records are available and nothing is selected.
  useEffect(() => {
    if (!autoRestoreLast || value) return;
    if (!ehrRecords?.length) return;
    const last = readLastChosen(envId, scope);
    if (last && ehrRecords.some((ehr) => getEhrId(ehr) === last)) {
      onChange(last);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ehrRecords.length]);

  // Dismiss the dropdown when clicking outside.
  useEffect(() => {
    if (!open) return;
    const handler = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setSearch('');
    }
  }, [open]);

  const selected = useMemo(
    () => ehrRecords.find((ehr) => getEhrId(ehr) === value) || null,
    [ehrRecords, value]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return ehrRecords;
    return ehrRecords.filter((ehr) => {
      const id = (getEhrId(ehr) || '').toLowerCase();
      const subject = (getSubjectId(ehr) || '').toLowerCase();
      const created = getTimeCreated(ehr);
      const createdStr = created ? created.toLocaleDateString().toLowerCase() : '';
      return id.includes(term) || subject.includes(term) || createdStr.includes(term);
    });
  }, [ehrRecords, search]);

  const handleSelect = useCallback((ehr) => {
    const id = getEhrId(ehr);
    if (!id) return;
    onChange(id);
    writeLastChosen(envId, scope, id);
    setOpen(false);
  }, [envId, onChange, scope]);

  const handleClear = useCallback(() => {
    onChange('');
    writeLastChosen(envId, scope, '');
  }, [envId, onChange, scope]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-slate-200 text-sm flex items-center justify-between gap-2 hover:border-primary/40 focus:outline-none focus:border-primary/50 disabled:opacity-60 disabled:cursor-not-allowed"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0 flex-1 text-left">
            <User className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="truncate">{ehrDisplayLabel(selected)}</span>
          </span>
        ) : (
          <span className="text-slate-500">Select an EHR…</span>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-surface shadow-xl overflow-hidden"
          role="listbox"
        >
          <div className="p-2 border-b border-border flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none"
            />
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">
                {ehrRecords.length === 0 ? 'No EHRs in this environment' : 'No matches'}
              </div>
            ) : (
              filtered.map((ehr) => {
                const id = getEhrId(ehr);
                const isSelected = id === value;
                const subject = getSubjectId(ehr);
                const created = getTimeCreated(ehr);
                return (
                  <button
                    key={id || Math.random()}
                    type="button"
                    onClick={() => handleSelect(ehr)}
                    className={`w-full flex items-start gap-3 px-3 py-2 text-left transition-colors ${
                      isSelected ? 'bg-primary/10' : 'hover:bg-slate-800/50'
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isSelected ? 'text-primary' : 'opacity-0'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <User className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span className="truncate">{subject || 'No subject id'}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500 font-mono">
                        <span className="truncate" title={id || ''}>{id || '—'}</span>
                        {created && (
                          <span className="flex items-center gap-1 flex-shrink-0">
                            <Clock className="w-3 h-3" />
                            {created.toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
