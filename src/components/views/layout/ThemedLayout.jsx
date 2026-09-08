// src/components/views/layout/ThemedLayout.jsx
"use client";

import HealthcareDataLabLogo from './HealthcareDataLabLogo';
import SailIcon from './SailIcon';
import FeedbackButton from '@/components/common/FeedbackButton';
import React, { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } from 'react';
import {
  FileText, Code, Tag, Server, FlaskConical, FileCode2,
  BarChart2, LogOut, Home, User, ChevronLeft,
  Users, ChevronDown, Check, Globe, ArrowRight, Layers,
  Boxes, Database, GraduationCap, History, Grid3X3, Loader2, Rocket,
  ChevronsUpDown, Palette, X, CheckCircle2, BookOpen, ExternalLink, ShieldCheck,
  Eye, Blocks, MessagesSquare, Wrench, LayoutTemplate, Activity, Plug, Plus
} from 'lucide-react';
import { NAVIGATION_CONFIG } from '@/config/navigation';
import { getNormalizedTheme } from '@/lib/config/defaults';
import { getLearningModuleIdForView, getLearningModuleById } from '@/lib/learning/moduleRouting';

// Theme utility functions
const getContrastColor = (hexColor) => {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return black or white based on luminance
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
};

// Determine if a background is dark (luminance < 0.5)
const isDarkBackground = (hexColor) => {
  if (!hexColor || !hexColor.startsWith('#')) return true; // Default to dark
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
};

