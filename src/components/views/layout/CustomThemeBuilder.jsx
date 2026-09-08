// src/components/views/layout/CustomThemeBuilder.jsx
"use client";

import React, { useState, useEffect } from 'react';
import { RotateCcw, Copy, Check, AlertCircle } from 'lucide-react';
import {
  CUSTOM_THEME_CONFIG_KEYS,
  DARK_THEME,
  LIGHT_THEME,
  getNormalizedTheme
} from '@/lib/config/defaults';

// ---- WCAG color helpers ----
const relLum = (hex) => {
  const r = parseInt(hex.slice(1,3),16) / 255;
  const g = parseInt(hex.slice(3,5),16) / 255;
  const b = parseInt(hex.slice(5,7),16) / 255;
  const toLin = v => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4);
  const [R,G,B] = [toLin(r), toLin(g), toLin(b)];
  return 0.2126*R + 0.7152*G + 0.0722*B;
};

const contrastRatio = (a, b) => {
  const L1 = relLum(a);
  const L2 = relLum(b);
  return (Math.max(L1,L2)+0.05) / (Math.min(L1,L2)+0.05);
};

const bestBW = (bg) => {
  const k = contrastRatio('#000000', bg);
  const w = contrastRatio('#FFFFFF', bg);
  return k >= w ? '#000000' : '#FFFFFF';
};

const ensureContrast = (fg, bg, minRatio = 4.5) =>
  contrastRatio(fg, bg) >= minRatio;
// -----------------------------

// Fixed UI colors for the theme builder itself (not the theme being built)
const UI_COLORS = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceHover: '#334155',
  border: '#334155',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  primary: '#3B82F6',
  primaryHover: '#2563EB',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444'
};

