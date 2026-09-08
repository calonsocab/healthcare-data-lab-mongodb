// src/components/views/learningCenter/LearningCenter.jsx
"use client";

import React, { useMemo, useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  GraduationCap, Clock, ChevronRight, CheckCircle2, Circle,
  Play, ExternalLink, Book, Database, Code, FlaskConical,
  Rocket, ArrowLeft, Video, Layers, Boxes, History, X
} from 'lucide-react';
import { useLearningProgress } from '@/hooks/useLearningProgress';
import learningModulesConfig from '@/config/learningModules.json';
import VideoPlayer from '@/components/common/VideoPlayer';
import ImageCarousel from '@/components/common/ImageCarousel';

const sections = learningModulesConfig.sections ?? [];
const modules = learningModulesConfig.modules ?? [];
const externalResources = learningModulesConfig.externalResources ?? [];

const iconMap = {
  Rocket,
  Database,
  Code,
  FlaskConical,
  ExternalLink,
  Book,
  GraduationCap,
  Layers,
  Boxes,
  History
};

const KEHRNEL_DOCS_URL = process.env.NEXT_PUBLIC_KEHRNEL_DOCS_URL || '/api/kehrnel/docs/guide';

const getIcon = (iconName) => iconMap[iconName] || GraduationCap;

const normalizeText = (value) =>
  String(value || '')
    .replaceAll("{'{kehrnel}'}", '{kehrnel}')
    .replaceAll('{kehrnel}', '{kehrnel}');

const resolveResourceUrl = (url) => (url === '{{KEHRNEL_DOCS_URL}}' ? KEHRNEL_DOCS_URL : url);

const isExternalUrl = (value) => /^https?:\/\//i.test(String(value || ''));

