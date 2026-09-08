"use client";

import React, { useEffect, useState } from 'react';
import {
  GitBranch, Info, RefreshCw, User, Clock, Copy, Check, Eye, X, Loader2
} from 'lucide-react';
import {
  Badge, Card, Button, EmptyState, ErrorAlert, JsonViewer
} from '../components/ui';
import EhrPicker from '../components/EhrPicker';
import { useSandboxRuntime } from '../SandboxRuntimeProvider';

export default function ContributionsTab() {
  const {
    activeEnvironment,
    ehrRecords, ehrLoaded, ensureEhrRecords,
    contributionsByEhr, contributionsLoadingFor, contributionsErrorByEhr,
    fetchContributions, ensureContributions, apiFetch,
  } = useSandboxRuntime();

  const [selectedEhrForContrib, setSelectedEhrForContrib] = useState('');
  const [selectedContribution, setSelectedContribution] = useState(null);
  const [localError, setLocalError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => { ensureEhrRecords(); }, [ensureEhrRecords]);
  useEffect(() => {
    if (selectedEhrForContrib) ensureContributions(selectedEhrForContrib);
  }, [selectedEhrForContrib, ensureContributions]);

  const contributions = contributionsByEhr[selectedEhrForContrib] || [];
  const contributionsLoading = contributionsLoadingFor === selectedEhrForContrib;
  const error = localError || contributionsErrorByEhr[selectedEhrForContrib] || '';

  const copyToClipboard = async (text, id) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchContributionDetail = async (ehrId, contributionUid) => {
    try {
      const res = await apiFetch(`/ehr/${encodeURIComponent(ehrId)}/contribution/${encodeURIComponent(contributionUid)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to fetch contribution: ${res.status}`);
      }
      setSelectedContribution({ uid: contributionUid, data: await res.json() });
    } catch (err) {
      setLocalError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-slate-500/20 flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-200">Browse Contributions</h3>
            <p className="text-sm text-slate-500">View versioned change sets for an EHR record</p>
          </div>
        </div>

        {ehrLoaded && ehrRecords.length === 0 ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-center gap-3">
            <Info className="w-5 h-5 text-amber-400" />
            <p className="text-sm text-amber-300">No EHR records available. Create an EHR first in the EHR Records tab.</p>
          </div>
        ) : (
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs text-slate-400 mb-1.5">Select EHR</label>
              <EhrPicker
                ehrRecords={ehrRecords}
                value={selectedEhrForContrib}
                onChange={setSelectedEhrForContrib}
                envId={activeEnvironment?.id}
                scope="contributions"
              />
            </div>
            {selectedEhrForContrib && (
              <Button variant="ghost" size="sm" onClick={() => fetchContributions(selectedEhrForContrib)}>
                <RefreshCw className={`w-4 h-4 ${contributionsLoading ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>
        )}
      </Card>

      {error && <ErrorAlert message={error} onDismiss={() => setLocalError('')} />}

      {selectedEhrForContrib && (
        <Card>
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitBranch className="w-5 h-5 text-slate-400" />
              <h3 className="text-lg font-semibold text-slate-200">Contributions</h3>
              <Badge>{contributions.length}</Badge>
            </div>
          </div>

          {contributionsLoading && contributions.length === 0 ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-slate-500">Loading contributions...</p>
            </div>
          ) : contributions.length === 0 ? (
            <EmptyState
              icon={GitBranch}
              title="No Contributions"
              description="This EHR has no versioned changes recorded yet"
            />
          ) : (
            <div className="p-4 space-y-3">
              {contributions.map((contrib, idx) => {
                const uid = contrib.uid?.value || contrib.uid || contrib._id;
                const audit = contrib.audit;
                const changeType = audit?.change_type?.value || 'unknown';
                const committer = audit?.committer?.name || 'Unknown';
                const timeCommitted = audit?.time_committed?.value;

                return (
                  <div
                    key={uid || idx}
                    className="flex items-center justify-between p-4 bg-background rounded-lg border border-border hover:border-slate-500/30 transition-colors group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center group-hover:bg-slate-500/20 transition-colors">
                        <GitBranch className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <code className="text-sm text-slate-300 font-mono">
                            {uid ? `${String(uid).substring(0, 24)}...` : `Contribution ${idx + 1}`}
                          </code>
                          <Badge variant={changeType === 'creation' ? 'success' : changeType === 'modification' ? 'info' : 'default'}>
                            {changeType}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {committer}
                          </span>
                          {timeCommitted && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(timeCommitted).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => uid && fetchContributionDetail(selectedEhrForContrib, uid)}
                      disabled={!uid}
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {selectedContribution && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-500/20 flex items-center justify-center">
                <GitBranch className="w-5 h-5 text-slate-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-200">Contribution Detail</h3>
                <code className="text-xs text-slate-500">{selectedContribution.uid}</code>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(JSON.stringify(selectedContribution.data, null, 2), 'contrib-detail')}>
                {copiedId === 'contrib-detail' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                Copy
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedContribution(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <JsonViewer data={selectedContribution.data} maxHeight={500} />
        </Card>
      )}
    </div>
  );
}