const CustomThemeBuilder = ({ theme, onChange }) => {
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [contrastWarnings, setContrastWarnings] = useState({});
  const normalizedTheme = getNormalizedTheme(theme || {});
  const defaultTheme = normalizedTheme.name === 'Light Mode' ? LIGHT_THEME : DARK_THEME;

  const ratioStr = (fg, bg) => contrastRatio(fg, bg).toFixed(2);

  const themePresets = {
    light: LIGHT_THEME,
    dark: DARK_THEME
  };

  // Contrast checks
  useEffect(() => {
    const warnings = {};
    const t = normalizedTheme.text;
    const t2 = normalizedTheme.textSecondary;
    const bg = normalizedTheme.background;
    const sf = normalizedTheme.surface;
    const pr = normalizedTheme.primary;

    if (!ensureContrast(t, bg, 4.5)) {
      warnings.textBackground = `Primary text has low contrast on background (ratio ${ratioStr(t, bg)}).`;
    }
    if (!ensureContrast(t, sf, 4.5)) {
      warnings.textSurface = `Primary text has low contrast on surface (ratio ${ratioStr(t, sf)}).`;
    }
    if (!ensureContrast(t2, bg, 3)) {
      warnings.textSecondaryBackground = `Secondary text has low contrast on background (ratio ${ratioStr(t2, bg)}).`;
    }
    if (!ensureContrast(t2, sf, 3)) {
      warnings.textSecondarySurface = `Secondary text has low contrast on surface (ratio ${ratioStr(t2, sf)}).`;
    }

    const prText = bestBW(pr);
    if (!ensureContrast(prText, pr, 4.5)) {
      warnings.primaryButton = `Primary color may have contrast issues (ratio ${ratioStr(prText, pr)}).`;
    }

    setContrastWarnings(warnings);
  }, [normalizedTheme]);

  const handleColorChange = (colorKey, value) => {
    onChange(getNormalizedTheme({ ...theme, [colorKey]: value }));
  };

  const applyPreset = (preset) => onChange(getNormalizedTheme(preset));
  const resetToDefault = () => onChange(getNormalizedTheme(defaultTheme));

  const copyTheme = () => {
    const minimalTheme = CUSTOM_THEME_CONFIG_KEYS.reduce((acc, key) => {
      acc[key] = normalizedTheme[key];
      return acc;
    }, { name: normalizedTheme.name });
    const themeCode = JSON.stringify(minimalTheme, null, 2);
    navigator.clipboard.writeText(themeCode);
    setCopiedToClipboard(true);
    setTimeout(() => setCopiedToClipboard(false), 2000);
  };

  const colorDefinitions = {
    primary: { label: 'Primary', description: 'Main brand color for buttons and links' },
    primaryHover: { label: 'Primary Hover', description: 'Hover state for primary elements' },
    background: { label: 'Background', description: 'Main page background' },
    surface: { label: 'Surface', description: 'Cards and panels' },
    surfaceHover: { label: 'Surface Hover', description: 'Hover state for surfaces' },
    border: { label: 'Border', description: 'Primary borders and separators' },
    text: { label: 'Text', description: 'Primary text color' },
    textSecondary: { label: 'Text Secondary', description: 'Secondary/supporting text' },
    success: { label: 'Success', description: 'Success state color' },
    warning: { label: 'Warning', description: 'Warning state color' },
    error: { label: 'Error', description: 'Error state color' },
    info: { label: 'Info', description: 'Informational state color' },
    bannerBg: { label: 'Banner Bg', description: 'Highlight/banner background' },
    bannerText: { label: 'Banner Text', description: 'Highlight/banner foreground' }
  };

  // Organized color inputs by category (reduced to core configurable keys)
  const colorCategories = [
    {
      title: 'Brand Colors',
      colors: [
        'primary',
        'primaryHover'
      ]
    },
    {
      title: 'Backgrounds',
      colors: [
        'background',
        'surface',
        'surfaceHover',
        'border'
      ]
    },
    {
      title: 'Text',
      colors: [
        'text',
        'textSecondary'
      ]
    },
    {
      title: 'Status',
      colors: [
        'success',
        'warning',
        'error',
        'info'
      ]
    },
    {
      title: 'Banner',
      colors: [
        'bannerBg',
        'bannerText'
      ]
    }
  ].map((category) => ({
    ...category,
    colors: category.colors
      .filter((key) => CUSTOM_THEME_CONFIG_KEYS.includes(key))
      .map((key) => ({ key, ...colorDefinitions[key] }))
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium" style={{ color: UI_COLORS.text }}>Custom Theme Colors</h3>
        <div className="flex gap-2">
          <button
            onClick={resetToDefault}
            className="px-3 py-1 rounded-md flex items-center gap-2 text-sm transition-colors"
            style={{ 
              backgroundColor: UI_COLORS.surface,
              color: UI_COLORS.text,
              border: `1px solid ${UI_COLORS.border}`
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = UI_COLORS.surfaceHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = UI_COLORS.surface; }}
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={copyTheme}
            className="px-3 py-1 rounded-md flex items-center gap-2 text-sm transition-colors"
            style={{ 
              backgroundColor: UI_COLORS.surface,
              color: UI_COLORS.text,
              border: `1px solid ${UI_COLORS.border}`
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = UI_COLORS.surfaceHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = UI_COLORS.surface; }}
          >
            {copiedToClipboard ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedToClipboard ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Contrast Warnings */}
      {Object.keys(contrastWarnings).length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-600/30 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-yellow-400 mb-1">Contrast Warnings</h4>
              <ul className="text-xs text-yellow-300 space-y-1">
                {Object.values(contrastWarnings).map((warning, idx) => (
                  <li key={idx}>• {warning}</li>
                ))}
              </ul>
              <p className="text-xs text-yellow-200 mt-2">
                Text colors will be automatically adjusted where needed to ensure readability.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Theme Presets */}
      <div className="mb-6">
        <h4 className="text-sm font-medium mb-3" style={{ color: UI_COLORS.textSecondary }}>Base Presets</h4>
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(themePresets).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => applyPreset(preset)}
              className="p-3 rounded-lg transition-colors text-left"
              style={{
                backgroundColor: UI_COLORS.surface,
                border: `1px solid ${UI_COLORS.border}`
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = UI_COLORS.surfaceHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = UI_COLORS.surface; }}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: preset.primary }} />
                <span className="text-sm font-medium" style={{ color: UI_COLORS.text }}>{preset.name}</span>
              </div>

              <div className="flex gap-1">
                {[
                  preset.background,
                  preset.surface,
                  preset.primary
                ].map((color, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded border flex items-center justify-center"
                    style={{ backgroundColor: color, borderColor: preset.border }}
                  >
                    <span
                      className="text-xs font-bold"
                      style={{ color: bestBW(color) }}
                    >
                      A
                    </span>
                  </div>
                ))}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Color pickers by category */}
      <div className="space-y-6">
        {colorCategories.map((category) => (
          <div key={category.title}>
            <h4 className="text-sm font-semibold mb-3 pb-2 border-b" style={{ color: UI_COLORS.text, borderColor: UI_COLORS.border }}>
              {category.title}
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {category.colors.map(({ key, label, description }) => {
                const bg = theme[key] || defaultTheme[key] || '#808080';
                const badgeFg = bestBW(bg);
                const badgeBg = badgeFg === '#FFFFFF' ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.9)';
                return (
                  <div key={key} className="space-y-1">
                    <label className="block text-xs font-medium" style={{ color: UI_COLORS.textSecondary }}>
                      {label}
                    </label>
                    <div className="relative">
                      <input
                        type="color"
                        value={bg}
                        onChange={(e) => handleColorChange(key, e.target.value)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <div
                        className="w-full h-8 rounded-md border flex items-center justify-center cursor-pointer transition-colors"
                        style={{
                          backgroundColor: bg,
                          borderColor: UI_COLORS.border
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = UI_COLORS.primary; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = UI_COLORS.border; }}
                        title={description}
                      >
                        <span
                          className="text-xs font-mono px-1 rounded"
                          style={{ backgroundColor: badgeBg, color: badgeFg }}
                        >
                          {bg}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Live preview */}
      <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: UI_COLORS.surface, border: `1px solid ${UI_COLORS.border}` }}>
        <h4 className="text-sm font-medium mb-3" style={{ color: UI_COLORS.text }}>Live Preview</h4>
        <div
          className="p-4 rounded-md space-y-4"
          style={{
            backgroundColor: theme.background || defaultTheme.background,
            color: theme.text || defaultTheme.text,
            border: `1px solid ${theme.border || defaultTheme.border}`
          }}
        >
          {/* Mini Sidebar Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className="rounded border"
              style={{
                backgroundColor: theme.surface || defaultTheme.surface,
                borderColor: theme.border || defaultTheme.border
              }}
            >
              <div className="p-3 border-b" style={{ borderColor: theme.border || defaultTheme.border }}>
                <h6 className="text-sm font-medium" style={{ color: theme.text || defaultTheme.text }}>
                  Navigation Preview
                </h6>
              </div>
              <div className="p-2 space-y-1">
                {['Dashboard', 'Templates', 'Queries'].map((item, idx) => (
                  <button
                    key={idx}
                    className="w-full px-3 py-2 rounded text-left text-sm transition-colors flex items-center gap-2"
                    style={{
                      color: theme.text || defaultTheme.text,
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.surfaceHover || defaultTheme.surfaceHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: theme.primary || defaultTheme.primary }}
                    />
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* Card with buttons */}
            <div
              className="md:col-span-2 p-4 rounded"
              style={{ backgroundColor: theme.surface || defaultTheme.surface }}
            >
              <h5 className="font-medium mb-2" style={{ color: theme.text || defaultTheme.text }}>
                Interactive Elements
              </h5>
              <p className="mb-3" style={{ color: theme.textSecondary || defaultTheme.textSecondary }}>
                Hover over elements to see the hover states in action.
              </p>

              {/* Buttons with hover */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  className="px-3 py-1 rounded text-sm transition-all"
                  style={{
                    backgroundColor: theme.primary || defaultTheme.primary,
                    color: bestBW(theme.primary || defaultTheme.primary)
                  }}
                  onMouseEnter={(e) => {
                    const bg = theme.primaryHover || defaultTheme.primaryHover;
                    e.currentTarget.style.backgroundColor = bg;
                    e.currentTarget.style.color = bestBW(bg);
                  }}
                  onMouseLeave={(e) => {
                    const bg = theme.primary || defaultTheme.primary;
                    e.currentTarget.style.backgroundColor = bg;
                    e.currentTarget.style.color = bestBW(bg);
                  }}
                >
                  Primary Button
                </button>
                <button
                  className="px-3 py-1 rounded text-sm transition-all"
                  style={{
                    backgroundColor: theme.success || defaultTheme.success,
                    color: bestBW(theme.success || defaultTheme.success)
                  }}
                >
                  Success
                </button>
                <button
                  className="px-3 py-1 rounded text-sm transition-all"
                  style={{
                    backgroundColor: theme.error || defaultTheme.error,
                    color: bestBW(theme.error || defaultTheme.error)
                  }}
                >
                  Error
                </button>
              </div>

              {/* List items with hover */}
              <div className="space-y-2">
                <div className="text-xs font-medium mb-1" style={{ color: theme.textSecondary || defaultTheme.textSecondary }}>
                  List Items (hover to see effect)
                </div>
                {['Recent Activity Item 1', 'Recent Activity Item 2'].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded text-sm transition-colors cursor-pointer"
                    style={{
                      color: theme.text || defaultTheme.text,
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = theme.surfaceHover || defaultTheme.surfaceHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Additional preview elements */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div
              className="p-3 rounded border"
              style={{
                backgroundColor: theme.surface || defaultTheme.surface,
                borderColor: theme.border || defaultTheme.border
              }}
            >
              <h6 className="text-sm font-medium mb-1" style={{ color: theme.text || defaultTheme.text }}>
                Form Input
              </h6>
              <input
                type="text"
                placeholder="Sample input"
                className="w-full px-2 py-1 rounded border text-sm transition-colors"
                style={{
                  backgroundColor: theme.background || defaultTheme.background,
                  borderColor: theme.border || defaultTheme.border,
                  color: theme.text || defaultTheme.text
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = theme.primary || defaultTheme.primary;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = theme.border || defaultTheme.border;
                }}
              />
            </div>

            <div
              className="p-3 rounded border cursor-pointer transition-all"
              style={{
                backgroundColor: theme.surface || defaultTheme.surface,
                borderColor: theme.border || defaultTheme.border
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.surfaceHover || defaultTheme.surfaceHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.surface || defaultTheme.surface;
              }}
            >
              <h6 className="text-sm font-medium mb-1" style={{ color: theme.text || defaultTheme.text }}>
                Hover Card
              </h6>
              <p className="text-xs" style={{ color: theme.textSecondary || defaultTheme.textSecondary }}>
                Hover to see effect
              </p>
            </div>

            <div
              className="p-3 rounded"
              style={{
                backgroundColor: theme.surfaceHover || defaultTheme.surfaceHover
              }}
            >
              <h6 className="text-sm font-medium mb-1" style={{ color: theme.text || defaultTheme.text }}>
                Static Hover State
              </h6>
              <p className="text-xs" style={{ color: theme.textSecondary || defaultTheme.textSecondary }}>
                Surface hover color
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomThemeBuilder;
