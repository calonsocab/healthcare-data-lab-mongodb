// src/components/views/mappingStudio/MappingStudio.jsx
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDataModels } from '@/providers/DataModelProvider';
import DocumentUploader from './components/DocumentUploader';
import DocumentTypeIdentifier from './components/DocumentTypeIdentifier';
import TransformationPanel from './components/TransformationPanel';
import ValidationResults from './components/ValidationResults';
import DocumentPreviewModal from './components/DocumentPreviewModal';
import TransformedDocumentsModal from './components/TransformedDocumentsModal';
import PatternManager from './components/PatternManager';
import MappingYamlConfigurator from './components/MappingYamlConfigurator';
import {
  CheckCircle,
  Loader2,
  X,
  Fingerprint,
  Info,
  RefreshCw,
  FileSearch,
  Map,
  Zap,
  CheckSquare,
  Upload
} from 'lucide-react';
import { validateFileBasics } from '@/lib/uploads/validation';
import { findDisallowedTemplateMarker } from '@/lib/mappings/security';
import { canonicalizeDocumentType } from '@/lib/mappings/documentType';

const DEMO_SCENARIOS = [
  {
    id: 'fiche_tumour',
    title: 'Fiche Tumeur (CDA)',
    scope: 'Single patient document',
    badge: 'Patient scoped',
    description: 'XML CDA sample focused on one patient record and tumour summary fields.',
    source: {
      id: 'fiche_tumour_source',
      label: 'Source XML',
      url: '/demo/mapping/fiche_tumour.xml',
      fileName: 'fiche_tumour.xml',
      type: 'application/xml'
    },
    mappingAssets: [
      {
        id: 'fiche_tumour_mapping',
        label: 'Mapping YAML',
        url: '/demo/mapping/tumour_mapping.yaml',
        fileName: 'tumour_mapping.yaml',
        type: 'text/yaml'
      }
    ],
    optAsset: {
      id: 'fiche_tumour_opt',
      label: 'OPT Template',
      url: '/demo/mapping/T-IGR-TUMOUR-SUMMARY.opt',
      fileName: 'T-IGR-TUMOUR-SUMMARY.opt',
      type: 'text/plain'
    }
  },
  {
    id: 'biology_csv',
    title: 'Biology Results (CSV)',
    scope: 'One file, many patients',
    badge: 'Population scoped',
    description: 'Large CSV sample containing multiple patients and repeated observations.',
    source: {
      id: 'biology_source',
      label: 'Source CSV',
      url: '/demo/mapping/biology.csv',
      fileName: 'biology.csv',
      type: 'text/csv'
    },
    mappingAssets: [
      {
        id: 'biology_mapping',
        label: 'Mapping YAML',
        url: '/demo/mapping/biology_mapping.yaml',
        fileName: 'biology_mapping.yaml',
        type: 'text/yaml'
      }
    ],
    optAsset: {
      id: 'biology_opt',
      label: 'OPT Template',
      url: '/demo/mapping/T-IGR-BIOLOGY.opt',
      fileName: 'T-IGR-BIOLOGY.opt',
      type: 'text/plain'
    }
  }
];

const DEMO_DATASET_FILES = DEMO_SCENARIOS.map((scenario) => scenario.source);

