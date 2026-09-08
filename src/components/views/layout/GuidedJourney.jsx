// src/components/views/layout/GuidedJourney.jsx
"use client";

import React, { useState } from 'react';
import {
  CheckCircle2, Database, Layers, FileText, FlaskConical,
  Rocket, ArrowRight, ChevronDown, GraduationCap, Sparkles
} from 'lucide-react';
import LoadingScreen from '@/components/ui/LoadingScreen';

// 5 core steps with detailed content and unique colors
const STEPS = [
  {
    id: 'connect',
    label: 'Connect',
    subtitle: 'MongoDB Atlas',
    icon: Database,
    color: 'emerald', // Green for database/connection
    cta: 'environments',
    ctaLabel: 'Configure Environment',
    description: 'Connect to your MongoDB Atlas cluster to store and query clinical data with enterprise-grade security.',
    bullets: [
      'Configure connection string and credentials',
      'Test connectivity and permissions',
      'Set up multiple environments (dev, staging, prod)'
    ]
  },
  {
    id: 'strategy',
    label: 'Strategy',
    subtitle: 'Data Domain',
    icon: Layers,
    color: 'violet', // Purple for strategy/architecture
    cta: 'strategies',
    ctaLabel: 'Choose Strategy',
    description: 'Select a data persistence strategy that defines how clinical models are stored in MongoDB collections.',
    bullets: [
      'Choose between different modeling strategies (e.g. one collection per template vs. combined collections)',
      'Configure collection names and other settings',
      'Preview document structure before committing'
    ]
  },
  {
    id: 'models',
    label: 'Data Models',
    subtitle: 'Clinical Knowledge',
    icon: FileText,
    color: 'cyan', // Teal for templates/documents
    cta: 'templates',
    ctaLabel: 'Browse Catalog',
    description: 'Import your data models that define clinical data structures, constraints, and terminology bindings.',
    bullets: [
      'Eg. Import from the openEHR CKM uploading templates',
      'View model details',
      'Select the fields for which you wan to enable searches'
    ]
  },
  {
    id: 'data',
    label: 'Data Factory',
    subtitle: 'Generate & Load',
    icon: FlaskConical,
    color: 'amber', // Orange/amber for data generation
    cta: 'synthetic',
    ctaLabel: 'Generate Data',
    description: 'Populate your database with synthetic patient data or map existing records to the clinical models.',
    bullets: [
      'Generate synthetic compositions',
      'Configure the weight distribution per each patient',
      'Map existing data via transformations'
    ]
  },
  {
    id: 'use',
    label: 'Use',
    subtitle: 'Query, APIs and Apps',
    icon: Rocket,
    color: 'rose', // Pink/rose for launch/use
    cta: null,
    ctaLabel: 'Get Started',
    description: 'Run queries, deploy APIs, or install compatible apps to work with your clinical data.',
    bullets: [
      'Learn how to translate queries from API standards to MQL',
      'Store quesries and Deploy REST APIs supporting the model',
      'Browse applications that are compatible with the models'
    ]
  }
];

// Color mapping for Tailwind classes
const COLOR_CLASSES = {
  emerald: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    border: 'border-emerald-500',
    borderLight: 'border-emerald-500/50',
    bgHover: 'hover:bg-emerald-500/10',
    borderHover: 'hover:border-emerald-500',
    shadow: 'shadow-emerald-500/10',
    badge: 'bg-emerald-500'
  },
  violet: {
    bg: 'bg-violet-500/10',
    text: 'text-violet-500',
    border: 'border-violet-500',
    borderLight: 'border-violet-500/50',
    bgHover: 'hover:bg-violet-500/10',
    borderHover: 'hover:border-violet-500',
    shadow: 'shadow-violet-500/10',
    badge: 'bg-violet-500'
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-500',
    border: 'border-cyan-500',
    borderLight: 'border-cyan-500/50',
    bgHover: 'hover:bg-cyan-500/10',
    borderHover: 'hover:border-cyan-500',
    shadow: 'shadow-cyan-500/10',
    badge: 'bg-cyan-500'
  },
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    border: 'border-amber-500',
    borderLight: 'border-amber-500/50',
    bgHover: 'hover:bg-amber-500/10',
    borderHover: 'hover:border-amber-500',
    shadow: 'shadow-amber-500/10',
    badge: 'bg-amber-500'
  },
  rose: {
    bg: 'bg-rose-500/10',
    text: 'text-rose-500',
    border: 'border-rose-500',
    borderLight: 'border-rose-500/50',
    bgHover: 'hover:bg-rose-500/10',
    borderHover: 'hover:border-rose-500',
    shadow: 'shadow-rose-500/10',
    badge: 'bg-rose-500'
  }
};

