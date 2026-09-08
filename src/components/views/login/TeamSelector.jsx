"use client";

import React, { useState } from 'react';
import {
  Users,
  User,
  Building2,
  CheckCircle2,
  ArrowRight,
  Loader2,
  Mail,
  UserPlus,
  Copy,
  Check,
  LogOut
} from 'lucide-react';
import { signOut } from 'next-auth/react';

const TeamSelector = ({
  teams = [],
  currentTeamId = null,
  isIndividual = false,
  hasIndividualAccount = true, // Whether user has an individual workspace to show
  onSelectTeam,
  onSelectIndividual,
  onJoinTeam
}) => {
  const [selectedOption, setSelectedOption] = useState(
    isIndividual ? 'individual' : (currentTeamId || (teams.length > 0 ? teams[0]._id : null))
  );
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  const handleContinue = async () => {
    if (!selectedOption) return;

    setLoading(true);
    try {
      if (selectedOption === 'individual') {
        await onSelectIndividual();
      } else {
        await onSelectTeam(selectedOption);
      }
    } catch (error) {
      console.error('Error selecting workspace:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTeam = async () => {
    if (!joinCode.trim() || joinCode.length !== 6) {
      setJoinError('Please enter a valid 6-character invite code');
      return;
    }

    setLoading(true);
    setJoinError(null);
    try {
      await onJoinTeam(joinCode.toUpperCase());
    } catch (error) {
      setJoinError(error.message || 'Failed to join team');
    } finally {
      setLoading(false);
    }
  };

  const copyInviteCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleBackToLogin = () => {
    signOut({ callbackUrl: '/' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#01ec63]/20 rounded-full mb-4">
              <Building2 size={32} className="text-[#01ec63]" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Select Your Workspace</h1>
            <p className="text-slate-400">
              Choose which workspace you want to use or join a new team
            </p>
          </div>

          {/* Workspace Options */}
          <div className="space-y-3 mb-6">
            {/* Individual Option - only show if user has individual account */}
            {hasIndividualAccount && (
              <button
                onClick={() => setSelectedOption('individual')}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  selectedOption === 'individual'
                    ? 'border-[#01ec63] bg-[#01ec63]/10'
                    : 'border-slate-600 hover:border-slate-500 bg-slate-700/30'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${
                    selectedOption === 'individual' ? 'bg-[#01ec63]/20' : 'bg-slate-600/50'
                  }`}>
                    <User size={24} className={selectedOption === 'individual' ? 'text-[#01ec63]' : 'text-slate-400'} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">Personal Workspace</h3>
                    <p className="text-sm text-slate-400">Your private workspace with individual settings</p>
                  </div>
                  {selectedOption === 'individual' && (
                    <CheckCircle2 size={24} className="text-[#01ec63]" />
                  )}
                </div>
              </button>
            )}

            {/* Team Options */}
            {teams.map((team) => (
              <button
                key={team._id}
                onClick={() => setSelectedOption(team._id)}
                className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                  selectedOption === team._id
                    ? 'border-[#01ec63] bg-[#01ec63]/10'
                    : 'border-slate-600 hover:border-slate-500 bg-slate-700/30'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${
                    selectedOption === team._id ? 'bg-[#01ec63]/20' : 'bg-slate-600/50'
                  }`}>
                    {team.logoIcon ? (
                      <img src={team.logoIcon} alt={team.name} className="w-6 h-6 object-contain" />
                    ) : (
                      <Users size={24} className={selectedOption === team._id ? 'text-[#01ec63]' : 'text-slate-400'} />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{team.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                      <span>{team.memberCount ?? 1} member{(team.memberCount ?? 1) === 1 ? '' : 's'}</span>
                      <span className="text-xs px-2 py-0.5 bg-slate-600 rounded">
                        {team.userRole || 'member'}
                      </span>
                    </div>
                  </div>
                  {selectedOption === team._id && (
                    <CheckCircle2 size={24} className="text-[#01ec63]" />
                  )}
                </div>

                {/* Show invite code for admins/owners */}
                {team.inviteCode && (team.userRole === 'owner' || team.userRole === 'admin') && (
                  <div className="mt-3 pt-3 border-t border-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Invite Code:</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyInviteCode(team.inviteCode);
                        }}
                        className="flex items-center gap-1 text-xs text-[#01ec63] hover:text-[#01ec63]/80"
                      >
                        <span className="font-mono">{team.inviteCode}</span>
                        {copiedCode === team.inviteCode ? (
                          <Check size={12} />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Join Team Section */}
          <div className="border-t border-slate-700 pt-6 mb-6">
            {!showJoinForm ? (
              <button
                onClick={() => setShowJoinForm(true)}
                className="w-full flex items-center justify-center gap-2 p-3 text-slate-400 hover:text-white border border-dashed border-slate-600 hover:border-slate-500 rounded-lg transition-colors"
              >
                <UserPlus size={18} />
                Join a Team with Invite Code
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-white">Join Team</h4>
                  <button
                    onClick={() => {
                      setShowJoinForm(false);
                      setJoinCode('');
                      setJoinError(null);
                    }}
                    className="text-xs text-slate-500 hover:text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                    placeholder="Enter 6-character code"
                    maxLength={6}
                    className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-primary font-mono text-center tracking-widest"
                  />
                  <button
                    onClick={handleJoinTeam}
                    disabled={loading || joinCode.length !== 6}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : 'Join'}
                  </button>
                </div>
                {joinError && (
                  <p className="text-xs text-red-400">{joinError}</p>
                )}
                <p className="text-xs text-slate-500">
                  Ask your team admin for the invite code or check your email for an invitation.
                </p>
              </div>
            )}
          </div>

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            disabled={!selectedOption || loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#01ec63] text-[#011e2b] font-medium rounded-lg hover:bg-[#01ec63]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Loading...
              </>
            ) : (
              <>
                Continue to Workspace
                <ArrowRight size={18} />
              </>
            )}
          </button>

          {/* Info and Back to Login */}
          <div className="mt-4 text-center space-y-3">
            <p className="text-xs text-slate-400">
              You can switch workspaces anytime from the settings menu
            </p>
            <button
              onClick={handleBackToLogin}
              className="inline-flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamSelector;
