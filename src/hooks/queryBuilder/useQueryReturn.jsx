//hooks/queryBuilder/useQueryReturn.jsx
"use client";

import { useCallback } from 'react';

export const useQueryReturn = (queryState, setQueryState) => {
  const updateLimit = useCallback((limit) => {
    setQueryState((prev) => ({ ...prev, limit }));
  }, [setQueryState]);

  const updateOffset = useCallback((offset) => {
    setQueryState((prev) => ({ ...prev, offset }));
  }, [setQueryState]);

  return {
    updateLimit,
    updateOffset
  };
};