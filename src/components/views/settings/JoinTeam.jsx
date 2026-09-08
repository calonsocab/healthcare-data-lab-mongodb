// src/components/views/settings/JoinTeam.jsx
"use client";

import React, { useState } from 'react';
import { Code, ArrowLeft, Users, Loader2 } from 'lucide-react';

const JoinTeam = ({ onJoin, onBack }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (code.length !== 6) {
      setError('Code must be exactly 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await onJoin(code);
    } catch (err) {
      setError(err.message || 'Failed to join team');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="mb-6 text-theme-secondary hover:text-theme-primary flex items-center gap-2"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-theme-primary mb-6">Join a Team</h1>
      
      <div className="surface rounded-lg p-6 border border-theme">
        <div className="text-center mb-8">
          <Users className="w-16 h-16 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-theme-primary mb-2">
            Enter Team Invite Code
          </h2>
          <p className="text-theme-secondary">
            Ask your team administrator for the 6-character invite code
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-2">
              Invite Code
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Enter 6-character code"
              className="w-full px-4 py-3 surface border border-theme rounded-lg text-theme-primary placeholder-theme-secondary focus:outline-none focus:ring-2 focus:ring-primary text-center font-mono text-xl tracking-wider"
              maxLength={6}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-3 bg-error/10 border border-error/30 rounded-lg text-error text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full px-4 py-3 btn-primary rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <Code className="w-4 h-4" />
                Join Team
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-theme">
          <div className="bg-blue-900/20 border border-blue-600/30 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-400 mb-1">What happens when you join?</h3>
            <ul className="text-xs text-blue-300 space-y-1">
              <li>• You'll switch from individual to team account</li>
              <li>• Your settings will sync with the team's settings</li>
              <li>• You'll have access to shared environments</li>
              <li>• All team members have equal privileges</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinTeam;