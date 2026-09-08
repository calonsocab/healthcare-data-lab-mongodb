// src/app/auth/error/page.jsx
"use client";

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const getErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'Configuration':
        return 'There is a problem with the server configuration. Please contact support.';
      case 'AccessDenied':
        return 'Access was denied. You may not have permission to sign in.';
      case 'Verification':
        return 'The verification link has expired or has already been used.';
      case 'OAuthSignin':
      case 'OAuthCallback':
      case 'OAuthCreateAccount':
      case 'OAuthAccountNotLinked':
        return 'There was a problem with the Google sign-in. Please try again.';
      case 'Callback':
        return 'There was a problem processing the authentication callback.';
      case 'Default':
      default:
        return 'An unexpected authentication error occurred. Please try again.';
    }
  };

  return (
    <div className="min-h-screen bg-[#011e2b] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#053e3a] rounded-xl p-8 shadow-xl border border-[#334155]">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>

          <h1 className="text-2xl font-bold text-white mb-2">
            Authentication Error
          </h1>

          <p className="text-[#e7ff98] mb-6">
            {getErrorMessage(error)}
          </p>

          {error && (
            <p className="text-sm text-gray-400 mb-6 font-mono bg-[#011e2b] p-2 rounded">
              Error code: {error}
            </p>
          )}

          <div className="space-y-3">
            <Link
              href="/"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-[#01ec63] text-[#011e2b] font-semibold rounded-lg hover:bg-[#01694a] hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Link>

            <Link
              href="/"
              className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-transparent text-[#F1F5F9] border border-[#334155] rounded-lg hover:bg-[#011e2b] transition-colors"
            >
              <Home className="w-4 h-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#011e2b] flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}
