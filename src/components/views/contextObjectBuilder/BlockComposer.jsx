"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Package,
  Search,
  Plus,
  Trash2,
  Copy,
  Repeat,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  GripVertical,
  Settings,
  X,
  Layers,
  Box,
  Database,
  FileText,
  Beaker,
  Heart,
  Pill,
  User,
  Activity,
  Thermometer,
  Droplets,
  Calendar,
  MapPin,
  Phone,
  Mail,
  Hash,
  Type,
  ToggleLeft,
  List,
  Wand2,
  Send,
  Bot,
  Loader2,
  CheckSquare,
  Square,
  Combine
} from 'lucide-react';

// Predefined block templates (like archetypes)
const BLOCK_LIBRARY = [
  {
    id: 'patient-identifier',
    name: 'Patient Identifier',
    category: 'Demographics',
    icon: User,
    color: 'blue',
    description: 'Unique patient identification',
    fields: [
      { name: 'ID Type', attribute: 'idType', dataType: 'code', required: true },
      { name: 'ID Value', attribute: 'idValue', dataType: 'string', required: true },
      { name: 'Issuer', attribute: 'issuer', dataType: 'string', required: false }
    ]
  },
  {
    id: 'person-name',
    name: 'Person Name',
    category: 'Demographics',
    icon: User,
    color: 'blue',
    description: 'Full name with parts',
    fields: [
      { name: 'Given Name', attribute: 'givenName', dataType: 'string', required: true },
      { name: 'Family Name', attribute: 'familyName', dataType: 'string', required: true },
      { name: 'Middle Name', attribute: 'middleName', dataType: 'string', required: false },
      { name: 'Prefix', attribute: 'prefix', dataType: 'string', required: false },
      { name: 'Suffix', attribute: 'suffix', dataType: 'string', required: false }
    ]
  },
  {
    id: 'address',
    name: 'Address',
    category: 'Demographics',
    icon: MapPin,
    color: 'blue',
    description: 'Physical address',
    fields: [
      { name: 'Street', attribute: 'street', dataType: 'string', required: true },
      { name: 'City', attribute: 'city', dataType: 'string', required: true },
      { name: 'State/Province', attribute: 'state', dataType: 'string', required: true },
      { name: 'Postal Code', attribute: 'postalCode', dataType: 'string', required: true },
      { name: 'Country', attribute: 'country', dataType: 'code', required: false }
    ]
  },
  {
    id: 'contact-info',
    name: 'Contact Information',
    category: 'Demographics',
    icon: Phone,
    color: 'blue',
    description: 'Phone and email contacts',
    fields: [
      { name: 'Phone Type', attribute: 'phoneType', dataType: 'code', required: false },
      { name: 'Phone Number', attribute: 'phoneNumber', dataType: 'string', required: false },
      { name: 'Email', attribute: 'email', dataType: 'string', required: false }
    ]
  },
  {
    id: 'analyte-result',
    name: 'Analyte Result',
    category: 'Laboratory',
    icon: Beaker,
    color: 'purple',
    description: 'Single lab test result',
    fields: [
      { name: 'Analyte Name', attribute: 'analyteName', dataType: 'string', required: true },
      { name: 'Analyte Code', attribute: 'analyteCode', dataType: 'code', required: false },
      { name: 'Result Value', attribute: 'resultValue', dataType: 'quantity', required: true },
      { name: 'Unit', attribute: 'unit', dataType: 'string', required: true },
      { name: 'Reference Low', attribute: 'refLow', dataType: 'number', required: false },
      { name: 'Reference High', attribute: 'refHigh', dataType: 'number', required: false },
      { name: 'Interpretation', attribute: 'interpretation', dataType: 'code', required: false }
    ]
  },
  {
    id: 'specimen',
    name: 'Specimen',
    category: 'Laboratory',
    icon: Droplets,
    color: 'purple',
    description: 'Sample collection details',
    fields: [
      { name: 'Specimen Type', attribute: 'specimenType', dataType: 'code', required: true },
      { name: 'Collection Date', attribute: 'collectionDate', dataType: 'date', required: true },
      { name: 'Collection Method', attribute: 'collectionMethod', dataType: 'code', required: false },
      { name: 'Body Site', attribute: 'bodySite', dataType: 'code', required: false }
    ]
  },
  {
    id: 'blood-pressure',
    name: 'Blood Pressure',
    category: 'Vital Signs',
    icon: Activity,
    color: 'red',
    description: 'Systolic and diastolic BP',
    fields: [
      { name: 'Systolic', attribute: 'systolic', dataType: 'number', required: true },
      { name: 'Diastolic', attribute: 'diastolic', dataType: 'number', required: true },
      { name: 'Position', attribute: 'position', dataType: 'code', required: false },
      { name: 'Cuff Size', attribute: 'cuffSize', dataType: 'code', required: false }
    ]
  },
  {
    id: 'body-temperature',
    name: 'Body Temperature',
    category: 'Vital Signs',
    icon: Thermometer,
    color: 'red',
    description: 'Temperature measurement',
    fields: [
      { name: 'Temperature', attribute: 'temperature', dataType: 'quantity', required: true },
      { name: 'Unit', attribute: 'unit', dataType: 'code', required: true },
      { name: 'Body Site', attribute: 'bodySite', dataType: 'code', required: false }
    ]
  },
  {
    id: 'heart-rate',
    name: 'Heart Rate',
    category: 'Vital Signs',
    icon: Heart,
    color: 'red',
    description: 'Pulse rate measurement',
    fields: [
      { name: 'Rate', attribute: 'rate', dataType: 'number', required: true },
      { name: 'Rhythm', attribute: 'rhythm', dataType: 'code', required: false },
      { name: 'Position', attribute: 'position', dataType: 'code', required: false }
    ]
  },
  {
    id: 'medication-item',
    name: 'Medication Item',
    category: 'Medication',
    icon: Pill,
    color: 'green',
    description: 'Single medication entry',
    fields: [
      { name: 'Medication Name', attribute: 'medicationName', dataType: 'string', required: true },
      { name: 'Medication Code', attribute: 'medicationCode', dataType: 'code', required: false },
      { name: 'Dose Amount', attribute: 'doseAmount', dataType: 'number', required: true },
      { name: 'Dose Unit', attribute: 'doseUnit', dataType: 'string', required: true },
      { name: 'Route', attribute: 'route', dataType: 'code', required: true },
      { name: 'Frequency', attribute: 'frequency', dataType: 'string', required: true }
    ]
  },
  {
    id: 'timing',
    name: 'Timing/Schedule',
    category: 'Common',
    icon: Calendar,
    color: 'orange',
    description: 'Date and time information',
    fields: [
      { name: 'Start Date', attribute: 'startDate', dataType: 'date', required: false },
      { name: 'End Date', attribute: 'endDate', dataType: 'date', required: false },
      { name: 'Duration', attribute: 'duration', dataType: 'string', required: false },
      { name: 'Frequency', attribute: 'frequency', dataType: 'string', required: false }
    ]
  },
  {
    id: 'clinical-note',
    name: 'Clinical Note',
    category: 'Common',
    icon: FileText,
    color: 'orange',
    description: 'Free text clinical information',
    fields: [
      { name: 'Note Text', attribute: 'noteText', dataType: 'string', required: true },
      { name: 'Note Type', attribute: 'noteType', dataType: 'code', required: false },
      { name: 'Author', attribute: 'author', dataType: 'string', required: false },
      { name: 'Date', attribute: 'date', dataType: 'date', required: false }
    ]
  },
  {
    id: 'code-value',
    name: 'Coded Value',
    category: 'Common',
    icon: Hash,
    color: 'orange',
    description: 'Code from terminology',
    fields: [
      { name: 'Code', attribute: 'code', dataType: 'string', required: true },
      { name: 'Display', attribute: 'display', dataType: 'string', required: true },
      { name: 'System', attribute: 'system', dataType: 'string', required: false }
    ]
  }
];

