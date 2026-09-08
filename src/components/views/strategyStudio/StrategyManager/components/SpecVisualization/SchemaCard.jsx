// src/components/views/strategyStudio/StrategyManager/components/SpecVisualization/SchemaCard.jsx
"use client";

import React, { useState } from 'react';
import { Key, Plus, Minus, GripVertical, ChevronRight, ChevronDown } from 'lucide-react';

/**
 * SchemaCard - Clean database schema visualization card
 *
 * Displays collection fields in a clean table format similar to MongoDB Compass:
 * - Collection name header with expand/collapse
 * - Field list with key icons, names, and types
 * - Nested object expansion
 */
const SchemaCard = ({
  collection,
  expanded = true,
  onToggleExpand,
  showHeader = true,
  className = ''
}) => {
  const [expandedFields, setExpandedFields] = useState(new Set());

  const toggleFieldExpand = (fieldName) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(fieldName)) {
        next.delete(fieldName);
      } else {
        next.add(fieldName);
      }
      return next;
    });
  };

  // Format type display
  const formatType = (field) => {
    if (!field.type) return 'mixed';

    let typeStr = field.type;

    // Handle arrays
    if (field.type === 'array') {
      if (field.items?.type) {
        typeStr = `${field.items.type}[]`;
      } else {
        typeStr = '[]';
      }
    }

    // Handle objectId
    if (field.type === 'objectId' || field.name === '_id') {
      typeStr = 'objectId';
    }

    return typeStr;
  };

  // Check if field is expandable (has nested fields)
  const isExpandable = (field) => {
    return (field.type === 'object' && field.nested) ||
           (field.type === 'array' && field.items?.nested);
  };

  // Render a single field row
  const renderField = (field, depth = 0) => {
    const isKey = field.name === '_id' || field.logicalKey === 'identity';
    const hasNested = isExpandable(field);
    const isFieldExpanded = expandedFields.has(field.name);
    const indent = depth * 16;

    return (
      <React.Fragment key={field.name}>
        <div
          className="flex items-center py-1.5 px-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 group"
          style={{ paddingLeft: indent + 12 }}
        >
          {/* Expand toggle for nested fields */}
          {hasNested ? (
            <button
              onClick={() => toggleFieldExpand(field.name)}
              className="w-4 h-4 mr-1 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              {isFieldExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
          ) : (
            <span className="w-5 mr-1" />
          )}

          {/* Key icon for identity fields */}
          {isKey && (
            <Key className="w-3.5 h-3.5 mr-2 text-emerald-500 flex-shrink-0" />
          )}

          {/* Field name */}
          <span className={`font-mono text-sm flex-1 ${
            isKey ? 'text-slate-900 dark:text-slate-100 font-medium' : 'text-slate-700 dark:text-slate-300'
          }`}>
            {field.name}
          </span>

          {/* Field type */}
          <span className={`font-mono text-sm text-right ${
            formatType(field) === '(mixed)'
              ? 'text-slate-400 dark:text-slate-500 italic border-b border-dotted border-slate-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}>
            {formatType(field)}
          </span>
        </div>

        {/* Render nested fields if expanded */}
        {hasNested && isFieldExpanded && (
          <div className="border-l border-slate-200 dark:border-slate-700 ml-6">
            {field.type === 'object' && field.nested &&
              Object.entries(field.nested).map(([key, nestedField]) =>
                renderField({ name: key, ...nestedField }, depth + 1)
              )
            }
            {field.type === 'array' && field.items?.nested &&
              Object.entries(field.items.nested).map(([key, nestedField]) =>
                renderField({ name: key, ...nestedField }, depth + 1)
              )
            }
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-slate-400" />
            <span className="font-semibold text-slate-900 dark:text-white">
              {collection.name}
            </span>
          </div>
          <button
            onClick={onToggleExpand}
            className="w-6 h-6 flex items-center justify-center rounded border border-slate-300 dark:border-slate-600 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            {expanded ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
          </button>
        </div>
      )}

      {/* Fields */}
      {expanded && (
        <div className="py-1">
          {collection.fields?.length > 0 ? (
            collection.fields.map(field => renderField(field))
          ) : (
            <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400 italic">
              No field schema available
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SchemaCard;
