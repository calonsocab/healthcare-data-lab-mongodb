// src/components/views/apiTesting/DomainAPIDocs.jsx
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  ExternalLink,
  Maximize2,
  AlertTriangle,
  RefreshCw,
  Book,
  Server
} from 'lucide-react';
import { DomainTabs } from '@/components/views/catalog/DomainTabs';
import { getPublicKehrnelBaseUrl } from '@/lib/kehrnel/url';


/**
 * DomainAPIDocs - Shows ReDoc documentation for each active domain
 *
 * Kehrnel API docs are scoped in 3 levels: core, domain, and strategy.
 * This component focuses on domain-level docs (shared APIs for a domain).
 *
 * URL patterns:
 * - Domain docs: {BASE_URL}/redoc/domains/{domain}
 * - OpenAPI spec: {BASE_URL}/openapi/domains/{domain}.json
 */
const DomainAPIDocs = ({ activeEnvironment, kehrnelBaseUrl }) => {
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [iframeError, setIframeError] = useState({});
  const [loadingDomain, setLoadingDomain] = useState({});

  // Helper to infer domain from strategy name/id if not explicitly set
  const inferDomainFromStrategy = (link) => {
    // Check explicit domain property first
    if (link.domain) return link.domain.toLowerCase();
    if (link.kehrnel?.domain) return link.kehrnel.domain.toLowerCase();

    // Check link ID pattern: "link-{domain}-{timestamp}"
    if (link.id && typeof link.id === 'string') {
      const idMatch = link.id.match(/^link-(\w+)-\d+$/);
      if (idMatch) {
        const domainFromId = idMatch[1].toLowerCase();
        if (['openehr', 'fhir', 'genomics'].includes(domainFromId)) {
          return domainFromId;
        }
      }
    }

    // Try to infer from strategy name or ID
    const searchText = [
      link.strategyName,
      link.strategyId,
      link.alias,
      link.kehrnel?.strategyId
    ].filter(Boolean).join(' ').toLowerCase();

    if (searchText.includes('fhir')) return 'fhir';
    if (searchText.includes('openehr')) return 'openehr';
    if (searchText.includes('genomic')) return 'genomics';

    return null;
  };

  // Get active domains from environment strategy links
  const activeDomains = useMemo(() => {
    const links = activeEnvironment?.strategyLinks;

    if (!links || !Array.isArray(links) || links.length === 0) {
      return [];
    }

    // Extract unique domains with their strategy info
    const domainMap = new Map();
    links.forEach((link) => {
      const domain = inferDomainFromStrategy(link);

      if (domain) {
        if (!domainMap.has(domain)) {
          domainMap.set(domain, {
            domain: domain,
            originalDomain: link.domain || domain,
            strategyName: link.strategyName || link.alias || link.kehrnel?.strategyId || link.strategyId,
            link
          });
        }
      }
    });

    return Array.from(domainMap.values());
  }, [activeEnvironment?.strategyLinks]);

  // Set initial selected domain
  useEffect(() => {
    if (activeDomains.length > 0 && !selectedDomain) {
      setSelectedDomain(activeDomains[0].domain);
    }
  }, [activeDomains, selectedDomain]);

  // Load ReDoc when domain changes
  useEffect(() => {
    if (!selectedDomain) return;

    let cancelled = false;

    const initReDoc = () => {
      if (cancelled) return;
      const container = document.getElementById(`redoc-${selectedDomain}`);
      if (container && window.Redoc) {
        window.Redoc.init(
          getOpenApiUrl(selectedDomain),
          {
            scrollYOffset: 0,
            hideDownloadButton: false,
            theme: { colors: { primary: { main: '#4A9EBD' } } }
          },
          container
        );
      }
    };

    // Redoc ships a UMD bundle that prefers AMD when `define.amd` is present.
    // Monaco Editor (used elsewhere in the app) installs its own AMD loader,
    // which causes "Can only have one anonymous define call per script file"
    // when Redoc tries to register. Hide `define` across the load so Redoc
    // falls through to the plain `window.Redoc` global, then restore it.
    const loadRedocScript = () => {
      if (window.__redocLoadPromise) return window.__redocLoadPromise;

      window.__redocLoadPromise = new Promise((resolve, reject) => {
        const savedDefine = window.define;
        const hadDefine = Object.prototype.hasOwnProperty.call(window, 'define');
        try { window.define = undefined; } catch { /* ignore */ }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/redoc@2/bundles/redoc.standalone.js';
        script.async = true;
        const restoreDefine = () => {
          if (hadDefine) {
            try { window.define = savedDefine; } catch { /* ignore */ }
          } else {
            try { delete window.define; } catch { window.define = undefined; }
          }
        };
        script.onload = () => { restoreDefine(); resolve(); };
        script.onerror = (e) => { restoreDefine(); reject(e); };
        document.body.appendChild(script);
      });

      return window.__redocLoadPromise;
    };

    if (window.Redoc) {
      initReDoc();
    } else {
      loadRedocScript().then(initReDoc).catch((err) => {
        console.error('Failed to load Redoc:', err);
      });
    }

    return () => { cancelled = true; };
  }, [selectedDomain]);


  // Get Kehrnel base URL from environment settings
  const kehrnelUrl = useMemo(() => {
    // Priority: environment kehrnel settings > prop > env variable > default
    if (activeEnvironment?.kehrnel?.apiUrl) {
      return activeEnvironment.kehrnel.apiUrl;
    }
    // Check if using a kehrnel instance connection
    if (activeEnvironment?.strategyLinks?.[0]?.kehrnel?.runtimeUrl) {
      return activeEnvironment.strategyLinks[0].kehrnel.runtimeUrl;
    }
    return kehrnelBaseUrl
      || process.env.NEXT_PUBLIC_BACKEND_URL
      || process.env.NEXT_PUBLIC_KEHRNEL_AQL_ENDPOINT
      || getPublicKehrnelBaseUrl();
  }, [activeEnvironment, kehrnelBaseUrl]);

  // Build ReDoc URL for a domain - for fullscreen/new tab, open the backend directly
  const getReDocUrl = (domain) => {
    return `${kehrnelUrl}/redoc/domains/${domain}`;
  };

  // Build OpenAPI spec URL for a domain - use Next.js proxy to avoid CORS and mixed content
  const getOpenApiUrl = (domain) => {
    return `/api/kehrnel/openapi/domains/${domain}`;
  };

  // Open ReDoc in fullscreen (new tab) via Next.js proxy page.
  // Using the proxy avoids exposing the internal Kehrnel hostname to the browser.
  const openFullscreen = (domain) => {
    window.open(`/api/kehrnel/redoc/domains/${domain}`, '_blank', 'noopener,noreferrer');
  };

  // Handle iframe load events
  const handleIframeLoad = (domain) => {
    setLoadingDomain(prev => ({ ...prev, [domain]: false }));
  };

  const handleIframeError = (domain) => {
    setIframeError(prev => ({ ...prev, [domain]: true }));
    setLoadingDomain(prev => ({ ...prev, [domain]: false }));
  };

  // Retry loading
  const retryLoad = (domain) => {
    setIframeError(prev => ({ ...prev, [domain]: false }));
    setLoadingDomain(prev => ({ ...prev, [domain]: true }));
  };

  // Get domain label for display
  const getDomainLabel = (domain) => {
    const labels = { openehr: 'openEHR®', fhir: 'FHIR®', genomics: 'Genomics', contextobjects: 'ContextObjects' };
    return labels[domain] || domain;
  };

  if (activeDomains.length === 0) {
    return (
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-8 text-center">
        <Server className="w-12 h-12 text-slate-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No Active Domains</h3>
        <p className="text-sm text-slate-400 max-w-md mx-auto">
          Activate a strategy in the Strategy Studio to view domain-level API documentation.
          Each domain (openEHR, FHIR, Genomics) has its own set of shared APIs.
        </p>
      </div>
    );
  }

  // Get enabled domains from activeDomains for DomainTabs
  const enabledDomains = activeDomains.map(d => d.domain);

  return (
    <div className="space-y-4">
      {/* Header with domain selector tabs */}
      <div className="flex items-center justify-between">
        {/* Domain Tabs */}
        <DomainTabs
          activeDomain={selectedDomain}
          onDomainChange={setSelectedDomain}
          enabledDomains={enabledDomains}
          showAll={false}
        />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => openFullscreen(selectedDomain)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            title="Open in new tab"
          >
            <Maximize2 className="w-4 h-4" />
            Open Fullscreen
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ReDoc iframe container */}
      {selectedDomain && (
        <div className="relative">
          {/* Loading overlay */}
          {loadingDomain[selectedDomain] && (
            <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10 rounded-xl">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 text-blue-400 mx-auto mb-3 animate-spin" />
                <p className="text-sm text-slate-300">Loading {getDomainLabel(selectedDomain)} API Documentation...</p>
              </div>
            </div>
          )}

          {/* Error state */}
          {iframeError[selectedDomain] ? (
            <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">Unable to Load Documentation</h3>
              {selectedDomain === 'fhir' ? (
                <div className="text-sm text-slate-400 mb-4 max-w-2xl mx-auto space-y-2">
                  <p>FHIR ReDoc preview is pending in this UI (TODO).</p>
                  <p className="text-slate-300">
                    Use: <code className="text-emerald-400">{`${kehrnelUrl || 'https://kehrnel.example.com'}/redoc/domains/fhir`}</code>
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-400 mb-4 max-w-md mx-auto">
                  The embedded ReDoc documentation could not be loaded. This may be due to CORS restrictions
                  or the Kehrnel server not being available.
                </p>
              )}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => retryLoad(selectedDomain)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
                <button
                  onClick={() => openFullscreen(selectedDomain)}
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-primary-text rounded-lg transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in New Tab
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-4">
                URL: <code className="text-slate-400">{`/api/kehrnel/redoc/domains/${selectedDomain}`}</code>
              </p>
            </div>
          ) : (
            <div
              className="rounded-xl overflow-auto border border-slate-700 bg-white"
              style={{ height: 'calc(100vh - 240px)', minHeight: '500px' }}
            >
              {/* ReDoc will be rendered here */}
              <div id={`redoc-${selectedDomain}`} className="w-full h-full" />
            </div>
          )}

          {/* Footer */}
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <code className="text-slate-400">{`/api/kehrnel/redoc/domains/${selectedDomain}`}</code>
            <span>Served by Kehrnel</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DomainAPIDocs;
