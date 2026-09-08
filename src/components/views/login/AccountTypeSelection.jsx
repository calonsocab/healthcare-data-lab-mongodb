// src/components/views/login/AccountTypeSelection.jsx
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { User, Building2, Users, ArrowRight, LogOut, Loader2, CheckCircle, AlertCircle, Sparkles } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { PUBLIC_TEAMS } from '@/lib/config/defaults';

const AccountTypeSelection = ({
  onSelect,
  onJoinTeam,
  userEmail,
  suggestedTeam = null,
  requestedTeamSlug = null,
  accessContext = null
}) => {
  const [selectedOption, setSelectedOption] = useState(null); // 'individual' | 'team' | 'join' | 'public'
  const [joinCode, setJoinCode] = useState('');
  const [validating, setValidating] = useState(true);
  const [joiningTeam, setJoiningTeam] = useState(false);
  const [joiningPublicTeam, setJoiningPublicTeam] = useState(false);
  const [joiningSuggestedTeam, setJoiningSuggestedTeam] = useState(false);
  const [joiningPolicySuggestedTeam, setJoiningPolicySuggestedTeam] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [joinSuccess, setJoinSuccess] = useState(null);
  const [publicTeamSuccess, setPublicTeamSuccess] = useState(null);
  const [publicTeamError, setPublicTeamError] = useState(null);
  const [suggestedJoinSuccess, setSuggestedJoinSuccess] = useState(null);
  const [suggestedJoinError, setSuggestedJoinError] = useState(null);
  const [policySuggestedJoinSuccess, setPolicySuggestedJoinSuccess] = useState(null);
  const [policySuggestedJoinError, setPolicySuggestedJoinError] = useState(null);

  // Get the featured public team - only show to @mongodb.com emails
  const isMongoDBEmployee = userEmail?.toLowerCase().endsWith('@mongodb.com');
  const featuredTeam = isMongoDBEmployee ? PUBLIC_TEAMS.find(t => t.featured) : null;

  const requestedTeamMatchesSuggestion = useMemo(() => {
    if (!requestedTeamSlug) return false;
    if (!suggestedTeam?.slug) return false;
    return String(suggestedTeam.slug).toLowerCase() === String(requestedTeamSlug).toLowerCase();
  }, [requestedTeamSlug, suggestedTeam?.slug]);

  const accessBanner = useMemo(() => {
    const ctx = accessContext;
    if (!ctx || typeof ctx !== "object") return null;

    const mode = String(ctx?.policy?.mode || "").trim() || "open";
    const deploymentMode = String(ctx?.deploymentMode || "").trim() || null;
    const effectiveMode = String(ctx?.effectiveMode || "").trim() || null;

    if (mode === "allowlist_only" || effectiveMode === "allowlist_only") {
      const reasons = [];
      if (ctx?.emailAllowlisted) reasons.push("email allowlist");
      if (ctx?.ipAllowlisted) reasons.push("IP allowlist");

      const reasonText = reasons.length ? reasons.join(" + ") : "policy evaluation";
      const ipText = ctx?.ipAllowlisted && ctx?.clientIp ? ` (your IP: ${ctx.clientIp})` : "";
      const envText = deploymentMode ? ` (${deploymentMode})` : "";

      return {
        tone: reasons.length ? "success" : "info",
        title: `Private Preview: access granted${envText}`,
        detail: `Reason: ${reasonText}${ipText}.`
      };
    }

    return {
      tone: "info",
      title: "Access policy in effect",
      detail: `Mode: ${mode}${deploymentMode ? ` (${deploymentMode})` : ""}.`
    };
  }, [accessContext]);

  // Validate user exists in database on mount
  useEffect(() => {
    const validateUser = async () => {
      try {
        const res = await fetch('/api/users/preferences');
        if (!res.ok) {
          console.error('User validation failed, redirecting to login');
          signOut({ callbackUrl: '/' });
          return;
        }
        setValidating(false);
      } catch (error) {
        console.error('Error validating user:', error);
        signOut({ callbackUrl: '/' });
      }
    };
    validateUser();
  }, []);

  const handleBackToLogin = () => {
    signOut({ callbackUrl: '/' });
  };

  const handleJoinPolicySuggestedTeam = async () => {
    if (!suggestedTeam?.slug) return;
    if (!suggestedTeam?.allowsDirectJoin) {
      setPolicySuggestedJoinError('This team requires an invite code.');
      return;
    }

    setSelectedOption('policy-autojoin');
    setJoiningPolicySuggestedTeam(true);
    setPolicySuggestedJoinError(null);

    try {
      const joinResponse = await fetch('/api/teams/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: suggestedTeam.slug })
      });

      const payload = await joinResponse.json().catch(() => ({}));
      if (!joinResponse.ok) {
        throw new Error(payload.error || 'Failed to join team');
      }

      // Ensure account type is set to team in user preferences for UI consistency.
      await fetch('/api/users/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountType: 'team' })
      });

      setPolicySuggestedJoinSuccess(`Successfully joined ${payload.name || suggestedTeam.name || suggestedTeam.slug}!`);
      if (onJoinTeam) {
        setTimeout(() => onJoinTeam(payload), 700);
      }
    } catch (error) {
      setPolicySuggestedJoinError(error.message || 'Failed to join team. Please try again.');
      setJoiningPolicySuggestedTeam(false);
    }
  };

  const handleJoinSuggestedTeam = async () => {
    if (!requestedTeamSlug) return;
    if (!requestedTeamMatchesSuggestion) {
      setSuggestedJoinError('Team was not found (or is not eligible for direct join).');
      return;
    }
    if (!suggestedTeam?.allowsDirectJoin) {
      setSuggestedJoinError('This team requires an invite code.');
      return;
    }

    setSelectedOption('autojoin');
    setJoiningSuggestedTeam(true);
    setSuggestedJoinError(null);

    try {
      const joinResponse = await fetch('/api/teams/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: suggestedTeam.slug })
      });

      const payload = await joinResponse.json().catch(() => ({}));
      if (!joinResponse.ok) {
        throw new Error(payload.error || 'Failed to join team');
      }

      // Ensure account type is set to team in user preferences for UI consistency.
      await fetch('/api/users/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountType: 'team' })
      });

      setSuggestedJoinSuccess(`Successfully joined ${payload.name || suggestedTeam.name || suggestedTeam.slug}!`);
      if (onJoinTeam) {
        setTimeout(() => onJoinTeam(payload), 700);
      }
    } catch (error) {
      setSuggestedJoinError(error.message || 'Failed to join team. Please try again.');
      setJoiningSuggestedTeam(false);
    }
  };

  const handleJoinWithCode = async () => {
    if (joinCode.length !== 6) return;

    setJoiningTeam(true);
    setJoinError(null);

    try {
      // First validate the code
      const validateResponse = await fetch('/api/teams/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode, email: userEmail })
      });

      if (!validateResponse.ok) {
        throw new Error('Failed to validate code');
      }

      const validationData = await validateResponse.json();

      if (!validationData.valid) {
        setJoinError('Invalid team code. Please check the code and try again.');
        setJoiningTeam(false);
        return;
      }

      // Join the team directly
      const joinResponse = await fetch('/api/teams/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode })
      });

      if (!joinResponse.ok) {
        const errorData = await joinResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to join team');
      }

      const joinedTeam = await joinResponse.json();

      // Update user preferences to team account type
      await fetch('/api/users/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountType: 'team' })
      });

      setJoinSuccess(`Successfully joined ${joinedTeam.name}!`);

      // Call the callback to complete the join process
      if (onJoinTeam) {
        setTimeout(() => onJoinTeam(joinedTeam), 1000);
      }
    } catch (error) {
      console.error('Join team error:', error);
      setJoinError(error.message || 'Failed to join team. Please try again.');
      setJoiningTeam(false);
    }
  };

  const handleJoinPublicTeam = async (team) => {
    setSelectedOption('public');
    setJoiningPublicTeam(true);
    setPublicTeamError(null);

    try {
      // Validate the public team code first
      const validateResponse = await fetch('/api/teams/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: team.code, email: userEmail })
      });

      if (!validateResponse.ok) {
        throw new Error('Failed to validate team');
      }

      const validationData = await validateResponse.json();

      if (!validationData.valid) {
        setPublicTeamError('This team is not available. Please contact support.');
        setJoiningPublicTeam(false);
        return;
      }

      // Join the team
      const joinResponse = await fetch('/api/teams/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: team.code })
      });

      if (!joinResponse.ok) {
        const errorData = await joinResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to join team');
      }

      const joinedTeam = await joinResponse.json();

      // Update user preferences
      await fetch('/api/users/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountType: 'team' })
      });

      setPublicTeamSuccess(`Welcome to ${joinedTeam.name}!`);

      if (onJoinTeam) {
        setTimeout(() => onJoinTeam(joinedTeam), 1000);
      }
    } catch (error) {
      console.error('Join public team error:', error);
      setPublicTeamError(error.message || 'Failed to join. Please try again.');
      setJoiningPublicTeam(false);
    }
  };

  // Show loading while validating user
  if (validating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#01ec63] animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Validating session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to MongoDB Healthcare Data Lab</h1>
          <p className="text-slate-400">Choose how you'd like to use the platform</p>
        </div>

        {accessBanner ? (
          <div
            className={`mb-8 rounded-xl border p-4 ${
              accessBanner.tone === "success"
                ? "border-emerald-600/40 bg-emerald-900/20"
                : "border-[#1C4D47] bg-[#023430]/30"
            }`}
          >
            <div className="flex items-start gap-3">
              {accessBanner.tone === "success" ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-slate-300 mt-0.5 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">{accessBanner.title}</p>
                <p className="text-xs text-slate-300 mt-1">{accessBanner.detail}</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Direct Join CTA (only when URL includes ?team=slug) */}
        {requestedTeamSlug && (
          <div className="mb-8">
            <div className={`relative overflow-hidden bg-gradient-to-r from-[#0B2E4A] to-[#023430] border rounded-xl p-6 transition-all ${
              selectedOption === 'autojoin'
                ? 'border-[#00ED64] ring-2 ring-[#00ED64]/30'
                : 'border-[#1C4D47] hover:border-[#00ED64]'
            }`}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-[#00ED64]/20 text-[#00ED64] px-2.5 py-1 rounded-full font-medium">
                      Direct Join
                    </span>
                    <span className="text-xs text-slate-400">Triggered by URL</span>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-1">
                    Join {requestedTeamMatchesSuggestion ? (suggestedTeam?.name || requestedTeamSlug) : requestedTeamSlug}
                  </h2>
                  <p className="text-slate-300 text-sm">
                    {requestedTeamMatchesSuggestion
                      ? (suggestedTeam?.allowsDirectJoin ? 'This team allows direct join. Click to join now.' : 'This team requires an invite code.')
                      : 'Team not found, or direct join is disabled for this team.'}
                  </p>
                </div>

                <div className="flex-shrink-0 min-w-[220px]">
                  {suggestedJoinSuccess ? (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-900/30 border border-emerald-600/50 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span className="text-sm text-emerald-300 font-medium">{suggestedJoinSuccess}</span>
                    </div>
                  ) : suggestedJoinError ? (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{suggestedJoinError}</span>
                      </div>
                      <button
                        onClick={handleJoinSuggestedTeam}
                        disabled={joiningSuggestedTeam}
                        className="w-full px-6 py-2.5 bg-[#00ED64] text-[#001E2B] font-semibold rounded-lg hover:bg-[#00d058] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleJoinSuggestedTeam}
                      disabled={joiningSuggestedTeam || !requestedTeamMatchesSuggestion || !suggestedTeam?.allowsDirectJoin}
                      className="w-full px-6 py-2.5 bg-[#00ED64] text-[#001E2B] font-semibold rounded-lg hover:bg-[#00d058] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {joiningSuggestedTeam ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Joining...
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-4 h-4" />
                          Join Now
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-6 mb-2">
              <div className="flex-1 border-t border-[#1C4D47]"></div>
              <span className="text-sm text-slate-500">or choose another option</span>
              <div className="flex-1 border-t border-[#1C4D47]"></div>
            </div>
          </div>
        )}

        {/* Suggested Team CTA (policy default) */}
        {!requestedTeamSlug && suggestedTeam?.slug && suggestedTeam?.allowsDirectJoin && (
          <div className="mb-8">
            <div
              className={`relative overflow-hidden bg-gradient-to-r from-[#0B2E4A] to-[#023430] border rounded-xl p-6 transition-all ${
                selectedOption === 'policy-autojoin'
                  ? 'border-[#00ED64] ring-2 ring-[#00ED64]/30'
                  : 'border-[#1C4D47] hover:border-[#00ED64]'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-[#00ED64]/20 text-[#00ED64] px-2.5 py-1 rounded-full font-medium">
                      Suggested
                    </span>
                    <span className="text-xs text-slate-400">From policy default</span>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-1">
                    Join {suggestedTeam?.name || suggestedTeam?.slug}
                  </h2>
                  <p className="text-slate-300 text-sm">
                    This is the configured default team for your account. You can join it now, or choose another option below.
                  </p>
                </div>

                <div className="flex-shrink-0 min-w-[220px]">
                  {policySuggestedJoinSuccess ? (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-900/30 border border-emerald-600/50 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span className="text-sm text-emerald-300 font-medium">{policySuggestedJoinSuccess}</span>
                    </div>
                  ) : policySuggestedJoinError ? (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{policySuggestedJoinError}</span>
                      </div>
                      <button
                        onClick={handleJoinPolicySuggestedTeam}
                        disabled={joiningPolicySuggestedTeam}
                        className="w-full px-6 py-2.5 bg-[#00ED64] text-[#001E2B] font-semibold rounded-lg hover:bg-[#00d058] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleJoinPolicySuggestedTeam}
                      disabled={joiningPolicySuggestedTeam}
                      className="w-full px-6 py-2.5 bg-[#00ED64] text-[#001E2B] font-semibold rounded-lg hover:bg-[#00d058] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {joiningPolicySuggestedTeam ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Joining...
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-4 h-4" />
                          Join Now
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-6 mb-2">
              <div className="flex-1 border-t border-[#1C4D47]"></div>
              <span className="text-sm text-slate-500">or choose another option</span>
              <div className="flex-1 border-t border-[#1C4D47]"></div>
            </div>
          </div>
        )}

        {/* Featured Public Team - Quick Join */}
        {featuredTeam && (
          <div className="mb-8">
            <div className={`relative overflow-hidden bg-gradient-to-r from-[#00684A] to-[#023430] border rounded-xl p-6 transition-all ${
              selectedOption === 'public'
                ? 'border-[#01ec63] ring-2 ring-[#01ec63]/30'
                : 'border-[#1C4D47] hover:border-[#01ec63]'
            }`}>
              {/* Decorative sparkle */}
              <div className="absolute top-4 right-4">
                <Sparkles className="w-6 h-6 text-[#01ec63]/40" />
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-[#01ec63]/20 text-[#01ec63] px-2.5 py-1 rounded-full font-medium">
                      Quick Join
                    </span>
                    <span className="text-xs text-slate-400">No invitation required</span>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-1">
                    Join {featuredTeam.name}
                  </h2>
                  <p className="text-slate-300 text-sm">
                    {featuredTeam.description}
                  </p>
                </div>

                <div className="flex-shrink-0">
                  {publicTeamSuccess ? (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-900/30 border border-emerald-600/50 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span className="text-sm text-emerald-300 font-medium">{publicTeamSuccess}</span>
                    </div>
                  ) : publicTeamError ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-red-400 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        <span>{publicTeamError}</span>
                      </div>
                      <button
                        onClick={() => handleJoinPublicTeam(featuredTeam)}
                        className="w-full px-6 py-2.5 bg-[#01ec63] text-[#001E2B] font-semibold rounded-lg hover:bg-[#00d058] transition-colors"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleJoinPublicTeam(featuredTeam)}
                      disabled={joiningPublicTeam}
                      className="px-6 py-2.5 bg-[#01ec63] text-[#001E2B] font-semibold rounded-lg hover:bg-[#00d058] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {joiningPublicTeam ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Joining...
                        </>
                      ) : (
                        <>
                          <ArrowRight className="w-4 h-4" />
                          Join Now
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-6 mb-2">
              <div className="flex-1 border-t border-[#1C4D47]"></div>
              <span className="text-sm text-slate-500">or choose another option</span>
              <div className="flex-1 border-t border-[#1C4D47]"></div>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6">
          {/* Individual Account - Green themed */}
          <button
            onClick={() => {
              setSelectedOption('individual');
              onSelect('individual');
            }}
            className={`bg-surface border rounded-lg p-6 transition-all group text-left ${
              selectedOption === 'individual'
                ? 'border-[#01ec63] ring-2 ring-[#01ec63]/30'
                : 'border-theme hover:border-[#01ec63]'
            }`}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-xl bg-[#01ec63]/20 flex items-center justify-center">
                <User className="w-6 h-6 text-[#01ec63]" />
              </div>
              <span className="text-xs bg-[#01ec63]/20 text-[#01ec63] px-2.5 py-1 rounded-full">Personal</span>
            </div>

            <h2 className="text-xl font-bold text-white mb-2 group-hover:text-[#01ec63] transition-colors">
              Individual Account
            </h2>

            <p className="text-slate-400 text-sm mb-5">
              Personal workspace for individual exploration
            </p>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#01ec63] rounded-full"></div>
                <p className="text-sm text-slate-300">Your own MongoDB connections</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#01ec63] rounded-full"></div>
                <p className="text-sm text-slate-300">Custom themes & settings</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#01ec63] rounded-full"></div>
                <p className="text-sm text-slate-300">Can join teams later</p>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-theme">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">You'll configure your database</span>
                <ArrowRight className="w-4 h-4 text-[#01ec63] opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </button>

          {/* Create Team - Purple themed */}
          <button
            onClick={() => {
              setSelectedOption('team');
              onSelect('team');
            }}
            className={`bg-surface border rounded-lg p-6 transition-all group text-left ${
              selectedOption === 'team'
                ? 'border-purple-500 ring-2 ring-purple-500/30'
                : 'border-theme hover:border-purple-500'
            }`}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-purple-400" />
              </div>
              <span className="text-xs bg-purple-900/50 text-purple-400 px-2.5 py-1 rounded-full">New Team</span>
            </div>

            <h2 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
              Create New Team
            </h2>

            <p className="text-slate-400 text-sm mb-5">
              Start a team for collaboration
            </p>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                <p className="text-sm text-slate-300">Shared team environments</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                <p className="text-sm text-slate-300">Invite team members</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
                <p className="text-sm text-slate-300">Unified configurations</p>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-theme">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">You'll be the team owner</span>
                <ArrowRight className="w-4 h-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </button>

          {/* Join Existing Team - Blue themed */}
          <div
            className={`bg-surface border rounded-lg p-6 transition-all text-left ${
              selectedOption === 'join'
                ? 'border-blue-500 ring-2 ring-blue-500/30'
                : 'border-theme hover:border-blue-500'
            }`}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-400" />
              </div>
              <span className="text-xs bg-blue-900/50 text-blue-400 px-2.5 py-1 rounded-full">Join Team</span>
            </div>

            <h2 className="text-xl font-bold text-white mb-2">
              Join Existing Team
            </h2>

            <p className="text-slate-400 text-sm mb-5">
              Use your team's shared environment
            </p>

            {joinSuccess ? (
              <div className="flex items-center gap-3 p-4 bg-emerald-900/30 border border-emerald-600/50 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div>
                  <p className="text-sm text-emerald-300 font-medium">{joinSuccess}</p>
                  <p className="text-xs text-emerald-400/70 mt-1">Redirecting...</p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => {
                      setJoinCode(e.target.value.toUpperCase());
                      setJoinError(null);
                      setSelectedOption('join');
                    }}
                    onFocus={() => setSelectedOption('join')}
                    placeholder="Enter team code"
                    className="w-full px-4 py-3 bg-surface-hover border border-theme rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center font-mono text-lg tracking-widest"
                    maxLength={6}
                    disabled={joiningTeam}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && joinCode.length === 6) {
                        handleJoinWithCode();
                      }
                    }}
                  />

                  {joinError && (
                    <div className="flex items-start gap-2 text-red-400 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{joinError}</span>
                    </div>
                  )}

                  <button
                    onClick={handleJoinWithCode}
                    disabled={joinCode.length !== 6 || joiningTeam}
                    className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {joiningTeam ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Joining...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4" />
                        Join Team
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-theme">
                  <span className="text-xs text-slate-500">No database setup required</span>
                </div>
              </>
            )}
          </div>
        </div>


        <div className="mt-10 text-center space-y-4">
          <p className="text-sm text-slate-400">
            You can always switch between account types or join a team later
          </p>
          <button
            onClick={handleBackToLogin}
            className="inline-flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccountTypeSelection;
