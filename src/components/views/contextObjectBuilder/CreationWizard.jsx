"use client";

import React, { useState, useRef, useEffect } from 'react';
import {
  Wand2,
  PenTool,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Plus,
  Trash2,
  GripVertical,
  Send,
  Bot,
  User,
  X
} from 'lucide-react';
import { createRootNode, createFieldNode, VALID_NODE_DATA_TYPES } from '@/lib/definitions/types';
import AgentWorkflowInfoPanel from './AgentWorkflowInfoPanel';
import { STARTER_EXAMPLES, getStarterExampleById } from './starterExamples';
import {
  flattenHierarchicalDefinition,
  shouldTreatDefinitionAsHierarchical
} from '@/lib/contextObjects/hierarchicalDefinition';

const AUTO_OPEN_COMPOSER_AFTER_FIRST_AI_RESPONSE = true;

// Check if AI assistant is disabled via environment variable
const isAIAssistantDisabled = process.env.NEXT_PUBLIC_DISABLE_AI_ASSISTANT === 'true';

const CreationWizard = ({
  onComplete,
  onCancel,
  targetKind = 'context_object',
  initialMethod = null,
  initialExampleId = null,
  embedded = false  // When true, renders without modal wrapper for embedding in right panel
}) => {
  const [step, setStep] = useState(1); // 1: Choose method, 2: Build fields, 3: Review
  const [method, setMethod] = useState(null); // 'manual' or 'ai'
  const [objectName, setObjectName] = useState('');
  const [description, setDescription] = useState('');
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modelingPreferences, setModelingPreferences] = useState({
    includeDocumentMetadata: true,
    includeSubjectContext: true,
    includeCareContext: true,
    includePerformerContext: true,
    includeTemporalEvents: true,
    includeAssessmentAndNotes: true,
    preferReusableBlocks: true
  });

  // Chat state for AI assistant
  const [chatHistory, setChatHistory] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [clarificationQuestions, setClarificationQuestions] = useState([]);
  const [clarificationAnswers, setClarificationAnswers] = useState({});
  const [agentContext, setAgentContext] = useState(null);
  const [reusableBlockCandidates, setReusableBlockCandidates] = useState([]);
  const [detectionResult, setDetectionResult] = useState(null);
  const [templateCandidates, setTemplateCandidates] = useState([]);
  const [showTemplateCandidates, setShowTemplateCandidates] = useState(false);
  const [manuallyEditedAttributes, setManuallyEditedAttributes] = useState(new Set()); // Track fields with manually edited attributes
  const chatContainerRef = useRef(null);
  const aiInputRef = useRef(null);
  const reviewAiInputRef = useRef(null);
  const initializedMethodRef = useRef(false);
  const isBlock = targetKind === 'block';
  const entityLabel = isBlock ? 'Block' : 'ContextObject';
  const entityLabelLower = isBlock ? 'block' : 'ContextObject';

  const generateTempNodeId = () => `n-wiz-${Math.random().toString(36).slice(2, 10)}`;

  const toCamel = (value, fallback = 'field') => {
    const parts = `${value || ''}`
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return fallback;
    const [first, ...rest] = parts;
    return `${first.toLowerCase()}${rest.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`).join('')}`;
  };

  const aqlPathToAttribute = (aqlPath, fallbackName) => {
    const raw = `${aqlPath || ''}`.trim();
    if (!raw) return toCamel(fallbackName, 'field');
    const seg = raw.split('/').filter(Boolean).pop() || '';
    const cleaned = seg.replace(/\[[^\]]*\]/g, '').trim();
    return toCamel(cleaned || fallbackName, 'field');
  };

  const rmTypeToNodeShape = (rmType, hasChildren) => {
    const type = `${rmType || ''}`.toUpperCase();
    if (type === 'SECTION') return { role: 'section', dataType: 'object' };
    if (type === 'EVENT') return { role: 'event', dataType: 'object' };
    if (type === 'HISTORY') return { role: 'event_series', dataType: 'array' };
    if (type === 'CLUSTER') return { role: 'group', dataType: hasChildren ? 'object' : 'array' };
    if (type === 'DV_CODED_TEXT') return { role: 'field', dataType: 'coded_text' };
    if (type === 'DV_QUANTITY') return { role: 'field', dataType: 'quantity' };
    if (type === 'DV_DATE') return { role: 'field', dataType: 'date' };
    if (type === 'DV_DATE_TIME') return { role: 'field', dataType: 'datetime' };
    if (type === 'DV_COUNT') return { role: 'field', dataType: 'integer' };
    if (type === 'DV_BOOLEAN') return { role: 'field', dataType: 'boolean' };
    if (type === 'DV_IDENTIFIER') return { role: 'field', dataType: 'identifier' };
    return { role: hasChildren ? 'group' : 'field', dataType: hasChildren ? 'object' : 'string' };
  };

  const webTemplateToNodes = (webTemplate, fallbackName) => {
    const tree = webTemplate || null;
    if (!tree) return [];
    const flat = [];

    const walk = (node, parentNodeId = null, isRoot = false) => {
      const childList = Array.isArray(node?.children) ? node.children : [];
      const mapped = isRoot ? { role: 'section', dataType: 'object' } : rmTypeToNodeShape(node?.rmType, childList.length > 0);
      const nodeId = `${node?.nodeId || ''}`.trim() || generateTempNodeId();
      const attribute = isRoot
        ? 'root'
        : aqlPathToAttribute(node?.aqlPath, node?.name || node?.localizedName || 'field');
      const rawMax = node?.max;
      const normalizedMax = rawMax === -1 ? '*' : (typeof rawMax === 'number' ? rawMax : 1);
      const min = typeof node?.min === 'number' ? node.min : 0;

      flat.push({
        nodeId,
        parentNodeId,
        childrenNodeIds: [],
        role: mapped.role,
        name: node?.localizedName || node?.name || attribute,
        attribute,
        dataType: mapped.dataType,
        occurrences: { min, max: normalizedMax }
      });

      childList.forEach((child) => walk(child, nodeId, false));
    };

    walk(tree, null, true);
    return flat;
  };

  const normalizeWizardNodes = (inputNodes, fallbackName) => {
    if (!Array.isArray(inputNodes) || inputNodes.length === 0) {
      const root = createRootNode(fallbackName || entityLabel);
      return [{ ...root, role: 'section', dataType: 'object', attribute: 'root', occurrences: { min: 1, max: 1 } }];
    }

    const usedIds = new Set();
    const normalized = inputNodes.map((node) => {
      let nodeId = typeof node?.nodeId === 'string' && node.nodeId.trim() ? node.nodeId.trim() : generateTempNodeId();
      while (usedIds.has(nodeId)) nodeId = generateTempNodeId();
      usedIds.add(nodeId);

      const rawParent = node?.parentNodeId;
      const parentNodeId = typeof rawParent === 'string'
        ? (rawParent.trim() ? rawParent.trim() : null)
        : (rawParent === null ? null : null);

      return {
        ...node,
        nodeId,
        parentNodeId,
        childrenNodeIds: Array.isArray(node?.childrenNodeIds) ? node.childrenNodeIds : [],
        occurrences: node?.occurrences || { min: 0, max: 1 }
      };
    });

    let roots = normalized.filter((n) => n.parentNodeId === null);
    let root = roots[0];

    if (!root) {
      root = normalized[0];
      root.parentNodeId = null;
      roots = [root];
    }

    if (roots.length > 1) {
      roots.slice(1).forEach((extraRoot) => {
        extraRoot.parentNodeId = root.nodeId;
      });
    }

    const nodeIds = new Set(normalized.map((n) => n.nodeId));
    normalized.forEach((node) => {
      if (node.nodeId === root.nodeId) return;
      if (!node.parentNodeId || !nodeIds.has(node.parentNodeId) || node.parentNodeId === node.nodeId) {
        node.parentNodeId = root.nodeId;
      }
    });

    const childrenMap = new Map(normalized.map((n) => [n.nodeId, []]));
    normalized.forEach((node) => {
      if (node.parentNodeId && childrenMap.has(node.parentNodeId)) {
        childrenMap.get(node.parentNodeId).push(node.nodeId);
      }
    });

    return normalized.map((node) => ({
      ...node,
      role: node.nodeId === root.nodeId ? 'section' : (node.role || 'field'),
      dataType: node.nodeId === root.nodeId ? 'object' : (node.dataType || 'string'),
      attribute: node.nodeId === root.nodeId ? 'root' : (node.attribute || `field_${node.nodeId.replace(/[^a-zA-Z0-9]/g, '')}`),
      occurrences: node.nodeId === root.nodeId ? { min: 1, max: 1 } : (node.occurrences || { min: 0, max: 1 }),
      childrenNodeIds: childrenMap.get(node.nodeId) || []
    }));
  };

  const completeAndOpenComposer = (
    normalizedNodes,
    preferredName,
    preferredDescription,
    assistantPayload = {}
  ) => {
    const safeName = `${preferredName || objectName || entityLabel}`.trim() || entityLabel;
    onComplete({
      name: safeName,
      description: preferredDescription || description || '',
      nodes: normalizedNodes,
      kind: isBlock ? 'block' : 'context_object',
      scope: isBlock ? 'building_block' : 'business_object',
      assistant: {
        open: true,
        // Do not prefill or auto-send composer chat input on initial handoff.
        // Users should first see the generated structure in the proper layout.
        prompt: '',
        recommendedBlocks: Array.isArray(assistantPayload.recommendedBlocks) ? assistantPayload.recommendedBlocks : [],
        agent: assistantPayload.agent || null
      }
    });
  };

  // Example prompts for the AI assistant - detailed, instructive examples
  const examplePrompts = [
    {
      short: "Clinical Deterioration Alert",
      full: "Design a context object to capture early warning signs of patient deterioration, including NEWS2 scores over time, escalation triggers, responsible clinician notifications, and intervention timestamps with outcomes"
    },
    {
      short: "Oncology Treatment Cycle",
      full: "Create a structure for tracking a chemotherapy treatment cycle including protocol reference, cycle number, pre-treatment labs with thresholds, administered agents with actual doses vs planned, adverse events graded by CTCAE, and next cycle scheduling criteria"
    },
    {
      short: "Care Coordination Handoff",
      full: "Build a care transition handoff object capturing the sending and receiving care teams, active problem list summary, pending actions with deadlines, medication reconciliation status, follow-up appointments, and patient/family communication preferences"
    },
    {
      short: "Diagnostic Workup Bundle",
      full: "Design a diagnostic investigation bundle that groups related orders (imaging, labs, pathology) around a clinical question, tracks order status and results, supports preliminary vs final interpretations, and links to the resulting diagnosis with confidence level"
    },
    {
      short: "Chronic Disease Review",
      full: "Create a periodic disease review object for conditions like diabetes or heart failure, capturing current metrics vs targets, medication adherence indicators, lifestyle factors, complications screening results, and shared decision-making outcomes for treatment adjustments"
    }
  ];
  const preferenceOptions = [
    { key: 'includeDocumentMetadata', label: 'Document Metadata' },
    { key: 'includeSubjectContext', label: 'Subject Context' },
    { key: 'includeCareContext', label: 'Care Context' },
    { key: 'includePerformerContext', label: 'Performer Context' },
    { key: 'includeTemporalEvents', label: 'Temporal Events' },
    { key: 'includeAssessmentAndNotes', label: 'Assessment & Notes' },
    { key: 'preferReusableBlocks', label: 'Reuse Blocks First' }
  ];

  const toggleModelingPreference = (key) => {
    setModelingPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const autoResizeTextarea = (textarea) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    const maxHeight = 112; // ~4 lines
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
  };

  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  useEffect(() => {
    autoResizeTextarea(aiInputRef.current);
    autoResizeTextarea(reviewAiInputRef.current);
  }, [currentMessage]);

  useEffect(() => {
    if (initializedMethodRef.current) return;
    if (initialMethod === 'example') {
      const selectedExample = getStarterExampleById(initialExampleId) || STARTER_EXAMPLES[0];
      initializedMethodRef.current = true;
      startFromExample(selectedExample);
      return;
    }
    if (initialMethod === 'ai') {
      // If AI is disabled, fallback to manual mode
      if (isAIAssistantDisabled) {
        initializedMethodRef.current = true;
        startManualMode();
        return;
      }
      setMethod('ai');
      setStep(2);
      initializedMethodRef.current = true;
      return;
    }
    if (initialMethod === 'manual') {
      initializedMethodRef.current = true;
      startManualMode();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMethod, initialExampleId]);

  const composeClarificationContextText = () => {
    if (!clarificationQuestions.length) return '';
    const lines = clarificationQuestions
      .map((question) => {
        const value = clarificationAnswers[question.id];
        if (!value) return null;
        const selected = (question.options || []).find((option) => option.value === value);
        return `${question.question}: ${selected?.label || value}`;
      })
      .filter(Boolean);
    return lines.length ? lines.join(' | ') : '';
  };

  const selectedTemplateLabel = () => {
    const selectedId = detectionResult?.templateId || agentContext?.domainTemplate?.id || '';
    const selected = templateCandidates.find((candidate) => candidate.templateId === selectedId);
    return selected?.label || agentContext?.domainTemplate?.label || selectedId || 'Template';
  };

  const askTemplateSelection = (templateId) => {
    const basePrompt = (lastPrompt || currentMessage || '').trim()
      || `Generate a comprehensive ${entityLabelLower} structure.`;
    setShowTemplateCandidates(false);
    sendChatMessage(basePrompt, { skipClarifications: true, forcedTemplateId: templateId });
  };

  // Send message to AI assistant
  const sendChatMessage = async (messageText = null, options = {}) => {
    const message = messageText || currentMessage;
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    // Add user message to chat
    const userMessage = { role: 'user', content: trimmedMessage };
    const conversation = [...chatHistory, userMessage];
    const currentNodesSnapshot = Array.isArray(nodes) ? nodes : [];
    const clarificationContext = composeClarificationContextText();
    setChatHistory(prev => [...prev, userMessage]);
    setCurrentMessage('');
    setLastPrompt(trimmedMessage);

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/definitions/suggest-from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: trimmedMessage,
          objectName: objectName || entityLabel,
          currentNodes: currentNodesSnapshot,
          chatHistory: conversation,
          targetKind: isBlock ? 'block' : 'context_object',
          modelingPreferences: currentNodesSnapshot.length === 0 ? modelingPreferences : undefined,
          clarificationAnswers,
          skipClarifications: !!options.skipClarifications,
          forcedTemplateId: options.forcedTemplateId || null,
          additionalContext: clarificationContext
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate suggestion');
      }

      const suggestion = await response.json();
      setAgentContext(suggestion.agent || null);
      setReusableBlockCandidates(suggestion?.agent?.reusableBlockCandidates || []);
      const nextDetection = suggestion?.agent?.detectionResult || null;
      const nextCandidates = Array.isArray(suggestion?.agent?.templateCandidates) ? suggestion.agent.templateCandidates : [];
      setDetectionResult(nextDetection);
      setTemplateCandidates(nextCandidates);
      setShowTemplateCandidates((nextDetection?.confidence || 0) < 0.75);
      const receivedQuestions = Array.isArray(suggestion.clarificationQuestions)
        ? suggestion.clarificationQuestions
        : [];
      setClarificationQuestions(receivedQuestions);

      if (suggestion?.agent?.stage === 'clarification_required') {
        const questionSummary = receivedQuestions.length
          ? receivedQuestions.map((q, index) => `${index + 1}. ${q.question}`).join('\n')
          : 'Please provide missing clarifications.';
        const clarificationResponse = {
          role: 'assistant',
          content: `I detected the domain as ${suggestion?.agent?.domainTemplate?.label || 'healthcare'} and need a few clarifications before generating the full structure:\n${questionSummary}`
        };
        setChatHistory(prev => [...prev, clarificationResponse]);
        return;
      }

      const sourceNodes = Array.isArray(suggestion.nodes) && suggestion.nodes.length > 0
        ? suggestion.nodes
        : webTemplateToNodes(suggestion.webTemplate, suggestion.suggestedName || objectName || entityLabel);
      const updatedNodes = normalizeWizardNodes(sourceNodes, suggestion.suggestedName || objectName || entityLabel);
      setNodes(updatedNodes);
      if (suggestion.suggestedName && !objectName.trim()) {
        setObjectName(suggestion.suggestedName);
      }

      // Add AI response to chat
      const fieldsCount = updatedNodes.filter(n => n.parentNodeId !== null).length;
      const blockRefs = updatedNodes.filter(n => n.role === 'block').length;
      const recommendedBlocks = Array.isArray(suggestion?.agent?.reusableBlockCandidates)
        ? suggestion.agent.reusableBlockCandidates
        : [];
      const fieldNames = updatedNodes
        ?.filter(n => n.parentNodeId !== null)
        .map(n => n.name)
        .slice(0, 5)
        .join(', ');
      const actionWord = currentNodesSnapshot.length > 0 ? 'updated' : 'created';

      const previewSuffix = fieldNames ? `: ${fieldNames}${fieldsCount > 5 ? '...' : ''}` : '.';
      const aiResponse = {
        role: 'assistant',
        content: `I ${actionWord} your ${entityLabelLower} structure. It now has ${fieldsCount} elements${blockRefs > 0 ? ` and ${blockRefs} reusable block references` : ''}${previewSuffix}${recommendedBlocks.length > 0 ? ` I also identified ${recommendedBlocks.length} subtree candidates that could be saved as reusable blocks.` : ''} Send another prompt to refine it, or click "Review Structure".`
      };
      setChatHistory(prev => [...prev, aiResponse]);
      setClarificationQuestions([]);

      const isFirstAIGeneration = currentNodesSnapshot.length === 0;
      const confidenceValue = suggestion?.agent?.detectionResult?.confidence ?? 1;
      const hasAmbiguousTemplate = confidenceValue < 0.75
        && (Array.isArray(suggestion?.agent?.templateCandidates) ? suggestion.agent.templateCandidates.length : 0) > 1
        && !options.forcedTemplateId;

      if (AUTO_OPEN_COMPOSER_AFTER_FIRST_AI_RESPONSE && isFirstAIGeneration && updatedNodes.length > 0 && !hasAmbiguousTemplate) {
        completeAndOpenComposer(
          updatedNodes,
          suggestion.suggestedName || objectName || entityLabel,
          suggestion.description || description,
          {
            recommendedBlocks,
            agent: suggestion.agent || null
          }
        );
        return;
      }

    } catch (err) {
      console.error('AI suggestion error:', err);
      const errorResponse = {
        role: 'assistant',
        content: `I encountered an error: ${err.message}. Please try again with more details about your data needs.`
      };
      setChatHistory(prev => [...prev, errorResponse]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle example prompt click
  const handleExampleClick = (prompt) => {
    setCurrentMessage(prompt);
  };

  const setClarificationAnswer = (questionId, value) => {
    setClarificationAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const runWithClarifications = () => {
    const basePrompt = (lastPrompt || currentMessage || '').trim();
    const fallbackPrompt = `Generate a comprehensive ${entityLabelLower} with the selected clarifications.`;
    const promptToSend = basePrompt || fallbackPrompt;
    sendChatMessage(promptToSend, { skipClarifications: true });
  };

  // Add a new field manually
  const addField = () => {
    if (nodes.length === 0) {
      // Create root node first
      const rootNode = createRootNode(objectName || entityLabel);
      setNodes([rootNode]);
    } else {
      // Add child to root
      const rootNode = nodes.find(n => n.parentNodeId === null);
      if (rootNode) {
        const newField = createFieldNode(
          '',
          '',
          'string',
          false,
          rootNode.nodeId,
          rootNode.canonicalPath,
          ''
        );

        // Update root's children
        const updatedRoot = {
          ...rootNode,
          childrenNodeIds: [...rootNode.childrenNodeIds, newField.nodeId]
        };

        setNodes([
          updatedRoot,
          ...nodes.filter(n => n.nodeId !== rootNode.nodeId),
          newField
        ]);
      }
    }
  };

  // Update a field
  const updateField = (nodeId, updates) => {
    setNodes(prev => prev.map(node => {
      if (node.nodeId === nodeId) {
        const updatedNode = { ...node, ...updates };
        // Update canonical path if attribute changed
        if (updates.attribute && node.parentNodeId) {
          const parent = prev.find(n => n.nodeId === node.parentNodeId);
          if (parent) {
            updatedNode.canonicalPath = `${parent.canonicalPath}/${updates.attribute}[${node.nodeId}]`;
          }
        }
        return updatedNode;
      }
      return node;
    }));
  };

  // Handle name change - auto-generate attribute if not manually edited
  const handleNameChange = (nodeId, newName) => {
    const updates = { name: newName };
    // Auto-generate attribute from name if not manually edited
    if (!manuallyEditedAttributes.has(nodeId)) {
      updates.attribute = toCamel(newName, 'field');
    }
    updateField(nodeId, updates);
  };

  // Handle attribute change - mark as manually edited
  const handleAttributeChange = (nodeId, newAttribute) => {
    // Mark this field's attribute as manually edited
    setManuallyEditedAttributes(prev => new Set([...prev, nodeId]));
    updateField(nodeId, { attribute: newAttribute.replace(/\s/g, '') });
  };

  // Remove a field
  const removeField = (nodeId) => {
    const nodeToRemove = nodes.find(n => n.nodeId === nodeId);
    if (!nodeToRemove || !nodeToRemove.parentNodeId) return; // Can't remove root

    setNodes(prev => {
      // Remove from parent's children
      const updated = prev.map(node => {
        if (node.nodeId === nodeToRemove.parentNodeId) {
          return {
            ...node,
            childrenNodeIds: node.childrenNodeIds.filter(id => id !== nodeId)
          };
        }
        return node;
      });
      // Remove the node itself
      return updated.filter(n => n.nodeId !== nodeId);
    });
  };

  // Initialize manual mode - go directly to the full composer
  const startManualMode = () => {
    const name = objectName.trim() || `New ${entityLabel}`;
    const rootNode = createRootNode(name);

    // Complete immediately with minimal structure - the full composer handles everything
    onComplete({
      name,
      description: description || '',
      nodes: normalizeWizardNodes([rootNode], name),
      kind: isBlock ? 'block' : 'context_object',
      scope: isBlock ? 'building_block' : 'business_object',
      assistant: { open: false, prompt: '' }
    });
  };

  const startFromExample = (example = STARTER_EXAMPLES[0]) => {
    if (!example) return;
    const exampleNodes = shouldTreatDefinitionAsHierarchical(example.definition, example.definitionFormat)
      ? flattenHierarchicalDefinition(example.definition)
      : example.nodes;
    setMethod('example');
    if (!objectName.trim()) {
      setObjectName(example.name);
    }
    if (!description.trim()) {
      setDescription(example.description || '');
    }
    setNodes(normalizeWizardNodes(exampleNodes, example.name));
    setStep(3);
  };

  // Complete wizard
  const handleComplete = () => {
    if (!objectName.trim()) {
      setError(`${entityLabel} name is required`);
      return;
    }

    if (nodes.length === 0) {
      setError('Please add at least one field');
      return;
    }

    // Update root node name if changed
    const updatedNodes = nodes.map(node => {
      if (node.parentNodeId === null) {
        return {
          ...node,
          name: objectName,
          description: description || `Root of the ${objectName} ${entityLabelLower}`
        };
      }
      return node;
    });

    onComplete({
      name: objectName,
      description,
      nodes: normalizeWizardNodes(updatedNodes, objectName || entityLabel),
      kind: isBlock ? 'block' : 'context_object',
      scope: isBlock ? 'building_block' : 'business_object',
      assistant: method === 'ai'
        ? {
          open: true,
          prompt: '',
          recommendedBlocks: reusableBlockCandidates,
          agent: agentContext
        }
        : { open: false, prompt: '' }
    });
  };

  // Get child nodes (fields)
  const getFields = () => {
    const rootNode = nodes.find(n => n.parentNodeId === null);
    if (!rootNode) return [];
    return nodes.filter(n => n.parentNodeId === rootNode.nodeId);
  };

  const getRootNode = () => nodes.find(n => n.parentNodeId === null) || null;
  const getAllElements = () => nodes.filter(n => n.parentNodeId !== null);
  const getChildren = (parentNodeId) => nodes.filter(n => n.parentNodeId === parentNodeId);

  const renderNodeTree = (node, depth = 0) => {
    const children = getChildren(node.nodeId);
    return (
      <div key={node.nodeId}>
        <div
          className="flex items-center gap-2 rounded border border-theme/70 bg-background px-3 py-2"
          style={{ marginLeft: `${depth * 14}px` }}
        >
          <span className="text-sm text-theme-primary font-medium">{node.name}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-primary/15 text-primary">{node.role || 'field'}</span>
          <span className="text-xs px-2 py-0.5 rounded bg-blue-500/15 text-blue-300">{node.dataType || 'string'}</span>
          <span className="text-xs text-theme-secondary font-mono">{node.attribute}</span>
        </div>
        {children.length > 0 && (
          <div className="mt-2 space-y-2">
            {children.map((child) => renderNodeTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Content wrapper - used for both modal and embedded modes
  const contentWrapper = (children) => {
    if (embedded) {
      return (
        <div className="h-full flex flex-col bg-background">
          {children}
        </div>
      );
    }
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
        <div className="relative bg-surface border border-theme rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    );
  };

  return contentWrapper(
    <>
      {/* Header */}
      <div className={`p-6 border-b border-theme ${embedded ? 'bg-surface' : ''} flex items-start justify-between gap-3`}>
        <div>
          <h2 className="text-xl font-semibold text-theme-primary">Create {entityLabel}</h2>
          <p className="text-sm text-theme-secondary mt-1">
            {step === 1 && `Choose how you want to define your ${entityLabelLower}`}
            {step === 2 && method === 'manual' && `Define your ${entityLabelLower} fields`}
            {step === 2 && method === 'ai' && `Describe what data you want to capture in this ${entityLabelLower}`}
            {step === 3 && `Review and adjust your ${entityLabelLower} structure`}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-background transition-colors"
          title="Close"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

        {/* Content */}
        <div className={`flex-1 ${embedded ? 'min-h-0 flex flex-col' : 'overflow-auto'} p-6`}>
          {error && (
            <div className="mb-4 p-3 bg-error/10 border border-error/30 rounded-lg text-error flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Step 1: Choose method */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Object name input */}
              <div>
                <label className="block text-sm font-medium text-theme-primary mb-1">
                  What do you want to call this {entityLabelLower}? <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={objectName}
                  onChange={(e) => setObjectName(e.target.value)}
                  placeholder={isBlock ? 'e.g., Contact Details, Postal Address, Blood Pressure Panel' : 'e.g., Patient Allergy, Medication Order, Lab Result'}
                  className="w-full px-4 py-3 bg-background border border-theme rounded-lg text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary text-lg"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                {/* Manual option */}
                <button
                  onClick={startManualMode}
                  className="p-6 border-2 border-theme rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors">
                      <PenTool size={24} className="text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-theme-primary">Build Manually</h3>
                  </div>
                  <p className="text-sm text-theme-secondary">
                    Define each field yourself with full control over names, types, and requirements.
                    Best for precise, technical definitions.
                  </p>
                </button>

                {/* AI-assisted option - hidden when disabled */}
                {!isAIAssistantDisabled && (
                  <button
                    onClick={() => {
                      setMethod('ai');
                      setStep(2);
                    }}
                    className="p-6 border-2 border-theme rounded-lg hover:border-purple-500 hover:bg-purple-500/5 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-3 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors">
                        <Wand2 size={24} className="text-purple-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-theme-primary">AI Assistant</h3>
                    </div>
                    <p className="text-sm text-theme-secondary">
                      Describe what you need in plain language and let AI suggest the structure.
                      Perfect for non-technical users.
                    </p>
                  </button>
                )}

                {/* Start from example */}
                <button
                  onClick={() => startFromExample()}
                  className="p-6 border-2 border-theme rounded-lg hover:border-cyan-500 hover:bg-cyan-500/5 transition-all text-left group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-cyan-500/20 rounded-lg group-hover:bg-cyan-500/30 transition-colors">
                      <Sparkles size={24} className="text-cyan-300" />
                    </div>
                    <h3 className="text-lg font-semibold text-theme-primary">Start From Example</h3>
                  </div>
                  <p className="text-sm text-theme-secondary">
                    Load a starter model and adjust it. Initial example: <span className="text-cyan-300">Vital Signs Starter</span>.
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Step 2: AI Chat Interface or Manual fields */}
          {step === 2 && method === 'ai' && (
            <div className={`min-h-0 ${nodes.length > 0 && !embedded ? 'grid grid-cols-1 gap-4 lg:grid-cols-2' : 'flex flex-col'} ${embedded ? 'flex-1' : 'h-[620px]'}`}>
              <div className={`flex min-h-0 flex-col ${embedded ? 'flex-1' : ''}`}>
                {/* Agent workflow info - always first */}
                <AgentWorkflowInfoPanel
                  agentContext={agentContext}
                  title="How This Agent Works"
                  className="mb-4 flex-shrink-0"
                />

                {detectionResult && (
                  <div className="mb-3 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                    {detectionResult.confidence >= 0.75 && !showTemplateCandidates ? (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-cyan-300">
                            Selected: {selectedTemplateLabel()} ({Math.round((detectionResult.confidence || 0) * 100)}%)
                          </p>
                          <p className="text-xs text-theme-secondary mt-1">
                            Domain: {detectionResult.domain || 'clinical-care'}
                          </p>
                        </div>
                        {templateCandidates.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setShowTemplateCandidates(true)}
                            className="px-2.5 py-1 text-xs rounded border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20"
                          >
                            Change
                          </button>
                        )}
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm text-cyan-300 mb-2">
                          Select a template{detectionResult.confidence < 0.75 ? ' (low confidence detection)' : ''}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          {templateCandidates.slice(0, 3).map((candidate) => (
                            <button
                              key={`tmpl-${candidate.templateId}`}
                              type="button"
                              onClick={() => askTemplateSelection(candidate.templateId)}
                              className={`text-left p-2 rounded border transition-colors ${
                                (detectionResult?.templateId || '') === candidate.templateId
                                  ? 'border-primary/60 bg-primary/10'
                                  : 'border-theme bg-background hover:border-primary/30'
                              }`}
                            >
                              <p className="text-xs font-medium text-theme-primary">{candidate.label || candidate.templateId}</p>
                              <p className="text-[11px] text-theme-secondary mt-1">
                                {candidate.description || 'Healthcare template'}
                              </p>
                              <p className="text-[10px] text-theme-secondary mt-1">
                                Anchor: {(candidate.requiredAnchors || []).join(', ') || 'patient'}
                              </p>
                            </button>
                          ))}
                        </div>
                        {showTemplateCandidates && (
                          <button
                            type="button"
                            onClick={() => setShowTemplateCandidates(false)}
                            className="mt-2 px-2 py-1 text-[11px] rounded border border-theme text-theme-secondary hover:text-theme-primary"
                          >
                            Collapse
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {agentContext?.projectSettings?.defaultCentricity && (
                  <div className="mb-3 p-3 bg-slate-500/10 border border-slate-500/30 rounded-lg flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-theme-primary">
                        Header: {String(agentContext.projectSettings.defaultCentricity).charAt(0).toUpperCase() + String(agentContext.projectSettings.defaultCentricity).slice(1)}-centric (Project default)
                      </p>
                      <p className="text-xs text-theme-secondary mt-1">
                        Profile: {agentContext?.projectSettings?.defaultHeaderProfileId || 'header.patient.v1'}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="px-2.5 py-1 text-xs rounded border border-theme text-theme-secondary hover:text-theme-primary hover:border-primary/40"
                      title="Project-level setting"
                    >
                      Change project header
                    </button>
                  </div>
                )}

                {/* Quick Modeling Preferences - only before first message */}
                {chatHistory.length === 0 && (
                  <div className="mb-4 p-3 bg-surface border border-theme rounded-lg flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={14} className="text-purple-400" />
                      <h4 className="text-sm font-medium text-theme-primary">Quick Modeling Preferences</h4>
                    </div>
                    <p className="text-xs text-theme-secondary mb-3">
                      Select what to include in the first generated structure.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {preferenceOptions.map((option) => {
                        const active = modelingPreferences[option.key];
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => toggleModelingPreference(option.key)}
                            className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                              active
                                ? 'bg-primary/20 text-primary border-primary/40'
                                : 'bg-background text-theme-secondary border-theme hover:border-primary/30'
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {clarificationQuestions.length > 0 && (
                  <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span className="text-sm text-amber-300">Clarify before generating full structure</span>
                      <button
                        onClick={runWithClarifications}
                        disabled={loading}
                        className="px-3 py-1.5 text-xs bg-amber-500 text-black rounded hover:bg-amber-400 disabled:opacity-50"
                      >
                        Run with selections
                      </button>
                    </div>
                    <div className="space-y-3">
                      {clarificationQuestions.map((question, index) => (
                        <div key={question.id || index} className="p-2 border border-theme rounded bg-background/50">
                          <p className="text-xs text-theme-primary mb-2">
                            {index + 1}. {question.question}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(question.options || []).map((option) => {
                              const active = clarificationAnswers[question.id] === option.value;
                              return (
                                <button
                                  key={`${question.id}-${option.value}`}
                                  type="button"
                                  onClick={() => setClarificationAnswer(question.id, option.value)}
                                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                                    active
                                      ? 'bg-primary/20 border-primary/50 text-primary'
                                      : 'bg-surface border-theme text-theme-secondary hover:border-primary/30'
                                  }`}
                                >
                                  {option.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reusableBlockCandidates.length > 0 && (
                  <div className="mb-3 p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                    <p className="text-sm text-cyan-300 mb-2">
                      Suggested reusable block candidates ({reusableBlockCandidates.length})
                    </p>
                    <div className="space-y-1">
                      {reusableBlockCandidates.slice(0, 4).map((candidate, index) => (
                        <p key={`${candidate.nodeId || 'candidate'}-${index}`} className="text-xs text-theme-secondary">
                          {candidate.name}{' -> '}{candidate.suggestedBlockId}
                        </p>
                      ))}
                    </div>
                    <p className="text-xs text-theme-secondary mt-2">
                      After opening the full composer, you can extract these subtrees as reusable blocks in one click.
                    </p>
                  </div>
                )}

                {nodes.length > 0 && (
                  <div className="mb-3 p-3 bg-success/10 border border-success/30 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-success flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        Structure ready with {getAllElements().length} elements
                      </span>
                      <button
                        onClick={() => setStep(3)}
                        className="text-sm text-primary hover:underline"
                      >
                        Review Structure →
                      </button>
                    </div>
                  </div>
                )}

                {/* Chat messages area */}
                <div
                  ref={chatContainerRef}
                  className={`flex-1 min-h-0 overflow-auto space-y-4 p-4 bg-background rounded-lg border border-theme`}
                >
                  {chatHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8">
                      <Bot size={48} className="mb-4 text-purple-400 opacity-50" />
                      <h3 className="text-lg font-medium text-theme-primary mb-2">AI Assistant</h3>
                      <p className="text-sm text-theme-secondary max-w-md">
                        Describe what data you need to capture in plain language.
                        I&apos;ll help you design the perfect structure.
                      </p>
                      <div className="mt-6 w-full max-w-2xl">
                        <p className="text-xs uppercase tracking-wide text-theme-secondary mb-3">
                          Try one of these examples
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {examplePrompts.slice(0, 4).map((prompt) => (
                            <button
                              key={prompt.short}
                              type="button"
                              onClick={() => handleExampleClick(prompt.full)}
                              className="px-3 py-1.5 text-xs rounded-lg border border-purple-500/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20 transition-colors"
                            >
                              {prompt.short}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-theme-secondary">
                          Click to insert a prompt, then press send.
                        </p>
                      </div>
                    </div>
                  ) : (
                    chatHistory.map((message, i) => (
                      <div
                        key={i}
                        className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {message.role === 'assistant' && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                            <Bot size={16} className="text-purple-400" />
                          </div>
                        )}
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            message.role === 'user'
                              ? 'bg-primary text-gray-900'
                              : 'bg-surface border border-theme text-theme-primary'
                          }`}
                        >
                          <p className="text-sm">{message.content}</p>
                        </div>
                        {message.role === 'user' && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <User size={16} className="text-primary" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  {loading && (
                    <div className="flex gap-3 justify-start">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                        <Bot size={16} className="text-purple-400" />
                      </div>
                      <div className="bg-surface border border-theme p-3 rounded-lg">
                        <div className="flex items-center gap-2 text-theme-secondary">
                          <Loader2 size={14} className="animate-spin" />
                          <span className="text-sm">Analyzing your requirements...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat input - fixed at bottom of container */}
                <div className={`flex-shrink-0 flex gap-2 ${embedded ? 'mt-auto pt-4 pb-2 bg-background border-t border-theme' : 'mt-3 p-2 bg-surface/95 backdrop-blur border border-theme rounded-lg'}`}>
                  <textarea
                    ref={aiInputRef}
                    value={currentMessage}
                    rows={1}
                    onChange={(e) => {
                      setCurrentMessage(e.target.value);
                      autoResizeTextarea(e.target);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !loading) {
                        e.preventDefault();
                        sendChatMessage();
                      }
                    }}
                    placeholder="Describe your data model... (⌘+Enter to send)"
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-surface border border-theme rounded-lg text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary disabled:opacity-50 resize-none leading-5"
                  />
                  <button
                    onClick={() => sendChatMessage()}
                    disabled={loading || !currentMessage.trim()}
                    className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>

              {nodes.length > 0 && (
                <div className="min-h-0 bg-background rounded-lg border border-theme p-4 overflow-auto">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-theme-primary">Live Structure Preview</h3>
                    <span className="text-xs text-theme-secondary">{getAllElements().length} elements</span>
                  </div>
                  <div className="space-y-2">
                    {getRootNode() ? renderNodeTree(getRootNode()) : (
                      <p className="text-sm text-theme-secondary">No structure yet.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && method === 'manual' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-theme-primary">Define Fields</h3>
                <button
                  onClick={addField}
                  className="flex items-center gap-2 px-3 py-2 bg-primary/20 text-primary rounded-lg hover:bg-primary/30 transition-colors"
                >
                  <Plus size={16} />
                  Add Field
                </button>
              </div>

              {/* Column headers */}
              {getFields().length > 0 && (
                <div className="flex items-center gap-3 px-3 text-xs text-theme-secondary font-medium">
                  <div className="w-5" /> {/* Spacer for grip icon */}
                  <div className="flex-1 grid grid-cols-4 gap-3">
                    <div>Display Name</div>
                    <div>Attribute Key <span className="font-normal opacity-70">(auto-generated)</span></div>
                    <div>Data Type</div>
                    <div>Options</div>
                  </div>
                  <div className="w-8" /> {/* Spacer for delete button */}
                </div>
              )}

              <div className="space-y-3">
                {getFields().map((field, index) => (
                  <div key={field.nodeId} className="flex items-start gap-3 p-3 bg-background rounded-lg border border-theme">
                    <GripVertical size={20} className="text-theme-secondary mt-2 cursor-grab" />
                    <div className="flex-1 grid grid-cols-4 gap-3">
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) => handleNameChange(field.nodeId, e.target.value)}
                        placeholder="e.g. Patient Name"
                        className="px-3 py-2 bg-surface border border-theme rounded text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary"
                      />
                      <input
                        type="text"
                        value={field.attribute}
                        onChange={(e) => handleAttributeChange(field.nodeId, e.target.value)}
                        placeholder="e.g. patientName"
                        className={`px-3 py-2 bg-surface border border-theme rounded text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary font-mono text-sm ${
                          manuallyEditedAttributes.has(field.nodeId) ? '' : 'text-theme-secondary'
                        }`}
                      />
                      <select
                        value={field.dataType}
                        onChange={(e) => updateField(field.nodeId, { dataType: e.target.value })}
                        className="px-3 py-2 bg-surface border border-theme rounded text-theme-primary focus:outline-none focus:border-primary"
                      >
                        {VALID_NODE_DATA_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm text-theme-secondary">
                          <input
                            type="checkbox"
                            checked={field.occurrences.min > 0}
                            onChange={(e) => updateField(field.nodeId, {
                              occurrences: { ...field.occurrences, min: e.target.checked ? 1 : 0 }
                            })}
                            className="rounded border-theme"
                          />
                          Required
                        </label>
                      </div>
                    </div>
                    <button
                      onClick={() => removeField(field.nodeId)}
                      className="p-2 text-theme-secondary hover:text-error transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                {getFields().length === 0 && (
                  <div className="text-center py-8 text-theme-secondary">
                    <p>No fields added yet. Click &quot;Add Field&quot; to start.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 text-success mb-4">
                <CheckCircle2 size={20} />
                <span className="font-medium">Structure generated successfully!</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-primary mb-1">
                  Object Name <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={objectName}
                  onChange={(e) => setObjectName(e.target.value)}
                  className="w-full px-4 py-2 bg-background border border-theme rounded-lg text-theme-primary focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-primary mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={`Optional description of this ${entityLabelLower}`}
                  rows={2}
                  className="w-full px-4 py-2 bg-background border border-theme rounded-lg text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-theme-primary">Structure ({getAllElements().length} elements)</h3>
                  <button
                    onClick={addField}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-primary/20 text-primary rounded hover:bg-primary/30 transition-colors"
                  >
                    <Plus size={12} />
                    Add Field
                  </button>
                </div>
                <div className="space-y-2 max-h-[220px] overflow-auto mb-4">
                  {getRootNode() ? renderNodeTree(getRootNode()) : (
                    <div className="text-center py-4 text-theme-secondary text-sm">No structure available yet.</div>
                  )}
                </div>
                <div className="space-y-2 max-h-[300px] overflow-auto">
                  {(getFields().length > 0 ? getFields() : getAllElements()).map((field) => (
                    <div key={field.nodeId} className="flex items-center gap-3 p-3 bg-background rounded-lg border border-theme">
                      <div className="flex-1 grid grid-cols-4 gap-3">
                        <input
                          type="text"
                          value={field.name}
                          onChange={(e) => updateField(field.nodeId, { name: e.target.value })}
                          className="px-2 py-1 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                        />
                        <input
                          type="text"
                          value={field.attribute}
                          onChange={(e) => updateField(field.nodeId, { attribute: e.target.value.replace(/\s/g, '') })}
                          className="px-2 py-1 bg-surface border border-theme rounded text-sm text-theme-primary font-mono focus:outline-none focus:border-primary"
                        />
                        <select
                          value={field.dataType}
                          onChange={(e) => updateField(field.nodeId, { dataType: e.target.value })}
                          className="px-2 py-1 bg-surface border border-theme rounded text-sm text-theme-primary focus:outline-none focus:border-primary"
                        >
                          {VALID_NODE_DATA_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 text-xs text-theme-secondary">
                          <input
                            type="checkbox"
                            checked={field.occurrences.min > 0}
                            onChange={(e) => updateField(field.nodeId, {
                              occurrences: { ...field.occurrences, min: e.target.checked ? 1 : 0 }
                            })}
                            className="rounded border-theme"
                          />
                          Required
                        </label>
                      </div>
                      <button
                        onClick={() => removeField(field.nodeId)}
                        className="p-1 text-theme-secondary hover:text-error transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {(method === 'ai' || method === 'example') && (
                <div className="bg-background border border-theme rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-theme-primary">Continue AI Conversation</h3>
                    <span className="text-xs text-theme-secondary">Updates apply immediately to this structure</span>
                  </div>
                  <div className="space-y-3 max-h-[220px] overflow-auto pr-1">
                    {chatHistory.length === 0 ? (
                      <p className="text-sm text-theme-secondary">No conversation yet.</p>
                    ) : (
                      chatHistory.map((message, i) => (
                        <div
                          key={`review-chat-${i}`}
                          className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          {message.role === 'assistant' && (
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center">
                              <Bot size={14} className="text-purple-400" />
                            </div>
                          )}
                          <div
                            className={`max-w-[85%] p-2 rounded-lg text-sm ${
                              message.role === 'user'
                                ? 'bg-primary text-gray-900'
                                : 'bg-surface border border-theme text-theme-primary'
                            }`}
                          >
                            {message.content}
                          </div>
                          {message.role === 'user' && (
                            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                              <User size={14} className="text-primary" />
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    {loading && (
                      <div className="flex gap-2 items-center text-theme-secondary text-sm">
                        <Loader2 size={14} className="animate-spin" />
                        <span>Refining structure...</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <textarea
                      ref={reviewAiInputRef}
                      value={currentMessage}
                      rows={1}
                      onChange={(e) => {
                        setCurrentMessage(e.target.value);
                        autoResizeTextarea(e.target);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !loading) {
                          e.preventDefault();
                          sendChatMessage();
                        }
                      }}
                      placeholder="Refine this model (e.g., add specimen details and interpretation)"
                      disabled={loading}
                      className="flex-1 px-3 py-2 bg-surface border border-theme rounded-lg text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary disabled:opacity-50 resize-none leading-5"
                    />
                    <button
                      onClick={() => sendChatMessage()}
                      disabled={loading || !currentMessage.trim()}
                      className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`p-6 border-t border-theme flex items-center justify-between ${embedded ? 'flex-shrink-0' : ''}`}>
          <div>
            {/* Hide back button in embedded mode */}
            {!embedded && step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 px-4 py-2 text-theme-secondary hover:text-theme-primary transition-colors"
              >
                <ArrowLeft size={16} />
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === 2 && method === 'manual' && getFields().length > 0 && (
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Review
                <ArrowRight size={16} />
              </button>
            )}
            {step === 2 && method === 'ai' && nodes.length > 0 && (
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Review Structure
                <ArrowRight size={16} />
              </button>
            )}
            {step === 3 && (
              <button
                onClick={handleComplete}
                className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <CheckCircle2 size={16} />
                Create Object
              </button>
            )}
          </div>
        </div>
    </>
  );
};

export default CreationWizard;
