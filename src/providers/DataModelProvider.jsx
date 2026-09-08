// src/providers/DataModelProvider.jsx
// Now supports multi-domain data models (OpenEHR, FHIR, Context Objects)
"use client";
import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';

const DataModelsCtx = createContext(null);

export function DataModelProvider({ children, activeEnvironment }) {
  const [dataModelsByName, setDataModelsByName] = useState({}); // { [id]: doc }
  const [domainCounts, setDomainCounts] = useState({ openehr: 0, fhir: 0, contextobject: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const hydratingTrees = useRef({}); // { [id]: true }
  const hydratingData = useRef({}); // { [id]: true } for FHIR/Context data

  const refreshDataModels = useCallback(async (options = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const envId = activeEnvironment?.id;
      const headers = envId ? { 'x-active-env': envId } : undefined;

      // Build query params
      const params = new URLSearchParams();
      if (options.domain) params.set('domain', options.domain);
      if (options.search) params.set('search', options.search);
      if (options.sort) params.set('sort', options.sort);

      const queryString = params.toString();
      const url = `/api/data-model-catalog${queryString ? `?${queryString}` : ''}`;

      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Failed to fetch data models (${res.status})`);
      const payload = await res.json();
      const list = Array.isArray(payload) ? payload : (payload?.items || []);

      // Store domain counts if provided
      if (payload?.counts) {
        setDomainCounts(payload.counts);
      }

      const byId = {};
      for (const doc of list) {
        if (doc?._id) {
          // Ensure domain is set (default to openehr for legacy docs)
          byId[doc._id] = { ...doc, domain: doc.domain || 'openehr' };
        }
      }
      setDataModelsByName(byId);
    } catch (e) {
      console.error('refreshDataModels error:', e);
      setDataModelsByName({});
      setError(e.message || 'Failed to load data models');
    } finally {
      setIsLoading(false);
    }
  }, [activeEnvironment?.id]);

  // Ensure template tree is loaded (for OpenEHR templates)
  const ensureOpenEhrTree = useCallback(async (templateId) => {
    const tpl = dataModelsByName?.[templateId];
    if (tpl?.webTemplate?.children?.length) return tpl.webTemplate;
    if (!tpl?._id) return null;
    if (tpl?.domain && tpl.domain !== 'openehr') return null; // Only OpenEHR has webTemplate
    if (hydratingTrees.current[templateId]) return null;
    hydratingTrees.current[templateId] = true;
    try {
      const headers = activeEnvironment?.id ? { 'x-active-env': activeEnvironment.id } : undefined;
      const res = await fetch(`/api/data-model-catalog/${tpl._id}?include=tree`, { headers });
      if (!res.ok) throw new Error('Failed to fetch data model');
      const full = await res.json();
      setDataModelsByName(prev => ({ ...prev, [tpl._id]: full }));
      return full.webTemplate;
    } catch (e) {
      console.error('ensureOpenEhrTree error:', e);
      return null;
    } finally {
      delete hydratingTrees.current[templateId];
    }
  }, [dataModelsByName, activeEnvironment?.id]);

  // Ensure template data is loaded (for FHIR and Context Objects)
  const ensureDataModelData = useCallback(async (templateId) => {
    const tpl = dataModelsByName?.[templateId];
    if (tpl?.data) return tpl.data;
    if (!tpl?._id) return null;
    if (tpl?.domain === 'openehr') return null; // OpenEHR doesn't have data field
    if (hydratingData.current[templateId]) return null;
    hydratingData.current[templateId] = true;
    try {
      const headers = activeEnvironment?.id ? { 'x-active-env': activeEnvironment.id } : undefined;
      const res = await fetch(`/api/data-model-catalog/${tpl._id}?include=data`, { headers });
      if (!res.ok) throw new Error('Failed to fetch data model details');
      const full = await res.json();
      setDataModelsByName(prev => ({ ...prev, [tpl._id]: full }));
      return full.data;
    } catch (e) {
      console.error('ensureDataModelData error:', e);
      return null;
    } finally {
      delete hydratingData.current[templateId];
    }
  }, [dataModelsByName, activeEnvironment?.id]);

  // reload on env change
  useEffect(() => {
    setDataModelsByName({});
    setDomainCounts({ openehr: 0, fhir: 0, contextobject: 0 });
    refreshDataModels();
  }, [refreshDataModels]);

  const value = {
    dataModelsByName,
    refreshDataModels,
    ensureOpenEhrTree,
    ensureDataModelData,
    domainCounts,
    isLoading,
    error,
    activeEnvironment
  };

  return <DataModelsCtx.Provider value={value}>{children}</DataModelsCtx.Provider>;
}

export const useDataModels = () => {
  const ctx = useContext(DataModelsCtx);
  if (!ctx) throw new Error('useDataModels must be used within a DataModelProvider');
  return ctx;
};
