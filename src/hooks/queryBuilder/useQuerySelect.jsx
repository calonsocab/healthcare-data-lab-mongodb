// //hooks/queryBuilder/useQuerySelect.jsx
"use client";

import { useCallback, useMemo } from 'react';

const RESERVED = new Set([
  'data', 'items', 'events', 'protocol', 'state', 'context', 'other_context',
  'content', 'tree', 'value'
]);

const slug = (s) =>
  (s || '')
    .toString()
    .normalize('NFKD')
    .replace(/[^\w\s\-]+/g, '')       // drop non word/space
    .replace(/[\s\-]+/g, '_')         // spaces/dashes -> _
    .replace(/^_+|_+$/g, '')          // trim _
    .toLowerCase();

const lastToken = (aqlPath) => {
  const parts = (aqlPath || '').replace(/^\/+/, '').split('/');
  if (!parts.length) return '';
  return (parts[parts.length - 1] || '').split('[')[0] || '';
};

const firstToken = (aqlPath) => {
  const parts = (aqlPath || '').replace(/^\/+/, '').split('/');
  if (!parts.length) return '';
  return (parts[0] || '').split('[')[0] || '';
};

const pickMainToken = (aqlPath) => {
  const parts = (aqlPath || '').replace(/^\/+/, '').split('/').map(p => p.split('[')[0]);
  // choose the rightmost non-reserved token if any
  for (let i = parts.length - 1; i >= 0; i--) {
    const t = parts[i];
    if (t && !RESERVED.has(t)) return t;
  }
  // fallback to last non-empty or first
  return parts[parts.length - 1] || parts[0] || '';
};

const makeUnique = (base, existing) => {
  let b = base || 'col';
  if (!/^[a-zA-Z]/.test(b)) b = `col_${b}`;
  let name = b;
  let n = 2;
  while (existing.has(name)) {
    name = `${b}_${n++}`;
  }
  return name;
};

const autoAliasFromNode = (templateName, node, existingAliases) => {
  // Prefer localized/name when present
  const label =
    node?.localizedName ||
    node?.localizedNames?.en ||
    node?.name ||
    '';

  const aql = node?.aqlPath || '';
  const first = firstToken(aql);
  const main = pickMainToken(aql);
  const last = lastToken(aql);

  // Compose something humanish:
  // e.g. alcohol/.../value -> alcohol_value
  //      result/category   -> result_category
  //      result/.../magnitude -> result_magnitude
  let base =
    slug(label) ||
    slug([first, last].filter(Boolean).join('_')) ||
    slug(main) ||
    'col';

  return makeUnique(base, existingAliases);
};

export const useQuerySelect = (queryState, setQueryState) => {
  const addSelectNode = useCallback((templateName, node, variableName = null) => {
    setQueryState((prev) => {
      // whole object (variable)
      if (variableName) {
        return {
          ...prev,
          select: [...prev.select, { type: 'variable', variable: variableName, alias: '' }]
        };
      }

      // path selection -> auto alias
      const existingAliases = new Set(prev.select.map(i => i.alias).filter(Boolean));
      const alias = autoAliasFromNode(templateName, node, existingAliases);

      return {
        ...prev,
        select: [...prev.select, {
          template: templateName,
          node,
          alias,
          type: 'path'
        }]
      };
    });
  }, [setQueryState]);

  const removeSelectNode = useCallback((index) => {
    setQueryState((prev) => ({
      ...prev,
      select: prev.select.filter((_, i) => i !== index)
    }));
  }, [setQueryState]);

  const getContainmentVariables = useMemo(() => {
    return queryState.contains.map(item => ({
      alias: item.alias,
      rmType: item.node.rmType,
      template: item.template,
      nodeId: item.node.nodeId
    })).filter(item => item.alias);
  }, [queryState.contains]);

  const updateSelectAlias = useCallback((index, alias) => {
    setQueryState((prev) => ({
      ...prev,
      select: prev.select.map((item, i) =>
        i === index ? { ...item, alias } : item
      )
    }));
  }, [setQueryState]);

  const addFunction = useCallback((functionConfig) => {
    setQueryState((prev) => {
      const existingAliases = new Set(prev.select.map(i => i.alias).filter(Boolean));

      // base alias from function name (and last token of argument if present)
      let base = (functionConfig.functionType || 'fn').toLowerCase();
      if (functionConfig.argument && functionConfig.argument !== '*') {
        const tail = slug(functionConfig.argument.split('/').pop());
        if (tail) base = `${base}_${tail}`;
      }
      const alias = functionConfig.alias || makeUnique(base, existingAliases);

      return {
        ...prev,
        select: [...prev.select, {
          type: 'function',
          functionType: functionConfig.functionType,
          argument: functionConfig.argument,
          alias
        }]
      };
    });
  }, [setQueryState]);

  const addLiteral = useCallback((literalConfig) => {
    setQueryState((prev) => {
      const existingAliases = new Set(prev.select.map(i => i.alias).filter(Boolean));
      const kind = (literalConfig.literalType || 'val').toLowerCase();
      const base = slug(kind);
      const alias = literalConfig.alias || makeUnique(base, existingAliases);

      return {
        ...prev,
        select: [...prev.select, {
          type: 'literal',
          literalType: literalConfig.literalType,
          value: literalConfig.value,
          alias
        }]
      };
    });
  }, [setQueryState]);

  return {
    addSelectNode,
    removeSelectNode,
    updateSelectAlias,
    addFunction,
    addLiteral,
    getContainmentVariables
  };
};