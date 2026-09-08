// src/components/views/queryBuilder/QueryBuilder.jsx
"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useQueryBuilderContext } from '@/providers/QueryBuilderProvider';
import SelectBuilder from './blocks/SelectBuilder';
import WhereBuilder from './blocks/WhereBuilder';
import OrderByBuilder from './blocks/OrderByBuilder';
import ReturnOptions from './blocks/ReturnOptions';
import QueryDisplay from './blocks/QueryDisplay';
import TemplateSelector from './blocks/TemplateSelector';
import FromBuilder from './blocks/FromBuilder';

const QueryBuilder = () => {
  const {
    activeTemplates,
    cachedTemplates,
    expandedSections,
    toggleSectionExclusive,
    generateQuery,
    queryState,
    buildNodePath,
    resetQuery,
    addWhereCondition,
    removeWhereCondition,
    updateWhereCondition,
    addGroup,
    removeGroup,
    updateGroup
  } = useQueryBuilderContext();

  const builderContentRef = useRef(null);
  const [templateSectionCollapsed, setTemplateSectionCollapsed] = useState(false);

  useEffect(() => {
    const el = builderContentRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (builderContentRef.current) {
        const scrollTop = builderContentRef.current.scrollTop;
        if (scrollTop > 100 && !templateSectionCollapsed) {
          setTemplateSectionCollapsed(true);
        } else if (scrollTop < 50 && templateSectionCollapsed) {
          setTemplateSectionCollapsed(false);
        }
      }
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [templateSectionCollapsed]);



  const toggleSectionWithTemplateCollapse = (sectionName) => {
    setTemplateSectionCollapsed(true);
    toggleSectionExclusive(sectionName);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-medium text-theme-primary">Query Builder</h2>
        <p className="text-sm text-theme-secondary">
          Build and compose AQL queries visually
        </p>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-sm text-theme-secondary leading-relaxed">
          <strong className="text-theme-primary">AQL (Archetype Query Language)</strong> is the standard way to query openEHR clinical data.
          It can look like SQL at first glance, but it isn't table-oriented—AQL navigates a hierarchical clinical object model.
          You reference data using <strong className="text-theme-primary">path expressions</strong> (conceptually similar to navigating
          nested fields, like dot notation), and you use operators like <strong className="text-theme-primary">CONTAINS</strong> to
          scope and bind the query to structures contained within other structures (for example, Observations inside a Composition).
        </p>
      </div>

      <div>
        <TemplateSelector
          isExpanded={!templateSectionCollapsed}
          onToggleExpand={() => {
            setTemplateSectionCollapsed(!templateSectionCollapsed);

            if (templateSectionCollapsed) {
              Object.keys(expandedSections).forEach(key => {
                if (expandedSections[key]) {
                  toggleSectionExclusive(key);
                }
              });
            }
          }}
        />
      </div>

      {activeTemplates && activeTemplates.length > 0 && (
        <div
          ref={builderContentRef}
          className="space-y-4 overflow-y-auto pb-80 hide-scrollbar"
          style={{ maxHeight: 'calc(100vh - 250px)' }}
        >
          <FromBuilder
            isExpanded={expandedSections.from}
            onToggleExpand={() => toggleSectionWithTemplateCollapse('from')}
          />

          <SelectBuilder
            isExpanded={expandedSections.select}
            onToggleExpand={() => toggleSectionWithTemplateCollapse('select')}
          />

          <WhereBuilder
            templates={cachedTemplates}
            activeTemplates={activeTemplates}
            conditions={queryState.where}
            onAddCondition={addWhereCondition}
            onRemoveCondition={removeWhereCondition}
            onUpdateCondition={updateWhereCondition}
            onAddGroup={addGroup}
            onRemoveGroup={removeGroup}
            onUpdateGroup={updateGroup}
            buildNodePath={buildNodePath}
            containmentVariables={queryState.contains}
            isExpanded={expandedSections.where}
            onToggleExpand={() => toggleSectionWithTemplateCollapse('where')}
          />

          <OrderByBuilder
            isExpanded={expandedSections.orderBy}
            onToggleExpand={() => toggleSectionWithTemplateCollapse('orderBy')}
          />

          <ReturnOptions
            isExpanded={expandedSections.returnOptions}
            onToggleExpand={() => toggleSectionWithTemplateCollapse('returnOptions')}
          />
        </div>
      )}

      {activeTemplates && activeTemplates.length > 0 && (
        <QueryDisplay
          query={generateQuery()}
          toggleSectionExclusive={toggleSectionWithTemplateCollapse}
          resetQuery={resetQuery}
        />
      )}
    </div>
  );

};

export default QueryBuilder;