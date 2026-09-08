// src/components/views/syntheticData/EnvironmentSelector.jsx
"use client";

import React, { useState, useEffect } from 'react';
import { Database, Eye, EyeOff, ChevronDown, ChevronUp, Settings, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const EnvironmentSelector = ({ selectedEnvironment, onEnvironmentChange }) => {
  const [environments, setEnvironments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showConnectionStrings, setShowConnectionStrings] = useState({});

  // Fetch environments on component mount
  useEffect(() => {
    fetchEnvironments();
  }, []);
  
  // Function to fetch environments
  const fetchEnvironments = async () => {
    try {
      setLoading(true);
      // Use the dedicated API endpoint for environments
      const response = await fetch('/api/metadata?category=environments');
      
      if (response.ok) {
        const data = await response.json();
        // Get environments array from the response
        const envs = data || [];
        console.log("Fetched environments:", envs);
        setEnvironments(envs);
        
        // If environments are available and none is selected yet, select the first active one
        if (envs && envs.length > 0 && !selectedEnvironment) {
          // First try to find an active environment
          const activeEnv = envs.find(env => env.isActive);
          // If no active environment, just use the first one
          const envToSelect = activeEnv || envs[0];
          onEnvironmentChange(envToSelect);
        }
      } else {
        console.error("Failed to fetch environments:", response.status, response.statusText);
        setError('Failed to load environments');
      }
    } catch (error) {
      console.error('Error fetching environments:', error);
      setError('Failed to load environments');
    } finally {
      setLoading(false);
    }
  };

  // Organize environments - active ones first, then sort alphabetically
  const sortedEnvironments = [...environments].sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return a.name.localeCompare(b.name);
  });

  // Toggle connection string visibility
  const toggleConnectionString = (envId) => {
    setShowConnectionStrings(prev => ({
      ...prev,
      [envId]: !prev[envId]
    }));
  };

  // Handle showing environment settings
  const handleShowEnvironmentSettings = () => {
    // This would navigate to the environment management page or open a modal
    alert('Please configure environments in the Metadata Manager');
  };

  return (
    <div className="space-y-3">
      <div 
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Database size={16} className="text-blue-400" />
          <h3 className="font-medium text-slate-300">Target Environment</h3>
          {selectedEnvironment && (
            <span className="ml-2 text-sm text-blue-400">({selectedEnvironment.name})</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              fetchEnvironments();
            }}
            className="p-1 text-slate-400 hover:text-blue-400" 
            title="Refresh environments list"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3">
          {error && (
            <div className="bg-red-900/30 border border-red-700 p-3 rounded-md text-red-300 text-sm">
              {error}
            </div>
          )}
          
          {loading ? (
            <div className="bg-slate-700 p-3 rounded-md text-slate-400 text-center">
              Loading environments...
            </div>
          ) : sortedEnvironments.length === 0 ? (
            <div className="bg-slate-700 p-3 rounded-md text-slate-400 text-sm italic">
              <p>No environments configured. Please configure at least one environment.</p>
              <div className="mt-2 text-xs text-slate-500">
                Debug info: Environments array is empty. Response received but no environments found.
              </div>
              <div className="mt-2">
                <button 
                  onClick={handleShowEnvironmentSettings}
                  className="px-3 py-1 bg-slate-600 text-slate-300 rounded-md hover:bg-slate-500 flex items-center gap-1"
                >
                  <Settings size={14} />
                  Configure Environments
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              <div className="text-xs text-slate-500 mb-2">
                Found {sortedEnvironments.length} environments
              </div>
              
              {sortedEnvironments.map(env => (
                <div 
                  key={env._id} 
                  className={cn(
                    "bg-slate-700 border rounded-lg p-3 transition-colors cursor-pointer",
                    selectedEnvironment && selectedEnvironment._id === env._id
                      ? 'border-blue-500 bg-blue-900/20'
                      : 'border-slate-600 hover:border-slate-500'
                  )}
                  onClick={() => onEnvironmentChange(env)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database size={16} className="text-blue-400" />
                      <h4 className="font-medium text-slate-200">{env.name}</h4>
                      {env.isActive && (
                        <span className="px-2 py-0.5 bg-green-900/50 text-green-400 text-xs rounded-full">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Environment Description */}
                  {env.description && (
                    <p className="text-sm text-slate-400 mt-2">{env.description}</p>
                  )}
                  
                  {/* Environment Details */}
                  <div className="text-xs text-slate-500 mt-2 space-y-1">
                    {env.database && (
                      <div>Database: <span className="text-slate-400">{env.database}</span></div>
                    )}
                    {env.connectionString && (
                      <div className="flex items-center">
                        <span>Connection: </span>
                        <span className="ml-1 text-slate-400">
                          {showConnectionStrings[env._id] 
                            ? env.connectionString 
                            : '••••••••••••••••••••'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleConnectionString(env._id);
                          }}
                          className="ml-2 text-slate-400 hover:text-blue-400"
                          title={showConnectionStrings[env._id] ? "Hide connection string" : "Show connection string"}
                        >
                          {showConnectionStrings[env._id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EnvironmentSelector;