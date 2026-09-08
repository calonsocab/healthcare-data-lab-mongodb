"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
} from "lucide-react";

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function formatTime(seconds) {
  const s = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${m}:${String(ss).padStart(2, "0")}`;
}

/**
 * Lightweight player wrapper around a native <video>.
 * Adds:
 * - playback speed control
 * - skip +/- seconds buttons
 * - double-click left/right to seek
 * - optional source (resolution) switching via `sources`
 */
export default function VideoPlayer({
  title = "Video",
  src = null,
  poster = null,
  sources = null, // [{ label, src, type? }]
  className = "",
  skipSeconds = 10,
  onLoadStatusChange = null, // (status) => void, status: { state: 'idle'|'loading'|'ready'|'error', error?: string }
}) {
  const videoRef = useRef(null);
  const wrapperRef = useRef(null);

  const speedOptions = useMemo(() => [0.75, 1, 1.25, 1.5, 2], []);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeSrc, setActiveSrc] = useState(src || null);
  const [loadState, setLoadState] = useState({ state: "idle", error: null });

  const resolvedSources = Array.isArray(sources) && sources.length > 0 ? sources : null;

  useEffect(() => {
    setActiveSrc(src || null);
  }, [src]);

  useEffect(() => {
    if (typeof onLoadStatusChange === "function") onLoadStatusChange(loadState);
  }, [loadState, onLoadStatusChange]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(el.currentTime || 0);
    const onDurationChange = () => setDuration(el.duration || 0);
    const onVolumeChange = () => {
      setIsMuted(Boolean(el.muted));
      setVolume(Number.isFinite(el.volume) ? el.volume : 1);
    };
    const onLoadStart = () => setLoadState({ state: "loading", error: null });
    const onCanPlay = () => setLoadState({ state: "ready", error: null });
    const onError = () => {
      // `el.error` is a MediaError (code 1-4). We keep this generic in UI.
      setLoadState({ state: "error", error: "Video failed to load." });
    };

    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("durationchange", onDurationChange);
    el.addEventListener("volumechange", onVolumeChange);
    el.addEventListener("loadstart", onLoadStart);
    el.addEventListener("canplay", onCanPlay);
    el.addEventListener("error", onError);

    // Initialize from element state
    onTimeUpdate();
    onDurationChange();
    onVolumeChange();
    setIsPlaying(!el.paused);

    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("durationchange", onDurationChange);
      el.removeEventListener("volumechange", onVolumeChange);
      el.removeEventListener("loadstart", onLoadStart);
      el.removeEventListener("canplay", onCanPlay);
      el.removeEventListener("error", onError);
    };
  }, []);

  const togglePlay = async () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      try {
        await el.play();
      } catch {
        // Autoplay / gesture restrictions; ignore.
      }
    } else {
      el.pause();
    }
  };

  const seekBy = (delta) => {
    const el = videoRef.current;
    if (!el) return;
    const next = clamp((el.currentTime || 0) + delta, 0, Number.isFinite(el.duration) ? el.duration : Number.MAX_SAFE_INTEGER);
    el.currentTime = next;
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
  };

  const setElVolume = (v) => {
    const el = videoRef.current;
    if (!el) return;
    el.volume = clamp(v, 0, 1);
    if (el.volume > 0 && el.muted) el.muted = false;
  };

  const requestFullscreen = async () => {
    const wrap = wrapperRef.current;
    if (!wrap) return;
    // Request fullscreen on wrapper so our controls remain visible.
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {}
      return;
    }
    try {
      await wrap.requestFullscreen();
    } catch {}
  };

  const onDoubleClick = (e) => {
    const wrap = wrapperRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = rect.width > 0 ? x / rect.width : 0.5;
    if (ratio < 0.33) seekBy(-Math.abs(skipSeconds));
    else if (ratio > 0.66) seekBy(Math.abs(skipSeconds));
    else togglePlay();
  };

  const onKeyDown = (e) => {
    // Only when focused (tabbed into the player)
    if (e.key === " " || e.key === "k") {
      e.preventDefault();
      togglePlay();
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      seekBy(-Math.abs(skipSeconds));
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      seekBy(Math.abs(skipSeconds));
      return;
    }
    if (e.key === "m") {
      e.preventDefault();
      toggleMute();
      return;
    }
    if (e.key === "]") {
      e.preventDefault();
      const idx = speedOptions.findIndex((x) => x === playbackRate);
      const next = speedOptions[clamp(idx + 1, 0, speedOptions.length - 1)];
      setPlaybackRate(next);
      return;
    }
    if (e.key === "[") {
      e.preventDefault();
      const idx = speedOptions.findIndex((x) => x === playbackRate);
      const next = speedOptions[clamp(idx - 1, 0, speedOptions.length - 1)];
      setPlaybackRate(next);
      return;
    }
    if (e.key === "f") {
      e.preventDefault();
      requestFullscreen();
    }
  };

  const switchSource = async (nextSrc) => {
    const el = videoRef.current;
    if (!el || !nextSrc || nextSrc === activeSrc) return;

    const wasPaused = el.paused;
    const t = el.currentTime || 0;

    setActiveSrc(nextSrc);
    setLoadState({ state: "loading", error: null });

    // Wait for React to update <source/src>, then re-seek and optionally resume.
    // This is intentionally conservative; browsers differ in how fast metadata loads.
    const tryRestore = () =>
      new Promise((resolve) => {
        const onLoaded = () => {
          el.currentTime = Math.min(t, Number.isFinite(el.duration) ? el.duration : t);
          el.removeEventListener("loadedmetadata", onLoaded);
          resolve();
        };
        el.addEventListener("loadedmetadata", onLoaded);
        el.load();
      });

    try {
      await tryRestore();
      if (!wasPaused) await el.play();
    } catch {
      // Ignore.
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={`rounded-lg border border-theme overflow-hidden bg-surface-hover ${className}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
      role="group"
      aria-label={title}
    >
      <div className="aspect-video bg-black/20">
        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          playsInline
          preload="metadata"
          poster={poster || undefined}
        >
          {resolvedSources ? (
            resolvedSources.map((s) => (
              <source key={s.src} src={s.src} type={s.type || undefined} />
            ))
          ) : activeSrc ? (
            <source src={activeSrc} />
          ) : null}
          Your browser does not support the video tag.
        </video>
      </div>

      <div className="p-3 border-t border-theme bg-surface/40">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-theme-primary truncate">{title}</p>
            <p className="text-xs text-theme-secondary">
              {formatTime(currentTime)} / {formatTime(duration)}{" "}
              <span className="ml-2">Tip: double-click left/right to skip {skipSeconds}s</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-2 py-1.5 rounded border border-theme surface hover:border-primary/50 transition-all inline-flex items-center gap-1 text-xs text-theme-secondary"
              onClick={() => seekBy(-Math.abs(skipSeconds))}
              aria-label={`Back ${skipSeconds} seconds`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              -{skipSeconds}s
            </button>

            <button
              type="button"
              className="px-2 py-1.5 rounded border border-theme surface hover:border-primary/50 transition-all inline-flex items-center gap-1 text-xs text-theme-secondary"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? "Pause" : "Play"}
            </button>

            <button
              type="button"
              className="px-2 py-1.5 rounded border border-theme surface hover:border-primary/50 transition-all inline-flex items-center gap-1 text-xs text-theme-secondary"
              onClick={() => seekBy(Math.abs(skipSeconds))}
              aria-label={`Forward ${skipSeconds} seconds`}
            >
              <RotateCw className="w-3.5 h-3.5" />
              +{skipSeconds}s
            </button>

            <div className="flex items-center gap-2 pl-2 ml-1 border-l border-theme">
              <label className="text-xs text-theme-secondary" htmlFor="learning-video-speed">
                Speed
              </label>
              <select
                id="learning-video-speed"
                className="text-xs rounded border border-theme surface px-2 py-1 text-theme-primary bg-transparent"
                value={playbackRate}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
              >
                {speedOptions.map((x) => (
                  <option key={x} value={x}>
                    {x}x
                  </option>
                ))}
              </select>
            </div>

            {resolvedSources && (
              <div className="flex items-center gap-2 pl-2 ml-1 border-l border-theme">
                <label className="text-xs text-theme-secondary" htmlFor="learning-video-quality">
                  Quality
                </label>
                <select
                  id="learning-video-quality"
                  className="text-xs rounded border border-theme surface px-2 py-1 text-theme-primary bg-transparent"
                  value={activeSrc || resolvedSources[0].src}
                  onChange={(e) => switchSource(e.target.value)}
                >
                  {resolvedSources.map((s) => (
                    <option key={s.src} value={s.src}>
                      {s.label || s.src}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-2 pl-2 ml-1 border-l border-theme">
              <button
                type="button"
                className="px-2 py-1.5 rounded border border-theme surface hover:border-primary/50 transition-all inline-flex items-center gap-1 text-xs text-theme-secondary"
                onClick={toggleMute}
                aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
              <input
                aria-label="Volume"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => setElVolume(Number(e.target.value))}
                className="w-24"
              />
            </div>

            <button
              type="button"
              className="px-2 py-1.5 rounded border border-theme surface hover:border-primary/50 transition-all inline-flex items-center gap-1 text-xs text-theme-secondary"
              onClick={requestFullscreen}
              aria-label="Fullscreen"
            >
              <Maximize className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
