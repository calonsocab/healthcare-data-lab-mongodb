// src/components/views/catalog/DataModelUpload.jsx
"use client";

import React, { useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Upload,
  X,
  FileJson,
  FileCode,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { DomainIcon, DOMAIN_CONFIG } from './DomainTabs';
import { cn } from '@/lib/utils';
import { validateFileBasics } from '@/lib/uploads/validation';

/**
 * Supported file types
 */
const ACCEPTED_TYPES = {
  'application/json': ['.json'],
  'application/xml': ['.xml', '.opt'],
  'text/xml': ['.xml', '.opt'],
};

const ACCEPTED_EXTENSIONS = ['.json', '.xml', '.opt'];
const MODEL_FILE_MAX_BYTES = 10 * 1024 * 1024; // 10MB
const JSON_MIME_TYPES = [
  'application/json',
  'text/json',
  'application/x-ndjson',
  'application/jsonl',
  'text/plain'
];
const XML_MIME_TYPES = [
  'application/xml',
  'text/xml',
  'application/x-xml',
  'application/octet-stream'
];

/**
 * FilePreview - Shows preview of selected file
 */
const FilePreview = ({ file, detection, onRemove, status }) => {
  const statusConfig = {
    pending: { icon: Loader2, color: 'text-theme-secondary', animate: true },
    success: { icon: Check, color: 'text-success', animate: false },
    error: { icon: AlertCircle, color: 'text-error', animate: false },
  };

  const { icon: StatusIcon, color, animate } = statusConfig[status] || statusConfig.pending;

  return (
    <div className="flex items-center gap-3 p-3 bg-surface rounded-lg border border-theme">
      {/* File icon */}
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-surface-hover">
        {detection?.domain ? (
          <DomainIcon domain={detection.domain} size={24} />
        ) : file.name.endsWith('.xml') || file.name.endsWith('.opt') ? (
          <FileCode size={24} className="text-theme-secondary" />
        ) : (
          <FileJson size={24} className="text-theme-secondary" />
        )}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-theme-primary truncate">{file.name}</p>
        <div className="flex items-center gap-2 text-xs text-theme-secondary">
          <span>{(file.size / 1024).toFixed(1)} KB</span>
          {detection?.domain && (
            <>
              <span className="text-theme-tertiary">|</span>
              <span
                style={{ color: DOMAIN_CONFIG[detection.domain]?.color }}
              >
                {DOMAIN_CONFIG[detection.domain]?.name || detection.domain}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Status indicator */}
      <StatusIcon
        size={20}
        className={cn(color, animate && 'animate-spin')}
      />

      {/* Remove button */}
      {onRemove && (
        <button
          onClick={onRemove}
          className="p-1 text-theme-secondary hover:text-error transition-colors"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};

/**
 * DataModelUpload - Smart upload component with auto-detection
 */
const DataModelUpload = ({
  onUpload,
  onError,
  multiple = true,
  className = '',
}) => {
  const [files, setFiles] = useState([]);
  const [detections, setDetections] = useState({});
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState({});
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  /**
   * Validate file extension
   */
  const isValidFile = useCallback((file) => {
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    return ACCEPTED_EXTENSIONS.includes(ext);
  }, []);

  /**
   * Read file content
   */
  const readFileContent = useCallback(async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }, []);

  /**
   * Detect domain for a file
   */
  const detectDomain = useCallback(async (file, content) => {
    try {
      // Try to parse JSON
      let parsedContent = content;
      if (file.name.endsWith('.json')) {
        try {
          parsedContent = JSON.parse(content);
        } catch {
          // Not valid JSON
        }
      }

      const response = await fetch('/api/data-models/detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: parsedContent,
          fileName: file.name,
          parse: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Detection failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Domain detection error:', error);
      return { domain: null, error: error.message };
    }
  }, []);

  /**
   * Handle file selection
   */
  const handleFiles = useCallback(async (selectedFiles) => {
    const errors = [];
    const validFiles = Array.from(selectedFiles).filter((file) => {
      if (!isValidFile(file)) {
        errors.push(`${file.name} - Unsupported file type`);
        return false;
      }
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      const allowedMimeTypes = ext === '.json' ? JSON_MIME_TYPES : XML_MIME_TYPES;
      const error = validateFileBasics(file, {
        allowedExtensions: [ext],
        allowedMimeTypes,
        maxBytes: MODEL_FILE_MAX_BYTES,
        allowMissingType: true
      });
      if (error) {
        errors.push(`${file.name} - ${error}`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) {
      onError?.(errors.length ? errors.join('. ') : 'No valid files selected. Supported: .json, .xml, .opt');
      return;
    }
    if (errors.length) {
      onError?.(errors.join('. '));
    }

    if (!multiple && validFiles.length > 1) {
      validFiles.length = 1;
    }

    setFiles(validFiles);
    setUploadStatus({});

    // Detect domains for each file
    const newDetections = {};
    for (const file of validFiles) {
      try {
        const content = await readFileContent(file);
        const detection = await detectDomain(file, content);
        newDetections[file.name] = {
          ...detection,
          content,
        };
      } catch (error) {
        newDetections[file.name] = { error: error.message };
      }
    }
    setDetections(newDetections);
  }, [isValidFile, multiple, readFileContent, detectDomain, onError]);

  /**
   * Handle drag events
   */
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  /**
   * Handle drop
   */
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.length) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  /**
   * Handle file input change
   */
  const handleInputChange = useCallback((e) => {
    if (e.target.files?.length) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  /**
   * Remove a file
   */
  const removeFile = useCallback((fileName) => {
    setFiles((prev) => prev.filter((f) => f.name !== fileName));
    setDetections((prev) => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
    setUploadStatus((prev) => {
      const next = { ...prev };
      delete next[fileName];
      return next;
    });
  }, []);

  /**
   * Upload all files
   */
  const handleUpload = useCallback(async () => {
    if (files.length === 0) return;

    setUploading(true);
    const results = [];

    for (const file of files) {
      const detection = detections[file.name];

      if (!detection || !detection.domain) {
        setUploadStatus((prev) => ({ ...prev, [file.name]: 'error' }));
        results.push({
          file: file.name,
          success: false,
          error: 'Could not detect domain',
        });
        continue;
      }

      setUploadStatus((prev) => ({ ...prev, [file.name]: 'pending' }));

      try {
        // Parse content if needed
        let content = detection.content;
        if (file.name.endsWith('.json') && typeof content === 'string') {
          content = JSON.parse(content);
        }

        const response = await fetch('/api/data-models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content,
            fileName: file.name,
            domain: detection.domain,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Upload failed');
        }

        const result = await response.json();
        setUploadStatus((prev) => ({ ...prev, [file.name]: 'success' }));
        results.push({
          file: file.name,
          success: true,
          id: result.id,
          domain: detection.domain,
        });
      } catch (error) {
        setUploadStatus((prev) => ({ ...prev, [file.name]: 'error' }));
        results.push({
          file: file.name,
          success: false,
          error: error.message,
        });
      }
    }

    setUploading(false);
    onUpload?.(results);

    // Clear successful uploads after a delay
    setTimeout(() => {
      const successFiles = results.filter((r) => r.success).map((r) => r.file);
      setFiles((prev) => prev.filter((f) => !successFiles.includes(f.name)));
      setDetections((prev) => {
        const next = { ...prev };
        successFiles.forEach((name) => delete next[name]);
        return next;
      });
      setUploadStatus((prev) => {
        const next = { ...prev };
        successFiles.forEach((name) => delete next[name]);
        return next;
      });
    }, 2000);
  }, [files, detections, onUpload]);

  /**
   * Open file dialog
   */
  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
        className={cn(
          'relative p-6 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200',
          dragActive
            ? 'border-primary bg-primary/10'
            : 'border-theme hover:border-primary/50 hover:bg-surface-hover'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={handleInputChange}
          className="hidden"
        />

        <div className="flex flex-col items-center gap-2 text-center">
          <Upload
            size={32}
            className={cn(
              'transition-colors',
              dragActive ? 'text-primary' : 'text-theme-secondary'
            )}
          />
          <p className="font-medium text-theme-primary">
            {dragActive ? 'Drop files here' : 'Drop files here or click to browse'}
          </p>
          <p className="text-sm text-theme-secondary">
            Supports: .json, .xml, .opt | Auto-detects domain
          </p>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <FilePreview
              key={file.name}
              file={file}
              detection={detections[file.name]}
              status={uploadStatus[file.name]}
              onRemove={() => removeFile(file.name)}
            />
          ))}

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="w-full px-4 py-2 rounded-lg bg-primary text-primary-text flex items-center justify-center gap-2 hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload {files.length} file{files.length !== 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

DataModelUpload.propTypes = {
  onUpload: PropTypes.func,
  onError: PropTypes.func,
  multiple: PropTypes.bool,
  className: PropTypes.string,
};

FilePreview.propTypes = {
  file: PropTypes.object.isRequired,
  detection: PropTypes.object,
  onRemove: PropTypes.func,
  status: PropTypes.oneOf(['pending', 'success', 'error']),
};

export { DataModelUpload, FilePreview };
export default DataModelUpload;
