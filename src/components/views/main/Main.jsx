// src/components/views/DataLab/DataLab.jsx
"use client";

import React, { useState, useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { useDataModels } from '@/providers/DataModelProvider';
import { QueryBuilderProvider } from '@/providers/QueryBuilderProvider';

import DataModelManagement from '../dataModelManagement/DataModelManagement';
import QueryBuilder from '../queryBuilder/QueryBuilder';
import LabManager from '../lab/LabManager';
import AQLQueryManagement from '../AQLQueryManagement/AQLQueryManagement';
import OpenEHRAnalyticsPanel from '../dataAnalytics/OpenEhrAnalyticsPanel';
import SyntheticData from '../syntheticData/SyntheticData';
import APITestingDocs from '../apiTesting/APITestingDoc';
import MappingStudio from '../mappingStudio/MappingStudio';
import StrategyManager from '../strategyStudio/StrategyManager';
import { DeployStrategies } from '../deployStrategies';
import CopilotsStudio from '../copilots/CopilotsStudio';

const TAB_MAPPING = {
  templates: 'templates',
  mapping: 'mapping',
  builder: 'builder',
  queries: 'queryManagement',
  lab: 'convert',
  'copilot-questions': 'copilotQuestions',
  'copilot-products': 'copilotProducts',
  'copilot-tools': 'copilotTools',
  'copilot-answers': 'copilotAnswers',
  'copilot-control': 'copilotControl',
  strategies: 'strategies',
  'deploy-strategies': 'deployStrategies',
  synthetic: 'synthetic',
  api: 'apiTesting',
  analytics: 'analytics'
};

const ALLOWED_TABS = new Set([
  'templates',
  'mapping',
  'builder',
  'queryManagement',
  'convert',
  'copilotQuestions',
  'copilotProducts',
  'copilotTools',
  'copilotAnswers',
  'copilotControl',
  'strategies',
  'deployStrategies',
  'synthetic',
  'apiTesting',
  'analytics'
]);


const DataLab = ({ initialTab = 'templates', activeEnvironment, onEnvironmentRefresh, onJobStatusChange, onNavigate, syntheticDataPreviewOnly }) => {
  const {
    dataModelsByName,
    refreshDataModels,
    isLoading: loadingDataModels
  } = useDataModels();

  const [activeTab, setActiveTab] = useState(
    ALLOWED_TABS.has(TAB_MAPPING[initialTab] || initialTab)
      ? (TAB_MAPPING[initialTab] || initialTab)
      : 'templates'
  );

  useEffect(() => {
    setActiveTab(TAB_MAPPING[initialTab] || 'templates');
  }, [initialTab]);

  return (
    <div className="flex flex-col h-full bg-slate-900">
      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1">
        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-6">
            <Tabs.Content value="templates" className="space-y-6">
              <DataModelManagement
                templates={Object.values(dataModelsByName || {})}
                reloadTemplates={refreshDataModels}
                isLoading={loadingDataModels}
                onNavigate={onNavigate}
              />
            </Tabs.Content>

            <Tabs.Content value="mapping" className="space-y-6">
              <MappingStudio />
            </Tabs.Content>

            <Tabs.Content value="builder" className="space-y-6">
              <QueryBuilderProvider activeEnvironment={activeEnvironment}>
                <QueryBuilder />
              </QueryBuilderProvider>
            </Tabs.Content>

            <Tabs.Content value="queryManagement" className="space-y-6">
              <AQLQueryManagement />
            </Tabs.Content>

            <Tabs.Content value="convert" className="space-y-6">
              <LabManager activeEnvironment={activeEnvironment} onNavigate={onNavigate} />
            </Tabs.Content>

            <Tabs.Content value="copilotQuestions" className="space-y-6">
              <CopilotsStudio mode="questions" />
            </Tabs.Content>

            <Tabs.Content value="copilotProducts" className="space-y-6">
              <CopilotsStudio mode="products" />
            </Tabs.Content>

            <Tabs.Content value="copilotTools" className="space-y-6">
              <CopilotsStudio mode="tools" />
            </Tabs.Content>

            <Tabs.Content value="copilotAnswers" className="space-y-6">
              <CopilotsStudio mode="answers" />
            </Tabs.Content>

            <Tabs.Content value="copilotControl" className="space-y-6">
              <CopilotsStudio mode="control" />
            </Tabs.Content>

            <Tabs.Content value="strategies" className="space-y-6">
              <StrategyManager onEnvironmentRefresh={onEnvironmentRefresh} />
            </Tabs.Content>

            <Tabs.Content value="deployStrategies" className="space-y-6">
              <DeployStrategies
                activeEnvironment={activeEnvironment}
                onEnvironmentRefresh={onEnvironmentRefresh}
                onNavigate={onNavigate}
              />
            </Tabs.Content>

            <Tabs.Content value="synthetic" className="space-y-6">
              <SyntheticData activeEnvironment={activeEnvironment} onJobStatusChange={onJobStatusChange} onNavigate={onNavigate} syntheticDataPreviewOnly={syntheticDataPreviewOnly} />
            </Tabs.Content>

            <Tabs.Content value="apiTesting" className="space-y-6">
              <APITestingDocs activeEnvironment={activeEnvironment} />
            </Tabs.Content>

            <Tabs.Content value="analytics" className="space-y-6">
              <OpenEHRAnalyticsPanel />
            </Tabs.Content>
          </div>
        </main>
      </Tabs.Root>
    </div>
  );
};

export default DataLab;
