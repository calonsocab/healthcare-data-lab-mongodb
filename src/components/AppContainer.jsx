// src/components/AppContainer.jsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useSession, signOut } from 'next-auth/react';
import { useTosAcceptance } from '@/hooks/useTosAcceptance';
import { useSessionTracking } from '@/hooks/useSessionTracking';
import ThemedLayout, { ThemeProvider } from './views/layout/ThemedLayout';
import { DataModelProvider } from '@/providers/DataModelProvider';
import { AQLQueryProvider } from '@/providers/AQLQueryProvider';
import { MetadataProvider } from '@/providers/MetadataProvider';
import { PersistenceStrategyProvider } from '@/providers/PersistenceStrategyProvider';
import SherpaHostRouter from '@/components/integrations/demoSherpa/SherpaHostRouter';
import LoginPage from './views/login/LoginPage';
import AccountTypeSelection from './views/login/AccountTypeSelection';
import TeamSetup from './views/login/TeamSetup';
import TeamSelector from './views/login/TeamSelector';
import AccessGate from './views/login/AccessGate';
import MaintenancePage from './views/login/MaintenancePage';
import HomeDashboard from './views/layout/HomeDashboard';
import WorkspaceHealthView from './views/layout/WorkspaceHealthView';
import DataLab from './views/main/Main';
import EnvironmentSettings from './views/settings/EnvironmentSettings';
import TeamManagement from './views/settings/TeamManagement';
import DataOrganization from './views/settings/dataOrganization/DataOrganization';
import JoinTeam from './views/settings/JoinTeam';
import ThemeCustomization from './views/settings/ThemeCustomization';
import ContextObjectBuilder from './views/contextObjectBuilder/contextObjectBuilder';
import LearningCenter from './views/learningCenter/LearningCenter';
import AppGallery from './views/appGallery/AppGallery';
import DataHistoryView from './views/dataFactory/DataHistoryView';
import APITestingDoc from './views/apiTesting/APITestingDoc';
import LoadingScreen from '@/components/ui/LoadingScreen';

const HealthcareDataLabSherpa = dynamic(
  () => import('@/components/integrations/demoSherpa/HealthcareDataLabSherpa'),
  { ssr: false }
);

