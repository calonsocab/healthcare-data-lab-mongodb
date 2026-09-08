// src/components/views/layout/HomeDashboard.jsx
"use client";

import React, { useState, useEffect } from 'react';
import {
  FileText, Code, ChevronRight, ChevronDown,
  Github, Activity, Clock,
  Sparkles, Rocket, TrendingUp, Users,
  X, RefreshCcw, ShieldCheck, CheckCircle2
} from 'lucide-react';
import { useTheme } from './ThemedLayout';
import GuidedJourney from './GuidedJourney';
import { useAQLQueries } from '@/providers/AQLQueryProvider';
import { useDataModels } from '@/providers/DataModelProvider';

/* Kehrnel logo component */
const KehrnelLogo = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl'
  };
  return (
    <div className={`flex items-center font-bold ${sizeClasses[size]}`}>
      <span className="text-[#4A9EBD]">{`{ `}</span>
      <span className="text-[#EA6635]">k</span>
      <span className="text-[#4A9EBD]">e</span>
      <span className="text-[#4A9EBD]">h</span>
      <span className="text-[#4A9EBD]">r</span>
      <span className="text-[#EA6635]">n</span>
      <span className="text-[#EA6635]">e</span>
      <span className="text-[#EA6635]">l</span>
      <span className="text-[#4A9EBD]">{` }`}</span>
    </div>
  );
};

