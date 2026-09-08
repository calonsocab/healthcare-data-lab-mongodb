// src/components/views/mappingStudio/components/DocumentPreviewModal.jsx
'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, Copy, FileCode, Check } from 'lucide-react';

const DocumentPreviewModal = ({ document, isOpen, onClose }) => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [displayMode, setDisplayMode] = useState('formatted'); // 'formatted' or 'raw'
  const [wrapLines, setWrapLines] = useState(false);

  useEffect(() => {
    if (isOpen && document) {
      loadDocumentContent();
      setWrapLines(false);
    }
  }, [isOpen, document]);

  const loadDocumentContent = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        setContent(e.target.result);
        setLoading(false);
      };
      
      reader.onerror = () => {
        setError('Failed to read file');
        setLoading(false);
      };
      
      reader.readAsText(document.file);
    } catch (err) {
      setError('Error loading document');
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = document.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatContent = (text) => {
    const fileType = document.fileName.split('.').pop().toLowerCase();
    
    if (fileType === 'json') {
      try {
        return JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        return text;
      }
    }
    
    if (fileType === 'xml' || fileType === 'cda') {
      // Lightweight XML indentation for readability in the full-document preview.
      const normalized = text.replace(/>\s*</g, '><').replace(/></g, '>\n<');
      const lines = normalized.split('\n');
      let depth = 0;
      return lines
        .map((line) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('</')) {
            depth = Math.max(depth - 1, 0);
          }
          const padded = `${'  '.repeat(depth)}${trimmed}`;
          const opens = /^<[^!?/][^>]*[^/]?>$/.test(trimmed);
          if (opens && !trimmed.includes('</')) {
            depth += 1;
          }
          return padded;
        })
        .join('\n');
    }
    
    return text;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative surface rounded-lg shadow-xl max-w-6xl w-full max-h-[88vh] flex flex-col border border-theme">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-theme">
          <div className="flex items-center gap-3">
            <FileCode className="text-primary" size={20} />
            <h3 className="text-lg font-medium text-theme-primary">
              {document?.fileName || 'Document Preview'}
            </h3>
            {document?.type && (
              <span className="text-xs surface px-2 py-1 rounded text-theme-secondary">
                {document.type.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Display Mode Toggle */}
            <div className="flex gap-1 surface rounded p-1">
              <button
                onClick={() => setDisplayMode('formatted')}
                className={`px-2 py-1 rounded text-xs ${
                  displayMode === 'formatted' 
                    ? "bg-primary text-primary-text" 
                    : "text-theme-primary hover:surface-hover"
                }`}
              >
                Formatted
              </button>
              <button
                onClick={() => setDisplayMode('raw')}
                className={`px-2 py-1 rounded text-xs ${
                  displayMode === 'raw' 
                    ? "bg-primary text-primary-text" 
                    : "text-theme-primary hover:surface-hover"
                }`}
              >
                Raw
              </button>
              <button
                onClick={() => setWrapLines(prev => !prev)}
                className={`px-2 py-1 rounded text-xs ${
                  wrapLines
                    ? "bg-primary text-primary-text"
                    : "text-theme-primary hover:surface-hover"
                }`}
              >
                Wrap
              </button>
            </div>
            
            <button
              onClick={handleCopy}
              className="p-2 hover:surface-hover rounded transition-colors"
              title="Copy content"
            >
              {copied ? (
                <Check className="text-success" size={18} />
              ) : (
                <Copy className="text-theme-secondary" size={18} />
              )}
            </button>
            
            <button
              onClick={handleDownload}
              className="p-2 hover:surface-hover rounded transition-colors"
              title="Download"
            >
              <Download className="text-theme-secondary" size={18} />
            </button>
            
            <button
              onClick={onClose}
              className="p-2 hover:surface-hover rounded transition-colors"
            >
              <X className="text-theme-secondary" size={18} />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-theme-secondary">Loading...</div>
            </div>
          )}
          
          {error && (
            <div className="flex items-center justify-center h-64">
              <div className="text-error">{error}</div>
            </div>
          )}
          
          {!loading && !error && content && (
            <pre className={`text-sm text-theme-primary font-mono ${wrapLines ? 'whitespace-pre-wrap' : 'whitespace-pre'}`}>
              <code>
                {displayMode === 'formatted' ? formatContent(content) : content}
              </code>
            </pre>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-theme flex justify-between items-center">
          <div className="text-xs text-theme-secondary">
            {document?.file && `Size: ${(document.file.size / 1024).toFixed(2)} KB`}
            {content && ` • Lines: ${content.split('\n').length}`}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 btn-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DocumentPreviewModal;
