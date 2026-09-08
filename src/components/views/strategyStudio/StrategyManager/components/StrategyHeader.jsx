// src/components/views/settings/StrategyManager/components/StrategyHeader.jsx
"use client";

import React from 'react';
import { RefreshCw } from 'lucide-react';

const StrategyHeader = ({ onRefresh, loading }) => (
  <div className="flex flex-wrap items-center justify-between gap-4">
    <div>
      <p className="text-sm uppercase text-slate-400 tracking-wide">Strategy Studio</p>
      <h1 className="text-3xl font-semibold text-white">Persistence Strategies</h1>
      <p className="text-slate-400 mt-2 max-w-3xl">
        Explore system strategies and customize them for your needs.
        Select a strategy to view details or create your own version.
      </p>
    </div>
    <div className="flex gap-2">
      <button
        onClick={onRefresh}
        className="px-4 py-2 rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center gap-2"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  </div>
);

export default StrategyHeader;
