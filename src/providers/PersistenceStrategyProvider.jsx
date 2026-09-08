"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const PersistenceStrategyContext = createContext(null);

// Strategies are defined in Kehrnel and are read-only from the client's point
// of view (POST/PUT/DELETE are 403). A single fetch can back every consumer:
// individual lookups are resolved from the cache instead of hitting
// /api/persistence-strategies/[id].
export const PersistenceStrategyProvider = ({ children }) => {
  const [strategies, setStrategies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInitialFetchDone, setIsInitialFetchDone] = useState(false);

  const fetchStrategies = useCallback(async (force = false) => {
    if (isInitialFetchDone && !force) return;

    if (!isInitialFetchDone) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/persistence-strategies?scope=all');
      if (!res.ok) throw new Error(`Failed to fetch strategies (${res.status})`);
      const data = await res.json();
      const list = Array.isArray(data?.strategies) ? data.strategies : [];
      setStrategies(list);
    } catch (err) {
      console.error('Error fetching persistence strategies:', err);
      setError(err.message || 'Failed to load strategies');
    } finally {
      setLoading(false);
      setIsInitialFetchDone(true);
    }
  }, [isInitialFetchDone]);

  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  // Refresh silently when the window regains focus.
  useEffect(() => {
    const handleFocus = () => fetchStrategies(true);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchStrategies]);

  // Lookup by _id, id, kehrnelId, or name — matches how the API resolves IDs.
  const getStrategyById = useCallback((strategyId) => {
    if (!strategyId) return null;
    const idStr = String(strategyId);
    return strategies.find(s =>
      String(s?._id) === idStr ||
      String(s?.id) === idStr ||
      String(s?.kehrnelId) === idStr ||
      String(s?.name) === idStr
    ) || null;
  }, [strategies]);

  // Async variant: resolves from the cache when possible; only falls back to
  // the network if the list hasn't loaded yet or the id is genuinely missing.
  const ensureStrategyById = useCallback(async (strategyId) => {
    if (!strategyId) return null;
    const cached = getStrategyById(strategyId);
    if (cached) return cached;

    // Cache miss — likely means the list is still loading or the strategy
    // isn't in the default view. Fall back to the detail endpoint.
    try {
      const res = await fetch(`/api/persistence-strategies/${encodeURIComponent(strategyId)}`);
      if (!res.ok) return null;
      const doc = await res.json();
      if (doc?._id || doc?.id) {
        setStrategies(prev => {
          const exists = prev.some(s => String(s?._id) === String(doc?._id));
          return exists ? prev : [...prev, doc];
        });
      }
      return doc || null;
    } catch (err) {
      console.error('ensureStrategyById error:', err);
      return null;
    }
  }, [getStrategyById]);

  const value = useMemo(() => ({
    strategies,
    loading,
    error,
    refetchStrategies: () => fetchStrategies(true),
    getStrategyById,
    ensureStrategyById,
  }), [strategies, loading, error, fetchStrategies, getStrategyById, ensureStrategyById]);

  return (
    <PersistenceStrategyContext.Provider value={value}>
      {children}
    </PersistenceStrategyContext.Provider>
  );
};

export const usePersistenceStrategies = () => {
  const ctx = useContext(PersistenceStrategyContext);
  if (!ctx) throw new Error('usePersistenceStrategies must be used within a PersistenceStrategyProvider');
  return ctx;
};
