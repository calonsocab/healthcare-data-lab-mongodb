// src/components/views/strategyStudio/StrategyManager/components/StrategyList.jsx
"use client";

import React from 'react';
import StrategyRow from './StrategyRow';

/**
 * List of strategies displayed as full-width rows (Google/Booking style)
 *
 * Strategies are READ-ONLY system templates. Users can:
 * - View strategy details (onSelect)
 * - Activate a strategy for their environment (onActivate)
 */
const StrategyList = ({ cards, selectedId, activeId, onSelect, onActivate }) => {
  if (!cards || cards.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <p>No strategies found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cards.map(card => (
        <StrategyRow
          key={card.id}
          strategy={card.strategy}
          isActive={activeId === card.id}
          onSelect={onSelect}
          onActivate={onActivate}
        />
      ))}
    </div>
  );
};

export default StrategyList;
