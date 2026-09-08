"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, RefreshCcw, CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import { useTheme } from './ThemedLayout';

const WorkspaceHealthView = ({ activeEnvironment }) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);
  const [runs, setRuns] = useState([]);

  const formatDateTime = (value) => {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleString();
  };

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = {};
      if (activeEnvironment?.id) headers['x-active-env'] = activeEnvironment.id;
      const res = await fetch('/api/workspace/health', { headers });
      if (!res.ok) throw new Error('Failed to load workspace health');
      const data = await res.json();
      setHealth(data);
      setRuns(Array.isArray(data.healthRuns) ? data.healthRuns : []);
    } catch (err) {
      setError(err.message || 'Unable to fetch health status');
    } finally {
      setLoading(false);
    }
  }, [activeEnvironment?.id]);

  const runHealthCheck = async () => {
    setRunning(true);
    setError(null);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (activeEnvironment?.id) headers['x-active-env'] = activeEnvironment.id;
      const res = await fetch('/api/workspace/health', { method: 'POST', headers });
      if (!res.ok) throw new Error('Failed to run health check');
      const data = await res.json();
      setHealth(data);
      setRuns(Array.isArray(data.healthRuns) ? data.healthRuns : []);
    } catch (err) {
      setError(err.message || 'Unable to run health check');
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div
        className="rounded-xl border p-6"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-theme-primary flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              Workspace Health
            </h1>
            <p className="text-sm text-theme-secondary mt-1">
              Run a snapshot and review history without leaving the app.
            </p>
          </div>
          <button
            onClick={runHealthCheck}
            disabled={running}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-text hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCcw className={`w-4 h-4 ${running ? 'animate-spin' : ''}`} />
            Run Health Check
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          className="rounded-xl border p-5"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <p className="text-xs uppercase tracking-wide text-theme-secondary mb-2">Health Score</p>
          <p className="text-3xl font-semibold text-theme-primary">
            {loading ? '...' : `${health?.journey?.percentage ?? 0}%`}
          </p>
          <p className="text-sm text-theme-secondary mt-1">
            {loading ? 'Loading...' : `${health?.journey?.completedSteps ?? 0} of ${health?.journey?.totalSteps ?? 0} checks passing`}
          </p>
        </div>

        <div
          className="rounded-xl border p-5"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <p className="text-xs uppercase tracking-wide text-theme-secondary mb-2">Workspace</p>
          <p className="text-base font-medium text-theme-primary">
            {loading ? 'Loading...' : (health?.workspace?.name || 'Unknown')}
          </p>
          <p className="text-sm text-theme-secondary mt-1">
            {loading ? '' : `Type: ${health?.workspace?.type || 'n/a'}`}
          </p>
        </div>

        <div
          className="rounded-xl border p-5"
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <p className="text-xs uppercase tracking-wide text-theme-secondary mb-2">Last Snapshot</p>
          <p className="text-base font-medium text-theme-primary">
            {loading ? 'Loading...' : formatDateTime(health?.generatedAt)}
          </p>
          <p className="text-sm text-theme-secondary mt-1">
            {loading ? '' : `Environment: ${health?.environment?.name || 'Not selected'}`}
          </p>
        </div>
      </div>

      <div
        className="rounded-xl border p-6"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <h2 className="text-base font-semibold text-theme-primary mb-4">Health Checks</h2>
        {loading ? (
          <p className="text-sm text-theme-secondary">Loading checks...</p>
        ) : (
          <div className="space-y-2">
            {(health?.journey?.steps || []).map((step, index) => (
              <div
                key={step.id || index}
                className="rounded-lg border border-theme/40 px-3 py-2 flex items-start justify-between gap-3"
              >
                <div>
                  <p className="text-sm text-theme-primary font-medium">
                    {index + 1}. {step.title}
                  </p>
                  <p className="text-xs text-theme-secondary mt-0.5">{step.description}</p>
                  {step.details && (
                    <p className="text-xs text-amber-300 mt-1">{step.details}</p>
                  )}
                  {step.metrics && (
                    <p className="text-xs text-theme-secondary mt-1">
                      {Object.entries(step.metrics).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                    </p>
                  )}
                </div>
                <div className={`inline-flex items-center gap-1 text-sm font-medium ${
                  step.status === 'pass' ? 'text-emerald-400' : step.status === 'warn' ? 'text-amber-300' : 'text-red-300'
                }`}>
                  {step.status === 'pass' ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  {step.status === 'pass' ? 'Pass' : step.status === 'warn' ? 'Warn' : 'Fail'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="rounded-xl border p-6"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <h2 className="text-base font-semibold text-theme-primary mb-4">Run History</h2>
        {loading ? (
          <p className="text-sm text-theme-secondary">Loading history...</p>
        ) : runs.length === 0 ? (
          <p className="text-sm text-theme-secondary">No runs saved yet. Click "Run Health Check" to create one.</p>
        ) : (
          <div className="space-y-2">
            {runs.map((run, idx) => (
              <div
                key={run.id || idx}
                className="rounded-lg border border-theme/40 px-3 py-2 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-theme-primary">{formatDateTime(run.createdAt || run.generatedAt)}</p>
                  <p className="text-xs text-theme-secondary">
                    {run.workspaceName || 'Workspace'} · {run.environmentName || 'No environment'}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 text-emerald-400 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  {run?.journey?.percentage ?? 0}%
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceHealthView;
