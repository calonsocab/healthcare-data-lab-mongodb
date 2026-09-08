"use client";

import React, { useEffect, useState } from 'react';
import { Info, X } from 'lucide-react';

const DISMISSED_KEY = 'sandbox.runtimeBanner.dismissed.v1';

function readDismissed() {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(DISMISSED_KEY) === '1'; }
  catch { return false; }
}

// Single explanatory banner for "runtime templates vs catalog models".
// Previously this copy appeared both on the Templates tab and inside the
// Compositions creator — consolidating it here kills ~80 lines of repetition
// and respects a user's dismissal across sessions.
export default function SandboxRuntimeBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => { setDismissed(readDismissed()); }, []);

  const handleDismiss = () => {
    try { window.localStorage.setItem(DISMISSED_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 flex items-start gap-3">
      <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-xs text-slate-300 leading-relaxed">
        The sandbox runs against the active environment, strategy, and runtime collections.
        <span className="text-slate-400">
          {' '}Runtime <em>templates</em> (shown in the Templates tab) are the OPT-backed models the openEHR engine can validate against.
          Data Models in the catalog only become available here when you load their OPT source into the runtime.
        </span>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
