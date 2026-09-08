// src/components/views/dataFactory/DataHistoryView.jsx
"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  History, FlaskConical, FileCode2, RefreshCw,
  CheckCircle2, XCircle, Clock, Loader2,
  Users, FileText, Database, Calendar,
  ChevronDown, ChevronRight, Filter, Server, Square,
  UserRound, Share2, Dna, ScanLine, Receipt, Boxes, Puzzle
} from 'lucide-react';

// Domain icon and color mapping for strategies
const DOMAIN_THEMES = {
  openehr: { icon: UserRound, color: '#00a99d', displayName: 'openEHR' },
  fhir: { icon: Share2, color: '#e44e37', displayName: 'FHIR' },
  genomics: { icon: Dna, color: '#6c5ce7', displayName: 'Genomics' },
  dicom: { icon: ScanLine, color: '#0984e3', displayName: 'DICOM' },
  x12: { icon: Receipt, color: '#5b4b9e', displayName: 'X12' },
  contextobjects: { icon: Boxes, color: '#00ED64', displayName: 'ContextObjects' },
  custom: { icon: Puzzle, color: '#fdcb6e', displayName: 'Custom' },
};

const getDomainTheme = (domain) => {
  const key = (domain || '').toLowerCase();
  return DOMAIN_THEMES[key] || DOMAIN_THEMES.custom;
};
import { useTheme } from '../layout/ThemedLayout';

// Map Kehrnel status to standard status
const SOURCE_TEMPLATE_NOT_FOUND_PATTERN = /SOURCE_TEMPLATE_NOT_FOUND|No generation source for template_id=/i;

function isSourceTemplateWarning(job) {
  if (!job || typeof job !== 'object') return false;
  const code = String(job.errorCode || job.error_code || '').toUpperCase();
  if (code === 'SOURCE_TEMPLATE_NOT_FOUND') return true;
  return SOURCE_TEMPLATE_NOT_FOUND_PATTERN.test(String(job.error || ''));
}

