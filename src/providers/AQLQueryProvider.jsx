"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

const AQLQueryContext = createContext(null);

export const AQLQueryProvider = ({ children }) => {
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isInitialFetchDone, setIsInitialFetchDone] = useState(false);

  const fetchQueries = useCallback(async (force = false) => {
    if (isInitialFetchDone && !force) {
      return;
    }

    if (!isInitialFetchDone) {
      setLoading(true);
    }

    setError(null);
    try {
      const response = await fetch(`/api/aql-queries`);
      if (!response.ok) throw new Error("Failed to fetch queries");
      const data = await response.json();
      setQueries(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching queries:", err);
      setError(err.message);
    } finally {
      setLoading(false);
      setIsInitialFetchDone(true);
    }
  }, [isInitialFetchDone]);

  useEffect(() => {
    fetchQueries();
  }, [fetchQueries]);

  useEffect(() => {
    const handleFocus = () => {
      fetchQueries(true);
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchQueries]);

  const saveQuery = async (queryData, options = {}) => {
    const { throwOnError = false } = options;
    try {
      const method = queryData._id ? "PUT" : "POST";
      const response = await fetch("/api/aql-queries", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queryData),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || "Failed to save query");
      }

      const savedQuery = await response.json();

      if (queryData._id) {
        setQueries((prev) => prev.map(q => (q._id === queryData._id ? savedQuery : q)));
      } else {
        setQueries((prev) => [...prev, savedQuery]);
      }
      return savedQuery;
    } catch (err) {
      console.error("Error saving query:", err);
      if (throwOnError) {
        throw err;
      }
      return null;
    }
  };

  const deleteQuery = async (queryId) => {
    if (!window.confirm("Are you sure you want to delete this query?")) return false;
    try {
      const response = await fetch("/api/aql-queries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: queryId }),
      });

      if (!response.ok) throw new Error((await response.json()).error || "Failed to delete query");

      setQueries((prev) => prev.filter(q => q._id !== queryId));
      return true;
    } catch (err) {
      console.error("Error deleting query:", err);
      alert(`Error: ${err.message}`);
      return false;
    }
  };

  // --- Cache-update helpers for writers outside the provider ---
  // Use these when a component has already called the API directly and we
  // need to keep the in-memory cache in sync without a round-trip.
  const upsertQueryInCache = useCallback((savedQuery) => {
    if (!savedQuery?._id) return;
    setQueries((prev) => {
      const idx = prev.findIndex(q => q._id === savedQuery._id);
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = savedQuery;
        return next;
      }
      return [...prev, savedQuery];
    });
  }, []);

  const removeQueryFromCache = useCallback((queryId) => {
    if (!queryId) return;
    setQueries((prev) => prev.filter(q => q._id !== queryId));
  }, []);

  // --- Derived selectors. Computing from the cache avoids refetches. ---
  const getQueriesByTemplateId = useCallback((templateId) => {
    if (!templateId) return [];
    const idStr = String(templateId);
    return queries.filter(q => {
      const affected = Array.isArray(q.affectedTemplates) ? q.affectedTemplates : [];
      return affected.some(t => {
        const rawId = t?._id ?? t?.id;
        return rawId != null && String(rawId) === idStr;
      });
    });
  }, [queries]);

  const getQueriesByFolder = useCallback((folderId) => {
    if (!folderId) return [];
    return queries.filter(q => q.folderId === folderId);
  }, [queries]);

  const getQueriesByTag = useCallback((tagName) => {
    if (!tagName) return [];
    return queries.filter(q => {
      if (!Array.isArray(q.tags)) return false;
      return q.tags.some(tag => {
        const name = typeof tag === 'string' ? tag : tag?.name;
        return name === tagName;
      });
    });
  }, [queries]);

  const getRecentQueries = useCallback((limit = 3) => {
    const sorted = queries.slice().sort((a, b) => {
      const ta = Date.parse(a?.updatedAt || a?.createdAt || '') || 0;
      const tb = Date.parse(b?.updatedAt || b?.createdAt || '') || 0;
      return tb - ta;
    });
    return sorted.slice(0, limit);
  }, [queries]);

  // usage-count map by templateId (replacement for GET ?summary=usage)
  const getTemplateUsageCounts = useCallback((templateIds = null) => {
    const wanted = templateIds ? new Set(templateIds.map(String)) : null;
    const counts = {};
    for (const q of queries) {
      const affected = Array.isArray(q.affectedTemplates) ? q.affectedTemplates : [];
      for (const t of affected) {
        const rawId = t?._id ?? t?.id;
        if (rawId == null) continue;
        const idStr = String(rawId);
        if (wanted && !wanted.has(idStr)) continue;
        counts[idStr] = (counts[idStr] || 0) + 1;
      }
    }
    return counts;
  }, [queries]);

  const value = useMemo(() => ({
    queries,
    loading,
    error,
    refetchQueries: () => fetchQueries(true),
    saveQuery,
    deleteQuery,
    upsertQueryInCache,
    removeQueryFromCache,
    getQueriesByTemplateId,
    getQueriesByFolder,
    getQueriesByTag,
    getRecentQueries,
    getTemplateUsageCounts,
  }), [
    queries, loading, error, fetchQueries,
    upsertQueryInCache, removeQueryFromCache,
    getQueriesByTemplateId, getQueriesByFolder, getQueriesByTag,
    getRecentQueries, getTemplateUsageCounts,
  ]);

  return (
    <AQLQueryContext.Provider value={value}>
      {children}
    </AQLQueryContext.Provider>
  );
};

export const useAQLQueries = () => {
  const context = useContext(AQLQueryContext);
  if (!context) {
    throw new Error('useAQLQueries must be used within an AQLQueryProvider');
  }
  return context;
};

// Optional variant: returns null instead of throwing when unmounted.
// Useful for components that may be rendered outside the provider tree
// during transitional states (e.g. login screens).
export const useAQLQueriesOptional = () => useContext(AQLQueryContext);
