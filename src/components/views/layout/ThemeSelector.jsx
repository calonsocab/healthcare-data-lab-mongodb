// src/components/views/layout/ThemeSelector.jsx
"use client";

import React from 'react';
import { Sun, Moon, Check } from 'lucide-react';
import { DARK_THEME, LIGHT_THEME } from '@/lib/config/defaults';

/**
 * Simple theme selector for individual users
 * Only Dark Mode and Light Mode options - no customization
 */
const ThemeSelector = ({ selectedTheme, onChange }) => {
  const isDark = selectedTheme?.name === 'Dark Mode' || selectedTheme?.background === DARK_THEME.background;

  const handleSelect = (themeKey) => {
    const theme = themeKey === 'dark' ? DARK_THEME : LIGHT_THEME;
    onChange(theme);
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Dark Mode Option */}
      <button
        type="button"
        onClick={() => handleSelect('dark')}
        className={`relative p-4 rounded-xl border-2 transition-all ${
          isDark
            ? 'border-primary bg-primary/10'
            : 'border-theme hover:border-primary/50 surface'
        }`}
      >
        {/* Theme Preview */}
        <div className="mb-4 rounded-lg overflow-hidden border border-theme">
          <div
            className="h-20 p-2"
            style={{ backgroundColor: DARK_THEME.background }}
          >
            {/* Mini preview of dark theme */}
            <div
              className="h-full rounded flex items-center justify-center"
              style={{ backgroundColor: DARK_THEME.surface }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: DARK_THEME.primary }}
              >
                <Moon className="w-4 h-4" style={{ color: DARK_THEME.background }} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Moon className="w-5 h-5 text-theme-secondary" />
            <span className="font-medium text-theme-primary">Dark Mode</span>
          </div>
          {isDark && (
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-4 h-4 text-primary-text" />
            </div>
          )}
        </div>

        <p className="text-xs text-theme-secondary mt-2 text-left">
          Easy on the eyes, perfect for low-light environments
        </p>
      </button>

      {/* Light Mode Option */}
      <button
        type="button"
        onClick={() => handleSelect('light')}
        className={`relative p-4 rounded-xl border-2 transition-all ${
          !isDark
            ? 'border-primary bg-primary/10'
            : 'border-theme hover:border-primary/50 surface'
        }`}
      >
        {/* Theme Preview */}
        <div className="mb-4 rounded-lg overflow-hidden border border-theme">
          <div
            className="h-20 p-2"
            style={{ backgroundColor: LIGHT_THEME.background }}
          >
            {/* Mini preview of light theme */}
            <div
              className="h-full rounded flex items-center justify-center"
              style={{ backgroundColor: LIGHT_THEME.surface }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: LIGHT_THEME.primary }}
              >
                <Sun className="w-4 h-4" style={{ color: LIGHT_THEME.background }} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sun className="w-5 h-5 text-theme-secondary" />
            <span className="font-medium text-theme-primary">Light Mode</span>
          </div>
          {!isDark && (
            <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-4 h-4 text-primary-text" />
            </div>
          )}
        </div>

        <p className="text-xs text-theme-secondary mt-2 text-left">
          Clean and bright, great for well-lit spaces
        </p>
      </button>
    </div>
  );
};

export default ThemeSelector;