const AppContainer = ({ initialView = 'home' }) => {
  const { data: session, status } = useSession();
  useTosAcceptance(); // Persist ToS acceptance to database after login
  const [authState, setAuthState] = useState('loading');
  const [team, setTeam] = useState(null);
  const [currentView, setCurrentView] = useState(initialView);
  useSessionTracking(currentView); // Track session activity for analytics
  const [activeEnvironment, setActiveEnvironment] = useState(null);
  const [accountType, setAccountType] = useState(null); // 'individual' or 'team'
  const [pendingJoinCode, setPendingJoinCode] = useState(null);
  const [accessContext, setAccessContext] = useState(null);
  const [portalState, setPortalState] = useState(null);
  const [portalDiagnostic, setPortalDiagnostic] = useState(null);
  const [requestedTeamSlug, setRequestedTeamSlug] = useState(null);
  // Admin Portal is deployed separately (HealthcareDataLab-Admin).
  // We only keep an "external-link" experience from HDL to the internal admin URL.
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [userPreferences, setUserPreferences] = useState(null);
  const [isIndividualUser, setIsIndividualUser] = useState(false);
  const [userTeams, setUserTeams] = useState([]); // All teams user belongs to
  const [kehrnelStatus, setKehrnelStatus] = useState(null); // { available: boolean, version: string }
  const [activeJobStatusRaw, setActiveJobStatusRaw] = useState(null); // { type: 'synthetic' | 'mapping', status: 'running' | 'completed', progress?, summary? }
  const bootstrapped = useRef(false);
  const childJobStatusTimestampRef = useRef(0); // Track when child reports status to prevent race with polling

  // Wrap job status with dismiss callback
  const activeJobStatus = activeJobStatusRaw ? {
    ...activeJobStatusRaw,
    onDismiss: () => setActiveJobStatusRaw(null)
  } : null;

  // Handler for job status changes from child components
  // Child-reported statuses take priority over global polling for a short time
  const handleJobStatusChange = (status) => {
    if (status?.status === 'running') {
      // Mark that a child component has reported a running job
      // This protects the status from being overwritten by polling for 5 seconds
      childJobStatusTimestampRef.current = Date.now();
      // Also ensure global polling is in fast mode
      hasActiveJobsRef.current = true;
    }
    setActiveJobStatusRaw(status);
  };

  const pickActiveEnv = (envs) => {
    if (!envs?.length) return null;
    const saved = localStorage.getItem('activeEnvironmentId');
    return envs.find(e => e.id === saved) || envs.find(e => e.isActive) || envs[0];
  };

  const refreshUserTeams = async () => {
    try {
      const response = await fetch('/api/users/teams');
      if (!response.ok) return null;
      const data = await response.json();
      setUserTeams(data?.teams || []);
      return data;
    } catch (error) {
      console.error('Failed to refresh user teams:', error);
      return null;
    }
  };

  const loadOnboardingAccess = async () => {
    try {
      const params = new URLSearchParams();
      if (typeof window !== 'undefined') {
        const team = new URLSearchParams(window.location.search).get('team');
        if (team) params.set('team', team);
      }
      const query = params.toString();
      const res = await fetch(`/api/onboarding/access${query ? `?${query}` : ''}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };

  const loadPortalAccessState = async () => {
    try {
      const res = await fetch('/api/portal/access-state');
      // Always parse the body — 503 responses now include diagnostic info
      return await res.json();
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (status === 'loading') {
      setAuthState('loading');
    } else if (status === 'unauthenticated') {
      setAuthState('unauthenticated');
    } else if (status === 'authenticated' && session?.user && !bootstrapped.current) {
      bootstrapped.current = true;
      checkUserStatusAndTeam();
    }
  }, [status, session]);

  useEffect(() => {
    const bootstrapPortalState = async () => {
      const state = await loadPortalAccessState();
      setPortalState(state?.portalState || null);
      setPortalDiagnostic(state?.diagnostic || null);
      if (state?.portalState?.mode === 'maintenance') {
        setAuthState('maintenance');
      }
    };
    bootstrapPortalState();
  }, []);

  useEffect(() => {
    // Capture the requested team slug (if any) for onboarding CTA display.
    if (typeof window === 'undefined') return;
    const team = new URLSearchParams(window.location.search).get('team');
    setRequestedTeamSlug(team || null);
  }, []);

  useEffect(() => {
    const checkAdminContext = async () => {
      if (status !== 'authenticated') return;
      try {
        const res = await fetch('/api/platform/admin-context');
        if (!res.ok) return;
        const payload = await res.json().catch(() => ({}));
        setIsPlatformAdmin(payload?.isAdmin === true);
      } catch {
        // Keep default false on failure
      }
    };
    checkAdminContext();
  }, [status]);

  useEffect(() => {
    // Update favicon and title
    if (team?.logoIcon) {
      updateFavicon(team.logoIcon);
    }
    if (team?.name) {
      document.title = `${team.name} - MongoDB Healthcare Data Lab`;
    } else if (isIndividualUser) {
      document.title = 'Personal - MongoDB Healthcare Data Lab';
    }
  }, [team?.logoIcon, team?.name, isIndividualUser]);

  // Check kehrnel status periodically (via proxy to avoid CORS)
  useEffect(() => {
    const checkKehrnelStatus = async () => {
      try {
        const kehrnelConfig = activeEnvironment?.kehrnel;

        // If environment has a custom Kehrnel URL configured, check that specific URL
        if (kehrnelConfig?.useDefault === false && kehrnelConfig?.apiUrl) {
          const url = kehrnelConfig.apiUrl.replace(/\/$/, '');
          const res = await fetch(`/api/kehrnel/health?url=${encodeURIComponent(url)}`);
          let data = {};
          try {
            data = await res.json();
          } catch (err) {
            console.error('Failed to parse Kehrnel health response:', err);
          }
          setKehrnelStatus({
            available: !!data.healthy,
            version: data.version || null,
            url: url,
            error: data.healthy ? null : (data.error || 'Not reachable')
          });
          return;
        }

        // Otherwise, check using the unified health endpoint (uses KehrnelService)
        const res = await fetch('/api/kehrnel/health');
        const data = await res.json().catch(() => ({}));

        if (data.healthy) {
          setKehrnelStatus({
            available: true,
            version: data.version || null,
            url: data.url || null,
            connectionId: data.connectionId || null
          });
        } else {
          setKehrnelStatus({
            available: false,
            version: null,
            error: data.error || 'No Kehrnel connection available'
          });
        }
      } catch (err) {
        setKehrnelStatus({
          available: false,
          version: null,
          error: err.message || 'Health check failed'
        });
      }
    };

    // Check immediately
    checkKehrnelStatus();

    // Then check every 30 seconds to keep status up-to-date
    const interval = setInterval(checkKehrnelStatus, 30000);

    return () => clearInterval(interval);
  }, [activeEnvironment?.id, activeEnvironment?.kehrnel?.apiUrl, activeEnvironment?.kehrnel?.useDefault]);

  // Global job status polling - runs regardless of current page
  const prevGlobalJobStatusRef = useRef(null);
  const hasActiveJobsRef = useRef(false);

  useEffect(() => {
    if (!activeEnvironment?.id) return;
    let cancelled = false;
    let timer = null;

    const checkJobStatus = async () => {
      try {
        if (document.hidden) {
          hasActiveJobsRef.current = false;
          return;
        }

        const headers = activeEnvironment?.id ? { 'x-active-env': activeEnvironment.id } : undefined;
        const res = await fetch('/api/synthetic-data/active-job', { headers });
        if (!res.ok) {
          hasActiveJobsRef.current = false;
          return;
        }

        const data = await res.json();
        const job = data?.job || null;
        const rawStatus = String(job?.rawStatus || job?.status || '').toLowerCase();
        const active = rawStatus === 'queued' || rawStatus === 'running' || rawStatus === 'canceling';
        hasActiveJobsRef.current = active;

        const newStatus = active
          ? {
              type: 'synthetic',
              status: 'running',
              progress: Math.round(Number(job?.progress || 0)),
              jobCount: 1,
              jobId: job?.id || null
            }
          : null;

        // If a child component recently reported a running status, don't let polling override it with null
        // This prevents race conditions when a job is just starting
        const timeSinceChildReport = Date.now() - childJobStatusTimestampRef.current;
        const childReportedRecently = timeSinceChildReport < 5000; // 5 second protection window

        if (!newStatus && childReportedRecently) {
          // Child reported a running job recently, but polling doesn't see it yet
          // Don't clear the status - let the child's report stand
          return;
        }

        const prevKey = prevGlobalJobStatusRef.current ? JSON.stringify(prevGlobalJobStatusRef.current) : null;
        const newKey = newStatus ? JSON.stringify(newStatus) : null;

        if (prevKey !== newKey) {
          prevGlobalJobStatusRef.current = newStatus;
          setActiveJobStatusRaw(newStatus);
        }
      } catch (err) {
        console.warn('Failed to check job status:', err);
      }
    };

    const loop = async () => {
      if (cancelled) return;
      await checkJobStatus();
      const nextMs = hasActiveJobsRef.current ? 3000 : 30000;
      if (!cancelled) {
        timer = setTimeout(loop, nextMs);
      }
    };

    // Check immediately, then adaptive interval:
    // - 3s while jobs are running
    // - 30s when idle
    loop();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeEnvironment?.id, activeEnvironment?.strategyLinks, currentView]);

  const updateFavicon = (iconUrl) => {
    requestAnimationFrame(() => {
      try {
        const fav = document.getElementById('app-favicon');
        const apple = document.getElementById('app-apple-icon');
        if (fav) fav.setAttribute('href', iconUrl);
        if (apple) apple.setAttribute('href', iconUrl);
      } catch (e) {
        console.error('Error updating favicon:', e);
      }
    });
  };

  const checkUserStatusAndTeam = async () => {
    try {
      setAuthState('checking');
      const ctx = session?.context;

      // Check if there's a join code in session storage
      const joinCode = sessionStorage.getItem('organizationJoinCode');
      if (joinCode) {
        setPendingJoinCode(joinCode);
        sessionStorage.removeItem('organizationJoinCode');
      }

      // Always enforce onboarding access policy before letting the user into
      // account/workspace selection flows. Otherwise a default session.context
      // (e.g. "individual") can accidentally bypass allowlist_only mode.
      const onboarding = await loadOnboardingAccess();
      setAccessContext(onboarding);

      if (onboarding?.portalState?.mode === 'maintenance') {
        setPortalState(onboarding.portalState);
        setAuthState('maintenance');
        return;
      }

      if (
        onboarding &&
        (onboarding.access === 'blocked' || onboarding.access === 'pending' || onboarding.access === 'paused')
      ) {
        setAuthState('access-gate');
        return;
      }

      // Seed from session first (no network)
      if (ctx?.team) {
        setTeam(ctx.team);
        setAccountType('team');
        setIsIndividualUser(false);
        setActiveEnvironment(pickActiveEnv(ctx.environments));
        if (joinCode) setPendingJoinCode(null); // already on a team
        setAuthState('authenticated');
        return;
      }

      // Individual seed (no team in context)
      if (ctx?.accountType === 'individual') {
        // Check if setup was completed (has theme or environments configured)
        const hasCompletedSetup = ctx.theme?.primary || (ctx.environments?.length > 0);

        if (!hasCompletedSetup) {
          // Incomplete setup - redirect to individual setup flow
          setAccountType('individual');
          setAuthState('individual-setup');
          return;
        }

        const prefs = {
          theme: ctx.theme || {},
          environments: ctx.environments || [],
          accountType: 'individual',
        };
        setUserPreferences(prefs);
        setIsIndividualUser(true);
        setAccountType('individual');
        setActiveEnvironment(pickActiveEnv(prefs.environments));
        setAuthState('authenticated');
        return;
      }

      // If user intends to join with a code, validate and join directly
      if (joinCode) {
        const validateResponse = await fetch('/api/teams/validate-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: joinCode, email: session.user.email })
        });

        if (validateResponse.ok) {
          const validationData = await validateResponse.json();
          if (validationData.valid) {
            // Valid code - proceed directly to joining (no invite required)
            setAccountType('team');
            setAuthState('joining-team');
          } else {
            // Invalid code
            alert('Invalid team code. Please check the code and try again.');
            setPendingJoinCode(null);
            setAuthState('account-type-selection');
          }
        } else {
          setPendingJoinCode(null);
          setAuthState('account-type-selection');
        }
        return;
      }

      // Do not auto-join teams based on policy defaults.
      // We always show the account-type selection UI and let the user click
      // an explicit "Join" CTA (e.g. URL-triggered `?team=...`).

      // Fetch server truth as a fallback when there's no session.context
      const [prefsRes, teamRes, userTeamsRes] = await Promise.allSettled([
        fetch('/api/users/preferences'),
        fetch('/api/teams'),
        fetch('/api/users/teams')
      ]);
      const prefs = prefsRes.status === 'fulfilled' && prefsRes.value.ok
        ? await prefsRes.value.json() : null;
      const teamData = teamRes.status === 'fulfilled' && teamRes.value.ok
        ? await teamRes.value.json() : null;
      const userTeamsData = userTeamsRes.status === 'fulfilled' && userTeamsRes.value.ok
        ? await userTeamsRes.value.json() : null;

      // Store all teams user belongs to
      const teams = userTeamsData?.teams || [];
      setUserTeams(teams);

      // Determine user's workspaces
      const hasTeams = teams.length > 0;
      const hasIndividualAccount = prefs?.accountType === 'individual';
      const lastSelectedWorkspace = localStorage.getItem('lastSelectedWorkspace');

      // Calculate total workspace count for selector logic
      const workspaceCount = teams.length + (hasIndividualAccount ? 1 : 0);

      // Only show workspace selector if user has MULTIPLE workspaces
      if (workspaceCount > 1 && !lastSelectedWorkspace) {
        if (hasIndividualAccount) {
          const pr = {
            theme: prefs.theme || {},
            environments: prefs.environments || [],
            accountType: 'individual',
          };
          setUserPreferences(pr);
        }
        setAuthState('team-selection');
        return;
      }

      // User has a team - use it
      if (teamData?._id) {
        setTeam(teamData);
        setAccountType('team');
        setIsIndividualUser(false);
        setActiveEnvironment(pickActiveEnv(teamData.environments));
        localStorage.setItem('lastSelectedWorkspace', teamData._id);
        setAuthState('authenticated');
        return;
      }

      // User has individual account with environments - authenticate
      if (prefs?.accountType === 'individual' && prefs.environments?.length > 0) {
        const pr = {
          theme: prefs.theme || {},
          environments: prefs.environments || [],
          accountType: 'individual',
        };
        setUserPreferences(pr);
        setIsIndividualUser(true);
        setAccountType('individual');
        setActiveEnvironment(pickActiveEnv(pr.environments));
        localStorage.setItem('lastSelectedWorkspace', 'individual');
        setAuthState('authenticated');
        return;
      }

      // New user OR user who hasn't completed setup: show account type selection
      // This gives them the option to join a team instead of setting up individually
      setAuthState('account-type-selection');
    } catch (error) {
      console.error('Failed to check user status:', error);
      setAuthState('account-type-selection');
    }
  };

  const handleAccountTypeSelection = async (type) => {
    setAccountType(type);

    // Handle demo account - auto-link to demo team
    if (type === 'demo') {
      try {
        const response = await fetch('/api/teams/join-demo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          const demoTeam = await response.json();
          setTeam(demoTeam);
          setAccountType('demo');
          setIsIndividualUser(false);
          const activeEnv = demoTeam.environments?.find(env => env.isActive) || demoTeam.environments?.[0];
          setActiveEnvironment(activeEnv);
          localStorage.setItem('lastSelectedWorkspace', demoTeam._id);
          setAuthState('authenticated');
        } else {
          const error = await response.json();
          alert(error.error || 'Failed to join demo. Please try again.');
          setAuthState('account-type-selection');
        }
      } catch (error) {
        console.error('Failed to join demo:', error);
        alert('Failed to join demo. Please try again.');
        setAuthState('account-type-selection');
      }
      return;
    }

    // Save account type preference
    await fetch('/api/users/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountType: type })
    });

    if (type === 'individual') {
      setIsIndividualUser(true);
      setAuthState('individual-setup');
    } else {
      setAuthState('team-setup');
    }
  };

  // Handle direct team join from AccountTypeSelection (skips setup wizard)
  const handleDirectTeamJoin = async (joinedTeam) => {
    setTeam(joinedTeam);
    setAccountType('team');
    setIsIndividualUser(false);
    const activeEnv = joinedTeam.environments?.find(env => env.isActive) || joinedTeam.environments?.[0];
    setActiveEnvironment(activeEnv);
    localStorage.setItem('lastSelectedWorkspace', joinedTeam._id);
    await refreshUserTeams();
    setAuthState('authenticated');
  };

  const handleStartTeamCreation = () => {
    setAccountType('team');
    setAuthState('creating-team');
  };

  const handleCancelTeamCreation = () => {
    setAuthState('authenticated');
  };

  const handleTeamSetup = async (teamData) => {
    try {
      if (authState === 'joining-team' && pendingJoinCode) {
        // Join existing team
        const joinResponse = await fetch('/api/teams/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: pendingJoinCode })
        });

        if (joinResponse.ok) {
          const joinedTeam = await joinResponse.json();
          setTeam(joinedTeam);
          setAccountType('team');
          setIsIndividualUser(false);
          setCurrentView('home');
          const activeEnv = joinedTeam.environments?.find(env => env.isActive) || joinedTeam.environments?.[0];
          setActiveEnvironment(activeEnv);
          localStorage.setItem('lastSelectedWorkspace', joinedTeam._id);

          // Save user theme preference (for initial display, will sync with team)
          await fetch('/api/users/preferences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              theme: teamData.theme,
              accountType: 'team'
            })
          });

          await refreshUserTeams();
          setAuthState('authenticated');
        }
      } else if (accountType === 'individual') {
        // Individual setup - save preferences and environments
        const response = await fetch('/api/users/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            theme: teamData.theme,
            environments: teamData.environments,
            accountType: 'individual'
          })
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to save personal environment settings');
        }

        setUserPreferences({
          theme: teamData.theme,
          environments: teamData.environments,
          accountType: 'individual'
        });
        setIsIndividualUser(true);
        const activeEnv = teamData.environments?.find(env => env.isActive) || teamData.environments?.[0];
        setActiveEnvironment(activeEnv);
        setAuthState('authenticated');
      } else {
        // Create new team
        const response = await fetch('/api/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(teamData)
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to create team');
        }

        const savedTeam = await response.json();
        setTeam(savedTeam);
        setAccountType('team');
        setIsIndividualUser(false);
        setCurrentView('home');
        const activeEnv = savedTeam.environments?.find(env => env.isActive) || savedTeam.environments?.[0];
        setActiveEnvironment(activeEnv);
        localStorage.setItem('lastSelectedWorkspace', savedTeam._id);
        await refreshUserTeams();
        setAuthState('authenticated');
      }
    } catch (error) {
      console.error('Failed to save setup:', error);
      alert(error?.message || 'Failed to complete setup. Please try again.');
    }
  };

  const handleJoinTeam = async (code) => {
    try {
      // Validate code and check for invite
      const validateResponse = await fetch('/api/teams/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email: session.user.email })
      });

      if (validateResponse.ok) {
        const validationData = await validateResponse.json();
        if (validationData.valid && validationData.hasPendingInvite) {
          // Join the team
          const joinResponse = await fetch('/api/teams/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
          });

          if (joinResponse.ok) {
            const joinedTeam = await joinResponse.json();
            setTeam(joinedTeam);
            setAccountType('team');
            setIsIndividualUser(false);
            const activeEnv = joinedTeam.environments?.find(env => env.isActive) || joinedTeam.environments?.[0];
            setActiveEnvironment(activeEnv);

            // Update user preferences
            await fetch('/api/users/preferences', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ accountType: 'team' })
            });

            alert('Successfully joined the team!');
            setCurrentView('home');
          }
        } else if (validationData.valid && !validationData.hasPendingInvite) {
          alert(`This team exists but you haven't been invited with email ${session.user.email}. Please ask the team admin to send you an invite.`);
        } else {
          alert('Invalid team code. Please check the code and try again.');
        }
      }
    } catch (error) {
      console.error('Failed to join team:', error);
      alert('Failed to join team. Please try again.');
    }
  };

  const handleTeamUpdate = async (updatedTeamData) => {
    try {
      const response = await fetch('/api/teams', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTeamData)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update team');
      }

      const updatedTeam = await response.json();
      setTeam(updatedTeam);

      // If environments were updated, update active environment
      if (updatedTeamData.environments) {
        const activeEnv = updatedTeam.environments?.find(env => env.isActive) || updatedTeam.environments?.[0];
        if (activeEnv) {
          setActiveEnvironment(activeEnv);
        }
      }

      // If theme was updated, show notification
      if (updatedTeamData.theme) {
        alert('Theme updated! This change will affect all team members.');
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to update team:', error);
      throw error;
    }
  };

  const handleIndividualUpdate = async (updatedData) => {
    try {
      const response = await fetch('/api/users/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...userPreferences,
          ...updatedData
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update preferences');
      }

      const savedPreferences = response.ok ? await response.json() : null;

      if (savedPreferences) {
        setUserPreferences(savedPreferences);
      } else {
        setUserPreferences({
          ...userPreferences,
          ...updatedData
        });
      }

      // If theme was updated, reload
      if (updatedData.theme) {
        window.location.reload();
      }

      // If environments were updated, update active environment
      if (updatedData.environments) {
        const envs = savedPreferences?.environments || updatedData.environments;
        const activeEnv = envs.find(env => env.isActive) || envs[0];
        setActiveEnvironment(activeEnv);
      }
    } catch (error) {
      console.error('Failed to update preferences:', error);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      // Security: Invalidate session on server before clearing client state
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });

      // Clear client-side state
      localStorage.removeItem('activeEnvironmentId');
      localStorage.removeItem('lastSelectedWorkspace');
    } catch (err) {
      console.error('Logout error:', err);
      // Proceed with client logout even if server call fails
    } finally {
      // Always call signOut to clear cookies and redirect
      signOut();
    }
  };

  // Handle team selection from TeamSelector
  const handleTeamSelection = async (teamId) => {
    try {
      const response = await fetch('/api/users/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId })
      });

      if (response.ok) {
        localStorage.setItem('lastSelectedWorkspace', teamId);
        window.location.reload();
      } else {
        throw new Error('Failed to select team');
      }
    } catch (error) {
      console.error('Failed to select team:', error);
      throw error;
    }
  };

  // Handle individual selection from TeamSelector
  const handleIndividualSelection = async () => {
    try {
      // Switch to individual mode
      const response = await fetch('/api/users/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId: 'individual' })
      });

      if (response.ok) {
        localStorage.setItem('lastSelectedWorkspace', 'individual');
        window.location.reload();
      } else {
        throw new Error('Failed to select individual workspace');
      }
    } catch (error) {
      console.error('Failed to select individual workspace:', error);
      throw error;
    }
  };

  // Handle joining a team from TeamSelector
  const handleJoinTeamFromSelector = async (code) => {
    try {
      // First validate the code
      const validateRes = await fetch('/api/teams/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });

      if (!validateRes.ok) {
        throw new Error('Invalid invite code');
      }

      const validation = await validateRes.json();
      if (!validation.valid) {
        throw new Error('Invalid or expired invite code');
      }

      // Join the team
      const joinRes = await fetch('/api/teams/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });

      if (!joinRes.ok) {
        const error = await joinRes.json();
        throw new Error(error.error || 'Failed to join team');
      }

      const joinedTeam = await joinRes.json();
      localStorage.setItem('lastSelectedWorkspace', joinedTeam._id);
      window.location.reload();
    } catch (error) {
      console.error('Failed to join team:', error);
      throw error;
    }
  };

  const handleTeamSwitch = async (teamId) => {
    try {
      const response = await fetch('/api/users/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.accountType === 'individual') {
          // Switching to individual mode
          setTeam(null);
          setAccountType('individual');
          setIsIndividualUser(true);
          // Reload user preferences for individual settings
          const prefsRes = await fetch('/api/users/preferences');
          if (prefsRes.ok) {
            const prefs = await prefsRes.json();
            setUserPreferences({
              theme: prefs.theme || {},
              environments: prefs.environments || [],
              accountType: 'individual'
            });
            setActiveEnvironment(pickActiveEnv(prefs.environments));
          }
        } else {
          // Switching to a team
          const teamRes = await fetch('/api/teams');
          if (teamRes.ok) {
            const teamData = await teamRes.json();
            setTeam(teamData);
            setAccountType('team');
            setIsIndividualUser(false);
            setActiveEnvironment(pickActiveEnv(teamData.environments));
          }
        }
        // Reload the page to apply theme changes
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to switch team');
      }
    } catch (error) {
      console.error('Failed to switch team:', error);
      alert('Failed to switch team');
    }
  };

  const handleNavigate = (view) => {
    setCurrentView(view);
  };

  const activateEnvironmentBindings = async (environment) => {
    if (!environment?.id) return;
    const links = Array.isArray(environment.strategyLinks) ? environment.strategyLinks : [];
    if (!links.length) return;

    const tasks = links
      .map((link) => {
        const strategyId = link?.kehrnel?.strategyId || link?.strategyId;
        const domain = link?.domain;
        if (!strategyId || !domain) return null;
        const mergedConfig = link?.mergedConfig || link?.kehrnel?.config || {};

        return fetch(`/api/kehrnel/environments/${environment.id}/activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategyId,
            domain,
            config: mergedConfig,
            configOverrides: link?.configOverrides || {},
            connectionId: link?.kehrnel?.connectionId || environment?.kehrnel?.connectionId || undefined,
            reason: 'environment-switch'
          })
        });
      })
      .filter(Boolean);

    if (!tasks.length) return;
    const results = await Promise.allSettled(tasks);
    const failed = results.filter((result) => result.status === 'rejected').length;
    if (failed > 0) {
      console.warn(`Environment switch activation had ${failed} failed request(s)`);
    }
  };

  const handleEnvironmentChange = (envId) => {
    let env = null;
    if (isIndividualUser) {
      env = userPreferences?.environments?.find(e => e.id === envId) || null;
    } else if (team) {
      env = team.environments.find(e => e.id === envId) || null;
    }

    if (env) {
      setActiveEnvironment(env);
      localStorage.setItem('activeEnvironmentId', envId);
      activateEnvironmentBindings(env).catch((error) => {
        console.warn('Failed to activate bindings after environment switch:', error?.message || error);
      });
    }
  };

  // Refresh the active environment data from the server
  // Used when strategy is activated or config is updated
  const refreshActiveEnvironment = async () => {
    try {
      const res = await fetch('/api/environments');
      if (!res.ok) return;
      const data = await res.json();
      const envs = data?.environments || [];

      // Update environment list in state
      if (isIndividualUser && userPreferences) {
        setUserPreferences(prev => ({ ...prev, environments: envs }));
      } else if (team) {
        setTeam(prev => ({ ...prev, environments: envs }));
      }

      // Re-select the active environment with fresh data
      const currentEnvId = activeEnvironment?.id;
      const refreshedEnv = envs.find(e => e.id === currentEnvId) || envs.find(e => e.isActive) || envs[0];
      if (refreshedEnv) {
        setActiveEnvironment(refreshedEnv);
      }
    } catch (error) {
      console.error('Failed to refresh environment:', error);
    }
  };

  const renderContent = () => {
    const learningModuleId = currentView.startsWith('learn:') ? currentView.slice('learn:'.length) : null;
    switch (currentView) {
      case 'home':
        return <HomeDashboard team={team || { name: 'Personal Workspace' }} onNavigate={handleNavigate} isIndividual={isIndividualUser} activeEnvironment={activeEnvironment} />;
      case 'workspace-health':
        return <WorkspaceHealthView activeEnvironment={activeEnvironment} />;
      case 'contextObjects':
        return <ContextObjectBuilder activeEnvironmentId={activeEnvironment?.id || ''} onNavigate={handleNavigate} />;
      case 'learn':
        return <LearningCenter onNavigate={handleNavigate} initialModuleId={null} />;
      default:
        break;
    }

    if (currentView.startsWith('learn:')) {
      return <LearningCenter onNavigate={handleNavigate} initialModuleId={learningModuleId} />;
    }

    switch (currentView) {
      case 'app-gallery':
        return <AppGallery onNavigate={handleNavigate} activeEnvironment={activeEnvironment} />;
      case 'history':
        return <DataHistoryView activeEnvironment={activeEnvironment} onJobStatusChange={handleJobStatusChange} />;
      case 'api-docs':
      case 'api':
        return <APITestingDoc activeEnvironment={activeEnvironment} mode="docs" />;
      case 'sandbox':
        return <APITestingDoc activeEnvironment={activeEnvironment} mode="sandbox" />;
      case 'templates':
      case 'mapping':
      case 'builder':
      case 'queries':
      case 'lab':
      case 'copilot-questions':
      case 'copilot-products':
      case 'copilot-tools':
      case 'copilot-answers':
      case 'copilot-control':
      case 'strategies':
      case 'deploy-strategies':
      case 'synthetic':
        return (
          <DataLab
            initialTab={currentView}
            activeEnvironment={activeEnvironment}
            onEnvironmentRefresh={refreshActiveEnvironment}
            onJobStatusChange={handleJobStatusChange}
            onNavigate={handleNavigate}
            syntheticDataPreviewOnly={team?.syntheticDataPreviewOnly}
          />
        );
      case 'team':
        return team ? (
          <TeamManagement
            team={team}
            user={session?.user}
          />
        ) : (
          <JoinTeam
            onJoin={handleJoinTeam}
            onBack={() => setCurrentView('home')}
          />
        );
      case 'join-team':
        return (
          <JoinTeam
            onJoin={handleJoinTeam}
            onBack={() => setCurrentView('home')}
          />
        );
      case 'data-organization':
        return (
          <DataOrganization
            team={team}
            preferences={userPreferences}
            onUpdate={team ? handleTeamUpdate : handleIndividualUpdate}
            isIndividual={isIndividualUser}
          />
        );
      case 'environments':
        return (
          <EnvironmentSettings
            team={team}
            preferences={userPreferences}
            activeEnvironment={activeEnvironment}
            onUpdate={team ? handleTeamUpdate : handleIndividualUpdate}
            onEnvironmentChange={handleEnvironmentChange}
            isIndividual={isIndividualUser}
            currentUser={session?.user}
          />
        );
      case 'theme-config':
        return (
          <ThemeCustomization
            team={team}
            preferences={userPreferences}
            onUpdate={team ? handleTeamUpdate : handleIndividualUpdate}
            isIndividual={isIndividualUser}
            currentUser={session?.user}
          />
        );
      default:
        return <HomeDashboard team={team || { name: 'Personal Workspace' }} onNavigate={handleNavigate} isIndividual={isIndividualUser} activeEnvironment={activeEnvironment} />;
    }
  };

  // Loading state
  if (authState === 'loading' || authState === 'checking') {
    return (
      <LoadingScreen
        message={authState === 'checking' ? 'Checking account status...' : 'Loading...'}
      />
    );
  }

  // Maintenance mode should hard-block the app for everyone.
  // Admin Portal is deployed separately (HealthcareDataLab-Admin) so we don't
  // provide an in-app maintenance bypass.
  if (portalState?.mode === 'maintenance') {
    return <MaintenancePage message={portalState?.message || accessContext?.portalState?.message} diagnostic={portalDiagnostic} />;
  }

  // Unauthenticated
  if (authState === 'unauthenticated') {
    return <LoginPage />;
  }

  if (authState === 'maintenance') {
    return <MaintenancePage message={portalState?.message || accessContext?.portalState?.message} diagnostic={portalDiagnostic} />;
  }

  if (authState === 'access-gate') {
    return (
      <AccessGate
        context={accessContext}
        onRefresh={checkUserStatusAndTeam}
      />
    );
  }

  // Account type selection
  if (authState === 'account-type-selection') {
    return (
      <AccountTypeSelection
        onSelect={handleAccountTypeSelection}
        onJoinTeam={handleDirectTeamJoin}
        userEmail={session?.user?.email}
        suggestedTeam={accessContext?.suggestedTeam || null}
        requestedTeamSlug={requestedTeamSlug}
        accessContext={accessContext}
      />
    );
  }

  // Team setup
  if (authState === 'team-setup' || authState === 'individual-setup' || authState === 'joining-team' || authState === 'creating-team') {
    // For existing individual users who just need to add environments, skip to step 2
    // Check for valid theme (not just empty object) - must have name or background property
    const hasValidTheme = userPreferences?.theme &&
      (userPreferences.theme.name || userPreferences.theme.background);

    const isReturningIndividualNeedingEnv = authState === 'individual-setup' &&
      hasValidTheme && // They have a VALID theme already (not empty object)
      (!userPreferences?.environments || userPreferences.environments.length === 0);

    return (
      <TeamSetup
        user={session?.user}
        onComplete={handleTeamSetup}
        onBack={
          authState === 'creating-team'
            ? handleCancelTeamCreation
            : authState !== 'joining-team'
              ? () => setAuthState('account-type-selection')
              : null
        }
        accountType={accountType}
        isJoiningWithCode={authState === 'joining-team'}
        pendingJoinCode={pendingJoinCode}
        existingTheme={isReturningIndividualNeedingEnv ? userPreferences.theme : null}
        skipToEnvironments={isReturningIndividualNeedingEnv}
      />
    );
  }

  // Team/Workspace selection
  if (authState === 'team-selection') {
    return (
      <TeamSelector
        teams={userTeams}
        currentTeamId={team?._id}
        isIndividual={isIndividualUser}
        hasIndividualAccount={userPreferences?.accountType === 'individual'}
        onSelectTeam={handleTeamSelection}
        onSelectIndividual={handleIndividualSelection}
        onJoinTeam={handleJoinTeamFromSelector}
        userEmail={session?.user?.email}
      />
    );
  }

  // Authenticated state
  const currentTheme = team?.theme || userPreferences?.theme || {};
  const environments = team?.environments || userPreferences?.environments || [];
  const displayTeam = team || (isIndividualUser ? {
    name: 'Personal Workspace',
    environments: userPreferences?.environments || []
  } : null);

  return (
    <ThemeProvider initialTheme={currentTheme}>
      <DataModelProvider activeEnvironment={activeEnvironment}>
       <AQLQueryProvider>
        <MetadataProvider>
         <PersistenceStrategyProvider>
        <SherpaHostRouter currentView={currentView} onNavigate={handleNavigate}>
          <ThemedLayout
            team={displayTeam}
            user={session?.user}
            onNavigate={handleNavigate}
            onLogout={handleLogout}
            activeEnvironment={activeEnvironment}
            onEnvironmentChange={handleEnvironmentChange}
            currentPage={currentView}
            isIndividual={isIndividualUser}
            userTeams={userTeams}
            onTeamSwitch={handleTeamSwitch}
            onCreateTeam={handleStartTeamCreation}
            isPlatformAdmin={isPlatformAdmin}
            kehrnelStatus={kehrnelStatus}
            activeJobStatus={activeJobStatus}
          >
            <>
              <div className="h-full bg-background">
                {renderContent()}
              </div>
              <HealthcareDataLabSherpa
                user={session?.user}
                team={displayTeam}
                isIndividual={isIndividualUser}
              />
            </>
          </ThemedLayout>
        </SherpaHostRouter>
         </PersistenceStrategyProvider>
        </MetadataProvider>
       </AQLQueryProvider>
      </DataModelProvider>
    </ThemeProvider>
  );
};

export default AppContainer;
