// src/app/components/views/syntheticData/GenerationProgressPanel.jsx
"use client";

import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { StopCircle, Database, Clock, FileText, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

const GenerationProgressPanel = ({
  progress,
  generationStats,
  phase = 'processing',
  currentBatch = 1,
  totalBatches = 1,
  processedPatients = 0,
  totalPatients = 0,
  onCancel,
  environment = null,
  strategy = null,
  targetCollections = null
}) => {
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(null);
  
  // Ensure progress is a number to prevent errors
  const safeProgress = typeof progress === 'number' ? progress : 0;
  
  // Start a timer when generation begins
  useEffect(() => {
    let timer;
    timer = setInterval(() => {
      setTimeElapsed(prev => prev + 1);
    }, 1000);
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);
  
  // Calculate estimated time remaining
  useEffect(() => {
    if (safeProgress > 0 && timeElapsed > 0) {
      const timePerPercent = timeElapsed / safeProgress;
      const remaining = Math.round(timePerPercent * (100 - safeProgress));
      setEstimatedTimeRemaining(remaining);
    }
  }, [safeProgress, timeElapsed]);
  
  // Format time display (seconds to MM:SS or HH:MM:SS)
  const formatTime = (seconds) => {
    if (seconds === null || isNaN(seconds)) return '--:--';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Format size to human-readable format
  const formatSize = (sizeInMB) => {
    if (sizeInMB < 1) return `${(sizeInMB * 1000).toFixed(0)} KB`;
    if (sizeInMB < 1000) return `${sizeInMB.toFixed(1)} MB`;
    return `${(sizeInMB / 1024).toFixed(2)} GB`;
  };
  
  // Generate status message based on phase
  const getStatusMessage = () => {
    switch(phase) {
      case 'initializing':
        return 'Initializing data generation...';
      case 'duplicating':
        return `Creating synthetic patients (Batch ${currentBatch} of ${totalBatches})`;
      case 'denormalizing':
        return 'Optimizing data structure for queries...';
      case 'uploading':
        return 'Saving generated data to database...';
      case 'completed':
        return 'Generation completed successfully';
      default:
        return `Processing (${processedPatients} of ${totalPatients} patients)`;
    }
  };
  
  return (
    <div className="bg-surface rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-theme-primary">Generating Synthetic Data</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-2 bg-error text-white rounded-md hover:bg-error/80 flex items-center gap-1"
          >
            <StopCircle size={16} />
            Cancel
          </button>
        </div>
      </div>

      {/* Status message */}
      <div className="mb-3 text-theme-primary">
        {getStatusMessage()}
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-theme-secondary mb-1">
          <span>Progress: {safeProgress.toFixed(1)}%</span>
          <span>Running</span>
        </div>
        <div className="w-full bg-surface-hover rounded-full h-4 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              "bg-primary"
            )}
            style={{ width: `${safeProgress}%` }}
          ></div>
        </div>
      </div>

      {/* Target location info */}
      {(environment || targetCollections) && (
        <div className="mb-6 bg-surface-hover/50 border border-theme/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-theme-primary mb-3 flex items-center">
            <Database size={16} className="mr-2 text-success" />
            Target Location
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {environment && (
              <>
                <div>
                  <span className="text-theme-secondary">Environment: </span>
                  <span className="text-theme-primary font-medium">{environment.name || environment.id}</span>
                </div>
                <div>
                  <span className="text-theme-secondary">Database: </span>
                  <span className="text-success font-mono">{environment.database}</span>
                </div>
              </>
            )}
            {strategy && (
              <div className="md:col-span-2">
                <span className="text-theme-secondary">Strategy: </span>
                <span className="text-theme-primary">{strategy.name || strategy}</span>
              </div>
            )}
            {targetCollections && (
              <div className="md:col-span-2">
                <span className="text-theme-secondary">Collections: </span>
                <span className="text-success font-mono text-xs">
                  {typeof targetCollections === 'object'
                    ? Object.values(targetCollections).filter(Boolean).join(', ')
                    : targetCollections}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface-hover p-3 rounded-md">
          <div className="flex items-center text-theme-secondary mb-1">
            <Clock size={14} className="mr-1" />
            <span className="text-xs">Time Elapsed</span>
          </div>
          <div className="text-xl font-semibold text-theme-primary">{formatTime(timeElapsed)}</div>
        </div>

        <div className="bg-surface-hover p-3 rounded-md">
          <div className="flex items-center text-theme-secondary mb-1">
            <Clock size={14} className="mr-1" />
            <span className="text-xs">Est. Time Remaining</span>
          </div>
          <div className="text-xl font-semibold text-theme-primary">{formatTime(estimatedTimeRemaining)}</div>
        </div>

        <div className="bg-surface-hover p-3 rounded-md">
          <div className="flex items-center text-theme-secondary mb-1">
            <Database size={14} className="mr-1" />
            <span className="text-xs">Patients Created</span>
          </div>
          <div className="text-xl font-semibold text-theme-primary">{generationStats.patientsCreated.toLocaleString()}</div>
        </div>

        <div className="bg-surface-hover p-3 rounded-md">
          <div className="flex items-center text-theme-secondary mb-1">
            <FileText size={14} className="mr-1" />
            <span className="text-xs">Documents Generated</span>
          </div>
          <div className="text-xl font-semibold text-theme-primary">{generationStats.totalDocuments.toLocaleString()}</div>
        </div>
      </div>

      {/* Additional stats */}
      <div className="bg-surface-hover p-4 rounded-md">
        <h4 className="text-sm font-medium text-theme-primary mb-2 flex items-center">
          <BarChart3 size={16} className="mr-2" />
          Generation Statistics
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-theme-secondary mb-1">Templates Processed</div>
            <div className="font-semibold text-theme-primary">{generationStats.templatesProcessed} / {generationStats.templatesTotal || '?'}</div>
          </div>

          <div>
            <div className="text-xs text-theme-secondary mb-1">Estimated Data Size</div>
            <div className="font-semibold text-theme-primary">{formatSize(generationStats.estimatedSize || 0)}</div>
          </div>

          <div>
            <div className="text-xs text-theme-secondary mb-1">Avg. Documents/Patient</div>
            <div className="font-semibold text-theme-primary">
              {generationStats.patientsCreated
                ? (generationStats.totalDocuments / generationStats.patientsCreated).toFixed(1)
                : '-'}
            </div>
          </div>

          <div>
            <div className="text-xs text-theme-secondary mb-1">Processing Rate</div>
            <div className="font-semibold text-theme-primary">
              {timeElapsed && generationStats.totalDocuments
                ? `${Math.round(generationStats.totalDocuments / (timeElapsed / 60))} docs/min`
                : '-'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

GenerationProgressPanel.propTypes = {
  progress: PropTypes.number.isRequired,
  phase: PropTypes.string,
  currentBatch: PropTypes.number,
  totalBatches: PropTypes.number,
  processedPatients: PropTypes.number,
  totalPatients: PropTypes.number,
  generationStats: PropTypes.shape({
    patientsCreated: PropTypes.number.isRequired,
    templatesProcessed: PropTypes.number.isRequired,
    templatesTotal: PropTypes.number,
    totalDocuments: PropTypes.number.isRequired,
    estimatedSize: PropTypes.number
  }).isRequired,
  onCancel: PropTypes.func.isRequired,
  environment: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    database: PropTypes.string
  }),
  strategy: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.shape({
      name: PropTypes.string,
      id: PropTypes.string
    })
  ]),
  targetCollections: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.object
  ])
};

export default GenerationProgressPanel;