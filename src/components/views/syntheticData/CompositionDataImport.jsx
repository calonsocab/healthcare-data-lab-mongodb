// src/components/views/syntheticData/CompositionDataImport.jsx
"use client";

import React, { useState, useCallback } from 'react';
import { Upload, FileText, AlertTriangle, Check, RefreshCw, X, HelpCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ImportDocumentation from './ImportDocumentation';
import { validateFileBasics } from '@/lib/uploads/validation';

const CompositionDataImport = ({ onDataImported }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [showDocumentation, setShowDocumentation] = useState(true);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  
  const ALLOWED_EXTENSIONS = ['.json', '.jsonl'];
  const ALLOWED_MIME_TYPES = [
    'application/json',
    'application/x-ndjson',
    'application/jsonl',
    'text/plain'
  ];
  const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100MB

  // Handle file drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // Handle multiple files
      const newFiles = Array.from(files).filter(file => {
        const error = validateFileBasics(file, {
          allowedExtensions: ALLOWED_EXTENSIONS,
          allowedMimeTypes: ALLOWED_MIME_TYPES,
          maxBytes: MAX_FILE_BYTES,
          allowMissingType: true
        });
        if (error) {
          setError(error);
          return false;
        }
        return true;
      });
      
      setUploadedFiles(prevFiles => [...prevFiles, ...newFiles]);
    }
  }, []);
  
  // Handle file selection
  const handleFilesSelected = (fileList) => {
    // Check file types and sizes
    const newFiles = Array.from(fileList).filter(file => {
      const error = validateFileBasics(file, {
        allowedExtensions: ALLOWED_EXTENSIONS,
        allowedMimeTypes: ALLOWED_MIME_TYPES,
        maxBytes: MAX_FILE_BYTES,
        allowMissingType: true
      });
      if (error) {
        setError(error);
        return false;
      }
      return true;
    });
    
    setUploadedFiles(prevFiles => [...prevFiles, ...newFiles]);
    setError(null);
  };
  
  // Remove a file from the list
  const removeFile = (index) => {
    const newFiles = [...uploadedFiles];
    newFiles.splice(index, 1);
    setUploadedFiles(newFiles);
  };
  
  // Upload files to server one by one
  const handleUpload = async () => {
    if (uploadedFiles.length === 0) return;
    
    try {
      setUploading(true);
      setError(null);
      setCurrentUploadIndex(0);
      
      // Combined summary data
      const combinedSummary = {
        compositionCount: 0,
        patientCount: 0,
        templateCount: 0,
        archetypeCount: 0,
        importIds: []
      };
      
      // Upload files sequentially
      for (let i = 0; i < uploadedFiles.length; i++) {
        setCurrentUploadIndex(i);
        setOverallProgress(Math.round((i / uploadedFiles.length) * 100));
        
        const file = uploadedFiles[i];
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/synthetic-data/import', {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Failed to upload ${file.name}: ${errorData.error || 'Unknown error'}`);
        }
        
        const result = await response.json();
        
        // Aggregate results
        combinedSummary.compositionCount += result.summary.compositionCount;
        combinedSummary.patientCount += result.summary.patientCount;
        combinedSummary.templateCount += result.summary.templateCount || 0;
        combinedSummary.archetypeCount += result.summary.archetypeCount || 0;
        combinedSummary.importIds.push(result.importId);
      }
      
      setOverallProgress(100);
      
      // Save summary data
      setSummary(combinedSummary);
      
      // Hide documentation on successful upload
      setShowDocumentation(false);
      
      // Notify parent component with combined results
      if (onDataImported) {
        onDataImported({
          summary: combinedSummary,
          importIds: combinedSummary.importIds,
          importDate: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.message || 'Failed to upload files');
    } finally {
      setUploading(false);
    }
  };
  
  // Reset the import
  const handleReset = () => {
    setUploadedFiles([]);
    setError(null);
    setSummary(null);
    setShowDocumentation(true);
    setCurrentUploadIndex(0);
    setOverallProgress(0);
  };
  
  // Toggle documentation visibility
  const toggleDocumentation = () => {
    setShowDocumentation(!showDocumentation);
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-slate-200 flex items-center">
          <Upload size={20} className="mr-2" />
          Import Composition Data
        </h3>
        
        {/* Documentation toggle button */}
        <button 
          onClick={toggleDocumentation}
          className="flex items-center px-3 py-1 bg-slate-700 rounded-md text-sm text-slate-300 hover:bg-slate-600"
        >
          <HelpCircle size={16} className="mr-1" />
          {showDocumentation ? 'Hide Documentation' : 'Show Documentation'}
        </button>
      </div>
      
      {/* Documentation section */}
      {showDocumentation && (
        <ImportDocumentation />
      )}
      
      {/* Error message */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 p-3 rounded-md text-red-300 flex items-start">
          <AlertTriangle size={18} className="mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Upload Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}
      
      {/* Import success summary */}
      {summary && (
        <div className="bg-green-900/30 border border-green-800 p-3 rounded-md text-green-300">
          <div className="flex items-center mb-2">
            <Check size={18} className="mr-2" />
            <p className="font-medium">Import Successful</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div>
              <p className="text-xs text-green-400">Compositions</p>
              <p className="text-lg font-medium">{summary.compositionCount}</p>
            </div>
            <div>
              <p className="text-xs text-green-400">Patients</p>
              <p className="text-lg font-medium">{summary.patientCount}</p>
            </div>
            <div>
              <p className="text-xs text-green-400">Templates</p>
              <p className="text-lg font-medium">{summary.templateCount}</p>
            </div>
            <div>
              <p className="text-xs text-green-400">Archetypes</p>
              <p className="text-lg font-medium">{summary.archetypeCount}</p>
            </div>
          </div>
          
          <button
            onClick={handleReset}
            className="mt-3 px-3 py-1 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 text-sm flex items-center"
          >
            <RefreshCw size={14} className="mr-1" />
            Upload More Files
          </button>
        </div>
      )}
      
      {/* Drop zone */}
      {!summary && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-md p-6 flex flex-col items-center justify-center transition-colors",
            isDragging
              ? "border-blue-500 bg-blue-900/20"
              : "border-slate-600 hover:border-slate-500 bg-slate-800/50"
          )}
        >
          {uploadedFiles.length > 0 ? (
            <div className="w-full">
              <div className="mb-3">
                <p className="text-slate-300 font-medium">{uploadedFiles.length} files selected:</p>
              </div>
              
              <div className="max-h-48 overflow-y-auto mb-4 bg-slate-900/50 rounded-md">
                {uploadedFiles.map((file, index) => (
                  <div 
                    key={index} 
                    className="flex items-center px-3 py-2 border-b border-slate-700 last:border-0"
                  >
                    <FileText size={18} className="text-blue-400 mr-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 truncate">{file.name}</p>
                      <p className="text-xs text-slate-400">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                    {uploading && currentUploadIndex === index ? (
                      <RefreshCw size={16} className="text-blue-400 animate-spin ml-2 flex-shrink-0" />
                    ) : (
                      <button
                        onClick={() => removeFile(index)}
                        className="text-slate-400 hover:text-red-400 ml-2 flex-shrink-0"
                        disabled={uploading}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {uploading && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Progress: {overallProgress}%</span>
                    <span>File {currentUploadIndex + 1} of {uploadedFiles.length}</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${overallProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className={cn(
                    "flex-1 py-2 rounded-md flex items-center justify-center",
                    uploading
                      ? "bg-primary/50 text-primary-text cursor-not-allowed"
                      : "bg-primary text-primary-text hover:bg-primary-hover"
                  )}
                >
                  {uploading ? (
                    <>
                      <RefreshCw size={18} className="mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload size={18} className="mr-2" />
                      Upload {uploadedFiles.length} Files
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleReset}
                  disabled={uploading}
                  className="px-4 py-2 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 disabled:opacity-50"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="mt-3 text-center">
                <label className="px-4 py-2 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 cursor-pointer inline-block">
                  <span>Add More Files</span>
                  <input
                    type="file"
                    accept=".json,.jsonl"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFilesSelected(e.target.files);
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          ) : (
            <>
              <FileText size={36} className="text-slate-500 mb-2" />
              <p className="text-slate-300 mb-1">Drag and drop JSON files here</p>
              <p className="text-slate-400 text-sm">or</p>
              <label className="mt-2 px-4 py-2 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 cursor-pointer">
                <span>Browse Files</span>
                <input
                  type="file"
                  accept=".json,.jsonl"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFilesSelected(e.target.files);
                    }
                  }}
                />
              </label>
              <p className="text-xs text-slate-500 mt-3">Max file size: 100MB per file</p>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CompositionDataImport;
