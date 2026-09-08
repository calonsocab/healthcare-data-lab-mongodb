// src/components/views/catalog/Catalog.jsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import {
  Search,
  Plus,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import DomainTabs from './DomainTabs';
import DataModelCard from './DataModelCard';
import DataModelUpload from './DataModelUpload';
import EmptyStateOnboarding from './EmptyStateOnboarding';
import { cn } from '@/lib/utils';
import { useDataModels } from '@/providers/DataModelProvider';

/**
 * Catalog - Main data models catalog component
 *
 * A domain-agnostic catalog for managing data models across
 * OpenEHR, FHIR, Context Objects, and other domains.
 */
const Catalog = ({
  onOpenBuilder,
  onViewDataModel,
  className = '',
}) => {
  const { refreshDataModels: refreshProviderDataModels } = useDataModels();
  // Data state
  const [dataModels, setDataModels] = useState([]);
  const [domainCounts, setDomainCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [activeDomain, setActiveDomain] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('name');

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  // UI state
  const [showUpload, setShowUpload] = useState(false);
  const [expandedCards, setExpandedCards] = useState({});
  const [loadingDomain, setLoadingDomain] = useState(null);
  const [notification, setNotification] = useState(null);

  /**
   * Fetch data models from API
   */
  const fetchDataModels = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sort: sortOrder,
        summary: 'true',
      });

      if (activeDomain !== 'all') {
        params.set('domain', activeDomain);
      }

      if (searchTerm) {
        params.set('search', searchTerm);
      }

      const response = await fetch(`/api/data-models?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch data models');
      }

      const data = await response.json();
      setDataModels(data.items || []);
      setTotal(data.total || 0);
      setDomainCounts(data.counts?.byDomain || {});
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, sortOrder, activeDomain, searchTerm]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchDataModels();
  }, [fetchDataModels]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [activeDomain, searchTerm]);

  /**
   * Handle domain tab change
   */
  const handleDomainChange = useCallback((domain) => {
    setActiveDomain(domain);
    setExpandedCards({});
  }, []);

  /**
   * Handle search
   */
  const handleSearch = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  /**
   * Handle delete
   */
  const handleDelete = useCallback(async (id) => {
    try {
      const response = await fetch('/api/data-models', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete');
      }

      setNotification({
        type: 'success',
        message: 'Data model deleted successfully',
      });

      // Refresh list + shared provider cache
      fetchDataModels();
      refreshProviderDataModels();
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to delete',
      });
    }
  }, [fetchDataModels, refreshProviderDataModels]);

  /**
   * Handle upload complete
   */
  const handleUploadComplete = useCallback((results) => {
    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    if (successful > 0 && failed === 0) {
      setNotification({
        type: 'success',
        message: `Successfully uploaded ${successful} data model${successful !== 1 ? 's' : ''}`,
      });
    } else if (successful > 0 && failed > 0) {
      setNotification({
        type: 'warning',
        message: `Uploaded ${successful}, failed ${failed}`,
      });
    } else if (failed > 0) {
      setNotification({
        type: 'error',
        message: `Failed to upload ${failed} file${failed !== 1 ? 's' : ''}`,
      });
    }

    setShowUpload(false);
    fetchDataModels();
    refreshProviderDataModels();
  }, [fetchDataModels, refreshProviderDataModels]);

  /**
   * Load sample data for a domain
   */
  const loadSamples = useCallback(async (domain) => {
    setLoadingDomain(domain);

    try {
      // Fetch samples from the unified sample-data-models API
      const response = await fetch(`/api/sample-data-models?domain=${domain}&limit=20`);
      if (!response.ok) throw new Error('Failed to fetch samples');

      const data = await response.json();
      const samples = data.items || [];

      if (samples.length === 0) {
        setNotification({
          type: 'info',
          message: `No ${domain} samples available yet`,
        });
        return;
      }

      let imported = 0;
      let failed = 0;

      // Import each sample as a data model
      for (const sample of samples.slice(0, 10)) {
        try {
          // Fetch full sample details
          const fullSampleRes = await fetch(`/api/sample-data-models/${sample._id}?domain=${domain}`);
          if (!fullSampleRes.ok) continue;

          const fullSample = await fullSampleRes.json();

          // Build content based on domain
          let content;
          if (domain === 'openehr') {
            content = {
              webTemplate: fullSample.domainData?.webTemplate,
              templateId: fullSample.domainData?.templateId || fullSample.name,
            };
          } else {
            content = fullSample.domainData || fullSample;
          }

          const importRes = await fetch('/api/data-models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content,
              fileName: `${fullSample.name}.json`,
              domain,
              name: fullSample.name,
              description: fullSample.description,
            }),
          });

          if (importRes.ok) {
            imported++;
          } else {
            failed++;
          }
        } catch (e) {
          console.warn('Failed to import sample:', sample.name, e);
          failed++;
        }
      }

      if (imported > 0) {
        setNotification({
          type: 'success',
          message: `Imported ${imported} ${domain} sample${imported !== 1 ? 's' : ''}${failed > 0 ? ` (${failed} failed)` : ''}`,
        });
      } else if (failed > 0) {
        setNotification({
          type: 'error',
          message: `Failed to import ${failed} sample${failed !== 1 ? 's' : ''}`,
        });
      }

      fetchDataModels();
      refreshProviderDataModels();
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.message || 'Failed to load samples',
      });
    } finally {
      setLoadingDomain(null);
    }
  }, [fetchDataModels, refreshProviderDataModels]);

  /**
   * Toggle card expansion
   */
  const toggleCardExpansion = useCallback((id) => {
    setExpandedCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  /**
   * Close notification
   */
  const closeNotification = useCallback(() => {
    setNotification(null);
  }, []);

  // Auto-close notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(closeNotification, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification, closeNotification]);

  // Calculate pagination
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startIdx = (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, total);

  // Check if catalog is empty
  const isEmpty = !loading && dataModels.length === 0 && !searchTerm && activeDomain === 'all';

  return (
    <div className={cn('space-y-6', className)}>
      {/* Notification */}
      {notification && (
        <div
          className={cn(
            'fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center gap-3',
            notification.type === 'success' && 'bg-success/90 text-white',
            notification.type === 'error' && 'bg-error/90 text-white',
            notification.type === 'warning' && 'bg-warning/90 text-black',
            notification.type === 'info' && 'bg-primary/90 text-white'
          )}
        >
          <span>{notification.message}</span>
          <button onClick={closeNotification}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Empty state */}
      {isEmpty ? (
        <EmptyStateOnboarding
          onLoadOpenEHRSamples={() => loadSamples('openehr')}
          onLoadFHIRSamples={() => loadSamples('fhir')}
          onLoadContextSamples={() => loadSamples('context')}
          onOpenBuilder={onOpenBuilder}
          onUpload={() => setShowUpload(true)}
          loadingDomain={loadingDomain}
        />
      ) : (
        <>
          {/* Page header */}
          <div>
            <h1 className="text-2xl font-bold text-theme-primary">Data Model Catalog</h1>
            <p className="text-sm text-theme-secondary">
              Search, filter, and manage your openEHR® templates, FHIR® resources, and ContextObjects.
            </p>
          </div>

          {/* Header */}
          <div className="flex flex-col gap-4">
            {/* Domain tabs */}
            <DomainTabs
              activeDomain={activeDomain}
              onDomainChange={handleDomainChange}
              counts={domainCounts}
              equalWidth
            />

            {/* Search and actions */}
            <div className="flex flex-wrap gap-4 items-center justify-between">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary"
                />
                <input
                  type="text"
                  placeholder="Search data models..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-theme bg-surface text-theme-primary placeholder-theme-secondary focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {/* Sort dropdown */}
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-theme bg-surface text-theme-primary"
                >
                  <option value="name">Name</option>
                  <option value="recent">Recent</option>
                  <option value="created">Created</option>
                </select>

                {/* Refresh */}
                <button
                  onClick={fetchDataModels}
                  disabled={loading}
                  className="p-2 rounded-lg border border-theme hover:bg-surface-hover text-theme-secondary"
                  title="Refresh"
                >
                  <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                </button>

                {/* Add button */}
                <button
                  onClick={() => setShowUpload(true)}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-text flex items-center gap-2 hover:bg-primary/80"
                >
                  <Plus size={18} />
                  Add Data Model
                </button>
              </div>
            </div>
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-primary" />
              <span className="ml-2 text-theme-primary">Loading data models...</span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="p-4 rounded-lg bg-error/10 border border-error text-error">
              {error}
            </div>
          )}

          {/* Data models list */}
          {!loading && !error && dataModels.length > 0 && (
            <div className="space-y-4">
              {dataModels.map((model) => (
                <DataModelCard
                  key={model._id}
                  dataModel={model}
                  expanded={expandedCards[model._id]}
                  onExpand={() => toggleCardExpansion(model._id)}
                  onDelete={handleDelete}
                  onView={() => onViewDataModel?.(model)}
                />
              ))}
            </div>
          )}

          {/* No results */}
          {!loading && !error && dataModels.length === 0 && (searchTerm || activeDomain !== 'all') && (
            <div className="text-center py-12">
              <p className="text-theme-secondary mb-4">
                No data models found matching your filters.
              </p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setActiveDomain('all');
                }}
                className="px-4 py-2 rounded-lg border border-theme hover:bg-surface-hover text-theme-primary"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* Pagination */}
          {!loading && total > limit && (
            <div className="flex items-center justify-between px-4 py-3 bg-surface border border-theme rounded-lg">
              <div className="text-sm text-theme-secondary">
                Showing <span className="font-medium text-theme-primary">{startIdx}</span> to{' '}
                <span className="font-medium text-theme-primary">{endIdx}</span> of{' '}
                <span className="font-medium text-theme-primary">{total}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded border border-theme hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={20} />
                </button>

                <span className="px-3 py-1 text-theme-primary">
                  {page} / {totalPages}
                </span>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded border border-theme hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-theme-secondary">Per page:</label>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 py-1 rounded border border-theme bg-surface text-theme-primary"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
            </div>
          )}
        </>
      )}

      {/* Upload modal */}
      {showUpload && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowUpload(false)}
        >
          <div
            className="bg-surface border border-theme rounded-lg p-6 max-w-lg w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-theme-primary">Add Data Model</h2>
              <button
                onClick={() => setShowUpload(false)}
                className="p-1 text-theme-secondary hover:text-theme-primary"
              >
                <X size={20} />
              </button>
            </div>

            <DataModelUpload
              onUpload={handleUploadComplete}
              onError={(msg) => setNotification({ type: 'error', message: msg })}
            />
          </div>
        </div>
      )}
    </div>
  );
};

Catalog.propTypes = {
  onOpenBuilder: PropTypes.func,
  onViewDataModel: PropTypes.func,
  className: PropTypes.string,
};

export default Catalog;