const GuidedJourney = ({ health, onNavigate, loading = false }) => {
  const [selectedStep, setSelectedStep] = useState(null);
  const [showUseOptions, setShowUseOptions] = useState(false);

  // Calculate step states
  const getStepState = (stepId) => {
    if (loading) return 'loading';
    if (!health) return 'locked';

    switch (stepId) {
      case 'connect':
        return health.environment?.connected ? 'done' : 'next';
      case 'strategy':
        if (!health.environment?.connected) return 'locked';
        return health.strategy?.activeId ? 'done' : 'next';
      case 'models':
        if (!health.strategy?.activeId) return 'locked';
        return health.models?.importedCount > 0 ? 'done' : 'next';
      case 'data':
        if (health.models?.importedCount === 0) return 'locked';
        const hasData = health.data?.syntheticPatients > 0 || health.data?.hasSuccessfulMappingRun;
        if (hasData) return 'done';
        return health.models?.importedCount > 0 ? 'attention' : 'locked';
      case 'use':
        const dataLoaded = health.data?.syntheticPatients > 0 || health.data?.hasSuccessfulMappingRun;
        if (!dataLoaded) return 'locked';
        const hasUsed = health.queries?.lastExecutionStatus === 'success' ||
                        health.api?.configured ||
                        health.apps?.installed?.length > 0;
        return hasUsed ? 'done' : 'next';
      default:
        return 'locked';
    }
  };

  // Find current (next) step - used for initial selection
  const currentStep = STEPS.find(step => {
    const state = getStepState(step.id);
    return state === 'next' || state === 'attention';
  }) || STEPS[0];

  // The step to show in detail panel (selected or current)
  const activeStep = selectedStep ? STEPS.find(s => s.id === selectedStep) : currentStep;

  // Lightweight progress for the "How It Works" journey (not the workspace health score).
  const doneStepsCount = STEPS.reduce((acc, step) => acc + (getStepState(step.id) === 'done' ? 1 : 0), 0);
  const journeyProgressPct = Math.round((doneStepsCount / STEPS.length) * 100);

  // Handle step card click - all steps are clickable to learn about them
  const handleStepClick = (step) => {
    setSelectedStep(step.id);
    setShowUseOptions(false);
  };

  // Handle CTA click
  const handleCtaClick = () => {
    if (activeStep.id === 'use') {
      setShowUseOptions(!showUseOptions);
    } else if (activeStep.cta) {
      onNavigate(activeStep.cta);
    }
  };

  const ActiveIcon = activeStep?.icon || Database;

  return (
    <div className="rounded-xl border border-theme surface overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-theme">
        <h3 className="text-lg font-semibold text-theme-primary text-center">How It Works</h3>
        <p className="text-sm text-theme-secondary text-center mt-1">
          {loading ? 'Loading workspace...' : 'Click each step to explore'}
        </p>
      </div>

      {/* Step Cards Row */}
      <div className="px-6 py-6">
        <div className="flex items-center justify-center gap-2">
          {STEPS.map((step, index) => {
            const state = getStepState(step.id);
            const IconComponent = step.icon;
            const isLast = index === STEPS.length - 1;
            const isSelected = (selectedStep === step.id) || (!selectedStep && currentStep?.id === step.id);
            const colors = COLOR_CLASSES[step.color];
            const isLoadingState = state === 'loading';
            const isDone = state === 'done';

            return (
              <React.Fragment key={step.id}>
                {/* Step Card - all clickable to learn about the step */}
                <button
                  onClick={() => handleStepClick(step)}
                  className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all min-w-[120px] cursor-pointer ${
                    isSelected
                      ? `${colors.border} ${colors.bg} shadow-lg ${colors.shadow}`
                      : isLoadingState
                      ? `${colors.borderLight} ${colors.bg}`
                      : isDone
                      ? `${colors.borderLight} bg-green-500/5 ${colors.borderHover} hover:bg-green-500/10`
                      : `border-theme ${colors.borderHover} ${colors.bgHover}`
                  }`}
                >
                  {/* Step Number Badge */}
                  <div className={`absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    isDone
                      ? 'bg-green-500 text-white'
                      : isSelected
                      ? `${colors.badge} text-white`
                      : 'bg-theme-secondary/20 text-theme-secondary'
                  }`}>
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
                  </div>

                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-2 ${
                    isDone
                      ? `${colors.bg} ${colors.text}`
                      : isSelected
                      ? `${colors.bg} ${colors.text}`
                      : `${colors.bg} ${colors.text} opacity-60`
                  }`}>
                    <IconComponent className="w-6 h-6" />
                  </div>

                  {/* Label */}
                  <span className={`text-sm font-semibold ${
                    isDone
                      ? 'text-green-400'
                      : isSelected
                      ? colors.text
                      : 'text-theme-primary'
                  }`}>
                    {step.label}
                  </span>

                  {/* Subtitle */}
                  <span className="text-xs text-theme-secondary mt-0.5">
                    {step.subtitle}
                  </span>
                </button>

                {/* Arrow Connector */}
                {!isLast && (
                  <ArrowRight className={`w-5 h-5 flex-shrink-0 ${
                    getStepState(STEPS[index + 1].id) !== 'locked' && state === 'done'
                      ? 'text-green-500/50'
                      : 'text-theme-secondary/30'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Detail Panel */}
      {activeStep && (() => {
        const activeColors = COLOR_CLASSES[activeStep.color];
        return (
          <div className={`mx-6 mb-6 p-6 rounded-xl border-2 ${activeColors.borderLight} ${activeColors.bg}`}>
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={`w-14 h-14 rounded-xl ${activeColors.bg} flex items-center justify-center flex-shrink-0`}>
                <ActiveIcon className={`w-7 h-7 ${activeColors.text}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="text-lg font-semibold text-theme-primary">{activeStep.label}</h4>
                <p className={`text-sm ${activeColors.text}`}>{activeStep.subtitle}</p>
              </div>
            </div>

            <p className="mt-4 text-sm text-theme-secondary leading-relaxed">
              {activeStep.description}
            </p>

            {/* Bullet Points */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
              {activeStep.bullets.map((bullet, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className={`w-4 h-4 ${activeColors.text} flex-shrink-0 mt-0.5`} />
                  <span className="text-sm text-theme-secondary">{bullet}</span>
                </div>
              ))}
            </div>

            {/* CTA Button */}
            <div className="mt-5">
              {activeStep.id === 'use' ? (
                <div className="space-y-3">
                  <button
                    onClick={handleCtaClick}
                    disabled={getStepState('use') === 'locked'}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${activeColors.badge} text-white font-medium text-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {activeStep.ctaLabel}
                    <ChevronDown className={`w-4 h-4 transition-transform ${showUseOptions ? 'rotate-180' : ''}`} />
                  </button>

                  {showUseOptions && getStepState('use') !== 'locked' && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => onNavigate('builder')}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-theme-secondary/10 text-theme-primary hover:bg-theme-secondary/20 transition-colors"
                      >
                        Run a Query <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onNavigate('api')}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-theme-secondary/10 text-theme-primary hover:bg-theme-secondary/20 transition-colors"
                      >
                        Deploy API <ArrowRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onNavigate('app-catalog')}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-theme-secondary/10 text-theme-primary hover:bg-theme-secondary/20 transition-colors"
                      >
                        Browse Apps <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={handleCtaClick}
                  disabled={getStepState(activeStep.id) === 'locked'}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg ${activeColors.badge} text-white font-medium text-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {activeStep.ctaLabel}
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Learning Center Callout */}
      <div className="px-6 pb-6">
        <div className="relative overflow-hidden rounded-xl border border-theme/60 bg-gradient-to-br from-emerald-500/10 via-cyan-500/10 to-violet-500/10 p-5">
          {/* Decorative glow */}
          <div className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full bg-emerald-500/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-cyan-500/10 blur-2xl" />

          <div className="relative flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center border border-emerald-500/20">
                  <GraduationCap className="w-5 h-5 text-emerald-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-theme-primary truncate">
                    Learning Center
                  </p>
                  <p className="text-xs text-theme-secondary truncate">
                    Guided modules, best practices, and quick wins for each step.
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-theme-secondary/10 text-theme-secondary text-xs border border-theme/40">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                  Next up: <span className="text-theme-primary font-medium">{currentStep?.label || 'Explore'}</span>
                </span>
                {typeof health?.journey?.percentage === 'number' && (
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-theme-secondary/10 text-theme-secondary text-xs border border-theme/40">
                    Workspace health: <span className="text-theme-primary font-medium">{health.journey.percentage}%</span>
                  </span>
                )}
              </div>
            </div>

            <div className="w-full md:w-[340px] flex-shrink-0">
              <div className="flex items-center justify-between text-xs text-theme-secondary">
                <span>{doneStepsCount} of {STEPS.length} steps completed</span>
                <span className="text-theme-primary font-semibold">{journeyProgressPct}%</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-theme-secondary/20 overflow-hidden">
                <div
                  className="h-full bg-emerald-400/90"
                  style={{ width: `${Math.max(0, Math.min(100, journeyProgressPct))}%` }}
                />
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => onNavigate?.('learn')}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white font-medium text-sm hover:opacity-95 transition-colors"
                >
                  Open Learning Center
                  <ArrowRight className="w-4 h-4" />
                </button>
                {currentStep?.cta && (
                  <button
                    onClick={() => onNavigate?.(currentStep.cta)}
                    className="px-3 py-2 rounded-lg border border-theme/60 bg-surface/40 text-theme-primary text-sm hover:bg-surface-hover transition-colors"
                    title={`Jump to: ${currentStep.label}`}
                  >
                    Resume
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuidedJourney;
