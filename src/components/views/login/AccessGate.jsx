"use client";

import React, { useState } from 'react';
import { AlertCircle, Clock3, Send, RefreshCcw } from 'lucide-react';
import { signOut } from 'next-auth/react';

const AccessGate = ({ context, onRefresh }) => {
  const [reason, setReason] = useState('');
  const [company, setCompany] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const handleRequestAccess = async () => {
    setSubmitting(true);
    setMessage('');
    try {
      const res = await fetch('/api/onboarding/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, company })
      });
      if (!res.ok) throw new Error('Failed to submit request');
      setCompany('');
      setReason('');
      setMessage('Access request submitted. Redirecting to login...');
      // After submitting a request, return the user to the login screen.
      // This avoids leaving them in a blocked-but-authenticated limbo.
      setTimeout(() => {
        signOut({ callbackUrl: '/' }).catch(() => {});
      }, 900);
    } catch (error) {
      setMessage(error.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const isPending = context?.access === 'pending';
  const isPaused = context?.access === 'paused';
  const isBlocked = context?.access === 'blocked';
  const requestAccessEnabled = context?.policy?.requestAccessEnabled !== false;
  const canUseOnboardingTools = !isPaused && context?.userAccessStatus !== 'blocked' && context?.userAccessStatus !== 'paused';
  const canRequestAccess = canUseOnboardingTools && requestAccessEnabled && !isPending;
  const isPreviewGate =
    (isBlocked || isPending) &&
    context?.userAccessStatus !== 'blocked' &&
    context?.userAccessStatus !== 'paused';
  const ipAllowlistCount = Array.isArray(context?.policy?.ipAllowlistCidrs) ? context.policy.ipAllowlistCidrs.length : 0;
  const showDiagnostics = String(process.env.NEXT_PUBLIC_ACCESS_GATE_DEBUG || '').toLowerCase() === 'true';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-xl border border-theme surface p-6">
        <div className="flex items-start gap-3 mb-4">
          {isPending ? (
            <Clock3 className="w-6 h-6 text-warning mt-0.5" />
          ) : (
            <AlertCircle className="w-6 h-6 text-warning mt-0.5" />
          )}
          <div>
            <h1 className="text-xl font-semibold text-theme-primary">
              {isPreviewGate
                ? (isPending ? 'Access Request Pending' : 'Private Preview Access Required')
                : (isPaused ? 'Access Paused' : isBlocked ? 'Access Blocked' : 'Private Preview Access')}
            </h1>
            <p className="text-sm text-theme-secondary mt-1">
              {isPreviewGate
                ? 'Private Preview only: only allowlisted (whitelisted) registered users can access Healthcare Data Lab. If you are interested in participating, request access below.'
                : (isPaused || isBlocked
                    ? (context?.userAccessReason || 'Your access is currently restricted.')
                    : 'Healthcare Data Lab is currently in a controlled rollout phase.')}
            </p>
          </div>
        </div>

        {context?.policy?.phaseLabel && (
          <p className="text-xs text-theme-secondary mb-3">
            Phase: <span className="text-theme-primary">{context.policy.phaseLabel}</span>
          </p>
        )}

        {isPreviewGate && showDiagnostics && (
          <div className="mb-4 rounded-lg border border-theme bg-black/10 p-3">
            <p className="text-xs text-theme-secondary uppercase tracking-wide">Access Evaluation</p>
            <div className="mt-2 text-xs text-theme-secondary space-y-1">
              <p>
                Effective mode: <span className="text-theme-primary">{context?.effectiveMode || context?.policy?.mode || 'unknown'}</span>
              </p>
              <p>
                Email allowlisted: <span className="text-theme-primary">{context?.emailAllowlisted ? 'yes' : 'no'}</span>
              </p>
              <p>
                IP allowlisted: <span className="text-theme-primary">{context?.ipAllowlisted ? 'yes' : 'no'}</span>
                <span className="text-theme-secondary"> · rules: {ipAllowlistCount}</span>
              </p>
              <p>
                Detected IP: <span className="text-theme-primary">{context?.clientIp || 'unknown'}</span>
              </p>
              {!context?.clientIp ? (
                <p className="pt-1">
                  Note: if the app is running locally (no reverse proxy), we may not receive a client IP header so IP allowlisting cannot match.
                </p>
              ) : null}
            </div>
          </div>
        )}

        {canRequestAccess && (
          <div className="space-y-3">
            <label className="text-sm text-theme-secondary block">
              Company / Organization
            </label>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              maxLength={120}
              className="w-full px-3 py-2 rounded border border-theme bg-surface-hover text-theme-primary text-sm"
              placeholder="Your company"
            />
            <label className="text-sm text-theme-secondary block">
              Why do you need access?
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={1200}
              className="w-full px-3 py-2 rounded border border-theme bg-surface-hover text-theme-primary text-sm"
              placeholder="Briefly describe your use case..."
            />
            <button
              onClick={handleRequestAccess}
              disabled={submitting || !company.trim() || !reason.trim()}
              className="px-4 py-2 rounded bg-primary/15 text-primary hover:bg-primary/25 inline-flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Submitting...' : 'Request Access'}
            </button>
          </div>
        )}

        {(isPending || isPaused || isBlocked) && (
          <button
            onClick={onRefresh}
            className="px-4 py-2 rounded bg-primary/15 text-primary hover:bg-primary/25 inline-flex items-center gap-2"
          >
            <RefreshCcw className="w-4 h-4" />
            Check Status
          </button>
        )}

        <button
          onClick={() => signOut({ callbackUrl: '/' }).catch(() => {})}
          className="mt-3 px-4 py-2 rounded border border-theme text-theme-secondary hover:bg-surface-hover inline-flex items-center gap-2"
        >
          Back to login
        </button>

        {!!message && (
          <p className="text-sm text-theme-secondary mt-4">{message}</p>
        )}
      </div>
    </div>
  );
};

export default AccessGate;
