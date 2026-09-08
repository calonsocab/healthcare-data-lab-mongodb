//src/components/views/lab/strategies/SemiFlattenedStrategyPanel.jsx
'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/common/Tabs";
import { Info, Cog, ChevronRight } from 'lucide-react';

// Import modular components
import OverviewSchemaTab from './OverviewSchemaTab';
import ConfigTab from './ConfigTab';

/**
 * Main panel for the Semi-Flattened strategy configuration
 * This component coordinates all the tabs and manages shared state
 */
const SemiFlattenedStrategyPanel = ({
  selectedQuery,
  selectedTemplate,
  strategyConfig,
  setStrategyConfig,
  metadata,
  setSelectedStrategy
}) => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <button
          onClick={() => setSelectedStrategy(null)}
          className="hover:text-slate-200 transition-colors"
        >
          Strategy Selection
        </button>
        <ChevronRight className="w-4 h-4" />
        <span className="text-slate-200">Semi-Flattened Nodes</span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            Overview & Schema
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Cog className="w-4 h-4" />
            Configuration
          </TabsTrigger>
        </TabsList>

        {/* Overview & Schema Tab (combined) */}
        <TabsContent value="overview">
          <OverviewSchemaTab />
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config">
          <ConfigTab
            strategyConfig={strategyConfig}
            setStrategyConfig={setStrategyConfig}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SemiFlattenedStrategyPanel;