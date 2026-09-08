// src/components/common/JsonTree.jsx
"use client";

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function isObjectLike(value) {
  return value !== null && typeof value === 'object';
}

function getChildEntries(value) {
  if (!isObjectLike(value)) return [];
  if (Array.isArray(value)) return value.map((v, i) => [String(i), v]);
  return Object.entries(value);
}

function summarizeValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value.length > 80 ? JSON.stringify(value.slice(0, 80) + '...') : JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (isObjectLike(value)) return `Object(${Object.keys(value).length})`;
  return String(value);
}

const JsonTreeNode = ({
  name,
  value,
  level = 0,
  defaultExpandedDepth = 1,
  maxHeight = null,
}) => {
  const childEntries = useMemo(() => getChildEntries(value), [value]);
  const hasChildren = childEntries.length > 0;
  const [expanded, setExpanded] = useState(level < defaultExpandedDepth);

  return (
    <div>
      <div
        className={cn(
          'flex items-start gap-2 py-1.5 px-2 border-b border-theme/40 hover:bg-surface-hover',
          hasChildren && 'cursor-pointer'
        )}
        style={{ paddingLeft: `${level * 14 + 8}px` }}
        onClick={() => hasChildren && setExpanded((v) => !v)}
        title={hasChildren ? 'Click to expand/collapse' : undefined}
      >
        <span className="w-4 h-4 mt-0.5 flex items-center justify-center text-theme-secondary">
          {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </span>
        <span className="text-xs font-mono text-theme-primary break-all">{name}</span>
        <span className="text-xs text-theme-secondary break-all">{summarizeValue(value)}</span>
      </div>

      {expanded && hasChildren && (
        <div style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
          {childEntries.map(([k, v]) => (
            <JsonTreeNode
              key={`${name}.${k}`}
              name={k}
              value={v}
              level={level + 1}
              defaultExpandedDepth={defaultExpandedDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const JsonTree = ({ data, rootName = 'root', defaultExpandedDepth = 1, maxHeight = '420px' }) => {
  if (data === null || data === undefined) {
    return (
      <div className="flex items-center justify-center py-8 text-theme-secondary">
        No data to display
      </div>
    );
  }

  return (
    <div className="bg-background rounded-lg border border-theme overflow-hidden">
      <div className="p-2 border-b border-theme bg-surface">
        <h4 className="text-sm font-medium text-theme-primary">Tree View</h4>
      </div>
      <div style={{ maxHeight, overflowY: 'auto' }}>
        <JsonTreeNode
          name={rootName}
          value={data}
          level={0}
          defaultExpandedDepth={defaultExpandedDepth}
        />
      </div>
    </div>
  );
};

export default JsonTree;

