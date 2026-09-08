// src/components/views/appGallery/AppGallery.jsx
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles, ExternalLink, Github, ChevronLeft, ChevronRight,
  Play, ArrowRight, BookOpen, Users, Layers, Check,
  FileEdit, GitMerge, BarChart2, Edit
} from 'lucide-react';
import appRegistryConfig from '@/config/appRegistry.json';

const { demos, categories } = appRegistryConfig;

// Icon mapping
const iconMap = {
  FileEdit, GitMerge, BarChart2, Edit, Sparkles, Layers
};

// Protocol/Data Model badges
const ProtocolBadge = ({ protocol }) => {
  const styles = {
    FHIR: 'bg-red-100 text-red-700 border-red-200',
    openEHR: 'bg-orange-100 text-orange-700 border-orange-200'
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${styles[protocol] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
      {protocol}
    </span>
  );
};

// Status badge
const StatusBadge = ({ status }) => {
  const styles = {
    published: 'bg-green-100 text-green-700',
    stable: 'bg-blue-100 text-blue-700',
    beta: 'bg-purple-100 text-purple-700',
    experimental: 'bg-amber-100 text-amber-700'
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
};

// Image Slideshow Component
const ImageSlideshow = ({ slides, autoPlay = true }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!autoPlay || isPaused || slides.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [autoPlay, isPaused, slides.length]);

  if (!slides || slides.length === 0) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
        <Sparkles className="w-16 h-16 text-slate-300" />
      </div>
    );
  }

  const goToSlide = (index) => setCurrentIndex(index);
  const prevSlide = () => setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  const nextSlide = () => setCurrentIndex((prev) => (prev + 1) % slides.length);

  return (
    <div
      className="relative w-full h-full group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Image */}
      <div className="w-full h-full bg-white flex items-center justify-center p-4">
        <img
          src={slides[currentIndex].image}
          alt={slides[currentIndex].caption}
          className="max-w-full max-h-full object-contain rounded-lg"
          onError={(e) => {
            e.target.style.display = 'none';
            e.target.nextSibling.style.display = 'flex';
          }}
        />
        <div className="hidden w-full h-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg">
          <Sparkles className="w-16 h-16 text-slate-300" />
        </div>
      </div>

      {/* Caption */}
      {slides[currentIndex].caption && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4">
          <p className="text-white text-sm font-medium">{slides[currentIndex].caption}</p>
        </div>
      )}

      {/* Navigation arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        </>
      )}

      {/* Dots indicator */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => goToSlide(idx)}
              className={`w-2 h-2 rounded-full transition-all ${
                idx === currentIndex ? 'bg-white w-4' : 'bg-white/50 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      )}

      {/* Pause indicator */}
      {isPaused && slides.length > 1 && (
        <div className="absolute top-3 right-3 px-2 py-1 bg-black/50 rounded text-white text-xs">
          Paused
        </div>
      )}
    </div>
  );
};

// Featured Demo Card (large, with slideshow)
const FeaturedDemoCard = ({ demo, onSelect }) => {
  const slides = demo.media?.slides?.length > 0
    ? demo.media.slides
    : demo.media?.thumbnail
      ? [{ image: demo.media.thumbnail, caption: demo.tagline }]
      : [];

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-border overflow-hidden hover:shadow-md transition-shadow">
      {/* Image/Slideshow Area */}
      <div className="h-80 bg-background relative overflow-hidden">
        <ImageSlideshow slides={slides} />
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 className="text-xl font-semibold text-theme-primary mb-2">{demo.name}</h3>
        <p className="text-theme-secondary mb-4 line-clamp-2">{demo.description}</p>

        {/* Highlights */}
        {demo.highlights && (
          <ul className="space-y-1.5 mb-4">
            {demo.highlights.slice(0, 3).map((highlight, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-theme-secondary">
                <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                {highlight}
              </li>
            ))}
          </ul>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onSelect(demo)}
            className="px-4 py-2 bg-primary text-primary-text rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Learn more
          </button>
          {demo.links?.solutionLibrary && (
            <a
              href={demo.links.solutionLibrary}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 border border-border text-theme-secondary rounded-lg font-medium hover:bg-background transition-colors flex items-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Docs
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

// Demo Card (smaller, grid item)
const DemoCard = ({ demo, onSelect }) => {
  return (
    <button
      onClick={() => onSelect(demo)}
      className="text-left bg-surface rounded-xl border border-border overflow-hidden hover:shadow-md hover:border-primary/30 transition-all group"
    >
      {/* Thumbnail */}
      <div className="h-40 bg-background flex items-center justify-center overflow-hidden">
        {demo.media?.thumbnail ? (
          <img
            src={demo.media.thumbnail}
            alt={demo.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div className={`${demo.media?.thumbnail ? 'hidden' : 'flex'} w-full h-full items-center justify-center`}>
          <Sparkles className="w-12 h-12 text-theme-secondary opacity-50" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <ProtocolBadge protocol={demo.protocol} />
          <StatusBadge status={demo.status} />
        </div>
        <h3 className="font-semibold text-theme-primary mb-1 group-hover:text-primary transition-colors">
          {demo.name}
        </h3>
        <p className="text-sm text-theme-secondary line-clamp-2">{demo.tagline || demo.description}</p>

        <div className="flex items-center gap-2 mt-3 text-sm text-theme-secondary">
          <Users className="w-4 h-4" />
          <span>{demo.publisher}</span>
        </div>
      </div>
    </button>
  );
};

// Demo Detail Modal/View
const DemoDetail = ({ demo, onClose }) => {
  const slides = demo.media?.slides?.length > 0
    ? demo.media.slides
    : demo.media?.thumbnail
      ? [{ image: demo.media.thumbnail, caption: demo.tagline }]
      : [];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 backdrop-blur-sm p-4 pt-20">
      <div className="w-full max-w-4xl bg-surface rounded-2xl shadow-xl overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <button
            onClick={onClose}
            className="flex items-center gap-2 text-theme-secondary hover:text-theme-primary transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Back to Gallery
          </button>
          <div className="flex items-center gap-2">
            <ProtocolBadge protocol={demo.protocol} />
            <StatusBadge status={demo.status} />
          </div>
        </div>

        {/* Image/Slideshow */}
        <div className="h-96 bg-background">
          <ImageSlideshow slides={slides} autoPlay={false} />
        </div>

        {/* Content */}
        <div className="p-8">
          <h1 className="text-2xl font-bold text-theme-primary mb-2">{demo.name}</h1>
          <p className="text-theme-secondary mb-4">{demo.tagline}</p>
          <p className="text-theme-secondary mb-6">{demo.longDescription || demo.description}</p>

          {/* Tech Stack */}
          {demo.techStack && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-theme-secondary mb-2">Technology Stack</h3>
              <div className="flex flex-wrap gap-2">
                {demo.techStack.map((tech, idx) => (
                  <span key={idx} className="px-3 py-1 bg-background text-theme-secondary rounded-full text-sm border border-border">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Highlights */}
          {demo.highlights && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-theme-secondary mb-3">Key Features</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {demo.highlights.map((highlight, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Check className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-theme-secondary">{highlight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Authors */}
          {demo.authors && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-theme-secondary mb-2">Authors</h3>
              <p className="text-theme-secondary">{demo.authors.join(', ')}</p>
            </div>
          )}

          {/* Warnings */}
          {demo.warnings && demo.warnings.length > 0 && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <h3 className="text-sm font-medium text-amber-500 mb-2">Important Notes</h3>
              <ul className="space-y-1">
                {demo.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-amber-400">{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
            {demo.links?.solutionLibrary && (
              <a
                href={demo.links.solutionLibrary}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-primary text-primary-text rounded-lg font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                View in Solution Library
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            {demo.links?.repo && (
              <a
                href={demo.links.repo}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-surface border border-border text-theme-primary rounded-lg font-medium hover:bg-background transition-colors flex items-center gap-2"
              >
                <Github className="w-4 h-4" />
                View Repository
              </a>
            )}
            {demo.links?.demo && (
              <a
                href={demo.links.demo}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 border border-border text-theme-secondary rounded-lg font-medium hover:bg-background transition-colors flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Try Demo
              </a>
            )}
            {demo.links?.docs && !demo.links?.solutionLibrary && (
              <a
                href={demo.links.docs}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 border border-border text-theme-secondary rounded-lg font-medium hover:bg-background transition-colors flex items-center gap-2"
              >
                <BookOpen className="w-4 h-4" />
                Documentation
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Main AppGallery Component
const AppGallery = ({ onNavigate, activeEnvironment }) => {
  const [selectedDemo, setSelectedDemo] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeProtocol, setActiveProtocol] = useState('all');

  // Get unique protocols
  const protocols = useMemo(() => {
    return ['all', ...new Set(demos.map(d => d.protocol))];
  }, []);

  // Filter demos
  const filteredDemos = useMemo(() => {
    return demos.filter(demo => {
      if (activeCategory !== 'all' && demo.category !== activeCategory) return false;
      if (activeProtocol !== 'all' && demo.protocol !== activeProtocol) return false;
      return true;
    });
  }, [activeCategory, activeProtocol]);

  // Featured demos
  const featuredDemos = useMemo(() => {
    return filteredDemos.filter(d => d.featured);
  }, [filteredDemos]);

  // Other demos
  const otherDemos = useMemo(() => {
    return filteredDemos.filter(d => !d.featured);
  }, [filteredDemos]);

  return (
    <div className="space-y-6 pt-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h2 className="text-xl font-semibold text-theme-primary">App Gallery</h2>
          <p className="text-sm text-theme-secondary">
            Discover demos and solutions built with MongoDB persistence strategies
          </p>
        </div>

        {/* Category/Domain Tabs */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Domain Filter */}
          <div className="flex items-center gap-1 p-1 bg-surface rounded-full border border-border">
            {protocols.map(protocol => (
              <button
                key={protocol}
                onClick={() => setActiveProtocol(protocol)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeProtocol === protocol
                    ? 'bg-primary text-primary-text'
                    : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                {protocol === 'all' ? 'All Domains' : (protocol === 'genomics' ? 'Genomics' : protocol)}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1 p-1 bg-surface rounded-full border border-border">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeCategory === cat.id
                    ? 'bg-primary text-primary-text'
                    : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Featured Section */}
      {featuredDemos.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-theme-primary mb-4">Featured Demos</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {featuredDemos.map(demo => (
              <FeaturedDemoCard
                key={demo.id}
                demo={demo}
                onSelect={setSelectedDemo}
              />
            ))}
          </div>
        </section>
      )}

      {/* All Demos Grid */}
      {otherDemos.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-theme-primary mb-4">
            {featuredDemos.length > 0 ? 'More Demos' : 'Demos'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {otherDemos.map(demo => (
              <DemoCard
                key={demo.id}
                demo={demo}
                onSelect={setSelectedDemo}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {filteredDemos.length === 0 && (
        <div className="text-center py-16">
          <Sparkles className="w-16 h-16 mx-auto text-theme-secondary opacity-50 mb-4" />
          <h3 className="text-lg font-medium text-theme-primary mb-2">No demos found</h3>
          <p className="text-theme-secondary">
            Try adjusting your filters to find what you're looking for.
          </p>
        </div>
      )}

      {/* Demo Detail Modal */}
      {selectedDemo && (
        <DemoDetail
          demo={selectedDemo}
          onClose={() => setSelectedDemo(null)}
        />
      )}
    </div>
  );
};

export default AppGallery;
