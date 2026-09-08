// src/components/views/syntheticData/SyntheticDataInfo.jsx
"use client";

import React, { useState, useEffect } from 'react';
import { Database, Users, FileSpreadsheet, BarChart2, Info, FileText, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

const SyntheticDataInfo = ({ importData, selectedTemplates, patientCount, displayMode = 'tabs' }) => {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('selected'); // 'selected', 'dataLab', 'imported'
  
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/synthetic-data/metadata');
        if (response.ok) {
          const data = await response.json();
          setMetadata(data);
        } else {
          setError('Failed to load synthetic data information');
        }
      } catch (err) {
        setError('Error loading synthetic data information');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMetadata();
  }, []);
  
  // If no templates are selected, default to the 'dataLab' tab
  useEffect(() => {
    if (selectedTemplates?.length === 0 && activeTab === 'selected') {
      setActiveTab('dataLab');
    }
  }, [selectedTemplates, activeTab]);
  
  // Check if import data is available and enable the import tab
  useEffect(() => {
    if (importData && importData.importId && activeTab === 'selected' && (!selectedTemplates || selectedTemplates.length === 0)) {
      setActiveTab('imported');
    }
  }, [importData, activeTab, selectedTemplates]);
  
  if (loading) return <div className="text-center py-4 text-theme-primary">Loading synthetic data information...</div>;
  if (error) return <div className="text-error py-4">{error}</div>;
  if (!metadata && !importData) return <div className="text-theme-secondary py-4">No synthetic data information available</div>;
  
  // Use the filtered synthetic data summary for display
  const summary = metadata?.filteredSyntheticDataSummary;
  
  // Format import data for display if using an import
  const importSummary = importData?.summary;
  
  // Calculate distribution data for selected templates
  const calculateSelectedTemplatesData = () => {
    if (!selectedTemplates || selectedTemplates.length === 0 || !metadata || !metadata.templates) {
      return [];
    }
    
    return selectedTemplates.map(template => {
      const templateData = Object.entries(metadata.templates)
        .find(([id, data]) => id === template.id || data.name === template.name);
      
    const compositionsPerTemplate = templateData ? templateData[1].count : 0;
    const safePatientCount = summary?.patient_count || 1;
    const compositionsPerPatient = compositionsPerTemplate / Math.max(1, safePatientCount);
      
      return {
        id: template.id,
        name: template.name,
        totalCompositions: compositionsPerTemplate,
        projectedCompositions: Math.round(compositionsPerPatient * patientCount),
        estimatedSizePerPatient: (compositionsPerPatient * 0.01), // 10KB per composition estimate
        totalEstimatedSize: (compositionsPerPatient * patientCount * 0.01)
      };
    });
  };
  
  const selectedTemplatesData = calculateSelectedTemplatesData();
  const totalProjectedCompositions = selectedTemplatesData.reduce((sum, template) => sum + template.projectedCompositions, 0);
  const totalEstimatedSize = selectedTemplatesData.reduce((sum, template) => sum + template.totalEstimatedSize, 0);
  
  // Direct content display for specified tab mode
  const renderSelectedContent = () => (
    <>
      <div className="relative overflow-hidden bg-surface/80 p-3 rounded-lg border border-theme/20 mb-4 flex items-start before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-primary">
        <Info size={16} className="text-theme-secondary mt-0.5 mr-2 flex-shrink-0" strokeWidth={1.5} />
        <div className="text-sm text-theme-secondary">
          Projected data generation based on {selectedTemplates.length} selected templates
          for {patientCount.toLocaleString()} synthetic patients.
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div className="bg-surface-hover p-3 rounded-md">
          <div className="flex items-center text-theme-secondary mb-1">
            <Users size={14} className="mr-1" />
            <span className="text-xs">Target Patients</span>
          </div>
          <div className="text-xl font-semibold text-theme-primary">
            {patientCount.toLocaleString()}
          </div>
        </div>

        <div className="bg-surface-hover p-3 rounded-md">
          <div className="flex items-center text-theme-secondary mb-1">
            <FileSpreadsheet size={14} className="mr-1" />
            <span className="text-xs">Projected Compositions</span>
          </div>
          <div className="text-xl font-semibold text-theme-primary">
            {totalProjectedCompositions.toLocaleString()}
          </div>
        </div>

        <div className="bg-surface-hover p-3 rounded-md">
          <div className="flex items-center text-theme-secondary mb-1">
            <FileText size={14} className="mr-1" />
            <span className="text-xs">Selected Templates</span>
          </div>
          <div className="text-xl font-semibold text-theme-primary">
            {selectedTemplates.length}
          </div>
        </div>

        <div className="bg-surface-hover p-3 rounded-md">
          <div className="flex items-center text-theme-secondary mb-1">
            <BarChart2 size={14} className="mr-1" />
            <span className="text-xs">Estimated Size</span>
          </div>
          <div className="text-xl font-semibold text-theme-primary">
            {totalEstimatedSize < 1
              ? `${(totalEstimatedSize * 1000).toFixed(0)} KB`
              : totalEstimatedSize < 1000
                ? `${totalEstimatedSize.toFixed(2)} MB`
                : `${(totalEstimatedSize / 1024).toFixed(2)} GB`
            }
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-theme-primary mb-2">Template Distribution</h4>
          <div className="bg-surface-hover rounded-md overflow-hidden max-h-60 overflow-y-auto hide-scrollbar">
            <table className="w-full text-sm">
              <thead className="bg-surface sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left text-theme-primary">Template</th>
                  <th className="px-4 py-2 text-right text-theme-primary">Source Count</th>
                  <th className="px-4 py-2 text-right text-theme-primary">Projected Count</th>
                  <th className="px-4 py-2 text-right text-theme-primary">Est. Size</th>
                </tr>
              </thead>
              <tbody>
                {selectedTemplatesData.map((template) => (
                  <tr key={template.id} className="border-t border-theme/50">
                    <td className="px-4 py-2 text-theme-primary">{template.name}</td>
                    <td className="px-4 py-2 text-right text-theme-primary">{template.totalCompositions.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-theme-primary">{template.projectedCompositions.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-theme-primary">
                      {template.totalEstimatedSize < 1
                        ? `${(template.totalEstimatedSize * 1000).toFixed(0)} KB`
                        : `${template.totalEstimatedSize.toFixed(2)} MB`
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );

  const renderDataLabContent = () => (
    <>
      <div className="bg-primary/10 p-3 rounded-md border border-primary/30 mb-4 flex items-start">
        <Info size={16} className="text-primary mt-0.5 mr-2 flex-shrink-0" />
        <div className="text-sm text-theme-primary">
          This data has been filtered to include only patients with
          <span className="font-medium mx-1">{summary.min_compositions_per_patient}+</span>
          compositions. Total of {metadata.dataProcessSummary?.patient_count.toLocaleString() || 0} original patients analyzed.
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div className="bg-surface-hover p-3 rounded-md">
          <div className="flex items-center text-theme-secondary mb-1">
            <Users size={14} className="mr-1" />
            <span className="text-xs">Filtered Patients</span>
          </div>
          <div className="text-xl font-semibold text-theme-primary">
            {summary.patient_count.toLocaleString()}
          </div>
        </div>

        <div className="bg-surface-hover p-3 rounded-md">
          <div className="flex items-center text-theme-secondary mb-1">
            <FileSpreadsheet size={14} className="mr-1" />
            <span className="text-xs">Compositions</span>
          </div>
          <div className="text-xl font-semibold text-theme-primary">
            {summary.composition_count.toLocaleString()}
          </div>
        </div>

        <div className="bg-surface-hover p-3 rounded-md">
          <div className="flex items-center text-theme-secondary mb-1">
            <FileText size={14} className="mr-1" />
            <span className="text-xs">Templates</span>
          </div>
          <div className="text-xl font-semibold text-theme-primary">
            {summary.num_template_ids.toLocaleString()}
          </div>
        </div>

        <div className="bg-surface-hover p-3 rounded-md">
          <div className="flex items-center text-theme-secondary mb-1">
            <BarChart2 size={14} className="mr-1" />
            <span className="text-xs">Comps/Patient</span>
          </div>
          <div className="text-xl font-semibold text-theme-primary">
            {summary.avg_compositions_per_patient.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Rest of dataLab content... */}
    </>
  );

  const renderImportedContent = () => (
    <>
      <div className="relative overflow-hidden bg-surface/80 p-3 rounded-lg border border-theme/20 mb-4 flex items-start before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-success">
        <Info size={16} className="text-theme-secondary mt-0.5 mr-2 flex-shrink-0" strokeWidth={1.5} />
        <div className="text-sm text-theme-secondary">
          You are viewing data that was imported on {new Date(importData.importDate || Date.now()).toLocaleString()}.
          This imported data can be used as a source for generating synthetic patients.
        </div>
      </div>

      {/* Info about templates not available in system */}
      <div className="relative overflow-hidden bg-surface/80 p-3 rounded-lg border border-theme/20 mb-4 flex items-start before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-warning">
        <Info size={16} className="text-theme-secondary mt-0.5 mr-2 flex-shrink-0" strokeWidth={1.5} />
        <div className="text-sm text-theme-secondary">
          <p>
            <span className="font-medium text-theme-primary">Note about template availability:</span> Only templates that exist in the system
            can be used for synthetic data generation. Some templates from your imported data may not be
            available in the system database.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div className="bg-surface-hover p-3 rounded-md">
          <div className="flex items-center text-theme-secondary mb-1">
            <Users size={14} className="mr-1" />
            <span className="text-xs">Patients</span>
          </div>
          <div className="text-xl font-semibold text-theme-primary">
            {importSummary.patientCount.toLocaleString()}
          </div>
        </div>

        <div className="bg-surface-hover p-3 rounded-md">
          <div className="flex items-center text-theme-secondary mb-1">
            <FileSpreadsheet size={14} className="mr-1" />
            <span className="text-xs">Compositions</span>
          </div>
          <div className="text-xl font-semibold text-theme-primary">
            {importSummary.compositionCount.toLocaleString()}
          </div>
        </div>

        <div className="bg-surface-hover p-3 rounded-md">
          <div className="flex items-center text-theme-secondary mb-1">
            <FileText size={14} className="mr-1" />
            <span className="text-xs">Templates</span>
          </div>
          <div className="text-xl font-semibold text-theme-primary">
            {importSummary.templateCount.toLocaleString()}
          </div>
        </div>

        <div className="bg-surface-hover p-3 rounded-md">
          <div className="flex items-center text-theme-secondary mb-1">
            <BarChart2 size={14} className="mr-1" />
            <span className="text-xs">Comps/Patient</span>
          </div>
          <div className="text-xl font-semibold text-theme-primary">
            {(importSummary.compositionCount / Math.max(1, importSummary.patientCount)).toFixed(1)}
          </div>
        </div>
      </div>

      {/* Rest of imported content... */}
    </>
  );
  
  // If displayMode is 'selected', only show selected content regardless of tab
  if (displayMode === 'selected' && selectedTemplates && selectedTemplates.length > 0) {
    return renderSelectedContent();
  }
  
  // Return the tabbed interface for normal mode
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-theme-primary flex items-center">
          <Database className="mr-2" size={20} />
          Data Overview
        </h3>

        {/* Tab navigation */}
        <div className="flex border border-theme/50 rounded-md overflow-hidden">
          <button
            className={cn(
              "px-3 py-1 text-sm",
              activeTab === 'selected'
                ? "bg-primary text-primary-text"
                : "bg-surface-hover text-theme-primary hover:bg-surface"
            )}
            onClick={() => setActiveTab('selected')}
            disabled={!selectedTemplates || selectedTemplates.length === 0}
          >
            <FileText size={14} className="inline mr-1" />
            Selected Templates
          </button>
          <button
            className={cn(
              "px-3 py-1 text-sm",
              activeTab === 'dataLab'
                ? "bg-primary text-primary-text"
                : "bg-surface-hover text-theme-primary hover:bg-surface"
            )}
            onClick={() => setActiveTab('dataLab')}
          >
            <Database size={14} className="inline mr-1" />
            Data Lab Data
          </button>
          <button
            className={cn(
              "px-3 py-1 text-sm",
              activeTab === 'imported'
                ? "bg-success text-success-text"
                : "bg-surface-hover text-theme-primary hover:bg-surface",
              !importData && "opacity-50 cursor-not-allowed"
            )}
            onClick={() => setActiveTab('imported')}
            disabled={!importData}
          >
            <Upload size={14} className="inline mr-1" />
            Imported Data
          </button>
        </div>
      </div>

      {/* Selected Templates Tab */}
      {activeTab === 'selected' && selectedTemplates && selectedTemplates.length > 0 && renderSelectedContent()}

      {/* DataLab Data Tab */}
      {activeTab === 'dataLab' && summary && renderDataLabContent()}

      {/* Imported Data Tab */}
      {activeTab === 'imported' && importSummary && renderImportedContent()}
    </div>
  );
};

export default SyntheticDataInfo;