// WCAG contrast ratio calculation
const getLuminance = (hexColor) => {
  const r = parseInt(hexColor.slice(1, 3), 16) / 255;
  const g = parseInt(hexColor.slice(3, 5), 16) / 255;
  const b = parseInt(hexColor.slice(5, 7), 16) / 255;

  const [rs, gs, bs] = [r, g, b].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

const contrastRatio = (color1, color2) => {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
};

// Theme Context
const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// Default dark theme (MongoDB Healthcare Data Lab)
const DEFAULT_THEME = {
  name: "Dark Mode",
  primary: "#01ec63",
  primaryHover: "#01694a",
  background: "#011e2b",
  surface: "#053e3a",
  surfaceHover: "#011e2b",
  border: "#334155",
  text: "#F1F5F9",
  textSecondary: "#9CA3AF", // Improved contrast ratio on dark surfaces
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444"
};

export const ThemeProvider = ({ children, initialTheme = {} }) => {
  const [currentTheme, setCurrentTheme] = useState(initialTheme);
  const normalizedTheme = useMemo(() => getNormalizedTheme(currentTheme), [currentTheme]);

  useEffect(() => {
    // Apply theme CSS variables
    const theme = currentTheme;

    // Set CSS variables
    const root = document.documentElement;

    // Determine if this is a light theme
    const isLightTheme = theme.name === 'Light Mode';
    root.setAttribute('data-theme', isLightTheme ? 'light' : 'dark');

    // Primary brand colors - MongoDB Evergreen
    root.style.setProperty('--color-primary', theme.primary || '#00ED64');
    root.style.setProperty('--color-primary-hover', theme.primaryHover || '#00684A');
    root.style.setProperty('--color-primary-muted', theme.primaryMuted || '#00ED6420');

    // Background hierarchy
    root.style.setProperty('--color-background', theme.background || '#001E2B');
    root.style.setProperty('--color-surface', theme.surface || '#023430');
    root.style.setProperty('--color-surface-hover', theme.surfaceHover || '#034540');
    root.style.setProperty('--color-surface-alt', theme.surfaceAlt || '#012A23');
    root.style.setProperty('--color-surface-muted', theme.surfaceMuted || '#011F1A');

    // Cards
    root.style.setProperty('--color-card', theme.card || '#023430');
    root.style.setProperty('--color-card-hover', theme.cardHover || '#034540');
    root.style.setProperty('--color-card-alt', theme.cardAlt || '#013D35');

    // Borders
    root.style.setProperty('--color-border', theme.border || '#1C4D47');
    root.style.setProperty('--color-border-light', theme.borderLight || '#164038');
    root.style.setProperty('--color-border-hover', theme.borderHover || '#00ED6440');

    // Text hierarchy
    root.style.setProperty('--color-text', theme.text || '#FFFFFF');
    root.style.setProperty('--color-text-secondary', theme.textSecondary || '#B8C4C2');
    root.style.setProperty('--color-text-muted', theme.textMuted || '#7A8A87');
    root.style.setProperty('--color-text-on-primary', theme.textOnPrimary || '#001E2B');

    // Status colors
    root.style.setProperty('--color-success', theme.success || '#00ED64');
    root.style.setProperty('--color-success-muted', theme.successMuted || '#00ED6420');
    root.style.setProperty('--color-warning', theme.warning || '#FFC010');
    root.style.setProperty('--color-warning-muted', theme.warningMuted || '#FFC01020');
    root.style.setProperty('--color-error', theme.error || '#FF6960');
    root.style.setProperty('--color-error-muted', theme.errorMuted || '#FF696020');
    root.style.setProperty('--color-info', theme.info || '#0498EC');
    root.style.setProperty('--color-info-muted', theme.infoMuted || '#0498EC20');

    // Accent colors
    root.style.setProperty('--color-accent-1', theme.accent1 || '#B45AF2');
    root.style.setProperty('--color-accent-2', theme.accent2 || '#FF7F50');
    root.style.setProperty('--color-accent-3', theme.accent3 || '#00D2FF');
    root.style.setProperty('--color-accent', theme.accent1 || theme.info || '#0498EC');
    root.style.setProperty('--color-accent-hover', theme.primaryHover || '#00684A');

    // Banner/Highlight colors
    root.style.setProperty('--color-banner-bg', theme.bannerBg || '#023430');
    root.style.setProperty('--color-banner-text', theme.bannerText || '#00ED64');
    root.style.setProperty('--color-banner-border', theme.bannerBorder || '#1C4D47');
    root.style.setProperty('--color-lime', theme.bannerText || '#00ED64');

    // Auto-calculated contrast colors
    root.style.setProperty('--color-primary-text', getContrastColor(theme.primary || '#00ED64'));
    root.style.setProperty('--color-success-text', getContrastColor(theme.success || '#00ED64'));
    root.style.setProperty('--color-warning-text', getContrastColor(theme.warning || '#FFC010'));
    root.style.setProperty('--color-error-text', getContrastColor(theme.error || '#FF6960'));
    root.style.setProperty('--color-info-text', getContrastColor(theme.info || '#0498EC'));
    root.style.setProperty('--color-accent-text', getContrastColor(theme.accent1 || theme.info || '#0498EC'));

    // Popups
    root.style.setProperty('--color-popup-bg', theme.popupBg || '#FFFFFF');
    root.style.setProperty('--color-popup-border', theme.popupBorder || '#D0D4D3');
    root.style.setProperty('--color-popup-text', theme.popupText || '#001E2B');
    root.style.setProperty('--color-popup-text-secondary', theme.popupTextSecondary || '#5C6C75');
    root.style.setProperty('--color-popup-hover', theme.popupHover || '#F5F6F7');

  }, [normalizedTheme]);

  const value = {
    theme: normalizedTheme,
    setTheme: setCurrentTheme,
    getContrastColor,
    getGradientContrastTextColor: (color1, color2) => {
      // For gradients, we need to determine which text color (black or white)
      // works best for BOTH colors in the gradient
      const color1Contrast = getContrastColor(color1 || '#FFFFFF');
      const color2Contrast = getContrastColor(color2 || '#FFFFFF');

      // If both colors work better with the same text color, use that
      if (color1Contrast === color2Contrast) {
        return color1Contrast;
      }

      // If they differ, calculate which provides better minimum contrast
      const blackOnColor1 = contrastRatio('#000000', color1 || '#FFFFFF');
      const blackOnColor2 = contrastRatio('#000000', color2 || '#FFFFFF');
      const whiteOnColor1 = contrastRatio('#FFFFFF', color1 || '#FFFFFF');
      const whiteOnColor2 = contrastRatio('#FFFFFF', color2 || '#FFFFFF');

      const blackMinContrast = Math.min(blackOnColor1, blackOnColor2);
      const whiteMinContrast = Math.min(whiteOnColor1, whiteOnColor2);

      return blackMinContrast >= whiteMinContrast ? '#000000' : '#FFFFFF';
    }
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// Bottom User Menu Component
const BottomUserMenu = ({
  user,
  team,
  activeEnvironment,
  onNavigate,
  onLogout,
  isIndividual,
  userTeams = [],
  onTeamSwitch,
  onCreateTeam,
  kehrnelStatus,
  isPlatformAdmin = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showTeams, setShowTeams] = useState(false);
  const adminPortalUrl = String(process.env.NEXT_PUBLIC_ADMIN_PORTAL_URL || '').trim();
  const showWorkspaceSwitcher = !!onCreateTeam || userTeams.length > 0 || !isIndividual;
  const currentWorkspaceName = isIndividual ? 'Personal Workspace' : (team?.name || 'Team Workspace');
  const availableTeamOptions = userTeams.filter(
    (candidateTeam) => candidateTeam?._id?.toString() !== team?._id?.toString()
  );
  const showPersonalWorkspaceOption = !isIndividual;
  const hasAlternateWorkspaces = showPersonalWorkspaceOption || availableTeamOptions.length > 0;

  const closeMenu = () => {
    setIsOpen(false);
    setShowTeams(false);
  };

  return (
    <>
      {/* Overlay - transparent, just for click-away */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={closeMenu}
        />
      )}

      {/* Menu */}
      <div className="relative">
        {/* Popup Menu - Light background for contrast with dark sidebar */}
        {isOpen && (
          <div
            className="absolute bottom-full left-0 right-0 mb-2 rounded-lg shadow-xl overflow-hidden z-50
                       bg-popup border border-popup animate-popup"
          >
            {/* User Header */}
            <div className="px-3 py-2.5 border-b border-popup">
              <p className="text-xs text-popup-secondary">{user?.email}</p>
            </div>

            {/* Workspace Switcher */}
            {showWorkspaceSwitcher && (
              <div className="px-1.5 py-1.5 border-b border-popup">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTeams(!showTeams);
                  }}
                  className="w-full px-2 py-1.5 rounded flex items-center justify-between gap-2
                             hover:bg-popup-hover transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Users className="w-4 h-4 text-popup-secondary flex-shrink-0" />
                    <div className="min-w-0 flex-1 text-left">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-popup-secondary">
                        Select Workspace
                      </div>
                      <div className="text-sm text-popup truncate">
                        {currentWorkspaceName}
                      </div>
                    </div>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-popup-secondary flex-shrink-0 transition-transform ${showTeams ? 'rotate-180' : ''}`} />
                </button>

                {/* Team List */}
                {showTeams && (
                  <div className="mt-1">
                    <div className="px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-popup-secondary">
                      Available Workspaces
                    </div>
                    <div className="space-y-0.5 max-h-32 overflow-y-auto">
                      {showPersonalWorkspaceOption && (
                        <button
                          onClick={() => {
                            onTeamSwitch(null);
                            closeMenu();
                          }}
                          className="w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between hover:bg-popup-hover transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <User className="w-3.5 h-3.5 text-popup-secondary flex-shrink-0" />
                            <span className="text-popup truncate">Personal Workspace</span>
                          </div>
                        </button>
                      )}

                      {availableTeamOptions.map((t) => (
                        <button
                          key={t._id}
                          onClick={() => {
                            onTeamSwitch(t._id);
                            closeMenu();
                          }}
                          className="w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between hover:bg-popup-hover transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Users className="w-3.5 h-3.5 text-popup-secondary flex-shrink-0" />
                            <span className="text-popup truncate">{t.name}</span>
                          </div>
                        </button>
                      ))}

                      {!hasAlternateWorkspaces && (
                        <div className="px-2 py-2 text-xs text-popup-secondary">
                          No other workspaces available yet.
                        </div>
                      )}
                    </div>

                    {onCreateTeam && (
                      <button
                        onClick={() => {
                          onCreateTeam();
                          closeMenu();
                        }}
                        className="w-full mt-1 text-left px-2 py-1.5 rounded text-sm flex items-center gap-2 hover:bg-popup-hover transition-colors border-t border-popup"
                      >
                        <Plus className="w-3.5 h-3.5 text-popup-secondary" />
                        <span className="text-popup">Create Team</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Menu Items */}
            <div className="px-1.5 py-1.5">
              {[
                ...(isIndividual
                  ? [{ icon: ArrowRight, label: 'Join Team', action: 'join-team' }]
                  : [{ icon: Users, label: 'Team', action: 'team' }]
                ),
                { icon: Tag, label: 'Data Organization', action: 'data-organization' },
                { icon: Globe, label: 'Environments', action: 'environments' },
                { icon: ShieldCheck, label: 'Workspace Health', action: 'workspace-health' },
                ...(isPlatformAdmin && adminPortalUrl
                  ? [{ icon: ExternalLink, label: 'Admin Portal (Internal)', href: adminPortalUrl, action: 'admin-internal' }]
                  : []
                ),
                { icon: Palette, label: 'Theme Configuration', action: 'theme-config' }
              ].map((item) => (
                <button
                  key={item.action || item.label}
                  onClick={() => {
                    if (item.href) {
                      window.open(item.href, '_blank', 'noopener,noreferrer');
                      closeMenu();
                      return;
                    }
                    onNavigate(item.action);
                    closeMenu();
                  }}
                  className="w-full px-2 py-1.5 rounded flex items-center gap-2
                             hover:bg-popup-hover transition-colors text-left"
                >
                  <item.icon className="w-4 h-4 text-popup-secondary" />
                  <span className="text-popup text-sm">{item.label}</span>
                </button>
              ))}
            </div>

            {/* Logout */}
            <div className="px-1.5 py-1.5 border-t border-popup">
              <button
                onClick={onLogout}
                className="w-full px-2 py-1.5 rounded flex items-center gap-2
                           hover:bg-error-muted transition-colors text-left"
              >
                <LogOut className="w-4 h-4 text-error" />
                <span className="text-error text-sm">Log out</span>
              </button>
            </div>
          </div>
        )}

        {/* Bottom Section */}
        <div className="space-y-2 bg-surface-muted px-4 py-3">
          {/* Status indicators as pills */}
          {activeEnvironment && (
            <div className="flex items-center gap-1.5 px-1">
              {/* Environment pill */}
              <button
                onClick={() => {
                  onNavigate('environments');
                  closeMenu();
                }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/20 hover:bg-green-500/30 transition-colors"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[10px] font-medium text-green-400">{activeEnvironment.name}</span>
              </button>

              {/* Kehrnel pill */}
              <button
                onClick={() => {
                  onNavigate('kehrnel');
                  closeMenu();
                }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-full transition-colors ${
                  kehrnelStatus?.available
                    ? 'bg-green-500/20 hover:bg-green-500/30'
                    : 'bg-red-500/20 hover:bg-red-500/30'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${kehrnelStatus?.available ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className={`text-[10px] font-medium ${kehrnelStatus?.available ? 'text-green-400' : 'text-red-400'}`}>
                  {kehrnelStatus?.available ? 'Kehrnel' : 'Offline'}
                </span>
              </button>
            </div>
          )}

          {/* User Trigger Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center gap-3 px-2 py-2 rounded-lg transition-all w-full
                        ${isOpen ? 'bg-surface-hover' : 'hover:bg-surface-hover/50'}`}
          >
            <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center flex-shrink-0">
              <span className="font-medium text-sm text-success-text">
                {user?.name?.charAt(0) || 'U'}
              </span>
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium truncate text-theme-primary">{user?.name || 'User'}</p>
              <p className="text-[10px] truncate text-theme-secondary">
                {isIndividual ? 'Personal' : (team?.name || 'Team')}
              </p>
            </div>
            <ChevronsUpDown className="w-4 h-4 text-theme-secondary flex-shrink-0" />
          </button>
        </div>
      </div>
    </>
  );
};

// Main Layout Component
const ThemedLayout = ({
  children,
  team,
  user,
  onNavigate,
  onLogout,
  activeEnvironment,
  onEnvironmentChange,
  currentPage,
  isIndividual,
  userTeams = [],
  onTeamSwitch,
  onCreateTeam,
  isPlatformAdmin = false,
  activeJobStatus = null, // { type: 'synthetic' | 'mapping', status: 'running' | 'paused' }
  kehrnelStatus = null // { available: boolean, version: string }
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Manual override for the Learning Directory panel.
  // null => auto (expanded when space allows, otherwise collapsed)
  // 'expanded' => user forced open (even if it overlays)
  // 'collapsed' => user forced closed
  //
  // NOTE: intentionally not persisted. On page entry we revert to auto so the panel
  // re-expands automatically when there's enough space.
  const [learningPanelOverride, setLearningPanelOverride] = useState(null);
  const [learningPanelCanExpand, setLearningPanelCanExpand] = useState(true);
  const contentRootRef = useRef(null);
  const learningModuleId = getLearningModuleIdForView(currentPage);
  const learningModule = getLearningModuleById(learningModuleId);

  const learningPanelExpanded =
    learningPanelOverride === 'expanded'
      ? true
      : learningPanelOverride === 'collapsed'
        ? false
        : learningPanelCanExpand;
  const learningPanelCollapsed = !learningPanelExpanded;

  // On page entry, default back to auto behavior:
  // expanded when there's space, collapsed when there isn't.
  useEffect(() => {
    setLearningPanelOverride(null);
  }, [currentPage]);

  // Auto-collapse the Learning Directory if there is no real gutter space on the right.
  // This avoids overlaying the main content on views that run full-width.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!learningModule) return;

    const root = contentRootRef.current;
    if (!root) return;

    let rafId = null;
    const compute = () => {
      rafId = null;

      // Prefer an explicit marker if a view adds it later, otherwise look for common centered containers.
      const candidate =
        root.querySelector('[data-learning-gutter]') ||
        root.querySelector('.max-w-7xl') ||
        root.querySelector('.max-w-6xl') ||
        root.querySelector('.max-w-5xl');

      if (!candidate) {
        setLearningPanelCanExpand(false);
        return;
      }

      const rect = candidate.getBoundingClientRect();
      const spaceRight = window.innerWidth - rect.right;

      // Panel is `w-80` and positioned with `right-4`. Require enough gutter so it doesn't overlap content.
      const required = 320 + 16 + 8; // width + right padding + buffer
      setLearningPanelCanExpand(spaceRight >= required);
    };

    const schedule = () => {
      if (rafId != null) return;
      rafId = window.requestAnimationFrame(compute);
    };

    const ro = new ResizeObserver(schedule);
    ro.observe(root);
    window.addEventListener('resize', schedule, { passive: true });
    schedule();

    return () => {
      window.removeEventListener('resize', schedule);
      ro.disconnect();
      if (rafId != null) window.cancelAnimationFrame(rafId);
    };
  }, [currentPage, learningModule]);

  // Manual toggle.
  // Note: even when there isn't enough space, manual expansion should still work (it will overlay content).
  const toggleLearningPanel = useCallback(() => {
    setLearningPanelOverride(prev => {
      const currentlyExpanded =
        prev === 'expanded' ? true : prev === 'collapsed' ? false : learningPanelCanExpand;
      return currentlyExpanded ? 'collapsed' : 'expanded';
    });
  }, [learningPanelCanExpand]);

  // Collapsible sections state - persisted in localStorage
  const [expandedSections, setExpandedSections] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('hdl_nav_sections');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // Invalid JSON, return default
        }
      }
    }
    // Default: only Home section expanded
    return NAVIGATION_CONFIG.sections.reduce((acc, section) => {
      acc[section.id] = section.id === 'home-section';
      return acc;
    }, {});
  });

  // Save expanded sections to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('hdl_nav_sections', JSON.stringify(expandedSections));
    }
  }, [expandedSections]);

  // Toggle section expansion - accordion style (only one open at a time)
  const toggleSection = (sectionId) => {
    setExpandedSections(prev => {
      const isCurrentlyExpanded = prev[sectionId];
      // If clicking on already expanded section, collapse it
      // Otherwise, collapse all and expand only the clicked one
      const allCollapsed = NAVIGATION_CONFIG.sections.reduce((acc, section) => {
        acc[section.id] = false;
        return acc;
      }, {});

      return {
        ...allCollapsed,
        [sectionId]: !isCurrentlyExpanded
      };
    });
  };

  // Auto-expand section containing current page (accordion style)
  useEffect(() => {
    if (currentPage) {
      const section = NAVIGATION_CONFIG.sections.find(s =>
        s.items.some(item => item.id === currentPage || item.viewId === currentPage)
      );
      if (section && !expandedSections[section.id]) {
        // Collapse all others, expand only the relevant section
        const allCollapsed = NAVIGATION_CONFIG.sections.reduce((acc, s) => {
          acc[s.id] = false;
          return acc;
        }, {});
        setExpandedSections({
          ...allCollapsed,
          [section.id]: true
        });
      }
    }
  }, [currentPage]);

  // Icon mapping for navigation config
  const iconMap = {
    Home, FileText, Code, Tag, Server, FlaskConical, FileCode2,
    BarChart2, Layers, Boxes, Database, GraduationCap, History, Grid3X3, Rocket, BookOpen,
    Eye, Blocks, MessagesSquare, Wrench, LayoutTemplate, Activity, Plug
  };

  // Get icon component from string name
  const getIcon = (iconName) => iconMap[iconName] || Home;

  const currentPageInfo = useMemo(() => {
    if (!currentPage) return { id: null, label: null, sectionId: null, sectionLabel: null };
    for (const section of NAVIGATION_CONFIG.sections || []) {
      const item = (section.items || []).find(i => i.id === currentPage || i.viewId === currentPage);
      if (item) {
        return {
          id: item.viewId || item.id,
          label: item.label || null,
          sectionId: section.id || null,
          sectionLabel: section.label || null
        };
      }
    }
    return { id: currentPage, label: null, sectionId: null, sectionLabel: null };
  }, [currentPage]);

  // Get active strategy from environment
  const activeStrategy = useMemo(() => {
    if (!activeEnvironment?.strategyLinks?.length) return null;
    const link = activeEnvironment.strategyLinks.find(l => l.strategyId);
    return link ? { id: link.strategyId, name: link.strategyName, protocol: link.domain } : null;
  }, [activeEnvironment]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 flex flex-col surface border-r border-theme`}>
        {/* Team Header */}
        <div className="relative px-4 pt-3 pb-4 border-b border-theme">
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center pt-1">
              <button
                onClick={() => setSidebarCollapsed(false)}
                className="absolute top-2 right-2 p-1 rounded surface-hover z-10 text-theme-secondary"
              >
                <ChevronLeft className="w-4 h-4 rotate-180" />
              </button>
              <div className="w-full flex justify-center">
                {/* Collapsed: show sail icon */}
                <SailIcon className="w-10 h-10" />
              </div>
            </div>
          ) : (
            <>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="absolute top-3 right-2 p-1 rounded surface-hover z-10 text-theme-secondary"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="pr-8">
                {/* Full logo - larger size */}
                <HealthcareDataLabLogo className="block w-full h-24" />
              </div>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-thin">
          {NAVIGATION_CONFIG.sections.map((section, sectionIndex) => {
            const isExpanded = expandedSections[section.id] !== false;
            const hasActiveItem = section.items.some(item =>
              currentPage === item.id || currentPage === item.viewId
            );

            return (
              <div key={section.id} className={sectionIndex > 0 ? 'pt-2' : ''}>
                {/* Section Header - Clickable */}
                {!sidebarCollapsed && (
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full px-3 py-1.5 flex items-center justify-between group hover:bg-theme-secondary/5 rounded-md transition-colors"
                  >
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${hasActiveItem ? 'text-primary' : 'text-section-header'}`}>
                      {section.label}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 text-theme-secondary transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'}`}
                    />
                  </button>
                )}
                {sidebarCollapsed && sectionIndex > 0 && (
                  <div className="border-t border-theme my-2" />
                )}

                {/* Section Items - Collapsible */}
                <div
                  className={`space-y-0.5 overflow-hidden transition-all duration-200 ${
                    !sidebarCollapsed && !isExpanded ? 'max-h-0 opacity-0' : 'max-h-[500px] opacity-100'
                  }`}
                >
                  {section.items.map((item) => {
                    const isActive = currentPage === item.id || currentPage === item.viewId;
                    const IconComponent = getIcon(item.icon);
                    const badge = item.badge ? { text: item.badge } : null;

                    return (
                      <div key={item.id}>
                        <button
                          onClick={() => {
                            if (item.externalUrl) {
                              window.open(item.externalUrl, '_blank', 'noopener,noreferrer');
                              return;
                            }
                            onNavigate(item.viewId || item.id);
                          }}
                          className={`relative w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}
                            p-2.5 rounded-lg transition-all duration-200
                            ${isActive
                              ? 'bg-primary/10 text-primary'
                              : 'hover:surface-hover text-theme-primary'
                            }`}
                          title={sidebarCollapsed ? item.label : undefined}
                        >
                          <div className="flex items-center">
                            <IconComponent className={`w-5 h-5 ${isActive ? 'text-primary' : 'text-primary opacity-70'}`} />
                            {!sidebarCollapsed && (
                              <>
                                <span className={`ml-3 text-sm ${isActive ? 'font-medium' : ''}`}>
                                  {item.label}
                                </span>
                                {item.externalUrl && (
                                  <ExternalLink className="w-3.5 h-3.5 ml-1.5 text-theme-secondary" />
                                )}
                              </>
                            )}
                          </div>
                          {!sidebarCollapsed && badge && (
                            badge.isLoading ? (
                              <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            ) : (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-primary/20 text-primary">
                                {badge.text}
                              </span>
                            )
                          )}
                          {sidebarCollapsed && badge?.isLoading && (
                            <div className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Sidebar Job Status */}
        {activeJobStatus && (
          <div className={`px-2 pb-2 ${sidebarCollapsed ? '' : ''}`}>
            {sidebarCollapsed ? (
              <button
                onClick={() => onNavigate('history')}
                className={`w-full p-2 rounded-lg transition-colors flex justify-center ${
                  activeJobStatus.status === 'running'
                    ? 'bg-primary/10 text-primary hover:bg-primary/20'
                    : 'bg-success/10 text-success hover:bg-success/20'
                }`}
                title={activeJobStatus.status === 'running' ? 'Open running job in Jobs History' : 'Open completed job in Jobs History'}
              >
                {activeJobStatus.status === 'running' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
              </button>
            ) : (
              <div className={`rounded-lg border p-3 ${
                activeJobStatus.status === 'running'
                  ? 'border-primary/30 bg-primary/10'
                  : 'border-success/30 bg-success/10'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => onNavigate('history')}
                    className="flex items-center gap-2 min-w-0 text-left"
                  >
                    {activeJobStatus.status === 'running' ? (
                      <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                    )}
                    <span className={`text-xs font-medium truncate ${
                      activeJobStatus.status === 'running' ? 'text-primary' : 'text-success'
                    }`}>
                      {activeJobStatus.status === 'running'
                        ? (activeJobStatus.jobCount > 1 ? `${activeJobStatus.jobCount} jobs running` : 'Job running')
                        : 'Last job completed'}
                    </span>
                  </button>
                  {activeJobStatus.status === 'completed' && (
                    <button
                      onClick={() => typeof activeJobStatus.onDismiss === 'function' && activeJobStatus.onDismiss()}
                      className="p-1 rounded hover:bg-surface-hover text-theme-secondary hover:text-theme-primary"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => onNavigate('history')}
                  className="mt-2 text-[11px] text-theme-secondary hover:text-theme-primary"
                >
                  Open Jobs History
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bottom User Menu */}
        <div>
          {sidebarCollapsed ? (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="w-full p-3 rounded-lg surface-hover transition-colors flex justify-center"
            >
              <User className="w-5 h-5 text-primary" />
            </button>
          ) : (
            <BottomUserMenu
              user={user}
              team={team}
              activeEnvironment={activeEnvironment}
              onNavigate={onNavigate}
              onLogout={onLogout}
              isIndividual={isIndividual}
              userTeams={userTeams}
              onTeamSwitch={onTeamSwitch}
              onCreateTeam={onCreateTeam}
              kehrnelStatus={kehrnelStatus}
              isPlatformAdmin={isPlatformAdmin}
            />
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col">
	        <div ref={contentRootRef} className="flex-1 overflow-auto relative">
	          {children}
	          {currentPage !== 'learn' && currentPage !== 'home' && learningModule && (
	            <>
	              {/* When the Learning Directory overlays content, dim the background for readability. */}
	              {learningPanelExpanded && !learningPanelCanExpand && (
	                <div
	                  className="hidden 2xl:block absolute inset-0 bg-black/55 backdrop-blur-[1px] z-10"
	                  onClick={() => setLearningPanelOverride('collapsed')}
	                  aria-hidden="true"
	                />
	              )}
	            <aside
	              className={`hidden 2xl:block absolute right-4 rounded-xl border border-theme bg-surface/95 backdrop-blur-md shadow-lg z-20 transition-all duration-300 ${
	                learningPanelCollapsed ? 'w-12 p-2' : 'w-80 p-4'
	              }`}
	              style={{ top: '14rem' }}
	            >
              {learningPanelCollapsed ? (
                /* Collapsed state - icon only */
                <button
                  onClick={toggleLearningPanel}
                  className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-surface-hover transition-colors"
                  title={learningPanelCanExpand ? 'Expand Learning Directory' : 'Expand Learning Directory (will overlay)'}
                >
                  <GraduationCap className="w-5 h-5 text-primary" />
                </button>
              ) : (
                /* Expanded state - full content */
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-theme-primary">Learning Directory</h3>
                    </div>
                    <button
                      onClick={toggleLearningPanel}
                      className="p-1 rounded hover:bg-surface-hover transition-colors"
                      title="Collapse"
                    >
                      <X className="w-4 h-4 text-theme-secondary" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-primary">{learningModule.title}</h4>
                    <p className="text-xs text-theme-secondary">{learningModule.description}</p>
                    {learningModule.steps && (
                      <ul className="mt-2 space-y-1.5">
                        {learningModule.steps.slice(0, 4).map((step, i) => (
                          <li key={step.id} className="flex items-start gap-2 text-xs">
                            <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center flex-shrink-0 text-[10px] font-medium">
                              {i + 1}
                            </span>
                            <span className="text-theme-secondary">{step.title}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      onClick={() => onNavigate(`learn:${learningModule.id}`)}
                      className="mt-3 w-full px-3 py-1.5 text-xs rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      View Full Module
                    </button>
                  </div>
                </>
	              )}
	            </aside>
	            </>
	          )}
	        </div>
	      </main>

      {/* Feedback Button */}
      <FeedbackButton
        currentPageInfo={currentPageInfo}
        team={team}
        user={user}
        activeEnvironment={activeEnvironment}
        activeStrategy={activeStrategy}
      />
    </div>
  );
};

export default ThemedLayout;
