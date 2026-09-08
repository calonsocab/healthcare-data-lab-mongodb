// src/components/views/dataModelManagement/DataModelManagement.jsx
"use client";

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { Loader2, AlertTriangle, Database, Book, ChevronLeft, ChevronRight, Boxes, Sparkles } from 'lucide-react';
import DataModelUpload from './DataModelUpload';
import DataModelSearchFilter from './DataModelSearchFilter';
import OpenEHRTemplateList from './OpenEHRTemplateList';
import SampleDataModelsModal from './SampleDataModelsModal';
import NotificationComponent from './NotificationComponent';
import { groupTemplatesByName, groupTemplatesByComposition, collectTemplateFacets } from '@/lib/templates';
import DataModelErrorBoundary from './DataModelErrorBoundary';
import { DataModelCard } from '../catalog/DataModelCard';
import { primeDataModelSummaryList, invalidateDataModelCache } from '@/lib/data-models/clientCache';
import { useAQLQueries } from '@/providers/AQLQueryProvider';
import { useDataModels } from '@/providers/DataModelProvider';


const DataModelManagement = ({ templates = [], reloadTemplates, isLoading, onNavigate }) => {
  const normalizeImportDomain = (domain) => {
    if (domain === 'context' || domain === 'contextobject') return 'contextobject';
    if (domain === 'fhir') return 'fhir';
    return 'openehr';
  };

  const extractOpenEhrTree = (sample) => {
    const candidate =
      sample?.domainData?.webTemplate ||
      sample?.webTemplate ||
      sample?.data?.webTemplate ||
      sample?.data ||
      null;

    if (!candidate) return null;
    if (candidate?.tree && typeof candidate.tree === 'object') return candidate.tree;
    if (candidate?.webTemplate?.tree && typeof candidate.webTemplate.tree === 'object') return candidate.webTemplate.tree;
    if (candidate?.webTemplate && typeof candidate.webTemplate === 'object') return candidate.webTemplate;
    return candidate;
  };

  const extractOpenEhrSource = (sample) => {
    const sourceCandidate = sample?.domainData?.source || sample?.data?.source || sample?.source;
    if (sourceCandidate && typeof sourceCandidate === 'object' && sourceCandidate.type) {
      return sourceCandidate;
    }
    return { type: 'web' };
  };

  const extractFhirResource = (sample) => {
    if (sample?.domainData?.resource && typeof sample.domainData.resource === 'object') {
      return sample.domainData.resource;
    }
    if (sample?.data?.resource && typeof sample.data.resource === 'object') {
      return sample.data.resource;
    }
    if (sample?.data?.resourceType && typeof sample.data === 'object') {
      return sample.data;
    }
    if (sample?.domainData?.resourceType && typeof sample.domainData === 'object') {
      return sample.domainData;
    }
    return null;
  };

  const extractContextSchema = (sample) => {
    return (
      sample?.domainData?.schema ||
      sample?.data?.schema ||
      sample?.data ||
      sample?.schema ||
      null
    );
  };

  const { getTemplateUsageCounts } = useAQLQueries();
  const {
    dataModelsByName,
    domainCounts: providerDomainCounts,
    isLoading: providerLoading,
    refreshDataModels,
  } = useDataModels();

  // Domain filtering
  const [activeDomain, setActiveDomain] = useState('openehr');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('name-asc');

  // Derive the domain-scoped list from the shared cache. Filtering, searching
  // and sorting are all done client-side — no network calls when the user
  // switches tabs, types in the search box, or changes sort.
  const domainDataModels = useMemo(() => {
    const targetDomain = activeDomain === 'context' ? 'contextobject' : activeDomain;
    const term = searchTerm.trim().toLowerCase();

    const matchesSearch = (t) => {
      if (!term) return true;
      const hay = [
        t?.name,
        t?.description,
        t?.metadata?.description,
        t?.resourceType,
        t?.domainData?.resourceType,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(term);
    };

    const items = Object.values(dataModelsByName || {})
      .filter(t => (t?.domain || 'openehr') === targetDomain)
      .filter(matchesSearch);

    const getTs = (t) => Date.parse(t?.audit?.updatedAt || t?.updatedAt || t?.audit?.createdAt || t?.createdAt || '') || 0;
    const getCreated = (t) => Date.parse(t?.audit?.createdAt || t?.createdAt || '') || 0;

    if (sortOrder === 'date-desc') {
      items.sort((a, b) => getTs(b) - getTs(a));
    } else if (sortOrder === 'date-asc') {
      items.sort((a, b) => getCreated(b) - getCreated(a));
    } else {
      items.sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
    }
    return items;
  }, [dataModelsByName, activeDomain, searchTerm, sortOrder]);

  // Keep the summary-item cache primed for downstream consumers (tree hydration).
  useEffect(() => {
    if (domainDataModels.length) primeDataModelSummaryList(domainDataModels);
  }, [domainDataModels]);

  const loadingDomainModels = providerLoading;

  // OpenEHR templates now come from the shared cache via domainDataModels.
  const openEhrTemplates = useMemo(
    () => activeDomain === 'openehr' ? domainDataModels : [],
    [activeDomain, domainDataModels]
  );
  // Domain counts come from the shared DataModelProvider (single source of truth).
  const domainCounts = useMemo(() => ({
    openehr: providerDomainCounts?.openehr || 0,
    fhir: providerDomainCounts?.fhir || 0,
    context: providerDomainCounts?.contextobject || 0,
  }), [providerDomainCounts]);

  // Ask the provider to refresh its counts/cache (e.g. after upload/delete).
  const fetchCounts = useCallback(() => {
    refreshDataModels();
  }, [refreshDataModels]);

  const fetchDomainModels = refreshDataModels;

  const handleDomainChange = (domain) => {
    setActiveDomain(domain);
  };
  const [sampleTemplates, setSampleTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSamples, setLoadingSamples] = useState(false);
  const [page, setPage] = useState(1);
  const [templatesPerPage, setTemplatesPerPage] = useState(10);
  const [showSampleTemplates, setShowSampleTemplates] = useState(false);
  const [isImportingSample, setIsImportingSample] = useState(false);
  const [templatesWithAQLs, setTemplatesWithAQLs] = useState({});
  const [notification, setNotification] = useState({
    type: null,
    message: '',
    details: [],
    visible: false
  });

  // Filter state
  const [groupingMode, setGroupingMode] = useState('none');
  const [selectedArchetypes, setSelectedArchetypes] = useState([]);
  const [selectedCompositions, setSelectedCompositions] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [selectedTerminologies, setSelectedTerminologies] = useState([]);
  const [hasOptFilter, setHasOptFilter] = useState(false);
  const [hasAqlFilter, setHasAqlFilter] = useState(false);

  // Build facets from current templates
  const facets = useMemo(() => collectTemplateFacets(openEhrTemplates || []), [openEhrTemplates]);

  const toggleMulti = (prev, valueOrArray) => {
    if (Array.isArray(valueOrArray)) return [];
    const v = valueOrArray;
    return prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v];
  };

  const handleLanguageSelect = (v) => setSelectedLanguages(prev => toggleMulti(prev, v));
  const handleTerminologySelect = (v) => setSelectedTerminologies(prev => toggleMulti(prev, v));

  const [expandedGroups, setExpandedGroups] = useState({});
  const [uploadingTotal, setUploadingTotal] = useState(0);
  const [uploadingDone, setUploadingDone] = useState(0);

  const [lastNotificationTime, setLastNotificationTime] = useState(0);

  // Functions for notification handling
  const showNotification = (type, message, details = []) => {
    if (
      notification.visible &&
      notification.type === 'success' &&
      type === 'error' &&
      Date.now() - lastNotificationTime < 2000
    ) {
      return;
    }

    setLastNotificationTime(Date.now());
    setNotification({
      type,
      message,
      details,
      visible: true
    });
  };

  const clearNotification = () => {
    setNotification(prev => ({
      ...prev,
      visible: false
    }));
  };

  useEffect(() => {
    if (!isLoading) setLoading(false);
  }, [isLoading, templates?.length]);

  // Template import handling functions
  const handleSampleImport = async (templateList) => {
    if (!templateList || templateList.length === 0) return;

    try {
      setIsImportingSample(true);

      const results = {
        success: [],
        skipped: []
      };

      for (const template of templateList) {
        const templateDomain = normalizeImportDomain(template.domain || 'openehr');
        const existingTemplate = templates.find(
          (t) => t.name === template.name && normalizeImportDomain(t.domain || 'openehr') === templateDomain
        );

        if (existingTemplate) {
          results.skipped.push({
            name: template.name,
            reason: 'already exists'
          });
          continue;
        }

        const domain = templateDomain;
        let templateData;

        if (domain === 'contextobject') {
          const schema = extractContextSchema(template);
          if (!schema) {
            results.skipped.push({
              name: template.name,
              reason: 'missing context schema in sample payload'
            });
            continue;
          }
          templateData = {
            name: template.name,
            domain: 'contextobject',
            description: template.description || schema?.description || '',
            domainData: {
              schema,
              source: (template?.domainData?.source && typeof template.domainData.source === 'object')
                ? template.domainData.source
                : { type: 'json' }
            }
          };
        } else if (domain === 'fhir') {
          const resource = extractFhirResource(template);
          const resourceType =
            resource?.resourceType ||
            template?.domainData?.resourceType ||
            template?.resourceType ||
            'Unknown';
          if (!resource) {
            results.skipped.push({
              name: template.name,
              reason: 'missing FHIR resource in sample payload'
            });
            continue;
          }
          templateData = {
            name: template.name,
            domain: 'fhir',
            description: template.description || '',
            domainData: {
              resourceType,
              resource,
              source: (template?.domainData?.source && typeof template.domainData.source === 'object')
                ? template.domainData.source
                : { type: 'json' }
            }
          };
        } else {
          const tree = extractOpenEhrTree(template);
          if (!tree) {
            results.skipped.push({
              name: template.name,
              reason: 'missing OpenEHR web template in sample payload'
            });
            continue;
          }
          templateData = {
            name: template.name,
            domain: 'openehr',
            metadata: template.metadata || {},
            domainData: {
              webTemplate: tree,
              source: extractOpenEhrSource(template)
            }
          };
        }

        const response = await fetch('/api/data-model-catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(templateData)
        });

        if (response.ok) {
          results.success.push({
            name: template.name
          });
        } else {
          const errorData = await response.json();
          results.skipped.push({
            name: template.name,
            reason: errorData.message || errorData.error || 'API error'
          });
        }
      }

      setShowSampleTemplates(false);

      if (results.success.length > 0 && results.skipped.length > 0) {
        showNotification(
          'info',
          `Imported ${results.success.length} data model(s), skipped ${results.skipped.length} data model(s).`,
          [
            ...results.success.map(t => `✓ ${t.name}`),
            ...results.skipped.map(t => `! ${t.name} (${t.reason})`)
          ]
        );
      } else if (results.success.length > 0) {
        showNotification(
          'success',
          `Successfully imported ${results.success.length} data model(s).`,
          results.success.map(t => `✓ ${t.name}`)
        );
      } else if (results.skipped.length > 0) {
        showNotification(
          'info',
          `Skipped ${results.skipped.length} data model(s).`,
          results.skipped.map(t => `! ${t.name} (${t.reason})`)
        );
      }

      await reloadTemplatesPreservingUI();

    } catch (error) {
      console.error("Error importing data models:", error);
      showNotification('error', `Error importing data models: ${error.message}`);
    } finally {
      setIsImportingSample(false);
    }
  };

  const reloadTemplatesPreservingUI = async () => {
    try {
      // Refresh both the external templates and internal domain models
      await Promise.all([
        reloadTemplates(),
        fetchDomainModels(),
        fetchCounts(),
      ]);
    } catch (error) {
      console.error("Error reloading data models:", error);
      if (!notification.visible) showNotification('error', `Error refreshing data models: ${error.message}`);
    }
  };

  const archetypeOptions = useMemo(() => {
    const map = new Map();
    (openEhrTemplates || []).forEach(t => {
      (t?.metadata?.archetypes || []).forEach(a => {
        if (a?.nodeId && !map.has(a.nodeId)) map.set(a.nodeId, a.name || a.nodeId);
      });
    });
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [openEhrTemplates]);

  const compositionOptions = useMemo(() => {
    const map = new Map();
    (openEhrTemplates || []).forEach(t => {
      const id = t?.webTemplate?.nodeId || t?.metadata?.node;
      const label = t?.webTemplate?.name || t?.metadata?.templateId || id;
      if (id && !map.has(id)) map.set(id, label || id);
    });
    return [...map.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [openEhrTemplates]);

  const templateGroups = useMemo(() => {
    if (groupingMode === 'name') {
      return groupTemplatesByName(openEhrTemplates);
    } else if (groupingMode === 'composition') {
      return groupTemplatesByComposition(openEhrTemplates);
    }
    return null;
  }, [openEhrTemplates, groupingMode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const templateId = params.get('template');

      if (templateId) {
        const targetTemplate = openEhrTemplates.find(t => t._id === templateId);
        if (targetTemplate) {
          const element = document.getElementById(`template-${templateId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    }
  }, [openEhrTemplates]);

  useEffect(() => {
    if (!openEhrTemplates?.length) {
      setTemplatesWithAQLs({});
      return;
    }
    // Derived from the shared AQL-queries cache — no network call.
    const ids = openEhrTemplates.map(t => t._id);
    setTemplatesWithAQLs(getTemplateUsageCounts(ids));
  }, [openEhrTemplates, getTemplateUsageCounts]);

  const registerTemplateWithAQL = useCallback((templateId, count) => {
    if (templateId && count !== undefined) {
      setTemplatesWithAQLs(prev => ({
        ...prev,
        [templateId]: count
      }));
    }
  }, []);

  const fetchSampleTemplates = async () => {
    if (sampleTemplates.length > 0) {
      setShowSampleTemplates(true);
      return;
    }

    try {
      setLoadingSamples(true);
      clearNotification();

      // Fetch OpenEHR samples from unified sample-data-models API
      const res = await fetch('/api/sample-data-models?domain=openehr&limit=200');
      if (!res.ok) {
        throw new Error("Failed to fetch sample data models");
      }

      const data = await res.json();
      // Transform to expected format for SampleDataModelsModal
      const templates = (data.items || []).map(item => ({
        _id: item._id,
        name: item.name,
        metadata: item.metadata,
        source: item.domainData?.source || item.source || { type: 'opt' },
        audit: item.audit,
      }));
      setSampleTemplates(templates);
      setShowSampleTemplates(true);
    } catch (err) {
      console.error("Error fetching sample data models:", err);
      showNotification('error', `Failed to load sample data models: ${err.message}`);
    } finally {
      setLoadingSamples(false);
    }
  };

  const handleSearch = (query) => {
    setSearchTerm(query);
    setPage(1);
  };

  const handleUpload = async (newTemplates) => {
    setUploadingTotal(newTemplates.length);
    setUploadingDone(0);
    
    try {
      const results = {
        success: [],
        skipped: []
      };

      for (const template of newTemplates) {
        const templateDomain = template.domain || 'openehr';
        const existingTemplate = templates.find(
          (t) => t.name === template.name && (t.domain || 'openehr') === templateDomain
        );

        if (existingTemplate) {
          results.skipped.push({
            name: template.name,
            reason: 'already exists'
          });
          setUploadingDone((n) => n + 1);
          continue;
        }

        const response = await fetch('/api/data-model-catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(template)
        });

        if (response.ok) {
          results.success.push({
            name: template.name
          });
        } else {
          const errorData = await response.json();
          results.skipped.push({
            name: template.name,
            reason: errorData.message || 'API error'
          });
        }
        setUploadingDone((n) => n + 1);
      }

      if (results.success.length > 0 && results.skipped.length > 0) {
        showNotification(
          'info',
          `Uploaded ${results.success.length} data model(s), skipped ${results.skipped.length} data model(s).`,
          [
            ...results.success.map(t => `✓ ${t.name}`),
            ...results.skipped.map(t => `! ${t.name} (${t.reason})`)
          ]
        );
      } else if (results.success.length > 0) {
        showNotification(
          'success',
          `Successfully uploaded ${results.success.length} data model(s).`,
          results.success.map(t => `✓ ${t.name}`)
        );
      } else if (results.skipped.length > 0) {
        showNotification(
          'info',
          `Skipped ${results.skipped.length} data model(s).`,
          results.skipped.map(t => `! ${t.name} (${t.reason})`)
        );
      }

      await reloadTemplatesPreservingUI();

    } catch (error) {
      console.error("Error uploading data models:", error);
      showNotification('error', `Error uploading data models: ${error.message}`);
    } finally {
      setUploadingTotal(0);
      setUploadingDone(0);
    }
  };

  const handleDelete = async (id) => {
    try {
      clearNotification();

      const response = await fetch('/api/data-model-catalog', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      if (!response.ok) {
        throw new Error("Failed to delete data model from API");
      }

      showNotification('success', 'Data model deleted successfully.');
      invalidateDataModelCache(id);

      await reloadTemplatesPreservingUI();
    } catch (error) {
      console.error(error);
      showNotification('error', `Failed to delete data model: ${error.message}`);
    }
  };

  const handleArchetypeSelect = (nodeId) => {
    if (Array.isArray(nodeId)) {
      setSelectedArchetypes(nodeId);
    } else {
      setSelectedArchetypes(prev => {
        if (prev.includes(nodeId)) {
          return prev.filter(id => id !== nodeId);
        } else {
          return [...prev, nodeId];
        }
      });
    }
    setPage(1);
  };

  const handleCompositionSelect = (nodeId) => {
    if (Array.isArray(nodeId)) {
      setSelectedCompositions(nodeId);
    } else {
      setSelectedCompositions(prev => {
        if (prev.includes(nodeId)) {
          return prev.filter(id => id !== nodeId);
        } else {
          return [...prev, nodeId];
        }
      });
    }
    setPage(1);
  };

  const handleHasAqlFilterChange = (value) => {
    setHasAqlFilter(value);
    setPage(1);
  };

  const handleSortChange = (order) => {
    setSortOrder(order);
  };

  const handleGroupingChange = (mode) => {
    setGroupingMode(mode);
    setExpandedGroups({});
  };

  const toggleGroupExpansion = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedArchetypes([]);
    setSelectedCompositions([]);
    setSelectedLanguages([]);
    setSelectedTerminologies([]);
    setSortOrder('name-asc');
    setGroupingMode('none');
    setHasAqlFilter(false);
    setHasOptFilter(false);
    setPage(1);
  };

  const visibleTemplates = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    const matchText = (t) => {
      if (!q) return true;
      const md = t?.metadata || {};
      return (
        (t.name || "").toLowerCase().includes(q) ||
        (md.description || "").toLowerCase().includes(q) ||
        (md.templateId || "").toLowerCase().includes(q) ||
        (md.compositionKind || "").toLowerCase().includes(q) ||
        (md.languages || []).some((x) => (x || "").toLowerCase().includes(q)) ||
        (md.terminologies || []).some((x) => (x || "").toLowerCase().includes(q))
      );
    };

    const has = (selectedArr, valueArr) =>
      selectedArr.length === 0 || (Array.isArray(valueArr) && selectedArr.every((s) => valueArr.includes(s)));

    const hasAny = (selectedArr, valueArr) =>
      selectedArr.length === 0 || (Array.isArray(valueArr) && selectedArr.some((s) => valueArr.includes(s)));

    const templateArchetypes = (t) => (t?.metadata?.archetypes || []).map(a => a.nodeId);

    return (openEhrTemplates || [])
      .filter((t) => matchText(t))
      .filter((t) =>
        selectedCompositions.length === 0
          ? true
          : selectedCompositions.includes(t?.webTemplate?.nodeId || "")
      )
      .filter((t) => hasAny(selectedArchetypes, templateArchetypes(t)))
      .filter((t) => {
        const md = t?.metadata || {};
        return (
          has(selectedLanguages, md.languages) &&
          has(selectedTerminologies, md.terminologies)
        );
      })
      .filter((t) => (hasOptFilter ? t?.source?.type === 'opt' : true))
      .filter((t) => (hasAqlFilter ? (t?.aqlUsageCount || 0) > 0 : true))
      .sort((a, b) => {
        if (sortOrder === "name-asc") {
          const nameA = (a.name || "").toLowerCase();
          const nameB = (b.name || "").toLowerCase();
          return nameA.localeCompare(nameB);
        }
        if (sortOrder === "name-desc") {
          const nameA = (a.name || "").toLowerCase();
          const nameB = (b.name || "").toLowerCase();
          return nameB.localeCompare(nameA);
        }
        if (sortOrder === "date-asc")
          return new Date(a.audit?.createdAt || 0) - new Date(b.audit?.createdAt || 0);
        if (sortOrder === "date-desc")
          return new Date(b.audit?.createdAt || 0) - new Date(a.audit?.createdAt || 0);
        return 0;
      });
  }, [
    openEhrTemplates,
    searchTerm,
    selectedArchetypes,
    selectedCompositions,
    selectedLanguages,
    selectedTerminologies,
    hasOptFilter,
    hasAqlFilter,
    sortOrder,
  ]);

  const { totalPages, paginatedTemplates } = React.useMemo(() => {
    const total = Math.max(1, Math.ceil((visibleTemplates?.length || 0) / (templatesPerPage || 1)));
    const start = (page - 1) * (templatesPerPage || 1);
    const slice = (visibleTemplates || []).slice(start, start + (templatesPerPage || 1));
    return { totalPages: total, paginatedTemplates: slice };
  }, [visibleTemplates, templatesPerPage, page]);

  const PaginationControls = () => {
    if (totalPages <= 1 || groupingMode !== 'none') return null;

    const startIdx = (page - 1) * templatesPerPage + 1;
    const endIdx = Math.min(page * templatesPerPage, visibleTemplates.length);

    return (
      <div className="flex items-center justify-between px-4 py-3 bg-surface border border-theme rounded-lg">
        <div className="flex items-center gap-2 text-sm text-theme-secondary">
          <span>
            Showing <span className="font-medium text-theme-primary">{startIdx}</span> to{' '}
            <span className="font-medium text-theme-primary">{endIdx}</span> of{' '}
            <span className="font-medium text-theme-primary">{visibleTemplates.length}</span> data models
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 rounded border border-theme hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed text-theme-primary"
            title="Previous page"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }

              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-3 py-1 rounded border ${
                    page === pageNum
                      ? 'bg-primary text-primary-text border-primary'
                      : 'border-theme text-theme-primary hover:bg-surface-hover'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 rounded border border-theme hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed text-theme-primary"
            title="Next page"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="perPage" className="text-sm text-theme-secondary">
            Per page:
          </label>
          <select
            id="perPage"
            value={templatesPerPage}
            onChange={(e) => {
              setTemplatesPerPage(Number(e.target.value));
              setPage(1);
            }}
            className="px-2 py-1 rounded border border-theme bg-surface text-theme-primary"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>
    );
  };

  // Get the current data models based on active domain
  const getCurrentDataModels = () => {
    if (activeDomain === 'openehr' || activeDomain === 'all') {
      return { models: visibleTemplates, loading: loadingDomainModels, isOpenEHR: true };
    }
    return { models: domainDataModels, loading: loadingDomainModels, isOpenEHR: false };
  };

  // Get domain display name
  const getDomainDisplayName = () => {
    if (activeDomain === 'fhir') return 'FHIR®';
    if (activeDomain === 'context') return 'ContextObjects';
    return 'openEHR®';
  };

  // Unified data models list for all domains
  const renderDataModelsList = () => {
    const { models, loading: isLoadingModels, isOpenEHR } = getCurrentDataModels();

    if (isLoadingModels) {
      return (
        <div className="flex items-center justify-center py-8 surface rounded-lg border border-theme">
          <Loader2 className="animate-spin text-theme-primary" size={32} />
          <span className="ml-2 text-theme-primary">Loading {getDomainDisplayName()} data models...</span>
        </div>
      );
    }

    if (models.length === 0) {
      return (
        <div className="p-8 surface rounded-lg text-center border border-theme">
          <Database size={48} className="mx-auto mb-4 text-theme-secondary" />
          <h3 className="text-lg font-medium text-theme-primary mb-2">No {getDomainDisplayName()} Data Models</h3>
          <p className="text-theme-secondary mb-4">
            {activeDomain === 'context'
              ? 'Upload context object schemas or create them using the ContextObject Builder.'
              : `You don't have any ${getDomainDisplayName()} data models yet. Upload some to get started.`}
          </p>
          {activeDomain === 'openehr' && (
            <button
              onClick={fetchSampleTemplates}
              className="px-4 py-2 btn-primary"
            >
              Browse Sample Data Models
            </button>
          )}
          {activeDomain === 'context' && onNavigate && (
            <button
              onClick={() => onNavigate('contextObjects')}
              className="px-4 py-2 btn-primary flex items-center gap-2 mx-auto"
            >
              <Boxes size={16} />
              Open ContextObject Builder
            </button>
          )}
        </div>
      );
    }

    // For OpenEHR, use the specialized OpenEHRTemplateList
    if (isOpenEHR) {
      return (
        <div className="space-y-4">
          <DataModelErrorBoundary>
            <OpenEHRTemplateList
              templates={paginatedTemplates}
              templateGroups={templateGroups}
              groupingMode={groupingMode}
              expandedGroups={expandedGroups}
              onDelete={handleDelete}
              onToggleGroupExpansion={toggleGroupExpansion}
              aqlUsage={templatesWithAQLs}
            />
          </DataModelErrorBoundary>
          {visibleTemplates.length > 0 && <PaginationControls />}
        </div>
      );
    }

    // For FHIR and Context Objects, use DataModelCard with unified styling
    return (
      <div className="space-y-4">
        {models.map((model) => (
          <DataModelCard
            key={model._id}
            dataModel={{
              ...model,
              // Normalize the data structure for DataModelCard
              domain: model.domain || activeDomain,
            }}
            onDelete={async (id) => {
              try {
                await fetch('/api/data-model-catalog', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id }),
                });
                setDomainDataModels(prev => prev.filter(m => m._id !== id));
                showNotification('success', 'Data model deleted successfully.');
                invalidateDataModelCache(id);
                refreshDataModels();
              } catch (e) {
                showNotification('error', 'Failed to delete data model.');
              }
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <NotificationComponent
        notification={notification}
        onClose={clearNotification}
      />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-theme-primary">Data Model Catalog</h1>
        <p className="text-sm text-theme-secondary">
          Search, filter, and manage your openEHR® templates, FHIR® resources, and ContextObjects.
        </p>
      </div>

      {/* Search and Filter Bar with Domain Tabs */}
      <DataModelSearchFilter
        onSearch={handleSearch}
        archetypeOptions={archetypeOptions}
        compositionOptions={compositionOptions}
        availableLanguages={facets.languages}
        availableTerminologies={facets.terminologies}
        selectedArchetypes={selectedArchetypes}
        selectedCompositions={selectedCompositions}
        selectedLanguages={selectedLanguages}
        selectedTerminologies={selectedTerminologies}
        onArchetypeSelect={handleArchetypeSelect}
        onCompositionSelect={handleCompositionSelect}
        onLanguageSelect={handleLanguageSelect}
        onTerminologySelect={handleTerminologySelect}
        onGroupingChange={handleGroupingChange}
        onSortChange={handleSortChange}
        currentGrouping={groupingMode}
        currentSort={sortOrder}
        hasAqlFilter={hasAqlFilter}
        onHasAqlFilterChange={handleHasAqlFilterChange}
        hasOptFilter={hasOptFilter}
        onHasOptFilterChange={setHasOptFilter}
        onResetFilters={resetFilters}
        activeDomain={activeDomain}
        onDomainChange={handleDomainChange}
        domainCounts={domainCounts}
      />

      {/* Upload and Sample buttons - visible for all domains */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <DataModelUpload
          onUpload={handleUpload}
          onError={(msg) => showNotification('error', msg)}
          onNavigate={onNavigate}
        />

        <div className="flex gap-2">
          <button
            onClick={fetchSampleTemplates}
            className="px-4 py-2 bg-success text-success-text rounded-md hover:opacity-80 flex items-center gap-2"
            disabled={loadingSamples}
          >
            {loadingSamples ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Book size={16} />
                Sample Data Models
              </>
            )}
          </button>
        </div>
      </div>

      {/* Unified data models list for all domains */}
      {renderDataModelsList()}

      {showSampleTemplates && (
        <SampleDataModelsModal
          templates={sampleTemplates}
          isLoading={loadingSamples}
          onClose={() => setShowSampleTemplates(false)}
          onImport={handleSampleImport}
          isImporting={isImportingSample}
        />
      )}
      
      {(uploadingTotal > 0 || isImportingSample) && (
        <div className="fixed bottom-4 right-4 p-4 bg-primary/10 border border-primary rounded-lg flex items-center gap-3 shadow-lg z-50">
          <Loader2 className="animate-spin" size={20} />
          <span className="text-sm text-theme-primary">
            {isImportingSample
              ? 'Importing sample data models…'
              : `Uploading data models… ${uploadingDone}/${uploadingTotal}`}
          </span>
        </div>
      )}
    </div>
  );
};

export default DataModelManagement;
