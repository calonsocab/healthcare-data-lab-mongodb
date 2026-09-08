//hooks/queryBuilder/useQueryOrderBy.jsx
"use client";

import { useCallback } from 'react';

export const useQueryOrderBy = (queryState, setQueryState) => {
  const addOrderByItem = useCallback((templateName, node) => {
    setQueryState((prev) => ({
      ...prev,
      orderBy: [
        ...prev.orderBy,
        { template: templateName, node, direction: "ASC" }
      ]
    }));
  }, [setQueryState]);

  const removeOrderByItem = useCallback((index) => {
    setQueryState((prev) => ({
      ...prev,
      orderBy: prev.orderBy.filter((_, i) => i !== index)
    }));
  }, [setQueryState]);

  const updateOrderDirection = useCallback((index, direction) => {
    setQueryState((prev) => ({
      ...prev,
      orderBy: prev.orderBy.map((item, i) =>
        i === index ? { ...item, direction } : item
      )
    }));
  }, [setQueryState]);

  return {
    addOrderByItem,
    removeOrderByItem,
    updateOrderDirection
  };
};