// src/components/views/apiTesting/APITestingDoc.jsx
"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Book, Sparkles, Database, FileText, FileJson, GitBranch, Terminal
} from 'lucide-react';
import DomainAPIDocs from './DomainAPIDocs';
import { SandboxRuntimeProvider } from './SandboxRuntimeProvider';
import EhrRecordsTab from './tabs/EhrRecordsTab';
import TemplatesTab from './tabs/TemplatesTab';
import CompositionsTab from './tabs/CompositionsTab';
import ContributionsTab from './tabs/ContributionsTab';
import AqlQueryTab from './tabs/AqlQueryTab';
import SandboxRuntimeBanner from './components/SandboxRuntimeBanner';
import { consumeSandboxAqlLaunch, readSandboxAqlDraft } from '@/lib/sandbox/aqlDraft';

const KEHRNEL_BASE_URL = '/api/kehrnel/openehr';

const exploreOptions = [
  { key: 'ehr', label: 'EHR Records', icon: Database },
  { key: 'templates', label: 'Templates', icon: FileText },
  { key: 'compositions', label: 'Compositions', icon: FileJson },
  { key: 'contributions', label: 'Contributions', icon: GitBranch },
  { key: 'aql', label: 'AQL Query', icon: Terminal },
];

const KNOWN_EXPLORE_KEYS = new Set(exploreOptions.map((o) => o.key));

const SandboxShell = () => {
  const location = useLocation();
  const [activeExplore, setActiveExplore] = useState('ehr');

  // Honor deep-links like ?explore=aql and lab-originated launches.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const launchContext = consumeSandboxAqlLaunch();
    const params = new URLSearchParams(location.search || window.location.search);
    const requestedExplore = params.get('explore') || launchContext?.explore || '';
    if (requestedExplore && KNOWN_EXPLORE_KEYS.has(requestedExplore)) {
      setActiveExplore(requestedExplore);
      return;
    }
    // If the draft-aql flow set an implicit launch context, jump to the AQL tab.
    if (readSandboxAqlDraft()) {
      setActiveExplore('aql');
    }
  }, [location.search]);

  const navigateToTemplates = useCallback(() => setActiveExplore('templates'), []);

  return (
    <div className="space-y-4">
      <SandboxRuntimeBanner />

      <div className="space-y-5">
        <div className="overflow-x-auto border-b border-border">
          <nav className="flex min-w-max gap-1" aria-label="Sandbox sections">
            {exploreOptions.map((opt) => {
              const Icon = opt.icon;
              const isActive = activeExplore === opt.key;

              return (
                <button
                  key={opt.key}
                  onClick={() => setActiveExplore(opt.key)}
                  className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-theme-secondary hover:border-border hover:text-theme-primary'
                  }`}
                  aria-pressed={isActive}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="min-w-0">
          {activeExplore === 'ehr' && <EhrRecordsTab />}
          {activeExplore === 'templates' && <TemplatesTab />}
          {activeExplore === 'compositions' && <CompositionsTab onNavigateToTemplates={navigateToTemplates} />}
          {activeExplore === 'aql' && <AqlQueryTab />}
          {activeExplore === 'contributions' && <ContributionsTab />}
        </div>
      </div>
    </div>
  );
};

// Mode can be: 'docs' (API Documentation only), 'sandbox' (Data Sandbox only), or 'all' (both with tabs)
const APITestingDoc = ({ activeEnvironment, mode = 'all' }) => {
  const [activeTab, setActiveTab] = useState(mode === 'docs' ? 'docs' : 'explore');

  if (mode === 'docs') {
    return (
      <div className="w-full max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-theme-primary">API</h1>
          <p className="text-theme-secondary">Explore and test the OpenEHR REST API endpoints</p>
        </div>
        <DomainAPIDocs activeEnvironment={activeEnvironment} kehrnelBaseUrl={KEHRNEL_BASE_URL} />
      </div>
    );
  }

  if (mode === 'sandbox') {
    return (
      <div className="w-full max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-theme-primary">Sandbox</h1>
          <p className="text-theme-secondary">Explore EHR records, templates, compositions, and run AQL queries</p>
        </div>
        <SandboxRuntimeProvider activeEnvironment={activeEnvironment}>
          <SandboxShell />
        </SandboxRuntimeProvider>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => setActiveTab('docs')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'docs'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <Book className="w-4 h-4" />
          API Documentation
        </button>
        <button
          onClick={() => setActiveTab('explore')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'explore'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Data Sandbox
        </button>
      </div>

      {activeTab === 'docs' && (
        <DomainAPIDocs activeEnvironment={activeEnvironment} kehrnelBaseUrl={KEHRNEL_BASE_URL} />
      )}

      {activeTab === 'explore' && (
        <SandboxRuntimeProvider activeEnvironment={activeEnvironment}>
          <SandboxShell />
        </SandboxRuntimeProvider>
      )}
    </div>
  );
};

export default APITestingDoc;
