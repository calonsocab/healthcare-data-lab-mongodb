// src/app/components/views/AQLQueryManagement/AQLQueryEditor.jsx
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Brush, Check, Save, X, Wand2 } from 'lucide-react';
import AQLEditor from "@/components/common/AQLEditor";
import PropTypes from 'prop-types';
import CollapsibleSection from '../../common/CollapsibleSection';
import useMetadataManager from '@/hooks/useMetadata';
import TagSelector from '../settings/dataOrganization/TagSelector';
import FolderSelector from '../settings/dataOrganization/FolderSelector';
import { useDataModels } from '@/providers/DataModelProvider';
import { getTagColors } from '@/lib/utils';

// import EnvironmentSelector from './MetadataManagement/EnvironmentSelector';
import AQLNormalizer from './AQLNormalizer';

const AQLQueryEditor = ({ query, onSave, onCancel }) => {
  const [showValidationWarning, setShowValidationWarning] = useState(false);
  const { metadata, loading: metadataLoading, error: metadataError, actions } = useMetadataManager();
  const { dataModelsByName, ensureOpenEhrTree } = useDataModels();
  const [validationResult, setValidationResult] = useState(null);
  const [showAstPanel, setShowAstPanel] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [saveStatus, setSaveStatus] = useState({ loading: false, error: null, success: false });
  const [isNormalizerOpen, setIsNormalizerOpen] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [formatButtonMessage, setFormatButtonMessage] = useState('');
  const aqlEditorRef = useRef(null);
  const formatFeedbackTimeoutRef = useRef(null);

  // Initialize state with query data or defaults.
  const [queryData, setQueryData] = useState({
    _id: query?._id || null,
    name: query?.name || '',
    description: query?.description || '',
    uuid: query?.uuid || '',
    folderId: query?.folderId || null,
    tags: query?.tags || [], // This can be an array of strings or tag objects
    aqlText: query?.aqlText || '',
    normalizedAQL: query?.normalizedAQL || '',
    affectedTemplates: query?.affectedTemplates || [],
    strategyValidations: query?.strategyValidations || {},
  });

  // TO BE Removed by Gio
  // const mockEnvironments = [
  //   {
  //     _id: 'env-1753719113253',
  //     name: 'PRE',
  //     description: 'Pre-production environment',
  //     connectionString: 'mongodb+srv://<username>:<password>@ist-shared.n0kts.mongodb.net',
  //     database: 'hc-QueryBuilder',
  //     isActive: false
  //   },
  //   {
  //     _id: 'env-1753894431067',
  //     name: 'DEV',
  //     description: 'Development environment',
  //     connectionString: 'mongodb+srv://<username>:<password>@ist-shared.n0kts.mongodb.net',
  //     database: 'hc-openehr-gr',
  //     isActive: true
  //   }
  // ];

  useEffect(() => {
    console.log("Metadata loaded:", metadata);
    console.log("Environments:", metadata.environments);
    console.log("Metadata loading:", metadataLoading);
    console.log("Metadata error:", metadataError);
  }, [metadata, metadataLoading, metadataError]);

  useEffect(() => {
    if (metadata.tags.length > 0 && queryData.tags.length > 0) {
      if (queryData.tags.some(tag => typeof tag === 'string')) {
        const normalizedTags = queryData.tags.map(tagName => {
          const matchingTag = metadata.tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
          return matchingTag || { _id: `temp-${tagName}`, name: tagName };
        });

        setQueryData(prev => ({ ...prev, tags: normalizedTags }));
      }
    }
  }, [metadata.tags, queryData.tags]);

  const [expandedSections, setExpandedSections] = useState({
    basicInfo: true,
    tags: false,
    normalization: queryData.affectedTemplates.length > 0,
    conversionStrategy: true, // Strategy Validations expanded by default
  });

  useEffect(() => () => {
    if (formatFeedbackTimeoutRef.current) {
      clearTimeout(formatFeedbackTimeoutRef.current);
    }
  }, []);

  const validationErrors = Array.isArray(validationResult?.errors)
    ? validationResult.errors
      .map((error) => {
        if (typeof error === 'string') {
          return { message: error };
        }

        return {
          line: error?.line,
          column: error?.column,
          displayColumn: typeof error?.column === 'number' ? error.column + 1 : null,
          message: error?.message || 'Unknown validation error',
          expected: error?.expected,
        };
      })
      .filter((error) => error.message)
    : [];
  const firstValidationError = validationErrors[0] || null;
  const displayTags = (queryData.tags || []).map((tag, index) => {
    if (typeof tag === 'string') {
      const matchingTag = metadata.tags.find(
        (candidate) => candidate?.name?.toLowerCase() === tag.toLowerCase()
      );
      return matchingTag || { _id: `temp-display-${index}`, name: tag };
    }

    return {
      ...(tag || {}),
      _id: tag?._id || `temp-display-${index}`,
      name: tag?.name || 'Unnamed tag'
    };
  });

  // Fetch templates when needed for normalization
  useEffect(() => {
    if (isNormalizerOpen && templates.length === 0 && !isLoadingTemplates) {
      fetchTemplates();
    }
  }, [isNormalizerOpen, templates.length, isLoadingTemplates]);

  const fetchTemplates = async () => {
    try {
      setIsLoadingTemplates(true);

      // 1) pull the list from the shared DataModelProvider cache (OpenEHR only)
      const items = Object.values(dataModelsByName || {}).filter(
        t => (t?.domain || 'openehr') === 'openehr'
      );

      // 2) hydrate webTemplate trees via the provider's lazy loader
      //    (it caches the full doc in the provider for future reuse).
      const poolSize = 6;
      const out = new Array(items.length);
      let i = 0;

      const worker = async () => {
        while (i < items.length) {
          const idx = i++;
          const item = items[idx];
          try {
            const tree = await ensureOpenEhrTree(item._id);
            out[idx] = tree
              ? { ...item, webTemplate: { ...(item.webTemplate || {}), tree: tree?.tree || tree } }
              : item;
          } catch {
            out[idx] = item;
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(poolSize, items.length) }, worker));

      setTemplates(out);
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setQueryData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleAqlChange = (aqlText) => {
    setQueryData(prev => ({
      ...prev,
      aqlText
    }));
  };

  const handleFormatAql = async () => {
    const result = await aqlEditorRef.current?.formatAql?.();

    if (!result?.formattedQuery) {
      return;
    }

    setFormatButtonMessage('Formatted!');

    if (formatFeedbackTimeoutRef.current) {
      clearTimeout(formatFeedbackTimeoutRef.current);
    }

    formatFeedbackTimeoutRef.current = setTimeout(() => {
      setFormatButtonMessage('');
    }, 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const submitter = e?.nativeEvent?.submitter;
    if (submitter?.dataset?.submitIntent !== 'save-query') {
      return;
    }

    const errors = {};

    // Validate required fields
    if (!queryData.name.trim()) {
      errors.name = 'Name is required';
    }
    if (!queryData.aqlText.trim()) {
      errors.aqlText = 'AQL query is required';
    }
    // if (queryData.selectedEnvironments.length === 0) {
    //   errors.environments = 'At least one environment must be selected';
    // }

    // If validation errors, show them and stop
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    // If AQL validation failed, show warning
    if (validationResult && !validationResult.success) {
      setShowValidationWarning(true);
      return;
    }

    // Otherwise proceed with save
    proceedWithSave();
  };

  const proceedWithSave = async () => {
    setFormErrors({});
    setShowValidationWarning(false);
    setSaveStatus({ loading: true, error: null, success: false });

    try {
      // 1. Transform tags to string format for API
      const tagsAsStrings = queryData.tags.map(tag =>
        typeof tag === 'string' ? tag : tag.name
      );

      // 2. Prepare final query data
      const finalQueryData = {
        ...queryData,
        tags: tagsAsStrings
      };

      // 3. Call onSave with the transformed data
      const success = await onSave(finalQueryData);

      if (success) {
        setSaveStatus({ loading: false, error: null, success: true });
        // Auto-close on success after a short delay
        setTimeout(() => {
          if (onCancel) onCancel();
        }, 1000);
      } else {
        setSaveStatus({ loading: false, error: 'Failed to save query', success: false });
      }
    } catch (error) {
      console.error('Error saving query:', error);
      setSaveStatus({
        loading: false,
        error: error.message || 'An error occurred while saving',
        success: false
      });
    }
  };

  // TO BE Removed by Gio
  // const handleShowEnvironmentSettings = () => {
  //   alert("Environments must be created in the Metadata Management dashboard.");
  // };

  const handleOpenNormalizer = () => {
    setIsNormalizerOpen(true);
  };

  const handleSaveNormalized = ({ normalizedAQL, affectedTemplates }) => {
    setQueryData(prev => ({
      ...prev,
      normalizedAQL,
      affectedTemplates
    }));
    setIsNormalizerOpen(false);
    setExpandedSections(prev => ({
      ...prev,
      normalization: true
    }));
  };

  // TO BE Removed by Gio
  // const handleEnvironmentSelectionChange = (selectedEnvIds) => {
  //   // Update your query data state with the selected environments
  //   setQueryData(prevData => ({
  //     ...prevData,
  //     selectedEnvironments: selectedEnvIds
  //   }));
  // };

  return (
    <div className="bg-surface rounded-lg p-4 border border-theme">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-theme-primary">
            {queryData._id ? 'Edit Query' : 'New Query'}
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={saveStatus.loading}
              className="px-4 py-2 bg-surface-hover text-theme-primary rounded-md hover:bg-surface-hover/70
                disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 border border-theme/50"
            >
              <X size={16} />
              Cancel
            </button>
            <button
              type="submit"
              data-submit-intent="save-query"
              disabled={saveStatus.loading}
              className="px-4 py-2 bg-success text-success-text rounded-md hover:opacity-90
                disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save size={16} />
              {saveStatus.loading ? 'Saving...' : 'Save Query'}
            </button>
          </div>
        </div>

        {/* Status messages */}
        {saveStatus.error && (
          <div className="p-2 bg-red-900/30 text-red-300 rounded text-sm">
            {saveStatus.error}
          </div>
        )}

        {saveStatus.success && (
          <div className="p-2 bg-green-900/30 text-green-300 rounded text-sm">
            Query saved successfully!
          </div>
        )}

        {metadataError && (
          <div className="p-2 bg-yellow-900/30 text-yellow-300 rounded text-sm">
            Warning: Metadata could not be loaded from server. Using local data.
          </div>
        )}

        <CollapsibleSection
          title="Basic Information"
          isExpanded={expandedSections.basicInfo}
          onToggle={() => toggleSection('basicInfo')}
        >
          <div className="space-y-4">
            {/* UUID, Name, Description inputs */}
            <div>
              <label htmlFor="uuid" className="block text-sm font-medium text-theme-primary mb-1">
                Query UUID <span className="text-theme-secondary">(unique identifier in the system)</span>
              </label>
              <input
                type="text"
                id="uuid"
                name="uuid"
                value={queryData.uuid}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-background border border-theme rounded-md
                  text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                placeholder="domain::queryname"
              />
              <p className="mt-1 text-xs text-theme-secondary">
                A unique identifier for this query (e.g., &quot;air::heightbyehrid&quot;)
              </p>
            </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-theme-primary mb-1">
                Query Name*
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={queryData.name}
                onChange={handleInputChange}
                className={`w-full p-2 bg-background border ${formErrors.name ? 'border-red-500' : 'border-theme'}
                  rounded-md text-theme-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary`}
              />
              {formErrors.name && (
                <p className="mt-1 text-sm text-red-500">{formErrors.name}</p>
              )}
            </div>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-theme-primary mb-1">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={queryData.description}
                onChange={handleInputChange}
                rows="2"
                className="w-full p-2 bg-background border border-theme rounded-md text-theme-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
              />
            </div>
            <FolderSelector
              value={queryData.folderId}
              availableFolders={metadata.folders}
              onChange={(folderId) => {
                setQueryData(prev => ({
                  ...prev,
                  folderId
                }));
              }}
              onCreateFolder={actions.createFolder}
            />
          </div>
        </CollapsibleSection>

        {/* Tags */}
        <CollapsibleSection
          title="Tags"
          headerContent={!expandedSections.tags && displayTags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {displayTags.map((tag) => {
                const colors = getTagColors(tag.name, tag.color);
                return (
                  <div
                    key={tag._id || tag.name}
                    className={`inline-flex max-w-full items-center rounded-md border px-2 py-1 text-xs ${colors.bg} ${colors.text} ${colors.border}`}
                    title={tag.name}
                  >
                    <span className="truncate">{tag.name}</span>
                  </div>
                );
              })}
            </div>
          ) : null}
          isExpanded={expandedSections.tags}
          onToggle={() => toggleSection('tags')}
        >
          <TagSelector
            selectedTags={queryData.tags}
            availableTags={metadata.tags}
            onAddTag={(tag) => {
              // Ensure the tag is not added twice (checking both _id and name)
              if (!queryData.tags.some(t =>
                (typeof t === 'object' && t._id === tag._id) ||
                (typeof t === 'string' && t === tag.name) ||
                (typeof t === 'object' && typeof tag === 'object' && t.name?.toLowerCase() === tag.name?.toLowerCase())
              )) {
                setQueryData(prev => ({
                  ...prev,
                  tags: [...prev.tags, tag]
                }));
              }
            }}
            onRemoveTag={(tag) => {
              setQueryData(prev => ({
                ...prev,
                tags: prev.tags.filter(t =>
                  (typeof t === 'object' && t._id !== tag._id) ||
                  (typeof t === 'string' && t !== tag.name)
                )
              }));
            }}
            onCreateTag={async (tagName) => {
              try {
                const newTag = await actions.createTag(tagName);

                if (newTag) {
                  return newTag;
                }
              } catch (error) {
                console.error("Error creating tag:", error);
                return { _id: `temp-${Date.now()}`, name: tagName };
              }
            }}
            onUpdateTag={async (tagId, colorName) => {
              try {
                // Find the tag in metadata or selected tags
                const tagToUpdate = metadata.tags.find(t => t._id === tagId) ||
                  queryData.tags.find(t => t._id === tagId);

                if (!tagToUpdate) return;

                // Create updated tag object with new color
                const updatedTag = {
                  ...tagToUpdate,
                  color: colorName === 'default' ? null : colorName
                };

                // Update the tag in the backend
                if (actions.updateTag) {
                  await actions.updateTag(updatedTag);

                  // Update local state to reflect the color change
                  setQueryData(prev => ({
                    ...prev,
                    tags: prev.tags.map(t =>
                      (typeof t === 'object' && t._id === tagId) ?
                        { ...t, color: updatedTag.color } : t
                    )
                  }));
                }
              } catch (error) {
                console.error("Error updating tag color:", error);
              }
            }}
          />
        </CollapsibleSection>

        {/* AQL Editor */}
        <div className="rounded-lg overflow-hidden border border-theme bg-surface">
          <div className="bg-surface-hover p-3 flex justify-between items-center border-b border-theme">
            <h3 className="font-medium text-theme-primary">AQL Query*</h3>
            <div className="flex items-center gap-2">
              {validationResult && (
                <div className={`text-sm ${validationResult.success ? 'text-success' : 'text-error'}`}>
                  {validationResult.success ? 'Valid AQL' : 'Invalid AQL'}
                </div>
              )}
              <button
                type="button"
                onClick={handleFormatAql}
                disabled={!queryData.aqlText.trim()}
                className={`px-3 py-1 text-sm rounded flex items-center gap-1 border transition-colors ${
                  queryData.aqlText.trim()
                    ? 'border-theme bg-surface text-theme-primary hover:bg-surface-hover'
                    : 'border-theme/40 bg-surface text-theme-secondary cursor-not-allowed opacity-60'
                }`}
                title="Format AQL like Query Lab"
              >
                {formatButtonMessage ? <Check size={14} /> : <Brush size={14} />}
                {formatButtonMessage || 'Format'}
              </button>
              <button
                type="button"
                onClick={handleOpenNormalizer}
                className="ml-2 px-3 py-1 bg-success text-success-text text-sm rounded hover:opacity-90 flex items-center gap-1"
              >
                <Wand2 size={14} />
                Normalize
              </button>
            </div>
          </div>
          {!validationResult?.success && firstValidationError && (
            <div className="border-b border-error/30 bg-error/10 px-4 py-3">
              <p className="text-sm font-medium text-error">
                {typeof firstValidationError.line === 'number' && typeof firstValidationError.displayColumn === 'number'
                  ? `Error at line ${firstValidationError.line}, column ${firstValidationError.displayColumn}`
                  : 'AQL validation error'}
              </p>
              <p className="mt-1 text-sm text-error/90">{firstValidationError.message}</p>
              {firstValidationError.expected && (
                <p className="mt-1 text-xs text-theme-secondary">Expected: {firstValidationError.expected}</p>
              )}
            </div>
          )}
          <AQLEditor
            ref={aqlEditorRef}
            initialValue={queryData.aqlText}
            onAqlChange={handleAqlChange}
            onValidation={setValidationResult}
            showAstPanel={showAstPanel}
            onToggleAstPanel={() => setShowAstPanel(!showAstPanel)}
            showFormatButton={false}
          />
          {!validationResult?.success && validationErrors.length > 0 && (
            <div className="border-t border-error/30 bg-error/5 px-4 py-3">
              <p className="text-sm font-medium text-error">AQL syntax errors</p>
              <ul className="mt-2 space-y-2 text-sm">
                {validationErrors.slice(0, 5).map((error, index) => (
                  <li key={`${error.line ?? 'na'}-${error.column ?? 'na'}-${index}`} className="rounded border border-error/20 bg-background/40 px-3 py-2">
                    <div className="text-error/90">
                      {typeof error.line === 'number' && typeof error.displayColumn === 'number'
                        ? `Line ${error.line}, column ${error.displayColumn}: ${error.message}`
                        : error.message}
                    </div>
                    {error.expected && (
                      <div className="mt-1 text-xs text-theme-secondary">
                        Expected: {error.expected}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {formErrors.aqlText && (
            <p className="p-2 text-sm text-red-500">{formErrors.aqlText}</p>
          )}
        </div>

        {/* Strategy Validation Status */}
        {queryData._id && queryData.strategyValidations && Object.keys(queryData.strategyValidations).length > 0 && (
          <CollapsibleSection
            title="Strategy Validations"
            isExpanded={expandedSections.conversionStrategy}
            onToggle={() => toggleSection('conversionStrategy')}
            badgeCount={Object.keys(queryData.strategyValidations).length}
          >
            <div className="space-y-2">
              <p className="text-sm text-theme-secondary mb-3">
                Validation status from the Query Lab for each persistence strategy:
              </p>
              <div className="border border-theme rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface-hover text-left">
                      <th className="px-4 py-2 font-medium text-theme-primary">Strategy</th>
                      <th className="px-4 py-2 font-medium text-theme-primary">Protocol</th>
                      <th className="px-4 py-2 font-medium text-theme-primary text-center">Status</th>
                      <th className="px-4 py-2 font-medium text-theme-primary text-right">Last Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {Object.entries(queryData.strategyValidations).map(([strategyId, validation]) => (
                      <tr key={strategyId} className="hover:bg-surface-hover/30">
                        <td className="px-4 py-2 text-theme-primary">
                          {validation.strategyName || 'Unknown Strategy'}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            validation.protocol?.toLowerCase() === 'openehr'
                              ? 'bg-teal-900/40 text-teal-300 border border-teal-600/50'
                              : validation.protocol?.toLowerCase() === 'fhir'
                                ? 'bg-red-900/40 text-red-300 border border-red-600/50'
                                : 'bg-surface-hover text-theme-primary'
                          }`}>
                            {validation.protocol || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            validation.status === 'done'
                              ? 'bg-green-900/30 text-green-300'
                              : validation.status === 'needs_improvement'
                                ? 'bg-yellow-900/30 text-yellow-300'
                                : 'bg-surface-hover text-theme-secondary'
                          }`}>
                            {validation.status === 'done' ? '✓ Done' :
                             validation.status === 'needs_improvement' ? '⚠ Needs Improvement' :
                             'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-theme-secondary">
                          {validation.updatedAt
                            ? new Date(validation.updatedAt).toLocaleDateString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-theme-secondary mt-2">
                Use the Query Lab to test and validate this query against different persistence strategies.
              </p>
            </div>
          </CollapsibleSection>
        )}

        {/* TO BE Removed by Gio */}
        {/* Environments */}
        {/* <EnvironmentSelector
          environments={metadata?.environments?.length > 0 ? metadata.environments : mockEnvironments}
          selectedEnvironments={queryData.selectedEnvironments || []}
          onEnvironmentSelectionChange={handleEnvironmentSelectionChange}
          onShowEnvironmentSettings={handleShowEnvironmentSettings}
        />

        {formErrors.environments && (
          <div className="p-2 bg-red-900/30 text-red-300 rounded text-sm">
            {formErrors.environments}
          </div>
        )} */}
      </form>

      {/* Validation Warning Modal */}
      {
        showValidationWarning && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-surface p-6 rounded-lg max-w-md w-full">
              <h3 className="text-lg font-medium text-yellow-400 mb-4 flex items-center">
                <AlertTriangle size={20} className="mr-2" />
                Validation Warning
              </h3>
              <p className="text-theme-primary mb-6">
                This query has syntax errors that might cause issues when executed. Do you want to save it anyway?
              </p>
              {validationErrors.length > 0 && (
                <div className="mb-6 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3">
                  <p className="mb-2 text-sm font-medium text-yellow-300">Detected errors</p>
                  <ul className="space-y-2 text-sm text-theme-primary">
                    {validationErrors.slice(0, 3).map((error, index) => (
                      <li key={`warning-${error.line ?? 'na'}-${error.column ?? 'na'}-${index}`}>
                        {typeof error.line === 'number' && typeof error.displayColumn === 'number'
                          ? `Line ${error.line}, column ${error.displayColumn}: ${error.message}`
                          : error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setShowValidationWarning(false)}
                  className="px-4 py-2 bg-surface-hover text-theme-primary rounded hover:bg-surface"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={proceedWithSave}
                  className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                >
                  Save Anyway
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* AQL Normalizer Modal */}
      <AQLNormalizer
        aqlText={queryData.aqlText}
        templates={templates}
        onClose={() => setIsNormalizerOpen(false)}
        onSaveNormalized={handleSaveNormalized}
        isOpen={isNormalizerOpen}
      />
    </div>
  );
};

AQLQueryEditor.propTypes = {
  query: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};

export default AQLQueryEditor;
