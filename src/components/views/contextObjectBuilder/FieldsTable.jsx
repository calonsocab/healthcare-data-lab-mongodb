"use client";

import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Edit3,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  createFieldNode,
  VALID_NODE_DATA_TYPES,
  VALID_V1_ROLES,
  coerceDataTypeForRole,
  isDataTypeAllowedForRole
} from '@/lib/definitions/types';

const FieldsTable = ({ nodes, onNodesChange, readOnly = false }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set());
  const [editingNode, setEditingNode] = useState(null);
  const [draggedNode, setDraggedNode] = useState(null);

  const isProjectHeaderNode = (node) => {
    if (!node) return false;
    if (`${node.blockKind || ''}`.toLowerCase() === 'project_header') return true;
    if (`${node.role || ''}`.toLowerCase() !== 'block') return false;
    const hint = `${node.blockId || ''} ${node.attribute || ''} ${node.name || ''}`.toLowerCase();
    return /contextheader|context_header|projectheader|project_header/.test(hint);
  };

  // Get root node
  const getRootNode = () => nodes.find(n => n.parentNodeId === null);

  // Get children of a node
  const getChildren = (nodeId) => {
    const parent = nodes.find(n => n.nodeId === nodeId);
    if (!parent) return [];
    return parent.childrenNodeIds
      .map(id => nodes.find(n => n.nodeId === id))
      .filter(Boolean);
  };

  // Toggle node expansion
  const toggleExpand = (nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  // Add a new field
  const addField = (parentNodeId = null) => {
    const parent = parentNodeId ? nodes.find(n => n.nodeId === parentNodeId) : getRootNode();
    if (!parent) return;

    const fieldCount = nodes.length;
    const newField = createFieldNode(
      'New Field',
      'newField' + fieldCount,
      'string',
      false,
      parent.nodeId
    );

    const updatedNodes = nodes.map(node => {
      if (node.nodeId === parent.nodeId) {
        return {
          ...node,
          childrenNodeIds: [...node.childrenNodeIds, newField.nodeId]
        };
      }
      return node;
    });

    onNodesChange([...updatedNodes, newField]);

    // Expand parent if not already expanded
    if (!expandedNodes.has(parent.nodeId)) {
      toggleExpand(parent.nodeId);
    }
  };

  // Update a field
  const updateField = (nodeId, updates) => {
    if (updates.role) {
      const currentNode = nodes.find((node) => node.nodeId === nodeId);
      const candidateType = updates.dataType || currentNode?.dataType || 'string';
      updates = {
        ...updates,
        dataType: coerceDataTypeForRole(updates.role, candidateType)
      };
    }

    const updatedNodes = nodes.map(node => {
      if (node.nodeId === nodeId) {
        return { ...node, ...updates };
      }
      return node;
    });

    onNodesChange(updatedNodes);
  };

  // Remove a field
  const removeField = (nodeId) => {
    const nodeToRemove = nodes.find(n => n.nodeId === nodeId);
    if (isProjectHeaderNode(nodeToRemove)) return;
    if (!nodeToRemove || !nodeToRemove.parentNodeId) return; // Can't remove root

    // Also remove all children recursively
    const nodesToRemove = new Set([nodeId]);
    const addChildrenToRemove = (nId) => {
      const node = nodes.find(n => n.nodeId === nId);
      if (node?.childrenNodeIds) {
        node.childrenNodeIds.forEach(childId => {
          nodesToRemove.add(childId);
          addChildrenToRemove(childId);
        });
      }
    };
    addChildrenToRemove(nodeId);

    const updatedNodes = nodes
      .filter(n => !nodesToRemove.has(n.nodeId))
      .map(node => {
        if (node.nodeId === nodeToRemove.parentNodeId) {
          return {
            ...node,
            childrenNodeIds: node.childrenNodeIds.filter(id => id !== nodeId)
          };
        }
        return node;
      });

    onNodesChange(updatedNodes);
  };

  // Handle drag start
  const handleDragStart = (e, node) => {
    if (node.parentNodeId === null) return; // Can't drag root
    setDraggedNode(node);
    e.dataTransfer.effectAllowed = 'move';
  };

  // Handle drag over
  const handleDragOver = (e, targetNode) => {
    e.preventDefault();
    if (!draggedNode || draggedNode.nodeId === targetNode.nodeId) return;
    if (targetNode.parentNodeId === null) return; // Can't drop on root

    // Can only reorder siblings
    if (draggedNode.parentNodeId !== targetNode.parentNodeId) return;

    e.dataTransfer.dropEffect = 'move';
  };

  // Handle drop
  const handleDrop = (e, targetNode) => {
    e.preventDefault();
    if (!draggedNode || draggedNode.nodeId === targetNode.nodeId) return;
    if (draggedNode.parentNodeId !== targetNode.parentNodeId) return;

    const parentId = draggedNode.parentNodeId;
    const parent = nodes.find(n => n.nodeId === parentId);
    if (!parent) return;

    // Get current order
    const currentOrder = [...parent.childrenNodeIds];
    const draggedIndex = currentOrder.indexOf(draggedNode.nodeId);
    const targetIndex = currentOrder.indexOf(targetNode.nodeId);

    // Reorder
    currentOrder.splice(draggedIndex, 1);
    currentOrder.splice(targetIndex, 0, draggedNode.nodeId);

    // Update parent
    const updatedNodes = nodes.map(n => {
      if (n.nodeId === parentId) {
        return { ...n, childrenNodeIds: currentOrder };
      }
      return n;
    });

    onNodesChange(updatedNodes);
    setDraggedNode(null);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedNode(null);
  };

  // Render a node row
  const renderNode = (node, depth = 0) => {
    const hasChildren = node.childrenNodeIds.length > 0;
    const isExpanded = expandedNodes.has(node.nodeId);
    const isRoot = node.parentNodeId === null;
    const isEditing = editingNode === node.nodeId;

    const isDragging = draggedNode?.nodeId === node.nodeId;
    const canDrag = !isRoot && !readOnly;
    const isHeaderNode = isProjectHeaderNode(node);
    const allowedDataTypes = VALID_NODE_DATA_TYPES.filter((type) => (
      type === node.dataType || isDataTypeAllowedForRole(node.role || 'field', type)
    ));

    return (
      <React.Fragment key={node.nodeId}>
        <tr
          className={`border-b border-theme hover:bg-background/50 ${isRoot ? 'bg-primary/5' : ''} ${isDragging ? 'opacity-50' : ''}`}
          draggable={canDrag}
          onDragStart={(e) => canDrag && handleDragStart(e, node)}
          onDragOver={(e) => !isRoot && handleDragOver(e, node)}
          onDrop={(e) => !isRoot && handleDrop(e, node)}
          onDragEnd={handleDragEnd}
        >
          {/* Expand/Name column */}
          <td className="py-2 px-3">
            <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 20}px` }}>
              {!readOnly && !isRoot && (
                <GripVertical
                  size={14}
                  className="text-theme-secondary cursor-grab opacity-50 hover:opacity-100 transition-opacity"
                  title="Drag to reorder"
                />
              )}
              {hasChildren || node.dataType === 'object' || node.dataType === 'array' ? (
                <button
                  onClick={() => toggleExpand(node.nodeId)}
                  className="p-0.5 text-theme-secondary hover:text-theme-primary"
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
              ) : (
                <span className="w-5" />
              )}
              {isEditing ? (
                <input
                  type="text"
                  value={node.name}
                  onChange={(e) => updateField(node.nodeId, { name: e.target.value })}
                  onBlur={() => setEditingNode(null)}
                  onKeyPress={(e) => e.key === 'Enter' && setEditingNode(null)}
                  autoFocus
                  className="px-2 py-0.5 bg-surface border border-primary rounded text-sm text-theme-primary focus:outline-none w-40"
                />
              ) : (
              <span
                className={`text-sm font-medium ${isRoot ? 'text-primary' : 'text-theme-primary'} ${!readOnly ? 'cursor-pointer hover:text-primary' : ''}`}
                onClick={() => !readOnly && !isRoot && setEditingNode(node.nodeId)}
              >
                {node.name}
                {isRoot && <span className="text-xs ml-2 text-theme-secondary">(root)</span>}
                {isHeaderNode && <span className="text-xs ml-2 text-amber-300">(project header)</span>}
              </span>
              )}
            </div>
          </td>

          {/* Attribute */}
          <td className="py-2 px-3">
            {!isRoot ? (
              readOnly ? (
                <span className="text-xs font-mono text-theme-secondary">{node.attribute}</span>
              ) : (
                <input
                  type="text"
                  value={node.attribute}
                  onChange={(e) => updateField(node.nodeId, { attribute: e.target.value.replace(/\s/g, '') })}
                  className="px-2 py-0.5 bg-background border border-theme rounded text-xs font-mono text-theme-primary focus:outline-none focus:border-primary w-full"
                />
              )
            ) : (
              <span className="text-xs font-mono text-theme-secondary">-</span>
            )}
          </td>

          {/* Node ID */}
          <td className="py-2 px-3">
            <span className="text-xs font-mono text-green-400 opacity-70" title={node.nodeId}>
              {node.nodeId}
            </span>
          </td>

          {/* Role */}
          <td className="py-2 px-3">
            {readOnly ? (
              <span className={`inline-block px-2 py-0.5 rounded text-xs ${getRoleBadgeClass(node.role)}`}>
                {node.role || 'field'}
              </span>
            ) : (
              <select
                value={node.role || 'field'}
                onChange={(e) => updateField(node.nodeId, { role: e.target.value })}
                className="px-2 py-0.5 bg-background border border-theme rounded text-xs text-theme-primary focus:outline-none focus:border-primary"
              >
                {VALID_V1_ROLES.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            )}
          </td>

          {/* Data Type */}
          <td className="py-2 px-3">
            {readOnly ? (
              <span className={`inline-block px-2 py-0.5 rounded text-xs ${getDataTypeBadgeClass(node.dataType)}`}>
                {node.dataType}
              </span>
            ) : (
              <select
                value={node.dataType}
                onChange={(e) => updateField(node.nodeId, { dataType: e.target.value })}
                className="px-2 py-0.5 bg-background border border-theme rounded text-xs text-theme-primary focus:outline-none focus:border-primary"
              >
                {allowedDataTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            )}
          </td>

          {/* Required */}
          <td className="py-2 px-3 text-center">
            {!isRoot && (
              readOnly ? (
                node.occurrences.min > 0 ? (
                  <CheckCircle2 size={14} className="text-success inline-block" />
                ) : (
                  <span className="text-theme-secondary">-</span>
                )
              ) : (
                <input
                  type="checkbox"
                  checked={node.occurrences.min > 0}
                  onChange={(e) => updateField(node.nodeId, {
                    occurrences: { ...node.occurrences, min: e.target.checked ? 1 : 0 }
                  })}
                  className="rounded border-theme"
                />
              )
            )}
          </td>

          {/* Cardinality */}
          <td className="py-2 px-3">
            <span className="text-xs text-theme-secondary font-mono">
              {node.occurrences.min}..{node.occurrences.max}
            </span>
          </td>

          {/* Actions */}
          {!readOnly && (
            <td className="py-2 px-3">
              <div className="flex items-center gap-1">
                {(node.dataType === 'object' || node.dataType === 'array' || isRoot) && (
                  <button
                    onClick={() => addField(node.nodeId)}
                    className="p-1 text-theme-secondary hover:text-primary transition-colors"
                    title="Add child field"
                  >
                    <Plus size={14} />
                  </button>
                )}
                {!isRoot && !isHeaderNode && (
                  <button
                    onClick={() => removeField(node.nodeId)}
                    className="p-1 text-theme-secondary hover:text-error transition-colors"
                    title="Remove field"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </td>
          )}
        </tr>

        {/* Render children if expanded */}
        {isExpanded && hasChildren && (
          getChildren(node.nodeId).map(child => renderNode(child, depth + 1))
        )}
      </React.Fragment>
    );
  };

  // Get badge class for data type
  const getDataTypeBadgeClass = (dataType) => {
    switch (dataType) {
      case 'string': return 'bg-green-500/20 text-green-400';
      case 'number': return 'bg-blue-500/20 text-blue-400';
      case 'boolean': return 'bg-yellow-500/20 text-yellow-400';
      case 'date': return 'bg-purple-500/20 text-purple-400';
      case 'time': return 'bg-violet-500/20 text-violet-400';
      case 'object': return 'bg-orange-500/20 text-orange-400';
      case 'array': return 'bg-pink-500/20 text-pink-400';
      case 'code': return 'bg-cyan-500/20 text-cyan-400';
      case 'coded_text': return 'bg-cyan-500/20 text-cyan-300';
      case 'quantity': return 'bg-indigo-500/20 text-indigo-400';
      case 'reference': return 'bg-red-500/20 text-red-400';
      case 'identifier': return 'bg-red-500/20 text-red-300';
      case 'uri': return 'bg-emerald-500/20 text-emerald-300';
      case 'duration': return 'bg-fuchsia-500/20 text-fuchsia-300';
      case 'interval': return 'bg-amber-500/20 text-amber-300';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  // Get badge class for role (v1)
  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'section': return 'bg-purple-500/20 text-purple-400';
      case 'group': return 'bg-orange-500/20 text-orange-400';
      case 'field': return 'bg-green-500/20 text-green-400';
      case 'event': return 'bg-blue-500/20 text-blue-400';
      case 'event_series': return 'bg-indigo-500/20 text-indigo-400';
      case 'block': return 'bg-cyan-500/20 text-cyan-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const rootNode = getRootNode();

  if (!rootNode || nodes.length === 0) {
    return (
      <div className="text-center py-8 text-theme-secondary">
        <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
        <p>No structure defined yet.</p>
        {!readOnly && (
          <p className="text-sm mt-2">Use the wizard to create a structure or add nodes manually.</p>
        )}
      </div>
    );
  }

  return (
    <div className="border border-theme rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-surface">
          <tr className="border-b border-theme">
            <th className="py-2 px-3 text-left text-xs font-medium text-theme-secondary uppercase">Field Name</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-theme-secondary uppercase">Attribute</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-theme-secondary uppercase">Node ID</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-theme-secondary uppercase">Role</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-theme-secondary uppercase">Type</th>
            <th className="py-2 px-3 text-center text-xs font-medium text-theme-secondary uppercase">Required</th>
            <th className="py-2 px-3 text-left text-xs font-medium text-theme-secondary uppercase">Cardinality</th>
            {!readOnly && (
              <th className="py-2 px-3 text-left text-xs font-medium text-theme-secondary uppercase">Actions</th>
            )}
          </tr>
        </thead>
        <tbody>
          {renderNode(rootNode)}
        </tbody>
      </table>
    </div>
  );
};

export default FieldsTable;
