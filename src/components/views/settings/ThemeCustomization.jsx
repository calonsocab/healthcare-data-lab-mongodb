// src/components/views/settings/ThemeCustomization.jsx
"use client";

import React, { useState, useRef } from 'react';
import { Sun, Moon, Check, AlertTriangle, Upload, Image, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { CUSTOM_THEME_CONFIG_KEYS, DARK_THEME, LIGHT_THEME, getNormalizedTheme } from '@/lib/config/defaults';
import CustomThemeBuilder from '../layout/CustomThemeBuilder';
import HealthcareDataLabLogo from '../layout/HealthcareDataLabLogo';

/**
 * ThemeCustomization - Dedicated Theme Configuration page
 *
 * Structure:
 * 1. Top selector: "Healthcare Data Lab" (default) vs "Custom Workspace"
 * 2. Dark/Light toggle (available for both, custom might only have dark)
 * 3. Custom workspace includes: logos + custom colors
 * 4. Any user can modify, but warning before saving (affects all team)
 */
const ThemeCustomization = ({ team, preferences, onUpdate, isIndividual, currentUser }) => {
  const currentTheme = team?.theme || preferences?.theme || DARK_THEME;

  // Check if currently using custom workspace
  const isCurrentlyCustom = team?.useCustomWorkspace || preferences?.useCustomWorkspace || false;

  // Determine current mode (dark/light)
  const isCurrentlyLight = currentTheme?.name === 'Light Mode' ||
    currentTheme?.background === LIGHT_THEME.background;

  // State
  const [useCustomWorkspace, setUseCustomWorkspace] = useState(isCurrentlyCustom);
  const [selectedMode, setSelectedMode] = useState(isCurrentlyLight ? 'light' : 'dark');
  const [customTheme, setCustomTheme] = useState(getNormalizedTheme(currentTheme));
  const [customLogos, setCustomLogos] = useState({
    logo: team?.logo || preferences?.logo || null,
    logoIcon: team?.logoIcon || preferences?.logoIcon || null
  });
  const [teamName, setTeamName] = useState(team?.name || '');
  const [showThemeBuilder, setShowThemeBuilder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const fileInputRef = useRef(null);
  const iconFileInputRef = useRef(null);

  // Determine user role for display purposes
  const normalizeRole = (value = '') => String(value || '').trim().toLowerCase();
  const getUserRole = () => {
    if (isIndividual) return 'owner';

    const explicitRole = normalizeRole(team?.currentUserRole || team?.userRole);
    if (explicitRole) return explicitRole;

    if (!Array.isArray(team?.members) || !currentUser?.email) return 'member';

    const member = team.members.find(
      (m) => m.email?.toLowerCase() === currentUser.email.toLowerCase()
    );
    return normalizeRole(member?.role) || 'member';
  };
  const userRole = getUserRole();
  const isAdmin = userRole === 'owner' || userRole === 'admin';

  const handleFileUpload = (event, type) => {
    const file = event.target.files[0];
    if (!file) return;

    // Security: File size validation (2MB max to prevent DoS)
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      setUploadError(`File too large. Maximum size is 2MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`);
      event.target.value = '';
      return;
    }

    // Security: MIME type validation (whitelist approach)
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setUploadError('Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG images are allowed.');
      event.target.value = '';
      return;
    }

    // Security: Validate file extension matches MIME type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    if (!validExtensions.includes(fileExtension)) {
      setUploadError('Invalid file extension detected.');
      event.target.value = '';
      return;
    }

    // For images (except SVG), validate dimensions
    if (file.type !== 'image/svg+xml') {
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX_DIMENSION = 4096; // 4K max
        if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
          setUploadError(`Image dimensions too large. Maximum ${MAX_DIMENSION}x${MAX_DIMENSION}px.`);
          event.target.value = '';
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          setCustomLogos(prev => ({
            ...prev,
            [type]: reader.result
          }));
          setUploadError('');
        };
        reader.onerror = () => {
          setUploadError('Failed to read file. Please try again.');
          event.target.value = '';
        };
        reader.readAsDataURL(file);
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        setUploadError('Invalid or corrupted image file.');
        event.target.value = '';
      };

      img.src = objectUrl;
    } else {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCustomLogos(prev => ({
          ...prev,
          [type]: reader.result
        }));
        setUploadError('');
      };
      reader.onerror = () => {
        setUploadError('Failed to read file. Please try again.');
        event.target.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  // Get the effective theme based on selections
  const getEffectiveTheme = () => {
    if (useCustomWorkspace) {
      return customTheme;
    }
    return selectedMode === 'dark' ? DARK_THEME : LIGHT_THEME;
  };

  // Check if team-wide settings changed (workspace style, custom theme, or team name)
  const hasTeamWideChanges = () => {
    const originalCustom = team?.useCustomWorkspace || preferences?.useCustomWorkspace || false;
    if (useCustomWorkspace !== originalCustom) return true;
    if (useCustomWorkspace) {
      // Check if team name changed (only relevant for custom workspace)
      if (teamName !== (team?.name || '')) return true;
      // Check if custom theme or logos changed
      const originalTheme = team?.theme || preferences?.theme || {};
      const originalLogo = team?.logo || preferences?.logo || null;
      const originalIcon = team?.logoIcon || preferences?.logoIcon || null;
      if (JSON.stringify(customTheme) !== JSON.stringify(originalTheme)) return true;
      if (customLogos.logo !== originalLogo) return true;
      if (customLogos.logoIcon !== originalIcon) return true;
    }
    return false;
  };

  const handleSaveClick = () => {
    // Show warning only for team-wide changes (not for personal dark/light preference)
    if (!isIndividual && hasTeamWideChanges()) {
      setShowWarning(true);
    } else {
      handleSave();
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setShowWarning(false);
    try {
      const effectiveTheme = getEffectiveTheme();
      const themeToSave = useCustomWorkspace
        ? CUSTOM_THEME_CONFIG_KEYS.reduce((acc, key) => {
          acc[key] = effectiveTheme[key];
          return acc;
        }, { name: effectiveTheme.name })
        : effectiveTheme;
      const dataToSave = {
        theme: themeToSave,
        useCustomWorkspace,
        ...(useCustomWorkspace && !isIndividual && { name: teamName }),
        ...(useCustomWorkspace && {
          logo: customLogos.logo,
          logoIcon: customLogos.logoIcon
        }),
        ...(!useCustomWorkspace && {
          logo: null,
          logoIcon: null
        })
      };

      await onUpdate(dataToSave);
      window.location.reload();
    } catch (error) {
      alert(error?.message || 'Failed to save theme settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-theme-primary mb-2">Theme Configuration</h1>
      <p className="text-theme-secondary mb-8">
        {isIndividual
          ? 'Configure the appearance of your workspace'
          : 'Configure the appearance for your entire team'}
      </p>

      {/* Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-theme rounded-xl p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
              </div>
              <h3 className="text-lg font-semibold text-theme-primary">Confirm Team Changes</h3>
            </div>
            <p className="text-theme-secondary mb-4">
              You're changing the <strong className="text-theme-primary">Workspace Style</strong> or <strong className="text-theme-primary">Custom Theme</strong>.
            </p>
            <p className="text-theme-secondary mb-6">
              These changes will affect <strong className="text-yellow-400">all team members</strong>.
              Are you sure you want to save?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowWarning(false)}
                className="flex-1 px-4 py-2 border border-theme rounded-lg text-theme-secondary hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-primary text-primary-text rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Section 1: Workspace Style Selection */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-theme-primary mb-4">Workspace Style</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Healthcare Data Lab (Default) */}
          <button
            type="button"
            onClick={() => setUseCustomWorkspace(false)}
            className={`relative p-5 rounded-xl border-2 transition-all text-left ${
              !useCustomWorkspace
                ? 'border-primary bg-primary/10'
                : 'border-theme hover:border-primary/50 bg-surface'
            }`}
          >
            {/* HDL Logo Preview */}
            <div className="mb-4 h-12 flex items-center">
              <HealthcareDataLabLogo className="h-10" />
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-theme-primary">Healthcare Data Lab</span>
              {!useCustomWorkspace && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-primary-text" />
                </div>
              )}
            </div>
            <p className="text-sm text-theme-secondary">
              Default branding with HDL logo and colors
            </p>
          </button>

          {/* Custom Workspace */}
          <button
            type="button"
            onClick={() => setUseCustomWorkspace(true)}
            className={`relative p-5 rounded-xl border-2 transition-all text-left ${
              useCustomWorkspace
                ? 'border-primary bg-primary/10'
                : 'border-theme hover:border-primary/50 bg-surface'
            }`}
          >
            {/* Custom Logo Preview */}
            <div className="mb-4 h-12 flex items-center">
              {customLogos.logo ? (
                <img src={customLogos.logo} alt="Custom Logo" className="h-10 object-contain" />
              ) : (
                <div className="h-10 px-4 rounded bg-primary/20 flex items-center justify-center">
                  <span className="text-primary text-sm font-medium">Your Logo</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-theme-primary">Custom Workspace</span>
              {useCustomWorkspace && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
            <p className="text-sm text-theme-secondary">
              Custom branding with your own logo and colors
            </p>
          </button>
        </div>
      </div>

      {/* Section 2: Dark/Light Mode Toggle */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-theme-primary mb-4">Color Mode</h2>

        <div className="grid grid-cols-2 gap-4">
          {/* Dark Mode */}
          <button
            type="button"
            onClick={() => {
              setSelectedMode('dark');
              if (useCustomWorkspace) {
                // Apply official dark preset as base
                setCustomTheme(prev => getNormalizedTheme({ ...DARK_THEME, ...prev, name: 'Dark Mode' }));
              }
            }}
            className={`relative p-4 rounded-xl border-2 transition-all ${
              selectedMode === 'dark'
                ? 'border-primary bg-primary/10'
                : 'border-theme hover:border-primary/50 bg-surface'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                  <Moon className="w-5 h-5 text-slate-300" />
                </div>
                <span className="font-medium text-theme-primary">Dark</span>
              </div>
              {selectedMode === 'dark' && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-text" />
                </div>
              )}
            </div>
          </button>

          {/* Light Mode */}
          <button
            type="button"
            onClick={() => {
              setSelectedMode('light');
              if (useCustomWorkspace) {
                // Apply official light preset as base
                setCustomTheme(prev => getNormalizedTheme({ ...LIGHT_THEME, ...prev, name: 'Light Mode' }));
              }
            }}
            className={`relative p-4 rounded-xl border-2 transition-all ${
              selectedMode === 'light'
                ? 'border-primary bg-primary/10'
                : 'border-theme hover:border-primary/50 bg-surface'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Sun className="w-5 h-5 text-yellow-500" />
                </div>
                <span className="font-medium text-theme-primary">Light</span>
              </div>
              {selectedMode === 'light' && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3 h-3 text-primary-text" />
                </div>
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Section 3: Custom Workspace Configuration (only when Custom is selected) */}
      {useCustomWorkspace && (
        <div className="mb-8 space-y-6">
          {/* Custom Branding */}
          <div className="surface rounded-xl p-6 border border-primary/30">
            <h3 className="text-md font-semibold text-theme-primary mb-4">Custom Branding</h3>

            <div className="space-y-4">
              {/* Team Name (only for team users) */}
              {!isIndividual && (
                <div>
                  <label className="block text-sm text-theme-secondary mb-2">Team Name</label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    className="w-full p-3 surface border border-theme rounded-lg text-theme-primary focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter your team name"
                  />
                </div>
              )}

              {/* Full Logo */}
              <div>
                <label className="block text-sm text-theme-secondary mb-2">
                  Full Logo (for expanded sidebar)
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-48 h-16 surface rounded-lg flex items-center justify-center border-2 border-dashed border-theme p-2">
                    {customLogos.logo ? (
                      <img src={customLogos.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="text-center">
                        <Image className="w-6 h-6 text-theme-muted mx-auto mb-1" />
                        <p className="text-xs text-theme-muted">200x50 recommended</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                    onChange={(e) => handleFileUpload(e, 'logo')}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 surface text-theme-secondary rounded-lg border border-theme hover:bg-surface-hover transition-colors flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Logo
                  </button>
                </div>
              </div>

              {/* Icon Logo */}
              <div>
                <label className="block text-sm text-theme-secondary mb-2">
                  Icon Logo (for collapsed sidebar & favicon)
                </label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 surface rounded-lg flex items-center justify-center border-2 border-dashed border-theme p-2">
                    {customLogos.logoIcon ? (
                      <img src={customLogos.logoIcon} alt="Icon" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="text-center">
                        <Image className="w-5 h-5 text-theme-muted mx-auto" />
                        <p className="text-xs text-theme-muted">Square</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={iconFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                    onChange={(e) => handleFileUpload(e, 'logoIcon')}
                    className="hidden"
                  />
                  <button
                    onClick={() => iconFileInputRef.current?.click()}
                    className="px-4 py-2 surface text-theme-secondary rounded-lg border border-theme hover:bg-surface-hover transition-colors flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Icon
                  </button>
                </div>
              </div>
            </div>
            {uploadError && (
              <div className="mt-3 flex items-start gap-2 text-sm text-red-400">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}
          </div>

          {/* Custom Colors */}
          <div className="surface rounded-xl border border-primary/30">
            <button
              onClick={() => setShowThemeBuilder(!showThemeBuilder)}
              className="w-full p-4 flex items-center justify-between hover:bg-surface-hover transition-colors rounded-xl"
            >
              <div>
                <h3 className="text-md font-semibold text-theme-primary text-left">Custom Colors</h3>
                <p className="text-sm text-theme-secondary text-left">Customize primary color and other theme colors</p>
              </div>
              {showThemeBuilder ? <ChevronUp className="w-5 h-5 text-theme-secondary" /> : <ChevronDown className="w-5 h-5 text-theme-secondary" />}
            </button>

            {showThemeBuilder && (
              <div className="p-4 border-t border-theme">
                <CustomThemeBuilder
                  theme={customTheme}
                  onChange={setCustomTheme}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info notice for team users */}
      {!isIndividual && (
        <div className="mb-6 p-4 bg-info-muted border border-info/30 rounded-lg flex items-start gap-3">
          <Info className="w-5 h-5 text-info mt-0.5 flex-shrink-0" />
          <div className="text-sm text-theme-secondary">
            <p><strong>Color Mode</strong> (Dark/Light) is your personal preference.</p>
            <p className="mt-1"><strong>Workspace Style</strong> and <strong>Custom theme</strong> changes affect all team members.</p>
          </div>
        </div>
      )}

      {/* Save Button */}
      <button
        onClick={handleSaveClick}
        disabled={saving}
        className="w-full px-4 py-3 bg-primary text-primary-text font-medium rounded-lg hover:bg-primary-hover disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
};

export default ThemeCustomization;
