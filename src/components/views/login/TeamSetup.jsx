// src/components/views/login/TeamSetup.jsx
"use client";

import React, { useState, useRef } from 'react';
import { Code, Database, Plus, Settings, ChevronRight, Loader2, Check, AlertCircle, Copy, Eye, EyeOff, Users, Palette, Image as ImageIcon, X, Upload, User, Shield, Lock, ArrowLeft } from 'lucide-react';
import { DARK_THEME, getDefaultKehrnelUrl } from '@/lib/config/defaults';

// Default theme colors for use in setup screens (outside ThemeProvider)
// MongoDB brand compliant - Dark theme variant
const THEME_COLORS = {
  // Primary brand colors
  primary: '#00ED64',        // MongoDB Evergreen
  primaryHover: '#00684A',   // MongoDB Evergreen Dark
  primaryMuted: '#00ED6420', // Evergreen with transparency

  // Background hierarchy
  background: '#001E2B',     // MongoDB Dark Green
  surface: '#023430',        // Cards, panels
  surfaceHover: '#034540',   // Hover state
  surfaceAlt: '#012A23',     // Nested cards
  surfaceMuted: '#011F1A',   // Muted backgrounds

  // Cards
  card: '#023430',           // Card backgrounds
  cardHover: '#034540',      // Card hover
  cardAlt: '#013D35',        // Alternate cards

  // Borders
  border: '#1C4D47',         // Primary borders
  borderLight: '#164038',    // Subtle borders
  borderHover: '#00ED6440',  // Focus border

  // Text hierarchy
  text: '#FFFFFF',           // Primary text
  textSecondary: '#B8C4C2',  // Secondary text
  textMuted: '#7A8A87',      // Muted/disabled text
  textOnPrimary: '#001E2B',  // Text on primary

  // Status colors
  success: '#00ED64',        // MongoDB Evergreen
  successMuted: '#00ED6420', // Success background
  warning: '#FFC010',        // MongoDB Yellow
  warningMuted: '#FFC01020', // Warning background
  error: '#FF6960',          // MongoDB Red
  errorMuted: '#FF696020',   // Error background
  info: '#0498EC',           // MongoDB Blue
  infoMuted: '#0498EC20'     // Info background
};

