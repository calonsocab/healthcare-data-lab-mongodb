"use client";

import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

const clampIndex = (idx, len) => {
  if (len <= 0) return 0;
  const n = idx % len;
  return n < 0 ? n + len : n;
};

/**
 * Minimal carousel for screenshots.
 * Designed for "manual" content where we want to embed multiple images inline
 * without dumping them in a long vertical list.
 */
export default function ImageCarousel({
  title = null,
  images = [],
  onOpen = null, // (image) => void
  className = "",
}) {
  const items = useMemo(() => (Array.isArray(images) ? images.filter(Boolean) : []), [images]);
  const [idx, setIdx] = useState(0);

  const current = items.length > 0 ? items[clampIndex(idx, items.length)] : null;

  if (items.length === 0) return null;

  const canNav = items.length > 1;

  return (
    <figure className={`rounded-lg border border-theme p-3 ${className}`}>
      {(title || current?.title) && (
        <figcaption className="text-xs text-theme-secondary mb-2 flex items-center justify-between gap-3">
          <span className="min-w-0 truncate">{title || current?.title}</span>
          <span className="flex items-center gap-2 flex-shrink-0">
            {canNav && <span className="tabular-nums">{clampIndex(idx, items.length) + 1}/{items.length}</span>}
            {current?.src && (
              <a
                href={current.src}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-theme-primary transition-colors"
                aria-label="Open image in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </span>
        </figcaption>
      )}

      <div className="relative">
        {canNav && (
          <>
            <button
              type="button"
              onClick={() => setIdx((v) => v - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full border border-theme bg-surface/80 hover:bg-surface transition-all"
              aria-label="Previous image"
            >
              <ChevronLeft className="w-4 h-4 text-theme-secondary" />
            </button>
            <button
              type="button"
              onClick={() => setIdx((v) => v + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full border border-theme bg-surface/80 hover:bg-surface transition-all"
              aria-label="Next image"
            >
              <ChevronRight className="w-4 h-4 text-theme-secondary" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => (typeof onOpen === "function" ? onOpen(current) : null)}
          className="block w-full text-left"
          aria-label="Open image full screen"
        >
          <img
            src={current?.src}
            alt={current?.title || title || "Screenshot"}
            loading="lazy"
            decoding="async"
            className="block w-auto max-w-full h-auto mx-auto rounded border border-theme"
          />
        </button>
      </div>

      {canNav && (
        <div className="mt-3 flex flex-wrap gap-2 justify-center">
          {items.map((it, i) => (
            <button
              key={`${it.src}-${i}`}
              type="button"
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                clampIndex(idx, items.length) === i ? "w-10 bg-primary" : "w-6 bg-theme-secondary/30 hover:bg-theme-secondary/45"
              }`}
              aria-label={`Go to image ${i + 1}`}
            />
          ))}
        </div>
      )}
    </figure>
  );
}

