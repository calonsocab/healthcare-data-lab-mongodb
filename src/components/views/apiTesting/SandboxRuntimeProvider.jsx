"use client";

import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState
} from 'react';
import { normalizeCompositionSummary } from './lib/composition';
import { normalizeRuntimeQueryResult } from './lib/runtimeQuery';

const SandboxRuntimeContext = createContext(null);

const KEHRNEL_BASE = '/api/kehrnel/openehr';
const MAX_SANDBOX_QUERY_ROWS = 100;

const loadedIdsStorageKey = (envId) => `sandbox.loadedTemplateIds.${envId || 'default'}`;

function readLoadedIds(envId) {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(loadedIdsStorageKey(envId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeLoadedIds(envId, idSet) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      loadedIdsStorageKey(envId),
      JSON.stringify(Array.from(idSet))
    );
  } catch {
    /* ignore quota errors */
  }
}

// Owns the sandbox's cross-tab state: EHRs, runtime templates, per-EHR
// composition lists, contributions. Tabs read from here and call mutation
// helpers instead of fetching on their own. The provider mounts once per
// environment change; tab switches no longer trigger refetches.
export const SandboxRuntimeProvider = ({ activeEnvironment, children }) => {
  const envId = activeEnvironment?.id || '';
  const openEhrStrategyLink = useMemo(() => {
    const links = Array.isArray(activeEnvironment?.strategyLinks) ? activeEnvironment.strategyLinks : [];
    return links.find((link) => {
      const domain = String(link?.domain || '').trim().toLowerCase();
      return domain === 'openehr' || domain === 'open_ehr';
    }) || links[0] || null;
  }, [activeEnvironment]);
  const activeOpenEhrStrategyId =
    openEhrStrategyLink?.kehrnel?.strategyId ||
    openEhrStrategyLink?.strategyId ||
    null;

  const apiBase = useMemo(() => `${KEHRNEL_BASE.replace(/\/+$/, '')}`, []);
  const apiFetch = useCallback((path, init = {}) => {
    const headers = new Headers(init.headers || {});
    if (envId) headers.set('x-active-env', envId);
    return fetch(`${apiBase}${path}`, { cache: 'no-store', ...init, headers });
  }, [apiBase, envId]);

  const tenantFetch = useCallback((path, init = {}) => {
    const headers = new Headers(init.headers || {});
    if (envId) headers.set('x-active-env', envId);
    return fetch(path, { cache: 'no-store', ...init, headers });
  }, [envId]);

  const runtimeQuery = useCallback(async (aql, options = {}) => {
    if (!envId) {
      throw new Error('Active environment is required to query Kehrnel.');
    }

    const runtimeQueryOptions = (
      options && typeof options === 'object' && !Array.isArray(options)
        ? { ...options }
        : {}
    );
    const parsedLimit = Number.parseInt(String(runtimeQueryOptions.limit ?? ''), 10);
    runtimeQueryOptions.limit = Number.isFinite(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, MAX_SANDBOX_QUERY_ROWS)
      : MAX_SANDBOX_QUERY_ROWS;

    const response = await tenantFetch(`/api/kehrnel/environments/${encodeURIComponent(envId)}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aql,
        domain: 'openEHR',
        strategyId: activeOpenEhrStrategyId || undefined,
        options: runtimeQueryOptions,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const payloadError = data?.error && typeof data.error === 'object' ? data.error : null;
      const error = new Error(
        payloadError?.message ||
        data?.message ||
        (typeof data?.error === 'string' ? data.error : null) ||
        `Query failed: ${response.status}`
      );
      error.name = 'RuntimeQueryError';
      error.status = response.status;
      error.code = payloadError?.code || data?.code || null;
      error.details = payloadError?.details || data?.details || null;
      error.payload = data;
      throw error;
    }

    return normalizeRuntimeQueryResult(data);
  }, [activeOpenEhrStrategyId, envId, tenantFetch]);

  const runtimeOp = useCallback(async (op, payload = {}, options = {}) => {
    if (!envId) {
      throw new Error('Active environment is required to run Kehrnel operations.');
    }
    if (!activeOpenEhrStrategyId) {
      throw new Error('No active openEHR strategy is available for this environment.');
    }

    const response = await tenantFetch(
      `/api/kehrnel/environments/${encodeURIComponent(envId)}/ops/${encodeURIComponent(activeOpenEhrStrategyId)}/${encodeURIComponent(op)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: 'openEHR',
          connectionId: options.connectionId,
          payload,
        }),
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
        data?.message ||
        data?.error ||
        `Operation failed: ${response.status}`
      );
    }

    return data;
  }, [activeOpenEhrStrategyId, envId, tenantFetch]);

  // ========== EHRs ==========
  const [ehrRecords, setEhrRecords] = useState([]);
  const [ehrLoading, setEhrLoading] = useState(false);
  const [ehrError, setEhrError] = useState('');
  const [ehrLoaded, setEhrLoaded] = useState(false);
  const [nativeEhrRecords, setNativeEhrRecords] = useState([]);
  const [nativeEhrLoading, setNativeEhrLoading] = useState(false);
  const [nativeEhrError, setNativeEhrError] = useState('');
  const [nativeEhrChecked, setNativeEhrChecked] = useState(false);

  const fetchEhrRecords = useCallback(async () => {
    setEhrLoading(true);
    setEhrError('');
    try {
      const res = await apiFetch('/ehr', { headers: { Accept: 'application/json' } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || `Failed to fetch EHRs: ${res.status}`);
      }
      const records = await res.json();
      setEhrRecords(Array.isArray(records) ? records : []);
    } catch (err) {
      setEhrError(err.message);
      setEhrRecords([]);
    } finally {
      setEhrLoading(false);
      setEhrLoaded(true);
    }
  }, [apiFetch]);

  const ensureEhrRecords = useCallback(() => {
    if (!ehrLoaded && !ehrLoading) fetchEhrRecords();
  }, [ehrLoaded, ehrLoading, fetchEhrRecords]);

  const fetchNativeEhrRecords = useCallback(async () => {
    setNativeEhrLoading(true);
    setNativeEhrError('');
    try {
      const result = await runtimeOp('list_native_ehrs', { limit: 1000 });
      const rows = Array.isArray(result?.records) ? result.records : (Array.isArray(result?.result?.records) ? result.result.records : []);

      setNativeEhrRecords(rows.map((row) => ({
        ehr_id: row?.ehr_id || row?.id || '',
        id: row?.ehr_id || row?.id || '',
        time_created: row?.time_created || null,
        _source: 'kehrnel_native_collection',
      })).filter((row) => row.ehr_id));
    } catch (err) {
      setNativeEhrError(err.message || 'Failed to discover native EHR ids from compositions.');
      setNativeEhrRecords([]);
    } finally {
      setNativeEhrLoading(false);
      setNativeEhrChecked(true);
    }
  }, [runtimeOp]);

  const ensureNativeEhrRecords = useCallback(() => {
    if (!nativeEhrChecked && !nativeEhrLoading) fetchNativeEhrRecords();
  }, [fetchNativeEhrRecords, nativeEhrChecked, nativeEhrLoading]);

  // ========== Runtime Templates ==========
  const [templates, setTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState('');
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  // Known template ids from previous sessions (belt-and-braces against first-render races).
  const [persistedTemplateIds, setPersistedTemplateIds] = useState(() => readLoadedIds(envId));

  // Reset everything when the active environment changes.
  useEffect(() => {
    setEhrRecords([]);
    setEhrLoaded(false);
    setEhrError('');
    setNativeEhrRecords([]);
    setNativeEhrLoading(false);
    setNativeEhrError('');
    setNativeEhrChecked(false);
    setTemplates([]);
    setTemplatesLoaded(false);
    setTemplatesError('');
    setPersistedTemplateIds(readLoadedIds(envId));
  }, [envId]);

  const fetchTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError('');
    try {
      const res = await apiFetch('/definition/template/adl1.4');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to fetch templates: ${res.status}`);
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setTemplates(list);

      // Persist the id set so subsequent sessions can pre-validate compositions
      // without waiting for the runtime to respond.
      const ids = new Set(
        list
          .map((t) => t?.template_id || t?._id || t?.templateId)
          .filter((v) => typeof v === 'string' && v.trim())
          .map((v) => v.trim())
      );
      setPersistedTemplateIds(ids);
      writeLoadedIds(envId, ids);
    } catch (err) {
      setTemplatesError(err.message);
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
      setTemplatesLoaded(true);
    }
  }, [apiFetch, envId]);

  const ensureTemplates = useCallback(() => {
    if (!templatesLoaded && !templatesLoading) fetchTemplates();
  }, [templatesLoaded, templatesLoading, fetchTemplates]);

  // Live ids from the current `templates` array — union with the persisted
  // set so hot reloads / initial paint don't trigger a spurious "template not
  // available" error before fetchTemplates resolves.
  const availableTemplateIds = useMemo(() => {
    const live = new Set(
      templates
        .map((t) => t?.template_id || t?._id || t?.templateId)
        .filter((v) => typeof v === 'string' && v.trim())
        .map((v) => v.trim())
    );
    if (templatesLoaded) return live;
    // Before the first fetch resolves, trust the persisted hint so the UI
    // doesn't block users who refreshed the page.
    return new Set([...live, ...persistedTemplateIds]);
  }, [templates, templatesLoaded, persistedTemplateIds]);

  // ========== Compositions (per EHR) ==========
  const [compositionsByEhr, setCompositionsByEhr] = useState({}); // { [ehrId]: Array }
  const [compositionsLoadingFor, setCompositionsLoadingFor] = useState('');
  const [compositionsErrorByEhr, setCompositionsErrorByEhr] = useState({});

  const fetchCompositions = useCallback(async (ehrId) => {
    if (!ehrId) return;
    setCompositionsLoadingFor(ehrId);
    setCompositionsErrorByEhr((prev) => ({ ...prev, [ehrId]: '' }));
    try {
      const fetchViaNativeOp = async () => {
        const result = await runtimeOp('list_native_compositions', {
          ehr_id: ehrId,
          limit: 500,
        });
        const rows = Array.isArray(result?.records) ? result.records : (Array.isArray(result?.result?.records) ? result.result.records : []);
        return rows.map(normalizeCompositionSummary).filter((row) => row.uid);
      };

      let rows = [];
      let res = await apiFetch(`/ehr/${encodeURIComponent(ehrId)}/composition`);

      if (res.ok) {
        const data = await res.json().catch(() => []);
        rows = Array.isArray(data)
          ? data.map(normalizeCompositionSummary).filter((r) => r.uid)
          : [];
      }

      if (rows.length === 0) {
        rows = await fetchViaNativeOp();
      }

      setCompositionsByEhr((prev) => ({ ...prev, [ehrId]: rows }));
    } catch (err) {
      setCompositionsErrorByEhr((prev) => ({ ...prev, [ehrId]: err.message || 'Failed to fetch compositions' }));
      setCompositionsByEhr((prev) => ({ ...prev, [ehrId]: [] }));
    } finally {
      setCompositionsLoadingFor((current) => (current === ehrId ? '' : current));
    }
  }, [apiFetch, runtimeOp]);

  const ensureCompositions = useCallback((ehrId) => {
    if (!ehrId) return;
    if (compositionsByEhr[ehrId] != null) return;
    if (compositionsLoadingFor === ehrId) return;
    fetchCompositions(ehrId);
  }, [compositionsByEhr, compositionsLoadingFor, fetchCompositions]);

  const upsertCompositions = useCallback((ehrId, newItems) => {
    if (!ehrId || !Array.isArray(newItems) || newItems.length === 0) return;
    setCompositionsByEhr((prev) => {
      const current = Array.isArray(prev[ehrId]) ? prev[ehrId] : [];
      const byUid = new Map(current.map((item) => [item.uid, item]));
      for (const item of newItems) {
        const normalized = normalizeCompositionSummary(item);
        if (normalized.uid) byUid.set(normalized.uid, {
          uid: normalized.uid,
          name: normalized.name || byUid.get(normalized.uid)?.name || '',
          templateId: normalized.templateId || byUid.get(normalized.uid)?.templateId || '',
        });
      }
      return { ...prev, [ehrId]: Array.from(byUid.values()) };
    });
  }, []);

  const removeCompositions = useCallback((ehrId, uids) => {
    if (!ehrId || !Array.isArray(uids) || uids.length === 0) return;
    const drop = new Set(uids);
    setCompositionsByEhr((prev) => {
      const current = Array.isArray(prev[ehrId]) ? prev[ehrId] : [];
      return { ...prev, [ehrId]: current.filter((c) => !drop.has(c.uid)) };
    });
  }, []);

  const fetchNativeCompositionDetail = useCallback(async (compositionUid, ehrId = '') => {
    const result = await runtimeOp('fetch_native_composition', {
      uid: compositionUid,
      ehr_id: ehrId || undefined,
    });

    return result?.composition || result?.result?.composition || null;
  }, [runtimeOp]);

  // ========== Contributions (per EHR) ==========
  const [contributionsByEhr, setContributionsByEhr] = useState({});
  const [contributionsLoadingFor, setContributionsLoadingFor] = useState('');
  const [contributionsErrorByEhr, setContributionsErrorByEhr] = useState({});

  const fetchContributions = useCallback(async (ehrId) => {
    if (!ehrId) return;
    setContributionsLoadingFor(ehrId);
    setContributionsErrorByEhr((prev) => ({ ...prev, [ehrId]: '' }));
    try {
      const res = await apiFetch(`/ehr/${encodeURIComponent(ehrId)}/contribution`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to fetch contributions: ${res.status}`);
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.contributions || []);
      setContributionsByEhr((prev) => ({ ...prev, [ehrId]: list }));
    } catch (err) {
      setContributionsErrorByEhr((prev) => ({ ...prev, [ehrId]: err.message || 'Failed to fetch contributions' }));
      setContributionsByEhr((prev) => ({ ...prev, [ehrId]: [] }));
    } finally {
      setContributionsLoadingFor((current) => (current === ehrId ? '' : current));
    }
  }, [apiFetch]);

  const ensureContributions = useCallback((ehrId) => {
    if (!ehrId) return;
    if (contributionsByEhr[ehrId] != null) return;
    if (contributionsLoadingFor === ehrId) return;
    fetchContributions(ehrId);
  }, [contributionsByEhr, contributionsLoadingFor, fetchContributions]);

  // ========== Silent refresh on window focus (single shared handler, throttled) ==========
  const lastFocusRefreshAt = useRef(0);
  useEffect(() => {
    const handler = () => {
      const now = Date.now();
      if (now - lastFocusRefreshAt.current < 5000) return;
      lastFocusRefreshAt.current = now;
      if (templatesLoaded) fetchTemplates();
      if (ehrLoaded) fetchEhrRecords();
    };
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [templatesLoaded, ehrLoaded, fetchTemplates, fetchEhrRecords]);

  const value = useMemo(() => ({
    // base
    activeEnvironment,
    apiFetch,
    tenantFetch,
    runtimeQuery,
    runtimeOp,
    activeOpenEhrStrategyId,
    // EHRs
    ehrRecords, ehrLoading, ehrError, ehrLoaded,
    fetchEhrRecords, ensureEhrRecords,
    nativeEhrRecords, nativeEhrLoading, nativeEhrError, nativeEhrChecked,
    fetchNativeEhrRecords, ensureNativeEhrRecords,
    // Runtime templates
    templates, templatesLoading, templatesError, templatesLoaded,
    availableTemplateIds,
    fetchTemplates, ensureTemplates,
    // Compositions
    compositionsByEhr, compositionsLoadingFor, compositionsErrorByEhr,
    fetchCompositions, ensureCompositions, upsertCompositions, removeCompositions, fetchNativeCompositionDetail,
    // Contributions
    contributionsByEhr, contributionsLoadingFor, contributionsErrorByEhr,
    fetchContributions, ensureContributions,
  }), [
    activeEnvironment, apiFetch, tenantFetch, runtimeQuery, runtimeOp, activeOpenEhrStrategyId,
    ehrRecords, ehrLoading, ehrError, ehrLoaded, fetchEhrRecords, ensureEhrRecords,
    nativeEhrRecords, nativeEhrLoading, nativeEhrError, nativeEhrChecked, fetchNativeEhrRecords, ensureNativeEhrRecords,
    templates, templatesLoading, templatesError, templatesLoaded,
    availableTemplateIds, fetchTemplates, ensureTemplates,
    compositionsByEhr, compositionsLoadingFor, compositionsErrorByEhr,
    fetchCompositions, ensureCompositions, upsertCompositions, removeCompositions, fetchNativeCompositionDetail,
    contributionsByEhr, contributionsLoadingFor, contributionsErrorByEhr,
    fetchContributions, ensureContributions,
  ]);

  return (
    <SandboxRuntimeContext.Provider value={value}>
      {children}
    </SandboxRuntimeContext.Provider>
  );
};

export const useSandboxRuntime = () => {
  const ctx = useContext(SandboxRuntimeContext);
  if (!ctx) throw new Error('useSandboxRuntime must be used within a SandboxRuntimeProvider');
  return ctx;
};
