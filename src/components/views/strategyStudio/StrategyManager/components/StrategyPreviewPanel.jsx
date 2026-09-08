// src/components/views/strategyStudio/StrategyPreviewPanel.jsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Database,
  FileJson,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Copy,
  Check,
  Loader2,
  BookOpen,
  Search,
  Upload,
  FileText,
  Shuffle,
  Filter
} from 'lucide-react';
import { validateFileBasics } from '@/lib/uploads/validation';
import { getPublicKehrnelBaseUrl } from '@/lib/kehrnel/url';

/**
 * SyntaxHighlightedJson - JSON viewer with syntax highlighting, line numbers, and collapsible nodes
 */
const SyntaxHighlightedJson = ({ data, maxHeight = '400px' }) => {
  const [collapsedPaths, setCollapsedPaths] = useState(new Set());

  const toggleCollapse = (path) => {
    setCollapsedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Build all lines first, then render with proper line numbers
  const buildLines = (value, path = '', depth = 0) => {
    const indent = '  '.repeat(depth);
    const isCollapsed = collapsedPaths.has(path);

    if (value === null) {
      return [{ content: <span className="text-orange-400">null</span>, inline: true }];
    }

    if (typeof value === 'boolean') {
      return [{ content: <span className="text-purple-400">{value.toString()}</span>, inline: true }];
    }

    if (typeof value === 'number') {
      return [{ content: <span className="text-cyan-400">{value}</span>, inline: true }];
    }

    if (typeof value === 'string') {
      const displayValue = value.length > 100 ? value.substring(0, 100) + '...' : value;
      return [{ content: <span className="text-emerald-400">&quot;{displayValue}&quot;</span>, inline: true }];
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return [{ content: <span className="text-slate-400">[]</span>, inline: true }];
      }

      if (isCollapsed) {
        return [{
          content: (
            <span>
              <button
                onClick={() => toggleCollapse(path)}
                className="inline-flex items-center text-slate-500 hover:text-slate-300 mr-1"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
              <span className="text-slate-400">[</span>
              <span className="text-slate-500 italic"> {value.length} items </span>
              <span className="text-slate-400">]</span>
            </span>
          ),
          inline: true
        }];
      }

      const lines = [];
      // Opening bracket
      lines.push({
        content: (
          <span>
            <button
              onClick={() => toggleCollapse(path)}
              className="inline-flex items-center text-slate-500 hover:text-slate-300 mr-1"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
            <span className="text-slate-400">[</span>
          </span>
        ),
        inline: true
      });

      // Array items
      value.forEach((item, idx) => {
        const itemPath = `${path}[${idx}]`;
        const isLast = idx === value.length - 1;
        const itemLines = buildLines(item, itemPath, depth + 1);

        if (itemLines.length === 1 && itemLines[0].inline) {
          lines.push({
            content: (
              <span>
                {'  '.repeat(depth + 1)}
                {itemLines[0].content}
                {!isLast && <span className="text-slate-400">,</span>}
              </span>
            )
          });
        } else {
          itemLines.forEach((line, lineIdx) => {
            if (lineIdx === itemLines.length - 1 && !isLast) {
              lines.push({
                content: <span>{line.content}<span className="text-slate-400">,</span></span>
              });
            } else {
              lines.push(line);
            }
          });
        }
      });

      // Closing bracket
      lines.push({
        content: <span>{indent}<span className="text-slate-400">]</span></span>
      });

      return lines;
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) {
        return [{ content: <span className="text-slate-400">{'{}'}</span>, inline: true }];
      }

      if (isCollapsed) {
        return [{
          content: (
            <span>
              <button
                onClick={() => toggleCollapse(path)}
                className="inline-flex items-center text-slate-500 hover:text-slate-300 mr-1"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
              <span className="text-slate-400">{'{'}</span>
              <span className="text-slate-500 italic"> {keys.length} keys </span>
              <span className="text-slate-400">{'}'}</span>
            </span>
          ),
          inline: true
        }];
      }

      const lines = [];
      // Opening brace
      lines.push({
        content: (
          <span>
            <button
              onClick={() => toggleCollapse(path)}
              className="inline-flex items-center text-slate-500 hover:text-slate-300 mr-1"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
            <span className="text-slate-400">{'{'}</span>
          </span>
        ),
        inline: true
      });

      // Object properties
      keys.forEach((key, idx) => {
        const keyPath = path ? `${path}.${key}` : key;
        const isLast = idx === keys.length - 1;
        const valueLines = buildLines(value[key], keyPath, depth + 1);

        if (valueLines.length === 1 && valueLines[0].inline) {
          lines.push({
            content: (
              <span>
                {'  '.repeat(depth + 1)}
                <span className="text-blue-400">&quot;{key}&quot;</span>
                <span className="text-slate-400">: </span>
                {valueLines[0].content}
                {!isLast && <span className="text-slate-400">,</span>}
              </span>
            )
          });
        } else {
          // First line with key
          lines.push({
            content: (
              <span>
                {'  '.repeat(depth + 1)}
                <span className="text-blue-400">&quot;{key}&quot;</span>
                <span className="text-slate-400">: </span>
                {valueLines[0].content}
              </span>
            )
          });
          // Rest of the lines
          valueLines.slice(1).forEach((line, lineIdx) => {
            if (lineIdx === valueLines.length - 2 && !isLast) {
              lines.push({
                content: <span>{line.content}<span className="text-slate-400">,</span></span>
              });
            } else {
              lines.push(line);
            }
          });
        }
      });

      // Closing brace
      lines.push({
        content: <span>{indent}<span className="text-slate-400">{'}'}</span></span>
      });

      return lines;
    }

    return [{ content: <span className="text-slate-300">{String(value)}</span>, inline: true }];
  };

  const lines = buildLines(data, '', 0);
  const lineNumberWidth = String(lines.length).length * 10 + 16; // Calculate width based on max line number

  return (
    <div
      className="bg-slate-950 rounded-lg overflow-auto font-mono text-xs leading-5"
      style={{ maxHeight }}
    >
      <div className="flex min-w-max">
        {/* Line numbers column */}
        <div
          className="flex-shrink-0 bg-slate-900/50 border-r border-slate-800 select-none text-right pr-3 py-3"
          style={{ minWidth: lineNumberWidth }}
        >
          {lines.map((_, idx) => (
            <div key={idx} className="text-slate-600 px-2">
              {idx + 1}
            </div>
          ))}
        </div>
        {/* Content column */}
        <div className="flex-1 py-3 pl-3 pr-4">
          {lines.map((line, idx) => (
            <div key={idx} className="whitespace-pre">
              {line.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/**
 * CollapsibleJsonSection - Collapsible section with syntax highlighted JSON
 */
const CollapsibleJsonSection = ({ data, title, sectionKey, icon: Icon, color = 'blue', defaultExpanded = false }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const colorClasses = {
    blue: 'text-blue-400',
    emerald: 'text-emerald-400',
    purple: 'text-purple-400',
    cyan: 'text-cyan-400',
    amber: 'text-amber-400',
    slate: 'text-slate-400'
  };

  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-slate-800/80 hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${colorClasses[color] || colorClasses.blue}`} />
          <span className="font-medium text-white text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="p-1 text-slate-400 hover:text-white transition-colors"
            title="Copy JSON"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-slate-700">
          <SyntaxHighlightedJson data={data} maxHeight="400px" />
        </div>
      )}
    </div>
  );
};

/**
 * StrategyPreviewPanel
 *
 * Allows testing a strategy configuration with a sample composition
 * to preview the transformation output in the Strategy Studio.
 */
const StrategyPreviewPanel = ({ strategy, onClose, activeEnvironmentId = '' }) => {
  const [sources, setSources] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [randomSample, setRandomSample] = useState(null);
  const [sourceMode, setSourceMode] = useState('database');
  const [customJson, setCustomJson] = useState('');
  const [jsonError, setJsonError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingSources, setLoadingSources] = useState(true);
  const [loadingRandom, setLoadingRandom] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const defaultKehrnelBaseUrl = getPublicKehrnelBaseUrl();
  const kehrnelApiBase = strategy?.kehrnel?.endpoint || process.env.NEXT_PUBLIC_KEHRNEL_URL || process.env.KEHRNEL_URL || defaultKehrnelBaseUrl;
  const kehrnelId = strategy?.kehrnelId;
  const isKehrnel = strategy?.source === 'kehrnel' || !!kehrnelId;
  const [apiExamples, setApiExamples] = useState([]);

  const resolveStrategyApiPrefix = useCallback(() => {
    const raw = String(kehrnelId || '').trim();
    if (!raw) return null;

    if (raw.includes('/')) {
      const parts = raw.split('/').filter(Boolean);
      const domain = parts[0] || '';
      const name = parts[1] || '';
      if (!domain || !name) return null;
      return `/api/strategies/${domain}/${name}`;
    }
    if (raw.includes('.')) {
      const [domain, ...rest] = raw.split('.');
      const name = rest.join('_') || '';
      if (!domain || !name) return null;
      return `/api/strategies/${domain}/${name}`;
    }
    const domain = String(strategy?.domain || '').trim().toLowerCase();
    if (!domain) return null;
    return `/api/strategies/${domain}/${raw}`;
  }, [kehrnelId, strategy?.domain]);

  useEffect(() => {
    const strategyApiPrefix = resolveStrategyApiPrefix();
    if (isKehrnel && kehrnelApiBase && kehrnelId && strategyApiPrefix) {
      setApiExamples([
        {
          method: 'POST',
          url: `${kehrnelApiBase}${strategyApiPrefix}/ingest/body`,
          description: 'Ingest + flatten composition via Kehrnel strategy routing',
          headers: {},
        },
        {
          method: 'POST',
          url: `${kehrnelApiBase}/strategies/activate`,
          description: 'Activate/update strategy config (admin)',
          body: { strategy_id: kehrnelId, config: 'Use schema defaults + overrides' },
        },
      ]);
    } else if (isKehrnel) {
      setApiExamples([]);
    } else {
      setApiExamples([
        {
          method: 'POST',
          url: `${defaultKehrnelBaseUrl || ''}/transform/flatten`,
          description: 'Flatten a canonical OpenEHR composition (local)',
        },
      ]);
    }
  }, [defaultKehrnelBaseUrl, isKehrnel, kehrnelApiBase, kehrnelId, resolveStrategyApiPrefix]);

  // Fetch available sample sources and templates
  useEffect(() => {
    const fetchSources = async () => {
      setLoadingSources(true);
      try {
        const res = await fetch('/api/strategies/preview-transform', {
          headers: activeEnvironmentId ? { 'x-active-env': activeEnvironmentId } : {}
        });
        if (res.ok) {
          const data = await res.json();
          setSources(data.sources || []);
          setTemplates(data.templates || []);
          // Auto-fetch a random sample
          if (data.sources?.length > 0) {
            fetchRandomSample();
          }
        }
      } catch (err) {
        console.error('Failed to fetch sources:', err);
      } finally {
        setLoadingSources(false);
      }
    };
    fetchSources();
  }, [activeEnvironmentId]);

  // Fetch a random sample composition
  const fetchRandomSample = useCallback(async (templateFilter = '') => {
    setLoadingRandom(true);
    try {
      const params = new URLSearchParams({ random: 'true' });
      if (templateFilter) {
        params.append('template', templateFilter);
      }
      const res = await fetch(`/api/strategies/preview-transform?${params}`, {
        headers: activeEnvironmentId ? { 'x-active-env': activeEnvironmentId } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sample) {
          setRandomSample(data.sample);
        }
      }
    } catch (err) {
      console.error('Failed to fetch random sample:', err);
    } finally {
      setLoadingRandom(false);
    }
  }, [activeEnvironmentId]);

  const handleTemplateChange = (templateId) => {
    setSelectedTemplate(templateId);
    fetchRandomSample(templateId);
  };

  const refreshRandomSample = () => {
    fetchRandomSample(selectedTemplate);
  };

  const runPreview = async () => {
    if (!strategy) return;

    // Validate source based on mode
    if (sourceMode === 'database' && !randomSample) {
      setError('No sample composition loaded. Click refresh to load one.');
      return;
    }

    if ((sourceMode === 'paste' || sourceMode === 'upload') && !customJson.trim()) {
      setError('Please provide a composition JSON');
      return;
    }

    // Parse custom JSON if provided
    let sampleComposition = null;
    if (sourceMode === 'paste' || sourceMode === 'upload') {
      try {
        sampleComposition = JSON.parse(customJson);
        setJsonError(null);
      } catch (e) {
        setJsonError('Invalid JSON: ' + e.message);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      const body = {
        strategy,
        environment: activeEnvironmentId || undefined,
        ...(sourceMode === 'database' ? {
          sampleSource: {
            database: null,
            collection: 'sample-compositions',
            documentId: randomSample?._id,
            environment: activeEnvironmentId || undefined
          }
        } : {
          sampleComposition
        })
      };

      const res = await fetch('/api/strategies/preview-transform', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeEnvironmentId ? { 'x-active-env': activeEnvironmentId } : {})
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      } else {
        const err = await res.json();
        setError(err.error || 'Preview failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const error = validateFileBasics(file, {
      allowedExtensions: ['.json'],
      allowedMimeTypes: ['application/json', 'text/json', 'application/x-ndjson', 'application/jsonl', 'text/plain'],
      maxBytes: 5 * 1024 * 1024,
      allowMissingType: true
    });
    if (error) {
      setJsonError(error);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setCustomJson(content);
        setJsonError(null);
        try {
          JSON.parse(content);
        } catch (err) {
          setJsonError('Invalid JSON: ' + err.message);
        }
      }
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-900/40 rounded-lg">
            <Play className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Transform Preview</h3>
            <p className="text-xs text-slate-400">
              Test strategy with a sample composition
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Source Mode Selection */}
      <div className="p-4 border-b border-slate-700">
        <label className="block text-xs font-medium text-slate-400 mb-3">
          Composition Source
        </label>

        {/* Mode Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSourceMode('database')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              sourceMode === 'database'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <Database className="w-4 h-4" />
            From Database
          </button>
          <button
            onClick={() => setSourceMode('paste')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              sourceMode === 'paste'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <FileText className="w-4 h-4" />
            Paste JSON
          </button>
          <button
            onClick={() => setSourceMode('upload')}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              sourceMode === 'upload'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload File
          </button>
        </div>

        {/* Database Source - Random Sample */}
        {sourceMode === 'database' && (
          <div className="space-y-3">
            {/* Source indicator */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-700/50 rounded-lg">
              <FileJson className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-slate-300">sample-compositions</span>
              <span className="text-xs text-slate-500">(random)</span>
            </div>

            {/* Template Filter */}
            {templates.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All templates</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name || t.id}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Random Sample Display */}
            {loadingSources || loadingRandom ? (
              <div className="flex items-center gap-2 text-slate-400 p-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading sample...</span>
              </div>
            ) : randomSample ? (
              <div className="space-y-3">
                {/* Sample Info Header */}
                <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-400">Source Composition</span>
                    <button
                      onClick={refreshRandomSample}
                      disabled={loadingRandom}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                      title="Get another random sample"
                    >
                      <Shuffle className="w-3 h-3" />
                      Refresh
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Composition ID: </span>
                      <span className="text-white font-mono">{randomSample._id || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Template: </span>
                      <span className="text-emerald-400 font-medium">{randomSample.templateName || randomSample.templateId || randomSample.template_id || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Composition Preview */}
                {randomSample.composition && (
                  <CollapsibleJsonSection
                    data={randomSample.composition}
                    title="Source Composition (canonical JSON)"
                    sectionKey="sourceComposition"
                    icon={FileJson}
                    color="slate"
                    defaultExpanded={false}
                  />
                )}
              </div>
            ) : sources.length === 0 ? (
              <div className="p-3 bg-amber-900/20 border border-amber-600/30 rounded-lg">
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">No sample compositions found. Use Paste or Upload instead.</span>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* Paste JSON */}
        {sourceMode === 'paste' && (
          <div className="space-y-2">
            <textarea
              value={customJson}
              onChange={(e) => {
                setCustomJson(e.target.value);
                setJsonError(null);
              }}
              placeholder="Paste your openEHR composition JSON here..."
              className="w-full h-48 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
            {jsonError && (
              <div className="flex items-center gap-2 text-red-400 text-xs">
                <XCircle className="w-3 h-3" />
                {jsonError}
              </div>
            )}
          </div>
        )}

        {/* Upload File */}
        {sourceMode === 'upload' && (
          <div className="space-y-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json,application/json"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full p-6 border-2 border-dashed border-slate-600 rounded-lg hover:border-purple-500 transition-colors"
            >
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Upload className="w-8 h-8" />
                <span className="text-sm">Click to upload JSON file</span>
                <span className="text-xs text-slate-500">or drag and drop</span>
              </div>
            </button>
            {customJson && (
              <div className="p-3 bg-emerald-900/20 border border-emerald-600/30 rounded-lg">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">File loaded ({(customJson.length / 1024).toFixed(1)} KB)</span>
                </div>
              </div>
            )}
            {jsonError && (
              <div className="flex items-center gap-2 text-red-400 text-xs">
                <XCircle className="w-3 h-3" />
                {jsonError}
              </div>
            )}
          </div>
        )}

        {/* Test Button */}
        <button
          onClick={runPreview}
          disabled={loading || (sourceMode === 'database' && !randomSample) || ((sourceMode === 'paste' || sourceMode === 'upload') && !customJson.trim())}
          className="w-full mt-4 px-4 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Transforming...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Test Transform
            </>
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-900/20 border-b border-red-600/30">
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Preview Results */}
      {preview && (
        <div className="p-4 space-y-4">
          {/* Kehrnel Status Banner */}
          <div className={`p-3 rounded-lg border ${
            preview.simulated
              ? 'bg-amber-900/20 border-amber-600/30'
              : 'bg-emerald-900/20 border-emerald-600/30'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {preview.simulated ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-medium text-amber-300">Simulated Preview</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-300">Real Kehrnel Transform</span>
                  </>
                )}
              </div>
              {preview.kehrnelInstance && (
                <span className="text-xs text-slate-400">
                  Instance: {preview.kehrnelInstance}
                </span>
              )}
            </div>
            {preview.warning && (
              <p className="text-xs text-amber-400/80 mt-1">{preview.warning}</p>
            )}
            {preview.kehrnelError && (
              <p className="text-xs text-red-400 mt-1 font-mono">{preview.kehrnelError}</p>
            )}
          </div>

          {/* Source Info */}
          <div className="p-3 bg-slate-700/30 rounded-lg">
            <div className="text-xs font-medium text-slate-400 mb-2">Source Composition</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-500">Composition ID: </span>
                <span className="text-white font-mono">{preview.source?.sourceId || preview.source?.compositionId || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500">Template ID: </span>
                <span className="text-emerald-400 font-mono">{preview.source?.templateId || preview.source?.templateName || 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Engine Validation */}
          {preview.engine && (
            <div className={`p-3 rounded-lg border ${
              preview.engine.validation?.compatible
                ? 'bg-emerald-900/20 border-emerald-600/30'
                : 'bg-amber-900/20 border-amber-600/30'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {preview.engine.validation?.compatible ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}
                <span className="text-sm font-medium text-white">
                  Engine: {preview.engine.name}
                </span>
                {preview.engine.status === 'planned' && (
                  <span className="text-xs px-1.5 py-0.5 bg-amber-900/40 text-amber-300 rounded">
                    Planned
                  </span>
                )}
              </div>
              {preview.engine.validation?.issues?.length > 0 && (
                <div className="text-xs text-amber-300">
                  Issues: {preview.engine.validation.issues.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Config Summary */}
          <CollapsibleJsonSection
            data={preview.config}
            title="Configuration Applied"
            sectionKey="config"
            icon={BookOpen}
            color="purple"
            defaultExpanded={false}
          />

          {/* Transformed Composition */}
          {preview.output?.composition && (() => {
            const compNodes = Array.isArray(preview.output.composition.cn)
              ? preview.output.composition.cn.length
              : null;
            const compTitle = compNodes && compNodes > 0
              ? `Transformed Composition (${compNodes} nodes)`
              : 'Transformed Composition';
            return (
              <CollapsibleJsonSection
                data={preview.output.composition}
                title={compTitle}
                sectionKey="composition"
                icon={FileJson}
                color="emerald"
                defaultExpanded={true}
              />
            );
          })()}

          {/* Search projection info */}
          {(() => {
            const projectionPaths = Array.isArray(preview.searchProjectionPaths)
              ? preview.searchProjectionPaths
              : (Array.isArray(preview.analyticsPaths) ? preview.analyticsPaths : []);
            const projectionSourceLabel = preview.searchProjection?.sourceLabel || null;
            const emptyStateMessage =
              preview.searchProjection?.emptyStateMessage ||
              'No search projection mappings found for this template. Kehrnel will skip the `compositions_search` sidecar.';

            return (
              <div className="p-3 bg-slate-700/30 rounded-lg border border-slate-600/40">
                <div className="text-xs font-medium text-slate-300 mb-1">
                  Search Projection Mapping
                  {preview.source?.templateId && (
                    <span className="text-slate-500 font-normal"> for template {preview.source.templateId}</span>
                  )}
                </div>
                {projectionSourceLabel && (
                  <p className="text-[11px] text-slate-500 mb-2">
                    Source: {projectionSourceLabel}
                  </p>
                )}
                {projectionPaths.length > 0 ? (
                  <>
                    <p className="text-xs text-slate-400 mb-1">
                      {projectionPaths.length} fields available for search-side projection.
                    </p>
                    <pre className="text-[11px] text-slate-300 bg-slate-800/60 rounded p-2 overflow-auto max-h-64">
                      {projectionPaths.join('\n')}
                    </pre>
                  </>
                ) : (
                  <p className="text-xs text-amber-300">{emptyStateMessage}</p>
                )}
              </div>
            );
          })()}

          {/* Search Document */}
          {preview.output?.search && (
            <CollapsibleJsonSection
              data={preview.output.search}
              title="Search Document"
              sectionKey="search"
              icon={Search}
              color="cyan"
              defaultExpanded={false}
            />
          )}
        </div>
      )}

      {/* Empty State */}
      {!preview && !loading && !error && (
        <div className="p-8 text-center text-slate-400">
          <Play className="w-8 h-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Select a source and click Test Transform to preview the output</p>
        </div>
      )}
    </div>
  );
};

export default StrategyPreviewPanel;