const resolvePublicPath = (placeholderPath) => {
  // Stored as "public/..." in config to make it obvious it's a placeholder.
  // Convert to a Next.js public asset path ("/...") for rendering.
  return String(placeholderPath || '').replace(/^public\//, '/');
};

const buildNumberedImagePaths = (basePlaceholderPath, count, startIndex = 1) => {
  const base = String(basePlaceholderPath || '');
  if (!base || !Number.isFinite(count) || count <= 0) return [];

  const dot = base.lastIndexOf('.');
  const slash = base.lastIndexOf('/');
  const hasExt = dot > slash;

  const prefix = hasExt ? base.slice(0, dot) : base;
  const ext = hasExt ? base.slice(dot) : '';

  const paths = [];
  for (let i = 0; i < count; i += 1) {
    const n = startIndex + i;
    paths.push(`${prefix}-${n}${ext}`);
  }
  return paths;
};

const LearningCenter = ({ onNavigate, initialModuleId = null }) => {
  const [selectedModuleId, setSelectedModuleId] = useState(initialModuleId || null);
  const [lightbox, setLightbox] = useState({ open: false, src: null, title: null });
  const [videoLoadState, setVideoLoadState] = useState({ state: 'idle', error: null });
  const {
    markStepComplete,
    markStepIncomplete,
    getModuleProgress,
    isStepComplete,
    getOverallProgress
  } = useLearningProgress();

  useEffect(() => {
    if (initialModuleId) setSelectedModuleId(initialModuleId);
  }, [initialModuleId]);

  useEffect(() => {
    // Close any open lightbox when switching modules.
    setLightbox((prev) => (prev.open ? { open: false, src: null, title: null } : prev));
    setVideoLoadState({ state: 'idle', error: null });
  }, [selectedModuleId]);

  const modulesBySection = useMemo(() => {
    return sections.map((section) => ({
      ...section,
      modules: modules.filter((module) => module.sectionId === section.id)
    }));
  }, []);

  const selectedModule = useMemo(
    () => modules.find((m) => m.id === selectedModuleId) || null,
    [selectedModuleId]
  );

  const hasEmbeddedManualImages = useMemo(() => {
    const secs = selectedModule?.manual?.sections;
    if (!Array.isArray(secs) || secs.length === 0) return false;

    for (const sec of secs) {
      if (!sec) continue;
      if (sec.image) return true;
      if (Array.isArray(sec.images) && sec.images.length > 0) return true;

      const content = Array.isArray(sec.content) ? sec.content : [];
      for (const block of content) {
        if (!block) continue;
        if (block.type === 'image') return true;
        if (block.type === 'images' && Array.isArray(block.items) && block.items.length > 0) return true;
      }
    }

    return false;
  }, [selectedModule]);

  const hasEmbeddedManualVideo = useMemo(() => {
    const secs = selectedModule?.manual?.sections;
    if (!Array.isArray(secs) || secs.length === 0) return false;

    for (const sec of secs) {
      if (!sec) continue;
      const content = Array.isArray(sec.content) ? sec.content : [];
      for (const block of content) {
        if (!block) continue;
        if (String(block.type || '').toLowerCase() === 'video') return true;
      }
    }

    return false;
  }, [selectedModule]);

  const overallProgress = getOverallProgress(modules);

  if (!selectedModule) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-theme-primary">Learning Center</h1>
              <p className="text-theme-secondary">Multidomain, multistrategy guidance across all workspace apps</p>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl border border-theme surface">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-theme-primary">Overall Progress</span>
              <span className="text-sm text-theme-secondary">
                {overallProgress.completedSteps} / {overallProgress.totalSteps} steps
              </span>
            </div>
            <div className="h-2 bg-theme-secondary/20 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${overallProgress.percentage}%` }} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {modulesBySection.map((section) => (
            <div key={section.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-theme-primary">{section.title}</h2>
                <span className="text-xs text-theme-secondary">{section.modules.length} lesson{section.modules.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {section.modules.map((module) => {
                  const IconComponent = getIcon(module.icon);
                  const progress = getModuleProgress(module.id, module.steps?.length || 0);
                  return (
                    <button
                      key={module.id}
                      onClick={() => setSelectedModuleId(module.id)}
                      className="text-left p-5 rounded-xl border border-theme surface hover:border-primary/50 transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <IconComponent className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-theme-primary group-hover:text-primary transition-colors">{module.title}</h3>
                            {progress.isComplete && <CheckCircle2 className="w-4 h-4 text-success" />}
                          </div>
                          <p className="text-sm text-theme-secondary mb-3 line-clamp-3">{normalizeText(module.description)}</p>
                          <div className="flex items-center gap-3 text-xs text-theme-secondary">
                            <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{module.timeMinutes} min</span>
                            {module.statusNote && <span className="text-amber-300">{normalizeText(module.statusNote)}</span>}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-theme-secondary" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-theme pt-6">
          <h2 className="text-lg font-semibold text-theme-primary mb-4 flex items-center gap-2">
            <Book className="w-5 h-5" />
            External Resources
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {externalResources.map((resource, idx) => {
              const IconComponent = getIcon(resource.icon);
              return (
                <a key={idx} href={resolveResourceUrl(resource.url)} target="_blank" rel="noopener noreferrer" className="p-4 rounded-xl border border-theme surface hover:border-primary/50 transition-all flex items-start gap-3 group">
                  <IconComponent className="w-5 h-5 text-theme-secondary group-hover:text-primary transition-colors" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-theme-primary group-hover:text-primary">{normalizeText(resource.title)}</h3>
                    <p className="text-xs text-theme-secondary mt-1">{normalizeText(resource.description)}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-theme-secondary" />
                </a>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const moduleProgress = getModuleProgress(selectedModule.id, selectedModule.steps?.length || 0);
  const ModuleIcon = getIcon(selectedModule.icon);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-6">
        <div>
          <button
            onClick={() => setSelectedModuleId(null)}
            className="inline-flex items-center gap-2 text-sm text-theme-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to learning index
          </button>
        </div>
        <div className="hidden xl:block" />

        <aside className="h-fit rounded-xl border border-theme surface p-4 xl:sticky xl:top-6">
          <h3 className="text-sm font-semibold text-theme-primary mb-2">Learning Directory</h3>
          <p className="text-xs text-theme-secondary mb-3">All sections and lessons</p>
          <div className="space-y-3 max-h-[72vh] overflow-y-auto pr-1">
            {modulesBySection.map((section) => (
              <div key={section.id} className="space-y-1">
                <p className="text-[11px] uppercase tracking-wide text-theme-secondary font-semibold">{section.title}</p>
                {section.modules.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModuleId(m.id)}
                    className={`w-full text-left px-2 py-2 rounded text-sm ${
                      m.id === selectedModule.id
                        ? 'bg-primary/15 text-primary'
                        : 'text-theme-secondary hover:bg-surface-hover'
                    }`}
                  >
                    {m.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>

        <div className="space-y-6">
          <div className="rounded-xl border border-theme surface p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ModuleIcon className="w-7 h-7 text-primary" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-theme-primary">{selectedModule.title}</h1>
                <p className="text-theme-secondary mt-2">{normalizeText(selectedModule.description)}</p>
                {selectedModule.statusNote && (
                  <p className="text-xs text-amber-300 mt-2">{normalizeText(selectedModule.statusNote)}</p>
                )}
                <div className="mt-3 text-sm text-theme-secondary inline-flex items-center gap-1">
                  <Clock className="w-4 h-4" /> {selectedModule.timeMinutes} minutes
                </div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-theme">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-theme-primary">Module Progress</span>
                <span className="text-sm text-theme-secondary">{moduleProgress.percentage}%</span>
              </div>
              <div className="h-2 bg-theme-secondary/20 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${moduleProgress.percentage}%` }} />
              </div>
            </div>
          </div>

        {selectedModule.manual?.sections?.length > 0 && (
          <div className="rounded-xl border border-theme surface p-6">
            <h2 className="font-semibold text-theme-primary mb-4">Manual</h2>

            {selectedModule.manual?.links?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {selectedModule.manual.links.map((link, idx) => {
                  const label = normalizeText(link.label || link.title || `Link ${idx + 1}`);
                  const cta = link.cta ? String(link.cta) : null;
                  const url = link.url ? resolveResourceUrl(String(link.url)) : null;

                  if (cta) {
                    return (
                      <button
                        key={`${label}-${idx}`}
                        onClick={() => onNavigate(cta)}
                        className="px-3 py-1.5 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20"
                      >
                        {label}
                      </button>
                    );
                  }

                  if (url && isExternalUrl(url)) {
                    return (
                      <a
                        key={`${label}-${idx}`}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded text-xs border border-theme surface hover:border-primary/50 transition-all inline-flex items-center gap-1"
                      >
                        {label}
                        <ExternalLink className="w-3.5 h-3.5 text-theme-secondary" />
                      </a>
                    );
                  }

                  return null;
                })}
              </div>
            )}

            <div className="space-y-6">
              {selectedModule.manual.sections.map((section, idx) => {
                const title = normalizeText(section.title || `Section ${idx + 1}`);
                const paragraphs = Array.isArray(section.paragraphs) ? section.paragraphs : [];
                const bullets = Array.isArray(section.bullets) ? section.bullets : [];
                const steps = Array.isArray(section.steps) ? section.steps : [];
                const terms = Array.isArray(section.terms) ? section.terms : [];
                const callout = section.callout ? normalizeText(section.callout) : null;
                const content = Array.isArray(section.content) ? section.content : null;
                const images = [
                  ...(section.image ? [section.image] : []),
                  ...(Array.isArray(section.images) ? section.images : [])
                ].filter(Boolean);

                const renderImage = (img, key) => {
                  const image = img?.image ? img.image : img;
                  if (!image) return null;
                  const imgTitleValue = image.title || image.caption || null;
                  const imgTitle = imgTitleValue ? normalizeText(imgTitleValue) : null;
                  const src = resolvePublicPath(image.placeholderPath || image.path || image.src);
                  return (
                    <figure key={key || src} className="rounded-lg border border-theme p-3">
                      {imgTitle && (
                        <figcaption className="text-xs text-theme-secondary mb-2">
                          {imgTitle}
                        </figcaption>
                      )}
                      <button
                        type="button"
                        onClick={() => setLightbox({ open: true, src, title: imgTitle || 'Screenshot' })}
                        className="block w-full text-left"
                        aria-label={`Open ${imgTitle || 'screenshot'} full screen`}
                      >
                        <img
                          src={src}
                          alt={imgTitle || 'Screenshot'}
                          loading="lazy"
                          decoding="async"
                          className="block w-auto max-w-full h-auto mx-auto rounded border border-theme"
                        />
                      </button>
                    </figure>
                  );
                };

                const renderBlock = (block, key) => {
                  const type = String(block?.type || '').toLowerCase();
                  if (type === 'paragraph') {
                    return (
                      <p key={key} className="text-sm text-theme-secondary leading-relaxed">
                        {normalizeText(block.text)}
                      </p>
                    );
                  }

                  if (type === 'callout') {
                    const text = block.text ? normalizeText(block.text) : '';
                    if (!text) return null;
                    return (
                      <div key={key} className="rounded-lg border border-theme bg-surface-hover p-3 text-sm text-theme-secondary">
                        {text}
                      </div>
                    );
                  }

                  if (type === 'image') {
                    // Support simple "same name + -1/-2/-3 suffix" carousel:
                    // { type: 'image', placeholderPath: 'public/.../foo.png', count: 3 } => foo-1.png..foo-3.png
                    const count = Number(block?.count || 0);
                    const startIndex = Number.isFinite(Number(block?.startIndex)) ? Number(block.startIndex) : 1;
                    const placeholderPath = block?.placeholderPath || block?.path || block?.src || null;
                    if (placeholderPath && count > 1) {
                      const numbered = buildNumberedImagePaths(String(placeholderPath), count, startIndex);
                      const images = numbered.map((p, iidx) => ({
                        src: resolvePublicPath(p),
                        title: block?.title || block?.caption
                          ? normalizeText(block.title || block.caption)
                          : `Screenshot ${startIndex + iidx}`
                      }));
                      return (
                        <ImageCarousel
                          key={key}
                          title={block?.title || block?.caption ? normalizeText(block.title || block.caption) : null}
                          images={images}
                          onOpen={(img) => setLightbox({ open: true, src: img?.src, title: img?.title || 'Screenshot' })}
                        />
                      );
                    }

                    return renderImage(block, key);
                  }

                  if (type === 'video') {
                    const title = normalizeText(block?.title || 'Module video');
                    const placeholderPath = block?.placeholderPath || block?.path || block?.src || null;
                    const embedUrl = block?.embedUrl || null;
                    const url = block?.url ? resolveResourceUrl(String(block.url)) : null;

                    if (embedUrl) {
                      return (
                        <div key={key} className="space-y-2">
                          <p className="text-sm text-theme-primary font-medium">{title}</p>
                          <div className="aspect-video bg-surface-hover rounded-lg border border-theme overflow-hidden">
                            <iframe
                              src={String(embedUrl)}
                              title={title}
                              className="w-full h-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                          </div>
                        </div>
                      );
                    }

                    if (url && isExternalUrl(url)) {
                      return (
                        <div key={key} className="space-y-2">
                          <p className="text-sm text-theme-primary font-medium">{title}</p>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                          >
                            Watch video <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                      );
                    }

                    if (placeholderPath) {
                      return (
                        <div key={key} className="space-y-2">
                          <VideoPlayer
                            title={title}
                            src={resolvePublicPath(placeholderPath)}
                            onLoadStatusChange={setVideoLoadState}
                          />
                        </div>
                      );
                    }

                    return null;
                  }

                  if (type === 'images') {
                    const items = Array.isArray(block.items) ? block.items : [];
                    if (items.length === 0) return null;
                    const display = String(block.display || '').toLowerCase();
                    if (display === 'carousel' || block.carousel === true) {
                      const images = items
                        .map((img) => img?.image ? img.image : img)
                        .filter(Boolean)
                        .map((img, iidx) => ({
                          src: resolvePublicPath(img.placeholderPath || img.path || img.src),
                          title: img.title || img.caption ? normalizeText(img.title || img.caption) : `Screenshot ${iidx + 1}`
                        }));
                      return (
                        <ImageCarousel
                          key={key}
                          title={block?.title || block?.caption ? normalizeText(block.title || block.caption) : null}
                          images={images}
                          onOpen={(img) => setLightbox({ open: true, src: img?.src, title: img?.title || 'Screenshot' })}
                        />
                      );
                    }
                    return (
                      <div key={key} className="space-y-3">
                        {items.map((img, iidx) => renderImage(img, `${key}-img-${iidx}`))}
                      </div>
                    );
                  }

                  if (type === 'bullets') {
                    const items = Array.isArray(block.items) ? block.items : [];
                    if (items.length === 0) return null;
                    return (
                      <ul key={key} className="list-disc pl-5 space-y-1 text-sm text-theme-secondary">
                        {items.map((b, bidx) => (
                          <li key={`${key}-b-${bidx}`}>{normalizeText(b)}</li>
                        ))}
                      </ul>
                    );
                  }

                  if (type === 'list') {
                    const items = Array.isArray(block.items) ? block.items : [];
                    if (items.length === 0) return null;
                    return (
                      <ul key={key} className="list-disc pl-5 space-y-1 text-sm text-theme-secondary">
                        {items.map((b, bidx) => (
                          <li key={`${key}-l-${bidx}`}>{normalizeText(b)}</li>
                        ))}
                      </ul>
                    );
                  }

                  if (type === 'steps') {
                    const items = Array.isArray(block.items) ? block.items : [];
                    if (items.length === 0) return null;
                    return (
                      <ol key={key} className="list-decimal pl-5 space-y-1 text-sm text-theme-secondary">
                        {items.map((s, sidx) => (
                          <li key={`${key}-s-${sidx}`}>{normalizeText(s)}</li>
                        ))}
                      </ol>
                    );
                  }

                  if (type === 'terms') {
                    const items = Array.isArray(block.items) ? block.items : [];
                    if (items.length === 0) return null;
                    return (
                      <dl key={key} className="space-y-2">
                        {items.map((t, tidx) => (
                          <div key={`${key}-t-${tidx}`} className="text-sm">
                            <dt className="font-medium text-theme-primary">{normalizeText(t.term)}</dt>
                            <dd className="text-theme-secondary mt-0.5">{normalizeText(t.definition)}</dd>
                          </div>
                        ))}
                      </dl>
                    );
                  }

                  return null;
                };

                return (
                  <div key={section.id || `${title}-${idx}`} className="space-y-3">
                    <h3 className="text-sm font-semibold text-theme-primary">{title}</h3>

                    {content && content.length > 0 ? (
                      <div className="space-y-3">
                        {content.map((block, bidx) => renderBlock(block, `${section.id || idx}-block-${bidx}`))}
                      </div>
                    ) : (
                      <>
                    {callout && (
                      <div className="rounded-lg border border-theme bg-surface-hover p-3 text-sm text-theme-secondary">
                        {callout}
                      </div>
                    )}

                    {paragraphs.length > 0 && (
                      <div className="space-y-2">
                        {paragraphs.map((p, pidx) => (
                          <p key={pidx} className="text-sm text-theme-secondary leading-relaxed">
                            {normalizeText(p)}
                          </p>
                        ))}
                      </div>
                    )}

                    {images.length > 0 && (
                      <div className="space-y-3">
                        {images.map((img, iidx) => renderImage(img, `${section.id || idx}-img-${iidx}`))}
                      </div>
                    )}

                    {bullets.length > 0 && (
                      <ul className="list-disc pl-5 space-y-1 text-sm text-theme-secondary">
                        {bullets.map((b, bidx) => (
                          <li key={bidx}>{normalizeText(b)}</li>
                        ))}
                      </ul>
                    )}

                    {steps.length > 0 && (
                      <ol className="list-decimal pl-5 space-y-1 text-sm text-theme-secondary">
                        {steps.map((s, sidx) => (
                          <li key={sidx}>{normalizeText(s)}</li>
                        ))}
                      </ol>
                    )}

                    {terms.length > 0 && (
                      <dl className="space-y-2">
                        {terms.map((t, tidx) => (
                          <div key={tidx} className="text-sm">
                            <dt className="font-medium text-theme-primary">{normalizeText(t.term)}</dt>
                            <dd className="text-theme-secondary mt-0.5">{normalizeText(t.definition)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {selectedModule.video && !hasEmbeddedManualVideo && (
          <div className="rounded-xl border border-theme surface p-6">
            <div className="flex items-center gap-2 mb-3">
              <Video className="w-5 h-5 text-primary" />
              <h2 className="font-semibold text-theme-primary">Video</h2>
            </div>

            {(() => {
              const video = selectedModule.video || {};
              const title = normalizeText(video.title || 'Module video');
              const placeholderPath = video.placeholderPath || video.path || video.src || null;
              const embedUrl = video.embedUrl || null;
              const url = video.url ? resolveResourceUrl(String(video.url)) : null;

              if (embedUrl) {
                return (
                  <div className="space-y-2">
                    <p className="text-sm text-theme-primary font-medium">{title}</p>
                    <div className="aspect-video bg-surface-hover rounded-lg border border-theme overflow-hidden">
                      <iframe
                        src={String(embedUrl)}
                        title={title}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  </div>
                );
              }

              if (url && isExternalUrl(url)) {
                return (
                  <div className="space-y-2">
                    <p className="text-sm text-theme-primary font-medium">{title}</p>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      Watch video <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                );
              }

              if (placeholderPath) {
                const src = resolvePublicPath(placeholderPath);
                return (
                  <div className="space-y-2">
                    <VideoPlayer title={title} src={src} onLoadStatusChange={setVideoLoadState} />
                    {video.type === 'placeholder' && videoLoadState.state === 'error' && (
                      <p className="text-xs text-theme-secondary">
                        Could not load video. Expected file: <code>{placeholderPath}</code>
                      </p>
                    )}
                  </div>
                );
              }

              return (
                <div className="aspect-video bg-surface-hover rounded-lg border border-dashed border-theme flex items-center justify-center">
                  <div className="text-center">
                    <Play className="w-10 h-10 text-theme-secondary mx-auto mb-2" />
                    <p className="text-theme-primary font-medium">{title}</p>
                    <p className="text-xs text-theme-secondary mt-1">No video configured for this module.</p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {selectedModule.media?.screenshots?.length > 0 && !hasEmbeddedManualImages && (
          <div className="rounded-xl border border-theme surface p-6">
            <h2 className="font-semibold text-theme-primary mb-4">Screenshots</h2>
            <div className="space-y-4">
              {selectedModule.media.screenshots.map((shot, idx) => {
                const relativePath = resolvePublicPath(shot.placeholderPath);
                return (
                  <div key={`${shot.title}-${idx}`} className="rounded-lg border border-theme p-3">
                    <p className="text-sm font-medium text-theme-primary mb-2">{normalizeText(shot.title)}</p>
                    <button
                      type="button"
                      onClick={() => setLightbox({ open: true, src: relativePath, title: normalizeText(shot.title) })}
                      className="block w-full text-left"
                      aria-label={`Open ${normalizeText(shot.title)} full screen`}
                    >
                      <img
                        src={relativePath}
                        alt={normalizeText(shot.title)}
                        loading="lazy"
                        decoding="async"
                        className="block w-auto max-w-full h-auto mx-auto rounded border border-theme"
                      />
                    </button>
                    <p className="text-xs text-theme-secondary mt-2">Path: <code>{shot.placeholderPath}</code></p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <Dialog.Root open={lightbox.open} onOpenChange={(open) => setLightbox((prev) => ({ ...prev, open }))}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50" />
            <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-6xl surface border border-theme rounded-xl shadow-2xl z-50 max-h-[92vh] overflow-auto">
              <div className="p-4 border-b border-theme flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Dialog.Title className="text-sm font-semibold text-theme-primary truncate">
                    {lightbox.title || 'Screenshot'}
                  </Dialog.Title>
                  {lightbox.src && (
                    <Dialog.Description className="text-xs text-theme-secondary mt-1 truncate">
                      {lightbox.src}
                    </Dialog.Description>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {lightbox.src && (
                    <a
                      href={lightbox.src}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded text-xs border border-theme surface hover:border-primary/50 transition-all inline-flex items-center gap-1"
                    >
                      Open in new tab
                      <ExternalLink className="w-3.5 h-3.5 text-theme-secondary" />
                    </a>
                  )}
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="p-2 rounded border border-theme surface hover:border-primary/50 transition-all"
                      aria-label="Close"
                    >
                      <X className="w-4 h-4 text-theme-secondary" />
                    </button>
                  </Dialog.Close>
                </div>
              </div>
              <div className="p-4">
                {lightbox.src && (
                  <img
                    src={lightbox.src}
                    alt={lightbox.title || 'Screenshot'}
                    className="block w-auto max-w-full h-auto mx-auto rounded border border-theme"
                  />
                )}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        <div className="rounded-xl border border-theme surface p-6">
          <h2 className="font-semibold text-theme-primary mb-4">Step-by-step Execution</h2>
          <div className="space-y-3">
            {selectedModule.steps?.map((step, index) => {
              const done = isStepComplete(selectedModule.id, step.id);
              return (
                <div key={step.id} className="rounded-lg border border-theme p-4">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => (done ? markStepIncomplete(selectedModule.id, step.id) : markStepComplete(selectedModule.id, step.id))}
                      className="mt-0.5"
                    >
                      {done ? <CheckCircle2 className="w-5 h-5 text-success" /> : <Circle className="w-5 h-5 text-theme-secondary" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-semibold text-theme-primary">{index + 1}. {normalizeText(step.title)}</h3>
                        {step.cta && (
                          <button
                            onClick={() => onNavigate(step.cta)}
                            className="px-3 py-1.5 rounded text-xs bg-primary/10 text-primary hover:bg-primary/20"
                          >
                            Open
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-theme-secondary mt-2">{normalizeText(step.description)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default LearningCenter;
