"use client";

import React, { useEffect, useState } from 'react';
import {
  Plus, RefreshCw, Database, FileJson, Clock, Copy, Check, Eye, Trash2, X, Loader2
} from 'lucide-react';
import {
  Badge, Card, Button, Input, EmptyState, ErrorAlert, JsonViewer
} from '../components/ui';
import {
  getEhrId, getTimeCreated, getSubjectId, getSubjectNamespace
} from '../lib/ehr';
import { useSandboxRuntime } from '../SandboxRuntimeProvider';

export default function EhrRecordsTab() {
  const {
    ehrRecords, ehrLoading, ehrError, ehrLoaded,
    fetchEhrRecords, ensureEhrRecords, apiFetch
  } = useSandboxRuntime();

  const [newEhrSubjectId, setNewEhrSubjectId] = useState('');
  const [newEhrNamespace, setNewEhrNamespace] = useState('');
  const [creatingEhr, setCreatingEhr] = useState(false);
  const [localError, setLocalError] = useState('');
  const [selectedEhr, setSelectedEhr] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => { ensureEhrRecords(); }, [ensureEhrRecords]);

  const error = localError || ehrError;

  const copyToClipboard = async (text, id) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateEhr = async (e) => {
    e.preventDefault();
    setCreatingEhr(true);
    setLocalError('');
    try {
      const body = {
        _type: 'EHR_STATUS',
        subject: {
          _type: 'PARTY_SELF',
          external_ref: {
            id: { value: newEhrSubjectId || crypto.randomUUID() },
            namespace: newEhrNamespace || 'patients',
            type: 'PERSON',
          },
        },
        is_modifiable: true,
        is_queryable: true,
      };
      const res = await apiFetch('/ehr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || `Failed to create EHR: ${res.status}`);
      }
      const raw = await res.text();
      let created = null;
      if (raw) {
        try { created = JSON.parse(raw); } catch { created = null; }
      }
      setSelectedEhr(created);
      await fetchEhrRecords();
      setNewEhrSubjectId('');
      setNewEhrNamespace('');
    } catch (err) {
      setLocalError(err.message);
    } finally {
      setCreatingEhr(false);
    }
  };

  const fetchEhrById = async (ehrId) => {
    try {
      const res = await apiFetch(`/ehr/${encodeURIComponent(ehrId)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to fetch EHR: ${res.status}`);
      }
      setSelectedEhr(await res.json());
    } catch (err) {
      setLocalError(err.message);
    }
  };

  const handleDeleteEhr = async (ehrId) => {
    if (!confirm(`Are you sure you want to delete EHR ${ehrId}? This cannot be undone.`)) return;
    setLocalError('');
    try {
      const res = await apiFetch(`/ehr/${encodeURIComponent(ehrId)}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to delete EHR: ${res.status}`);
      }
      setSelectedEhr(null);
      await fetchEhrRecords();
    } catch (err) {
      setLocalError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <Plus className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-200">Create New EHR</h3>
            <p className="text-sm text-slate-500">Create a new Electronic Health Record</p>
          </div>
        </div>
        <form onSubmit={handleCreateEhr} className="flex flex-wrap gap-4 items-end">
          <Input
            label="Subject ID (optional)"
            placeholder="e.g., patient-123"
            value={newEhrSubjectId}
            onChange={(e) => setNewEhrSubjectId(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Input
            label="Namespace (optional)"
            placeholder="e.g., hospital.org"
            value={newEhrNamespace}
            onChange={(e) => setNewEhrNamespace(e.target.value)}
            className="flex-1 min-w-[200px]"
          />
          <Button type="submit" loading={creatingEhr}>
            <Plus className="w-4 h-4" />
            Create EHR
          </Button>
        </form>
      </Card>

      {error && <ErrorAlert message={error} onDismiss={() => setLocalError('')} />}

      <Card>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-slate-200">EHR Records</h3>
            <Badge variant="info">{ehrRecords.length}</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchEhrRecords} disabled={ehrLoading}>
            <RefreshCw className={`w-4 h-4 ${ehrLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {ehrLoading && !ehrRecords.length ? (
          <div className="p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-slate-500">Loading EHR records...</p>
          </div>
        ) : ehrLoaded && ehrRecords.length === 0 ? (
          <EmptyState
            icon={Database}
            title="No EHR Records"
            description="Create your first Electronic Health Record to get started"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-background">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">EHR ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Created</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Subject ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Namespace</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ehrRecords.map((ehr, idx) => {
                  const ehrId = getEhrId(ehr);
                  const timeCreated = getTimeCreated(ehr);
                  const subjectId = getSubjectId(ehr);
                  const namespace = getSubjectNamespace(ehr);
                  return (
                    <tr key={ehrId || idx} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-4 py-3 min-w-0 max-w-[320px]">
                        <div className="flex items-center gap-2 min-w-0">
                          <code
                            className="text-sm text-emerald-400 font-mono truncate"
                            title={ehrId || ''}
                          >
                            {ehrId || '-'}
                          </code>
                          {ehrId && (
                            <button
                              onClick={() => copyToClipboard(ehrId, `ehr-${idx}`)}
                              className="p-1 text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0"
                              aria-label="Copy EHR id"
                            >
                              {copiedId === `ehr-${idx}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {timeCreated ? (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {timeCreated.toLocaleDateString()}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">{subjectId || '-'}</td>
                      <td className="px-4 py-3">
                        {namespace ? <Badge>{namespace}</Badge> : <span className="text-slate-500">-</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => ehrId && fetchEhrById(ehrId)}
                            disabled={!ehrId}
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => ehrId && handleDeleteEhr(ehrId)}
                            disabled={!ehrId}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selectedEhr && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <FileJson className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-200">EHR Details</h3>
                <code className="text-xs text-slate-500">{getEhrId(selectedEhr)}</code>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(JSON.stringify(selectedEhr, null, 2), 'ehr-detail')}>
                {copiedId === 'ehr-detail' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedEhr(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <JsonViewer data={selectedEhr} />
        </Card>
      )}
    </div>
  );
}
