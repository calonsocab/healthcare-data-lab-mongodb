"use client";

import React from 'react';
import {
  Loader2, AlertTriangle, CheckCircle, X, Info
} from 'lucide-react';

export const Badge = ({ children, variant = 'default', className = '' }) => {
  const variants = {
    default: 'bg-slate-700 text-slate-300',
    success: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    error: 'bg-red-500/20 text-red-400 border border-red-500/30',
    info: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
    cyan: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
    teal: 'bg-teal-500/20 text-teal-400 border border-teal-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

export const Card = ({ children, className = '', hover = false }) => (
  <div className={`bg-surface border border-border rounded-xl ${hover ? 'hover:border-primary/50 transition-colors' : ''} ${className}`}>
    {children}
  </div>
);

export const Button = ({ children, variant = 'primary', size = 'md', disabled = false, loading = false, className = '', ...props }) => {
  const variants = {
    primary: 'bg-primary text-primary-text hover:bg-primary/90',
    secondary: 'bg-slate-700 text-slate-200 hover:bg-slate-600 border border-slate-600',
    ghost: 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50',
    danger: 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
};

export const Input = ({ label, className = '', ...props }) => (
  <div className={className}>
    {label && <label className="block text-xs text-slate-400 mb-1.5">{label}</label>}
    <input
      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
      {...props}
    />
  </div>
);

export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
      <Icon className="w-8 h-8 text-slate-500" />
    </div>
    <h3 className="text-lg font-medium text-slate-300 mb-2">{title}</h3>
    <p className="text-sm text-slate-500 max-w-sm mb-4">{description}</p>
    {action}
  </div>
);

export const ErrorAlert = ({ message, onDismiss }) => (
  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <p className="text-red-400 text-sm">{message}</p>
    </div>
    {onDismiss && (
      <button onClick={onDismiss} className="text-red-400 hover:text-red-300">
        <X className="w-4 h-4" />
      </button>
    )}
  </div>
);

export const SummaryAlert = ({ summary, onDismiss }) => {
  if (!summary) return null;

  const variants = {
    success: {
      wrapper: 'bg-emerald-500/10 border-emerald-500/30',
      text: 'text-emerald-300',
      icon: 'text-emerald-400',
      Icon: CheckCircle,
    },
    warning: {
      wrapper: 'bg-amber-500/10 border-amber-500/30',
      text: 'text-amber-300',
      icon: 'text-amber-400',
      Icon: AlertTriangle,
    },
    error: {
      wrapper: 'bg-red-500/10 border-red-500/30',
      text: 'text-red-300',
      icon: 'text-red-400',
      Icon: AlertTriangle,
    },
    info: {
      wrapper: 'bg-cyan-500/10 border-cyan-500/30',
      text: 'text-cyan-300',
      icon: 'text-cyan-400',
      Icon: Info,
    },
  };

  const variant = variants[summary.kind] || variants.info;
  const { Icon } = variant;

  return (
    <div className={`rounded-lg border p-4 flex items-start gap-3 ${variant.wrapper}`}>
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${variant.icon}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${variant.text}`}>{summary.title}</p>
        {summary.message && (
          <p className={`mt-1 text-sm ${variant.text}`}>{summary.message}</p>
        )}
        {Array.isArray(summary.lines) && summary.lines.length > 0 && (
          <div className="mt-2 space-y-1">
            {summary.lines.map((line, index) => (
              <p key={`${line}-${index}`} className={`text-xs ${variant.text} opacity-90`}>
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className={`${variant.icon} hover:opacity-80`}>
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export const JsonViewer = ({ data, maxHeight = 400 }) => (
  <pre className="bg-background rounded-lg p-4 overflow-auto text-xs font-mono text-slate-300 border border-border" style={{ maxHeight }}>
    {JSON.stringify(data, null, 2)}
  </pre>
);
