"use client";

import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Info,
  Circle,
  CheckCircle2,
  Loader2,
  MessageSquare,
  ListChecks,
  Target,
  HelpCircle,
  Sparkles,
  Hash
} from 'lucide-react';
import { buildAgentProcess, listDomainTemplateSummaries } from '@/lib/contextObjects/agentDomainTemplates';

/**
 * Status icon for process steps
 */
const StepStatusIcon = ({ status }) => {
  if (status === 'completed') {
    return <CheckCircle2 size={14} className="text-green-400" />;
  }
  if (status === 'in_progress') {
    return <Loader2 size={14} className="text-amber-300 animate-spin" />;
  }
  return <Circle size={14} className="text-theme-secondary/50" />;
};

/**
 * Section card for template details
 */
const TemplateSection = ({ icon: Icon, title, children, className = '' }) => (
  <div className={`rounded-lg border border-theme/60 bg-background/60 ${className}`}>
    <div className="flex items-center gap-2 px-3 py-2 border-b border-theme/40 bg-surface/30">
      <Icon size={14} className="text-cyan-400" />
      <span className="text-xs font-medium text-theme-primary uppercase tracking-wide">{title}</span>
    </div>
    <div className="p-3">
      {children}
    </div>
  </div>
);

const AgentWorkflowInfoPanel = ({
  agentContext = null,
  title = 'How This Agent Works',
  defaultExpanded = false,
  className = ''
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const domainTemplates = useMemo(() => listDomainTemplateSummaries(), []);
  const detectedDomainId = agentContext?.domainTemplate?.id || 'generic';
  const [selectedTemplateId, setSelectedTemplateId] = useState(detectedDomainId);
  const [templateExpanded, setTemplateExpanded] = useState(true);
  const [expandedStepIds, setExpandedStepIds] = useState(new Set());

  useEffect(() => {
    if (agentContext?.domainTemplate?.id) {
      setSelectedTemplateId(agentContext.domainTemplate.id);
      setTemplateExpanded(true);
    }
  }, [agentContext?.domainTemplate?.id]);

  const process = useMemo(
    () => (
      Array.isArray(agentContext?.process) && agentContext.process.length > 0
        ? agentContext.process
        : buildAgentProcess('prompt_received')
    ),
    [agentContext?.process]
  );

  useEffect(() => {
    const inProgress = process.find((step) => step.status === 'in_progress');
    const defaultOpenStepId = inProgress?.id || process?.[0]?.id || null;
    if (!defaultOpenStepId) return;
    setExpandedStepIds(new Set([defaultOpenStepId]));
  }, [process]);

  const selectedTemplate = domainTemplates.find((template) => template.id === selectedTemplateId)
    || domainTemplates.find((template) => template.id === detectedDomainId)
    || domainTemplates[0];
  const detectionConfidence = typeof agentContext?.confidence === 'number'
    ? Math.round(agentContext.confidence * 100)
    : null;

  const toggleStepExpanded = (stepId) => {
    if (!stepId) return;
    setExpandedStepIds((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  return (
    <div className={`rounded-lg border border-theme bg-surface ${className}`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-background/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Info size={16} className="text-cyan-300" />
          <span className="text-sm font-medium text-theme-primary">{title}</span>
          {agentContext?.domainTemplate?.label && (
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {agentContext.domainTemplate.label}
              {detectionConfidence !== null && ` • ${detectionConfidence}%`}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown size={16} className="text-theme-secondary" />
        ) : (
          <ChevronRight size={16} className="text-theme-secondary" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-theme/60">
          {/* Process Steps Section */}
          <div className="p-4 border-b border-theme/40">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center">
                <ListChecks size={12} className="text-purple-400" />
              </div>
              <h4 className="text-xs font-semibold text-theme-primary uppercase tracking-wide">Process Pipeline</h4>
            </div>

            <div className="space-y-0">
              {process.map((step, index) => (
                <div key={step.id} className="flex items-stretch">
                  {/* Step indicator column */}
                  <div className="flex flex-col items-center mr-3">
                    {/* Step number circle */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 ${
                        step.status === 'completed'
                          ? 'bg-green-500/20 border-green-500/50 text-green-400'
                          : step.status === 'in_progress'
                            ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                            : 'bg-background border-theme/50 text-theme-secondary'
                      }`}
                    >
                      {step.status === 'completed' ? (
                        <CheckCircle2 size={12} />
                      ) : step.status === 'in_progress' ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    {/* Connecting line */}
                    {index < process.length - 1 && (
                      <div
                        className={`w-0.5 flex-1 min-h-[16px] ${
                          step.status === 'completed' ? 'bg-green-500/40' : 'bg-theme/30'
                        }`}
                      />
                    )}
                  </div>

                  {/* Step content */}
                  <div className={`flex-1 pb-3 ${index === process.length - 1 ? '' : ''}`}>
                    <button
                      type="button"
                      onClick={() => toggleStepExpanded(step.id)}
                      className="w-full flex items-center justify-between gap-2 text-left"
                    >
                      <span
                        className={`text-sm ${
                          step.status === 'completed'
                            ? 'text-green-400'
                            : step.status === 'in_progress'
                              ? 'text-amber-300 font-medium'
                              : 'text-theme-secondary'
                        }`}
                      >
                        {step.label}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] uppercase px-2 py-0.5 rounded ${
                            step.status === 'completed'
                              ? 'bg-green-500/10 text-green-400'
                              : step.status === 'in_progress'
                                ? 'bg-amber-500/10 text-amber-300'
                                : 'bg-background text-theme-secondary/70'
                          }`}
                        >
                          {step.status.replace('_', ' ')}
                        </span>
                        {expandedStepIds.has(step.id) ? (
                          <ChevronDown size={12} className="text-theme-secondary" />
                        ) : (
                          <ChevronRight size={12} className="text-theme-secondary" />
                        )}
                      </div>
                    </button>
                    {expandedStepIds.has(step.id) && (
                      <div className="mt-1.5 rounded border border-theme/40 bg-background/40 px-2.5 py-2">
                        <p className="text-xs leading-relaxed text-theme-secondary">
                          {step.description || 'Pipeline step explanation is not available.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Domain Templates Section */}
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-cyan-500/20 flex items-center justify-center">
                  <Target size={12} className="text-cyan-400" />
                </div>
                <h4 className="text-xs font-semibold text-theme-primary uppercase tracking-wide">Domain Templates</h4>
              </div>
              {agentContext?.domainTemplate?.label && (
                <span className="text-[10px] text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded">
                  Detected: {agentContext.domainTemplate.label}
                </span>
              )}
            </div>

            {/* Template selector */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {domainTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`px-3 py-1 text-xs rounded-lg border transition-all ${
                    selectedTemplate?.id === template.id
                      ? 'bg-primary/20 text-primary border-primary/50 shadow-sm'
                      : 'bg-background text-theme-secondary border-theme hover:border-primary/30 hover:bg-background/80'
                  }`}
                >
                  {template.label}
                </button>
              ))}
            </div>

            {/* Template details */}
            {selectedTemplate && (
              <div className="border border-theme rounded-lg bg-background/30 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTemplateExpanded((prev) => !prev)}
                  className="w-full px-3 py-2 flex items-center justify-between text-left bg-surface/50 hover:bg-surface/70 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-400" />
                    <span className="text-sm font-medium text-theme-primary">
                      {selectedTemplate.label} Template
                    </span>
                  </div>
                  {templateExpanded ? (
                    <ChevronDown size={14} className="text-theme-secondary" />
                  ) : (
                    <ChevronRight size={14} className="text-theme-secondary" />
                  )}
                </button>

                {templateExpanded && (
                  <div
                    className="max-h-[400px] overflow-auto border-t border-theme/40"
                    style={{
                      scrollbarWidth: 'thin',
                      scrollbarColor: 'rgba(100, 116, 139, 0.3) transparent'
                    }}
                  >
                    <div className="p-3 space-y-3">
                      {/* Description */}
                      {selectedTemplate.description && (
                        <p className="text-xs text-theme-secondary leading-relaxed px-1">
                          {selectedTemplate.description}
                        </p>
                      )}

                      {(selectedTemplate.intent || selectedTemplate.primaryAnchor || selectedTemplate.recommendedHeaderProfileId) && (
                        <TemplateSection icon={Target} title="Template Intent">
                          <div className="space-y-2 text-xs text-theme-secondary">
                            {selectedTemplate.intent && (
                              <div>
                                Intent: <span className="text-theme-primary">{selectedTemplate.intent}</span>
                              </div>
                            )}
                            {selectedTemplate.primaryAnchor && (
                              <div>
                                Primary Anchor: <span className="text-theme-primary">{selectedTemplate.primaryAnchor}</span>
                              </div>
                            )}
                            {Array.isArray(selectedTemplate.allowedSecondaryAnchors) && selectedTemplate.allowedSecondaryAnchors.length > 0 && (
                              <div>
                                Secondary Anchors: <span className="text-theme-primary">{selectedTemplate.allowedSecondaryAnchors.join(', ')}</span>
                              </div>
                            )}
                            {selectedTemplate.recommendedHeaderProfileId && (
                              <div>
                                Recommended Header Profile: <span className="font-mono text-cyan-300">{selectedTemplate.recommendedHeaderProfileId}</span>
                              </div>
                            )}
                            {selectedTemplate.recommendedTerminologyProfileId && (
                              <div>
                                Recommended Terminology Profile: <span className="font-mono text-cyan-300">{selectedTemplate.recommendedTerminologyProfileId}</span>
                              </div>
                            )}
                          </div>
                        </TemplateSection>
                      )}

                      {Array.isArray(selectedTemplate.skeletonGroups) && selectedTemplate.skeletonGroups.length > 0 && (
                        <TemplateSection icon={ListChecks} title="Deterministic Skeleton">
                          <div className="space-y-2">
                            <p className="text-xs text-theme-secondary">
                              Stable top-level groups are enforced, then the LLM augments details inside them.
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {selectedTemplate.skeletonGroups.map((group) => (
                                <span
                                  key={`${selectedTemplate.id}-skeleton-${group}`}
                                  className="px-2 py-1 text-[10px] rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                                >
                                  {group}
                                </span>
                              ))}
                            </div>
                          </div>
                        </TemplateSection>
                      )}

                      {/* Prompt Template */}
                      {typeof selectedTemplate.promptTemplate === 'string' && selectedTemplate.promptTemplate.trim() && (
                        <TemplateSection icon={MessageSquare} title="System Prompt">
                          <pre className="text-xs text-cyan-200/90 whitespace-pre-wrap font-mono leading-relaxed bg-slate-900/50 rounded p-3 border border-cyan-500/20">
                            {selectedTemplate.promptTemplate}
                          </pre>
                        </TemplateSection>
                      )}

                      {/* Rules */}
                      {Array.isArray(selectedTemplate.rules) && selectedTemplate.rules.length > 0 && (
                        <TemplateSection icon={ListChecks} title="Modeling Rules">
                          <div className="space-y-2">
                            {selectedTemplate.rules.map((rule, index) => (
                              <div
                                key={`${selectedTemplate.id}-rule-${index}`}
                                className="flex items-start gap-2 text-xs"
                              >
                                <span className="flex-shrink-0 w-5 h-5 rounded bg-amber-500/20 text-amber-300 flex items-center justify-center text-[10px] font-bold">
                                  {index + 1}
                                </span>
                                <span className="text-theme-secondary leading-relaxed pt-0.5">{rule}</span>
                              </div>
                            ))}
                          </div>
                        </TemplateSection>
                      )}

                      {/* Focus Areas */}
                      {Array.isArray(selectedTemplate.focusAreas) && selectedTemplate.focusAreas.length > 0 && (
                        <TemplateSection icon={Target} title="Focus Areas">
                          <div className="flex flex-wrap gap-1.5">
                            {selectedTemplate.focusAreas.map((area) => (
                              <span
                                key={area}
                                className="px-2 py-1 text-xs rounded-lg border border-green-500/30 bg-green-500/10 text-green-300"
                              >
                                {area}
                              </span>
                            ))}
                          </div>
                        </TemplateSection>
                      )}

                      {/* Clarification Questions */}
                      {Array.isArray(selectedTemplate.clarifications) && selectedTemplate.clarifications.length > 0 && (
                        <TemplateSection icon={HelpCircle} title="Clarification Questions">
                          <div className="space-y-3">
                            {selectedTemplate.clarifications.map((question) => (
                              <div key={question.id} className="p-2 rounded bg-surface/50 border border-theme/40">
                                <p className="text-xs text-theme-primary mb-2 font-medium">{question.question}</p>
                                {Array.isArray(question.options) && question.options.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {question.options.map((option) => (
                                      <span
                                        key={`${question.id}-${option.value}`}
                                        className="px-2 py-0.5 text-[10px] rounded border border-theme bg-background text-theme-secondary"
                                      >
                                        {option.label}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </TemplateSection>
                      )}

                      {/* Follow-up Prompts */}
                      {Array.isArray(selectedTemplate.followUpPrompts) && selectedTemplate.followUpPrompts.length > 0 && (
                        <TemplateSection icon={Sparkles} title="Suggested Follow-ups">
                          <div className="space-y-2">
                            {selectedTemplate.followUpPrompts.map((prompt, index) => (
                              <div
                                key={`${selectedTemplate.id}-follow-up-${index}`}
                                className="flex items-start gap-2 text-xs p-2 rounded bg-purple-500/5 border border-purple-500/20"
                              >
                                <span className="flex-shrink-0 text-purple-400">→</span>
                                <span className="text-purple-200/90 italic">&quot;{prompt}&quot;</span>
                              </div>
                            ))}
                          </div>
                        </TemplateSection>
                      )}

                      {/* Detection Keywords */}
                      {Array.isArray(selectedTemplate.keywords) && selectedTemplate.keywords.length > 0 && (
                        <TemplateSection icon={Hash} title="Detection Keywords">
                          <div className="flex flex-wrap gap-1">
                            {selectedTemplate.keywords.map((keyword) => (
                              <span
                                key={`${selectedTemplate.id}-keyword-${keyword}`}
                                className="px-1.5 py-0.5 text-[10px] rounded bg-slate-600/30 text-slate-400 font-mono"
                              >
                                {keyword}
                              </span>
                            ))}
                          </div>
                        </TemplateSection>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentWorkflowInfoPanel;
