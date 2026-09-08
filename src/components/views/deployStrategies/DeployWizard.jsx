// src/components/views/deployStrategies/DeployWizard.jsx
"use client";

import React, { useState } from 'react';
import {
  FolderOpen,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Rocket,
  AlertTriangle,
  Package,
  FileJson,
  Code,
  Server
} from 'lucide-react';

/**
 * DeployWizard - 3-step wizard for deploying strategy packs to Kehrnel
 *
 * Step 1: Enter pack path (on Kehrnel server)
 * Step 2: Validate and preview manifest
 * Step 3: Deploy to Kehrnel catalog
 */
const DeployWizard = ({ activeEnvironment, onDeployed }) => {
  const [step, setStep] = useState(1);
  const [packPath, setPackPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [deployResult, setDeployResult] = useState(null);

  const steps = [
    { num: 1, label: 'Path' },
    { num: 2, label: 'Validate' },
    { num: 3, label: 'Deploy' },
  ];

  // Step 1 → Step 2: Validate the pack
  const handleValidate = async () => {
    if (!packPath.trim()) {
      setError('Please enter a strategy pack path');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const connectionId = activeEnvironment?.kehrnel?.connectionId;
      const res = await fetch('/api/kehrnel/strategies/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: packPath.trim(),
          connectionId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Validation failed');
      }

      setValidationResult(data);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 → Step 3: Deploy the pack
  const handleDeploy = async () => {
    setLoading(true);
    setError(null);

    try {
      const connectionId = activeEnvironment?.kehrnel?.connectionId;
      const res = await fetch('/api/kehrnel/strategies/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: packPath.trim(),
          strategyId: validationResult?.manifest?.id,
          connectionId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Deployment failed');
      }

      setDeployResult(data);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset wizard
  const handleReset = () => {
    setStep(1);
    setPackPath('');
    setValidationResult(null);
    setDeployResult(null);
    setError(null);
  };

  // Go back to catalog
  const handleDone = () => {
    if (onDeployed) onDeployed();
    handleReset();
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step Indicator */}
      <div className="flex items-center justify-center mb-8">
        {steps.map((s, idx) => (
          <React.Fragment key={s.num}>
            <div className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-colors ${
                  step > s.num
                    ? 'bg-emerald-600 text-white'
                    : step === s.num
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
                {step > s.num ? <CheckCircle className="w-5 h-5" /> : s.num}
              </div>
              <span
                className={`ml-2 text-sm font-medium ${
                  step >= s.num ? 'text-white' : 'text-slate-500'
                }`}
              >
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`w-16 h-0.5 mx-4 ${
                  step > s.num ? 'bg-emerald-600' : 'bg-slate-700'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 bg-red-900/20 border border-red-700/50 rounded-lg p-4 flex items-start gap-3">
          <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-200 font-medium">Error</p>
            <p className="text-red-300/70 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Step 1: Path Input */}
      {step === 1 && (
        <div className="bg-slate-800/40 rounded-xl border border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-purple-900/30 border border-purple-600/40">
              <FolderOpen className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Strategy Pack Path</h3>
              <p className="text-sm text-slate-400">
                Enter the path to your strategy pack on the Kehrnel server
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Pack Directory Path
              </label>
              <input
                type="text"
                value={packPath}
                onChange={(e) => setPackPath(e.target.value)}
                placeholder="/path/to/my-strategy"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono text-sm"
              />
            </div>

            <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Server className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-300/80">
                  <p className="font-medium text-blue-200 mb-1">Note</p>
                  <p>
                    This path must be accessible from the Kehrnel server, not your browser.
                    The directory should contain at minimum a <code className="bg-blue-900/40 px-1 rounded">manifest.json</code> file.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={handleValidate}
              disabled={loading || !packPath.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Validate
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Validation Result */}
      {step === 2 && validationResult && (
        <div className="bg-slate-800/40 rounded-xl border border-slate-700 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-emerald-900/30 border border-emerald-600/40">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Pack Validated</h3>
              <p className="text-sm text-slate-400">
                Review the manifest before deploying
              </p>
            </div>
          </div>

          {/* Manifest Preview */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoCard
                icon={Package}
                label="Strategy ID"
                value={validationResult.manifest?.id}
              />
              <InfoCard
                icon={Code}
                label="Version"
                value={validationResult.manifest?.version}
              />
            </div>

            <div className="bg-slate-900/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-slate-400 mb-2">Name</h4>
              <p className="text-white">{validationResult.manifest?.name}</p>
            </div>

            {validationResult.manifest?.summary && (
              <div className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-400 mb-2">Summary</h4>
                <p className="text-slate-300 text-sm">{validationResult.manifest?.summary}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-400 mb-2">Domain</h4>
                <span className="inline-block px-2 py-1 bg-blue-600/30 text-blue-300 rounded text-sm">
                  {validationResult.manifest?.domain}
                </span>
              </div>
              <div className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-400 mb-2">Maturity</h4>
                <span className="inline-block px-2 py-1 bg-amber-600/30 text-amber-300 rounded text-sm">
                  {validationResult.manifest?.maturity || 'unknown'}
                </span>
              </div>
            </div>

            {validationResult.manifest?.capabilities?.length > 0 && (
              <div className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-400 mb-2">Capabilities</h4>
                <div className="flex flex-wrap gap-2">
                  {validationResult.manifest.capabilities.map(cap => (
                    <span
                      key={cap}
                      className="px-2 py-1 bg-purple-600/30 text-purple-300 rounded text-xs"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Files found */}
            {validationResult.files && (
              <div className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-slate-400 mb-2">Pack Files</h4>
                <div className="flex flex-wrap gap-2">
                  {validationResult.files.map(file => (
                    <span
                      key={file}
                      className="flex items-center gap-1 px-2 py-1 bg-slate-700/50 text-slate-300 rounded text-xs font-mono"
                    >
                      <FileJson className="w-3 h-3" />
                      {file}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {validationResult.warnings?.length > 0 && (
              <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-200 mb-1">Warnings</p>
                    <ul className="text-sm text-amber-300/80 list-disc list-inside">
                      {validationResult.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-6">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={handleDeploy}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  Deploy to Kehrnel
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Deploy Result */}
      {step === 3 && deployResult && (
        <div className="bg-slate-800/40 rounded-xl border border-slate-700 p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-600/20 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>

          <h3 className="text-xl font-semibold text-white mb-2">Strategy Deployed!</h3>
          <p className="text-slate-400 mb-6">
            <code className="text-purple-400 font-mono">{deployResult.strategy?.id || validationResult?.manifest?.id}</code>
            {' '}is now available in the Kehrnel catalog.
          </p>

          <div className="bg-slate-900/50 rounded-lg p-4 mb-6 text-left">
            <h4 className="text-sm font-medium text-slate-400 mb-2">Next Steps</h4>
            <ul className="text-sm text-slate-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">1.</span>
                Go to the <strong>Catalog</strong> tab to see your new strategy
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">2.</span>
                Click on the strategy to view details and configure it
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400">3.</span>
                Activate it on your environment to start using it
              </li>
            </ul>
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={handleReset}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Deploy Another
            </button>
            <button
              onClick={handleDone}
              className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-500 transition-colors"
            >
              Go to Catalog
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper component for info cards
const InfoCard = ({ icon: Icon, label, value }) => (
  <div className="bg-slate-900/50 rounded-lg p-4">
    <div className="flex items-center gap-2 mb-1">
      <Icon className="w-4 h-4 text-slate-500" />
      <span className="text-sm text-slate-400">{label}</span>
    </div>
    <p className="text-white font-mono text-sm">{value || '-'}</p>
  </div>
);

export default DeployWizard;
