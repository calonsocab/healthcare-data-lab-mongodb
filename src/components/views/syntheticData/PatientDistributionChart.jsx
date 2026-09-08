// src/app/components/views/syntheticData/PatientDistributionChart.jsx
"use client";

import React from 'react';
import PropTypes from 'prop-types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const PatientDistributionChart = ({ distributionData, patientCount }) => {
  // Format size to human-readable format
  const formatSize = (size) => {
    if (size < 1) return `${(size * 1000).toFixed(0)} KB`;
    return `${size.toFixed(1)} MB`;
  };
  
  // Custom tooltip to show more details
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-800 p-3 border border-slate-700 rounded-md shadow-lg">
          <p className="font-medium text-slate-200">{data.templateName}</p>
          <p className="text-sm text-slate-300">
            <span className="font-medium">Documents:</span> {data.documentCount.toLocaleString()}
          </p>
          <p className="text-sm text-slate-300">
            <span className="font-medium">Size:</span> {formatSize(data.estimatedSize)}
          </p>
          <p className="text-sm text-slate-300">
            <span className="font-medium">Docs per Patient:</span> {(data.documentCount / patientCount).toFixed(1)}
          </p>
        </div>
      );
    }
    return null;
  };
  
  // Calculate totals for summary
  const totalDocuments = distributionData.reduce((sum, item) => sum + item.documentCount, 0);
  const totalSize = distributionData.reduce((sum, item) => sum + item.estimatedSize, 0);
  
  return (
    <div className="space-y-4">
      {/* Summary info */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-slate-700 p-3 rounded-md">
          <div className="text-sm text-slate-400">Total Patients</div>
          <div className="text-xl font-semibold text-slate-200">{patientCount.toLocaleString()}</div>
        </div>
        <div className="bg-slate-700 p-3 rounded-md">
          <div className="text-sm text-slate-400">Total Documents</div>
          <div className="text-xl font-semibold text-slate-200">{totalDocuments.toLocaleString()}</div>
        </div>
        <div className="bg-slate-700 p-3 rounded-md">
          <div className="text-sm text-slate-400">Estimated Size</div>
          <div className="text-xl font-semibold text-slate-200">{formatSize(totalSize)}</div>
        </div>
      </div>
      
      {/* Chart area */}
      <div className="h-72 bg-slate-700 rounded-md p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={distributionData}
            margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
            <XAxis 
              dataKey="templateName" 
              angle={-45} 
              textAnchor="end" 
              height={70} 
              tick={{ fill: '#94a3b8', fontSize: 12 }}
            />
            <YAxis tick={{ fill: '#94a3b8' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ color: '#f1f5f9' }} />
            <Bar 
              name="Document Count" 
              dataKey="documentCount" 
              fill="#3b82f6" 
              radius={[4, 4, 0, 0]} 
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Template details table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b border-slate-700">
              <th className="py-2 px-3 text-slate-300">Template</th>
              <th className="py-2 px-3 text-slate-300 text-right">Documents</th>
              <th className="py-2 px-3 text-slate-300 text-right">Docs/Patient</th>
              <th className="py-2 px-3 text-slate-300 text-right">Est. Size</th>
            </tr>
          </thead>
          <tbody>
            {distributionData.map((item, index) => (
              <tr key={index} className="border-b border-slate-700">
                <td className="py-2 px-3 text-slate-300">{item.templateName}</td>
                <td className="py-2 px-3 text-slate-300 text-right">{item.documentCount.toLocaleString()}</td>
                <td className="py-2 px-3 text-slate-300 text-right">{(item.documentCount / patientCount).toFixed(1)}</td>
                <td className="py-2 px-3 text-slate-300 text-right">{formatSize(item.estimatedSize)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

PatientDistributionChart.propTypes = {
  distributionData: PropTypes.arrayOf(PropTypes.shape({
    templateName: PropTypes.string.isRequired,
    documentCount: PropTypes.number.isRequired,
    estimatedSize: PropTypes.number.isRequired
  })).isRequired,
  patientCount: PropTypes.number.isRequired
};

export default PatientDistributionChart;