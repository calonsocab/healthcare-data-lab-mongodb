// src/components/views/deployStrategies/DeployStrategies.jsx
"use client";

import React, { useEffect, useState } from 'react';
import {
  ExternalLink,
  Lock,
} from 'lucide-react';
import DeployWizard from './DeployWizard';
import DeveloperGuide from './DeveloperGuide';
import { LicenseNotice } from '@/components/common/TrademarkDisclaimers';

/**
 * DeployStrategies - Focused view for deploying new Kehrnel strategy packs
 *
 * This view provides an admin-only deploy flow, plus a short entry screen
 * that links to the canonical manual in the Learning Center.
 */
const DeployStrategies = ({ activeEnvironment, onEnvironmentRefresh, onNavigate }) => {
  const [activeTab, setActiveTab] = useState('guide');
  const [adminCtx, setAdminCtx] = useState({ loading: true, isAdmin: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/platform/admin-context', { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setAdminCtx({ loading: false, isAdmin: data?.isAdmin === true });
      } catch {
        if (cancelled) return;
        setAdminCtx({ loading: false, isAdmin: false });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleDeployComplete = async () => {
    // Refresh environment after deploying a new pack
    if (onEnvironmentRefresh) await onEnvironmentRefresh();
  };

  const tabs = [
    { id: 'guide', label: 'Getting Started' },
    { id: 'deploy', label: 'Deploy Pack' },
    { id: 'sdk', label: 'SDK Reference' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Deploy Your Strategy</h1>
          <p className="text-sm text-slate-400">
            Create and deploy your own custom persistence strategies to {`{kehrnel}`}
          </p>
        </div>
        {onNavigate && (
          <button
            onClick={() => onNavigate('learn:deploy-your-strategy')}
            className="px-3 py-2 rounded-lg text-sm border border-slate-700 bg-slate-900/30 text-slate-200 hover:bg-slate-900/50"
          >
            Open Tutorial in Learn
          </button>
        )}
      </div>

      {/* CC BY 4.0 License Notice */}
      <div className="max-w-5xl mx-auto">
        <LicenseNotice variant="short" className="text-slate-400" />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-700">
        <nav className="flex gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isDeployLocked = tab.id === 'deploy' && !adminCtx.loading && !adminCtx.isAdmin;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (isDeployLocked) return;
                  setActiveTab(tab.id);
                }}
                disabled={isDeployLocked}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white hover:border-slate-600'
                } ${isDeployLocked ? 'opacity-50 cursor-not-allowed hover:text-slate-400 hover:border-transparent' : ''}`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[500px]">
        {activeTab === 'guide' && (
          <GuideOverview
            onStartDeploy={() => setActiveTab('deploy')}
            onOpenLearning={onNavigate ? () => onNavigate('learn:deploy-your-strategy') : null}
            deployLocked={(!adminCtx.loading && !adminCtx.isAdmin)}
          />
        )}

        {activeTab === 'deploy' && (
          adminCtx.loading ? (
            <div className="text-slate-400 text-sm">Checking admin permissions...</div>
          ) : adminCtx.isAdmin ? (
            <DeployWizard
              activeEnvironment={activeEnvironment}
              onDeployed={handleDeployComplete}
            />
          ) : (
            <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-6">
              <div className="flex items-center gap-2 text-slate-200 font-semibold">
                <Lock className="w-4 h-4" />
                Admin Only
              </div>
              <div className="mt-2 text-sm text-slate-400">
                Deploying strategy packs modifies the system strategy catalog and is restricted to platform administrators.
              </div>
            </div>
          )
        )}

        {activeTab === 'sdk' && (
          <DeveloperGuide />
        )}
      </div>
    </div>
  );
};

/**
 * GuideOverview - Minimal in-app entry that delegates the full manual to Learn
 */
const GuideOverview = ({ onStartDeploy, onOpenLearning, deployLocked }) => {
  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-6">
        <h2 className="text-xl font-semibold text-white">Deploy Strategy Packs</h2>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">
          This page is intentionally brief. The canonical manual for building and deploying strategies lives in the Learning Center.
        </p>

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={onStartDeploy}
            disabled={deployLocked}
            className="px-4 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            Go to Deploy Pack
          </button>
          {onOpenLearning && (
            <button
              onClick={onOpenLearning}
              className="px-4 py-2 rounded-lg text-sm border border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-900/60"
            >
              Open Manual in Learn
            </button>
          )}
          <a
            href="https://github.com/mongodb-industry-solutions/kehrnel"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 rounded-lg text-sm border border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-900/60 inline-flex items-center gap-2"
          >
            View {`{kehrnel}`} SDK
            <ExternalLink className="w-4 h-4 text-slate-300" />
          </a>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-6">
        <div className="flex items-center gap-2 text-slate-200 font-semibold">
          <Lock className="w-4 h-4" />
          Admin Only
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Publishing strategy packs modifies the system strategy catalog and is restricted to platform administrators.
        </p>
      </div>
    </div>
  );
};

export default DeployStrategies;