const CATEGORIES = ['All', 'Demographics', 'Laboratory', 'Vital Signs', 'Medication', 'Common'];

const BlockComposer = ({ initialComposition = [], onCompositionChange, onSave }) => {
  const [composition, setComposition] = useState(initialComposition);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [draggedBlock, setDraggedBlock] = useState(null);
  const [dragOverTarget, setDragOverTarget] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showBlockEditor, setShowBlockEditor] = useState(false);
  const [expandedBlocks, setExpandedBlocks] = useState(new Set());
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState([]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showWrapperDialog, setShowWrapperDialog] = useState(false);
  const [wrapperName, setWrapperName] = useState('');
  const [selectedForWrapper, setSelectedForWrapper] = useState([]);
  const canvasRef = useRef(null);
  const chatRef = useRef(null);

  // Filter blocks by search and category
  const filteredBlocks = BLOCK_LIBRARY.filter(block => {
    const matchesSearch = block.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      block.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || block.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Generate unique instance ID
  const generateInstanceId = () => `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

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

  const rmTypeToDataType = (rmType) => {
    const type = `${rmType || ''}`.toUpperCase();
    if (type === 'DV_CODED_TEXT') return 'code';
    if (type === 'DV_QUANTITY') return 'quantity';
    if (type === 'DV_DATE') return 'date';
    if (type === 'DV_DATE_TIME') return 'datetime';
    if (type === 'DV_COUNT') return 'integer';
    if (type === 'DV_BOOLEAN') return 'boolean';
    if (type === 'DV_IDENTIFIER') return 'reference';
    return 'string';
  };

  const extractFieldsFromWebTemplate = (tree) => {
    const fields = [];
    const walk = (node) => {
      const children = Array.isArray(node?.children) ? node.children : [];
      if (children.length === 0) {
        fields.push({
          name: node?.localizedName || node?.name || 'Field',
          attribute: aqlPathToAttribute(node?.aqlPath, node?.name || node?.localizedName || 'field'),
          dataType: rmTypeToDataType(node?.rmType),
          required: (node?.min || 0) > 0
        });
        return;
      }
      children.forEach((child) => walk(child));
    };
    walk(tree);
    return fields;
  };

  // Scroll AI chat to bottom
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [aiChatMessages]);

  // Create wrapper block from selected blocks
  const createWrapper = () => {
    if (selectedForWrapper.length < 2 || !wrapperName.trim()) return;

    const wrapperBlock = {
      instanceId: generateInstanceId(),
      blockId: 'custom-wrapper',
      name: wrapperName,
      icon: Box,
      color: 'orange',
      fields: [],
      occurrences: { min: 1, max: 1 },
      children: selectedForWrapper.map(id => {
        const block = findBlockInTree(composition, id);
        return block ? { ...block } : null;
      }).filter(Boolean),
      isExpanded: true,
      isCustom: true
    };

    // Remove selected blocks from root and add wrapper
    const newComposition = composition.filter(b => !selectedForWrapper.includes(b.instanceId));
    newComposition.push(wrapperBlock);

    setComposition(newComposition);
    setExpandedBlocks(prev => new Set([...prev, wrapperBlock.instanceId]));
    setSelectedForWrapper([]);
    setWrapperName('');
    setShowWrapperDialog(false);
  };

  // Find block in tree
  const findBlockInTree = (blocks, instanceId) => {
    for (const block of blocks) {
      if (block.instanceId === instanceId) return block;
      if (block.children) {
        const found = findBlockInTree(block.children, instanceId);
        if (found) return found;
      }
    }
    return null;
  };

  // Toggle block selection for wrapper
  const toggleWrapperSelection = (instanceId) => {
    setSelectedForWrapper(prev => {
      if (prev.includes(instanceId)) {
        return prev.filter(id => id !== instanceId);
      }
      return [...prev, instanceId];
    });
  };

  // AI Chat: Send message to generate fields
  const sendAIMessage = async () => {
    if (!aiChatInput.trim() || !selectedBlock) return;

    const userMessage = { role: 'user', content: aiChatInput };
    setAiChatMessages(prev => [...prev, userMessage]);
    setAiChatInput('');
    setAiLoading(true);

    try {
      const response = await fetch('/api/definitions/suggest-from-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: aiChatInput,
          objectName: selectedBlock.name
        })
      });

      if (!response.ok) throw new Error('Failed to get suggestions');

      const suggestion = await response.json();
      const newFields = Array.isArray(suggestion?.nodes)
        ? suggestion.nodes
          .filter(n => n.parentNodeId !== null)
          .map(n => ({
            name: n.name,
            attribute: n.attribute,
            dataType: n.dataType,
            required: n.occurrences.min > 0
          }))
        : extractFieldsFromWebTemplate(suggestion?.webTemplate);

      if (newFields.length > 0) {
        // Add new fields to selected block
        setComposition(prev => updateBlockInTree(prev, selectedBlock.instanceId, {
          fields: [...selectedBlock.fields, ...newFields]
        }));

        const aiResponse = {
          role: 'assistant',
          content: `Added ${newFields.length} new fields: ${newFields.map(f => f.name).join(', ')}. You can continue adding more or close this chat.`
        };
        setAiChatMessages(prev => [...prev, aiResponse]);
      } else {
        const aiResponse = {
          role: 'assistant',
          content: 'I couldn\'t identify specific fields from your description. Try being more specific, like "add patient age and gender" or "include medication dosage and route".'
        };
        setAiChatMessages(prev => [...prev, aiResponse]);
      }
    } catch (err) {
      const errorResponse = {
        role: 'assistant',
        content: `Error: ${err.message}. Please try again.`
      };
      setAiChatMessages(prev => [...prev, errorResponse]);
    } finally {
      setAiLoading(false);
    }
  };

  // Add custom field manually
  const addCustomField = () => {
    if (!selectedBlock) return;

    const newField = {
      name: 'New Field',
      attribute: 'newField' + (selectedBlock.fields.length + 1),
      dataType: 'string',
      required: false
    };

    setComposition(prev => updateBlockInTree(prev, selectedBlock.instanceId, {
      fields: [...selectedBlock.fields, newField]
    }));
  };

  // Update field in selected block
  const updateField = (fieldIndex, updates) => {
    if (!selectedBlock) return;

    const newFields = [...selectedBlock.fields];
    newFields[fieldIndex] = { ...newFields[fieldIndex], ...updates };

    setComposition(prev => updateBlockInTree(prev, selectedBlock.instanceId, {
      fields: newFields
    }));
  };

  // Remove field from selected block
  const removeField = (fieldIndex) => {
    if (!selectedBlock) return;

    const newFields = selectedBlock.fields.filter((_, i) => i !== fieldIndex);
    setComposition(prev => updateBlockInTree(prev, selectedBlock.instanceId, {
      fields: newFields
    }));
  };

  // Handle drag start from library
  const handleDragStart = (block, e) => {
    setDraggedBlock({ ...block, isNew: true });
    e.dataTransfer.setData('text/plain', JSON.stringify(block));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle drag start from canvas (reordering)
  const handleCanvasDragStart = (blockInstance, e) => {
    setDraggedBlock({ ...blockInstance, isNew: false });
    e.dataTransfer.setData('text/plain', JSON.stringify(blockInstance));
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag over canvas
  const handleDragOver = (e, targetId = null) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = draggedBlock?.isNew ? 'copy' : 'move';
    setDragOverTarget(targetId);
  };

  // Handle drop on canvas
  const handleDrop = (e, targetId = null, position = 'after') => {
    e.preventDefault();
    setDragOverTarget(null);

    if (!draggedBlock) return;

    if (draggedBlock.isNew) {
      // Adding new block from library
      const newBlockInstance = {
        instanceId: generateInstanceId(),
        blockId: draggedBlock.id,
        name: draggedBlock.name,
        icon: draggedBlock.icon,
        color: draggedBlock.color,
        fields: draggedBlock.fields.map(f => ({ ...f })),
        occurrences: { min: 1, max: 1 },
        children: [],
        isExpanded: true
      };

      if (targetId) {
        // Dropping as child of target
        setComposition(prev => addBlockToTarget(prev, targetId, newBlockInstance));
      } else {
        // Dropping at root level
        setComposition(prev => [...prev, newBlockInstance]);
      }

      setExpandedBlocks(prev => new Set([...prev, newBlockInstance.instanceId]));
    } else {
      // Moving existing block
      if (draggedBlock.instanceId === targetId) return;

      setComposition(prev => {
        // Remove from old position
        const withoutBlock = removeBlockFromComposition(prev, draggedBlock.instanceId);
        // Add to new position
        if (targetId) {
          return addBlockToTarget(withoutBlock, targetId, draggedBlock);
        } else {
          return [...withoutBlock, draggedBlock];
        }
      });
    }

    setDraggedBlock(null);
  };

  // Remove block from composition tree
  const removeBlockFromComposition = (blocks, instanceId) => {
    return blocks
      .filter(b => b.instanceId !== instanceId)
      .map(b => ({
        ...b,
        children: removeBlockFromComposition(b.children || [], instanceId)
      }));
  };

  // Add block as child of target
  const addBlockToTarget = (blocks, targetId, newBlock) => {
    return blocks.map(b => {
      if (b.instanceId === targetId) {
        return {
          ...b,
          children: [...(b.children || []), newBlock]
        };
      }
      return {
        ...b,
        children: addBlockToTarget(b.children || [], targetId, newBlock)
      };
    });
  };

  // Delete block
  const handleDeleteBlock = (instanceId) => {
    setComposition(prev => removeBlockFromComposition(prev, instanceId));
    if (selectedBlock?.instanceId === instanceId) {
      setSelectedBlock(null);
      setShowBlockEditor(false);
    }
  };

  // Duplicate block
  const handleDuplicateBlock = (block) => {
    const duplicated = {
      ...block,
      instanceId: generateInstanceId(),
      name: `${block.name} (copy)`,
      children: duplicateChildren(block.children || [])
    };

    setComposition(prev => {
      const index = prev.findIndex(b => b.instanceId === block.instanceId);
      if (index !== -1) {
        const newComp = [...prev];
        newComp.splice(index + 1, 0, duplicated);
        return newComp;
      }
      return [...prev, duplicated];
    });
  };

  const duplicateChildren = (children) => {
    return children.map(child => ({
      ...child,
      instanceId: generateInstanceId(),
      children: duplicateChildren(child.children || [])
    }));
  };

  // Update block occurrences (repetition)
  const handleUpdateOccurrences = (instanceId, min, max) => {
    setComposition(prev => updateBlockInTree(prev, instanceId, {
      occurrences: { min, max }
    }));
  };

  // Update block in tree
  const updateBlockInTree = (blocks, instanceId, updates) => {
    return blocks.map(b => {
      if (b.instanceId === instanceId) {
        const updated = { ...b, ...updates };
        if (selectedBlock?.instanceId === instanceId) {
          setSelectedBlock(updated);
        }
        return updated;
      }
      return {
        ...b,
        children: updateBlockInTree(b.children || [], instanceId, updates)
      };
    });
  };

  // Toggle block expansion
  const toggleBlockExpansion = (instanceId) => {
    setExpandedBlocks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(instanceId)) {
        newSet.delete(instanceId);
      } else {
        newSet.add(instanceId);
      }
      return newSet;
    });
  };

  // Get color classes for block
  const getColorClasses = (color) => {
    const colors = {
      blue: 'border-blue-500 bg-blue-500/10 hover:bg-blue-500/20',
      purple: 'border-purple-500 bg-purple-500/10 hover:bg-purple-500/20',
      red: 'border-red-500 bg-red-500/10 hover:bg-red-500/20',
      green: 'border-green-500 bg-green-500/10 hover:bg-green-500/20',
      orange: 'border-orange-500 bg-orange-500/10 hover:bg-orange-500/20'
    };
    return colors[color] || colors.blue;
  };

  const getIconColorClass = (color) => {
    const colors = {
      blue: 'text-blue-400',
      purple: 'text-purple-400',
      red: 'text-red-400',
      green: 'text-green-400',
      orange: 'text-orange-400'
    };
    return colors[color] || colors.blue;
  };

  // Render block in canvas
  const renderBlock = (block, depth = 0) => {
    const Icon = block.icon;
    const isExpanded = expandedBlocks.has(block.instanceId);
    const hasChildren = block.children && block.children.length > 0;
    const isSelected = selectedBlock?.instanceId === block.instanceId;
    const isDropTarget = dragOverTarget === block.instanceId;
    const isSelectedForWrapper = selectedForWrapper.includes(block.instanceId);

    return (
      <div key={block.instanceId} className="mb-2">
        <div
          draggable
          onDragStart={(e) => handleCanvasDragStart(block, e)}
          onDragOver={(e) => handleDragOver(e, block.instanceId)}
          onDragLeave={() => setDragOverTarget(null)}
          onDrop={(e) => handleDrop(e, block.instanceId)}
          onClick={() => {
            setSelectedBlock(block);
            setShowBlockEditor(true);
          }}
          className={`
            relative group border-2 rounded-lg p-3 cursor-pointer transition-all
            ${getColorClasses(block.color)}
            ${isSelected ? 'ring-2 ring-primary shadow-lg' : ''}
            ${isDropTarget ? 'ring-2 ring-yellow-400 bg-yellow-400/10' : ''}
            ${isSelectedForWrapper ? 'ring-2 ring-orange-400' : ''}
          `}
          style={{ marginLeft: `${depth * 24}px` }}
        >
          {/* Wrapper selection checkbox */}
          {depth === 0 && composition.length >= 2 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleWrapperSelection(block.instanceId);
              }}
              className="absolute -left-6 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded"
              title={isSelectedForWrapper ? 'Deselect for wrapper' : 'Select for wrapper'}
            >
              {isSelectedForWrapper ? (
                <CheckSquare size={16} className="text-orange-400" />
              ) : (
                <Square size={16} className="text-theme-secondary" />
              )}
            </button>
          )}

          {/* Drag handle */}
          <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab">
            <GripVertical size={16} className="text-theme-secondary" />
          </div>

          <div className="flex items-center gap-3 ml-4">
            {/* Expand/Collapse */}
            {(hasChildren || true) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleBlockExpansion(block.instanceId);
                }}
                className="p-0.5 hover:bg-white/10 rounded"
              >
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}

            {/* Icon */}
            <div className={`p-2 rounded ${getIconColorClass(block.color)}`}>
              <Icon size={20} />
            </div>

            {/* Block info */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-theme-primary">{block.name}</span>
                {/* Repetition badge */}
                {(block.occurrences.max === '*' || block.occurrences.max > 1) && (
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">
                    <Repeat size={10} />
                    {block.occurrences.min}..{block.occurrences.max}
                  </span>
                )}
              </div>
              <div className="text-xs text-theme-secondary">
                {block.fields.length} fields
                {hasChildren && ` • ${block.children.length} nested blocks`}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDuplicateBlock(block);
                }}
                className="p-1.5 hover:bg-white/10 rounded text-theme-secondary hover:text-theme-primary"
                title="Duplicate block"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedBlock(block);
                  setShowBlockEditor(true);
                }}
                className="p-1.5 hover:bg-white/10 rounded text-theme-secondary hover:text-theme-primary"
                title="Edit block"
              >
                <Settings size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteBlock(block.instanceId);
                }}
                className="p-1.5 hover:bg-red-500/20 rounded text-theme-secondary hover:text-red-400"
                title="Remove block"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Drop zone indicator */}
          {isDropTarget && (
            <div className="absolute inset-0 border-2 border-dashed border-yellow-400 rounded-lg pointer-events-none" />
          )}
        </div>

        {/* Children */}
        {isExpanded && hasChildren && (
          <div className="mt-2">
            {block.children.map(child => renderBlock(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex">
      {/* Block Library Panel - Collapsible */}
      <div className={`border-r border-theme bg-surface flex flex-col transition-all duration-300 ${libraryCollapsed ? 'w-12' : 'w-80'}`}>
        {libraryCollapsed ? (
          // Collapsed view
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
          // Expanded view
          <>
            <div className="p-4 border-b border-theme">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
                  <Package size={20} />
                  Block Library
                </h3>
                <button
                  onClick={() => setLibraryCollapsed(true)}
                  className="p-1 hover:bg-background rounded transition-colors"
                  title="Collapse library"
                >
                  <ChevronLeft size={18} className="text-theme-secondary" />
                </button>
              </div>
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search blocks..."
                  className="w-full pl-10 pr-4 py-2 bg-background border border-theme rounded-lg text-theme-primary placeholder:text-theme-secondary focus:outline-none focus:border-primary text-sm"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2 py-1 text-xs rounded ${
                      selectedCategory === cat
                        ? 'bg-primary text-white'
                        : 'bg-background text-theme-secondary hover:text-theme-primary'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-3 space-y-2">
              {filteredBlocks.map(block => {
                const Icon = block.icon;
                return (
                  <div
                    key={block.id}
                    draggable
                    onDragStart={(e) => handleDragStart(block, e)}
                    className={`
                      p-3 border-2 rounded-lg cursor-grab active:cursor-grabbing transition-all
                      ${getColorClasses(block.color)}
                    `}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={18} className={getIconColorClass(block.color)} />
                      <span className="font-medium text-theme-primary text-sm">{block.name}</span>
                    </div>
                    <p className="text-xs text-theme-secondary">{block.description}</p>
                    <div className="text-xs text-theme-secondary mt-1">
                      {block.fields.length} fields
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Composition Canvas */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-theme bg-surface flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
            <Layers size={20} />
            Composition Canvas
          </h3>
          <div className="flex items-center gap-2">
            {selectedForWrapper.length > 0 && (
              <span className="text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded">
                {selectedForWrapper.length} selected for wrapper
              </span>
            )}
            {composition.length >= 2 && (
              <button
                onClick={() => {
                  if (selectedForWrapper.length >= 2) {
                    setShowWrapperDialog(true);
                  } else {
                    // Start selection mode
                    setSelectedForWrapper([]);
                  }
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30 transition-colors text-sm"
                title="Combine blocks into a wrapper"
              >
                <Combine size={14} />
                {selectedForWrapper.length >= 2 ? 'Create Wrapper' : 'Wrap Blocks'}
              </button>
            )}
            <span className="text-sm text-theme-secondary">
              {composition.length} root blocks
            </span>
            {onSave && (
              <button
                onClick={() => onSave(composition)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm"
              >
                Save Composition
              </button>
            )}
          </div>
        </div>

        <div
          ref={canvasRef}
          className="flex-1 overflow-auto p-4 bg-background min-h-0"
          onDragOver={(e) => handleDragOver(e)}
          onDrop={(e) => handleDrop(e)}
        >
          {composition.length === 0 ? (
            <div className="h-full min-h-[400px] flex items-center justify-center border-2 border-dashed border-theme rounded-lg">
              <div className="text-center text-theme-secondary">
                <Layers size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Drag blocks here to start building</p>
                <p className="text-sm mt-2">
                  Drop blocks from the library to compose your data structure.
                  <br />
                  Nest blocks inside each other by dropping onto existing blocks.
                </p>
              </div>
            </div>
          ) : (
            <div>
              {composition.map(block => renderBlock(block))}
            </div>
          )}
        </div>
      </div>

      {/* Block Editor Panel */}
      {showBlockEditor && selectedBlock && (
        <div className="w-96 border-l border-theme bg-surface flex flex-col min-h-0">
          <div className="p-4 border-b border-theme flex items-center justify-between flex-shrink-0">
            <h3 className="text-lg font-semibold text-theme-primary">Block Properties</h3>
            <button
              onClick={() => setShowBlockEditor(false)}
              className="p-1 hover:bg-background rounded"
            >
              <X size={18} className="text-theme-secondary" />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4 space-y-4 min-h-0">
            {/* Block Name */}
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-1">
                Block Name
              </label>
              <input
                type="text"
                value={selectedBlock.name}
                onChange={(e) => {
                  setComposition(prev => updateBlockInTree(prev, selectedBlock.instanceId, {
                    name: e.target.value
                  }));
                }}
                className="w-full px-3 py-2 bg-background border border-theme rounded text-theme-primary focus:outline-none focus:border-primary"
              />
            </div>

            {/* Occurrences (Repetition) */}
            <div>
              <label className="block text-sm font-medium text-theme-primary mb-1">
                Repetition (Cardinality)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-theme-secondary">Min</label>
                  <input
                    type="number"
                    min="0"
                    value={selectedBlock.occurrences.min}
                    onChange={(e) => handleUpdateOccurrences(
                      selectedBlock.instanceId,
                      parseInt(e.target.value) || 0,
                      selectedBlock.occurrences.max
                    )}
                    className="w-full px-3 py-2 bg-background border border-theme rounded text-theme-primary focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-theme-secondary">Max (* for unbounded)</label>
                  <input
                    type="text"
                    value={selectedBlock.occurrences.max}
                    onChange={(e) => {
                      const val = e.target.value === '*' ? '*' : (parseInt(e.target.value) || 1);
                      handleUpdateOccurrences(selectedBlock.instanceId, selectedBlock.occurrences.min, val);
                    }}
                    className="w-full px-3 py-2 bg-background border border-theme rounded text-theme-primary focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
              <p className="text-xs text-theme-secondary mt-1">
                Set max to * for unlimited repetitions (e.g., multiple analytes)
              </p>
            </div>

            {/* Fields */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-theme-primary">
                  Fields ({selectedBlock.fields.length})
                </label>
                <div className="flex items-center gap-1">
                  <button
                    onClick={addCustomField}
                    className="p-1 text-theme-secondary hover:text-primary transition-colors"
                    title="Add custom field"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => {
                      setShowAIChat(!showAIChat);
                      setAiChatMessages([]);
                    }}
                    className={`p-1 transition-colors ${showAIChat ? 'text-purple-400' : 'text-theme-secondary hover:text-purple-400'}`}
                    title="AI Assistant - Add fields with natural language"
                  >
                    <Wand2 size={14} />
                  </button>
                </div>
              </div>
              <div className="space-y-2 max-h-48 overflow-auto">
                {selectedBlock.fields.map((field, i) => (
                  <div key={i} className="p-2 bg-background rounded border border-theme group">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={field.name}
                        onChange={(e) => updateField(i, { name: e.target.value })}
                        className="text-sm font-medium text-theme-primary bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 -ml-1"
                      />
                      <div className="flex items-center gap-1">
                        <label className="flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateField(i, { required: e.target.checked })}
                            className="rounded border-theme w-3 h-3"
                          />
                          <span className="text-xs text-theme-secondary">req</span>
                        </label>
                        <button
                          onClick={() => removeField(i)}
                          className="p-0.5 text-theme-secondary hover:text-error opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                    <input
                      type="text"
                      value={field.attribute}
                      onChange={(e) => updateField(i, { attribute: e.target.value.replace(/\s/g, '') })}
                      className="text-xs text-theme-secondary font-mono bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 -ml-1 w-full"
                    />
                    <select
                      value={field.dataType}
                      onChange={(e) => updateField(i, { dataType: e.target.value })}
                      className="text-xs text-theme-secondary bg-transparent border-none focus:outline-none mt-1"
                    >
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                      <option value="date">date</option>
                      <option value="code">code</option>
                      <option value="quantity">quantity</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Chat for adding fields */}
            {showAIChat && (
              <div className="border-t border-theme pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Bot size={16} className="text-purple-400" />
                  <span className="text-sm font-medium text-theme-primary">AI Field Assistant</span>
                </div>
                <div
                  ref={chatRef}
                  className="h-32 overflow-auto bg-background rounded p-2 mb-2 space-y-2"
                >
                  {aiChatMessages.length === 0 && (
                    <p className="text-xs text-theme-secondary">
                      Describe the fields you want to add. Example: &quot;add patient age, gender, and blood type&quot;
                    </p>
                  )}
                  {aiChatMessages.map((msg, i) => (
                    <div key={i} className={`text-xs ${msg.role === 'user' ? 'text-primary' : 'text-theme-secondary'}`}>
                      <span className="font-medium">{msg.role === 'user' ? 'You: ' : 'AI: '}</span>
                      {msg.content}
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="flex items-center gap-1 text-xs text-theme-secondary">
                      <Loader2 size={10} className="animate-spin" />
                      Thinking...
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={aiChatInput}
                    onChange={(e) => setAiChatInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendAIMessage()}
                    placeholder="Describe fields to add..."
                    className="flex-1 px-2 py-1 bg-background border border-theme rounded text-xs text-theme-primary focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={sendAIMessage}
                    disabled={aiLoading || !aiChatInput.trim()}
                    className="p-1 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
                  >
                    <Send size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="pt-4 border-t border-theme">
              <button
                onClick={() => handleDuplicateBlock(selectedBlock)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary/20 text-primary rounded hover:bg-primary/30 transition-colors mb-2"
              >
                <Copy size={16} />
                Duplicate Block
              </button>
              <button
                onClick={() => handleDeleteBlock(selectedBlock.instanceId)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-error/20 text-error rounded hover:bg-error/30 transition-colors"
              >
                <Trash2 size={16} />
                Remove Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wrapper Creation Dialog */}
      {showWrapperDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-theme rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-theme-primary mb-4">Create Wrapper Block</h3>
            <p className="text-sm text-theme-secondary mb-4">
              Combine {selectedForWrapper.length} blocks into a wrapper object. You can then set the wrapper&apos;s cardinality (e.g., make it an array).
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-theme-primary mb-1">
                Wrapper Name
              </label>
              <input
                type="text"
                value={wrapperName}
                onChange={(e) => setWrapperName(e.target.value)}
                placeholder="e.g., Patient Demographics, Lab Panel"
                className="w-full px-3 py-2 bg-background border border-theme rounded text-theme-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowWrapperDialog(false);
                  setSelectedForWrapper([]);
                  setWrapperName('');
                }}
                className="px-4 py-2 text-theme-secondary hover:text-theme-primary"
              >
                Cancel
              </button>
              <button
                onClick={createWrapper}
                disabled={!wrapperName.trim()}
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50"
              >
                Create Wrapper
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockComposer;
