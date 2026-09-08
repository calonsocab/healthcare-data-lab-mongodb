// src/providers/QueryBuilderProvider.jsx
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback
} from 'react';
import { useQueryBuilder } from '@/hooks/queryBuilder/useQueryBuilder';
import { useDataModels } from './DataModelProvider';

const QueryBuilderContext = createContext(null);

export const QueryBuilderProvider = ({ children, activeEnvironment }) => {
  const queryBuilderState = useQueryBuilder();

  const {
    dataModelsByName: templatesById,
    refreshDataModels: refreshTemplatesIndex,
    ensureOpenEhrTree,
    isLoading: isLoadingTemplates,
    error: templatesError
  } = useDataModels();

  const [templateRegistry, setTemplateRegistry] = useState({});
  const [environmentData, setEnvironmentData] = useState({
    templates: {},
    queries: [],
    mappings: []
  });

  const templatesByDisplayName = useMemo(() => {
    const map = {};
    Object.values(templatesById || {}).forEach(doc => {
      const name =
        doc?.name ||
        doc?.metadata?.templateId ||
        doc?.webTemplate?.name ||
        doc?._id;
      if (name) map[name] = doc;
    });
    return map;
  }, [templatesById]);

  const ensureTreeById = useCallback((id) => ensureOpenEhrTree(id), [ensureOpenEhrTree]);
  const ensureTreeByName = useCallback((name) => {
    const doc = templatesByDisplayName[name];
    return doc?._id ? ensureOpenEhrTree(doc._id) : null;
  }, [templatesByDisplayName, ensureOpenEhrTree]);

  // Reset env-specific state and load template index on environment change
  useEffect(() => {
    setEnvironmentData({ templates: {}, queries: [], mappings: [] });
    setTemplateRegistry({});
    queryBuilderState.resetQueryBuilder?.();
    refreshTemplatesIndex();
  }, [activeEnvironment?.id, refreshTemplatesIndex]);


  const value = {
    // templates & registry
    cachedTemplates: templatesByDisplayName,
    ...queryBuilderState,
    templateRegistry,
    setTemplateRegistry,
    // hydration helpers / state
    ensureTemplateTree: ensureTreeById,
    ensureTreeById,
    ensureTreeByName,
    // list loading state
    isLoadingTemplates,
    templatesError,
    refreshTemplatesIndex,

    // env state
    activeEnvironment,
    environmentData,
    setEnvironmentData,
  }

  return (
    <QueryBuilderContext.Provider value={value}>
      {children}
    </QueryBuilderContext.Provider>
  );
};

export const useQueryBuilderContext = () => {
  const ctx = useContext(QueryBuilderContext);
  if (!ctx) throw new Error('useQueryBuilderContext must be used within a QueryBuilderProvider');
  return ctx;
};
