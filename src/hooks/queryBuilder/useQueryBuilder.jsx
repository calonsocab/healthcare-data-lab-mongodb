//hooks/queryBuilder/useQueryBuilder.jsx
"use client";

import { useState, useCallback, useMemo } from "react";
import { useDataModels } from "@/providers/DataModelProvider";
import { useQuerySelect } from "./useQuerySelect";
import { useQueryFrom } from "./useQueryFrom";
import { useQueryWhere } from "./useQueryWhere";
import { useQueryOrderBy } from "./useQueryOrderBy";
import { useQueryReturn } from "./useQueryReturn";
import { useQueryValidation } from "./useQueryValidation";
import { generateQueryString } from "./useQueryGeneration";
import {createUpdateLogicalOperator, buildContainsClause } from "./utils/logicalOperator";
import { buildNodePath } from "./utils/pathUtils";
import { RM_TYPES } from "@/lib/aqlLexicon";

export const useQueryBuilder = () => {
  // 1) Templates come from the DataModelProvider
  const {
    dataModelsByName,
    isLoading: isLoadingTemplates,
    error: templatesError,
    ensureOpenEhrTree,
    refreshDataModels: refreshDataModelsIndex,
  } = useDataModels();

  const templateList = useMemo(
    () => Object.values(dataModelsByName || {}),
    [dataModelsByName]
  );

  // 2) Core QB state
  const [activeTemplates, setActiveTemplates] = useState([]);
  const [mappingDefinitions, setMappingDefinitions] = useState({});
  const [queryState, setQueryState] = useState({
    select: [],
    from: [],
    contains: [],
    where: [],
    orderBy: [],
    limit: "",
    offset: "",
  });
  const [expandedSections, setExpandedSections] = useState({
    from: true,
    select: false,
    where: false,
    orderBy: false,
    returnOptions: false,
  });
  const [useDistinct, setUseDistinct] = useState(false);

  // 3) Compose with feature-specific hooks
  const selectOperations = useQuerySelect(queryState, setQueryState);
  const fromOperations = useQueryFrom(queryState, setQueryState);
  const whereOperations = useQueryWhere(queryState, setQueryState);
  const orderByOperations = useQueryOrderBy(queryState, setQueryState);
  const returnOperations = useQueryReturn(queryState, setQueryState);
  const validationOperations = useQueryValidation(queryState, activeTemplates);
  const updateLogicalOperator = createUpdateLogicalOperator(setQueryState); 
  const availableRMTypes = useMemo(() => RM_TYPES, []);

  // 4) Template helpers (QB-local) that *use* DataModelProvider's data
  const getTemplate = useCallback(
    (name) => dataModelsByName?.[name] ?? null,
    [dataModelsByName]
  );

  const activateTemplate = useCallback((name) => {
    setActiveTemplates((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }, []);

  const deactivateTemplate = useCallback((name) => {
    setActiveTemplates((prev) => prev.filter((n) => n !== name));
    // Optional: prune queryState here if you need to drop clauses that reference the removed template.
    // If you want me to wire that in, I can add safe filters for select/from/where/orderBy.
  }, []);

  const toggleTemplate = useCallback((name) => {
    setActiveTemplates((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }, []);

  // 5) UI helpers
  const toggleSection = useCallback((section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const toggleSectionExclusive = useCallback((sectionName) => {
    setExpandedSections((prev) => {
      if (prev[sectionName]) return { ...prev, [sectionName]: false };
      const all = Object.keys(prev).reduce((acc, key) => {
        acc[key] = key === sectionName;
        return acc;
      }, {});
      return all;
    });
  }, []);



  const pruneStateForTemplate = useCallback((prev, templateName) => {
    // 1) which indices in contains belong to this template (and their descendants)?
    const toRemove = new Set();
    prev.contains.forEach((n, i) => { if (n.template === templateName) toRemove.add(i); });
    // collect descendants
    let changed = true;
    while (changed) {
      changed = false;
      prev.contains.forEach((n, i) => {
        if (!toRemove.has(i) && n.parentIndex != null && toRemove.has(n.parentIndex)) {
          toRemove.add(i); changed = true;
        }
      });
    }
    // aliases that disappear (used to filter SELECT/WHERE/ORDER BY by variable ref)
    const removedAliases = new Set(
      prev.contains.filter((_, i) => toRemove.has(i)).map(n => n.alias).filter(Boolean)
    );

    // 2) filter contains, then remap parentIndex
    const keptContains = prev.contains.filter((_, i) => !toRemove.has(i));
    const oldToNew = new Map(); let next = 0;
    prev.contains.forEach((_, i) => { if (!toRemove.has(i)) oldToNew.set(i, next++); });
    const remappedContains = keptContains.map(n => {
      if (n.parentIndex == null) return n;
      if (!oldToNew.has(n.parentIndex)) return { ...n, parentIndex: null, isRoot: true };
      return { ...n, parentIndex: oldToNew.get(n.parentIndex) };
    });

    // 3) filter SELECT
    const select = (prev.select || []).filter(s => {
      if (s.template && s.template === templateName) return false;
      if (s.type === 'variable' && removedAliases.has(s.variable)) return false;
      if (typeof s.argument === 'string' && removedAliases.has(s.argument.split('/')[0])) return false;
      return true;
    });

    // 4) filter WHERE
    const where = (prev.where || []).filter(w => {
      if (w.template && w.template === templateName) return false;
      if (typeof w.path === 'string' && removedAliases.has(w.path.split('/')[0])) return false;
      return true;
    });

    // 5) filter ORDER BY
    const orderBy = (prev.orderBy || []).filter(o => {
      if (o.template && o.template === templateName) return false;
      // if an order-by uses a variable path string, guard it
      if (typeof o.path === 'string' && removedAliases.has(o.path.split('/')[0])) return false;
      return true;
    });

    // 6) filter FROM 
    const from = (prev.from || []).filter(f => f.templateId !== templateName);

    return { ...prev, select, where, orderBy, from, contains: remappedContains };
  }, []);

  // Public API used by TemplateSelector
  const addTemplate = useCallback((name) => {
    setActiveTemplates(prev => (prev.includes(name) ? prev : [...prev, name]));
  }, []);

  const removeTemplate = useCallback((name) => {
    setActiveTemplates(prev => prev.filter(n => n !== name));
    setQueryState(prev => pruneStateForTemplate(prev, name));
  }, [pruneStateForTemplate]);

  const resetQuery = useCallback(() => {
    setQueryState({
      select: [],
      contains: [],
      where: [],
      orderBy: [],
      limit: "",
      offset: "",
    });
    setExpandedSections({
      from: true,
      select: false,
      where: false,
      orderBy: false,
      returnOptions: false,
    });
  }, []);

  const generateQuery = useCallback(() => {
    return generateQueryString(queryState, activeTemplates, useDistinct);
  }, [queryState, activeTemplates, useDistinct]);



  // 6) Return combined API
  return {
    // Core state
    activeTemplates,
    setActiveTemplates, 
    addTemplate,
    removeTemplate,
    mappingDefinitions,
    setMappingDefinitions,
    queryState,
    setQueryState,
    expandedSections,
    useDistinct,
    setUseDistinct,

    // Template data & operations (from DataModelProvider)
    dataModelsByName,
    templateList,
    isLoadingTemplates,
    templatesError,
    ensureTemplateTree: ensureOpenEhrTree,
    refreshTemplatesIndex: refreshDataModelsIndex,
    getTemplate,
    activateTemplate,
    deactivateTemplate,
    toggleTemplate,

    // UI helpers
    toggleSection,
    toggleSectionExclusive,
    resetQuery,
    buildNodePath,
    buildContainsClause,

    // Ops
    ...selectOperations,
    ...fromOperations,
    ...whereOperations,
    ...orderByOperations,
    ...returnOperations,
    ...validationOperations,

    // Query generation
    generateQuery,

    // Constants
    availableRMTypes,
  };
};