const TeamSetup = ({
  user,
  onComplete,
  onBack = null,
  accountType,
  isJoiningWithCode = false,
  pendingJoinCode = null,
  skipToEnvironments = false   // Skip theme step for users who just need environment setup
}) => {
  // Individual accounts skip theme selection - always default to dark and go to environment setup
  const shouldSkipThemeStep = skipToEnvironments || accountType === 'individual';
  const [step, setStep] = useState(shouldSkipThemeStep ? 2 : 1);
  const [loading, setLoading] = useState(false);
  const [showConnectionString, setShowConnectionString] = useState({});
  const fileInputRef = useRef(null);
  const iconFileInputRef = useRef(null);
  const [teamData, setTeamData] = useState({
    name: '',
    logo: null,
    logoIcon: null,
    theme: DARK_THEME, // Always default to dark theme - customization happens in settings
    environments: []
  });

  const [newEnvironment, setNewEnvironment] = useState({
    name: '',
    description: '',
    connectionString: '',
    database: '',
    isActive: false
  });

  const [uploadError, setUploadError] = useState('');

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
      setUploadError(`Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG images are allowed.`);
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
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(objectUrl); // Clean up
        
        // Security: Dimension validation (prevent extremely large images)
        const MAX_DIMENSION = 4096; // 4K max
        if (img.width > MAX_DIMENSION || img.height > MAX_DIMENSION) {
          setUploadError(`Image dimensions too large. Maximum ${MAX_DIMENSION}x${MAX_DIMENSION}px.`);
          event.target.value = '';
          return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
          if (type === 'logo') {
            setTeamData({ ...teamData, logo: reader.result });
          } else {
            setTeamData({ ...teamData, logoIcon: reader.result });
          }
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
        if (type === 'logo') {
          setTeamData({ ...teamData, logo: reader.result });
        } else {
          setTeamData({ ...teamData, logoIcon: reader.result });
        }
        setUploadError('');
      };
      reader.onerror = () => {
        setUploadError('Failed to read file. Please try again.');
        event.target.value = '';
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddEnvironment = () => {
    if (newEnvironment.name && newEnvironment.database && newEnvironment.connectionString) {
      // If this is the first environment, make it active by default
      const isFirstEnv = teamData.environments.length === 0;
      const now = new Date().toISOString();

      setTeamData({
        ...teamData,
        environments: [...teamData.environments, {
          ...newEnvironment,
          id: `env-${Date.now()}`,
          isActive: isFirstEnv || newEnvironment.isActive,
          createdAt: now,
          updatedAt: now,
          strategyLinks: [], // No strategies by default
          kehrnel: {
            useDefault: false,
            apiUrl: getDefaultKehrnelUrl()
          }
        }]
      });
      setNewEnvironment({
        name: '',
        description: '',
        connectionString: '',
        database: '',
        isActive: false
      });
    }
  };

  const handleRemoveEnvironment = (id) => {
    const updatedEnvs = teamData.environments.filter(env => env.id !== id);
    // If we removed the active environment, make the first one active
    if (updatedEnvs.length > 0 && !updatedEnvs.some(env => env.isActive)) {
      updatedEnvs[0].isActive = true;
    }
    setTeamData({
      ...teamData,
      environments: updatedEnvs
    });
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      // If there's data in the form, add it as an environment before completing
      let finalTeamData = { ...teamData };
      if (newEnvironment.name && newEnvironment.database && newEnvironment.connectionString) {
        const isFirstEnv = teamData.environments.length === 0;
        const now = new Date().toISOString();
        const envToAdd = {
          ...newEnvironment,
          id: `env-${Date.now()}`,
          isActive: isFirstEnv || newEnvironment.isActive,
          createdAt: now,
          updatedAt: now,
          strategyLinks: [],
          kehrnel: {
            useDefault: false,
            apiUrl: getDefaultKehrnelUrl()
          }
        };
        finalTeamData = {
          ...teamData,
          environments: [...teamData.environments, envToAdd]
        };
      }
      await onComplete(finalTeamData);
    } catch (error) {
      console.error('Setup failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Form is valid when all required fields are filled
  const isFormValid = newEnvironment.name && newEnvironment.database && newEnvironment.connectionString;

  // Can complete if form is valid OR if there are already environments added
  const canComplete = isFormValid || teamData.environments.length > 0;

  // Different flows based on account type and join status
  const renderStep1 = () => {
    // Joining existing team with code
    if (isJoiningWithCode) {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <Users className="w-16 h-16 text-purple-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Joining Team</h2>
            <p className="text-theme-secondary">You're joining an existing team with code: <span className="font-mono text-primary">{pendingJoinCode}</span></p>
          </div>

          <div className="bg-surface border border-theme rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
              <div className="text-sm text-theme-secondary">
                <p className="font-medium mb-1">What happens next:</p>
                <ul className="list-disc list-inside space-y-1 text-theme-muted">
                  <li>You'll share the team's environments and settings</li>
                  <li>The team's theme will be applied automatically</li>
                  <li>Theme can be customized by team admins in settings</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleComplete()}
            className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Join Team
          </button>
        </div>
      );
    }

    // Individual account setup - theme selection skipped (always dark by default)
    // This code path shouldn't be reached as individual accounts start at step 2
    if (accountType === 'individual') {
      return null;
    }

    // Team account setup
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Team Setup</h2>
          <p className="text-theme-secondary">Create a new team or join an existing one</p>
        </div>

        {/* Option to join existing team */}
        <div className="bg-surface border border-theme rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Have an invite code?</h3>
          <p className="text-sm text-theme-muted mb-4">
            If you have a team invite code, you can join an existing team instead of creating a new one.
          </p>
          <button
            onClick={() => {
              // Redirect to join team flow
              const code = prompt('Enter your 6-character team code:');
              if (code && code.length === 6) {
                sessionStorage.setItem('organizationJoinCode', code.toUpperCase());
                window.location.reload();
              }
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <Code className="w-4 h-4" />
            Join Existing Team
          </button>
        </div>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-theme"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-background text-theme-secondary">or create a new team</span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-2">
              Team Name
            </label>
            <input
              type="text"
              value={teamData.name}
              onChange={(e) => setTeamData({ ...teamData, name: e.target.value })}
              className="w-full p-3 bg-surface-hover border border-theme rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Enter your team name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-2">
              Team Logos (Optional)
            </label>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-theme-muted mb-2">Full Logo (for expanded sidebar)</p>
                <div className="flex items-center space-x-4">
                  <div className="w-48 h-20 bg-surface-hover rounded-lg flex items-center justify-center border-2 border-dashed border-theme p-2">
                    {teamData.logo ? (
                      <img src={teamData.logo} alt="Team logo preview" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="text-center">
                        <ImageIcon className="w-8 h-8 text-theme-muted mx-auto mb-1" />
                        <p className="text-xs text-theme-muted">200x50 recommended</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'logo')}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-surface-hover text-theme-secondary rounded-lg hover:bg-surface transition-colors flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Logo
                  </button>
                </div>
              </div>

              <div>
                <p className="text-xs text-theme-muted mb-2">Icon Logo (for collapsed sidebar & favicon)</p>
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-20 bg-surface-hover rounded-lg flex items-center justify-center border-2 border-dashed border-theme p-2">
                    {teamData.logoIcon ? (
                      <img src={teamData.logoIcon} alt="Team icon preview" className="max-w-full max-h-full object-contain" />
                    ) : (
                      <div className="text-center">
                        <ImageIcon className="w-6 h-6 text-theme-muted mx-auto mb-1" />
                        <p className="text-xs text-theme-muted">Square</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={iconFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, 'icon')}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => iconFileInputRef.current?.click()}
                    className="px-4 py-2 bg-surface-hover text-theme-secondary rounded-lg hover:bg-surface transition-colors flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Icon
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Theme notice */}
          <div className="bg-slate-700/30 border border-slate-600 rounded-lg p-4">
            <p className="text-sm text-slate-300">
              <Palette className="w-4 h-4 inline mr-2 text-primary" />
              <strong>Theme:</strong> Your team will start with the default dark theme.
              You can customize colors and branding in Settings after setup.
            </p>
          </div>
        </div>

        <button
          onClick={() => setStep(2)}
          disabled={!teamData.name}
          className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          Continue to Environment Setup
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  };

  // Check if this will be the first environment (for forcing active checkbox)
  const isFirstEnvironment = teamData.environments.length === 0;

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">
          {skipToEnvironments ? 'Connect Your Database' : 'Environment Configuration'}
        </h2>
        <p style={{ color: THEME_COLORS.textSecondary }}>
          {skipToEnvironments
            ? 'Add your MongoDB connection to start using Healthcare Data Lab'
            : accountType === 'individual'
              ? 'Set up your personal MongoDB environments'
              : 'Set up shared environments for your team'
          }
        </p>
      </div>

      {/* Important Notice */}
      <div className="rounded-lg p-4" style={{ backgroundColor: `${THEME_COLORS.warning}15`, border: `1px solid ${THEME_COLORS.warning}40` }}>
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: THEME_COLORS.warning }} />
          <div className="text-sm">
            <p className="font-semibold mb-2" style={{ color: THEME_COLORS.warning }}>
              Important: Use a dedicated test user
            </p>
            <p style={{ color: THEME_COLORS.textSecondary }}>
              This platform is designed for <strong className="text-white">learning, prototyping, and experimentation</strong>—not for production use.
              We strongly recommend creating a <strong className="text-white">dedicated MongoDB Atlas user</strong> exclusively for this lab environment.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={newEnvironment.name}
            onChange={(e) => setNewEnvironment({ ...newEnvironment, name: e.target.value })}
            className="p-3 rounded-lg text-white focus:outline-none focus:ring-2"
            style={{
              backgroundColor: THEME_COLORS.surfaceHover,
              border: `1px solid ${THEME_COLORS.border}`,
              '--tw-ring-color': THEME_COLORS.primary
            }}
            placeholder="Environment name (e.g., DEV, PRE, PRO)"
          />
          <input
            type="text"
            value={newEnvironment.database}
            onChange={(e) => setNewEnvironment({ ...newEnvironment, database: e.target.value })}
            className="p-3 rounded-lg text-white focus:outline-none focus:ring-2"
            style={{
              backgroundColor: THEME_COLORS.surfaceHover,
              border: `1px solid ${THEME_COLORS.border}`,
              '--tw-ring-color': THEME_COLORS.primary
            }}
            placeholder="Database name"
          />
        </div>

        <input
          type="text"
          value={newEnvironment.description}
          onChange={(e) => setNewEnvironment({ ...newEnvironment, description: e.target.value })}
          className="w-full p-3 rounded-lg text-white focus:outline-none focus:ring-2"
          style={{
            backgroundColor: THEME_COLORS.surfaceHover,
            border: `1px solid ${THEME_COLORS.border}`,
            '--tw-ring-color': THEME_COLORS.primary
          }}
          placeholder="Description (optional)"
        />

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: THEME_COLORS.textSecondary }}>
            MongoDB Atlas Connection String
          </label>
          <div className="relative">
            <input
              type={showConnectionString['main'] === false ? 'password' : 'text'}
              value={newEnvironment.connectionString}
              onChange={(e) => setNewEnvironment({ ...newEnvironment, connectionString: e.target.value })}
              className="w-full p-3 pr-12 rounded-lg text-white focus:outline-none focus:ring-2 font-mono text-sm"
              style={{
                backgroundColor: THEME_COLORS.surfaceHover,
                border: `1px solid ${THEME_COLORS.border}`,
                '--tw-ring-color': THEME_COLORS.primary
              }}
              placeholder="mongodb+srv://username:password@cluster.mongodb.net"
            />
            <button
              type="button"
              onClick={() => setShowConnectionString({ ...showConnectionString, 'main': showConnectionString['main'] === false ? true : false })}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: THEME_COLORS.textSecondary }}
              title={showConnectionString['main'] === false ? 'Show connection string' : 'Hide connection string'}
            >
              {showConnectionString['main'] === false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>

          {/* Security info - close to connection string */}
          <div className="mt-3 rounded-lg p-3" style={{ backgroundColor: `${THEME_COLORS.primary}10`, border: `1px solid ${THEME_COLORS.primary}30` }}>
            <div className="flex items-start space-x-2">
              <Shield className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: THEME_COLORS.primary }} />
              <div className="text-xs" style={{ color: THEME_COLORS.textSecondary }}>
                <span className="font-medium" style={{ color: THEME_COLORS.primary }}>Your credentials are secure:</span>
                {' '}Connection strings are <strong className="text-white">encrypted with AES-256</strong> before being stored and decrypted only when needed.
                <span style={{ color: THEME_COLORS.textMuted }}> Database user must have readWrite permissions. Configure network access in Atlas to allow your IP.</span>
                {accountType === 'team' && (
                  <span style={{ color: THEME_COLORS.warning }}> Changes to environments affect all team members.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Only show "Set as active" checkbox if there are already other environments */}
        {teamData.environments.length > 0 && (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              checked={newEnvironment.isActive}
              onChange={(e) => setNewEnvironment({ ...newEnvironment, isActive: e.target.checked })}
              className="w-4 h-4 rounded"
              style={{
                backgroundColor: THEME_COLORS.surfaceHover,
                accentColor: THEME_COLORS.primary
              }}
            />
            <label htmlFor="isActive" className="text-sm" style={{ color: THEME_COLORS.textSecondary }}>
              Set as active environment
            </label>
          </div>
        )}
      </div>

      {/* Already added environments */}
      {teamData.environments.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium" style={{ color: THEME_COLORS.textSecondary }}>Added Environments</h3>
          {teamData.environments.map((env) => (
            <div
              key={env.id}
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ backgroundColor: THEME_COLORS.surface, border: `1px solid ${THEME_COLORS.border}` }}
            >
              <div className="flex items-center space-x-3">
                <Database className="w-4 h-4" style={{ color: THEME_COLORS.primary }} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{env.name}</span>
                    {env.isActive && (
                      <span
                        className="px-2 py-0.5 text-xs rounded-full"
                        style={{ backgroundColor: `${THEME_COLORS.success}20`, color: THEME_COLORS.success }}
                      >
                        Active
                      </span>
                    )}
                  </div>
                  <span className="text-xs" style={{ color: THEME_COLORS.textMuted }}>{env.database}</span>
                </div>
              </div>
              <button
                onClick={() => handleRemoveEnvironment(env.id)}
                className="transition-colors hover:opacity-80"
                style={{ color: THEME_COLORS.textSecondary }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-3">
        {/* Main action: Complete Setup */}
        <div className="flex space-x-3">
          {!skipToEnvironments && (
            <button
              onClick={() => setStep(1)}
              className="px-4 py-3 rounded-lg transition-colors"
              style={{
                backgroundColor: THEME_COLORS.surfaceHover,
                color: THEME_COLORS.textSecondary
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={handleComplete}
            disabled={!canComplete || loading}
            className="flex-1 px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
            style={{
              backgroundColor: THEME_COLORS.primary,
              color: THEME_COLORS.background,
              opacity: (!canComplete || loading) ? 0.5 : 1,
              cursor: (!canComplete || loading) ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Setting up...
              </>
            ) : (
              <>
                Complete Setup
                <Check className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        {/* Secondary action: Add another environment (only when form is valid) */}
        {isFormValid && (
          <button
            onClick={handleAddEnvironment}
            className="w-full px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
            style={{
              backgroundColor: 'transparent',
              color: THEME_COLORS.textSecondary,
              border: `1px solid ${THEME_COLORS.border}`
            }}
          >
            <Plus className="w-4 h-4" />
            Save & Add Another Environment
          </button>
        )}
      </div>
    </div>
  );

  // For joining team, skip multi-step
  if (isJoiningWithCode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: THEME_COLORS.background }}>
        <div className="w-full max-w-2xl">
          <div className="rounded-lg p-8" style={{ backgroundColor: THEME_COLORS.surface }}>
            {renderStep1()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: THEME_COLORS.background }}>
      <div className="w-full max-w-2xl">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-6 inline-flex items-center gap-2 text-sm transition-colors"
            style={{ color: THEME_COLORS.textSecondary }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}

        {/* Progress Steps - hide if skipping to environments only */}
        {!skipToEnvironments && (
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center space-x-4">
              <div
                className="flex items-center justify-center w-10 h-10 rounded-full"
                style={{
                  backgroundColor: step >= 1 ? THEME_COLORS.primary : THEME_COLORS.surfaceHover,
                  color: step >= 1 ? THEME_COLORS.background : THEME_COLORS.textSecondary
                }}
              >
                {accountType === 'individual' ? <User className="w-5 h-5" /> : <Users className="w-5 h-5" />}
              </div>
              <div
                className="w-16 h-0.5"
                style={{ backgroundColor: step >= 2 ? THEME_COLORS.primary : THEME_COLORS.surfaceHover }}
              />
              <div
                className="flex items-center justify-center w-10 h-10 rounded-full"
                style={{
                  backgroundColor: step >= 2 ? THEME_COLORS.primary : THEME_COLORS.surfaceHover,
                  color: step >= 2 ? THEME_COLORS.background : THEME_COLORS.textSecondary
                }}
              >
                <Settings className="w-5 h-5" />
              </div>
            </div>
          </div>
        )}

        {/* Form Container */}
        <div className="rounded-lg p-8" style={{ backgroundColor: THEME_COLORS.surface }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </div>
      </div>
    </div>
  );
};

export default TeamSetup;
