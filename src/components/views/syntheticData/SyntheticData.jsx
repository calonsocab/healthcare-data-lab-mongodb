"use client";

import SyntheticDataWorkflow from './SyntheticDataWorkflow';

const SyntheticData = ({ onJobStatusChange, onNavigate, syntheticDataPreviewOnly }) => {
  return <SyntheticDataWorkflow onJobStatusChange={onJobStatusChange} onNavigate={onNavigate} syntheticDataPreviewOnly={syntheticDataPreviewOnly} />;
};

export default SyntheticData;
