// src/components/views/auth/LoginPage.jsx
"use client";

import React, { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import Link from 'next/link';
import { Code, ExternalLink } from 'lucide-react';
import HealthcareDataLabLogo from '@/components/views/layout/HealthcareDataLabLogo';
import LoadingScreen from '@/components/ui/LoadingScreen';

// Current ToS version - increment when terms change
const TOS_VERSION = "1.0";


/* Kehrnel badge */
const KehrnelLogo = () => (
  <div className="flex items-center text-2xl font-bold">
    <span className="text-[#4A9EBD]">{`{ `}</span>
    <span className="text-[#EA6635]">k</span>
    <span className="text-[#4A9EBD]">e</span>
    <span className="text-[#4A9EBD]">h</span>
    <span className="text-[#4A9EBD]">r</span>
    <span className="text-[#EA6635]">n</span>
    <span className="text-[#EA6635]">e</span>
    <span className="text-[#EA6635]">l</span>
    <span className="text-[#4A9EBD]">{` }`}</span>
  </div>
);

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);

  // Check for joinCode in URL query params on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const codeFromUrl = urlParams.get('joinCode');
      if (codeFromUrl) {
        setJoinCode(codeFromUrl.toUpperCase());
        setShowJoinCode(true);
      }
    }
  }, []);

  const getCallbackUrl = () => {
    if (typeof window === 'undefined') return '/';
    try {
      const url = new URL(window.location.href);
      const cb = `${url.pathname}${url.search}`;
      return cb || '/';
    } catch {
      return '/';
    }
  };

  const handleSSOLogin = async (provider) => {
    if (!tosAccepted) return;
    setLoading(true);
    try {
      // Store ToS acceptance info for the auth callback to persist
      sessionStorage.setItem('tosAcceptance', JSON.stringify({
        version: TOS_VERSION,
        acceptedAt: new Date().toISOString()
      }));
      // Preserve query params (e.g. ?team=mongodb) through the auth redirect.
      await signIn(provider, { callbackUrl: getCallbackUrl() });
    } catch (error) {
      console.error('Login failed:', error);
      setLoading(false);
    }
  };

  const handleJoinWithCode = async () => {
    if (!joinCode || !tosAccepted) return;
    sessionStorage.setItem('organizationJoinCode', joinCode);
    // Store ToS acceptance info for the auth callback to persist
    sessionStorage.setItem('tosAcceptance', JSON.stringify({
      version: TOS_VERSION,
      acceptedAt: new Date().toISOString()
    }));
    await signIn('google', {
      // Preserve query params through auth redirect.
      callbackUrl: getCallbackUrl(),
      prompt: 'select_account',
      access_type: 'offline',
      approval_prompt: 'force'
    });
  };


  // Show loading overlay when signing in
  if (loading) {
    return <LoadingScreen message="Signing you in..." />;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Panel - Branding (65%) */}
      <div className="flex-[65] bg-gradient-to-br from-background to-surface p-12 flex flex-col">
        <div className="max-w-3xl mx-auto flex flex-col flex-1">
          {/* Logo ON TOP, Slogan BELOW (centered) */}
          <div className="flex flex-col items-center text-center mb-12">
            <HealthcareDataLabLogo className="h-28 w-auto" />
            <p className="mt-8 text-[18px] font-semibold leading-snug text-slate-300">
              <span className="block">Navigate from data patterns to live queries</span>
              <span className="block">on your MongoDB cluster</span>
            </p>
          </div>

          <p className="text-theme-secondary text-base sm:text-lg mb-8">
            <strong>MongoDB Healthcare Lab</strong> is a hands-on workspace to explore interoperable,
            document-first healthcare data on MongoDB.
          </p>

          {/* Feature bullets - aligned closer to top */}
          <div className="flex-1 flex flex-col justify-start pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <FeatureItem title="Pick your persistence strategy">
                Composition-level, node-level, or hybrid—with index guidance.
              </FeatureItem>

              <FeatureItem title="AI-ready enrichment">
                Atlas Search metadata and embeddings for semantic querying.
              </FeatureItem>

              <FeatureItem title="Synthetic data at scale">
                Generate realistic patients and cohorts for testing.
              </FeatureItem>

              <FeatureItem title="Sandbox APIs & Docker">
                Temporary endpoints and containers to experiment.
              </FeatureItem>

              <FeatureItem title="Visual AQL Builder">
                Build queries visually with AQL → MQL translation.
              </FeatureItem>

              <FeatureItem title="Mapping Studio">
                Transform CDA, HL7, CSV, JSON, FHIR to openEHR.
              </FeatureItem>
            </div>
          </div>
        </div>

        {/* footer: disclaimer + kehrnel — sits at bottom on lg+ */}
        <div className="max-w-3xl mx-auto w-full mt-12 lg:mt-auto">
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
            <p className="text-warning text-sm leading-relaxed">
              The Healthcare Data Lab is an experimental, non-production environment for demonstration
              purposes only. It is not an official MongoDB product and is not formally supported by MongoDB.
              MongoDB makes no representation or warranty as to the accuracy, adequacy, completeness, and
              fitness for a particular purpose in respect of any materials made available through the
              Healthcare Data Lab.
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-theme">
            <div className="flex items-center">
              <div className="mr-3">
                <KehrnelLogo />
              </div>
              <p className="text-theme-secondary">
                Powered by{' '}
                <a
                  href="https://github.com/Paco-Mateu/kehrnel/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#4A9EBD] hover:text-[#5AAECF] underline"
                >
                  Kehrnel
                </a>
                {' '}– Document-first persistence for open healthcare data
              </p>
            </div>
          </div>
        </div>
      </div>


      {/* Right Panel - Login (35%) - White background */}
      <div className="flex-[35] bg-white p-12 flex flex-col justify-center relative overflow-hidden">
        {/* Background Image */}
        <img
          src="/images/boat.png"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-80 object-top"
        />

        <div className="w-full max-w-sm mx-auto relative z-10 bg-white/95 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-slate-200">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome</h2>
            <p className="text-slate-600">Sign in to access your workspace</p>
          </div>

          <div className="space-y-4">
            {/* Google SSO */}
            <button
              onClick={() => handleSSOLogin('google')}
              disabled={!tosAccepted}
              className={`w-full flex items-center justify-center gap-3 px-4 py-3.5 rounded-xl transition-colors shadow-lg font-medium ${
                tosAccepted
                  ? 'bg-slate-800 text-white hover:bg-slate-700'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white text-slate-500 rounded-full text-xs">or</span>
              </div>
            </div>

            {/* Join with Code */}
            {!showJoinCode ? (
              <button
                onClick={() => setShowJoinCode(true)}
                className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white text-slate-700 rounded-xl hover:bg-slate-50 transition-colors border border-slate-300 font-medium"
              >
                <Code className="w-5 h-5" />
                <span>Join Team with Code</span>
              </button>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Enter team code"
                  className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#01ec63] text-center font-mono text-lg"
                  maxLength={6}
                />
                <button
                  onClick={handleJoinWithCode}
                  disabled={!joinCode || loading || !tosAccepted}
                  className="w-full px-4 py-3.5 bg-[#01ec63] text-[#011e2b] font-medium rounded-xl hover:bg-[#01ec63]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  Join & Continue
                </button>
                <button
                  onClick={() => {
                    setShowJoinCode(false);
                    setJoinCode('');
                  }}
                  className="w-full text-sm text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              First time here?{' '}
              <span className="text-[#01ec63] font-medium">
                Sign in to get started
              </span>
            </p>
          </div>

          {/* ToS Acceptance Checkbox */}
          <div className="mt-5 pt-5 border-t border-slate-200">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={tosAccepted}
                onChange={(e) => setTosAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#01ec63] focus:ring-[#01ec63] cursor-pointer"
              />
              <span className="text-xs text-slate-600 leading-relaxed">
                I agree to the{' '}
                <Link
                  href="/terms"
                  target="_blank"
                  className="text-slate-800 hover:text-[#01ec63] underline font-medium"
                >
                  Terms of Service
                </Link>
                {' '}and{' '}
                <a
                  href="https://www.mongodb.com/legal/privacy/privacy-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-800 hover:text-[#01ec63] underline font-medium inline-flex items-center gap-0.5"
                >
                  Privacy Policy
                  <ExternalLink size={10} />
                </a>
              </span>
            </label>
          </div>
        </div>

      </div>
    </div >
  );
};

/* Small helper for tidy feature bullets */
function FeatureItem({ title, children }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-2 h-2 bg-emerald-400 rounded-full mt-2 flex-shrink-0"></div>
      <div>
        <h3 className="text-emerald-400 font-semibold text-sm">{title}</h3>
        <p className="text-slate-400 text-xs mt-0.5">{children}</p>
      </div>
    </div>
  );
}

export default LoginPage;
