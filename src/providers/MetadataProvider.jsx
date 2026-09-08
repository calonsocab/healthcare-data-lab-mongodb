"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAQLQueries } from '@/providers/AQLQueryProvider';

const MetadataContext = createContext(null);

// Owns the tags + folders state that was previously fetched per-consumer.
// Shape returned by useMetadata() is preserved so existing call sites keep
// working without edits.
export const MetadataProvider = ({ children }) => {
  const [metadata, setMetadata] = useState({ tags: [], folders: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { queries: cachedQueries, saveQuery, getQueriesByFolder, getQueriesByTag } = useAQLQueries();

  const loadMetadata = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tags, folders] = await Promise.all([
        fetch('/api/metadata?category=tags').then(res => res.ok ? res.json() : []),
        fetch('/api/metadata?category=folders').then(res => res.ok ? res.json() : [])
      ]);
      setMetadata({ tags, folders });
    } catch (err) {
      console.error('Error loading metadata:', err);
      setError('Failed to load metadata');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Silent revalidation on window focus, matching the other providers.
  useEffect(() => {
    const handleFocus = () => loadMetadata();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadMetadata]);

  const createTag = useCallback(async (tagName) => {
    if (!tagName.trim()) return null;
    try {
      const response = await fetch('/api/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tagName, category: 'tags' }),
      });
      if (response.ok) {
        const newTag = await response.json();
        await loadMetadata();
        return newTag;
      }
    } catch (err) {
      console.error('Error creating tag:', err);
    }
    return null;
  }, [loadMetadata]);

  const updateTag = useCallback(async (tag) => {
    if (!tag?._id) return;
    try {
      const response = await fetch('/api/metadata', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tag),
      });
      if (response.ok) await loadMetadata();
    } catch (err) {
      console.error('Error updating tag:', err);
    }
  }, [loadMetadata]);

  const deleteTag = useCallback(async (tagId) => {
    try {
      const response = await fetch('/api/metadata', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: tagId, category: 'tags' }),
      });
      if (response.ok) await loadMetadata();
    } catch (err) {
      console.error('Error deleting tag:', err);
    }
  }, [loadMetadata]);

  const createFolder = useCallback(async (folderPath) => {
    if (!folderPath.trim()) return null;
    try {
      const response = await fetch('/api/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: folderPath, category: 'folders' }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to create folder');
      }
      await loadMetadata();
      return payload?.item || payload;
    } catch (err) {
      console.error('Error creating folder:', err);
      throw err;
    }
  }, [loadMetadata]);

  const updateFolder = useCallback(async (folder) => {
    if (!folder?._id) return;
    try {
      const response = await fetch('/api/metadata', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(folder),
      });
      if (response.ok) await loadMetadata();
    } catch (err) {
      console.error('Error updating folder:', err);
    }
  }, [loadMetadata]);

  const deleteFolder = useCallback(async (folderId) => {
    try {
      const response = await fetch('/api/metadata', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: folderId, category: 'folders' }),
      });
      if (response.ok) await loadMetadata();
    } catch (err) {
      console.error('Error deleting folder:', err);
    }
  }, [loadMetadata]);

  const getQueriesUsingMetadata = useCallback(async (metadataId, category) => {
    if (category === 'folders') return getQueriesByFolder(metadataId);
    if (category === 'tags') {
      const tag = metadata.tags.find(t => t._id === metadataId);
      return tag ? getQueriesByTag(tag.name) : [];
    }
    return [];
  }, [metadata.tags, getQueriesByFolder, getQueriesByTag]);

  // Writes flow through AQLQueryProvider.saveQuery so the query cache stays
  // consistent with the rename/reparent that just happened.
  const updateMetadataReferences = useCallback(async (oldId, newId, metadataType) => {
    if (oldId === newId) return [];

    try {
      const updatedQueries = [];

      for (const originalQuery of cachedQueries) {
        let needsUpdate = false;
        const query = { ...originalQuery };

        if (metadataType === 'folders' && query.folderId === oldId) {
          query.folderId = newId;
          needsUpdate = true;
        }

        if (metadataType === 'tags' && Array.isArray(query.tags)) {
          const oldTag = metadata.tags.find(t => t._id === oldId);
          const newTag = metadata.tags.find(t => t._id === newId);

          if (oldTag && newTag) {
            const oldTagName = oldTag.name;
            const newTagName = newTag.name;

            if (query.tags.some(t =>
              (typeof t === 'string' && t === oldTagName) ||
              (typeof t === 'object' && t?.name === oldTagName)
            )) {
              query.tags = query.tags.map(t => {
                const tagName = typeof t === 'string' ? t : t?.name;
                return tagName === oldTagName ? newTagName : tagName;
              });
              needsUpdate = true;
            }
          }
        }

        if (needsUpdate) {
          const saved = await saveQuery(query);
          if (saved) updatedQueries.push(saved);
        }
      }

      return updatedQueries;
    } catch (err) {
      console.error('Error updating metadata references:', err);
      return [];
    }
  }, [cachedQueries, metadata.tags, saveQuery]);

  const actions = useMemo(() => ({
    createTag,
    updateTag,
    deleteTag,
    createFolder,
    deleteFolder,
    updateFolder,
    getQueriesUsingMetadata,
    updateMetadataReferences,
  }), [
    createTag, updateTag, deleteTag,
    createFolder, updateFolder, deleteFolder,
    getQueriesUsingMetadata, updateMetadataReferences,
  ]);

  const value = useMemo(() => ({
    metadata,
    loading,
    error,
    reloadMetadata: loadMetadata,
    actions,
  }), [metadata, loading, error, loadMetadata, actions]);

  return (
    <MetadataContext.Provider value={value}>
      {children}
    </MetadataContext.Provider>
  );
};

export const useMetadataContext = () => {
  const ctx = useContext(MetadataContext);
  if (!ctx) throw new Error('useMetadata must be used within a MetadataProvider');
  return ctx;
};