function mapKehrnelStatus(status, job = null) {
  const s = (status || '').toLowerCase();
  if (s === 'queued' || s === 'running' || s === 'canceling') return 'running';
  if (s === 'completed' || s === 'done') return 'completed';
  if (s === 'failed' || s === 'error') {
    if (isSourceTemplateWarning(job)) return 'warning';
    return 'failed';
  }
  if (s === 'canceled' || s === 'cancelled') return 'canceled';
  return s || 'unknown';
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const SEARCH_REFRESH_OPS = new Set(['rebuild_slim_search_collection']);

function normalizeJobOp(job = null) {
  return String(job?.op || job?.operation || '').trim().toLowerCase();
}

function isSearchRefreshJob(job = null) {
  return SEARCH_REFRESH_OPS.has(normalizeJobOp(job));
}

// Helper to determine generation type based on DATA ORIGIN
const getGenerationType = (job) => {
  if (isSearchRefreshJob(job)) {
    return {
      key: 'search-refresh',
      label: 'Maintenance',
      description: 'Search Refresh',
      icon: 'RefreshCw',
      color: 'text-amber-300',
      bgColor: 'bg-amber-400/10'
    };
  }

  // Mapping jobs (document transformation)
  if (job.type === 'mapping') {
    return {
      key: 'mapping',
      label: 'Mapping',
      description: 'Mapping',
      icon: 'FileCode2',
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10'
    };
  }

  // Check stored dataSourceType first (newer jobs)
  const dataSourceType = job.dataSourceType;
  const sourceCollection = String(
    job.sourceCollection ||
    job.source_collection ||
    job.payload?.source_collection ||
    job.request?.source_collection ||
    job.result?.source_collection ||
    ''
  ).trim().toLowerCase();
  const sourceDatabase = String(
    job.sourceDatabase ||
    job.source_database ||
    job.payload?.source_database ||
    job.request?.source_database ||
    job.result?.source_database ||
    ''
  ).trim();
  const generationMode = String(
    job.generationMode ||
    job.generation_mode ||
    job.payload?.generation_mode ||
    job.request?.generation_mode ||
    ''
  ).trim().toLowerCase();
  const inputMode = String(
    job.inputMode ||
    job.input_mode ||
    job.request?.input_mode ||
    ''
  ).trim().toLowerCase();

  // 1. From imported data (user uploaded compositions)
  if (dataSourceType === 'imported' || !!job.importId || inputMode === 'imported') {
    return {
      key: 'synthetic-imported',
      label: 'Synthetic',
      description: 'Imported',
      icon: 'FlaskConical',
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10'
    };
  }

  // 2. Model catalog generation (no source collections)
  if (inputMode === 'model_catalog') {
    return {
      key: 'synthetic-model-catalog',
      label: 'Synthetic',
      description: 'Model Catalog',
      icon: 'FlaskConical',
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-400/10'
    };
  }

  // 3. From Healthcare Data Lab sample data
  if (dataSourceType === 'sample' || sourceCollection === 'samples' || !!job.sampleDataId || !!job.samplePatients) {
    return {
      key: 'synthetic-sample',
      label: 'Synthetic',
      description: 'Data Lab Samples',
      icon: 'FlaskConical',
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10'
    };
  }

  // 4. From your data (existing Data Lab source collections)
  if (dataSourceType === 'dataLab' || !!sourceCollection || !!sourceDatabase || inputMode === 'source') {
    return {
      key: 'synthetic-datalab',
      label: 'Synthetic',
      description: 'Data Lab',
      icon: 'FlaskConical',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-400/10'
    };
  }

  // 5. Model-only generation (no source docs)
  if (generationMode === 'from_models' || inputMode === 'from_models') {
    return {
      key: 'synthetic-model-only',
      label: 'Synthetic',
      description: 'Model-only',
      icon: 'FlaskConical',
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10'
    };
  }

  // 6. Random generation (fallback when source mode is unknown)
  return {
    key: 'synthetic-random',
    label: 'Synthetic',
    description: 'Random',
    icon: 'FlaskConical',
    color: 'text-pink-400',
    bgColor: 'bg-pink-400/10'
  };
};

const DataHistoryView = ({ activeEnvironment, onJobStatusChange }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [kehrnelJobs, setKehrnelJobs] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all', 'synthetic', 'maintenance', 'mapping'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'completed', 'warning', 'failed', 'running'
  const [cancelingJobIds, setCancelingJobIds] = useState(() => new Set());
  const [cancelingAll, setCancelingAll] = useState(false);
  const [expandedJobIds, setExpandedJobIds] = useState(() => new Set());

  // Get strategy links that can own Kehrnel jobs. Maintenance jobs use the same queue as synthetic jobs.
  const kehrnelJobLinks = React.useMemo(() => {
    const links = Array.isArray(activeEnvironment?.strategyLinks) ? activeEnvironment.strategyLinks : [];
    const byKey = new Map();
    for (const link of links) {
      const domain = String(link?.domain || '').trim().toLowerCase();
      const strategyId = String(link?.kehrnel?.strategyId || link?.strategyId || '').trim();
      if (!domain || !strategyId) continue;
      const key = `${domain}:${strategyId}`;
      if (!byKey.has(key)) byKey.set(key, link);
    }
    return Array.from(byKey.values());
  }, [activeEnvironment]);

  const fetchHistory = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      // Fetch Kehrnel-managed jobs for each active strategy domain.
      const kehrnelJobsAll = [];
      const seenJobIds = new Set();
      for (const link of kehrnelJobLinks) {
        const domain = (link.domain || '').toLowerCase();
        const strategyId = link.kehrnel?.strategyId || link.strategyId || '';
        if (!domain || !strategyId) continue;

        try {
          const params = new URLSearchParams({ domain, strategyId, limit: '50' });
          const res = await fetch(`/api/synthetic-data/kehrnel/jobs?${params.toString()}`);
          if (res.ok) {
            const data = await res.json();
            const items = Array.isArray(data.items) ? data.items : [];
            // Transform Kehrnel jobs to match history format
            // Extract target collections from strategy link
            const targetCollections = link.kehrnel?.targetCollections ||
              link.targetCollections ||
              (link.kehrnel?.config?.targetCollection ? [link.kehrnel.config.targetCollection] : []);

            for (const job of items) {
              const jobId = String(job?.id || job?._id || job?.jobId || '');
              if (jobId && seenJobIds.has(jobId)) continue;
              if (jobId) seenJobIds.add(jobId);

              const isRefresh = isSearchRefreshJob(job);
              kehrnelJobsAll.push({
                ...(job || {}),
                _id: job.id || job._id,
                jobId: job.id || job._id,
                operation: job.op || job.operation || null,
                jobKind: isRefresh ? 'search-refresh' : 'synthetic',
                startTime: job.startedAt || job.started_at || job.startTime || job.createdAt || job.created_at,
                completionTime:
                  job.finishedAt ||
                  job.finished_at ||
                  job.completedAt ||
                  job.completed_at ||
                  job.completionTime ||
                  job.completion_time ||
                  job.endTime ||
                  job.end_time ||
                  null,
                status: mapKehrnelStatus(job.status, job),
                progress: toNumber(job.progress, 0),
                phase: job.phase || job.stats?.phase || null,
                patientCount: isRefresh ? 0 : (job.stats?.patientCount ?? job.patientCount ?? 0),
                generatedPatients: isRefresh ? 0 : (job.stats?.generatedPatients ?? job.generatedPatients ?? 0),
                modelCount: isRefresh
                  ? toNumber(job.stats?.processed ?? job.result?.processed ?? job.processed, 0)
                  : (job.stats?.modelCount ?? job.modelCount ?? (Array.isArray(job.byModel) ? job.byModel.length : 0)),
                documentCount: isRefresh
                  ? toNumber(job.stats?.inserted ?? job.result?.inserted ?? job.inserted, 0)
                  : (job.stats?.generatedDocuments ?? job.generatedDocuments ?? job.generatedDocs ?? 0),
                linksApplied: job.stats?.linksApplied ?? job.linksApplied ?? 0,
                warnings: Array.isArray(job.result?.warnings) ? job.result.warnings : (Array.isArray(job.warnings) ? job.warnings : []),
                validationMode:
                  job.stats?.validation_mode ??
                  job.result?.validation_mode ??
                  job.validationMode ??
                  job.validation_mode ??
                  null,
                validatedDocs:
                  toNumber(
                    job.stats?.validated_docs ??
                    job.result?.validated_docs ??
                    job.validatedDocs ??
                    job.validated_docs,
                    0
                  ),
                validationFailures:
                  toNumber(
                    job.stats?.validation_failures ??
                    job.result?.validation_failures ??
                    job.validationFailures ??
                    job.validation_failures,
                    0
                  ),
                skippedDocs:
                  toNumber(
                    job.stats?.skipped_docs ??
                    job.result?.skipped_docs ??
                    job.skippedDocs ??
                    job.skipped_docs,
                    0
                  ),
                validationCheckedLimit:
                  toNumber(
                    job.stats?.validation_checked_limit ??
                    job.result?.validation_checked_limit ??
                    job.validationCheckedLimit ??
                    job.validation_checked_limit,
                    0
                  ),
                validationErrors:
                  Array.isArray(job.result?.validation_errors)
                    ? job.result.validation_errors
                    : (Array.isArray(job.validationErrors) ? job.validationErrors : []),
                validationFailureBreakdown:
                  job.stats?.validation_failure_breakdown ||
                  job.result?.validation_failure_breakdown ||
                  job.validationFailureBreakdown ||
                  job.validation_failure_breakdown ||
                  null,
                validationTemplatesTotal:
                  toNumber(
                    job.stats?.validation_templates_total ??
                    job.result?.validation_templates_total ??
                    job.validationTemplatesTotal ??
                    job.validation_templates_total,
                    0
                  ),
                validationTemplatesWithValidator:
                  toNumber(
                    job.stats?.validation_templates_with_validator ??
                    job.result?.validation_templates_with_validator ??
                    job.validationTemplatesWithValidator ??
                    job.validation_templates_with_validator,
                    0
                  ),
                validationTemplatesWithoutValidator:
                  toNumber(
                    job.stats?.validation_templates_without_validator ??
                    job.result?.validation_templates_without_validator ??
                    job.validationTemplatesWithoutValidator ??
                    job.validation_templates_without_validator,
                    0
                  ),
                environmentName: job.environmentName || data.environment?.name || activeEnvironment?.name || domain,
                domain: domain,
                strategyId: job.strategyId || strategyId,
                strategyName: isRefresh ? 'Search Projection Refresh' : (link.strategyName || strategyId),
                strategyConfig: job.strategyConfig || null,
                strategy: job.strategy || null,
                targetDatabase:
                  data.targetDatabase ||
                  data.target_database ||
                  job.targetDatabase ||
                  job.target_database ||
                  null,
                sourceDatabase:
                  job.sourceDatabase ||
                  job.source_database ||
                  job.payload?.source_database ||
                  job.request?.source_database ||
                  data.sourceDatabase ||
                  data.source_database ||
                  null,
                sourceCollection:
                  job.sourceCollection ||
                  job.source_collection ||
                  job.payload?.source_collection ||
                  job.request?.source_collection ||
                  data.sourceCollection ||
                  data.source_collection ||
                  null,
                generationMode:
                  job.generationMode ||
                  job.generation_mode ||
                  job.payload?.generation_mode ||
                  job.request?.generation_mode ||
                  null,
                inputMode:
                  job.inputMode ||
                  job.input_mode ||
                  job.request?.input_mode ||
                  null,
                targetCollections:
                  job.targetCollections ||
                  job.target_collections ||
                  targetCollections ||
                  null,
                type: 'kehrnel',
                source: 'kehrnel',
                isActive: ['queued', 'running', 'canceling'].includes((job.status || '').toLowerCase()),
                planOnly: job.planOnly,
                dryRun: job.dryRun,
                error: job.error,
                errorCode: job.errorCode || job.error_code || null
              });
            }
          }
        } catch (err) {
          console.warn(`Failed to fetch Kehrnel jobs for domain ${domain}:`, err);
        }
      }
      setKehrnelJobs(kehrnelJobsAll);

      // TODO: Fetch mapping history when available
      // const mappingRes = await fetch('/api/mappings/history?limit=50');

    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [kehrnelJobLinks, activeEnvironment]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Combine and filter history (Kehrnel jobs only)
  const allHistory = [...kehrnelJobs]
    .sort((a, b) => {
      const dateA = new Date(a.startTime || a.completionTime || 0);
      const dateB = new Date(b.startTime || b.completionTime || 0);
      return dateB - dateA;
    });

  const hasActiveJobs = allHistory.some((item) => {
    const status = (item?.status || '').toLowerCase();
    return item?.isActive || status === 'running';
  });

  useEffect(() => {
    if (!hasActiveJobs) return undefined;

    const interval = setInterval(() => {
      fetchHistory({ silent: true });
    }, 2500);

    return () => clearInterval(interval);
  }, [hasActiveJobs, fetchHistory]);

  // Track previous status to avoid unnecessary updates
  const prevJobStatusRef = React.useRef(null);

  // Report active job status to parent for the global status bar
  useEffect(() => {
    if (!onJobStatusChange) return;

    // Find ALL active jobs
    const activeJobs = allHistory.filter(job => job.isActive || job.status === 'running');
    const activeJobCount = activeJobs.length;

    let newStatus = null;

    if (activeJobCount > 0) {
      // Calculate aggregate progress for multiple jobs
      const totalProgress = activeJobs.reduce((sum, job) => sum + (job.progress || 0), 0);
      const avgProgress = Math.round(totalProgress / activeJobCount);

      newStatus = {
        type: 'synthetic',
        status: 'running',
        progress: avgProgress,
        jobCount: activeJobCount,
        jobId: activeJobs[0]?._id || activeJobs[0]?.jobId
      };
    } else {
      // Check if we just had a job complete (within last 10 seconds)
      const recentlyCompleted = allHistory.find(job =>
        job.status === 'completed' &&
        job.completionTime &&
        (Date.now() - new Date(job.completionTime).getTime()) < 10000
      );

      if (recentlyCompleted) {
        newStatus = {
          type: 'synthetic',
          status: 'completed',
          summary: {
            patients: recentlyCompleted.patientCount || recentlyCompleted.generatedPatients || 0,
            documents: recentlyCompleted.documentCount || 0,
            models: recentlyCompleted.modelCount || 0
          }
        };
      }
    }

    // Only update if status actually changed (compare serialized versions)
    const prevKey = prevJobStatusRef.current ? JSON.stringify(prevJobStatusRef.current) : null;
    const newKey = newStatus ? JSON.stringify(newStatus) : null;

    if (prevKey !== newKey) {
      prevJobStatusRef.current = newStatus;
      onJobStatusChange(newStatus);
    }
  }, [allHistory, onJobStatusChange]);

  const filteredHistory = allHistory.filter(item => {
    // Type filter: synthetic jobs are Kehrnel jobs
    if (filter === 'synthetic' && (item.type !== 'kehrnel' || isSearchRefreshJob(item))) return false;
    if (filter === 'maintenance' && !isSearchRefreshJob(item)) return false;
    if (filter === 'mapping' && item.type !== 'mapping') return false;
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    return true;
  });

  // Stats
  const stats = {
    total: allHistory.length,
    completed: allHistory.filter(h => h.status === 'completed').length,
    warning: allHistory.filter(h => h.status === 'warning').length,
    failed: allHistory.filter(h => h.status === 'failed').length,
    running: allHistory.filter(h => h.status === 'running' || h.isActive).length,
    totalPatients: allHistory
      .filter(h => h.status === 'completed' && !isSearchRefreshJob(h))
      .reduce((sum, h) => sum + (h.patientCount || 0), 0),
    totalDocuments: allHistory
      .filter(h => h.status === 'completed' && !isSearchRefreshJob(h))
      .reduce((sum, h) => sum + (h.documentCount || 0), 0)
  };

  const isCancelableJob = useCallback((job) => {
    if (!job || typeof job !== 'object') return false;
    const status = String(job.status || '').toLowerCase();
    return ['queued', 'running', 'canceling', 'initializing', 'paused'].includes(status) || !!job.isActive;
  }, []);

  const activeCancelableJobs = useMemo(() => allHistory.filter(isCancelableJob), [allHistory, isCancelableJob]);

  const cancelSingleJob = useCallback(async (job) => {
    if (!job) return;
    const jobId = job._id || job.jobId || job.id;
    if (!jobId) return;

    setCancelingJobIds((prev) => {
      const next = new Set(prev);
      next.add(String(jobId));
      return next;
    });

    try {
      const params = new URLSearchParams();
      if (job.domain) params.set('domain', String(job.domain));
      const url = `/api/synthetic-data/kehrnel/jobs/${encodeURIComponent(String(jobId))}/cancel${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url, { method: 'POST' });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to cancel job');
      }

      await fetchHistory({ silent: true });
    } catch (error) {
      console.error('Failed to cancel job:', error);
      alert(error.message || 'Failed to cancel job');
    } finally {
      setCancelingJobIds((prev) => {
        const next = new Set(prev);
        next.delete(String(jobId));
        return next;
      });
    }
  }, [fetchHistory]);

  const cancelAllActiveJobs = useCallback(async () => {
    if (!activeCancelableJobs.length || cancelingAll) return;

    setCancelingAll(true);
    try {
      const results = await Promise.allSettled(activeCancelableJobs.map((job) => cancelSingleJob(job)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        alert(`Canceled with ${failed} failure(s). Check console for details.`);
      }
      await fetchHistory({ silent: true });
    } finally {
      setCancelingAll(false);
    }
  }, [activeCancelableJobs, cancelSingleJob, cancelingAll, fetchHistory]);

  const toggleExpandedJob = useCallback((job) => {
    const key = String(job?._id || job?.jobId || job?.id || '');
    if (!key) return;
    setExpandedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const getStatusIcon = (status, isActive) => {
    if (isActive || status === 'running') {
      return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
    }
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case 'warning':
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-error" />;
      default:
        return <Clock className="w-4 h-4 text-theme-secondary" />;
    }
  };

  const getStatusBadge = (status, isActive) => {
    if (isActive || status === 'running') {
      return 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
    }
    switch (status) {
      case 'completed':
        return 'bg-success/15 text-success border border-success/30';
      case 'warning':
        return 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30';
      case 'failed':
        return 'bg-error/15 text-error border border-error/30';
      case 'canceled':
      case 'cancelled':
        return 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border border-slate-500/30';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (start, end) => {
    if (!start || !end) return '—';
    const duration = new Date(end) - new Date(start);
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-theme-primary">Jobs History</h1>
            <p className="text-theme-secondary">View synthetic generation, mapping, and maintenance jobs</p>
          </div>
          <div className="flex items-center gap-2">
            {activeCancelableJobs.length > 0 && (
              <button
                onClick={cancelAllActiveJobs}
                disabled={cancelingAll}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-error/50 text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                title="Cancel all active jobs"
              >
                {cancelingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                Cancel all active jobs ({activeCancelableJobs.length})
              </button>
            )}
            <button
              onClick={fetchHistory}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-theme text-theme-primary hover:bg-theme-secondary/10 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mt-6">
          <StatCard label="Total Runs" value={stats.total} icon={History} color="#a855f7" />
          <StatCard label="Completed" value={stats.completed} icon={CheckCircle2} color="#10b981" />
          <StatCard label="Warnings" value={stats.warning} icon={Clock} color="#f59e0b" />
          <StatCard label="Failed" value={stats.failed} icon={XCircle} color="#ef4444" />
          <StatCard label="Running" value={stats.running} icon={Loader2} color="#3b82f6" />
          <StatCard label="Total Patients" value={stats.totalPatients.toLocaleString()} icon={Users} color="#ec4899" />
          <StatCard label="Documents" value={stats.totalDocuments.toLocaleString()} icon={Database} color="#14b8a6" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-theme-secondary" />
          <span className="text-sm text-theme-secondary">Filter:</span>
        </div>

        {/* Type Filter */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-theme surface text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">All Types</option>
          <option value="synthetic">Synthetic Data</option>
          <option value="maintenance">Maintenance</option>
          <option value="mapping">Mapping Runs</option>
        </select>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-theme surface text-theme-primary text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="warning">Warnings</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
        </select>

        <span className="text-sm text-theme-secondary ml-auto">
          Showing {filteredHistory.length} of {allHistory.length} runs
        </span>
      </div>

      {/* Jobs List */}
      <div className="space-y-3">
        {loading ? (
          <div className="rounded-xl border border-theme surface p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-theme-secondary">Loading history...</p>
          </div>
        ) : filteredHistory.length > 0 ? (
          filteredHistory.map((job, idx) => (
            <JobCard
              key={job._id || idx}
              job={job}
              formatDate={formatDate}
              formatDuration={formatDuration}
              getStatusIcon={getStatusIcon}
              getStatusBadge={getStatusBadge}
              toNumber={toNumber}
              isCancelable={isCancelableJob(job)}
              isCanceling={cancelingJobIds.has(String(job._id || job.jobId || job.id || ''))}
              onCancel={cancelSingleJob}
              isExpanded={expandedJobIds.has(String(job._id || job.jobId || job.id || ''))}
              onToggleExpanded={toggleExpandedJob}
            />
          ))
        ) : (
          <div className="rounded-xl border border-theme surface p-12 text-center">
            <History className="w-12 h-12 mx-auto mb-3 opacity-50 text-theme-secondary" />
            <p className="text-theme-secondary">No jobs found</p>
            <p className="text-sm text-theme-secondary mt-1">
              Generate synthetic data, run a mapping job, or queue a maintenance task to see history here
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ label, value, icon: Icon, color }) => {
  const { theme } = useTheme();
  return (
    <div
      className="rounded-lg p-3 border"
      style={{ backgroundColor: theme.surface, borderColor: theme.border }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div>
          <p className="text-lg font-bold text-theme-primary">{value}</p>
          <p className="text-xs text-theme-secondary">{label}</p>
        </div>
      </div>
    </div>
  );
};

// Job Card Component - minimalist and expandable
const JobCard = ({
  job,
  formatDate,
  formatDuration,
  getStatusIcon,
  getStatusBadge,
  toNumber,
  isCancelable,
  isCanceling,
  onCancel,
  isExpanded,
  onToggleExpanded
}) => {
  const isRunning = job.isActive || job.status === 'running';
  const isRefreshJob = isSearchRefreshJob(job);
  const genType = getGenerationType(job);
  const jobKey = String(job._id || job.jobId || job.id || '');

  // Check if this is a preview/plan-only job (no data actually written)
  const isPlanOnly = job.planOnly === true || job.plan_only === true || job.dryRun === true;

  // Extract strategy info
  const fullStrategy = job.strategyConfig?._fullStrategy || null;
  const blueprint = fullStrategy?.blueprint || job.strategyConfig?.blueprint || null;
  const protocol = blueprint?.protocol || null;
  const strategyDisplayName = blueprint?.display_name ||
    fullStrategy?.name ||
    job.strategyConfig?.blueprint?.display_name ||
    job.strategyName ||
    job.strategy ||
    (isRefreshJob ? 'Search Projection Refresh' : null) ||
    null;

  // Get domain theme for icon and color
  const domainTheme = getDomainTheme(job.domain);
  const DomainIcon = domainTheme.icon;
  const strategyColor = protocol?.color || domainTheme.color;

  // Target collections
  const targetCollectionsRaw =
    job.result?.target ||
    job.targetCollections ||
    job.target_collections ||
    job.result?.target_collections ||
    null;
  const targetCollectionEntries =
    targetCollectionsRaw && typeof targetCollectionsRaw === 'object' && !Array.isArray(targetCollectionsRaw)
      ? Object.entries(targetCollectionsRaw).filter(([, v]) => !!v)
      : [];
  const targetCollectionList = Array.isArray(targetCollectionsRaw)
    ? targetCollectionsRaw.filter(Boolean)
    : targetCollectionEntries.map(([, v]) => String(v));

  const targetDatabase =
    job.result?.target_database ||
    job.targetDatabase ||
    job.target_database ||
    '—';

  const inputMode = job.request?.input_mode || null;
  const requestModelSource =
    job.request?.model_source ||
    job.modelSource ||
    job.model_source ||
    job.result?.model_source ||
    job.payload?.model_source ||
    null;

  // Calculate stats
  const processedCount = toNumber(
    job.stats?.processed ??
      job.result?.processed ??
      job.processed ??
      job.modelCount,
    0
  );
  const insertedCount = toNumber(
    job.stats?.inserted ??
      job.result?.inserted ??
      job.inserted ??
      job.documentCount,
    0
  );
  const warningCount = Array.isArray(job.warnings)
    ? job.warnings.length
    : (Array.isArray(job.result?.warnings) ? job.result.warnings.length : 0);
  const targetPatients = isRefreshJob ? 0 : (Number(job.patientCount ?? job?.request?.patient_count ?? 0) || 0);
  const generatedPatients = isRefreshJob ? 0 : (Number(job.generatedPatients ?? 0) || 0);
  const documentCount = isRefreshJob ? insertedCount : (job.documentCount || 0);
  const modelCount = isRefreshJob ? processedCount : (job.modelCount || job.templateCount || 0);
  const validationMode = String(job.validationMode || '').toLowerCase();
  const validatedDocs = toNumber(job.validatedDocs, 0);
  const validationFailures = toNumber(job.validationFailures, 0);
  const skippedDocs = toNumber(job.skippedDocs, 0);
  const validationCheckedLimit = toNumber(job.validationCheckedLimit, 0);
  const validationFailureBreakdown = job.validationFailureBreakdown && typeof job.validationFailureBreakdown === 'object'
    ? job.validationFailureBreakdown
    : {};
  const validationGenerationFailures = toNumber(validationFailureBreakdown.generation, 0);
  const validationValidatorFailures = toNumber(validationFailureBreakdown.validator, 0);
  const validationTransformFailures = toNumber(validationFailureBreakdown.transform, 0);
  const validationTemplatesTotal = toNumber(job.validationTemplatesTotal, 0);
  const validationTemplatesWithValidator = toNumber(job.validationTemplatesWithValidator, 0);
  const validationTemplatesWithoutValidator = toNumber(job.validationTemplatesWithoutValidator, 0);
  const validationErrors = Array.isArray(job.validationErrors) ? job.validationErrors : [];
  const validationReasonCounts = validationErrors.reduce((acc, entry) => {
    const issues = Array.isArray(entry?.issues) ? entry.issues : [];
    for (const issueRaw of issues) {
      const issue = String(issueRaw || '').trim();
      if (!issue) continue;
      const withoutPrefix = issue.replace(/^(generation|validator|transform):\s*/i, '');
      const normalized = withoutPrefix.split('@')[0]?.trim() || withoutPrefix;
      acc[normalized] = (acc[normalized] || 0) + 1;
    }
    return acc;
  }, {});
  const topValidationReasons = Object.entries(validationReasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const validationTemplateCounts = validationErrors.reduce((acc, entry) => {
    const templateId = String(entry?.template_id || '').trim();
    if (!templateId) return acc;
    acc[templateId] = (acc[templateId] || 0) + 1;
    return acc;
  }, {});
  const topValidationTemplates = Object.entries(validationTemplateCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const hasValidationSummary =
    ((validationMode && validationMode !== 'none') || validatedDocs > 0 || validationFailures > 0 || skippedDocs > 0);

  return (
    <div
      onClick={() => onToggleExpanded?.(job)}
      className={`rounded-lg border surface overflow-hidden transition-all cursor-pointer hover:border-primary/30 ${
        isRunning ? 'border-blue-500/40' : 'border-theme'
      }`}
    >
      {/* Collapsed View */}
      <div className="p-4">
        {/* Top row: Domain badge + Status + Actions */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {/* Domain Badge */}
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded border"
              style={{
                backgroundColor: `${strategyColor}15`,
                color: strategyColor,
                borderColor: `${strategyColor}30`
              }}
            >
              <DomainIcon size={12} />
              {domainTheme.displayName}
            </span>
            {/* Data Source Badge */}
            <span className={`px-2 py-0.5 text-xs rounded border ${genType.bgColor} ${genType.color} border-current/20`}>
              {genType.description}
            </span>
            {isPlanOnly && (
              <span className="px-2 py-0.5 text-xs rounded border bg-amber-500/15 text-amber-400 border-amber-500/30">
                Preview
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            <div className="flex items-center gap-1.5">
              {getStatusIcon(job.status, job.isActive)}
              {isRunning ? (
                <span className="text-xs text-blue-400 font-medium">{Math.round(toNumber(job.progress, 0))}%</span>
              ) : job.status === 'completed' ? (
                <span className="text-xs text-success font-medium">Completed</span>
              ) : job.status === 'warning' ? (
                <span className="text-xs text-yellow-400 font-medium">Warning</span>
              ) : job.status === 'failed' ? (
                <span className="text-xs text-error font-medium">Failed</span>
              ) : null}
            </div>
            {/* Actions */}
            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {isCancelable && (
                <button
                  onClick={() => onCancel?.(job)}
                  disabled={isCanceling}
                  className="px-2 py-1 rounded text-xs border border-error/40 text-error hover:bg-error/10 disabled:opacity-50"
                >
                  {isCanceling ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Stop'}
                </button>
              )}
              <ChevronRight className={`w-4 h-4 text-theme-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </div>
          </div>
        </div>

        {/* Strategy Name */}
        <h3 className="text-base font-semibold text-theme-primary mb-1">
          {strategyDisplayName || (isRefreshJob ? 'Search Projection Refresh' : 'Synthetic Job')}
        </h3>

        {/* Meta row: Date, Duration, Stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-theme-secondary">
            <span>{formatDate(job.startTime || job.completionTime)}</span>
            {!isRunning && job.completionTime && (
              <>
                <span>•</span>
                <span>{formatDuration(job.startTime, job.completionTime)}</span>
              </>
            )}
          </div>
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            {isRefreshJob ? (
              <>
                <div className="flex items-center gap-1.5" title="Processed compositions">
                  <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                  <span className="text-theme-primary font-medium">{processedCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-1.5" title="Inserted search documents">
                  <Database className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-theme-primary font-medium">{insertedCount.toLocaleString()}</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5" title="Patients">
                  <Users className="w-3.5 h-3.5 text-pink-400" />
                  <span className="text-theme-primary font-medium">
                    {generatedPatients.toLocaleString()}
                    {targetPatients > 0 && <span className="text-theme-secondary font-normal">/{targetPatients}</span>}
                  </span>
                </div>
                <div className="flex items-center gap-1.5" title="Documents">
                  <Database className="w-3.5 h-3.5 text-teal-400" />
                  <span className="text-theme-primary font-medium">{documentCount.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Progress bar for running jobs */}
        {isRunning && (
          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-blue-500/20 overflow-hidden">
              <div
                className="h-full bg-blue-400 transition-all duration-300 rounded-full"
                style={{ width: `${Math.round(toNumber(job.progress, 0))}%` }}
              />
            </div>
          </div>
        )}
      </div>


      {/* Expanded View */}
      {isExpanded && (
        <div className="border-t border-theme bg-surface-hover/30 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Job Details */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-theme-secondary mb-2 font-medium">Job Details</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-theme-secondary">ID</span>
                  <span className="font-mono text-theme-primary">{jobKey.slice(0, 12) || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-theme-secondary">Domain</span>
                  <span className="text-theme-primary">{job.domain || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-theme-secondary">Environment</span>
                  <span className="text-theme-primary">{job.environmentName || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-theme-secondary">Phase</span>
                  <span className="text-theme-primary">{job.phase || '—'}</span>
                </div>
                {isRefreshJob && (
                  <div className="flex justify-between">
                    <span className="text-theme-secondary">Operation</span>
                    <span className="font-mono text-theme-primary text-[10px]">{normalizeJobOp(job) || '—'}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-theme-secondary">Started</span>
                  <span className="text-theme-primary">{formatDate(job.startTime)}</span>
                </div>
                {job.completionTime && (
                  <div className="flex justify-between">
                    <span className="text-theme-secondary">Completed</span>
                    <span className="text-theme-primary">{formatDate(job.completionTime)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Data Generated */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-theme-secondary mb-2 font-medium">
                {isRefreshJob ? 'Search Refresh' : 'Data Generated'}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {isRefreshJob ? (
                  <>
                    <div className="rounded-lg bg-surface p-2 border border-theme/20">
                      <div className="text-lg font-bold text-amber-300">{processedCount.toLocaleString()}</div>
                      <div className="text-[10px] text-theme-secondary">Processed</div>
                    </div>
                    <div className="rounded-lg bg-surface p-2 border border-theme/20">
                      <div className="text-lg font-bold text-teal-400">{insertedCount.toLocaleString()}</div>
                      <div className="text-[10px] text-theme-secondary">Inserted</div>
                    </div>
                    <div className="rounded-lg bg-surface p-2 border border-theme/20">
                      <div className={`text-lg font-bold ${warningCount > 0 ? 'text-yellow-400' : 'text-theme-primary'}`}>
                        {warningCount.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-theme-secondary">Warnings</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="rounded-lg bg-surface p-2 border border-theme/20">
                      <div className="text-lg font-bold text-pink-400">{generatedPatients.toLocaleString()}</div>
                      <div className="text-[10px] text-theme-secondary">Patients</div>
                    </div>
                    <div className="rounded-lg bg-surface p-2 border border-theme/20">
                      <div className="text-lg font-bold text-blue-400">{modelCount}</div>
                      <div className="text-[10px] text-theme-secondary">Models</div>
                    </div>
                    <div className="rounded-lg bg-surface p-2 border border-theme/20">
                      <div className="text-lg font-bold text-teal-400">{documentCount.toLocaleString()}</div>
                      <div className="text-[10px] text-theme-secondary">Documents</div>
                    </div>
                  </>
                )}
              </div>
              {!isRefreshJob && job.linksApplied > 0 && (
                <div className="text-xs text-theme-secondary mt-2 text-center">
                  +{job.linksApplied} semantic links applied
                </div>
              )}
              {!isRefreshJob && hasValidationSummary && (
                <div className="mt-3 rounded-md border border-theme/20 bg-surface p-2">
                  <div className="flex items-center justify-between text-[10px] text-theme-secondary">
                    <span>Validation</span>
                    <span className="uppercase">{validationMode || 'sample'}</span>
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-sm font-semibold text-theme-primary">{validatedDocs.toLocaleString()}</div>
                      <div className="text-[10px] text-theme-secondary">Validated</div>
                    </div>
                    <div>
                      <div className={`text-sm font-semibold ${validationFailures > 0 ? 'text-yellow-400' : 'text-theme-primary'}`}>
                        {validationFailures.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-theme-secondary">Failed</div>
                    </div>
                    <div>
                      <div className={`text-sm font-semibold ${skippedDocs > 0 ? 'text-amber-400' : 'text-theme-primary'}`}>
                        {skippedDocs.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-theme-secondary">Skipped</div>
                    </div>
                  </div>
                  {validationMode === 'sample' && validationCheckedLimit > 0 && (
                    <div className="mt-1 text-[10px] text-theme-secondary text-center">
                      Sample size: {validationCheckedLimit.toLocaleString()}
                    </div>
                  )}
                  {(validationGenerationFailures > 0 || validationValidatorFailures > 0 || validationTransformFailures > 0) && (
                    <div className="mt-1 text-[10px] text-theme-secondary text-center">
                      Source: generation {validationGenerationFailures} · validator {validationValidatorFailures} · transform {validationTransformFailures}
                    </div>
                  )}
                  {validationTemplatesTotal > 0 && (
                    <div className="mt-1 text-[10px] text-theme-secondary text-center">
                      Validator coverage: {validationTemplatesWithValidator}/{validationTemplatesTotal}
                      {validationTemplatesWithoutValidator > 0 ? ` (${validationTemplatesWithoutValidator} without OPT)` : ''}
                    </div>
                  )}
                  {topValidationReasons.length > 0 && (
                    <div className="mt-2 border-t border-theme/20 pt-2 text-[10px]">
                      <div className="text-theme-secondary mb-1">Top reasons</div>
                      <div className="space-y-0.5">
                        {topValidationReasons.map(([reason, count], idx) => (
                          <div key={`reason-${idx}`} className="flex justify-between gap-2 text-theme-primary">
                            <span className="truncate">{reason}</span>
                            <span className="text-theme-secondary">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {topValidationTemplates.length > 0 && (
                    <div className="mt-2 text-[10px] text-theme-secondary text-center">
                      Top templates:{' '}
                      {topValidationTemplates.map(([tid, count]) => `${tid} (${count})`).join(' · ')}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Storage */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-theme-secondary mb-2 font-medium">Storage</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-theme-secondary">Database</span>
                  <span className="font-mono text-theme-primary">{targetDatabase}</span>
                </div>
                {targetCollectionList.length > 0 && (
                  <div>
                    <span className="text-theme-secondary">Collections</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {targetCollectionList.map((col, i) => (
                        <span key={i} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono text-[10px]">
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {requestModelSource && (
                  <div className="flex justify-between">
                    <span className="text-theme-secondary">Model Catalog</span>
                    <span className="font-mono text-theme-primary text-[10px]">
                      {requestModelSource.database_name}.{requestModelSource.catalog_collection}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Error/warning details */}
          {(job.status === 'failed' || job.status === 'warning') && job.error && (
            <div className={`mt-4 p-3 rounded-lg ${job.status === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/20' : 'bg-error/10 border border-error/20'}`}>
              <div className={`text-xs font-medium mb-1 ${job.status === 'warning' ? 'text-yellow-400' : 'text-error'}`}>
                {job.status === 'warning' ? 'Warning' : 'Error'}
              </div>
              <p className={`text-xs ${job.status === 'warning' ? 'text-yellow-300/90' : 'text-error/90'}`}>{job.error}</p>
              {job.errorCode && (
                <p className={`text-[10px] mt-1 ${job.status === 'warning' ? 'text-yellow-300/70' : 'text-error/70'}`}>Code: {job.errorCode}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DataHistoryView;