const HomeDashboard = ({ team, onNavigate, activeEnvironment }) => {
  const { theme, getGradientContrastTextColor } = useTheme();
  const { getRecentQueries, queries: cachedQueries } = useAQLQueries();
  const { dataModelsByName } = useDataModels();
  const [healthLoading, setHealthLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [healthRunLoading, setHealthRunLoading] = useState(false);
  const [health, setHealth] = useState(null);
  const [healthRuns, setHealthRuns] = useState([]);
  const [healthRunError, setHealthRunError] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [activeSlide, setActiveSlide] = useState(0);
  const [showWelcomeBanner, setShowWelcomeBanner] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('hdl-welcome-banner-dismissed') !== 'true';
    }
    return true;
  });
  const [welcomeExpanded, setWelcomeExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('hdl-welcome-collapsed');
      return stored !== 'true';
    }
    return true;
  });
  const [welcomeTab, setWelcomeTab] = useState('what');

  const toggleWelcome = () => {
    const newState = !welcomeExpanded;
    setWelcomeExpanded(newState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hdl-welcome-collapsed', (!newState).toString());
    }
  };

  const dismissWelcomeBanner = () => {
    setShowWelcomeBanner(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hdl-welcome-banner-dismissed', 'true');
    }
  };

  // Hero banner slides
  const heroSlides = [
    {
      image: '/images/not-an-art.png',
      title: <>Data modeling doesn’t have<br />to be an art anymore</>,
      subtitle: <>Start with battle-tested models and query patterns.<br /> Built for scale and AI.</>,
      cta: 'Explore Strategies',
      action: 'strategies'
    },
    {
      image: '/images/boat.png',
      title: <>Navigate the<br />Healthcare Data<br />Journey</>,
      subtitle: 'Turn complex clinical data into actionable insights',
      cta: 'Start Exploring',
      action: 'strategies'
    }
  ];

  // Auto-rotate slides (10 seconds per slide)
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [heroSlides.length]);

  useEffect(() => {
    setHealthLoading(true);
    fetch('/api/workspace/health')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setHealth(data);
          setHealthRuns(Array.isArray(data.healthRuns) ? data.healthRuns : []);
        }
      })
      .catch(() => {})
      .finally(() => setHealthLoading(false));
  }, []);

  // Rebuild recent activity whenever cached models/queries change.
  useEffect(() => {
    const activity = [];

    const templates = Object.values(dataModelsByName || {})
      .slice()
      .sort((a, b) => {
        const ta = Date.parse(a?.updatedAt || a?.createdAt || a?.audit?.updatedAt || a?.audit?.createdAt || '') || 0;
        const tb = Date.parse(b?.updatedAt || b?.createdAt || b?.audit?.updatedAt || b?.audit?.createdAt || '') || 0;
        return tb - ta;
      })
      .slice(0, 3);
    templates.forEach(t => {
      activity.push({
        type: 'template',
        id: t._id,
        name: t.name || t.templateId || 'Unnamed Template',
        description: t.metadata?.description || t.concept || 'Template',
        updatedAt: t.updatedAt || t.audit?.updatedAt
      });
    });

    getRecentQueries(3).forEach(q => {
      activity.push({
        type: 'query',
        id: q._id,
        name: q.name || 'Unnamed Query',
        description: q.description || 'AQL Query',
        status: q.mqlTransformationStatus || q.status || 'pending',
        updatedAt: q.updatedAt
      });
    });

    activity.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    setRecentActivity(activity.slice(0, 5));
    setActivityLoading(false);
  }, [dataModelsByName, cachedQueries, getRecentQueries]);

  const runWorkspaceHealthCheck = async () => {
    setHealthRunLoading(true);
    setHealthRunError(null);
    try {
      const headers = {
        'Content-Type': 'application/json'
      };
      if (activeEnvironment?.id) {
        headers['x-active-env'] = activeEnvironment.id;
      }

      const res = await fetch('/api/workspace/health', {
        method: 'POST',
        headers
      });

      if (!res.ok) {
        throw new Error('Health check request failed');
      }

      const data = await res.json();
      setHealth(data);
      setHealthRuns(Array.isArray(data.healthRuns) ? data.healthRuns : []);
    } catch (error) {
      setHealthRunError(error.message || 'Unable to run health check');
    } finally {
      setHealthRunLoading(false);
    }
  };

  const formatRelativeDate = (value) => {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleString();
  };

  const primaryTextColor = getGradientContrastTextColor(theme.primary, theme.primaryHover);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Welcome Modal */}
      {showWelcomeBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={dismissWelcomeBanner}
          />
          {/* Modal */}
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-3xl w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <button
              onClick={dismissWelcomeBanner}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="text-center mb-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-6 h-6 text-emerald-400" />
                </div>
                <h2 className="text-xl font-semibold text-white mb-2">
                  Welcome to Healthcare Data Lab
                </h2>
                <p className="text-slate-300 text-sm leading-relaxed">
                  Watch this quick overview. Once closed or completed, you can replay it anytime from Learning Center.
                </p>
              </div>

              <div className="rounded-lg border border-slate-700 bg-black overflow-hidden mb-5">
                <video
                  className="w-full h-auto max-h-[56vh]"
                  controls
                  playsInline
                  preload="metadata"
                  onEnded={dismissWelcomeBanner}
                >
                  <source src="/videos/learning/home/home-overview/welcome.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    dismissWelcomeBanner();
                    onNavigate('learn:home-overview');
                  }}
                  className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                >
                  Open in Learning Center
                </button>
                <button
                  onClick={dismissWelcomeBanner}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors"
                >
                  Continue to Home
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Banner with Slide Animation */}
      <div
        className="dark-banner rounded-2xl relative overflow-hidden group"
        style={{ minHeight: '320px' }}
      >
        {/* Background Images - Stacked for crossfade */}
        {heroSlides.map((slide, index) => (
          <img
            key={index}
            src={slide.image}
            alt={`Slide ${index + 1}`}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-in-out ${
              index === activeSlide
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-105'
            }`}
          />
        ))}
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent z-10" />
        {/* Content - Animated */}
        <div className="relative z-20 p-10 h-full flex flex-col justify-center max-w-2xl" style={{ minHeight: '320px' }}>
          {heroSlides.map((slide, index) => (
            <div
              key={index}
              className={`absolute transition-all duration-700 ease-in-out ${
                index === activeSlide
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-4 pointer-events-none'
              }`}
            >
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
                {slide.title}
              </h1>
              <p className="text-xl md:text-2xl text-white mb-6 leading-relaxed font-medium">
                {slide.subtitle}
              </p>
              <button
                onClick={() => onNavigate(slide.action)}
                className="px-8 py-4 bg-primary hover:bg-primary-hover text-primary-text font-semibold rounded-xl transition-all duration-300 w-fit flex items-center gap-2 shadow-lg hover:-translate-y-0.5"
              >
                {slide.cta}
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
        {/* Slide Indicators */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex gap-2">
          {heroSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveSlide(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === activeSlide
                  ? 'w-8 bg-white'
                  : 'w-2 bg-white/50 hover:bg-white/70'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Welcome / About Section - Collapsible */}
      <div
        className="rounded-xl border overflow-hidden transition-all duration-300"
        style={{ backgroundColor: theme.surface, borderColor: theme.border }}
      >
        <button
          onClick={toggleWelcome}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-hover transition-colors"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span className="font-medium text-theme-primary text-lg">
              {welcomeExpanded ? 'What is the Healthcare Data Lab?' : 'New here? Learn what this is about'}
            </span>
          </div>
          <ChevronDown
            className={`w-5 h-5 text-theme-secondary transition-transform duration-300 ${
              welcomeExpanded ? 'rotate-180' : ''
            }`}
          />
        </button>

        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
          welcomeExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className="px-6 pb-6">
            {/* Tabs */}
            <div className="flex gap-1 mb-5 border-b border-theme/30">
              {[
                { id: 'what', label: 'What' },
                { id: 'why', label: 'Why' },
                { id: 'benefits', label: 'Benefits' },
                { id: 'ai', label: 'Ready for AI' },
                { id: 'community', label: 'Community' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setWelcomeTab(tab.id)}
                  className={`px-4 py-3 text-base font-medium transition-colors border-b-2 -mb-px ${
                    welcomeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-theme-secondary hover:text-theme-primary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="min-h-[200px]">
              {welcomeTab === 'what' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <div className="rounded-lg p-4 border relative z-10" style={{ backgroundColor: '#e9ff99', borderColor: '#c5e065' }}>
                    <p className="text-base font-semibold leading-relaxed relative z-20" style={{ color: '#00684a' }}>
                      Healthcare Data Lab is a hands-on workspace for learning and building next-generation healthcare apps on MongoDB. Faster, smarter, and AI-ready.
                    </p>
                  </div>
                  <p className="text-base text-theme-secondary leading-relaxed">
                    It brings together proven data models, query patterns, transformation pipelines, and API strategies tailored for healthcare workloads. Teams don't have to reinvent foundations for every project.
                  </p>
                  <p className="text-base text-theme-secondary leading-relaxed">
                    Instead of starting from a blank schema, you start from real-world patterns designed for clinical data, high-performance querying, Search & AI workloads, and evolving healthcare standards.
                  </p>
                </div>
              )}

              {welcomeTab === 'why' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <p className="text-base text-theme-secondary leading-relaxed">
                    Developers are under constant pressure to deliver quickly. But healthcare data is hard: models are complex, requirements evolve mid-project, data must support consumption not just ingestion, and AI-readiness matters from day one.
                  </p>
                  <p className="text-base text-theme-secondary leading-relaxed">
                    Many teams fall back to familiar relational patterns or one-off designs that don't scale, don't generalize, and are hard to evolve.
                  </p>
                  <p className="text-base text-theme-primary leading-relaxed">
                    We built Healthcare Data Lab to capture <span className="font-semibold">what actually works in the field</span> and turn it into reusable building blocks teams can trust. Based on delivery experience, real customer challenges, and production-grade MongoDB patterns.
                  </p>
                </div>
              )}

              {welcomeTab === 'benefits' && (
                <div className="grid grid-cols-2 gap-6 animate-in fade-in duration-300">
                  <div className="text-center">
                    <Rocket className="w-10 h-10 text-theme-secondary mx-auto mb-3" />
                    <p className="text-base font-semibold text-theme-primary mb-2">Build faster</p>
                    <p className="text-sm text-theme-secondary">Start from battle-tested strategies instead of scratch.</p>
                  </div>
                  <div className="text-center">
                    <TrendingUp className="w-10 h-10 text-theme-secondary mx-auto mb-3" />
                    <p className="text-base font-semibold text-theme-primary mb-2">Reuse across projects</p>
                    <p className="text-sm text-theme-secondary">Patterns designed to extend and adapt.</p>
                  </div>
                  <div className="text-center">
                    <Sparkles className="w-10 h-10 text-theme-secondary mx-auto mb-3" />
                    <p className="text-base font-semibold text-theme-primary mb-2">AI-ready by design</p>
                    <p className="text-sm text-theme-secondary">Built for Search, embeddings, and AI workflows.</p>
                  </div>
                  <div className="text-center">
                    <Users className="w-10 h-10 text-theme-secondary mx-auto mb-3" />
                    <p className="text-base font-semibold text-theme-primary mb-2">Upskill your teams</p>
                    <p className="text-sm text-theme-secondary">Explore best practices hands-on.</p>
                  </div>
                </div>
              )}

              {welcomeTab === 'ai' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <p className="text-base text-theme-primary leading-relaxed font-semibold">
                    Ready for AI by design
                  </p>
                  <p className="text-base text-theme-secondary leading-relaxed">
                    Most systems reconstruct context on demand: querying multiple APIs, joining events, and inferring "what situation are we in?" before acting. This logic is duplicated across applications, analytics, and AI workflows, adding latency, cost, and inconsistency.
                  </p>
                  <p className="text-base text-theme-secondary leading-relaxed">
                    Healthcare Data Lab explores context-centric data patterns where situations are persisted as first-class objects.
                  </p>
                  <p className="text-base text-theme-secondary leading-relaxed">
                    These patterns group semantically related data (events, state, metadata, provenance, and AI-native artifacts like summaries and embeddings) into retrieval-aware structures optimized for MongoDB.
                  </p>
                  <p className="text-base text-theme-primary leading-relaxed">This enables:</p>
                  <ul className="space-y-2 text-base text-theme-secondary pl-4">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Agentic workflows that retrieve context instead of reconstructing it</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Fewer database queries and lower operational cost</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>More reliable AI behavior with reduced hallucination risk</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Uniform interaction across data types, not siloed APIs</span>
                    </li>
                  </ul>
                  <p className="text-base text-primary/80 leading-relaxed italic pl-4 border-l-2 border-primary/40">
                    AI becomes something your data model supports naturally, not something bolted on later.
                  </p>
                </div>
              )}

              {welcomeTab === 'community' && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <p className="text-base text-theme-primary leading-relaxed font-semibold">
                    Learn and build together
                  </p>
                  <p className="text-base text-theme-secondary leading-relaxed">
                    Healthcare Data Lab is not a closed framework, it's a shared learning space.
                  </p>
                  <p className="text-base text-theme-secondary leading-relaxed">
                    We build these patterns in collaboration with customers and partners, publish what works, and evolve the platform as new challenges emerge.
                  </p>
                  <p className="text-base text-theme-primary leading-relaxed">You're invited to:</p>
                  <ul className="space-y-2 text-base text-theme-secondary pl-4">
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Explore and adapt existing strategies</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Share patterns validated in your own projects</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Contribute reference apps and workflows</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>Help shape best practices for the healthcare ecosystem</span>
                    </li>
                  </ul>
                  <p className="text-base text-primary/80 leading-relaxed italic pl-4 border-l-2 border-primary/40">
                    The goal is simple: raise the baseline for how healthcare applications are built on MongoDB, together.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Guided Journey - Progress Ribbon */}
      <GuidedJourney health={health} onNavigate={onNavigate} loading={healthLoading} />

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Recent Activity */}
        <div className="lg:col-span-2">
          <div
            className="rounded-xl p-6 border"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Recent Activity
              </h2>
            </div>
            {activityLoading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-12 bg-surface-hover rounded-lg" />
                ))}
              </div>
            ) : recentActivity.length > 0 ? (
              <div className="space-y-2">
                {recentActivity.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
                    onClick={() => onNavigate(item.type === 'template' ? 'templates' : 'lab')}
                  >
                    {item.type === 'template' ? (
                      <FileText className="w-4 h-4 text-teal-400 flex-shrink-0" />
                    ) : (
                      <Code className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-theme-primary truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-theme-secondary truncate">
                        {item.description}
                      </p>
                    </div>
                    {item.type === 'query' && item.status && (
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        item.status === 'done' ? 'bg-success/20 text-success' :
                        item.status === 'needs_improvement' ? 'bg-warning/20 text-warning' :
                        'bg-surface-hover text-theme-secondary'
                      }`}>
                        {item.status === 'done' ? 'Done' :
                         item.status === 'needs_improvement' ? 'Review' :
                         'Pending'}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-theme-secondary" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-theme-secondary">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No recent activity</p>
                <p className="text-xs mt-1">Start by importing a template or creating a query</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Workspace Health */}
          <div
            className="rounded-xl p-6 border"
            style={{ backgroundColor: theme.surface, borderColor: theme.border }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-theme-primary flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Workspace Health
              </h2>
              <button
                onClick={runWorkspaceHealthCheck}
                disabled={healthRunLoading}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md bg-primary text-primary-text hover:bg-primary-hover disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                title="Run and save a health snapshot"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${healthRunLoading ? 'animate-spin' : ''}`} />
                Run
              </button>
            </div>

            <div className="space-y-2 mb-3">
              <p className="text-xs text-theme-secondary">
                Progress: <span className="text-theme-primary font-medium">{health?.journey?.percentage ?? 0}%</span>
              </p>
              <p className="text-xs text-theme-secondary">
                Last snapshot: <span className="text-theme-primary">{formatRelativeDate(health?.generatedAt)}</span>
              </p>
            </div>

            {healthRunError && (
              <p className="text-xs text-red-400 mb-3">{healthRunError}</p>
            )}

            <div className="border-t border-theme/40 pt-3">
              <p className="text-xs uppercase tracking-wide text-theme-secondary mb-2">Recent runs</p>
              {healthRuns.length > 0 ? (
                <div className="space-y-2">
                  {healthRuns.slice(0, 5).map((run, index) => (
                    <div
                      key={run.id || index}
                      className="flex items-center justify-between text-xs rounded-md px-2 py-1.5 bg-surface-hover"
                    >
                      <span className="text-theme-secondary truncate pr-2">
                        {formatRelativeDate(run.createdAt || run.generatedAt)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {run.journey?.percentage ?? 0}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-theme-secondary">No saved runs yet.</p>
              )}
            </div>
          </div>

          {/* Kehrnel Project */}
          <div
            className="rounded-xl p-6 border bg-gradient-to-br from-surface to-background"
            style={{ borderColor: 'rgba(74, 158, 189, 0.3)' }}
          >
            <div className="flex items-center gap-3 mb-3">
              <KehrnelLogo size="md" />
            </div>
            <p className="text-xs text-theme-secondary mb-3">Document-first persistence for open healthcare data</p>
            <a
              href="https://github.com/Paco-Mateu/kehrnel/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-surface hover:bg-surface-hover rounded-lg transition-colors text-sm text-theme-secondary"
            >
              <Github className="w-4 h-4" />
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeDashboard;
