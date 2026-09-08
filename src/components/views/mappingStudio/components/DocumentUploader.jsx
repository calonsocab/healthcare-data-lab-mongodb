
// src/components/views/mappingStudio/components/DocumentUploader.jsx
'use client';

import React, { useState, useCallback } from 'react';
import JSZip from 'jszip';
import { validateFileBasics } from '@/lib/uploads/validation';
import {
  Upload, 
  FileText, 
  FileCode, 
  X, 
  AlertCircle,
  CheckCircle,
  Archive,
  Folder,
  Loader2,
  ChevronDown,
  ChevronRight,
  Eye,
  Trash2,
  Table,
  Grid3X3,
  Download,
  FileSearch,
  Filter
} from 'lucide-react';

const DocumentUploader = ({ 
  onUpload, 
  uploadedDocuments = [], 
  onRemoveDocument,
  onPreviewDocument,
  onLoadDemo,
  loadingDemo = false,
  demoScenarios = [],
  onLoadDemoScenario,
  onPreviewDemoAsset
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [selectedView, setSelectedView] = useState('table'); // Changed default to 'table'
  const [sortConfig, setSortConfig] = useState({ key: 'fileName', direction: 'asc' });
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState(new Set());

  // Supported file types
  const SUPPORTED_TYPES = {
    '.xml': { icon: FileCode, color: 'text-orange-400', label: 'XML/CDA' },
    '.cda': { icon: FileCode, color: 'text-orange-400', label: 'CDA' },
    '.csv': { icon: FileText, color: 'text-green-400', label: 'CSV' },
    '.json': { icon: FileCode, color: 'text-blue-400', label: 'JSON' },
    '.txt': { icon: FileText, color: 'text-slate-400', label: 'Text' },
    '.hl7': { icon: FileCode, color: 'text-purple-400', label: 'HL7v2' },
    '.zip': { icon: Archive, color: 'text-yellow-400', label: 'ZIP Archive' }
  };
  const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100MB
  const DOC_MIME_TYPES = [
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

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const handleFileInput = (e) => {
    const files = Array.from(e.target.files);
    processFiles(files);
  };

  const processFiles = async (files) => {
    const validFiles = [];
    const errors = [];

    for (const file of files) {
      const extension = '.' + file.name.split('.').pop().toLowerCase();
      
      if (extension === '.zip') {
        const zipError = validateFileBasics(file, {
          allowedExtensions: ['.zip'],
          allowedMimeTypes: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
          maxBytes: MAX_FILE_BYTES,
          allowMissingType: true
        });
        if (zipError) {
          errors.push(`${file.name} - ${zipError}`);
          continue;
        }
        try {
          await processZipFile(file);
        } catch (err) {
          errors.push(`${file.name} - Error processing ZIP: ${err.message}`);
        }
      } else if (SUPPORTED_TYPES[extension]) {
        const error = validateFileBasics(file, {
          allowedExtensions: [extension],
          allowedMimeTypes: DOC_MIME_TYPES,
          maxBytes: MAX_FILE_BYTES,
          allowMissingType: true
        });
        if (error) {
          errors.push(`${file.name} - ${error}`);
          continue;
        }
        const exists = uploadedDocuments.some(doc => 
          doc.fileName === file.name && doc.file.size === file.size
        );
        
        if (!exists) {
          validFiles.push(file);
        } else {
          errors.push(`${file.name} is already uploaded`);
        }
      } else {
        errors.push(`${file.name} - Unsupported file type`);
      }
    }

    if (errors.length > 0) {
      setError(errors.join(', '));
    }

    if (validFiles.length > 0) {
      onUpload(validFiles);
    }
  };

  const processZipFile = async (zipFile) => {
    const zip = await JSZip.loadAsync(zipFile);
    const files = [];
    
    for (const [path, zipEntry] of Object.entries(zip.files)) {
      if (!zipEntry.dir) {
        const content = await zipEntry.async('blob');
        const file = new File([content], path, {
          type: 'application/octet-stream'
        });
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        if (!SUPPORTED_TYPES[extension] || extension === '.zip') continue;
        const error = validateFileBasics(file, {
          allowedExtensions: [extension],
          allowedMimeTypes: DOC_MIME_TYPES,
          maxBytes: MAX_FILE_BYTES,
          allowMissingType: true
        });
        if (!error) files.push(file);
      }
    }
    
    onUpload(files);
  };

  const getFileInfo = (fileName) => {
    const extension = '.' + fileName.split('.').pop().toLowerCase();
    return SUPPORTED_TYPES[extension] || {
      icon: FileText,
      color: 'text-slate-400',
      label: 'Unknown'
    };
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Sorting function
  const sortDocuments = (docs) => {
    const sorted = [...docs].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];
      
      if (sortConfig.key === 'file.size') {
        aValue = a.file.size;
        bValue = b.file.size;
      }
      
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  };

  // Filtering function
  const filterDocuments = (docs) => {
    let filtered = docs;
    
    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter(doc => doc.type === filterType);
    }
    
    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(doc => 
        doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.type?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const toggleDocumentSelection = (docId) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const selectAllDocuments = () => {
    const filteredDocs = filterDocuments(uploadedDocuments);
    if (selectedDocuments.size === filteredDocs.length) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(filteredDocs.map(doc => doc.id)));
    }
  };

  const removeSelectedDocuments = () => {
    selectedDocuments.forEach(docId => onRemoveDocument(docId));
    setSelectedDocuments(new Set());
  };

  const downloadSelectedDocuments = () => {
    // Implementation for downloading selected documents
    alert(`Download ${selectedDocuments.size} documents - Feature coming soon`);
  };

  // Get unique document types for filter
  const documentTypes = [...new Set(uploadedDocuments.map(doc => doc.type).filter(Boolean))];
  
  // Apply filters and sorting
  const processedDocuments = sortDocuments(filterDocuments(uploadedDocuments));

  // Group documents by type
  const groupedDocuments = uploadedDocuments.reduce((acc, doc) => {
    const type = doc.type || 'unknown';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(doc);
    return acc;
  }, {});

  const toggleFolder = (folderId) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div 
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive 
            ? "border-blue-400 bg-blue-950/20" 
            : "border-slate-600 hover:border-slate-500"
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          multiple
          accept=".xml,.cda,.csv,.json,.txt,.hl7,.zip"
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
        />
        
        <label 
          htmlFor="file-upload" 
          className="cursor-pointer flex flex-col items-center"
        >
          <Upload className="w-12 h-12 text-slate-400 mb-4" />
          <p className="text-lg font-medium text-slate-300 mb-2">
            Drop files or folders here, or click to browse
          </p>
          <p className="text-sm text-slate-400">
            Supports: XML/CDA, CSV, JSON, TXT, HL7v2, ZIP archives
          </p>
        </label>
      </div>

      {demoScenarios.length > 0 && (
        <div className="border border-emerald-700/40 bg-emerald-950/20 rounded-lg p-4 space-y-4">
          <div className="flex flex-wrap gap-3 justify-between items-start">
            <div>
              <h3 className="text-sm font-semibold text-emerald-200">Guided Demo Journey</h3>
              <p className="text-xs text-emerald-100/90 mt-1">
                Compare two full-size documents: one patient-scoped CDA and one multi-patient CSV dataset.
              </p>
            </div>
            {onLoadDemo && (
              <button
                type="button"
                onClick={onLoadDemo}
                disabled={loadingDemo}
                className="px-3 py-2 bg-emerald-600 text-emerald-950 rounded-md text-sm hover:bg-emerald-500 disabled:opacity-60 flex items-center gap-2"
              >
                {loadingDemo ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Load Both Sources
              </button>
            )}
          </div>

          <div className="text-xs text-emerald-100/90 space-y-1">
            <p>1. Open source/mapping/OPT files to inspect the full structure.</p>
            <p>2. Load one source or both sources.</p>
            <p>3. Continue to Identify → Map → Transform with real examples.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {demoScenarios.map((scenario) => (
              <div key={scenario.id} className="rounded-lg border border-emerald-800/40 bg-slate-900/50 p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-medium text-slate-100">{scenario.title}</h4>
                    <p className="text-xs text-emerald-100/80 mt-1">{scenario.scope}</p>
                  </div>
                  {scenario.badge && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-700/30 text-emerald-100 border border-emerald-700/40">
                      {scenario.badge}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-300">{scenario.description}</p>

                <div className="flex flex-wrap gap-2">
                  {scenario.source && (
                    <button
                      type="button"
                      onClick={() => onPreviewDemoAsset && onPreviewDemoAsset(scenario.source)}
                      className="px-2.5 py-1.5 rounded border border-slate-600 text-slate-200 text-xs hover:bg-slate-700 flex items-center gap-1"
                    >
                      <Eye size={12} />
                      Source
                    </button>
                  )}
                  {Array.isArray(scenario.mappingAssets) && scenario.mappingAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => onPreviewDemoAsset && onPreviewDemoAsset(asset)}
                      className="px-2.5 py-1.5 rounded border border-slate-600 text-slate-200 text-xs hover:bg-slate-700 flex items-center gap-1"
                    >
                      <Eye size={12} />
                      {asset.label || 'Mapping'}
                    </button>
                  ))}
                  {scenario.optAsset && (
                    <button
                      type="button"
                      onClick={() => onPreviewDemoAsset && onPreviewDemoAsset(scenario.optAsset)}
                      className="px-2.5 py-1.5 rounded border border-slate-600 text-slate-200 text-xs hover:bg-slate-700 flex items-center gap-1"
                    >
                      <Eye size={12} />
                      OPT
                    </button>
                  )}
                </div>

                {onLoadDemoScenario && (
                  <button
                    type="button"
                    onClick={() => onLoadDemoScenario(scenario.id)}
                    disabled={loadingDemo}
                    className="w-full px-3 py-2 rounded bg-slate-700 text-slate-100 text-sm hover:bg-slate-600 disabled:opacity-60"
                  >
                    Load Source Only
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="text-red-400 mt-0.5" size={16} />
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Uploaded Documents */}
      {uploadedDocuments.length > 0 && (
        <div className="space-y-4">
          {/* Header with Controls */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            <h3 className="text-lg font-medium text-slate-200">
              Uploaded Documents ({uploadedDocuments.length})
            </h3>
            
            <div className="flex flex-wrap gap-2">
              {/* Search */}
              <div className="relative">
                <FileSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-slate-300 placeholder-slate-500"
                />
              </div>

              {/* Type Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-slate-300"
              >
                <option value="all">All Types</option>
                {documentTypes.map(type => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>

              {/* View Toggle */}
              <div className="flex gap-1 bg-slate-700 rounded p-1">
                <button
                  onClick={() => setSelectedView('table')}
                  className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${
                    selectedView === 'table'
                      ? "bg-primary text-primary-text"
                      : "text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  <Table size={14} />
                  Table
                </button>
                <button
                  onClick={() => setSelectedView('grid')}
                  className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${
                    selectedView === 'grid'
                      ? "bg-primary text-primary-text"
                      : "text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  <Grid3X3 size={14} />
                  Grid
                </button>
                <button
                  onClick={() => setSelectedView('list')}
                  className={`px-3 py-1 rounded text-sm flex items-center gap-1 ${
                    selectedView === 'list'
                      ? "bg-primary text-primary-text"
                      : "text-slate-300 hover:bg-slate-600"
                  }`}
                >
                  <Folder size={14} />
                  Grouped
                </button>
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedDocuments.size > 0 && (
            <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-blue-300">
                {selectedDocuments.size} document{selectedDocuments.size > 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={downloadSelectedDocuments}
                  className="px-3 py-1 bg-primary text-primary-text rounded text-sm hover:bg-primary-hover flex items-center gap-1"
                >
                  <Download size={14} />
                  Download
                </button>
                <button
                  onClick={removeSelectedDocuments}
                  className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 flex items-center gap-1"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
            </div>
          )}
          
          {/* Table View */}
          {selectedView === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-600">
                    <th className="text-left p-3">
                      <input
                        type="checkbox"
                        checked={selectedDocuments.size === processedDocuments.length && processedDocuments.length > 0}
                        onChange={selectAllDocuments}
                        className="rounded border-slate-600 bg-slate-700"
                      />
                    </th>
                    <th 
                      className="text-left p-3 text-slate-300 font-medium cursor-pointer hover:text-slate-100"
                      onClick={() => handleSort('fileName')}
                    >
                      <div className="flex items-center gap-1">
                        File Name
                        {sortConfig.key === 'fileName' && (
                          <span className="text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="text-left p-3 text-slate-300 font-medium cursor-pointer hover:text-slate-100"
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center gap-1">
                        Type
                        {sortConfig.key === 'type' && (
                          <span className="text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th 
                      className="text-left p-3 text-slate-300 font-medium cursor-pointer hover:text-slate-100"
                      onClick={() => handleSort('file.size')}
                    >
                      <div className="flex items-center gap-1">
                        Size
                        {sortConfig.key === 'file.size' && (
                          <span className="text-xs">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="text-left p-3 text-slate-300 font-medium">Status</th>
                    <th className="text-left p-3 text-slate-300 font-medium">Uploaded</th>
                    <th className="text-right p-3 text-slate-300 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {processedDocuments.map(doc => {
                    const fileInfo = getFileInfo(doc.fileName);
                    const IconComponent = fileInfo.icon;
                    
                    return (
                      <tr 
                        key={doc.id}
                        className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors"
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selectedDocuments.has(doc.id)}
                            onChange={() => toggleDocumentSelection(doc.id)}
                            className="rounded border-slate-600 bg-slate-700"
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <IconComponent className={fileInfo.color} size={18} />
                            <span className="text-slate-200 text-sm">{doc.fileName}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">
                            {doc.type?.replace(/_/g, ' ') || fileInfo.label}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-slate-400">
                          {formatFileSize(doc.file.size)}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            {doc.status === 'uploaded' ? (
                              <>
                                <CheckCircle size={14} className="text-green-400" />
                                <span className="text-xs text-green-400">Ready</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle size={14} className="text-yellow-400" />
                                <span className="text-xs text-yellow-400">Processing</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-sm text-slate-400">
                          {formatDate(doc.uploadedAt || new Date())}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => onPreviewDocument && onPreviewDocument(doc)}
                              className="p-1 hover:bg-slate-600 rounded transition-colors"
                              title="Preview"
                            >
                              <Eye size={16} className="text-slate-400" />
                            </button>
                            <button
                              onClick={() => onRemoveDocument(doc.id)}
                              className="p-1 hover:bg-slate-600 rounded transition-colors"
                              title="Remove"
                            >
                              <Trash2 size={16} className="text-slate-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {processedDocuments.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No documents match your filters
                </div>
              )}
            </div>
          )}
          
          {/* Grid View */}
          {selectedView === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {processedDocuments.map(doc => {
                const fileInfo = getFileInfo(doc.fileName);
                const IconComponent = fileInfo.icon;
                
                return (
                  <div 
                    key={doc.id}
                    className="bg-slate-700 rounded-lg p-4 hover:bg-slate-600 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <IconComponent className={fileInfo.color} size={32} />
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={selectedDocuments.has(doc.id)}
                          onChange={() => toggleDocumentSelection(doc.id)}
                          className="rounded border-slate-600 bg-slate-800"
                        />
                        <button
                          onClick={() => onRemoveDocument(doc.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-500 rounded"
                        >
                          <X size={16} className="text-slate-400" />
                        </button>
                      </div>
                    </div>
                    
                    <h4 className="text-slate-200 font-medium text-sm mb-1 truncate">
                      {doc.fileName}
                    </h4>
                    
                    <div className="text-xs text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>{fileInfo.label}</span>
                        <span>{formatFileSize(doc.file.size)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {doc.status === 'uploaded' ? (
                          <>
                            <CheckCircle size={12} className="text-green-400" />
                            Ready
                          </>
                        ) : (
                          <>
                            <AlertCircle size={12} className="text-yellow-400" />
                            Processing
                          </>
                        )}
                      </div>
                      {doc.type && doc.type !== 'unknown' && (
                        <div className="text-blue-300">
                          Type: {doc.type.replace(/_/g, ' ')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* List View - Grouped by Type */}
          {selectedView === 'list' && (
            <div className="space-y-3">
              {Object.entries(groupedDocuments).map(([type, docs]) => {
                const isExpanded = expandedFolders[type] !== false;
                
                return (
                  <div key={type} className="bg-slate-700 rounded-lg overflow-hidden">
                    <button
                      onClick={() => toggleFolder(type)}
                      className="w-full p-3 flex items-center justify-between hover:bg-slate-600 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Folder className="text-yellow-400" size={20} />
                        <span className="text-slate-200 font-medium">
                          {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                        <span className="text-slate-400 text-sm">
                          ({docs.length} files)
                        </span>
                      </div>
                      {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                    </button>
                    
                    {isExpanded && (
                      <div className="border-t border-slate-600">
                        {docs.map(doc => {
                          const fileInfo = getFileInfo(doc.fileName);
                          const IconComponent = fileInfo.icon;
                          
                          return (
                            <div 
                              key={doc.id}
                              className="px-4 py-2 flex items-center justify-between hover:bg-slate-600 transition-colors group"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <input
                                  type="checkbox"
                                  checked={selectedDocuments.has(doc.id)}
                                  onChange={() => toggleDocumentSelection(doc.id)}
                                  className="rounded border-slate-600 bg-slate-800"
                                />
                                <IconComponent className={fileInfo.color} size={20} />
                                <div className="flex-1">
                                  <p className="text-slate-200 text-sm">{doc.fileName}</p>
                                  <p className="text-xs text-slate-400">
                                    {formatFileSize(doc.file.size)}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => onPreviewDocument && onPreviewDocument(doc)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-500 rounded"
                                  title="Preview"
                                >
                                  <Eye size={16} className="text-slate-400" />
                                </button>
                                <button
                                  onClick={() => onRemoveDocument(doc.id)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-500 rounded"
                                  title="Remove"
                                >
                                  <Trash2 size={16} className="text-slate-400" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-surface-muted rounded-lg p-4 border border-theme">
        <h4 className="text-sm font-medium text-theme-primary mb-2">Tips:</h4>
        <ul className="text-sm text-theme-secondary space-y-1">
          <li>• Upload multiple documents of the same type for batch processing</li>
          <li>• ZIP files will be extracted and all valid files will be processed</li>
          <li>• The system will automatically identify document types and group them</li>
          <li>• Supported formats: XML/CDA, CSV, JSON, HL7v2, and plain text</li>
          <li>• Use the table view to manage large numbers of documents efficiently</li>
        </ul>
      </div>
    </div>
  );
};

export default DocumentUploader;