const MappingStudio = () => {
  const {
    dataModelsByName: templatesByName,
    isLoading: templatesLoading,
    error: templatesError
  } = useDataModels();

  // State management
  const [uploadedDocuments, setUploadedDocuments] = useState([]);
  const [documentGroups, setDocumentGroups] = useState({});
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedForMapping, setSelectedForMapping] = useState(new Set());
  const [legacyMappings, setLegacyMappings] = useState({});
  const [yamlMappings, setYamlMappings] = useState({});
  const [transformedCompositions, setTransformedCompositions] = useState({});
  const [validationResults, setValidationResults] = useState({});
  const [ingestResults, setIngestResults] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState('upload');
  const [previewDocument, setPreviewDocument] = useState(null);
  const [previewTransformGroupType, setPreviewTransformGroupType] = useState(null);
  const [processingMessage, setProcessingMessage] = useState('');
  const [identificationLogs, setIdentificationLogs] = useState([]);
  const [showPatternManager, setShowPatternManager] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);

  // Document type to template associations
  const [typeTemplateAssociations, setTypeTemplateAssociations] = useState({});

  // Abort controller for cancelling requests
  const abortControllerRef = useRef(null);

  // Fetch existing mappings and associations on component mount
  useEffect(() => {
    fetchExistingMappings();
    fetchTypeTemplateAssociations();
  }, []);

  useEffect(() => {
    if (!selectedGroup) {
      const firstSelected = Array.from(selectedForMapping)[0];
      if (firstSelected) {
        setSelectedGroup(firstSelected);
      }
    }
  }, [selectedForMapping, selectedGroup]);

  useEffect(() => {
    const nextSelected = new Set(selectedForMapping);
    let selectedChanged = false;
    let groupsChanged = false;
    const nextGroups = { ...documentGroups };

    Object.keys(documentGroups).forEach(type => {
      const hasYaml = !!yamlMappings[type];
      const hasLegacy = !!legacyMappings[type];
      const hasMapping = hasYaml || hasLegacy || documentGroups[type]?.hasMapping;
      const mappingSource = hasYaml ? 'yaml' : hasLegacy ? 'legacy' : documentGroups[type]?.mappingSource;

      if (hasMapping && !nextSelected.has(type)) {
        nextSelected.add(type);
        selectedChanged = true;
      }

      if (
        documentGroups[type]?.hasMapping !== hasMapping ||
        documentGroups[type]?.mappingSource !== mappingSource
      ) {
        nextGroups[type] = {
          ...documentGroups[type],
          hasMapping,
          mappingSource
        };
        groupsChanged = true;
      }
    });

    if (groupsChanged) {
      setDocumentGroups(nextGroups);
    }
    if (selectedChanged) {
      setSelectedForMapping(nextSelected);
      if (!selectedGroup && nextSelected.size > 0) {
        setSelectedGroup(nextSelected.values().next().value);
      }
    }
  }, [yamlMappings, legacyMappings, documentGroups, selectedForMapping, selectedGroup]);

  const fetchExistingMappings = async () => {
    try {
      // Use local /api/mappings endpoint (legacy Kehrnel endpoints no longer available)
      const response = await fetch('/api/mappings');

      if (response.ok) {
        const mappingsList = await response.json();
        const yamlMap = mappingsList.reduce((acc, m) => {
          const key = canonicalizeDocumentType(m.documentType || m.name);
          // Keep the newest mapping per key (API already sorts by updatedAt desc).
          if (key && !acc[key]) acc[key] = m;
          return acc;
        }, {});
        setYamlMappings(yamlMap);
        // Clear legacy mappings since we're using local storage only
        setLegacyMappings({});
      }
    } catch (error) {
      console.error('Error fetching mappings:', error);
    }
  };

  const fetchTypeTemplateAssociations = async () => {
    try {
      const response = await fetch('/api/type-template-associations');
      if (response.ok) {
        const associationsRaw = await response.json();
        const associations = Object.entries(associationsRaw || {}).reduce((acc, [docType, templateId]) => {
          const canonicalType = canonicalizeDocumentType(docType);
          if (canonicalType && templateId) acc[canonicalType] = templateId;
          return acc;
        }, {});
        setTypeTemplateAssociations(associations);
      }
    } catch (error) {
      console.error('Error fetching associations:', error);
    }
  };

  // Save type-template association
  const saveTypeTemplateAssociation = async (documentType, templateId) => {
    const canonicalType = canonicalizeDocumentType(documentType);
    try {
      const response = await fetch('/api/type-template-associations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentType: canonicalType, templateId })
      });

      if (response.ok) {
        setTypeTemplateAssociations(prev => ({
          ...prev,
          [canonicalType]: templateId
        }));
      }
    } catch (error) {
      console.error('Error saving association:', error);
    }
  };

  // Cancel processing
  const cancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsProcessing(false);
    setProcessingMessage('');
  };

  // Reprocess documents with patterns
  const reprocessDocuments = async () => {
    if (uploadedDocuments.length === 0) return;
    
    setIsProcessing(true);
    setProcessingMessage('Re-identifying documents with updated patterns...');
    
    // Re-upload the documents to trigger pattern matching again
    const files = uploadedDocuments.map(doc => doc.file);
    setUploadedDocuments([]); // Clear current documents
    await handleDocumentUpload(files); // Re-process
    
    setIsProcessing(false);
    setProcessingMessage('');
  };

  // Handle document upload with detailed identification logging
  const handleDocumentUpload = async (files) => {
    setIsProcessing(true);
    setProcessingMessage('Processing documents...');
    setIdentificationLogs([]);
    abortControllerRef.current = new AbortController();

    const newDocuments = [];
    const newLogs = [];
    const existingSignatures = new Set(
      uploadedDocuments.map((doc) => `${doc.fileName}::${doc.file?.size ?? 0}`)
    );
    const batchSignatures = new Set();
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB limit
    const ALLOWED_EXTENSIONS = ['.xml', '.cda', '.csv', '.json', '.txt', '.hl7'];
    const ALLOWED_MIME_TYPES = [
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

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const signature = `${file.name}::${file.size}`;

        // Check if cancelled
        if (abortControllerRef.current.signal.aborted) {
          throw new Error('Processing cancelled');
        }

        if (existingSignatures.has(signature) || batchSignatures.has(signature)) {
          newLogs.push({
            fileName: file.name,
            status: 'error',
            message: 'Duplicate file skipped',
            timestamp: new Date()
          });
          continue;
        }
        batchSignatures.add(signature);

        setProcessingMessage(`Identifying ${file.name} (${i + 1}/${files.length})...`);

        const validationError = validateFileBasics(file, {
          allowedExtensions: ALLOWED_EXTENSIONS,
          allowedMimeTypes: ALLOWED_MIME_TYPES,
          maxBytes: MAX_FILE_SIZE,
          allowMissingType: true
        });
        if (validationError) {
          newLogs.push({
            fileName: file.name,
            status: 'error',
            message: validationError,
            timestamp: new Date()
          });
          continue;
        }

        try {
          const formData = new FormData();
          formData.append('document', file);

          // Call identification with debug flag (uses local pattern-based identification)
          const response = await fetch('/api/identify-document?debug=true', {
            method: 'POST',
            body: formData,
            signal: abortControllerRef.current.signal
          });

          if (response.ok) {
            const result = await response.json();

            // Log identification details
            const normalizedDocumentType = canonicalizeDocumentType(result.documentType);

            newLogs.push({
              fileName: file.name,
              status: 'success',
              documentType: normalizedDocumentType,
              handler: result.handler,
              confidence: result.confidence || 'N/A',
              patternsChecked: result.debugInfo?.patternsChecked || [],
              matchedPattern: result.debugInfo?.matchedPattern || null,
              timestamp: new Date()
            });

            newDocuments.push({
              id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              file,
              fileName: file.name,
              type: normalizedDocumentType,
              handler: result.handler,
              sampleData: result.sampleData,
              structure: result.structure,
              status: 'uploaded',
              uploadedAt: new Date(),
              debugInfo: result.debugInfo
            });

            // Check if we have a saved template association for this type
            if (typeTemplateAssociations[normalizedDocumentType]) {
              // Auto-select the associated template
              setDocumentGroups(prev => ({
                ...prev,
                [normalizedDocumentType]: {
                  ...prev[normalizedDocumentType],
                  selectedTemplate: typeTemplateAssociations[normalizedDocumentType]
                }
              }));
            }

            // Auto-select for mapping if has existing mapping
            if (yamlMappings[normalizedDocumentType] || legacyMappings[normalizedDocumentType]) {
              setSelectedForMapping(prev => new Set([...prev, normalizedDocumentType]));
            }
          } else {
            const errorData = await response.json();
            newLogs.push({
              fileName: file.name,
              status: 'error',
              message: errorData.detail || 'Failed to identify document',
              timestamp: new Date()
            });
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            throw new Error('Processing cancelled');
          }
          newLogs.push({
            fileName: file.name,
            status: 'error',
            message: error.message,
            timestamp: new Date()
          });
        }
      }

      setUploadedDocuments(prev => [...prev, ...newDocuments]);
      setIdentificationLogs(newLogs);

      if (newDocuments.length > 0) {
        setActiveTab('identify');
      }
    } catch (error) {
      if (error.message !== 'Processing cancelled') {
        console.error('Error during upload:', error);
      }
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
      abortControllerRef.current = null;
    }
  };

  // Group documents by type with better naming
  const hasExistingMapping = useCallback((type) => Boolean(yamlMappings[type] || legacyMappings[type]), [yamlMappings, legacyMappings]);
  const getPreferredTemplate = useCallback(
    (typeOrDoc) => {
      const type = typeof typeOrDoc === 'string' ? typeOrDoc : typeOrDoc?.type;
      if (!type) return null;
      return yamlMappings[type]?.targetTemplate || legacyMappings[type]?.targetTemplate || null;
    },
    [yamlMappings, legacyMappings]
  );

  const groupDocumentsByType = useCallback((documents, prevGroups = {}) => {
    return documents.reduce((acc, doc) => {
      const docType = doc.type || 'unknown';
      const prev = prevGroups[docType] || {};
      if (!acc[docType]) {
        acc[docType] = {
          type: docType,
          handler: doc.handler,
          documents: [],
          hasMapping: hasExistingMapping(docType),
          mappingSource: yamlMappings[docType]
            ? 'yaml'
            : legacyMappings[docType]
              ? 'legacy'
              : null,
          selectedTemplate:
            prev.selectedTemplate ||
            typeTemplateAssociations[docType] ||
            getPreferredTemplate({ ...doc, type: docType }) ||
            null,
          displayName: getDocumentDisplayName({ ...doc, type: docType })
        };
      }
      acc[docType].documents.push(doc);
      return acc;
    }, {});
  }, [yamlMappings, legacyMappings, typeTemplateAssociations, hasExistingMapping, getPreferredTemplate]);

  // Keep groups derived from uploaded docs to avoid upload/identify state drift.
  useEffect(() => {
    setDocumentGroups(prev => groupDocumentsByType(uploadedDocuments, prev));
  }, [uploadedDocuments, groupDocumentsByType]);

  // Get better document display name
  const getDocumentDisplayName = (doc) => {
    const typeNames = {
      'fiche_tumour_cda': 'Fiche Tumeur (CDA)',
      'pmsi_cda': 'PMSI Events (CDA)',
      'simbad_medication_admin': 'SIMBAD Medication Administration',
      'hl7v2_adt': 'HL7v2 ADT Message',
      'generic_cda': 'Generic CDA Document',
      'laboratory_csv': 'Biology Results (CSV)',
      'biology_csv': 'Biology Results (CSV)',
      'biology_results_csv': 'Biology Results (CSV)',
      'lab_results_csv': 'Lab Results (CSV)',
      'unknown_xml': 'Unknown XML Document',
      'unknown_csv': 'Unknown CSV Document'
    };

    if (typeNames[doc.type]) {
      return typeNames[doc.type];
    }

    return doc.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Handle template selection for a document group
  const handleTemplateSelection = async (groupType, templateId) => {
    setDocumentGroups(prev => ({
      ...prev,
      [groupType]: {
        ...prev[groupType],
        selectedTemplate: templateId
      }
    }));

    setSelectedForMapping(prev => {
      if (prev.has(groupType)) return prev;
      const next = new Set(prev);
      next.add(groupType);
      return next;
    });

    setSelectedGroup(prev => prev || groupType);

    // Save the association
    if (templateId) {
      await saveTypeTemplateAssociation(groupType, templateId);
    }
  };

  // Handle group selection for mapping
  const handleGroupSelect = (groupType) => {
    setSelectedForMapping(prev => {
      const newSet = new Set(prev);
      newSet.add(groupType);
      return newSet;
    });
    setSelectedGroup(groupType);
  };

  const handleMappingSaved = (groupType, mappingRecord) => {
    setYamlMappings(prev => ({
      ...prev,
      [groupType]: mappingRecord
    }));
    setDocumentGroups(prev => ({
      ...prev,
      [groupType]: {
        ...prev[groupType],
        hasMapping: true,
        mappingSource: 'yaml'
      }
    }));
  };

  const fetchDemoAssetFile = async (asset) => {
    const response = await fetch(asset.url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Unable to load ${asset.fileName} (${response.status})`);
    }

    const blob = await response.blob();
    return new File([blob], asset.fileName, {
      type: asset.type || blob.type || 'application/octet-stream'
    });
  };

  const handlePreviewDemoAsset = async (asset) => {
    if (!asset || isProcessing) return;
    try {
      const file = await fetchDemoAssetFile(asset);
      setPreviewDocument({
        id: `demo_${asset.id || asset.fileName}`,
        file,
        fileName: asset.fileName,
        type: 'demo_asset',
        status: 'uploaded',
        uploadedAt: new Date()
      });
    } catch (error) {
      console.error('Failed to preview demo asset:', error);
      setIdentificationLogs([
        {
          fileName: asset?.fileName || 'Demo asset',
          status: 'error',
          message: error.message || 'Failed to load demo asset',
          timestamp: new Date()
        }
      ]);
    }
  };

  const handleLoadDemoDocuments = async (scenarioIds = null) => {
    if (loadingDemo || isProcessing) return;
    setLoadingDemo(true);
    try {
      const selectedAssets = Array.isArray(scenarioIds) && scenarioIds.length > 0
        ? DEMO_SCENARIOS
            .filter((scenario) => scenarioIds.includes(scenario.id))
            .map((scenario) => scenario.source)
        : DEMO_DATASET_FILES;

      const files = [];
      for (const source of selectedAssets) {
        files.push(await fetchDemoAssetFile(source));
      }

      if (files.length > 0) {
        await handleDocumentUpload(files);
      }
    } catch (error) {
      console.error('Failed to load demo documents:', error);
      setIdentificationLogs([
        {
          fileName: 'Demo dataset',
          status: 'error',
          message: error.message || 'Failed to load demo documents',
          timestamp: new Date()
        }
      ]);
    } finally {
      setLoadingDemo(false);
    }
  };

  const handleLoadDemoScenario = async (scenarioId) => {
    if (!scenarioId) return;
    await handleLoadDemoDocuments([scenarioId]);
  };

  const formatTransformErrorMessage = (errorBody, fallbackMessage) => {
    if (!errorBody || typeof errorBody !== 'object') return fallbackMessage;

    const baseMessage = (
      (typeof errorBody.error === 'string' && errorBody.error.trim()) ||
      (typeof errorBody.detail === 'string' && errorBody.detail.trim()) ||
      fallbackMessage
    );

    const details = errorBody.details;
    if (!details) return baseMessage;

    if (typeof details === 'string' && details.trim()) {
      return `${baseMessage}: ${details}`;
    }

    if (details && typeof details === 'object') {
      const marker = typeof details.marker === 'string' ? details.marker : null;
      const line = Number.isFinite(details.line) ? details.line : null;
      const column = Number.isFinite(details.column) ? details.column : null;
      if (marker && line && column) {
        return `${baseMessage} (${marker} at line ${line}, column ${column})`;
      }

      try {
        return `${baseMessage}: ${JSON.stringify(details)}`;
      } catch {
        return baseMessage;
      }
    }

    return baseMessage;
  };

  // Transform documents
  const handleTransform = async (groupType) => {
    const group = documentGroups[groupType];
    const source = group?.mappingSource || (yamlMappings[groupType] ? 'yaml' : 'legacy');
    const mappingRecord = source === 'yaml' ? yamlMappings[groupType] : legacyMappings[groupType];
    if (!group?.hasMapping || !group?.selectedTemplate || !mappingRecord?._id) return;

    const mappingYaml = String(mappingRecord?.yaml || '');
    const blockedMarker = findDisallowedTemplateMarker(mappingYaml);
    if (blockedMarker) {
      const blockedMessage = `Mapping YAML contains disabled template syntax (${blockedMarker.marker || 'template marker'} at line ${blockedMarker.line}, column ${blockedMarker.column})`;
      const blockedResults = {};
      (group.documents || []).forEach((doc) => {
        blockedResults[doc.id] = {
          error: blockedMessage,
          status: 'error',
          timestamp: new Date()
        };
      });
      setTransformedCompositions(prev => ({
        ...prev,
        [groupType]: blockedResults
      }));
      setActiveTab('transform');
      return;
    }

    setIsProcessing(true);
    setProcessingMessage('Transforming documents...');
    const results = {};

    for (const doc of group.documents) {
      try {
        setProcessingMessage(`Transforming ${doc.fileName}...`);
        const formData = new FormData();
        formData.append('document', doc.file);
        formData.append('mappingId', mappingRecord._id);
        formData.append('templateId', group.selectedTemplate);

        const response = await fetch('/api/transform', {
          method: 'POST',
          body: formData
        });

        if (response.ok) {
          const payload = await response.json();
          const compositions = Array.isArray(payload?.compositions)
            ? payload.compositions
            : [payload];

          compositions.forEach((composition, outputIndex) => {
            const key = compositions.length > 1
              ? `${doc.id}::${outputIndex + 1}`
              : doc.id;

            results[key] = {
              composition,
              status: 'transformed',
              timestamp: new Date(),
              sourceDocId: doc.id,
              sourceFileName: doc.fileName,
              fileName: compositions.length > 1
                ? `${doc.fileName} (${outputIndex + 1}/${compositions.length})`
                : doc.fileName,
              outputIndex: outputIndex + 1,
              outputTotal: compositions.length
            };
          });
        } else {
          let errorMessage = `Transform failed (${response.status})`;
          try {
            const errorBody = await response.json();
            errorMessage = formatTransformErrorMessage(errorBody, errorMessage);
          } catch {
            // ignore parse errors
          }
          results[doc.id] = {
            error: errorMessage,
            status: 'error',
            timestamp: new Date()
          };
        }
      } catch (error) {
        console.error(`Error transforming ${doc.fileName}:`, error);
        results[doc.id] = {
          error: error.message,
          status: 'error'
        };
      }
    }

    setTransformedCompositions(prev => ({
      ...prev,
      [groupType]: results
    }));
    setIsProcessing(false);
    setProcessingMessage('');
    // Keep user in Transform stage; validation is an explicit next step.
    setActiveTab('transform');
  };

  // Validate compositions
  const handleValidate = async (groupType) => {
    const group = documentGroups[groupType];
    const compositions = transformedCompositions[groupType];
    if (!compositions) return;

    const results = {};

    for (const [docId, data] of Object.entries(compositions)) {
      if (data.status === 'transformed') {
        try {
          const response = await fetch('/api/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              composition: data.composition,
              templateId: group.selectedTemplate
            })
          });

          if (response.ok) {
            const validationResult = await response.json();
            results[docId] = validationResult;
          }
        } catch (error) {
          console.error(`Error validating composition for ${docId}:`, error);
          results[docId] = {
            valid: false,
            errors: [{ message: error.message }]
          };
        }
      }
    }

    setValidationResults(prev => ({
      ...prev,
      [groupType]: results
    }));
  };

  const handleContinueToValidation = async () => {
    const groupsToValidate = Object.keys(transformedCompositions).filter((groupType) => {
      const comps = transformedCompositions[groupType] || {};
      return Object.values(comps).some((item) => item?.status === 'transformed');
    });

    if (!groupsToValidate.length) {
      setActiveTab('validate');
      return;
    }

    setIsProcessing(true);
    setProcessingMessage('Validating transformed compositions...');
    try {
      for (const groupType of groupsToValidate) {
        await handleValidate(groupType);
      }
      setActiveTab('validate');
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // Download compositions
  const handleDownloadCompositions = (groupType) => {
    const compositions = transformedCompositions[groupType];
    if (!compositions) return;

    const validCompositions = Object.entries(compositions)
      .filter(([_, data]) => data.status === 'transformed')
      .map(([entryId, data]) => ({
        documentId: entryId,
        fileName: data.fileName || data.sourceFileName || entryId,
        composition: data.composition
      }));

    const blob = new Blob([JSON.stringify(validCompositions, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${groupType}_compositions_${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePreviewTransformedGroup = (groupType) => {
    setPreviewTransformGroupType(groupType);
  };

  const handleGoToMapForGroup = (groupType) => {
    if (!groupType) return;
    setSelectedForMapping(prev => {
      const next = new Set(prev);
      next.add(groupType);
      return next;
    });
    setSelectedGroup(groupType);
    setActiveTab('map');
  };

  // Ingest valid compositions into MongoDB via Kehrnel environment runtime
  const handleIngestValid = async (groupType) => {
    const transformed = transformedCompositions[groupType] || {};
    const validations = validationResults[groupType] || {};
    const validEntries = Object.entries(transformed)
      .filter(([entryId, item]) => item?.status === 'transformed' && validations[entryId]?.valid === true)
      .map(([entryId, item]) => ({
        documentId: entryId,
        fileName: item?.fileName || item?.sourceFileName || entryId,
        composition: item?.composition,
        committedAt: item?.timestamp || null
      }));

    if (!validEntries.length) {
      setIngestResults((prev) => ({
        ...prev,
        [groupType]: { ok: false, message: 'No valid compositions to ingest.' }
      }));
      return;
    }

    setIsProcessing(true);
    setProcessingMessage(`Ingesting ${validEntries.length} valid composition(s)...`);
    try {
      const response = await fetch('/api/ingest-compositions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: 'openehr',
          strategyId: null,
          items: validEntries
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || `Ingest failed (${response.status})`);
      }

      setIngestResults((prev) => ({
        ...prev,
        [groupType]: {
          ok: true,
          message: `Ingested ${payload.ingested || 0}/${payload.total || validEntries.length} composition(s).`,
          details: payload
        }
      }));
    } catch (error) {
      console.error(`Error ingesting compositions for ${groupType}:`, error);
      setIngestResults((prev) => ({
        ...prev,
        [groupType]: {
          ok: false,
          message: error.message || 'Ingest failed'
        }
      }));
    } finally {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  // Refresh patterns when pattern manager updates
  const handlePatternUpdate = () => {
    // Clear identification logs to force re-identification
    setIdentificationLogs([]);
  };

  // Get tab icon
  const getTabIcon = (tab) => {
    switch (tab) {
      case 'upload': return <Upload size={16} />;
      case 'identify': return <FileSearch size={16} />;
      case 'map': return <Map size={16} />;
      case 'transform': return <Zap size={16} />;
      case 'validate': return <CheckSquare size={16} />;
      default: return null;
    }
  };

  // Check if can proceed to next tab
  const canProceed = (fromTab) => {
    switch (fromTab) {
      case 'upload':
        return uploadedDocuments.length > 0;
      case 'identify':
        return selectedForMapping.size > 0 && 
               Array.from(selectedForMapping).every(type => 
                 documentGroups[type]?.selectedTemplate
               );
      case 'map':
        return Array.from(selectedForMapping).some(type => 
          documentGroups[type]?.hasMapping && documentGroups[type]?.selectedTemplate
        );
      case 'transform':
        return Object.keys(transformedCompositions).length > 0;
      default:
        return false;
    }
  };

  return (
    <div className="space-y-4">
      {/* Static Header - AQLQueryManagement style */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-xl font-medium text-slate-200">Mapping Studio</h2>
          <p className="text-sm text-slate-400">
            Transform clinical documents into openEHR compositions with pattern-based identification
          </p>
        </div>
        
        {/* Pattern Config and Reprocess buttons - only in upload and identify tabs */}
        {(activeTab === 'upload' || activeTab === 'identify') && (
          <div className="flex gap-2">
            {uploadedDocuments.length > 0 && (
              <button
                onClick={reprocessDocuments}
                className="px-3 py-2 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 flex items-center gap-2"
                title="Reprocess all documents with current patterns"
              >
                <RefreshCw size={16} />
                Reprocess
              </button>
            )}
            <button
              onClick={() => setShowPatternManager(!showPatternManager)}
              className={`px-3 py-2 rounded-md flex items-center gap-2 ${
                showPatternManager
                  ? 'bg-primary text-primary-text'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <Fingerprint size={16} />
              Pattern Config
            </button>
          </div>
        )}
      </div>

      {/* Progress Tabs */}
      <div className="flex items-center gap-2 surface rounded-lg p-1">
        {['upload', 'identify', 'map', 'transform', 'validate'].map((tab) => {
          const isActive = activeTab === tab;
          const isCompleted =
            (tab === 'upload' && uploadedDocuments.length > 0) ||
            (tab === 'identify' && selectedForMapping.size > 0) ||
            (tab === 'map' && Object.values(documentGroups).some(g => g.hasMapping)) ||
            (tab === 'transform' && Object.keys(transformedCompositions).length > 0) ||
            (tab === 'validate' && Object.keys(validationResults).length > 0);

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`
                px-4 py-2 text-sm font-medium rounded transition-colors
                ${isActive
                  ? 'bg-primary text-primary-text'
                  : isCompleted
                    ? 'surface hover:surface-hover text-success'
                    : 'surface hover:surface-hover text-theme-secondary'
                }
              `}
            >
              <div className="flex items-center justify-center gap-2">
                {getTabIcon(tab)}
                {isCompleted && !isActive && <CheckCircle size={14} />}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Pattern Manager Modal */}
      {showPatternManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background surface rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col m-4">
            <div className="flex items-center justify-between p-4 border-b border-theme">
              <h3 className="text-lg font-medium text-theme-primary">Pattern Configuration</h3>
              <button
                onClick={() => setShowPatternManager(false)}
                className="text-theme-secondary hover:text-theme-primary"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <PatternManager onPatternUpdate={handlePatternUpdate} />
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="surface rounded-lg p-6 min-h-[600px] relative border border-theme">
        {isProcessing && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 rounded-lg">
            <div className="surface px-6 py-4 rounded-lg shadow-xl border border-theme">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="animate-spin text-primary" size={24} />
                <span className="text-theme-primary">{processingMessage || 'Processing...'}</span>
                <button
                  onClick={cancelProcessing}
                  className="px-4 py-2 bg-error text-error-text rounded hover:opacity-80 flex items-center gap-2"
                >
                  <X size={16} />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <DocumentUploader
              onUpload={handleDocumentUpload}
              uploadedDocuments={uploadedDocuments}
              onRemoveDocument={(id) => {
                setUploadedDocuments(prev => prev.filter(d => d.id !== id));
              }}
              onPreviewDocument={setPreviewDocument}
              onLoadDemo={handleLoadDemoDocuments}
              loadingDemo={loadingDemo || isProcessing}
              demoScenarios={DEMO_SCENARIOS}
              onLoadDemoScenario={handleLoadDemoScenario}
              onPreviewDemoAsset={handlePreviewDemoAsset}
            />

            {/* Identification Logs */}
            {identificationLogs.length > 0 && (
              <div className="bg-background rounded-lg p-4 border border-theme">
                <h4 className="text-sm font-medium text-theme-primary mb-3 flex items-center gap-2">
                  <Info size={16} />
                  Document Identification Log
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {identificationLogs.map((log, idx) => (
                    <div key={idx} className={`text-xs p-2 rounded ${log.status === 'success'
                        ? 'bg-success/10 border border-success/30'
                        : 'bg-error/10 border border-error/30'
                      }`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-medium">{log.fileName}</span>
                          {log.status === 'success' ? (
                            <div className="mt-1 text-success">
                              Identified as: <strong>{log.documentType}</strong> (Handler: {log.handler})
                              {log.matchedPattern && (
                                <div className="mt-1">Pattern: {log.matchedPattern}</div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-1 text-error">{log.message}</div>
                          )}
                        </div>
                        <span className="text-theme-secondary">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Identify Tab */}
        {activeTab === 'identify' && (
          Object.keys(documentGroups).length > 0 ? (
            <DocumentTypeIdentifier
              documentGroups={documentGroups}
              templates={Object.values(templatesByName || {})}
              onTemplateSelect={handleTemplateSelection}
              onGroupSelect={handleGroupSelect}
              onContinue={() => setActiveTab('map')}
              typeTemplateAssociations={typeTemplateAssociations}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <FileSearch className="text-theme-secondary mb-4" size={48} />
              <h3 className="text-xl font-medium text-theme-primary mb-2">No Documents to Identify</h3>
              <p className="text-theme-secondary max-w-md">
                Upload documents in the first tab to identify their types and assign templates for mapping.
              </p>
            </div>
          )
        )}

        {/* Map Tab */}
        {activeTab === 'map' && (
          selectedForMapping.size > 0 ? (
            <div className="space-y-4">
              {/* Document type selector for multiple selections */}
              {selectedForMapping.size > 1 && (
                <div className="flex items-center gap-4 p-4 bg-background rounded-lg border border-theme">
                  <label className="text-sm font-medium text-theme-primary">
                    Select document type to configure:
                  </label>
                  <select
                    value={selectedGroup || ''}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="flex-1 px-3 py-2 select"
                  >
                    <option value="">Choose a document type...</option>
                    {Array.from(selectedForMapping).map(type => (
                      <option key={type} value={type}>
                        {documentGroups[type]?.displayName || type} 
                        {(yamlMappings[type] || legacyMappings[type]) && ' ✓'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-background rounded-lg border border-theme">
                <div className="text-sm text-theme-secondary">
                  Configure this mapping in YAML (single source of truth).
                </div>
              </div>
              
              {selectedGroup && documentGroups[selectedGroup] && (
                <MappingYamlConfigurator
                  documentType={selectedGroup}
                  documentGroup={documentGroups[selectedGroup]}
                  mappingRecord={yamlMappings[selectedGroup]}
                  onSaved={handleMappingSaved}
                  onTransform={() => setActiveTab('transform')}
                />
              )}
              
              {!selectedGroup && selectedForMapping.size === 1 && (
                <MappingYamlConfigurator
                  documentType={Array.from(selectedForMapping)[0]}
                  documentGroup={documentGroups[Array.from(selectedForMapping)[0]]}
                  mappingRecord={yamlMappings[Array.from(selectedForMapping)[0]]}
                  onSaved={handleMappingSaved}
                  onTransform={() => setActiveTab('transform')}
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <Map className="text-theme-secondary mb-4" size={48} />
              <h3 className="text-xl font-medium text-theme-primary mb-2">No Documents Selected for Mapping</h3>
              <p className="text-theme-secondary max-w-md mb-4">
                Select document types in the Identify tab to create mapping configurations.
              </p>
              <button
                onClick={() => setActiveTab('identify')}
                className="px-4 py-2 btn-primary"
              >
                Go to Identify Tab
              </button>
            </div>
          )
        )}

        {/* Transform Tab */}
        {activeTab === 'transform' && (
          Object.keys(documentGroups).length > 0 ? (
            <TransformationPanel
              documentGroups={documentGroups}
              transformedCompositions={transformedCompositions}
              onTransform={handleTransform}
              onDownload={handleDownloadCompositions}
              onPreviewGroup={handlePreviewTransformedGroup}
              onGoMap={handleGoToMapForGroup}
              onValidate={handleContinueToValidation}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <Zap className="text-theme-secondary mb-4" size={48} />
              <h3 className="text-xl font-medium text-theme-primary mb-2">No Documents to Transform</h3>
              <p className="text-theme-secondary max-w-md mb-4">
                Upload and identify documents first, then configure mappings in the Map tab.
              </p>
              <button
                onClick={() => setActiveTab('upload')}
                className="px-4 py-2 btn-primary"
              >
                Go to Upload Tab
              </button>
            </div>
          )
        )}

        {/* Validate Tab */}
        {activeTab === 'validate' && (
          Object.keys(transformedCompositions).length > 0 ? (
            <ValidationResults
              documentGroups={documentGroups}
              validationResults={validationResults}
              transformedCompositions={transformedCompositions}
              onRevalidate={handleValidate}
              onDownload={handleDownloadCompositions}
              onIngest={handleIngestValid}
              ingestResults={ingestResults}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center">
              <CheckSquare className="text-theme-secondary mb-4" size={48} />
              <h3 className="text-xl font-medium text-theme-primary mb-2">No Compositions to Validate</h3>
              <p className="text-theme-secondary max-w-md mb-4">
                Transform documents in the Transform tab to validate the resulting compositions.
              </p>
              <button
                onClick={() => setActiveTab('transform')}
                className="px-4 py-2 btn-primary"
              >
                Go to Transform Tab
              </button>
            </div>
          )
        )}
      </div>

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        document={previewDocument}
        isOpen={!!previewDocument}
        onClose={() => setPreviewDocument(null)}
      />

      <TransformedDocumentsModal
        isOpen={!!previewTransformGroupType}
        onClose={() => setPreviewTransformGroupType(null)}
        groupType={previewTransformGroupType}
        group={previewTransformGroupType ? documentGroups[previewTransformGroupType] : null}
        compositions={previewTransformGroupType ? transformedCompositions[previewTransformGroupType] : null}
      />
    </div>
  );
};

export default MappingStudio;
