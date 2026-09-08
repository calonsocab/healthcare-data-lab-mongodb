// src/components/views/queryBuilder/blocks/OrderByBuilder.jsx
"use client";

import React, { useEffect, useCallback } from 'react';
import { X, ArrowUpDown } from 'lucide-react';
import PropTypes from 'prop-types';
import TreeView from '../../../common/TreeView';
import CollapsibleSection from '../../../common/CollapsibleSection';
import { useQueryBuilderContext } from '@/providers/QueryBuilderProvider';
import { AQL_ORDERABLE_TYPES, AQL_ORDER_DIRECTIONS } from '@/lib/aqlLexicon';

const OrderByBuilder = ({ isExpanded, onToggleExpand }) => {
  const {
    cachedTemplates,
    activeTemplates,
    queryState,
    buildNodePath,
    addOrderByItem,
    removeOrderByItem,
    updateOrderDirection,
    ensureTreeByName
  } = useQueryBuilderContext()

  const getTreeRoot = useCallback((doc) => {
    if (!doc?.webTemplate) return null;
    return Array.isArray(doc.webTemplate.children) ? doc.webTemplate : null;
  }, []);

  const normalizeForTreeView = useCallback((node) => {
    if (!node) return null;
    const text = node.text || node.localizedName || node.name || node.nodeId || 'Unnamed';
    const children = Array.isArray(node.children)
      ? node.children.map(normalizeForTreeView)
      : [];
    return { ...node, text, children };
  }, []);

  useEffect(() => {
    if (!activeTemplates?.length) return;
    (async () => {
      for (const name of activeTemplates) {
        const tpl = cachedTemplates?.[name];
        const hasTree = tpl?.webTemplate?.children?.length;
        if (!hasTree) await ensureTreeByName(name);
      }
    })();
  }, [activeTemplates, cachedTemplates, ensureTreeByName]);

  // Use the orderBy property from queryState
  const orderByItems = queryState.orderBy || [];

  const isOrderableNode = (node) => {
    const nodeType = node?.rmType?.toUpperCase();
    return !!nodeType && AQL_ORDERABLE_TYPES.has(nodeType);
  };

  return (
    <CollapsibleSection
      title="ORDER BY"
      isExpanded={isExpanded}
      onToggle={onToggleExpand}
    >
      <div className="space-y-6">
        {/* Template Trees */}
        <div className="space-y-4">
          {activeTemplates && activeTemplates.map(templateName => {
            if (!cachedTemplates || !cachedTemplates[templateName]) {
              console.warn(`Template data for key "${templateName}" is not loaded.`);
              return null;
            }
            const templateData = cachedTemplates[templateName];
            const root = getTreeRoot(templateData);
            if (!root) return null;
            return (
              <div key={templateName} className="bg-background rounded-lg p-4">
                <h3 className="text-lg font-medium text-theme-primary mb-4">{templateName}</h3>
                <TreeView
                  node={normalizeForTreeView(root)}
                  onSelect={(node) => addOrderByItem(templateName, node)}
                  isSelectable={isOrderableNode}
                  purpose="ORDER BY"
                />
              </div>
            );
          })}
        </div>

        {/* Order By Items */}
        <div className="mt-6">
          <h3 className="text-md font-medium text-theme-primary mb-4">
            <div className="flex items-center gap-2">
              <ArrowUpDown size={16} />
              Ordering
            </div>
          </h3>
          <div className="space-y-3">
            {orderByItems.length > 0 ? (
              orderByItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 bg-surface-hover p-4 rounded-lg"
                >
                  <div className="flex-1 text-theme-primary">
                    {buildNodePath(item.template, item.node, queryState.contains)}
                  </div>
                  <select
                    value={item.direction}
                    onChange={(e) => updateOrderDirection(index, e.target.value)}
                    className="px-3 py-2 bg-surface text-theme-primary rounded-md border border-theme focus:border-primary focus:outline-none"
                  >
                    {['ASC', 'DESC'].map(d => <option key={d} value={d}>{d === 'ASC' ? 'Ascending' : 'Descending'}</option>)}
                  </select>
                  <button
                    onClick={() => removeOrderByItem(index)}
                    className="text-theme-secondary hover:text-error transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              ))
            ) : (
              <div className="text-theme-secondary text-sm p-4 bg-surface rounded-lg">
                No ordering criteria defined. Click on items in the tree above to add them to the ORDER BY clause.
              </div>
            )}
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
};

OrderByBuilder.propTypes = {
  isExpanded: PropTypes.bool.isRequired,
  onToggleExpand: PropTypes.func.isRequired
};

export default OrderByBuilder;