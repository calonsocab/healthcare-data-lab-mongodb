"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  Package,
  Search,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
  Layers,
  Box,
  User,
  Activity,
  Thermometer,
  Beaker,
  Heart,
  Pill,
  MapPin,
  Wand2,
  Send,
  Bot,
  Loader2,
  CheckSquare,
  Square,
  Combine,
  GitBranch,
  Sparkles,
  Clock,
  Upload,
  Save
} from 'lucide-react';
// Import semantic utilities
import { computeAllPaths, computeCoqlPath, computeCanonicalPath } from '@/lib/semantic/path-utils';
import {
  VALID_NODE_DATA_TYPES,
  VALID_V1_ROLES,
  VALID_TIME_ROLES,
  coerceDataTypeForRole,
  isDataTypeAllowedForRole
} from '@/lib/definitions/types';
import AgentWorkflowInfoPanel from './AgentWorkflowInfoPanel';

// Check if AI assistant is disabled via environment variable
const isAIAssistantDisabled = process.env.NEXT_PUBLIC_DISABLE_AI_ASSISTANT === 'true';

const generateNodeId = () => 'n-' + Math.random().toString(36).substr(2, 9);

// Predefined block templates that generate SemanticNodes
const BLOCK_TEMPLATES = [
  {
    id: 'patient-identifier',
    name: 'Patient Identifier',
    category: 'Demographics',
    icon: User,
    color: 'blue',
    description: 'Unique patient identification',
    generateNodes: (parentId) => {
      const rootId = generateNodeId();
      return [
        {
          nodeId: rootId,
          name: 'Patient Identifier',
          attribute: 'patientIdentifier',
          role: 'group',
          dataType: 'object',
          parentNodeId: parentId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'ID Type',
          attribute: 'idType',
          role: 'field',
          dataType: 'code',
          parentNodeId: rootId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'ID Value',
          attribute: 'idValue',
          role: 'field',
          dataType: 'string',
          parentNodeId: rootId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Issuer',
          attribute: 'issuer',
          role: 'field',
          dataType: 'string',
          parentNodeId: rootId,
          occurrences: { min: 0, max: 1 },
          childrenNodeIds: []
        }
      ];
    }
  },
  {
    id: 'person-name',
    name: 'Person Name',
    category: 'Demographics',
    icon: User,
    color: 'blue',
    description: 'Full name with parts',
    generateNodes: (parentId) => {
      const rootId = generateNodeId();
      return [
        {
          nodeId: rootId,
          name: 'Person Name',
          attribute: 'personName',
          role: 'group',
          dataType: 'object',
          parentNodeId: parentId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Given Name',
          attribute: 'givenName',
          role: 'field',
          dataType: 'string',
          parentNodeId: rootId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Family Name',
          attribute: 'familyName',
          role: 'field',
          dataType: 'string',
          parentNodeId: rootId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Middle Name',
          attribute: 'middleName',
          role: 'field',
          dataType: 'string',
          parentNodeId: rootId,
          occurrences: { min: 0, max: 1 },
          childrenNodeIds: []
        }
      ];
    }
  },
  {
    id: 'analyte-result',
    name: 'Analyte Result',
    category: 'Laboratory',
    icon: Beaker,
    color: 'purple',
    description: 'Single lab test result',
    generateNodes: (parentId) => {
      const rootId = generateNodeId();
      return [
        {
          nodeId: rootId,
          name: 'Analyte Result',
          attribute: 'analyteResult',
          role: 'group',
          dataType: 'object',
          parentNodeId: parentId,
          occurrences: { min: 0, max: '*' },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Analyte Name',
          attribute: 'analyteName',
          role: 'field',
          dataType: 'string',
          parentNodeId: rootId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Result Value',
          attribute: 'resultValue',
          role: 'field',
          dataType: 'quantity',
          parentNodeId: rootId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Unit',
          attribute: 'unit',
          role: 'field',
          dataType: 'string',
          parentNodeId: rootId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Reference Range',
          attribute: 'referenceRange',
          role: 'field',
          dataType: 'string',
          parentNodeId: rootId,
          occurrences: { min: 0, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Interpretation',
          attribute: 'interpretation',
          role: 'field',
          dataType: 'code',
          parentNodeId: rootId,
          occurrences: { min: 0, max: 1 },
          childrenNodeIds: []
        }
      ];
    }
  },
  {
    id: 'blood-pressure',
    name: 'Blood Pressure',
    category: 'Vital Signs',
    icon: Activity,
    color: 'red',
    description: 'Systolic and diastolic BP',
    generateNodes: (parentId) => {
      const rootId = generateNodeId();
      return [
        {
          nodeId: rootId,
          name: 'Blood Pressure',
          attribute: 'bloodPressure',
          role: 'group',
          dataType: 'object',
          parentNodeId: parentId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Systolic',
          attribute: 'systolic',
          role: 'field',
          dataType: 'number',
          parentNodeId: rootId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Diastolic',
          attribute: 'diastolic',
          role: 'field',
          dataType: 'number',
          parentNodeId: rootId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Position',
          attribute: 'position',
          role: 'field',
          dataType: 'code',
          parentNodeId: rootId,
          occurrences: { min: 0, max: 1 },
          childrenNodeIds: []
        }
      ];
    }
  },
  {
    id: 'body-temperature',
    name: 'Body Temperature',
    category: 'Vital Signs',
    icon: Thermometer,
    color: 'red',
    description: 'Temperature measurement',
    generateNodes: (parentId) => {
      const rootId = generateNodeId();
      return [
        {
          nodeId: rootId,
          name: 'Body Temperature',
          attribute: 'bodyTemperature',
          role: 'group',
          dataType: 'object',
          parentNodeId: parentId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Temperature',
          attribute: 'temperature',
          role: 'field',
          dataType: 'quantity',
          parentNodeId: rootId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Unit',
          attribute: 'unit',
          role: 'field',
          dataType: 'code',
          parentNodeId: rootId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        }
      ];
    }
  },
  {
    id: 'medication-item',
    name: 'Medication Item',
    category: 'Medication',
    icon: Pill,
    color: 'green',
    description: 'Single medication entry',
    generateNodes: (parentId) => {
      const rootId = generateNodeId();
      return [
        {
          nodeId: rootId,
          name: 'Medication Item',
          attribute: 'medicationItem',
          role: 'group',
          dataType: 'object',
          parentNodeId: parentId,
          occurrences: { min: 0, max: '*' },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Medication Name',
          attribute: 'medicationName',
          role: 'field',
          dataType: 'string',
          parentNodeId: rootId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Dose',
          attribute: 'dose',
          role: 'field',
          dataType: 'quantity',
          parentNodeId: rootId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Frequency',
          attribute: 'frequency',
          role: 'field',
          dataType: 'string',
          parentNodeId: rootId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Route',
          attribute: 'route',
          role: 'field',
          dataType: 'code',
          parentNodeId: rootId,
          occurrences: { min: 0, max: 1 },
          childrenNodeIds: []
        }
      ];
    }
  },
  {
    id: 'address',
    name: 'Address',
    category: 'Demographics',
    icon: MapPin,
    color: 'blue',
    description: 'Physical address',
    generateNodes: (parentId) => {
      const rootId = generateNodeId();
      return [
        {
          nodeId: rootId,
          name: 'Address',
          attribute: 'address',
          role: 'group',
          dataType: 'object',
          parentNodeId: parentId,
          occurrences: { min: 0, max: '*' },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Street',
          attribute: 'street',
          role: 'field',
          dataType: 'string',
          parentNodeId: rootId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'City',
          attribute: 'city',
          role: 'field',
          dataType: 'string',
          parentNodeId: rootId,
          occurrences: { min: 1, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Postal Code',
          attribute: 'postalCode',
          role: 'field',
          dataType: 'string',
          parentNodeId: rootId,
          occurrences: { min: 0, max: 1 },
          childrenNodeIds: []
        },
        {
          nodeId: generateNodeId(),
          name: 'Country',
          attribute: 'country',
          role: 'field',
          dataType: 'code',
          parentNodeId: rootId,
          occurrences: { min: 0, max: 1 },
          childrenNodeIds: []
        }
      ];
    }
  }
];

const TERMINOLOGY_SYSTEM_OPTIONS = [
  { value: 'SNOMED-CT', label: 'SNOMED-CT', valueSetHint: 'http://snomed.info/sct?fhir_vs=refset/...' },
  { value: 'LOINC', label: 'LOINC', valueSetHint: 'http://loinc.org/vs/...' },
  { value: 'ICD-10', label: 'ICD-10', valueSetHint: 'urn:oid:2.16.840.1.113883.6.90' },
  { value: 'RxNorm', label: 'RxNorm', valueSetHint: 'http://www.nlm.nih.gov/research/umls/rxnorm' },
  { value: 'UCUM', label: 'UCUM', valueSetHint: 'http://unitsofmeasure.org' },
  { value: 'HL7', label: 'HL7', valueSetHint: 'http://terminology.hl7.org/ValueSet/...' },
  { value: 'Other', label: 'Other', valueSetHint: 'system:id' }
];

const TERMINOLOGY_STRENGTH_OPTIONS = ['required', 'extensible', 'preferred', 'example'];
const VALUE_SET_REF_PATTERN = /^https?:\/\//i;
const TERMINOLOGY_FAVORITES_STORAGE_KEY = 'hdl.contextObject.terminologyFavorites';
const TERMINOLOGY_RECENT_STORAGE_KEY = 'hdl.contextObject.terminologyRecent';
const TERMINOLOGY_CATALOG = [
  {
    system: 'SNOMED-CT',
    title: 'Clinical concepts',
    tags: ['diagnosis', 'finding', 'procedure'],
    valueSets: [
      { label: 'Clinical Findings', ref: 'http://snomed.info/sct?fhir_vs=refset/404684003' },
      { label: 'Procedure', ref: 'http://snomed.info/sct?fhir_vs=refset/71388002' }
    ]
  },
  {
    system: 'LOINC',
    title: 'Lab and observations',
    tags: ['lab', 'observation', 'analyte'],
    valueSets: [
      { label: 'Lab Tests', ref: 'http://loinc.org/vs/LL1234-5' },
      { label: 'Vital Signs', ref: 'http://loinc.org/vs/LP29684-5' }
    ]
  },
  {
    system: 'ICD-10',
    title: 'Billing and diagnosis coding',
    tags: ['billing', 'encounter', 'claims'],
    valueSets: [
      { label: 'Chapter I', ref: 'urn:oid:2.16.840.1.113883.6.90:chapter-i' }
    ]
  },
  {
    system: 'RxNorm',
    title: 'Medications',
    tags: ['medication', 'drug', 'route'],
    valueSets: [
      { label: 'Active Ingredients', ref: 'http://www.nlm.nih.gov/research/umls/rxnorm' }
    ]
  },
  {
    system: 'UCUM',
    title: 'Units of measure',
    tags: ['units', 'quantity'],
    valueSets: [
      { label: 'Common Clinical Units', ref: 'http://unitsofmeasure.org' }
    ]
  },
  {
    system: 'HL7',
    title: 'Interop code systems',
    tags: ['fhir', 'interop', 'status'],
    valueSets: [
      { label: 'Observation Status', ref: 'http://terminology.hl7.org/ValueSet/observation-status' },
      { label: 'Administrative Gender', ref: 'http://hl7.org/fhir/ValueSet/administrative-gender' }
    ]
  }
];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function looksLikeValueSetRef(value) {
  if (!isNonEmptyString(value)) return false;
  const trimmed = value.trim();
  return VALUE_SET_REF_PATTERN.test(trimmed) || /^urn:/i.test(trimmed) || /^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+/.test(trimmed);
}

function isCodeLikeDataType(dataType) {
  return ['code', 'coded_text'].includes(`${dataType || ''}`.toLowerCase());
}

function inferPreferredTerminologySystem(node = {}) {
  const dataType = `${node.dataType || ''}`.toLowerCase();
  const hint = `${node.attribute || ''} ${node.name || ''}`.toLowerCase();
  if (dataType === 'quantity' || hint.includes('unit')) return 'UCUM';
  if (hint.includes('med') || hint.includes('drug') || hint.includes('route')) return 'RxNorm';
  if (hint.includes('diagnosis') || hint.includes('icd')) return 'ICD-10';
  if (hint.includes('lab') || hint.includes('analyte') || hint.includes('observation')) return 'LOINC';
  if (isCodeLikeDataType(dataType)) return 'SNOMED-CT';
  return 'SNOMED-CT';
}

function buildTerminologyRecommendations(node = {}, bindings = [], limit = 3) {
  const dataType = `${node.dataType || ''}`.toLowerCase();
  const hintText = `${node.attribute || ''} ${node.name || ''} ${node.description || ''}`.toLowerCase();
  const preferredSystem = inferPreferredTerminologySystem(node);
  const existingBySystem = new Map();

  (Array.isArray(bindings) ? bindings : []).forEach((binding) => {
    if (!isNonEmptyString(binding?.system)) return;
    const system = `${binding.system}`.trim();
    if (!existingBySystem.has(system)) existingBySystem.set(system, []);
    existingBySystem.get(system).push(binding);
  });

  const recommendations = TERMINOLOGY_CATALOG.map((entry) => {
    let score = 0;
    const reasons = [];

    if (entry.system === preferredSystem) {
      score += 35;
      reasons.push('preferred for this field type');
    }

    if (dataType === 'quantity' && entry.system === 'UCUM') {
      score += 35;
      reasons.push('quantity fields should carry UCUM units');
    }
    if (isCodeLikeDataType(dataType) && ['SNOMED-CT', 'LOINC', 'ICD-10', 'HL7', 'RxNorm'].includes(entry.system)) {
      score += 12;
      reasons.push('code field with interoperability coding');
    }

    const matchedTags = (entry.tags || []).filter((tag) => hintText.includes(`${tag}`.toLowerCase()));
    if (matchedTags.length > 0) {
      score += Math.min(30, matchedTags.length * 10);
      reasons.push(`matches ${matchedTags.join(', ')}`);
    }

    if (/medication|drug|dose|route/.test(hintText) && entry.system === 'RxNorm') {
      score += 24;
      reasons.push('medication semantic match');
    }
    if (/lab|analyte|observation|vital|systolic|diastolic|temperature/.test(hintText) && entry.system === 'LOINC') {
      score += 22;
      reasons.push('observation semantic match');
    }
    if (/diagnosis|problem|condition|finding/.test(hintText) && entry.system === 'SNOMED-CT') {
      score += 22;
      reasons.push('clinical finding semantic match');
    }
    if (/diagnosis|billing|claim|encounter/.test(hintText) && entry.system === 'ICD-10') {
      score += 18;
      reasons.push('billing/diagnosis semantic match');
    }
    if (/status|gender|administrative/.test(hintText) && entry.system === 'HL7') {
      score += 16;
      reasons.push('administrative/interoperability semantic match');
    }
    if (/unit|magnitude|quantity/.test(hintText) && entry.system === 'UCUM') {
      score += 20;
      reasons.push('unit semantic match');
    }

    const entryBindings = existingBySystem.get(entry.system) || [];
    if (entryBindings.length > 0) {
      score -= 8;
      reasons.push('already used in this node');
    }

    const valueSet = (entry.valueSets || []).find((item) => {
      const label = `${item.label || ''}`.toLowerCase();
      return label && (hintText.includes(label) || label.split(/\s+/).some((token) => token.length > 3 && hintText.includes(token)));
    }) || entry.valueSets?.[0];

    let confidence = 'low';
    if (score >= 70) confidence = 'high';
    else if (score >= 45) confidence = 'medium';

    return {
      system: entry.system,
      valueSet: valueSet?.ref || '',
      valueSetLabel: valueSet?.label || '',
      score,
      confidence,
      reason: reasons.slice(0, 2).join(' + ') || 'generic interoperability recommendation'
    };
  });

  return recommendations
    .filter((item) => item.score >= 25)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function isProjectHeaderNodeLike(node) {
  if (!node) return false;
  if (`${node.blockKind || ''}`.toLowerCase() === 'project_header') return true;
  if (`${node.role || ''}`.toLowerCase() !== 'block') return false;
  const hint = `${node.blockId || ''} ${node.attribute || ''} ${node.name || ''}`.toLowerCase();
  return /contextheader|context_header|projectheader|project_header/.test(hint);
}

const IntegratedBlockComposer = ({ nodes = [], onNodesChange, definitionName = 'ContextObject', onOpenBuildingBlock, aiBootstrap = null }) => {
  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [selectedForWrapper, setSelectedForWrapper] = useState([]);
  const [showWrapperDialog, setShowWrapperDialog] = useState(false);
  const [wrapperName, setWrapperName] = useState('Custom Group');
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const [showTerminologyCatalog, setShowTerminologyCatalog] = useState(false);
  const [terminologyCatalogQuery, setTerminologyCatalogQuery] = useState('');
  const [favoriteTerminologySystems, setFavoriteTerminologySystems] = useState([]);
  const [recentTerminologySystems, setRecentTerminologySystems] = useState([]);
  const [pendingTerminologyFocus, setPendingTerminologyFocus] = useState(null);
  const [showBulkTerminologyPanel, setShowBulkTerminologyPanel] = useState(false);
  const [bulkTerminologySystem, setBulkTerminologySystem] = useState('SNOMED-CT');
  const [bulkTerminologyValueSet, setBulkTerminologyValueSet] = useState('');
  const [bulkTerminologyStrength, setBulkTerminologyStrength] = useState('required');
  const [bulkTerminologyCodeOnly, setBulkTerminologyCodeOnly] = useState(true);
  const [bulkTerminologyFeedback, setBulkTerminologyFeedback] = useState('');

  // AI Chatbot State
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [aiChatInput, setAIChatInput] = useState('');
  const [aiPanelWidth, setAIPanelWidth] = useState(576);
  const [isResizingAIPanel, setIsResizingAIPanel] = useState(false);
  const [aiChatHistory, setAIChatHistory] = useState([]);
  const [aiLoading, setAILoading] = useState(false);
  const [aiRecommendedBlocks, setAIRecommendedBlocks] = useState([]);
  const [showReusableDock, setShowReusableDock] = useState(true);
  const [minimizedReusableDock, setMinimizedReusableDock] = useState(false);
  const [aiAgentContext, setAIAgentContext] = useState(null);

  // Building Block Library State
  const [buildingBlocks, setBuildingBlocks] = useState([]);
  const [buildingBlocksLoading, setBuildingBlocksLoading] = useState(false);

  // Extract to Block State
  const [showExtractDialog, setShowExtractDialog] = useState(false);
  const [extractBlockName, setExtractBlockName] = useState('');
  const [extractBlockDescription, setExtractBlockDescription] = useState('');
  const [extractNodeId, setExtractNodeId] = useState(null);
  const [extractLoading, setExtractLoading] = useState(false);

  const chatRef = useRef(null);
  const aiInputRef = useRef(null);
  const canvasRef = useRef(null);
  const composerRef = useRef(null);
  const consumedBootstrapNonceRef = useRef(null);
  const terminologyPanelRef = useRef(null);

  // Build indexes once per nodes/buildingBlocks update for responsive large trees
  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.nodeId, n])), [nodes]);
  const childrenByParent = useMemo(() => {
    const map = new Map();
    nodes.forEach((node) => {
      const parentId = node?.parentNodeId;
      if (!parentId) return;
      if (!map.has(parentId)) map.set(parentId, []);
      map.get(parentId).push(node);
    });
    return map;
  }, [nodes]);
  const buildingBlockById = useMemo(
    () => new Map((buildingBlocks || []).map((block) => [block.blockId || block.id, block])),
    [buildingBlocks]
  );

  // Find root node
  const rootNode = useMemo(() => nodes.find((n) => n.parentNodeId === null), [nodes]);

  const selectedNodeRecords = useMemo(
    () => selectedForWrapper.map((nodeId) => nodeMap.get(nodeId)).filter(Boolean),
    [selectedForWrapper, nodeMap]
  );

  const canWrapSelection = useMemo(
    () => (
      !!rootNode
      && selectedNodeRecords.length >= 2
      && selectedNodeRecords.every((node) => node.parentNodeId === rootNode.nodeId)
    ),
    [rootNode, selectedNodeRecords]
  );

  const wrapCandidateCount = useMemo(
    () => (
      rootNode
        ? selectedNodeRecords.filter((node) => node.parentNodeId === rootNode.nodeId).length
        : 0
    ),
    [rootNode, selectedNodeRecords]
  );

  const bulkEligibleNodeRecords = useMemo(
    () => selectedNodeRecords.filter((node) => {
      if (isProjectHeaderNodeLike(node)) return false;
      if (bulkTerminologyCodeOnly && !isCodeLikeDataType(node.dataType)) return false;
      return true;
    }),
    [selectedNodeRecords, bulkTerminologyCodeOnly]
  );

  // O(1) children lookup from indexed map
  const getChildren = useCallback((nodeId) => childrenByParent.get(nodeId) || [], [childrenByParent]);

  // Fetch building blocks from API (v1 blocks collection)
  useEffect(() => {
    const fetchBuildingBlocks = async () => {
      setBuildingBlocksLoading(true);
      try {
        const response = await fetch('/api/blocks');
        if (response.ok) {
          const data = await response.json();
          setBuildingBlocks(data.blocks || []);
        }
      } catch (error) {
        console.error('Failed to fetch building blocks:', error);
      } finally {
        setBuildingBlocksLoading(false);
      }
    };

    fetchBuildingBlocks();
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [aiChatHistory]);

  const resizeAIInput = useCallback(() => {
    const input = aiInputRef.current;
    if (!input) return;
    input.style.height = 'auto';
    const computedLineHeight = Number.parseFloat(window.getComputedStyle(input).lineHeight) || 20;
    const maxHeight = computedLineHeight * 4;
    const nextHeight = Math.min(input.scrollHeight, maxHeight);
    input.style.height = `${nextHeight}px`;
    input.style.overflowY = input.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    resizeAIInput();
  }, [aiChatInput, resizeAIInput]);

  const startAIPanelResize = useCallback((event) => {
    event.preventDefault();
    setIsResizingAIPanel(true);
  }, []);

  useEffect(() => {
    if (!isResizingAIPanel) return undefined;

    const handleMouseMove = (event) => {
      const containerRect = composerRef.current?.getBoundingClientRect();
      const rightEdge = containerRect?.right ?? window.innerWidth;
      const containerWidth = containerRect?.width ?? window.innerWidth;
      const minWidth = 420;
      const maxWidth = Math.max(560, Math.min(980, containerWidth - 260));
      const nextWidth = Math.max(minWidth, Math.min(maxWidth, rightEdge - event.clientX));
      setAIPanelWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizingAIPanel(false);
    };

    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingAIPanel]);

  useEffect(() => {
    if (!aiBootstrap?.open || isAIAssistantDisabled) return;
    setShowAIPanel(true);
    if (Array.isArray(aiBootstrap?.recommendedBlocks)) {
      setAIRecommendedBlocks(aiBootstrap.recommendedBlocks);
    }
    if (aiBootstrap?.agent) {
      setAIAgentContext(aiBootstrap.agent);
    }
  }, [aiBootstrap?.open, aiBootstrap?.recommendedBlocks, aiBootstrap?.agent]);

  useEffect(() => {
    if (aiRecommendedBlocks.length > 0) {
      setShowReusableDock(true);
    }
  }, [aiRecommendedBlocks]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const savedFavorites = JSON.parse(window.localStorage.getItem(TERMINOLOGY_FAVORITES_STORAGE_KEY) || '[]');
      const savedRecent = JSON.parse(window.localStorage.getItem(TERMINOLOGY_RECENT_STORAGE_KEY) || '[]');
      if (Array.isArray(savedFavorites)) setFavoriteTerminologySystems(savedFavorites.filter((item) => typeof item === 'string'));
      if (Array.isArray(savedRecent)) setRecentTerminologySystems(savedRecent.filter((item) => typeof item === 'string').slice(0, 6));
    } catch (error) {
      console.warn('Failed to restore terminology UX preferences:', error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(TERMINOLOGY_FAVORITES_STORAGE_KEY, JSON.stringify(favoriteTerminologySystems));
    } catch (error) {
      console.warn('Failed to persist terminology favorites:', error);
    }
  }, [favoriteTerminologySystems]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(TERMINOLOGY_RECENT_STORAGE_KEY, JSON.stringify(recentTerminologySystems));
    } catch (error) {
      console.warn('Failed to persist recent terminology systems:', error);
    }
  }, [recentTerminologySystems]);

  useEffect(() => {
    if (!showTerminologyCatalog) {
      setTerminologyCatalogQuery('');
    }
  }, [showTerminologyCatalog]);

  useEffect(() => {
    if (selectedForWrapper.length > 0) return;
    setShowBulkTerminologyPanel(false);
    setBulkTerminologyFeedback('');
  }, [selectedForWrapper]);

  useEffect(() => {
    if (!showWrapperDialog) return;
    if (canWrapSelection) return;
    setShowWrapperDialog(false);
  }, [showWrapperDialog, canWrapSelection]);

  useEffect(() => {
    if (!pendingTerminologyFocus || !selectedNodeId) return;
    const raf = window.requestAnimationFrame(() => {
      const panel = terminologyPanelRef.current;
      if (!panel) return;
      const selector = `[data-term-index="${pendingTerminologyFocus.index}"][data-term-field="${pendingTerminologyFocus.field}"]`;
      const target = panel.querySelector(selector)
        || panel.querySelector(`[data-term-index="${pendingTerminologyFocus.index}"][data-term-control="true"]`);
      if (target && typeof target.focus === 'function') {
        target.focus();
        if (target.tagName === 'INPUT' && typeof target.select === 'function') {
          target.select();
        }
      }
      setPendingTerminologyFocus(null);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [pendingTerminologyFocus, selectedNodeId, nodes]);

  const libraryItems = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return (buildingBlocks || [])
      .map((block) => ({
        ...block,
        id: `stored:${block.blockId || block._id}`
      }))
      .filter((item) => (
        (item.name || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q) ||
        (item.blockId || '').toLowerCase().includes(q)
      ));
  }, [buildingBlocks, searchTerm]);

  const filteredTerminologyCatalog = useMemo(() => {
    const q = terminologyCatalogQuery.trim().toLowerCase();
    const scoreBySystem = (system) => {
      if (favoriteTerminologySystems.includes(system)) return 2;
      if (recentTerminologySystems.includes(system)) return 1;
      return 0;
    };

    return TERMINOLOGY_CATALOG
      .filter((entry) => {
        if (!q) return true;
        const valueSetText = (entry.valueSets || []).map((item) => `${item.label} ${item.ref}`).join(' ');
        const haystack = `${entry.system} ${entry.title} ${entry.tags.join(' ')} ${valueSetText}`.toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const score = scoreBySystem(b.system) - scoreBySystem(a.system);
        if (score !== 0) return score;
        return a.system.localeCompare(b.system);
      });
  }, [terminologyCatalogQuery, favoriteTerminologySystems, recentTerminologySystems]);

  // Add nodes from template
  const addNodesFromTemplate = (template, parentNodeId = rootNode?.nodeId || null) => {
    const newNodes = template.generateNodes(parentNodeId);
    const rootOfNewNodes = newNodes[0];

    // Update parent's childrenNodeIds if parent exists
    const updatedNodes = [...nodes];
    if (parentNodeId) {
      const parentIndex = updatedNodes.findIndex(n => n.nodeId === parentNodeId);
      if (parentIndex !== -1) {
        updatedNodes[parentIndex] = {
          ...updatedNodes[parentIndex],
          childrenNodeIds: [...updatedNodes[parentIndex].childrenNodeIds, rootOfNewNodes.nodeId]
        };
      }
    }

    // Update childrenNodeIds for the new nodes
    const newNodesWithChildren = newNodes.map(node => {
      const children = newNodes.filter(n => n.parentNodeId === node.nodeId);
      return {
        ...node,
        childrenNodeIds: children.map(c => c.nodeId)
      };
    });

    onNodesChange([...updatedNodes, ...newNodesWithChildren]);
    setExpandedNodes(prev => new Set([...prev, rootOfNewNodes.nodeId]));
  };

  // Embed a building block's full structure into the ContextObject
  // This copies all nodes with new IDs and tracks provenance via _blockSource
  const embedBuildingBlock = async (buildingBlock, parentNodeId = rootNode?.nodeId || null) => {
    const blockId = buildingBlock.blockId || buildingBlock.id;
    const version = buildingBlock.version || '1.0.0';

    // Get the block's full structure - either from the passed object or fetch it
    let blockNodes = buildingBlock.nodes;

    if (!blockNodes || blockNodes.length === 0) {
      // Fetch the block's full structure from API
      try {
        const res = await fetch(`/api/blocks/${encodeURIComponent(blockId)}?version=${encodeURIComponent(version)}`);
        if (res.ok) {
          const fetchedBlock = await res.json();
          blockNodes = fetchedBlock.nodes || [];
        } else {
          console.error('Failed to fetch block:', blockId);
          return;
        }
      } catch (err) {
        console.error('Error fetching block:', err);
        return;
      }
    }

    if (!blockNodes || blockNodes.length === 0) {
      console.warn('Block has no nodes:', blockId);
      return;
    }

    // Find the block's root node
    const blockRoot = blockNodes.find(n => n.parentNodeId === null);
    if (!blockRoot) {
      console.warn('Block has no root node:', blockId);
      return;
    }

    // Create a mapping from old nodeIds to new nodeIds
    const idMap = new Map();
    blockNodes.forEach(node => {
      idMap.set(node.nodeId, generateNodeId());
    });

    // The block's root will be attached to the target parent
    const newRootId = idMap.get(blockRoot.nodeId);

    // Copy all block nodes with new IDs and provenance tracking
    const now = new Date().toISOString();
    const embeddedNodes = blockNodes.map(node => {
      const newNodeId = idMap.get(node.nodeId);
      const newParentNodeId = node.parentNodeId === null
        ? parentNodeId  // Attach block root to target parent
        : idMap.get(node.parentNodeId);

      // Remap childrenNodeIds
      const newChildrenNodeIds = (node.childrenNodeIds || [])
        .map(childId => idMap.get(childId))
        .filter(Boolean);

      return {
        ...node,
        nodeId: newNodeId,
        parentNodeId: newParentNodeId,
        childrenNodeIds: newChildrenNodeIds,
        // Keep original role (section, group, field, etc.) - NOT 'block'
        role: node.nodeId === blockRoot.nodeId ? 'group' : (node.role || 'field'),
        // Track provenance
        _blockSource: {
          blockId: blockId,
          version: version,
          embeddedAt: now,
          originalNodeId: node.nodeId
        }
      };
    });

    // Update parent's childrenNodeIds to include the new block root
    const updatedNodes = [...nodes];
    if (parentNodeId) {
      const parentIndex = updatedNodes.findIndex(n => n.nodeId === parentNodeId);
      if (parentIndex !== -1) {
        updatedNodes[parentIndex] = {
          ...updatedNodes[parentIndex],
          childrenNodeIds: [...updatedNodes[parentIndex].childrenNodeIds, newRootId]
        };
      }
    }

    onNodesChange([...updatedNodes, ...embeddedNodes]);
    setSelectedNodeId(newRootId);
    setExpandedNodes(prev => new Set([...prev, newRootId]));
  };

  // Legacy reference-based approach (kept for backward compatibility)
  const addBuildingBlockReference = (buildingBlock, parentNodeId = rootNode?.nodeId || null) => {
    // Use the new embedding approach instead
    embedBuildingBlock(buildingBlock, parentNodeId);
  };

  // Create wrapper for selected nodes
  const createWrapper = () => {
    if (!rootNode) return;
    const wrapCandidates = selectedForWrapper.filter((nodeId) => nodeMap.get(nodeId)?.parentNodeId === rootNode.nodeId);
    if (wrapCandidates.length < 2) return;

    const wrapperId = generateNodeId();
    const wrapperAttribute = wrapperName.toLowerCase().replace(/\s+/g, '');

    // Create wrapper node
    const wrapperNode = {
      nodeId: wrapperId,
      name: wrapperName,
      attribute: wrapperAttribute,
      role: 'group',
      dataType: 'object',
      parentNodeId: rootNode?.nodeId || null,
      occurrences: { min: 1, max: 1 },
      childrenNodeIds: wrapCandidates
    };

    // Update selected nodes to have wrapper as parent
    const updatedNodes = nodes.map(node => {
      if (wrapCandidates.includes(node.nodeId)) {
        return { ...node, parentNodeId: wrapperId };
      }
      // Remove from root's children if they were there
      if (node.nodeId === rootNode?.nodeId) {
        return {
          ...node,
          childrenNodeIds: node.childrenNodeIds.filter(id => !wrapCandidates.includes(id))
        };
      }
      return node;
    });

    // Add wrapper to root's children
    const finalNodes = updatedNodes.map(node => {
      if (node.nodeId === rootNode?.nodeId) {
        return {
          ...node,
          childrenNodeIds: [...node.childrenNodeIds, wrapperId]
        };
      }
      return node;
    });

    onNodesChange([...finalNodes, wrapperNode]);
    setSelectedForWrapper([]);
    setShowWrapperDialog(false);
    setWrapperName('Custom Group');
  };

  // Delete a node and its children
  const deleteNode = (nodeId) => {
    const node = nodeMap.get(nodeId);
    if (isProjectHeaderNode(node)) return;
    const nodesToDelete = new Set([nodeId]);

    // Recursively find all descendants
    const findDescendants = (id) => {
      const children = getChildren(id);
      children.forEach(child => {
        nodesToDelete.add(child.nodeId);
        findDescendants(child.nodeId);
      });
    };
    findDescendants(nodeId);

    // Remove nodes and update parent's childrenNodeIds
    const updatedNodes = nodes
      .filter(n => !nodesToDelete.has(n.nodeId))
      .map(n => {
        if (n.nodeId === node?.parentNodeId) {
          return {
            ...n,
            childrenNodeIds: n.childrenNodeIds.filter(id => id !== nodeId)
          };
        }
        return n;
      });

    onNodesChange(updatedNodes);
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
  };

  // Open Extract to Block dialog
  const openExtractDialog = (nodeId) => {
    const node = nodeMap.get(nodeId);
    if (node) {
      setExtractNodeId(nodeId);
      setExtractBlockName(node.name);
      setExtractBlockDescription(`Extracted from ${definitionName}`);
      setShowExtractDialog(true);
    }
  };

  const openRecommendedExtractDialog = (recommendation) => {
    if (!recommendation?.nodeId) return;
    const node = nodeMap.get(recommendation.nodeId);
    if (!node) return;
    const suggestedName = recommendation?.suggestedBlockId
      ? recommendation.suggestedBlockId.replace(/^block\./, '').replace(/\.v\d+$/, '')
      : node.name;
    setExtractNodeId(node.nodeId);
    setExtractBlockName(suggestedName || node.name);
    setExtractBlockDescription(recommendation?.reason || `Extracted from ${definitionName}`);
    setShowExtractDialog(true);
  };

  const isProjectHeaderNode = (node) => {
    return isProjectHeaderNodeLike(node);
  };

  // Extract a subtree as a reusable block
  const extractToBlock = async () => {
    if (!extractNodeId || !extractBlockName.trim()) return;

    setExtractLoading(true);

    try {
      const nodeToExtract = nodeMap.get(extractNodeId);
      if (!nodeToExtract) throw new Error('Node not found');

      // Get all descendants (including the node itself)
      const getDescendantNodes = (nodeId) => {
        const node = nodeMap.get(nodeId);
        if (!node) return [];
        const descendants = [node];
        const children = getChildren(nodeId);
        children.forEach(child => {
          descendants.push(...getDescendantNodes(child.nodeId));
        });
        return descendants;
      };

      const subtreeNodes = getDescendantNodes(extractNodeId);

      // Re-root the nodes for the block (root node gets parentNodeId = null)
      const blockNodes = subtreeNodes.map(node => {
        const newNode = { ...node };
        if (node.nodeId === extractNodeId) {
          newNode.parentNodeId = null;
        }
        return newNode;
      });

      // Generate block ID
      const normalizedBlockName = extractBlockName.replace(/[^A-Za-z0-9]/g, '');
      const blockId = `block.${normalizedBlockName || 'ExtractedBlock'}.v1`;

      // Create the block document (block/1 schema)
      const blockDoc = {
        schema: 'block/1',
        blockId,
        name: extractBlockName,
        description: extractBlockDescription,
        version: '1.0.0',
        status: 'draft',
        origin: 'custom',
        defaultEmit: 'auto',
        nodes: blockNodes,
        bindings: [],
        metadata: {
          tags: ['extracted'],
          createdAt: new Date().toISOString(),
          extractedFrom: definitionName
        }
      };

      // Save the block
      const response = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(blockDoc)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save block');
      }

      const savedBlock = await response.json();

      // Replace the subtree with a block reference node
      const blockRefNode = {
        nodeId: extractNodeId,  // Keep the same nodeId
        name: extractBlockName,
        attribute: nodeToExtract.attribute,
        role: 'block',
        dataType: 'object',
        parentNodeId: nodeToExtract.parentNodeId,
        occurrences: nodeToExtract.occurrences,
        childrenNodeIds: [],
        blockId: blockId,
        versionRange: '^1.0.0',
        description: `Reference to ${extractBlockName} block`
      };

      // Remove all descendant nodes and replace root with block ref
      const descendantIds = new Set(subtreeNodes.map(n => n.nodeId));
      const updatedNodes = nodes
        .filter(n => !descendantIds.has(n.nodeId))
        .concat(blockRefNode);

      onNodesChange(updatedNodes);

      // Refresh building blocks list
      setBuildingBlocks(prev => [...prev, savedBlock.block || savedBlock]);

      // Close dialog
      setShowExtractDialog(false);
      setExtractNodeId(null);
      setExtractBlockName('');
      setExtractBlockDescription('');

    } catch (error) {
      console.error('Extract to block failed:', error);
      alert(`Failed to extract block: ${error.message}`);
    } finally {
      setExtractLoading(false);
    }
  };

  // Update a single node
  const updateNode = (nodeId, updates) => {
    // Keep role/type coherence to avoid invalid combinations.
    if (updates.role) {
      const currentNode = nodeMap.get(nodeId);
      const candidateType = updates.dataType || currentNode?.dataType || 'string';
      updates = {
        ...updates,
        dataType: coerceDataTypeForRole(updates.role, candidateType)
      };
    }

    const updatedNodes = nodes.map(n =>
      n.nodeId === nodeId ? { ...n, ...updates } : n
    );
    onNodesChange(updatedNodes);
  };

  const addTerminologyBinding = (nodeId, partial = {}) => {
    const selectedNode = nodeMap.get(nodeId);
    if (!selectedNode) return;
    const nextIndex = Array.isArray(selectedNode.terminologyBindings) ? selectedNode.terminologyBindings.length : 0;
    const system = partial.system || inferPreferredTerminologySystem(selectedNode);
    const nextBinding = {
      system,
      code: '',
      display: '',
      valueSet: '',
      bindingStrength: 'required',
      ...partial
    };
    updateNode(nodeId, {
      terminologyBindings: [...(selectedNode.terminologyBindings || []), nextBinding]
    });
    setPendingTerminologyFocus({ index: nextIndex, field: 'system' });
  };

  const updateTerminologyBinding = (nodeId, index, updates) => {
    const selectedNode = nodeMap.get(nodeId);
    if (!selectedNode) return;
    const existing = Array.isArray(selectedNode.terminologyBindings) ? selectedNode.terminologyBindings : [];
    if (!existing[index]) return;
    const nextBindings = [...existing];
    nextBindings[index] = { ...nextBindings[index], ...updates };
    updateNode(nodeId, { terminologyBindings: nextBindings });
  };

  const removeTerminologyBinding = (nodeId, index) => {
    const selectedNode = nodeMap.get(nodeId);
    if (!selectedNode) return;
    const existing = Array.isArray(selectedNode.terminologyBindings) ? selectedNode.terminologyBindings : [];
    if (!existing[index]) return;
    const nextBindings = [...existing];
    nextBindings.splice(index, 1);
    updateNode(nodeId, { terminologyBindings: nextBindings });
  };

  const updateNodeReferenceTarget = (nodeId, targetNodeId) => {
    if (!targetNodeId) {
      updateNode(nodeId, { referencedObjectId: undefined });
      return;
    }
    updateNode(nodeId, { referencedObjectId: targetNodeId });
  };

  const trackRecentTerminologySystem = (system) => {
    if (!isNonEmptyString(system)) return;
    setRecentTerminologySystems((prev) => {
      const next = [system, ...prev.filter((item) => item !== system)];
      return next.slice(0, 6);
    });
  };

  const toggleFavoriteTerminologySystem = (system) => {
    if (!isNonEmptyString(system)) return;
    setFavoriteTerminologySystems((prev) => (
      prev.includes(system) ? prev.filter((item) => item !== system) : [...prev, system]
    ));
  };

  const applyCatalogTerminology = (nodeId, system, valueSet = '') => {
    const selectedNode = nodeMap.get(nodeId);
    if (!selectedNode || !isNonEmptyString(system)) return;

    const bindings = Array.isArray(selectedNode.terminologyBindings) ? selectedNode.terminologyBindings : [];
    if (isNonEmptyString(valueSet)) {
      const existingIndex = bindings.findIndex((binding) => `${binding?.system || ''}`.trim() === system && !isNonEmptyString(binding?.valueSet));
      if (existingIndex >= 0) {
        updateTerminologyBinding(nodeId, existingIndex, { valueSet });
        trackRecentTerminologySystem(system);
        return;
      }
    }

    addTerminologyBinding(nodeId, {
      system,
      valueSet: valueSet || '',
      bindingStrength: valueSet ? 'extensible' : 'required'
    });
    trackRecentTerminologySystem(system);
  };

  const focusNextTerminologyControl = (currentTarget) => {
    const panel = terminologyPanelRef.current;
    if (!panel || !currentTarget) return false;

    const controls = Array.from(panel.querySelectorAll('[data-term-control="true"]'))
      .filter((element) => !element.disabled && (element.offsetParent !== null || document.activeElement === element));
    const currentIndex = controls.indexOf(currentTarget);
    if (currentIndex < 0 || currentIndex >= controls.length - 1) return false;

    const next = controls[currentIndex + 1];
    if (!next || typeof next.focus !== 'function') return false;
    next.focus();
    if (next.tagName === 'INPUT' && typeof next.select === 'function') {
      next.select();
    }
    return true;
  };

  const handleTerminologyControlKeyDown = (event, nodeId, node) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    const moved = focusNextTerminologyControl(event.currentTarget);
    if (!moved) {
      applyCatalogTerminology(nodeId, inferPreferredTerminologySystem(node));
    }
  };

  const handleTerminologyPanelShortcutKeyDown = (event, nodeId, node) => {
    if (!(event.altKey && event.shiftKey)) return;
    const key = `${event.key || ''}`.toLowerCase();
    if (key === 'b') {
      event.preventDefault();
      applyCatalogTerminology(nodeId, inferPreferredTerminologySystem(node));
      return;
    }
    if (key === 'c') {
      event.preventDefault();
      setShowTerminologyCatalog((prev) => !prev);
    }
  };

  const toggleNodeBulkSelection = (nodeId) => {
    setSelectedForWrapper((prev) => (
      prev.includes(nodeId) ? prev.filter((id) => id !== nodeId) : [...prev, nodeId]
    ));
  };

  const selectAllCodeNodesForBulk = () => {
    const ids = nodes
      .filter((node) => node.parentNodeId !== null)
      .filter((node) => !isProjectHeaderNodeLike(node))
      .filter((node) => isCodeLikeDataType(node.dataType))
      .map((node) => node.nodeId);
    setSelectedForWrapper(ids);
    setShowBulkTerminologyPanel(ids.length > 0);
    setBulkTerminologyFeedback(ids.length > 0 ? `Selected ${ids.length} coded nodes.` : 'No coded nodes available.');
  };

  const clearBulkSelection = () => {
    setSelectedForWrapper([]);
    setBulkTerminologyFeedback('Selection cleared.');
  };

  const applyBulkTerminologyToSelection = () => {
    if (!isNonEmptyString(bulkTerminologySystem)) {
      setBulkTerminologyFeedback('Choose a terminology system first.');
      return;
    }
    const eligibleIds = new Set(bulkEligibleNodeRecords.map((node) => node.nodeId));
    if (eligibleIds.size === 0) {
      setBulkTerminologyFeedback('No eligible selected nodes for this bulk action.');
      return;
    }

    const valueSet = bulkTerminologyValueSet.trim();
    let touched = 0;
    const updatedNodes = nodes.map((node) => {
      if (!eligibleIds.has(node.nodeId)) return node;
      const bindings = Array.isArray(node.terminologyBindings) ? [...node.terminologyBindings] : [];
      const existingIndex = bindings.findIndex((binding) => (
        `${binding?.system || ''}`.trim() === bulkTerminologySystem
        && (!valueSet || `${binding?.valueSet || ''}`.trim() === valueSet)
      ));

      if (existingIndex >= 0) {
        bindings[existingIndex] = {
          ...bindings[existingIndex],
          bindingStrength: bulkTerminologyStrength,
          ...(valueSet ? { valueSet } : {})
        };
      } else {
        bindings.push({
          system: bulkTerminologySystem,
          code: '',
          display: '',
          valueSet,
          bindingStrength: bulkTerminologyStrength
        });
      }
      touched += 1;
      return { ...node, terminologyBindings: bindings };
    });

    if (touched === 0) {
      setBulkTerminologyFeedback('No nodes were updated.');
      return;
    }

    onNodesChange(updatedNodes);
    trackRecentTerminologySystem(bulkTerminologySystem);
    setBulkTerminologyFeedback(`Applied ${bulkTerminologySystem} to ${touched} node${touched === 1 ? '' : 's'}.`);
  };

  // Add a new field to a node
  const addFieldToNode = (parentNodeId) => {
    const newNodeId = generateNodeId();
    const newNode = {
      nodeId: newNodeId,
      name: 'New Field',
      attribute: 'newField',
      role: 'field',
      dataType: 'string',
      parentNodeId: parentNodeId,
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: []
    };

    // Update parent's childrenNodeIds and ensure dataType is 'object' for container nodes
    const updatedNodes = nodes.map(n => {
      if (n.nodeId === parentNodeId) {
        return {
          ...n,
          dataType: 'object', // Ensure parent can contain children
          childrenNodeIds: [...n.childrenNodeIds, newNodeId]
        };
      }
      return n;
    });

    onNodesChange([...updatedNodes, newNode]);
  };

  // Add a sibling field (same parent as selected node)
  const addSiblingField = (nodeId) => {
    const node = nodes.find(n => n.nodeId === nodeId);
    if (!node || !node.parentNodeId) return; // Can't add sibling to root

    const parentNodeId = node.parentNodeId;
    const newNodeId = generateNodeId();
    const newNode = {
      nodeId: newNodeId,
      name: 'New Field',
      attribute: 'newField',
      role: 'field',
      dataType: 'string',
      parentNodeId: parentNodeId,
      occurrences: { min: 0, max: 1 },
      childrenNodeIds: []
    };

    // Update parent's childrenNodeIds - add after the current node
    const updatedNodes = nodes.map(n => {
      if (n.nodeId === parentNodeId) {
        const currentIndex = n.childrenNodeIds.indexOf(nodeId);
        const newChildren = [...n.childrenNodeIds];
        newChildren.splice(currentIndex + 1, 0, newNodeId);
        return {
          ...n,
          childrenNodeIds: newChildren
        };
      }
      return n;
    });

    onNodesChange([...updatedNodes, newNode]);
  };

  // AI Chatbot - send message with full context
  const sendAIMessage = async (messageOverride = null) => {
    if (aiLoading) return;
    const userMessage = (messageOverride ?? aiChatInput).trim();
    if (!userMessage) return;

    const userTurn = { role: 'user', content: userMessage };
    const conversation = [...aiChatHistory, userTurn];
    setAIChatHistory(prev => [...prev, userTurn]);
    if (!messageOverride) setAIChatInput('');
    setAILoading(true);

    try {
      // Build semantic object for AI request
      const semanticObject = {
        id: 'current-object',
        name: definitionName,
        nodes: nodes.map(n => ({
          nodeId: n.nodeId,
          parentNodeId: n.parentNodeId,
          role: n.role || 'field',
          name: n.name,
          attribute: n.attribute,
          dataType: n.dataType,
          occurrences: n.occurrences,
          childrenNodeIds: n.childrenNodeIds,
          description: n.description
        }))
      };

      // Use new operations-based endpoint
      const response = await fetch('/api/semantic-objects/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          semanticObject,
          userRequest: userMessage,
          chatHistory: conversation
        })
      });

      if (!response.ok) {
        throw new Error('AI service unavailable');
      }

      const result = await response.json();
      const assistantMessage = {
        role: 'assistant',
        content: result.explanation,
        planSummary: result.planSummary || '',
        questions: Array.isArray(result.clarificationQuestions) ? result.clarificationQuestions : [],
        suggestedPrompts: Array.isArray(result.suggestedPrompts) ? result.suggestedPrompts : [],
        coverage: (result.coverage && typeof result.coverage === 'object') ? result.coverage : {},
        recommendedBlocks: Array.isArray(result.recommendedBlocks) ? result.recommendedBlocks : [],
        reusableBlocks: (result.reusableBlocks && typeof result.reusableBlocks === 'object') ? result.reusableBlocks : null,
        agent: (result.agent && typeof result.agent === 'object') ? result.agent : null
      };
      if (assistantMessage.agent) {
        setAIAgentContext(assistantMessage.agent);
      }
      if (assistantMessage.recommendedBlocks.length > 0) {
        setAIRecommendedBlocks(assistantMessage.recommendedBlocks);
      }

      // Apply AI operations if any
      if (result.operations && result.operations.length > 0) {
        const actionsList = applyAIOperations(result.operations);
        setAIChatHistory(prev => [...prev, { ...assistantMessage, actions: actionsList }]);
      } else {
        setAIChatHistory(prev => [...prev, { ...assistantMessage, actions: [] }]);
      }
    } catch (error) {
      console.error('AI error:', error);
      setAIChatHistory(prev => [...prev, {
        role: 'assistant',
        content: `I encountered an error: ${error.message}. Let me help you manually - what fields would you like to add?`,
        planSummary: '',
        questions: [],
        suggestedPrompts: [],
        coverage: {},
        reusableBlocks: null,
        actions: []
      }]);
    } finally {
      setAILoading(false);
    }
  };

  const handleSuggestedPromptClick = (prompt) => {
    if (!prompt || aiLoading) return;
    setAIChatInput(prompt);
    sendAIMessage(prompt);
  };

  useEffect(() => {
    if (!aiBootstrap?.nonce || !aiBootstrap?.open || isAIAssistantDisabled) return;
    if (consumedBootstrapNonceRef.current === aiBootstrap.nonce) return;
    if (aiLoading) return;

    consumedBootstrapNonceRef.current = aiBootstrap.nonce;
    setShowAIPanel(true);

    if (aiBootstrap?.prompt && aiBootstrap.prompt.trim()) {
      setAIChatInput(aiBootstrap.prompt.trim());
      sendAIMessage(aiBootstrap.prompt.trim());
    }
    // sendAIMessage is intentionally excluded to avoid re-trigger loops from function identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiBootstrap?.nonce, aiBootstrap?.open, aiBootstrap?.prompt, aiLoading]);

  // Apply AI node suggestions
  const applyAINodeSuggestions = (newNodes) => {
    // Ensure new nodes have proper parent references
    const processedNodes = newNodes.map(node => ({
      ...node,
      nodeId: node.nodeId || generateNodeId(),
      childrenNodeIds: node.childrenNodeIds || []
    }));

    // Update parent's childrenNodeIds
    const updatedExistingNodes = [...nodes];
    processedNodes.forEach(newNode => {
      if (newNode.parentNodeId) {
        const parentIndex = updatedExistingNodes.findIndex(n => n.nodeId === newNode.parentNodeId);
        if (parentIndex !== -1) {
          const parent = updatedExistingNodes[parentIndex];
          if (!parent.childrenNodeIds.includes(newNode.nodeId)) {
            updatedExistingNodes[parentIndex] = {
              ...parent,
              childrenNodeIds: [...parent.childrenNodeIds, newNode.nodeId]
            };
          }
        }
      }
    });

    onNodesChange([...updatedExistingNodes, ...processedNodes]);
  };

  // Apply AI node updates
  const applyAINodeUpdates = (updates) => {
    const updatedNodes = nodes.map(node => {
      const update = updates.find(u => u.nodeId === node.nodeId);
      if (update) {
        return { ...node, ...update.changes };
      }
      return node;
    });
    onNodesChange(updatedNodes);
  };

  // Apply AI operations (formal contract)
  const applyAIOperations = (operations) => {
    let currentNodes = [...nodes];
    const actions = [];

    for (const op of operations) {
      switch (op.op) {
        case 'add_node': {
          const isBlockNode = (op.node.role || 'field') === 'block';
          const newNode = {
            nodeId: op.node.nodeId || generateNodeId(),
            parentNodeId: op.parentNodeId,
            childrenNodeIds: [],
            role: op.node.role || 'field',
            name: op.node.name,
            attribute: op.node.attribute,
            dataType: op.node.dataType || (isBlockNode ? 'object' : 'string'),
            occurrences: op.node.occurrences || { min: 0, max: 1 },
            description: op.node.description || '',
            constraints: op.node.constraints || {},
            ...(op.node.timeRole && op.node.timeRole !== 'none' ? { timeRole: op.node.timeRole } : {}),
            ...(op.node.referencedObjectId ? { referencedObjectId: op.node.referencedObjectId } : {}),
            ...(op.node.blockId ? { blockId: op.node.blockId } : {}),
            ...(op.node.versionRange ? { versionRange: op.node.versionRange } : {})
          };

          // Update parent's childrenNodeIds
          const parentIndex = currentNodes.findIndex(n => n.nodeId === op.parentNodeId);
          if (parentIndex !== -1) {
            const parent = currentNodes[parentIndex];
            const insertIndex = op.index !== undefined ? op.index : parent.childrenNodeIds.length;
            const newChildrenIds = [...parent.childrenNodeIds];
            newChildrenIds.splice(insertIndex, 0, newNode.nodeId);
            currentNodes[parentIndex] = { ...parent, childrenNodeIds: newChildrenIds };
          }

          currentNodes.push(newNode);
          if (newNode.role === 'block' && newNode.blockId) {
            actions.push(`Added reusable block "${newNode.name}" (${newNode.blockId})`);
          } else {
            actions.push(`Added "${newNode.name}"`);
          }
          break;
        }

        case 'update_node': {
          const nodeIndex = currentNodes.findIndex(n => n.nodeId === op.targetNodeId);
          if (nodeIndex !== -1) {
            currentNodes[nodeIndex] = { ...currentNodes[nodeIndex], ...op.changes };
            actions.push(`Updated "${currentNodes[nodeIndex].name}"`);
          }
          break;
        }

        case 'delete_node': {
          const nodeToDelete = currentNodes.find(n => n.nodeId === op.targetNodeId);
          if (nodeToDelete && nodeToDelete.parentNodeId !== null) {
            // Remove from parent's childrenNodeIds
            const parentIndex = currentNodes.findIndex(n => n.nodeId === nodeToDelete.parentNodeId);
            if (parentIndex !== -1) {
              const parent = currentNodes[parentIndex];
              currentNodes[parentIndex] = {
                ...parent,
                childrenNodeIds: parent.childrenNodeIds.filter(id => id !== op.targetNodeId)
              };
            }

            // Get all descendants to delete
            const getDescendantIds = (nodeId) => {
              const node = currentNodes.find(n => n.nodeId === nodeId);
              if (!node) return [];
              let ids = [nodeId];
              for (const childId of node.childrenNodeIds) {
                ids = ids.concat(getDescendantIds(childId));
              }
              return ids;
            };

            const idsToDelete = getDescendantIds(op.targetNodeId);
            currentNodes = currentNodes.filter(n => !idsToDelete.includes(n.nodeId));
            actions.push(`Deleted "${nodeToDelete.name}" and its children`);
          }
          break;
        }

        case 'move_node': {
          const nodeToMove = currentNodes.find(n => n.nodeId === op.targetNodeId);
          if (nodeToMove && nodeToMove.parentNodeId !== null) {
            // Remove from old parent
            const oldParentIndex = currentNodes.findIndex(n => n.nodeId === nodeToMove.parentNodeId);
            if (oldParentIndex !== -1) {
              const oldParent = currentNodes[oldParentIndex];
              currentNodes[oldParentIndex] = {
                ...oldParent,
                childrenNodeIds: oldParent.childrenNodeIds.filter(id => id !== op.targetNodeId)
              };
            }

            // Add to new parent
            const newParentIndex = currentNodes.findIndex(n => n.nodeId === op.newParentNodeId);
            if (newParentIndex !== -1) {
              const newParent = currentNodes[newParentIndex];
              const insertIndex = op.newIndex !== undefined ? op.newIndex : newParent.childrenNodeIds.length;
              const newChildrenIds = [...newParent.childrenNodeIds];
              newChildrenIds.splice(insertIndex, 0, op.targetNodeId);
              currentNodes[newParentIndex] = { ...newParent, childrenNodeIds: newChildrenIds };
            }

            // Update node's parentNodeId
            const nodeIndex = currentNodes.findIndex(n => n.nodeId === op.targetNodeId);
            if (nodeIndex !== -1) {
              currentNodes[nodeIndex] = { ...currentNodes[nodeIndex], parentNodeId: op.newParentNodeId };
            }

            actions.push(`Moved "${nodeToMove.name}" to new location`);
          }
          break;
        }

        default:
          console.warn('Unknown operation:', op);
      }
    }

    onNodesChange(currentNodes);
    return actions;
  };

  // Drag and drop handlers
  const handleDragStart = (template, e) => {
    e.dataTransfer.setData('template', JSON.stringify(template));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e, targetNodeId = null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(targetNodeId);
  };

  const handleDrop = (e, targetNodeId = rootNode?.nodeId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverTarget(null);

    const templateData = e.dataTransfer.getData('template');
    if (templateData) {
      const template = JSON.parse(templateData);
      const fullTemplate = BLOCK_TEMPLATES.find(t => t.id === template.id);
      if (fullTemplate) {
        addNodesFromTemplate(fullTemplate, targetNodeId);
      }
    }
  };

  // Get color classes
  const getColorClasses = (dataType) => {
    switch (dataType) {
      case 'object': return 'border-orange-500/50 bg-orange-500/5 hover:bg-orange-500/10';
      case 'array': return 'border-yellow-500/50 bg-yellow-500/5 hover:bg-yellow-500/10';
      case 'string': return 'border-blue-500/50 bg-blue-500/5 hover:bg-blue-500/10';
      case 'number':
      case 'quantity': return 'border-green-500/50 bg-green-500/5 hover:bg-green-500/10';
      case 'code': return 'border-purple-500/50 bg-purple-500/5 hover:bg-purple-500/10';
      case 'boolean': return 'border-cyan-500/50 bg-cyan-500/5 hover:bg-cyan-500/10';
      case 'date': return 'border-pink-500/50 bg-pink-500/5 hover:bg-pink-500/10';
      default: return 'border-slate-500/50 bg-slate-500/5 hover:bg-slate-500/10';
    }
  };

  const getReusableNodeClasses = (node) => {
    const isBlockReference = node.role === 'block' || !!node.blockId;
    const isEmbeddedFromBlock = !!node._blockSource;
    if (isBlockReference) {
      const libraryBlock = buildingBlockById.get(node.blockId);
      if (libraryBlock?._readOnly) {
        return 'border-purple-400/70 bg-purple-500/10 hover:bg-purple-500/15';
      }
      return 'border-cyan-400/70 bg-cyan-500/10 hover:bg-cyan-500/15';
    }
    if (isEmbeddedFromBlock) {
      return 'border-teal-400/60 bg-teal-500/10 hover:bg-teal-500/15';
    }
    return getColorClasses(node.dataType);
  };

  const getTemplateColorClasses = (color) => {
    switch (color) {
      case 'blue': return 'border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20';
      case 'purple': return 'border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/20';
      case 'red': return 'border-red-500/50 bg-red-500/10 hover:bg-red-500/20';
      case 'green': return 'border-green-500/50 bg-green-500/10 hover:bg-green-500/20';
      default: return 'border-slate-500/50 bg-slate-500/10 hover:bg-slate-500/20';
    }
  };

  // Render node tree
  const renderNode = (node, depth = 0) => {
    const children = getChildren(node.nodeId);
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes.has(node.nodeId);
    const isSelected = selectedNodeId === node.nodeId;
    const isDropTarget = dragOverTarget === node.nodeId;
    const isSelectedForWrapper = selectedForWrapper.includes(node.nodeId);
    const isHeaderNode = isProjectHeaderNode(node);

    return (
      <div key={node.nodeId} className="mb-1">
        <div
          onClick={() => setSelectedNodeId(node.nodeId)}
          onDragOver={(e) => handleDragOver(e, node.nodeId)}
          onDragLeave={() => setDragOverTarget(null)}
          onDrop={(e) => handleDrop(e, node.nodeId)}
          className={`
            relative group border-2 rounded-lg p-2 cursor-pointer transition-all
            ${getReusableNodeClasses(node)}
            ${isSelected ? 'ring-2 ring-primary shadow-lg' : ''}
            ${isDropTarget ? 'ring-2 ring-yellow-400 bg-yellow-400/10' : ''}
            ${isSelectedForWrapper ? 'ring-2 ring-orange-400' : ''}
          `}
          style={{ marginLeft: `${depth * 20}px` }}
        >
          <div className="flex items-center gap-2">
            {/* Expand/Collapse */}
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedNodes(prev => {
                    const next = new Set(prev);
                    if (next.has(node.nodeId)) {
                      next.delete(node.nodeId);
                    } else {
                      next.add(node.nodeId);
                    }
                    return next;
                  });
                }}
                className="p-0.5 hover:bg-background rounded"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            )}
            {!hasChildren && <div className="w-5" />}

            {/* Bulk selection checkbox */}
            {node.parentNodeId !== null && !isHeaderNode && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNodeBulkSelection(node.nodeId);
                }}
                className="p-0.5 hover:bg-background rounded"
                title={isSelectedForWrapper ? 'Unselect for bulk actions' : 'Select for bulk actions'}
              >
                {isSelectedForWrapper ? (
                  <CheckSquare size={14} className="text-orange-400" />
                ) : (
                  <Square size={14} className="text-theme-secondary" />
                )}
              </button>
            )}

            {/* Node info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-theme-primary text-sm truncate">{node.name}</span>
                <span className="text-xs text-purple-400 px-1.5 py-0.5 bg-purple-500/10 rounded">
                  {node.role || 'field'}
                </span>
                <span className="text-xs text-theme-secondary px-1.5 py-0.5 bg-background rounded">
                  {node.dataType}
                </span>
                <span className="text-xs text-theme-secondary">
                  [{node.occurrences.min}..{node.occurrences.max}]
                </span>
                {(node.role === 'block' || !!node.blockId) && (
                  <span className="text-xs text-cyan-300 px-1.5 py-0.5 bg-cyan-500/20 rounded flex items-center gap-1">
                    <GitBranch size={10} />
                    reusable block
                  </span>
                )}
                {isHeaderNode && (
                  <span className="text-xs text-amber-300 px-1.5 py-0.5 bg-amber-500/20 rounded">
                    project header
                  </span>
                )}
                {!!node._blockSource && (
                  <span className="text-xs text-teal-300 px-1.5 py-0.5 bg-teal-500/20 rounded flex items-center gap-1">
                    <GitBranch size={10} />
                    from reusable block
                  </span>
                )}
                {/* Reference indicator */}
                {node.referencedObjectId && (
                  <span className="text-xs text-cyan-400 px-1.5 py-0.5 bg-cyan-500/20 rounded flex items-center gap-1">
                    <GitBranch size={10} />
                    ref
                  </span>
                )}
                {/* Time role indicator */}
                {node.timeRole && node.timeRole !== 'none' && (
                  <span className="text-xs text-blue-400 px-1.5 py-0.5 bg-blue-500/20 rounded flex items-center gap-1">
                    <Clock size={10} />
                    {node.timeRole}
                  </span>
                )}
              </div>
              <div className="text-xs text-theme-secondary font-mono truncate">
                {node.attribute}
              </div>
              {(node.role === 'block' || !!node.blockId) && node.blockId && (
                <div className="text-[10px] text-cyan-300/90 font-mono truncate mt-0.5">
                  {node.blockId} {node.versionRange ? `(${node.versionRange})` : ''}
                </div>
              )}
              {!!node._blockSource && (
                <div className="text-[10px] text-teal-300/90 font-mono truncate mt-0.5">
                  source: {node._blockSource.blockId || 'reusable block'} {node._blockSource.version ? `v${node._blockSource.version}` : ''}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="hidden group-hover:flex items-center gap-1">
              {/* Add sibling - for non-root nodes */}
              {node.parentNodeId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addSiblingField(node.nodeId);
                  }}
                  className="p-1 hover:bg-background rounded text-blue-400"
                  title="Add sibling field"
                >
                  <GitBranch size={12} />
                </button>
              )}
              {/* Add child - for object nodes, groups, and sections */}
              {(node.dataType === 'object' || node.role === 'group' || node.role === 'section') && !node.referencedObjectId && node.role !== 'block' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addFieldToNode(node.nodeId);
                  }}
                  className="p-1 hover:bg-background rounded text-green-400"
                  title="Add child field"
                >
                  <Plus size={12} />
                </button>
              )}
              {/* Extract to Block - only for object nodes with children, not root */}
              {node.parentNodeId !== null && node.dataType === 'object' && hasChildren && node.role !== 'block' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openExtractDialog(node.nodeId);
                  }}
                  className="p-1 hover:bg-background rounded text-cyan-400"
                  title="Extract to Block"
                >
                  <Upload size={12} />
                </button>
              )}
              {node.parentNodeId !== null && !isHeaderNode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNode(node.nodeId);
                  }}
                  className="p-1 hover:bg-background rounded text-red-400"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div className="mt-1">
            {children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div ref={composerRef} className="h-full flex">
      {/* Reusable Block Panel */}
      <div className={`border-r border-theme bg-surface flex flex-col transition-all duration-300 ${libraryCollapsed ? 'w-12' : 'w-72'}`}>
        {libraryCollapsed ? (
          <div className="flex flex-col items-center py-4">
            <button
              onClick={() => setLibraryCollapsed(false)}
              className="p-2 hover:bg-background rounded-lg transition-colors mb-4"
              title="Expand library"
            >
              <ChevronRight size={20} className="text-theme-secondary" />
            </button>
            <Package size={20} className="text-theme-secondary mb-2" />
            <span className="text-xs text-theme-secondary [writing-mode:vertical-rl] rotate-180">Library</span>
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-theme flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-theme-primary flex items-center gap-2">
                  <Package size={16} />
                  Reusable Blocks
                </h3>
                <button
                  onClick={() => setLibraryCollapsed(true)}
                  className="p-1 hover:bg-background rounded"
                  title="Collapse"
                >
                  <ChevronLeft size={16} className="text-theme-secondary" />
                </button>
              </div>

              <div className="relative mb-2">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-theme-secondary" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search blocks..."
                  className="w-full pl-8 pr-3 py-1.5 bg-background border border-theme rounded text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary text-xs"
                />
              </div>
              <p className="text-[11px] text-theme-secondary">
                One list with reusable sample and saved blocks.
              </p>
            </div>

            <div className="flex-1 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-2 space-y-2 min-h-0">
              {buildingBlocksLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-theme-secondary" />
                  <span className="text-xs text-theme-secondary ml-2">Loading...</span>
                </div>
              ) : libraryItems.length === 0 ? (
                <div className="text-center py-4">
                  <Package size={24} className="mx-auto mb-2 opacity-50 text-theme-secondary" />
                  <p className="text-xs text-theme-secondary">No blocks found</p>
                  <p className="text-xs text-theme-secondary mt-1">
                    Create one with &quot;New Block&quot; or extract from your object
                  </p>
                </div>
              ) : (
                libraryItems.map((item) => {
                  return (
                    <div
                      key={item.id}
                      draggable={false}
                      className={`p-2 border-2 rounded cursor-pointer transition-all ${
                        item._readOnly
                          ? 'border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10'
                          : 'border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/10'
                      }`}
                      onClick={() => addBuildingBlockReference(item)}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <GitBranch size={14} className={item._readOnly ? 'text-purple-400' : 'text-cyan-400'} />
                        <span className="font-medium text-theme-primary text-xs">{item.name}</span>
                        <span className={`text-xs px-1 py-0.5 rounded ${
                          item._readOnly
                            ? 'text-purple-400 bg-purple-500/20'
                            : 'text-cyan-400 bg-cyan-500/20'
                        }`}>
                          {item._readOnly ? 'sample' : 'saved'}
                        </span>
                      </div>
                      <p className="text-xs text-theme-secondary">{item.description || 'Reusable block'}</p>
                      <div className="mt-1 text-xs text-theme-secondary opacity-75 font-mono">
                        {item.blockId} {item.version ? `v${item.version}` : ''}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Main Canvas */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Canvas Header */}
        <div className="p-3 border-b border-theme bg-surface flex items-center justify-between flex-shrink-0">
          <h3 className="text-sm font-semibold text-theme-primary flex items-center gap-2">
            <GitBranch size={16} />
            Structure Tree
          </h3>
          <div className="flex items-center gap-2">
            {selectedForWrapper.length > 0 && (
              <button
                onClick={() => setShowBulkTerminologyPanel((prev) => !prev)}
                className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-xs ${
                  showBulkTerminologyPanel
                    ? 'bg-cyan-500/30 text-cyan-200'
                    : 'bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25'
                }`}
                title="Open bulk terminology actions"
              >
                <Sparkles size={12} />
                Bulk Terminology ({selectedForWrapper.length})
              </button>
            )}
            {canWrapSelection && (
              <button
                onClick={() => setShowWrapperDialog(true)}
                className="flex items-center gap-1 px-2 py-1 bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30 transition-colors text-xs"
              >
                <Combine size={12} />
                Wrap Selected ({wrapCandidateCount})
              </button>
            )}
            {selectedForWrapper.length === 0 && (
              <button
                onClick={selectAllCodeNodesForBulk}
                className="flex items-center gap-1 px-2 py-1 bg-slate-500/20 text-slate-300 rounded hover:bg-slate-500/30 transition-colors text-xs"
              >
                <CheckSquare size={12} />
                Select Code Fields
              </button>
            )}
            {!isAIAssistantDisabled && (
              <button
                onClick={() => setShowAIPanel(!showAIPanel)}
                className={`flex items-center gap-1 px-2 py-1 rounded transition-colors text-xs ${showAIPanel
                    ? 'bg-purple-500/30 text-purple-300'
                    : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                  }`}
              >
                <Sparkles size={12} />
                AI Assistant
              </button>
            )}
            {aiRecommendedBlocks.length > 0 && !showReusableDock && (
              <button
                onClick={() => {
                  setShowReusableDock(true);
                  setMinimizedReusableDock(true);
                }}
                className="flex items-center gap-1 px-2 py-1 rounded transition-colors text-xs bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25"
              >
                <GitBranch size={12} />
                Reusable ({aiRecommendedBlocks.length})
              </button>
            )}
            <span className="text-xs text-theme-secondary">
              {nodes.length} nodes
            </span>
          </div>
        </div>

        {showBulkTerminologyPanel && selectedForWrapper.length > 0 && (
          <div className="px-3 py-2 border-b border-theme bg-cyan-500/5 flex flex-wrap items-end gap-2">
            <div className="text-xs text-cyan-300 min-w-[140px]">
              {selectedForWrapper.length} selected
              <div className="text-[10px] text-theme-secondary">
                {bulkEligibleNodeRecords.length} eligible for current filter
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-theme-secondary mb-0.5">System</label>
              <select
                value={bulkTerminologySystem}
                onChange={(e) => setBulkTerminologySystem(e.target.value)}
                className="px-2 py-1 bg-background border border-theme rounded text-theme-primary text-xs min-w-[130px]"
              >
                {TERMINOLOGY_SYSTEM_OPTIONS.map((option) => (
                  <option key={`bulk-system-${option.value}`} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-theme-secondary mb-0.5">Value set</label>
              <input
                type="text"
                value={bulkTerminologyValueSet}
                onChange={(e) => setBulkTerminologyValueSet(e.target.value)}
                placeholder="optional URL/URN/id"
                className="px-2 py-1 bg-background border border-theme rounded text-theme-primary text-xs w-[220px] font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] text-theme-secondary mb-0.5">Strength</label>
              <select
                value={bulkTerminologyStrength}
                onChange={(e) => setBulkTerminologyStrength(e.target.value)}
                className="px-2 py-1 bg-background border border-theme rounded text-theme-primary text-xs min-w-[120px]"
              >
                {TERMINOLOGY_STRENGTH_OPTIONS.map((option) => (
                  <option key={`bulk-strength-${option}`} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1 text-xs text-theme-secondary pb-1">
              <input
                type="checkbox"
                checked={bulkTerminologyCodeOnly}
                onChange={(e) => setBulkTerminologyCodeOnly(e.target.checked)}
                className="rounded border-theme"
              />
              Code fields only
            </label>
            <button
              onClick={applyBulkTerminologyToSelection}
              className="px-2 py-1 bg-cyan-500/20 text-cyan-200 rounded hover:bg-cyan-500/30 text-xs"
            >
              Apply Bulk
            </button>
            <button
              onClick={selectAllCodeNodesForBulk}
              className="px-2 py-1 border border-theme text-theme-secondary rounded hover:text-theme-primary hover:border-primary text-xs"
            >
              Select Code Fields
            </button>
            <button
              onClick={clearBulkSelection}
              className="px-2 py-1 border border-theme text-theme-secondary rounded hover:text-theme-primary hover:border-primary text-xs"
            >
              Clear Selection
            </button>
            {bulkTerminologyFeedback && (
              <div className="text-[11px] text-cyan-200">
                {bulkTerminologyFeedback}
              </div>
            )}
          </div>
        )}

        {/* Canvas Content */}
        <div
          ref={canvasRef}
          className={`flex-1 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden p-3 bg-background min-h-0 ${
            aiRecommendedBlocks.length > 0 && showReusableDock && !minimizedReusableDock ? 'pb-48' : ''
          }`}
          onDragOver={(e) => handleDragOver(e, rootNode?.nodeId)}
          onDrop={(e) => handleDrop(e, rootNode?.nodeId)}
        >
          {!rootNode ? (
            <div className="h-full min-h-[300px] flex items-center justify-center border-2 border-dashed border-theme rounded-lg">
              <div className="text-center text-theme-secondary">
                <Layers size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">No structure yet</p>
                <p className="text-xs mt-1">
                  Use the AI assistant or add blocks from the library
                </p>
              </div>
            </div>
          ) : (
            <div>
              {renderNode(rootNode)}
            </div>
          )}
        </div>

        {aiRecommendedBlocks.length > 0 && showReusableDock && (
          minimizedReusableDock ? (
            <div className="absolute bottom-0 left-0 right-0 border-t border-cyan-500/40 bg-surface px-3 py-2 flex items-center justify-between gap-2 z-20">
              <button
                onClick={() => setMinimizedReusableDock(false)}
                className="flex items-center gap-2 text-xs text-cyan-300 hover:text-cyan-200 transition-colors"
              >
                <ChevronRight size={12} />
                Reusable block candidates ({aiRecommendedBlocks.length})
              </button>
              <button
                onClick={() => setShowReusableDock(false)}
                className="p-1 rounded hover:bg-background text-theme-secondary"
                title="Close"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="absolute bottom-0 left-0 right-0 border-t border-cyan-500/40 bg-surface z-20">
              <div className="px-3 py-2 flex items-center justify-between">
                <h4 className="text-xs font-medium text-cyan-300">
                  Reusable block candidates ({aiRecommendedBlocks.length})
                </h4>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setMinimizedReusableDock(true)}
                    className="p-1 rounded hover:bg-background text-theme-secondary"
                    title="Minimize"
                  >
                    <ChevronDown size={12} />
                  </button>
                  <button
                    onClick={() => setShowReusableDock(false)}
                    className="p-1 rounded hover:bg-background text-theme-secondary"
                    title="Close"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
              <div className="px-3 pb-3 max-h-40 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden space-y-2">
                {aiRecommendedBlocks.slice(0, 6).map((candidate, index) => (
                  <div key={`${candidate.nodeId || 'candidate'}-${index}`} className="border border-theme rounded p-2 bg-background">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-theme-primary truncate">{candidate.name}</p>
                        <p className="text-[10px] text-theme-secondary truncate">{candidate.reason || candidate.suggestedBlockId}</p>
                      </div>
                      <button
                        onClick={() => openRecommendedExtractDialog(candidate)}
                        className="px-2 py-1 text-[10px] bg-cyan-500/20 text-cyan-300 rounded hover:bg-cyan-500/30 whitespace-nowrap"
                      >
                        Extract as block
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      {/* Node Properties Panel */}
      {selectedNodeId && nodeMap.get(selectedNodeId) && (
        <div className="w-80 border-l border-theme bg-surface flex flex-col min-h-0">
          <div className="p-3 border-b border-theme flex items-center justify-between flex-shrink-0">
            <h3 className="text-sm font-semibold text-theme-primary">Node Properties</h3>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="p-1 hover:bg-background rounded"
            >
              <X size={14} className="text-theme-secondary" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-3 space-y-3 min-h-0">
            {(() => {
              const node = nodeMap.get(selectedNodeId);
              const isHeaderNode = isProjectHeaderNode(node);
              return (
                <>
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-medium text-theme-primary mb-1">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={node.name}
                      onChange={(e) => updateNode(selectedNodeId, { name: e.target.value })}
                      className="w-full px-2 py-1.5 bg-background border border-theme rounded text-theme-primary focus:outline-none focus:border-primary text-sm"
                    />
                  </div>

                  {/* Attribute */}
                  <div>
                    <label className="block text-xs font-medium text-theme-primary mb-1">
                      Attribute (JSON key)
                    </label>
                    <input
                      type="text"
                      value={node.attribute}
                      onChange={(e) => updateNode(selectedNodeId, {
                        attribute: e.target.value.replace(/\s/g, '')
                      })}
                      className="w-full px-2 py-1.5 bg-background border border-theme rounded text-theme-primary font-mono focus:outline-none focus:border-primary text-sm"
                    />
                  </div>

                  {/* Node Role */}
                  <div>
                    <label className="block text-xs font-medium text-theme-primary mb-1">
                      Role
                    </label>
                    <select
                      value={node.role || 'field'}
                      onChange={(e) => updateNode(selectedNodeId, { role: e.target.value })}
                      disabled={isHeaderNode}
                      className="w-full px-2 py-1.5 bg-background border border-theme rounded text-theme-primary focus:outline-none focus:border-primary text-sm"
                    >
                      {VALID_V1_ROLES.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                    <p className="text-xs text-theme-secondary mt-1">
                      {isHeaderNode
                        ? 'Project header role is fixed to keep structural constraints.'
                        : 'field = leaf value, group = container, block = block reference'}
                    </p>
                  </div>

                  {/* Data Type */}
                  <div>
                    <label className="block text-xs font-medium text-theme-primary mb-1">
                      Data Type
                    </label>
                    <select
                      value={node.dataType}
                      onChange={(e) => updateNode(selectedNodeId, { dataType: e.target.value })}
                      disabled={isHeaderNode}
                      className="w-full px-2 py-1.5 bg-background border border-theme rounded text-theme-primary focus:outline-none focus:border-primary text-sm"
                    >
                      {VALID_NODE_DATA_TYPES
                        .filter((type) => type === node.dataType || isDataTypeAllowedForRole(node.role || 'field', type))
                        .map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  {isHeaderNode && (
                    <div className="border border-amber-500/30 bg-amber-500/5 rounded p-2 space-y-2">
                      <label className="block text-xs font-medium text-amber-300">
                        Header Scope
                      </label>
                      <div className="text-xs text-theme-secondary">
                        Using project header profile{' '}
                        <span className="font-mono text-amber-200">{node.headerProfileId || 'header.patient.v1'}</span>
                      </div>
                      <select
                        value={node.headerState || 'inherited'}
                        onChange={(e) => updateNode(selectedNodeId, { headerState: e.target.value })}
                        className="w-full px-2 py-1.5 bg-background border border-theme rounded text-theme-primary focus:outline-none focus:border-primary text-sm"
                      >
                        <option value="inherited">Project Header (inherited)</option>
                        <option value="extended">Project Header (extended)</option>
                        <option value="local">Local Header (forked)</option>
                      </select>
                      {(node.headerState || 'inherited') === 'inherited' && (
                        <button
                          type="button"
                          onClick={() => updateNode(selectedNodeId, { headerState: 'local' })}
                          className="w-full px-2 py-1.5 rounded text-xs bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
                        >
                          Customize for this object
                        </button>
                      )}
                    </div>
                  )}

                  {/* Time Role - only for date/datetime fields */}
                  {(node.dataType === 'date' || node.dataType === 'datetime') && (
                    <div>
                      <label className="block text-xs font-medium text-theme-primary mb-1 flex items-center gap-1">
                        <Clock size={12} className="text-blue-400" />
                        Time Semantics
                      </label>
                      <select
                        value={node.timeRole || ''}
                        onChange={(e) => updateNode(selectedNodeId, {
                          timeRole: e.target.value || undefined
                        })}
                        className="w-full px-2 py-1.5 bg-background border border-theme rounded text-theme-primary focus:outline-none focus:border-primary text-sm"
                      >
                        <option value="">None</option>
                        {VALID_TIME_ROLES.map(role => (
                          <option key={role} value={role}>
                            {role === 'timestamp' ? 'Event Timestamp' :
                             role === 'interval_start' ? 'Interval Start' :
                             role === 'interval_end' ? 'Interval End' : role}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-theme-secondary mt-1">
                        {node.timeRole === 'timestamp' && 'This field marks when an event occurred'}
                        {node.timeRole === 'interval_start' && 'This field marks the start of a time interval'}
                        {node.timeRole === 'interval_end' && 'This field marks the end of a time interval'}
                        {!node.timeRole && 'Set to define temporal semantics for events'}
                      </p>
                    </div>
                  )}

                  {/* Occurrences */}
                  <div>
                    <label className="block text-xs font-medium text-theme-primary mb-1">
                      Cardinality
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-theme-secondary">Min</label>
                        <input
                          type="number"
                          min="0"
                          value={node.occurrences.min}
                          onChange={(e) => updateNode(selectedNodeId, {
                            occurrences: {
                              ...node.occurrences,
                              min: parseInt(e.target.value) || 0
                            }
                          })}
                          className="w-full px-2 py-1.5 bg-background border border-theme rounded text-theme-primary focus:outline-none focus:border-primary text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-theme-secondary">Max</label>
                        <input
                          type="text"
                          value={node.occurrences.max}
                          onChange={(e) => {
                            const val = e.target.value === '*' ? '*' : (parseInt(e.target.value) || 1);
                            updateNode(selectedNodeId, {
                              occurrences: {
                                ...node.occurrences,
                                max: val
                              }
                            });
                          }}
                          placeholder="* for unbounded"
                          className="w-full px-2 py-1.5 bg-background border border-theme rounded text-theme-primary focus:outline-none focus:border-primary text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-theme-secondary mt-1">
                      Use * for unlimited (arrays)
                    </p>
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-medium text-theme-primary mb-1">
                      Description
                    </label>
                    <textarea
                      value={node.description || ''}
                      onChange={(e) => updateNode(selectedNodeId, { description: e.target.value })}
                      placeholder="Optional description..."
                      rows={2}
                      className="w-full px-2 py-1.5 bg-background border border-theme rounded text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary text-sm resize-none"
                    />
                  </div>

                  {/* Computed Paths - v1 COQL and Canonical */}
                  <div className="border border-green-500/30 bg-green-500/5 rounded p-2">
                    <label className="block text-xs font-medium text-green-400 mb-2 flex items-center gap-1">
                      <MapPin size={12} />
                      Computed Paths (v1)
                    </label>
                    <div className="space-y-2 text-xs">
                      {(() => {
                        const selectedNode = nodeMap.get(selectedNodeId);
                        let coqlPath = '/';
                        let canonicalPath = '/';

                        if (selectedNode) {
                          try {
                            coqlPath = computeCoqlPath(selectedNode, nodeMap);
                            canonicalPath = computeCanonicalPath(selectedNode, nodeMap);
                          } catch (e) {
                            // Fallback if path computation fails
                            coqlPath = `/${selectedNode.attribute || 'root'}`;
                            canonicalPath = `/${selectedNode.attribute || 'root'}[${selectedNode.nodeId}]`;
                          }
                        }

                        return (
                          <>
                            <div>
                              <div className="text-theme-secondary text-[10px] mb-0.5">COQL Path (UI/Query)</div>
                              <div className="text-green-300 bg-background/50 px-2 py-1 rounded break-all font-mono text-[11px]">
                                {coqlPath}
                              </div>
                            </div>
                            <div>
                              <div className="text-theme-secondary text-[10px] mb-0.5">Canonical Path (Debug/Lineage)</div>
                              <div className="text-green-300 bg-background/50 px-2 py-1 rounded break-all font-mono text-[11px]">
                                {canonicalPath}
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    <p className="text-[10px] text-green-400/70 mt-2 flex items-center gap-1">
                      <Sparkles size={10} />
                      Paths computed from tree structure (not stored)
                    </p>
                  </div>

                  {/* Reusable Block Properties */}
                  {(() => {
                    const isBlockReference = node.role === 'block' || !!node.blockId;
                    const embeddedSource = node._blockSource;
                    const hasReusableMetadata = isBlockReference || !!embeddedSource;
                    if (!hasReusableMetadata) return null;

                    const viewBlockId = node.blockId || embeddedSource?.blockId || '';
                    const embeddedAtText = embeddedSource?.embeddedAt
                      ? new Date(embeddedSource.embeddedAt).toLocaleString()
                      : null;

                    return (
                      <div className="p-2 border border-cyan-500/30 bg-cyan-500/5 rounded">
                        <label className="block text-xs font-medium text-cyan-400 mb-2 flex items-center gap-1">
                          <GitBranch size={12} />
                          Reusable Block Properties
                        </label>

                        {!!embeddedSource && (
                          <div className="mb-2 p-2 border border-cyan-400/20 rounded bg-background/40">
                            <p className="text-[10px] uppercase tracking-wide text-cyan-300 mb-1">
                              Embedded Source
                            </p>
                            <div className="space-y-1 text-[11px]">
                              <div className="text-theme-secondary">
                                Block ID: <span className="font-mono text-cyan-300">{embeddedSource.blockId || '-'}</span>
                              </div>
                              <div className="text-theme-secondary">
                                Version: <span className="font-mono text-cyan-300">{embeddedSource.version || '-'}</span>
                              </div>
                              <div className="text-theme-secondary">
                                Original node: <span className="font-mono text-cyan-300">{embeddedSource.originalNodeId || '-'}</span>
                              </div>
                              {embeddedAtText && (
                                <div className="text-theme-secondary">
                                  Embedded at: <span className="text-cyan-300">{embeddedAtText}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {isBlockReference && (
                          <div className="space-y-2 text-xs mb-2">
                            <div>
                              <label className="text-theme-secondary">Block ID:</label>
                              <input
                                type="text"
                                value={node.blockId || ''}
                                onChange={(e) => updateNode(selectedNodeId, { blockId: e.target.value })}
                                placeholder="e.g., block.Address.v1"
                                className="w-full mt-1 px-2 py-1 bg-background border border-theme rounded text-cyan-300 font-mono focus:outline-none focus:border-cyan-500 text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-theme-secondary">Version Range:</label>
                              <input
                                type="text"
                                value={node.versionRange || ''}
                                onChange={(e) => updateNode(selectedNodeId, { versionRange: e.target.value })}
                                placeholder="e.g., ^1.0.0 or 1.x"
                                className="w-full mt-1 px-2 py-1 bg-background border border-theme rounded text-cyan-300 font-mono focus:outline-none focus:border-cyan-500 text-xs"
                              />
                            </div>
                          </div>
                        )}

                        {onOpenBuildingBlock && viewBlockId && (
                          <button
                            onClick={() => onOpenBuildingBlock(viewBlockId)}
                            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded hover:bg-cyan-500/30 transition-colors text-xs"
                          >
                            <GitBranch size={12} />
                            View Block Definition
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Terminology Bindings */}
                  <div
                    ref={terminologyPanelRef}
                    onKeyDown={(event) => handleTerminologyPanelShortcutKeyDown(event, selectedNodeId, node)}
                    className="border border-theme rounded p-2"
                  >
                    {(() => {
                      const bindings = Array.isArray(node.terminologyBindings) ? node.terminologyBindings : [];
                      const preferredSystem = inferPreferredTerminologySystem(node);
                      const assistantRecommendations = buildTerminologyRecommendations(node, bindings);
                      const seen = new Set();
                      const diagnostics = bindings.map((binding) => {
                        const issues = [];
                        if (!isNonEmptyString(binding?.system)) issues.push('system required');
                        if (!isNonEmptyString(binding?.code)) issues.push('code required');
                        if (binding?.valueSet && !looksLikeValueSetRef(binding.valueSet)) issues.push('invalid value set');
                        const key = isNonEmptyString(binding?.system) && isNonEmptyString(binding?.code)
                          ? `${binding.system.trim().toLowerCase()}::${binding.code.trim().toLowerCase()}`
                          : null;
                        if (key && seen.has(key)) issues.push('duplicate system/code');
                        if (key) seen.add(key);
                        return issues;
                      });
                      const issueCount = diagnostics.reduce((sum, issues) => sum + issues.length, 0);

                      return (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs font-medium text-theme-primary">
                              Terminology Bindings
                            </label>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${issueCount > 0 ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                              {bindings.length} bindings {issueCount > 0 ? `• ${issueCount} issues` : '• healthy'}
                            </span>
                          </div>

                          {assistantRecommendations.length > 0 && (
                            <div className="mb-2 p-2 rounded border border-primary/30 bg-primary/5">
                              <div className="flex items-center justify-between mb-1">
                                <div className="text-[11px] font-medium text-primary flex items-center gap-1">
                                  <Sparkles size={11} />
                                  Terminology Assistant
                                </div>
                                <div className="text-[10px] text-theme-secondary">
                                  Suggestions based on node semantics
                                </div>
                              </div>
                              <div className="space-y-1">
                                {assistantRecommendations.map((recommendation) => (
                                  <div key={`${recommendation.system}:${recommendation.valueSet || 'none'}`} className="flex items-center gap-1.5 p-1.5 rounded bg-background/70 border border-theme/50">
                                    <div className="min-w-0 flex-1">
                                      <div className="text-[11px] text-theme-primary truncate">
                                        {recommendation.system}
                                        {recommendation.valueSetLabel ? ` • ${recommendation.valueSetLabel}` : ''}
                                      </div>
                                      <div className="text-[10px] text-theme-secondary truncate">
                                        {recommendation.reason}
                                      </div>
                                    </div>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                                      recommendation.confidence === 'high'
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : recommendation.confidence === 'medium'
                                          ? 'bg-amber-500/20 text-amber-300'
                                          : 'bg-slate-500/20 text-slate-300'
                                    }`}>
                                      {recommendation.confidence}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => applyCatalogTerminology(selectedNodeId, recommendation.system, recommendation.valueSet)}
                                      className="text-[10px] px-1.5 py-1 rounded bg-primary/15 text-primary hover:bg-primary/25"
                                    >
                                      Apply
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1 mb-2">
                            <button
                              type="button"
                              onClick={() => applyCatalogTerminology(selectedNodeId, preferredSystem)}
                              className="text-[11px] px-2 py-1 rounded bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                            >
                              + Quick Add ({preferredSystem})
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowTerminologyCatalog((prev) => !prev)}
                              className={`text-[11px] px-2 py-1 rounded border transition-colors ${showTerminologyCatalog ? 'border-primary text-primary bg-primary/10' : 'border-theme text-theme-secondary hover:text-theme-primary hover:border-primary'}`}
                            >
                              {showTerminologyCatalog ? 'Hide Catalog' : 'Open Catalog'}
                            </button>
                            {TERMINOLOGY_SYSTEM_OPTIONS.slice(0, 5).map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => applyCatalogTerminology(selectedNodeId, option.value)}
                                className="text-[11px] px-2 py-1 rounded border border-theme text-theme-secondary hover:text-theme-primary hover:border-primary transition-colors"
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-theme-secondary mb-2">
                            Keyboard: `Enter` next field, `Alt+Shift+B` add binding, `Alt+Shift+C` toggle catalog
                          </p>

                          {favoriteTerminologySystems.length > 0 && (
                            <div className="mb-2">
                              <div className="text-[10px] text-theme-secondary mb-1">Favorites</div>
                              <div className="flex flex-wrap gap-1">
                                {favoriteTerminologySystems.map((system) => (
                                  <button
                                    key={`favorite-${system}`}
                                    type="button"
                                    onClick={() => applyCatalogTerminology(selectedNodeId, system)}
                                    className="text-[11px] px-2 py-1 rounded border border-rose-400/40 text-rose-300 bg-rose-500/10 hover:bg-rose-500/20"
                                  >
                                    {system}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {recentTerminologySystems.length > 0 && (
                            <div className="mb-2">
                              <div className="text-[10px] text-theme-secondary mb-1">Recent</div>
                              <div className="flex flex-wrap gap-1">
                                {recentTerminologySystems.map((system) => (
                                  <button
                                    key={`recent-${system}`}
                                    type="button"
                                    onClick={() => applyCatalogTerminology(selectedNodeId, system)}
                                    className="text-[11px] px-2 py-1 rounded border border-cyan-400/40 text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20"
                                  >
                                    {system}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {showTerminologyCatalog && (
                            <div className="mb-3 p-2 rounded border border-theme/70 bg-background/60">
                              <div className="relative mb-2">
                                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-theme-secondary" />
                                <input
                                  type="text"
                                  value={terminologyCatalogQuery}
                                  onChange={(e) => setTerminologyCatalogQuery(e.target.value)}
                                  placeholder="Search terminology systems..."
                                  className="w-full pl-7 pr-2 py-1.5 bg-background border border-theme rounded text-theme-primary text-xs"
                                />
                              </div>
                              <div className="max-h-56 overflow-y-auto space-y-1 pr-0.5">
                                {filteredTerminologyCatalog.map((entry) => {
                                  const isFavorite = favoriteTerminologySystems.includes(entry.system);
                                  return (
                                    <div key={`catalog-${entry.system}`} className="border border-theme/60 rounded p-1.5 bg-background/70">
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => toggleFavoriteTerminologySystem(entry.system)}
                                          className={`p-1 rounded ${isFavorite ? 'text-rose-300 bg-rose-500/20' : 'text-theme-secondary hover:text-rose-300 hover:bg-rose-500/10'}`}
                                          title={isFavorite ? 'Remove from favorites' : 'Save as favorite'}
                                        >
                                          <Heart size={10} fill={isFavorite ? 'currentColor' : 'none'} />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => applyCatalogTerminology(selectedNodeId, entry.system)}
                                          className="text-left flex-1 min-w-0"
                                        >
                                          <div className="text-[11px] text-theme-primary font-medium truncate">{entry.system}</div>
                                          <div className="text-[10px] text-theme-secondary truncate">{entry.title}</div>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => applyCatalogTerminology(selectedNodeId, entry.system)}
                                          className="text-[10px] px-1.5 py-1 rounded bg-primary/15 text-primary hover:bg-primary/25"
                                        >
                                          Use
                                        </button>
                                      </div>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {entry.valueSets.map((vs) => (
                                          <button
                                            key={`${entry.system}-${vs.ref}`}
                                            type="button"
                                            onClick={() => applyCatalogTerminology(selectedNodeId, entry.system, vs.ref)}
                                            className="text-[10px] px-1.5 py-0.5 rounded border border-theme text-theme-secondary hover:text-theme-primary hover:border-primary"
                                            title={vs.ref}
                                          >
                                            {vs.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                                {filteredTerminologyCatalog.length === 0 && (
                                  <p className="text-[11px] text-theme-secondary">No terminology matches your search.</p>
                                )}
                              </div>
                            </div>
                          )}

                          {bindings.length === 0 && (
                            <p className="text-xs text-theme-secondary">
                              Add at least one binding for clinically meaningful querying and interoperability.
                            </p>
                          )}

                          {bindings.length > 0 && (
                            <div className="space-y-2">
                              {bindings.map((binding, idx) => {
                                const issues = diagnostics[idx] || [];
                                const selectedSystem = TERMINOLOGY_SYSTEM_OPTIONS.find((option) => option.value === binding.system);
                                return (
                                  <div key={`binding-${idx}`} className={`p-2 rounded border ${issues.length > 0 ? 'border-amber-500/40 bg-amber-500/5' : 'border-theme bg-background'}`}>
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-[11px] font-medium text-theme-primary">
                                        Binding #{idx + 1}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => removeTerminologyBinding(selectedNodeId, idx)}
                                        className="text-red-400 hover:text-red-300"
                                        title="Remove binding"
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1.5">
                                      <select
                                        value={binding.system || ''}
                                        onChange={(e) => {
                                          updateTerminologyBinding(selectedNodeId, idx, { system: e.target.value });
                                          trackRecentTerminologySystem(e.target.value);
                                        }}
                                        onKeyDown={(event) => handleTerminologyControlKeyDown(event, selectedNodeId, node)}
                                        data-term-control="true"
                                        data-term-index={idx}
                                        data-term-field="system"
                                        className="w-full px-2 py-1 bg-background border border-theme rounded text-theme-primary text-xs"
                                      >
                                        <option value="">Select terminology system...</option>
                                        {TERMINOLOGY_SYSTEM_OPTIONS.map((option) => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                      </select>
                                      <input
                                        type="text"
                                        value={binding.code || ''}
                                        onChange={(e) => updateTerminologyBinding(selectedNodeId, idx, { code: e.target.value })}
                                        onKeyDown={(event) => handleTerminologyControlKeyDown(event, selectedNodeId, node)}
                                        data-term-control="true"
                                        data-term-index={idx}
                                        data-term-field="code"
                                        placeholder="Code (e.g., 8480-6)"
                                        className={`w-full px-2 py-1 bg-background border rounded text-theme-primary text-xs font-mono ${isNonEmptyString(binding.code) ? 'border-theme' : 'border-amber-500/60'}`}
                                      />
                                      <input
                                        type="text"
                                        value={binding.display || ''}
                                        onChange={(e) => updateTerminologyBinding(selectedNodeId, idx, { display: e.target.value })}
                                        onKeyDown={(event) => handleTerminologyControlKeyDown(event, selectedNodeId, node)}
                                        data-term-control="true"
                                        data-term-index={idx}
                                        data-term-field="display"
                                        placeholder="Display name"
                                        className="w-full px-2 py-1 bg-background border border-theme rounded text-theme-primary text-xs"
                                      />
                                      <div className="grid grid-cols-[1fr_auto] gap-1.5">
                                        <input
                                          type="text"
                                          value={binding.valueSet || ''}
                                          onChange={(e) => updateTerminologyBinding(selectedNodeId, idx, { valueSet: e.target.value })}
                                          onKeyDown={(event) => handleTerminologyControlKeyDown(event, selectedNodeId, node)}
                                          data-term-control="true"
                                          data-term-index={idx}
                                          data-term-field="valueSet"
                                          placeholder="Value set (URL/URN/id)"
                                          className={`w-full px-2 py-1 bg-background border rounded text-theme-primary text-xs font-mono ${!binding.valueSet || looksLikeValueSetRef(binding.valueSet) ? 'border-theme' : 'border-amber-500/60'}`}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => updateTerminologyBinding(selectedNodeId, idx, { valueSet: selectedSystem?.valueSetHint || '' })}
                                          className="px-2 py-1 text-[11px] border border-theme rounded text-theme-secondary hover:text-theme-primary hover:border-primary"
                                          title="Apply system hint"
                                        >
                                          Hint
                                        </button>
                                      </div>
                                      <select
                                        value={binding.bindingStrength || 'required'}
                                        onChange={(e) => updateTerminologyBinding(selectedNodeId, idx, { bindingStrength: e.target.value })}
                                        onKeyDown={(event) => handleTerminologyControlKeyDown(event, selectedNodeId, node)}
                                        data-term-control="true"
                                        data-term-index={idx}
                                        data-term-field="bindingStrength"
                                        className="w-full px-2 py-1 bg-background border border-theme rounded text-theme-primary text-xs"
                                      >
                                        {TERMINOLOGY_STRENGTH_OPTIONS.map((option) => (
                                          <option key={option} value={option}>{option}</option>
                                        ))}
                                      </select>
                                    </div>
                                    {issues.length > 0 && (
                                      <div className="mt-1 text-[10px] text-amber-300">
                                        {issues.join(' • ')}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Relationship Primitive */}
                  <div className="border border-theme rounded p-2">
                    <label className="block text-xs font-medium text-theme-primary mb-1">
                      Relationship Primitive
                    </label>
                    <p className="text-[11px] text-theme-secondary mb-2">
                      Model explicit links by referencing another node in this context object.
                    </p>
                    <select
                      value={node.referencedObjectId || ''}
                      onChange={(e) => updateNodeReferenceTarget(selectedNodeId, e.target.value)}
                      className="w-full px-2 py-1.5 bg-background border border-theme rounded text-theme-primary focus:outline-none focus:border-primary text-xs"
                    >
                      <option value="">No relationship target</option>
                      {nodes
                        .filter((candidate) => candidate.nodeId !== node.nodeId)
                        .map((candidate) => (
                          <option key={candidate.nodeId} value={candidate.nodeId}>
                            {candidate.name} ({candidate.attribute})
                          </option>
                        ))}
                    </select>
                    {node.referencedObjectId && (
                      <p className="text-[11px] text-cyan-300 mt-1">
                        Linked to {nodeMap.get(node.referencedObjectId)?.name || node.referencedObjectId}
                      </p>
                    )}
                  </div>

                  {/* Structural Bindings Note (v1 - computed on export) */}
                  <div className="border border-theme/50 rounded p-2 bg-background/30">
                    <p className="text-xs text-theme-secondary italic">
                      Structural bindings (FHIR, openEHR paths) are computed on export based on active strategies.
                    </p>
                  </div>

                  {/* Add field buttons */}
                  <div className="flex gap-2">
                    {/* Add sibling field - available for all non-root nodes */}
                    {node.parentNodeId && (
                      <button
                        onClick={() => addSiblingField(selectedNodeId)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors text-sm"
                      >
                        <Plus size={14} />
                        Add Sibling
                      </button>
                    )}
                    {/* Add child field - only for objects (not for referenced objects) */}
                    {node.dataType === 'object' && !node.referencedObjectId && (
                      <button
                        onClick={() => addFieldToNode(selectedNodeId)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors text-sm"
                      >
                        <Plus size={14} />
                        Add Child
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* AI Assistant Panel */}
      {showAIPanel && !isAIAssistantDisabled && (
        <>
          <div
            onMouseDown={startAIPanelResize}
            className="w-1 cursor-col-resize bg-transparent hover:bg-purple-500/30 transition-colors"
            title="Resize assistant panel"
          />
          <div
            className="border-l border-theme bg-surface flex flex-col min-h-0 shrink-0"
            style={{ width: `${aiPanelWidth}px` }}
          >
          <div className="p-3 border-b border-theme flex items-center justify-between flex-shrink-0">
            <h3 className="text-sm font-semibold text-theme-primary flex items-center gap-2">
              <Bot size={16} className="text-purple-400" />
              AI Assistant
            </h3>
            <button
              onClick={() => setShowAIPanel(false)}
              className="p-1 hover:bg-background rounded"
            >
              <X size={14} className="text-theme-secondary" />
            </button>
          </div>

          <div className="p-3 border-b border-theme bg-cyan-500/5 flex-shrink-0">
            <AgentWorkflowInfoPanel
              agentContext={aiAgentContext}
              title="How This Agent Works"
              defaultExpanded={false}
            />
          </div>

          {/* Chat History */}
          <div ref={chatRef} className="flex-1 overflow-auto p-3 space-y-3 min-h-0">
            {aiChatHistory.length === 0 && (
              <div className="text-center text-theme-secondary py-4">
                <Sparkles size={24} className="mx-auto mb-2 opacity-50" />
                <p className="text-xs">
                  Ask for full structures or refinements. I will plan, reuse blocks first, apply edits, and suggest next prompts.
                </p>
                <div className="mt-3 space-y-1 text-xs">
                  <p className="text-purple-400">Examples:</p>
                  <p>&quot;Create a complete laboratory report and maximize reusable blocks&quot;</p>
                  <p>&quot;Add microbiology sections and keep results repeatable&quot;</p>
                  <p>&quot;Review gaps and suggest the next 3 prompts to improve this model&quot;</p>
                </div>
              </div>
            )}
            {aiChatHistory.map((msg, i) => (
              <div
                key={i}
                className={`p-2 rounded text-xs ${msg.role === 'user'
                    ? 'bg-primary/20 text-primary ml-8'
                    : 'bg-purple-500/10 text-theme-primary mr-8'
                  }`}
              >
                {msg.content}
                {msg.planSummary && (
                  <div className="mt-2 pt-2 border-t border-theme">
                    <p className="text-xs text-purple-300">Plan:</p>
                    <p className="text-xs text-theme-secondary">{msg.planSummary}</p>
                  </div>
                )}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-theme">
                    <p className="text-xs text-green-400">Actions taken:</p>
                    {msg.actions.map((action, j) => (
                      <p key={j} className="text-xs text-theme-secondary">- {action}</p>
                    ))}
                  </div>
                )}
                {msg.reusableBlocks && (
                  <div className="mt-2 pt-2 border-t border-theme">
                    <p className="text-xs text-cyan-300">Reusable blocks:</p>
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-theme-secondary">Matched by intent</span>
                        <span className="text-[10px] text-theme-primary">{msg.reusableBlocks?.counts?.matched ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-theme-secondary">Applied to structure</span>
                        <span className="text-[10px] text-green-300">{msg.reusableBlocks?.counts?.applied ?? 0}</span>
                      </div>
                      {(msg.reusableBlocks?.matched || []).slice(0, 4).map((item, idx) => {
                        const applied = (msg.reusableBlocks?.applied || []).some((appliedItem) => appliedItem.blockId === item.blockId);
                        return (
                          <div key={`${item.blockId || 'block'}-${idx}`} className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-theme-secondary truncate">
                              {item.name}
                            </span>
                            <span className={`text-[10px] uppercase ${applied ? 'text-green-300' : 'text-amber-300'}`}>
                              {applied ? 'applied' : 'matched'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {msg.questions && msg.questions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-theme">
                    <p className="text-xs text-amber-300">Clarifications:</p>
                    {msg.questions.map((question, j) => (
                      <p key={j} className="text-xs text-theme-secondary">- {question}</p>
                    ))}
                  </div>
                )}
                {msg.coverage && Object.keys(msg.coverage).length > 0 && (
                  <div className="mt-2 pt-2 border-t border-theme">
                    <p className="text-xs text-cyan-300">Coverage:</p>
                    <div className="mt-1 space-y-1">
                      {Object.entries(msg.coverage).map(([key, status]) => (
                        <div key={key} className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-theme-secondary">{key}</span>
                          <span className="text-[10px] text-theme-primary uppercase">{status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {msg.suggestedPrompts && msg.suggestedPrompts.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-theme">
                    <p className="text-xs text-blue-300 mb-1">Next prompts:</p>
                    <div className="flex flex-wrap gap-1">
                      {msg.suggestedPrompts.map((prompt, j) => (
                        <button
                          key={`${i}-${j}`}
                          onClick={() => handleSuggestedPromptClick(prompt)}
                          disabled={aiLoading}
                          className="px-2 py-0.5 rounded border border-blue-400/40 bg-blue-500/10 text-[10px] text-blue-200 hover:bg-blue-500/20 disabled:opacity-50"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {aiLoading && (
              <div className="flex items-center gap-2 text-purple-400 text-xs">
                <Loader2 size={14} className="animate-spin" />
                Thinking...
              </div>
            )}
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t border-theme flex-shrink-0">
            <div className="flex gap-2">
              <textarea
                ref={aiInputRef}
                rows={1}
                value={aiChatInput}
                onChange={(e) => setAIChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendAIMessage();
                  }
                }}
                placeholder="Ask AI to build/refine and maximize reusable block usage..."
                className="flex-1 px-2 py-1.5 bg-background border border-theme rounded text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-purple-500 text-xs resize-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                style={{ overflowY: 'hidden' }}
              />
              <button
                onClick={sendAIMessage}
                disabled={aiLoading || !aiChatInput.trim()}
                className="px-3 py-1.5 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
          </div>
        </>
      )}

      {/* Wrapper Dialog */}
      {showWrapperDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowWrapperDialog(false)} />
          <div className="relative bg-surface border border-theme rounded-lg p-4 max-w-md w-full mx-4">
            <h3 className="text-sm font-semibold text-theme-primary mb-3">Create Wrapper</h3>
            <div className="mb-4">
              <label className="block text-xs font-medium text-theme-primary mb-1">
                Wrapper Name
              </label>
              <input
                type="text"
                value={wrapperName}
                onChange={(e) => setWrapperName(e.target.value)}
                placeholder="e.g., Patient Info, Contact Details"
                className="w-full px-3 py-2 bg-background border border-theme rounded text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary text-sm"
              />
            </div>
            <p className="text-xs text-theme-secondary mb-4">
              This will group {wrapCandidateCount} selected sibling nodes into a new parent object.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowWrapperDialog(false)}
                className="px-3 py-1.5 text-theme-secondary hover:text-theme-primary transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={createWrapper}
                disabled={wrapCandidateCount < 2}
                title={wrapCandidateCount < 2 ? 'Select at least two sibling nodes under root to wrap.' : undefined}
                className="px-3 py-1.5 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                Create Wrapper
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extract to Block Dialog */}
      {showExtractDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => !extractLoading && setShowExtractDialog(false)} />
          <div className="relative bg-surface border border-theme rounded-lg p-4 max-w-md w-full mx-4">
            <h3 className="text-sm font-semibold text-theme-primary mb-3 flex items-center gap-2">
              <Upload size={16} className="text-cyan-400" />
              Extract to Block
            </h3>
            <p className="text-xs text-theme-secondary mb-4">
              This will save the selected subtree as a reusable block in the Block Library,
              and replace it with a block reference.
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-medium text-theme-primary mb-1">
                  Block Name
                </label>
                <input
                  type="text"
                  value={extractBlockName}
                  onChange={(e) => setExtractBlockName(e.target.value)}
                  placeholder="e.g., Address, Contact Info"
                  className="w-full px-3 py-2 bg-background border border-theme rounded text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-cyan-500 text-sm"
                  disabled={extractLoading}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-theme-primary mb-1">
                  Description (optional)
                </label>
                <textarea
                  value={extractBlockDescription}
                  onChange={(e) => setExtractBlockDescription(e.target.value)}
                  placeholder="Describe what this block represents..."
                  rows={2}
                  className="w-full px-3 py-2 bg-background border border-theme rounded text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-cyan-500 text-sm resize-none"
                  disabled={extractLoading}
                />
              </div>
            </div>
            <div className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded mb-4">
              <p className="text-xs text-cyan-300">
                <strong>Block ID:</strong>{' '}
                <span className="font-mono">block.{extractBlockName.replace(/\s+/g, '')}.v1</span>
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowExtractDialog(false)}
                disabled={extractLoading}
                className="px-3 py-1.5 text-theme-secondary hover:text-theme-primary transition-colors text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={extractToBlock}
                disabled={extractLoading || !extractBlockName.trim()}
                className="px-3 py-1.5 bg-cyan-500 text-white rounded hover:bg-cyan-600 transition-colors text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {extractLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    Extract Block
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegratedBlockComposer;
