"use client";

import React, { useMemo } from 'react';
import { Settings2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// High-contrast colors for the distribution bar (avoid teal/cyan which blend with dark backgrounds)
const BAR_COLORS = [
  'bg-blue-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-lime-500',
  'bg-fuchsia-500',
];

/**
 * ModelConfigurationPanel - Lightweight configuration for selected data models
 */
const ModelConfigurationPanel = ({
  selectedModels = [],
  configs = {},
  onConfigChange,
  onRemove,
}) => {
  // Calculate total weight for percentage display
  const totalWeight = useMemo(() => {
    return selectedModels.reduce((sum, model) => {
      const weight = Number(configs[model.model_id]?.weight) || 1;
      return sum + weight;
    }, 0);
  }, [selectedModels, configs]);

  // Calculate percentage for each model
  const getPercentage = (modelId) => {
    const weight = Number(configs[modelId]?.weight) || 1;
    if (totalWeight === 0) return 0;
    return Math.round((weight / totalWeight) * 100);
  };

  if (selectedModels.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-primary/20 p-8 text-center bg-primary/5">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Settings2 className="w-6 h-6 text-primary/60" />
        </div>
        <p className="text-sm text-theme-primary font-medium">No data models selected</p>
        <p className="text-xs text-theme-secondary mt-1">
          Click on data models above to select them
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-theme-primary flex items-center gap-2">
          <Settings2 size={14} className="text-primary" />
          Selected Data Models
        </h4>
        <span className="text-xs text-theme-secondary/70">
          {selectedModels.length} selected
        </span>
      </div>

      {/* Compact distribution bar */}
      <div className="h-2 rounded-full overflow-hidden flex bg-theme/10">
        {selectedModels.map((model, index) => {
          const pct = getPercentage(model.model_id);
          const color = BAR_COLORS[index % BAR_COLORS.length];
          return (
            <div
              key={model.model_id}
              className={cn("h-full transition-all", color)}
              style={{ width: `${pct}%` }}
              title={`${model.name}: ${pct}%`}
            />
          );
        })}
      </div>

      {/* Compact table-style configuration */}
      <div className="rounded-lg border border-theme/20 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-theme/5 text-[10px] text-theme-secondary/70 uppercase tracking-wide">
          <div className="col-span-5">Data Model</div>
          <div className="col-span-2 text-center">Weight</div>
          <div className="col-span-2 text-center">Min/Patient</div>
          <div className="col-span-2 text-center">Max/Patient</div>
          <div className="col-span-1"></div>
        </div>

        {/* Model rows */}
        {selectedModels.map((model, index) => {
          const config = configs[model.model_id] || {};
          const pct = getPercentage(model.model_id);
          const color = BAR_COLORS[index % BAR_COLORS.length];

          return (
            <div
              key={model.model_id}
              className="grid grid-cols-12 gap-2 px-3 py-2 items-center border-t border-theme/10 hover:bg-theme/5 transition-colors"
            >
              {/* Name with color indicator */}
              <div className="col-span-5 flex items-center gap-2 min-w-0">
                <div className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", color)} />
                <span className="text-sm text-theme-primary truncate">{model.name}</span>
                <span className="text-[10px] text-theme-secondary/50 flex-shrink-0">{pct}%</span>
              </div>

              {/* Weight slider */}
              <div className="col-span-2 flex items-center justify-center gap-1">
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={config.weight || 50}
                  onChange={(e) => onConfigChange?.(model.model_id, 'weight', e.target.value)}
                  className="w-full h-1 rounded-full appearance-none bg-theme/20 cursor-pointer accent-primary"
                />
              </div>

              {/* Min per patient */}
              <div className="col-span-2 flex justify-center">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={config.min_per_patient ?? 1}
                  onChange={(e) => onConfigChange?.(model.model_id, 'min_per_patient', e.target.value)}
                  className="w-14 rounded border border-theme/20 bg-transparent px-2 py-1 text-xs text-theme-primary text-center focus:border-primary/50 focus:outline-none"
                />
              </div>

              {/* Max per patient */}
              <div className="col-span-2 flex justify-center">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={config.max_per_patient ?? 1}
                  onChange={(e) => onConfigChange?.(model.model_id, 'max_per_patient', e.target.value)}
                  className="w-14 rounded border border-theme/20 bg-transparent px-2 py-1 text-xs text-theme-primary text-center focus:border-primary/50 focus:outline-none"
                />
              </div>

              {/* Remove button */}
              <div className="col-span-1 flex justify-end">
                <button
                  onClick={() => onRemove?.(model.model_id)}
                  className="p-1 rounded hover:bg-error/10 text-theme-secondary/40 hover:text-error transition-colors"
                  title="Remove"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ModelConfigurationPanel;
