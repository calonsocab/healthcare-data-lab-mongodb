// //hooks/queryBuilder/useQueryWhere.jsx
"use client";

import { useCallback } from 'react';

export const useQueryWhere = (queryState, setQueryState) => {
  const addWhereCondition = useCallback((templateName, node, specialConfig = null) => {
    setQueryState((prev) => {
      if (specialConfig) {
        // Adding EXISTS or parameter
        if (specialConfig.type === 'exists') {
          return {
            ...prev,
            where: [
              ...prev.where,
              {
                type: 'exists',
                path: specialConfig.path,
                not: specialConfig.not || false,
                groupId: prev.whereGroupActive ? prev.activeGroupId : null,
                groupLogic: prev.whereGroupActive ? prev.activeGroupLogic : null
              }
            ]
          };
        } else if (specialConfig.type === 'parameter') {
          return {
            ...prev,
            where: [
              ...prev.where,
              {
                type: 'parameter',
                name: specialConfig.name,
                groupId: prev.whereGroupActive ? prev.activeGroupId : null,
                groupLogic: prev.whereGroupActive ? prev.activeGroupLogic : null
              }
            ]
          };
        }
      }

      // Standard condition
      return {
        ...prev,
        where: [
          ...prev.where,
          {
            template: templateName,
            node,
            operator: "=",
            value: "",
            groupId: prev.whereGroupActive ? prev.activeGroupId : null,
            groupLogic: prev.whereGroupActive ? prev.activeGroupLogic : null
          }
        ]
      };
    });
  }, [setQueryState]);

  const removeWhereCondition = useCallback((index) => {
    setQueryState((prev) => ({
      ...prev,
      where: prev.where.filter((_, i) => i !== index)
    }));
  }, [setQueryState]);

  const updateWhereCondition = useCallback((index, updates) => {
    setQueryState((prev) => ({
      ...prev,
      where: prev.where.map((condition, i) =>
        i === index ? { ...condition, ...updates } : condition
      )
    }));
  }, [setQueryState]);

  const addGroup = useCallback((logic) => {
    // Generate a unique group ID
    const groupId = `group_${Date.now()}`;

    setQueryState((prev) => ({
      ...prev,
      whereGroupActive: true,
      activeGroupId: groupId,
      activeGroupLogic: logic
    }));
  }, [setQueryState]);

  const removeGroup = useCallback((groupId) => {
    setQueryState((prev) => {
      // Remove all conditions in the group
      const newConditions = prev.where.filter(condition => condition.groupId !== groupId);

      // If this was the active group, clear the active group
      const newState = {
        ...prev,
        where: newConditions
      };

      if (prev.activeGroupId === groupId) {
        newState.whereGroupActive = false;
        newState.activeGroupId = null;
        newState.activeGroupLogic = null;
      }

      return newState;
    });
  }, [setQueryState]);

  // For updating a logical group
  const updateGroup = useCallback((groupId, updates) => {
    setQueryState((prev) => {
      // Update all conditions in the group
      const newConditions = prev.where.map(condition =>
        condition.groupId === groupId
          ? { ...condition, groupLogic: updates.logic }
          : condition
      );

      return {
        ...prev,
        where: newConditions
      };
    });
  }, [setQueryState]);

  return {
    addWhereCondition,
    removeWhereCondition,
    updateWhereCondition,
    addGroup,
    removeGroup,
    updateGroup
  };
};