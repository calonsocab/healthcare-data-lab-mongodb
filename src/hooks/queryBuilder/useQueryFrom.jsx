//hooks/queryBuilder/useQueryFrom.jsx
"use client";

import { useState, useCallback } from "react";
import { isCanonicalContainment } from '@/lib/aqlLexicon/containment';

export const useQueryFrom = (queryState, setQueryState) => {
  const [fromError, setFromError] = useState(null);
  const [fromNotice, setFromNotice] = useState(null); // {text, kind:'error'|'info'|'warn', ts}

  const pushFromNotice = useCallback((text, kind='error') => {
    setFromNotice({ text, kind, ts: Date.now() });
  }, []);
  const clearFromNotice = useCallback(() => setFromNotice(null), []);

  // --- FROM templates (unchanged) ---
  const addFromTemplate = useCallback((templateId, alias) => {
    setQueryState(prev => {
      if (prev.from.find(f => f.templateId === templateId)) {
        setFromError(`Template "${templateId}" already in FROM clause.`);
        pushFromNotice(`Template "${templateId}" is already in FROM.`, 'info');
        return prev;
      }
      return { ...prev, from: [...prev.from, { templateId, alias }], contains: [] };
    });
    setFromError(null);
  }, [setQueryState, pushFromNotice]);

  const removeFromTemplate = useCallback((templateId) => {
    setQueryState(prev => ({
      ...prev,
      from: prev.from.filter(f => f.templateId !== templateId),
      contains: prev.contains.filter(c => c.template !== templateId)
    }));
  }, [setQueryState]);

  // --- EHR root helpers (unchanged behavior) ---
  const addEhrRoot = useCallback((ehrType, ehrIdValue) => {
    setQueryState(prev => {
      const hasEhrRoot = prev.contains.some(i => i.isEhrRoot);
      const finalEhrIdValue = ehrType === "population" ? "" : ehrIdValue;
      if (hasEhrRoot) {
        return {
          ...prev,
          ehrFilterType: ehrType,
          contains: prev.contains.map(i => i.isEhrRoot ? { ...i, ehrIdValue: finalEhrIdValue } : i)
        };
      }
      const ehrId = 'ehr-root';
      return {
        ...prev,
        ehrFilterType: ehrType,
        contains: [
          {
            id: ehrId,
            template: "EHR",
            node: { name: "EHR", rmType: "EHR", nodeId: "", aqlPath: "" },
            alias: "e",
            isRoot: true,
            isEhrRoot: true,
            ehrIdValue: finalEhrIdValue,
            parentIndex: null
          },
          ...prev.contains
        ]
      };
    });
  }, [setQueryState]);

  const removeEhrRoot = useCallback(() => {
    setQueryState(prev => ({ ...prev, contains: prev.contains.filter(i => !i.isEhrRoot) }));
  }, [setQueryState]);

  const updateEhrId = useCallback((newIdValue) => {
    setQueryState(prev => ({
      ...prev,
      contains: prev.contains.map(i => i.isEhrRoot ? { ...i, ehrIdValue: newIdValue } : i)
    }));
  }, [setQueryState]);

  // --- Containment helpers ---
  const isValidContainment = (parentNode, childNode) => {
    if (!parentNode || !childNode) return false;
    const pt = parentNode.rmType?.toUpperCase();
    const ct = childNode.rmType?.toUpperCase();
    if (!pt || !ct) return false;
    if (pt === 'EHR') return ct === 'COMPOSITION';
    return isCanonicalContainment(pt, ct);
  };

  const findBestParent = useCallback((containsArray, nodeType, templateName) => {
    if (!nodeType) return null;
    const ct = nodeType.toUpperCase();

    // COMPOSITION → EHR
    if (ct === 'COMPOSITION') {
      const ehrIdx = containsArray.findIndex(i => i.isEhrRoot);
      return ehrIdx !== -1 ? ehrIdx : null;
    }

    // Prefer nearest same-template container that can contain ct
    for (let i = containsArray.length - 1; i >= 0; i--) {
      const it = containsArray[i];
      const pt = it.isEhrRoot ? 'EHR' : it.node?.rmType?.toUpperCase();
      if (it.template === templateName && isCanonicalContainment(pt, ct)) return i;
    }
    // Otherwise nearest any container that can contain ct
    for (let i = containsArray.length - 1; i >= 0; i--) {
      const it = containsArray[i];
      const pt = it.isEhrRoot ? 'EHR' : it.node?.rmType?.toUpperCase();
      if (isCanonicalContainment(pt, ct)) return i;
    }
    // Fallback: none
    return null;
  }, []);

  // New: expose this to the UI to gate clicks
  const canInsert = useCallback((rmType, templateName) => {
    const idx = findBestParent(queryState.contains || [], rmType, templateName);
    return idx !== null && idx !== undefined;
  }, [queryState.contains, findBestParent]);

  const addContainsNode = useCallback((templateName, node, parentIndex, containmentType = 'simple') => {
    setQueryState(prev => {
      const uniquePath = node.aqlPath || node.nodeId || node.name || '';
      const id = node.id || `${templateName}:${uniquePath}` || crypto.randomUUID?.() || `n_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      // Duplicate?
      const exists = prev.contains.some(i =>
        i.template === templateName &&
        ((i.node?.aqlPath || i.node?.nodeId || i.node?.name) === uniquePath)
      );
      if (exists) {
        pushFromNotice("Node already exists in the hierarchy, not adding duplicate", 'info');
        return prev;
      }

      // Parent resolution
      let actualParentIndex = parentIndex;
      if (actualParentIndex == null || !prev.contains[actualParentIndex]) {
        actualParentIndex = findBestParent(prev.contains, node.rmType, templateName);
      }
      if (actualParentIndex == null) {
        pushFromNotice(`No valid parent found for ${node.rmType}. Add a COMPOSITION first.`, 'error');
        return prev;
      }

      const parentNode = prev.contains[actualParentIndex]?.node;
      if (!isValidContainment(parentNode, node)) {
        // Try once more (defensive)
        actualParentIndex = findBestParent(prev.contains, node.rmType, templateName);
        if (actualParentIndex == null || !isValidContainment(prev.contains[actualParentIndex]?.node, node)) {
          pushFromNotice(`${parentNode?.rmType || '<?>'} cannot CONTAIN ${node.rmType} per AQL RM.`, 'error');
          return prev;
        }
      }

      // Logical operator if same-level siblings of same rmType exist
      let logicalOperator = null;
      const sibs = prev.contains.filter(i => i.parentIndex === actualParentIndex && i.node?.rmType?.toUpperCase() === node.rmType?.toUpperCase());
      if (sibs.length > 0) logicalOperator = containmentType === 'or' ? 'OR' : 'AND';

      // Simple alias suggestion (optional)
      let alias = '';
      const t = (node.rmType || '').toUpperCase();
      const counts = prev.contains.reduce((acc, i) => {
        const k = (i.node?.rmType || '').toUpperCase();
        acc[k] = (acc[k] || 0) + 1; return acc;
      }, {});
      const abbr = { EHR:'e', COMPOSITION:'c', SECTION:'s', OBSERVATION:'o', EVALUATION:'ev', INSTRUCTION:'i', ACTION:'a', ADMIN_ENTRY:'ad', CLUSTER:'clu' }[t] || t.slice(0,3).toLowerCase();
      alias = counts[t] ? `${abbr}${counts[t]+1}` : abbr;

      const newItem = {
        id,
        template: templateName,
        node: { ...node, uniquePath },
        alias,
        parentIndex: actualParentIndex,
        isRoot: prev.contains[actualParentIndex]?.isEhrRoot === true, // first level under EHR
        containmentOperator: containmentType === 'not' ? 'NOT CONTAINS' : 'CONTAINS',
        logicalOperator
      };

      return { ...prev, contains: [...prev.contains, newItem] };
    });
  }, [setQueryState, findBestParent, isValidContainment, pushFromNotice]);

  const removeContainsNode = useCallback((index) => {
    setQueryState(prev => {
      const nodesToRemove = new Set([index]);
      const walk = (pIdx) => prev.contains.forEach((n, i) => { if (n.parentIndex === pIdx) { nodesToRemove.add(i); walk(i); } });
      walk(index);
      const newContains = prev.contains.filter((_, i) => !nodesToRemove.has(i));

      // re-map parentIndex after deletions
      const oldToNew = new Map();
      let next = 0;
      prev.contains.forEach((_, i) => { if (!nodesToRemove.has(i)) oldToNew.set(i, next++); });
      const remapped = newContains.map(n => {
        if (n.parentIndex == null) return n;
        if (!oldToNew.has(n.parentIndex)) return { ...n, parentIndex: null, isRoot: true };
        return { ...n, parentIndex: oldToNew.get(n.parentIndex) };
        });
      return { ...prev, contains: remapped };
    });
  }, [setQueryState]);

  const updateContainsAlias = useCallback((index, alias) => {
    setQueryState(prev => ({ ...prev, contains: prev.contains.map((n,i) => i===index ? { ...n, alias } : n) }));
  }, [setQueryState]);

  const updateLogicalOperator = useCallback((index, operator) => {
    setQueryState(prev => ({ ...prev, contains: prev.contains.map((n,i) => i===index ? { ...n, logicalOperator: operator } : n) }));
  }, [setQueryState]);

  return {
    // notices
    fromError, fromNotice, clearFromNotice,
    // FROM
    addFromTemplate, removeFromTemplate,
    // EHR root
    addEhrRoot, removeEhrRoot, updateEhrId,
    // CONTAINS
    addContainsNode, removeContainsNode, updateContainsAlias, updateLogicalOperator,
    // UI gating
    canInsert
  };
};