"use client";

import React from 'react';
import { AlertTriangle, Database } from 'lucide-react';

const MaintenancePage = ({ message, diagnostic }) => {
  const isDev = process.env.NODE_ENV === 'development';
  const isDbError = diagnostic || (message && /mongodb|CORE_MONGODB|authentication|ENOTFOUND|ETIMEDOUT|ECONNREFUSED|serverselection/i.test(message));

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-xl border border-theme surface p-6">
        <div className="flex items-start gap-3 mb-4">
          {isDbError ? (
            <Database className="w-6 h-6 text-red-500 mt-0.5" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-warning mt-0.5" />
          )}
          <div>
            <h1 className="text-xl font-semibold text-theme-primary">
              {isDbError ? 'Database Connection Error' : 'Maintenance Mode'}
            </h1>
            <p className="text-sm text-theme-secondary mt-1">
              {message || 'Healthcare Data Lab is temporarily unavailable.'}
            </p>
          </div>
        </div>

        {isDev && isDbError && (
          <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-4">
            <h2 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">
              Developer Troubleshooting
            </h2>
            {diagnostic && (
              <p className="text-xs text-red-700 dark:text-red-400 font-mono mb-3 break-all">
                {diagnostic}
              </p>
            )}
            <ul className="text-xs text-red-700 dark:text-red-400 space-y-1.5 list-disc list-inside">
              <li>Check that <code className="font-mono bg-red-100 dark:bg-red-900/50 px-1 rounded">CORE_MONGODB_URL</code> is set correctly in <code className="font-mono bg-red-100 dark:bg-red-900/50 px-1 rounded">.env.local</code></li>
              <li>Do not wrap the connection string in quotes &mdash; Next.js treats them as literal characters</li>
              <li>Verify the MongoDB username and password are correct</li>
              <li>Ensure your IP is whitelisted in MongoDB Atlas (Network Access &rarr; Add Current IP or <code className="font-mono bg-red-100 dark:bg-red-900/50 px-1 rounded">0.0.0.0/0</code> for dev)</li>
              <li>Check that the Atlas cluster is not paused</li>
              <li>Restart the dev server after changing <code className="font-mono bg-red-100 dark:bg-red-900/50 px-1 rounded">.env.local</code></li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default MaintenancePage;
