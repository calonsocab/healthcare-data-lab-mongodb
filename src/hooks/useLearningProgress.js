// src/hooks/useLearningProgress.js
"use client";

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'hdl_learning_progress';

/**
 * Hook for tracking learning module progress
 * Stores progress in localStorage
 */
export function useLearningProgress() {
  const [progress, setProgress] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load progress from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setProgress(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load learning progress:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save progress to localStorage
  const saveProgress = useCallback((newProgress) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
      setProgress(newProgress);
    } catch (error) {
      console.error('Failed to save learning progress:', error);
    }
  }, []);

  // Mark a step as complete
  const markStepComplete = useCallback((moduleId, stepId) => {
    setProgress(prev => {
      const moduleProgress = prev[moduleId] || { completedSteps: [], lastAccess: null };
      const completedSteps = moduleProgress.completedSteps.includes(stepId)
        ? moduleProgress.completedSteps
        : [...moduleProgress.completedSteps, stepId];

      const newProgress = {
        ...prev,
        [moduleId]: {
          ...moduleProgress,
          completedSteps,
          lastAccess: new Date().toISOString()
        }
      };

      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
      } catch (error) {
        console.error('Failed to save progress:', error);
      }

      return newProgress;
    });
  }, []);

  // Mark a step as incomplete
  const markStepIncomplete = useCallback((moduleId, stepId) => {
    setProgress(prev => {
      const moduleProgress = prev[moduleId] || { completedSteps: [], lastAccess: null };
      const completedSteps = moduleProgress.completedSteps.filter(id => id !== stepId);

      const newProgress = {
        ...prev,
        [moduleId]: {
          ...moduleProgress,
          completedSteps,
          lastAccess: new Date().toISOString()
        }
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
      } catch (error) {
        console.error('Failed to save progress:', error);
      }

      return newProgress;
    });
  }, []);

  // Get progress for a specific module
  const getModuleProgress = useCallback((moduleId, totalSteps) => {
    const moduleProgress = progress[moduleId] || { completedSteps: [], lastAccess: null };
    const completedCount = moduleProgress.completedSteps.length;
    const percentage = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;

    return {
      completedSteps: moduleProgress.completedSteps,
      completedCount,
      totalSteps,
      percentage,
      isComplete: completedCount >= totalSteps,
      lastAccess: moduleProgress.lastAccess
    };
  }, [progress]);

  // Check if a step is complete
  const isStepComplete = useCallback((moduleId, stepId) => {
    const moduleProgress = progress[moduleId] || { completedSteps: [] };
    return moduleProgress.completedSteps.includes(stepId);
  }, [progress]);

  // Get overall progress across all modules
  const getOverallProgress = useCallback((modules) => {
    let totalSteps = 0;
    let completedSteps = 0;

    modules.forEach(module => {
      totalSteps += module.steps?.length || 0;
      const moduleProgress = progress[module.id] || { completedSteps: [] };
      completedSteps += moduleProgress.completedSteps.length;
    });

    const percentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    return {
      completedSteps,
      totalSteps,
      percentage,
      modulesStarted: Object.keys(progress).length
    };
  }, [progress]);

  // Reset progress for a module
  const resetModuleProgress = useCallback((moduleId) => {
    setProgress(prev => {
      const newProgress = { ...prev };
      delete newProgress[moduleId];

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newProgress));
      } catch (error) {
        console.error('Failed to save progress:', error);
      }

      return newProgress;
    });
  }, []);

  // Reset all progress
  const resetAllProgress = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setProgress({});
    } catch (error) {
      console.error('Failed to reset progress:', error);
    }
  }, []);

  return {
    progress,
    isLoaded,
    markStepComplete,
    markStepIncomplete,
    getModuleProgress,
    isStepComplete,
    getOverallProgress,
    resetModuleProgress,
    resetAllProgress
  };
}
