// src/components/views/mappingStudio/components/PatternManager.jsx
'use client';

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Save,
  Trash2,
  Edit2,
  FileCode,
  FileText,
  Database,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  AlertCircle,
  CheckCircle,
  Copy,
  Download,
  Upload,
  RefreshCw,
  Info,
  Code,
  Eye
} from 'lucide-react';
import Editor from "@monaco-editor/react";
import yaml from 'js-yaml';
import { validateFileBasics } from '@/lib/uploads/validation';

const PatternManager = ({ onPatternUpdate }) => {
  const [patterns, setPatterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingPattern, setEditingPattern] = useState(null);
  const [showAddPattern, setShowAddPattern] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterHandler, setFilterHandler] = useState('all');
  const [expandedPatterns, setExpandedPatterns] = useState({});
  const [testDocument, setTestDocument] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [viewMode, setViewMode] = useState('visual'); // 'visual' or 'editor'
  const [editorContent, setEditorContent] = useState('');
  const [editorFormat, setEditorFormat] = useState('yaml'); // 'yaml' or 'json'
  const [editorModified, setEditorModified] = useState(false);
  const [showPatternEditor, setShowPatternEditor] = useState({}); // For individual pattern editors
  const PATTERN_IMPORT_MAX_BYTES = 2 * 1024 * 1024; // 2MB
  const PATTERN_IMPORT_EXTENSIONS = ['.json', '.yaml', '.yml'];
  const PATTERN_IMPORT_MIME_TYPES = [
    'application/json',
    'text/json',
    'text/yaml',
    'application/x-yaml',
    'application/yaml',
    'text/plain'
  ];
  const TEST_DOC_MAX_BYTES = 5 * 1024 * 1024; // 5MB
  const TEST_DOC_EXTENSIONS = ['.xml', '.cda', '.csv', '.json', '.txt', '.hl7'];
  const TEST_DOC_MIME_TYPES = [
    'application/xml',
    'text/xml',
    'application/json',
    'text/json',
    'text/plain',
    'text/csv',
    'application/csv',
    'application/hl7-v2',
    'application/octet-stream'
  ];

  // New pattern form state
  const [newPattern, setNewPattern] = useState({
    name: '',
    handler: 'xml',
    priority: 50,
    required_elements: [],
    xpath_patterns: [],
    namespaces: {},
    csv_headers: [],
    exclude_elements: []
  });

  // Fetch patterns on mount
  useEffect(() => {
    fetchPatterns();
  }, []);

  const fetchPatterns = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/patterns');
      if (!response.ok) throw new Error('Failed to fetch patterns');
      const data = await response.json();
      setPatterns(data.patterns || []);

      // Update editor content when patterns are fetched
      updateEditorContent(data.patterns || [], editorFormat);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const updateEditorContent = (patternsData, format) => {
    try {
      if (format === 'yaml') {
        setEditorContent(yaml.dump(patternsData, {
          indent: 2,
          lineWidth: -1,
          noRefs: true,
          sortKeys: false
        }));
      } else {
        setEditorContent(JSON.stringify(patternsData, null, 2));
      }
      setEditorModified(false);
    } catch (err) {
      setError(`Failed to convert to ${format}: ${err.message}`);
    }
  };

  const handleEditorChange = (value) => {
    setEditorContent(value);
    setEditorModified(true);
  };

  // Helper function to trim array elements
  const trimArrayElements = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map(item => typeof item === 'string' ? item.trim() : item)
              .filter(item => item !== '');
  };

  // Helper function to trim object keys and values
  const trimNamespaces = (obj) => {
    if (!obj || typeof obj !== 'object') return {};
    const trimmed = {};
    for (const [key, value] of Object.entries(obj)) {
      trimmed[key.trim()] = typeof value === 'string' ? value.trim() : value;
    }
    return trimmed;
  };

  const normalizePattern = (p) => ({
    name: String(p?.name || '').trim(),
    handler: p?.handler || 'xml',
    priority: Number.isFinite(p?.priority) ? p.priority : 50,
    required_elements: trimArrayElements(p?.required_elements),
    xpath_patterns: trimArrayElements(p?.xpath_patterns),
    namespaces: trimNamespaces(p?.namespaces),
    csv_headers: trimArrayElements(p?.csv_headers),
    exclude_elements: trimArrayElements(p?.exclude_elements)
  });

  const saveEditorContent = async () => {
    try {
      let patternsData;

      // Parse the editor content
      if (editorFormat === 'yaml') {
        patternsData = yaml.load(editorContent);
      } else {
        patternsData = JSON.parse(editorContent);
      }

      if (!Array.isArray(patternsData)) {
        throw new Error('Content must be an array of patterns');
      }

      // Clear existing patterns in backend
      const currentPatterns = await fetch('/api/patterns');
      const currentData = await currentPatterns.json();

      // Delete all existing patterns
      for (const pattern of currentData.patterns || []) {
        await fetch(`/api/patterns/${pattern.name}`, {
          method: 'DELETE'
        });
      }

      // Import all patterns from editor
      const errors = [];
      let successCount = 0;

      for (const raw of patternsData) {
        const pattern = normalizePattern(raw);
        if (!pattern.name) {
          errors.push({ pattern: '(missing name)', error: 'Pattern name is required' });
          continue;
        }

        try {
          const response = await fetch('/api/patterns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pattern)
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to save pattern');
          }

          successCount++;
        } catch (err) {
          errors.push({
            pattern: pattern.name || 'unknown',
            error: err.message
          });
        }
      }

      if (errors.length > 0) {
        setError(`Saved ${successCount} patterns. Errors: ${errors.map(e => `${e.pattern}: ${e.error}`).join(', ')}`);
      } else {
        setError(null);
      }

      await fetchPatterns();
      setEditorModified(false);

      if (onPatternUpdate) onPatternUpdate();
    } catch (err) {
      setError(`Failed to save: ${err.message}`);
    }
  };

  const switchEditorFormat = () => {
    const newFormat = editorFormat === 'yaml' ? 'json' : 'yaml';
    updateEditorContent(patterns, newFormat);
    setEditorFormat(newFormat);
  };

  const savePattern = async (pattern) => {
    try {
      // Normalize the pattern before saving
      const normalizedPattern = normalizePattern(pattern);
      
      const response = await fetch('/api/patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalizedPattern)
      });

      if (!response.ok) throw new Error('Failed to save pattern');

      await fetchPatterns();
      setShowAddPattern(false);
      setEditingPattern(null);
      setNewPattern({
        name: '',
        handler: 'xml',
        priority: 50,
        required_elements: [],
        xpath_patterns: [],
        namespaces: {},
        csv_headers: [],
        exclude_elements: []
      });

      if (onPatternUpdate) onPatternUpdate();
    } catch (err) {
      setError(err.message);
    }
  };

  const deletePattern = async (patternName) => {
    if (!confirm(`Delete pattern "${patternName}"?`)) return;

    try {
      const response = await fetch(`/api/patterns/${patternName}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete pattern');

      await fetchPatterns();
      if (onPatternUpdate) onPatternUpdate();
    } catch (err) {
      setError(err.message);
    }
  };

  const testPatternOnDocument = async () => {
    if (!testDocument) return;

    try {
      const formData = new FormData();
      formData.append('document', testDocument);
      
      // Normalize the pattern before testing
      const patternToTest = normalizePattern(editingPattern || newPattern);
      formData.append('patterns', JSON.stringify(patternToTest));

      const response = await fetch('/api/patterns/test', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Failed to test pattern');

      const result = await response.json();
      setTestResults(result);
    } catch (err) {
      setError(err.message);
    }
  };

  const exportPatterns = () => {
    const dataStr = editorFormat === 'yaml' ? editorContent : JSON.stringify(patterns, null, 2);
    const mimeType = editorFormat === 'yaml' ? 'text/yaml' : 'application/json';
    const dataUri = `data:${mimeType};charset=utf-8,${encodeURIComponent(dataStr)}`;

    const exportFileDefaultName = `patterns_${new Date().toISOString().split('T')[0]}.${editorFormat}`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importPatterns = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const error = validateFileBasics(file, {
      allowedExtensions: PATTERN_IMPORT_EXTENSIONS,
      allowedMimeTypes: PATTERN_IMPORT_MIME_TYPES,
      maxBytes: PATTERN_IMPORT_MAX_BYTES,
      allowMissingType: true
    });
    if (error) {
      setError(error);
      event.target.value = '';
      return;
    }

    try {
      const formData = new FormData();
      formData.append('patterns_file', file);

      const response = await fetch('/api/patterns/import', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to import patterns');
      }

      const result = await response.json();
      if (result.errors && result.errors.length > 0) {
        setError(`Imported ${result.imported} patterns. Errors: ${result.errors.map(e => `${e.pattern}: ${e.error}`).join(', ')}`);
      } else {
        setError(null);
      }

      await fetchPatterns();
    } catch (err) {
      setError('Failed to import patterns: ' + err.message);
    }
  };

  // Filter patterns
  const filteredPatterns = patterns.filter(pattern => {
    const matchesSearch = pattern.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesHandler = filterHandler === 'all' || pattern.handler === filterHandler;
    return matchesSearch && matchesHandler;
  });

  // Group patterns by handler
  const groupedPatterns = filteredPatterns.reduce((acc, pattern) => {
    if (!acc[pattern.handler]) acc[pattern.handler] = [];
    acc[pattern.handler].push(pattern);
    return acc;
  }, {});

  const getHandlerIcon = (handler) => {
    switch (handler) {
      case 'xml': return <FileCode className="text-orange-400" size={16} />;
      case 'csv': return <FileText className="text-green-400" size={16} />;
      case 'json': return <FileCode className="text-blue-400" size={16} />;
      case 'hl7v2': return <FileCode className="text-purple-400" size={16} />;
      default: return <Database className="text-gray-400" size={16} />;
    }
  };

  const togglePattern = (patternName) => {
    setExpandedPatterns(prev => ({
      ...prev,
      [patternName]: !prev[patternName]
    }));
  };

  const handleTextareaKeyDown = (e) => {
    // Allow Enter key to create new lines in textarea
    if (e.key === 'Enter') {
      e.stopPropagation(); // Prevent form submission if in a form
    }
  };

  const renderPatternForm = (pattern, isNew = false) => {
    const currentPattern = isNew ? newPattern : editingPattern;
    const setCurrentPattern = isNew ? setNewPattern : setEditingPattern;
    const patternKey = isNew ? 'new' : currentPattern.name;

    return (
      <div className="space-y-4 p-4 bg-gray-700 rounded">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Pattern Name*
            </label>
            <input
              type="text"
              value={currentPattern.name}
              onChange={(e) => setCurrentPattern({ ...currentPattern, name: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
              placeholder="e.g., pmsi_cda"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Handler*
            </label>
            <select
              value={currentPattern.handler}
              onChange={(e) => setCurrentPattern({ ...currentPattern, handler: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
            >
              <option value="xml">XML</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="hl7v2">HL7v2</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Priority (higher = checked first)
          </label>
          <input
            type="number"
            value={currentPattern.priority}
            onChange={(e) => setCurrentPattern({ ...currentPattern, priority: parseInt(e.target.value) || 50 })}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
            min="1"
            max="100"
          />
        </div>

        {/* YAML/JSON Editor for this specific pattern */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-gray-300">
              Edit as {editorFormat.toUpperCase()}
            </label>
            <button
              onClick={() => setShowPatternEditor({
                ...showPatternEditor,
                [patternKey]: !showPatternEditor[patternKey]
              })}
              className="px-2 py-1 bg-gray-600 text-gray-300 rounded hover:bg-gray-500 text-xs flex items-center gap-1"
            >
              <Code size={12} />
              {showPatternEditor[patternKey] ? 'Hide' : 'Show'} Editor
            </button>
          </div>
          
          {showPatternEditor[patternKey] && (
            <div className="border border-gray-600 rounded-lg overflow-hidden mb-4">
              <Editor
                height="200px"
                defaultLanguage={editorFormat}
                language={editorFormat}
                theme="vs-dark"
                value={editorFormat === 'yaml' 
                  ? yaml.dump(currentPattern, { indent: 2 })
                  : JSON.stringify(currentPattern, null, 2)
                }
                onChange={(value) => {
                  try {
                    const parsed = editorFormat === 'yaml' ? yaml.load(value) : JSON.parse(value);
                    setCurrentPattern(parsed);
                  } catch (e) {
                    // Invalid format, ignore for now
                  }
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 12,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false
                }}
              />
            </div>
          )}
        </div>

        {/* Handler-specific fields */}
        {currentPattern.handler === 'xml' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Required Elements (one per line, press Enter for new lines)
              </label>
              <textarea
                value={currentPattern.required_elements.join('\n')}
                onChange={(e) => setCurrentPattern({
                  ...currentPattern,
                  required_elements: e.target.value.split('\n').map(s => s.trim()).filter(s => s)
                })}
                onKeyDown={handleTextareaKeyDown}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white font-mono text-sm"
                rows={3}
                placeholder="ClinicalDocument&#10;code&#10;title"
              />
              <p className="text-xs text-gray-400 mt-1">Press Enter to add new lines. Items will be trimmed automatically.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                XPath Patterns (one per line)
              </label>
              <textarea
                value={currentPattern.xpath_patterns.join('\n')}
                onChange={(e) => setCurrentPattern({
                  ...currentPattern,
                  xpath_patterns: e.target.value.split('\n').map(s => s.trim()).filter(s => s)
                })}
                onKeyDown={handleTextareaKeyDown}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white font-mono text-sm"
                rows={3}
                placeholder="//cda:code[@code='SYNTH']&#10;//cda:title[contains(text(),'PMSI')]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Namespaces (JSON format)
              </label>
              <textarea
                value={JSON.stringify(currentPattern.namespaces, null, 2)}
                onChange={(e) => {
                  try {
                    const ns = JSON.parse(e.target.value);
                    setCurrentPattern({ ...currentPattern, namespaces: ns });
                  } catch (err) {
                    // Invalid JSON, keep as is for user to fix
                  }
                }}
                onKeyDown={handleTextareaKeyDown}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white font-mono text-sm"
                rows={3}
                placeholder='{"cda": "urn:hl7-org:v3"}'
              />
            </div>
          </>
        )}

        {currentPattern.handler === 'csv' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Required CSV Headers (one per line, press Enter for new lines)
            </label>
            <textarea
              value={currentPattern.csv_headers.join('\n')}
              onChange={(e) => setCurrentPattern({
                ...currentPattern,
                csv_headers: e.target.value.split('\n').map(s => s.trim()).filter(s => s)
              })}
              onKeyDown={handleTextareaKeyDown}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white font-mono text-sm"
              rows={4}
              placeholder="patient_id&#10;test_name&#10;result_value&#10;unit"
            />
            <p className="text-xs text-gray-400 mt-1">Headers will be trimmed and converted to lowercase for matching.</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Exclude Elements (one per line, press Enter for new lines)
          </label>
          <textarea
            value={currentPattern.exclude_elements.join('\n')}
            onChange={(e) => setCurrentPattern({
              ...currentPattern,
              exclude_elements: e.target.value.split('\n').map(s => s.trim()).filter(s => s)
            })}
            onKeyDown={handleTextareaKeyDown}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white font-mono text-sm"
            rows={2}
            placeholder="deprecated_element&#10;legacy_field"
          />
          <p className="text-xs text-gray-400 mt-1">Items will be trimmed automatically.</p>
        </div>

        {/* Test Pattern */}
        <div className="border-t border-gray-600 pt-4">
          <h4 className="text-sm font-medium text-gray-300 mb-2">Test Pattern</h4>
          <div className="flex gap-2">
            <input
              type="file"
              accept={TEST_DOC_EXTENSIONS.join(',')}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const error = validateFileBasics(file, {
                  allowedExtensions: TEST_DOC_EXTENSIONS,
                  allowedMimeTypes: TEST_DOC_MIME_TYPES,
                  maxBytes: TEST_DOC_MAX_BYTES,
                  allowMissingType: true
                });
                if (error) {
                  setError(error);
                  e.target.value = '';
                  setTestDocument(null);
                  return;
                }
                setTestDocument(file);
              }}
              className="hidden"
              id="test-file-upload"
            />
            <label
              htmlFor="test-file-upload"
              className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-500 cursor-pointer flex items-center gap-2"
            >
              <Upload size={14} />
              Select Test Document
            </label>
            {testDocument && (
              <>
                <span className="text-sm text-gray-400 py-1">{testDocument.name}</span>
                <button
                  onClick={testPatternOnDocument}
                  className="px-3 py-1 bg-primary text-primary-text rounded hover:bg-primary-hover flex items-center gap-2"
                >
                  <RefreshCw size={14} />
                  Test
                </button>
              </>
            )}
          </div>

          {testResults && (
            <div className={`mt-2 p-2 rounded ${testResults.matches ? 'bg-green-900/20 border border-green-700' : 'bg-red-900/20 border border-red-700'}`}>
              <div className="flex items-center gap-2">
                {testResults.matches ? (
                  <>
                    <CheckCircle className="text-green-400" size={16} />
                    <span className="text-green-300 text-sm">Pattern matches!</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="text-red-400" size={16} />
                    <span className="text-red-300 text-sm">Pattern does not match</span>
                  </>
                )}
              </div>
              {testResults.details && (
                <pre className="text-xs text-gray-400 mt-2 font-mono">
                  {JSON.stringify(testResults.details, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setEditingPattern(null);
              setShowAddPattern(false);
              setTestDocument(null);
              setTestResults(null);
              setShowPatternEditor({});
            }}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
          >
            Cancel
          </button>
          <button
            onClick={() => savePattern(currentPattern)}
            className="px-4 py-2 bg-primary text-primary-text rounded hover:bg-primary-hover flex items-center gap-2"
          >
            <Save size={16} />
            Save Pattern
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading patterns...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-xl font-medium text-white mb-2">
            Document Pattern Configuration
          </h3>
          <p className="text-gray-400 text-sm">
            Define patterns to automatically identify document types
          </p>
        </div>

        <div className="flex gap-2">
          {/* View Mode Toggle */}
          <div className="flex gap-1 bg-gray-700 rounded p-1">
            <button
              onClick={() => setViewMode('visual')}
              className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${viewMode === 'visual'
                ? "bg-primary text-primary-text"
                : "text-gray-300 hover:bg-gray-600"
                }`}
            >
              <Eye size={14} />
              Visual
            </button>
            <button
              onClick={() => setViewMode('editor')}
              className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${viewMode === 'editor'
                ? "bg-primary text-primary-text"
                : "text-gray-300 hover:bg-gray-600"
                }`}
            >
              <Code size={14} />
              Editor
            </button>
          </div>

          <input
            type="file"
            accept=".json,.yaml,.yml"
            onChange={importPatterns}
            className="hidden"
            id="import-patterns"
          />
          <label
            htmlFor="import-patterns"
            className="px-3 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 cursor-pointer flex items-center gap-2"
          >
            <Upload size={16} />
            Import
          </label>

          <button
            onClick={exportPatterns}
            className="px-3 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 flex items-center gap-2"
          >
            <Download size={16} />
            Export
          </button>

          {viewMode === 'visual' && (
            <button
              onClick={() => setShowAddPattern(true)}
              className="px-4 py-2 bg-primary text-primary-text rounded hover:bg-primary-hover flex items-center gap-2"
            >
              <Plus size={16} />
              Add Pattern
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="text-red-400 mt-0.5" size={16} />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {viewMode === 'visual' ? (
        <>
          {/* Search and Filter */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search patterns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
              />
            </div>

            <select
              value={filterHandler}
              onChange={(e) => setFilterHandler(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white"
            >
              <option value="all">All Handlers</option>
              <option value="xml">XML</option>
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="hl7v2">HL7v2</option>
            </select>
          </div>

          {/* Add Pattern Form */}
          {showAddPattern && !editingPattern && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-lg font-medium text-white mb-4">Add New Pattern</h4>
              {renderPatternForm(newPattern, true)}
            </div>
          )}

          {/* Pattern List */}
          <div className="space-y-4">
            {Object.entries(groupedPatterns).map(([handler, patterns]) => (
              <div key={handler} className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="p-4 bg-gray-700 flex items-center gap-2">
                  {getHandlerIcon(handler)}
                  <span className="font-medium text-white uppercase">{handler} Patterns</span>
                  <span className="text-gray-400 text-sm">({patterns.length})</span>
                </div>

                <div className="divide-y divide-gray-700">
                  {patterns.map(pattern => {
                    const isExpanded = expandedPatterns[pattern.name];
                    const isEditing = editingPattern?.name === pattern.name;

                    return (
                      <div key={pattern.name} className="p-4">
                        {isEditing ? (
                          renderPatternForm(pattern)
                        ) : (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => togglePattern(pattern.name)}
                                  className="text-gray-400 hover:text-white"
                                >
                                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>

                                <div>
                                  <h5 className="font-medium text-white">{pattern.name}</h5>
                                  <p className="text-sm text-gray-400">Priority: {pattern.priority}</p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(JSON.stringify(pattern, null, 2));
                                  }}
                                  className="p-1 text-gray-400 hover:text-white"
                                  title="Copy pattern"
                                >
                                  <Copy size={16} />
                                </button>

                                <button
                                  onClick={() => setEditingPattern(pattern)}
                                  className="p-1 text-gray-400 hover:text-white"
                                  title="Edit pattern"
                                >
                                  <Edit2 size={16} />
                                </button>

                                <button
                                  onClick={() => deletePattern(pattern.name)}
                                  className="p-1 text-gray-400 hover:text-red-400"
                                  title="Delete pattern"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="mt-4 space-y-3 pl-7">
                                {pattern.required_elements?.length > 0 && (
                                  <div>
                                    <span className="text-sm text-gray-500">Required Elements:</span>
                                    <div className="mt-1 flex flex-wrap gap-2">
                                      {pattern.required_elements.map((elem, idx) => (
                                        <span key={idx} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                                          {elem}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {pattern.xpath_patterns?.length > 0 && (
                                  <div>
                                    <span className="text-sm text-gray-500">XPath Patterns:</span>
                                    <div className="mt-1 space-y-1">
                                      {pattern.xpath_patterns.map((xpath, idx) => (
                                        <div key={idx} className="text-xs bg-gray-900 text-blue-300 px-2 py-1 rounded font-mono">
                                          {xpath}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {pattern.csv_headers?.length > 0 && (
                                  <div>
                                    <span className="text-sm text-gray-500">CSV Headers:</span>
                                    <div className="mt-1 flex flex-wrap gap-2">
                                      {pattern.csv_headers.map((header, idx) => (
                                        <span key={idx} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                                          {header}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {pattern.namespaces && Object.keys(pattern.namespaces).length > 0 && (
                                  <div>
                                    <span className="text-sm text-gray-500">Namespaces:</span>
                                    <pre className="mt-1 text-xs bg-gray-900 text-gray-300 p-2 rounded font-mono">
                                      {JSON.stringify(pattern.namespaces, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* Editor View */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">Editing patterns as:</span>
              <button
                onClick={switchEditorFormat}
                className="px-3 py-1 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 flex items-center gap-2"
              >
                <FileCode size={14} />
                {editorFormat === 'yaml' ? 'Switch to JSON' : 'Switch to YAML'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {editorModified && (
                <span className="text-yellow-400 text-sm flex items-center gap-1">
                  <AlertCircle size={14} />
                  Unsaved changes
                </span>
              )}
              <button
                onClick={saveEditorContent}
                disabled={!editorModified}
                className={`px-4 py-2 rounded flex items-center gap-2 ${editorModified
                  ? 'bg-primary text-primary-text hover:bg-primary-hover'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
              >
                <Save size={16} />
                Save All Patterns
              </button>
            </div>
          </div>

          <div className="border border-gray-600 rounded-lg overflow-hidden">
            <Editor
              height="600px"
              defaultLanguage={editorFormat}
              language={editorFormat}
              theme="vs-dark"
              value={editorContent}
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: 'on',
                scrollBeyondLastLine: false
              }}
            />
          </div>

          <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
            <div className="flex gap-2">
              <AlertCircle className="text-yellow-400 mt-0.5" size={16} />
              <div className="text-sm text-yellow-300">
                <p className="font-medium mb-1">Editor Mode Notes:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>This will replace ALL patterns with the content in the editor</li>
                  <li>Make sure to maintain proper YAML/JSON syntax</li>
                  <li>Use the Export button to save a backup before making major changes</li>
                  <li>You can switch between YAML and JSON formats</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="text-blue-400 mt-1" size={20} />
          <div className="text-sm text-gray-300 space-y-2">
            <p>
              <strong>Visual Mode:</strong> Add, edit, and delete individual patterns with a form interface. Use Enter key to add new lines in text areas.
            </p>
            <p>
              <strong>Pattern Editor:</strong> Each pattern can be edited as YAML/JSON directly for advanced configurations.
            </p>
            <p>
              <strong>Automatic Trimming:</strong> All values are automatically trimmed of whitespace before saving.
            </p>
            <p>
              <strong>CSV Headers:</strong> Headers are trimmed and converted to lowercase for matching.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatternManager;
