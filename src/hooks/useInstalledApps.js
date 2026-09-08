// src/hooks/useInstalledApps.js
"use client";

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'hdl_installed_apps';

/**
 * Hook for tracking installed apps
 * Stores install status in localStorage (V1 - backend persistence later)
 */
export function useInstalledApps() {
  const [installedApps, setInstalledApps] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Load installed apps from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setInstalledApps(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load installed apps:', error);
    }
    setIsLoaded(true);
  }, []);

  // Mark an app as installed
  const markInstalled = useCallback((appId, notes = '') => {
    setInstalledApps(prev => {
      const newApps = {
        ...prev,
        [appId]: {
          installedAt: new Date().toISOString(),
          notes
        }
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newApps));
      } catch (error) {
        console.error('Failed to save installed apps:', error);
      }

      return newApps;
    });
  }, []);

  // Mark an app as uninstalled
  const markUninstalled = useCallback((appId) => {
    setInstalledApps(prev => {
      const newApps = { ...prev };
      delete newApps[appId];

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newApps));
      } catch (error) {
        console.error('Failed to save installed apps:', error);
      }

      return newApps;
    });
  }, []);

  // Check if an app is installed
  const isInstalled = useCallback((appId) => {
    return !!installedApps[appId];
  }, [installedApps]);

  // Get install info for an app
  const getInstallInfo = useCallback((appId) => {
    return installedApps[appId] || null;
  }, [installedApps]);

  // Get list of installed app IDs
  const getInstalledIds = useCallback(() => {
    return Object.keys(installedApps);
  }, [installedApps]);

  // Get count of installed apps
  const getInstalledCount = useCallback(() => {
    return Object.keys(installedApps).length;
  }, [installedApps]);

  // Update notes for an installed app
  const updateNotes = useCallback((appId, notes) => {
    if (!installedApps[appId]) return;

    setInstalledApps(prev => {
      const newApps = {
        ...prev,
        [appId]: {
          ...prev[appId],
          notes
        }
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newApps));
      } catch (error) {
        console.error('Failed to save installed apps:', error);
      }

      return newApps;
    });
  }, [installedApps]);

  return {
    installedApps,
    isLoaded,
    markInstalled,
    markUninstalled,
    isInstalled,
    getInstallInfo,
    getInstalledIds,
    getInstalledCount,
    updateNotes
  };
}
