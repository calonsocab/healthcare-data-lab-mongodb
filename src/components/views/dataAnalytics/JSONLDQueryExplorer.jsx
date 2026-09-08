//src/components/views/openEhrAnalytics/JSONLDQueryExplorer.jsx 
"use client";

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  FileCode, 
  Database, 
  Share2, 
  ExternalLink, 
  RefreshCw, 
  Download,
  Loader2
} from 'lucide-react';
import CollapsibleSection from '../../common/CollapsibleSection';

const JSONLDQueryExplorer = ({ savedMappings, loading }) => {
  const [selectedMapping, setSelectedMapping] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sampleData, setSampleData] = useState(null);
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState(null);
  const [loadingData, setLoadingData] = useState(false);

    const filteredMappings = React.useMemo(() => {
        const list = Array.isArray(savedMappings) ? savedMappings : [];
        const q = (searchQuery || '').toLowerCase();
       if (!q) return list;
        return list.filter(m => {
          const name = (m?.name || '').toLowerCase();
          const tpl  = (m?.templateName || '').toLowerCase();
          const typ  = (m?.config?.type || '').toLowerCase();
          return name.includes(q) || tpl.includes(q) || typ.includes(q);
        });
      }, [savedMappings, searchQuery]);

  // Load sample data when a mapping is selected
  useEffect(() => {
    if (selectedMapping) {
      loadSampleData();
    }
  }, [selectedMapping]);

  const loadSampleData = async () => {
    if (!selectedMapping) return;
    
    try {
      setLoadingData(true);
      setQueryError(null);
      
      // Replace with your actual API endpoint for fetching data
      const response = await fetch(`/api/compositions/sample?template=${selectedMapping.templateName}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch sample data');
      }
      
      const data = await response.json();
      setSampleData(data);
      
      // Transform data using the mapping
      const transformed = transformData(data, selectedMapping.config);
      setQueryResult(transformed);
      
    } catch (error) {
      console.error("Error loading sample data:", error);
      setQueryError(error.message);
      
      // If we can't load real data, create mock data for demonstration
      generateMockData(selectedMapping.config);
    } finally {
      setLoadingData(false);
    }
  };
  
  const generateMockData = (config) => {
    // Create a sample OpenEHR document structure
    const mockOpenEHR = {
      _id: "sample123",
      ehr_id: "patient456",
      composition_date: new Date().toISOString(),
      canonicalJSON: {
        uid: { value: "unique-identifier-789" },
        name: { value: "Sample Document" },
        language: { code_string: "en" },
        context: {
          start_time: { value: new Date().toISOString() },
          setting: { value: "other care" }
        },
        content: [
          {
            name: { value: "Immunization list" },
            items: [
              {
                name: { value: "Immunization management" },
                time: { value: new Date().toISOString() },
                description: {
                  items: [
                    {
                      name: { value: "Immunization item" },
                      value: { 
                        defining_code: { 
                          code_string: "407737004",
                          terminology_id: { value: "2.16.840.1.113883.6.96" }
                        }
                      }
                    },
                    {
                      name: { value: "Immunization details" },
                      items: [
                        {
                          name: { value: "Name" },
                          value: { 
                            defining_code: { 
                              code_string: "999999",
                              terminology_id: { value: "2.16.840.1.113883.4.292.10.5" }
                            }
                          }
                        },
                        {
                          name: { value: "Batch ID" },
                          value: { value: "12485634" }
                        },
                        {
                          name: { value: "Expiry" },
                          value: { value: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() }
                        }
                      ]
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    };
    
    setSampleData(mockOpenEHR);
    
    // Transform the mock data
    const transformed = transformData(mockOpenEHR, config);
    setQueryResult(transformed);
  };
  
  const transformData = (data, config) => {
    if (!data || !config) return null;
    
    // Create a copy of the original document to preserve all data
    const result = { ...data };
    
    // Create the JSON-LD structure
    const jsonLd = {
      "@context": config.context,
      "@type": config.type
    };
    
    // Add @id if configured
    if (config.idPath) {
      jsonLd["@id"] = getValueFromPath(data, config.idPath) || "unknown-id";
    }
    
    // Add properties - map all configured fields
    config.properties.forEach(prop => {
      if (prop.name && prop.path) {
        jsonLd[prop.name] = getValueFromPath(data, prop.path) || null;
      }
    });
    
    // Add the json_ld field to the result, preserving all original data
    result.json_ld = jsonLd;
    
    return result;
  };
  
  // Helper function to access nested properties with dot notation
  const getValueFromPath = (obj, path) => {
    const parts = path.split('.');
    let current = obj;
    
    for (let part of parts) {
      if (current == null) return null;
      current = current[part];
    }
    
    return current;
  };

  const handleDownloadJSON = () => {
    if (!queryResult) return;
    
    const dataStr = JSON.stringify(queryResult, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', dataUri);
    downloadLink.setAttribute('download', `${selectedMapping.name.replace(/\s+/g, '_')}_sample.json`);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Left Panel - Mappings */}
      <div className="lg:col-span-1 space-y-4">
        <div className="dark-banner bg-slate-800 rounded-lg p-4">
          <h2 className="text-lg font-medium text-slate-200 mb-4">Available Mappings</h2>
          
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search mappings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 p-2 bg-slate-700 border border-slate-600 
                text-slate-300 rounded-md focus:outline-none focus:ring-2 
                focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Mapping List */}
          <div className="max-h-[calc(100vh-350px)] overflow-y-auto pr-2 -mr-2 space-y-2">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-blue-400" size={24} />
              </div>
            ) : filteredMappings.length > 0 ? (
              filteredMappings.map((mapping) => (
                <div
                  key={mapping._id || mapping.id}
                  className={`p-3 rounded-md cursor-pointer transition-colors ${
                    selectedMapping && (selectedMapping._id === mapping._id || selectedMapping.id === mapping.id)
                      ? 'bg-blue-900/30 border border-blue-700'
                      : 'bg-slate-700 hover:bg-slate-600 border border-transparent'
                  }`}
                  onClick={() => setSelectedMapping(mapping)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <FileCode size={14} className="text-blue-400" />
                    <div className="text-sm font-medium text-slate-200 truncate">
                      {mapping.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                    <Database size={12} />
                    <span className="truncate">{mapping.templateName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Share2 size={12} />
                    <span className="truncate">{mapping.config.type}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 px-4">
                <p className="text-slate-400 mb-2">No mappings found</p>
                <p className="text-xs text-slate-500">
                  Create a mapping in the JSON-LD Mapping tab first.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Right Panel - Query Results */}
      <div className="lg:col-span-3 space-y-4">
        {selectedMapping ? (
          <>
            <div className="dark-banner bg-slate-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-slate-200">
                  Mapping: {selectedMapping.name}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={loadSampleData}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 
                             text-slate-300 rounded-md hover:bg-slate-600"
                    disabled={loadingData}
                  >
                    {loadingData ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                    Refresh
                  </button>
                  {queryResult && (
                    <button
                      onClick={handleDownloadJSON}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 
                               text-white rounded-md hover:bg-blue-700"
                    >
                      <Download size={14} />
                      Download
                    </button>
                  )}
                </div>
              </div>
              
              <div className="text-sm text-slate-400 space-y-1 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Template:</span>
                  <span>{selectedMapping.templateName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Type:</span>
                  <span>{selectedMapping.config.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Context:</span>
                  <a 
                    href={selectedMapping.config.context}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline flex items-center gap-1"
                  >
                    {selectedMapping.config.context}
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
              
              {queryError && (
                <div className="p-3 bg-red-900/30 border border-red-700 rounded-md mb-4">
                  <p className="text-red-300 text-sm">{queryError}</p>
                </div>
              )}
              
              {loadingData ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-blue-400" size={32} />
                  <span className="ml-2 text-slate-300">Loading data...</span>
                </div>
              ) : queryResult ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <CollapsibleSection
                    title="Original Data (OpenEHR)"
                    isExpanded={true}
                    onToggle={() => {}}
                  >
                    <div className="bg-slate-900 p-4 rounded-md max-h-[500px] overflow-auto">
                      <pre className="text-xs text-slate-300 whitespace-pre-wrap">
                        {JSON.stringify(sampleData, null, 2)}
                      </pre>
                    </div>
                  </CollapsibleSection>
                  
                  <CollapsibleSection
                    title="Transformed Data (JSON-LD)"
                    isExpanded={true}
                    onToggle={() => {}}
                  >
                    <div className="bg-slate-900 p-4 rounded-md max-h-[500px] overflow-auto">
                      <pre className="text-xs text-green-400 whitespace-pre-wrap">
                        {JSON.stringify(queryResult, null, 2)}
                      </pre>
                    </div>
                  </CollapsibleSection>
                </div>
              ) : (
                <div className="text-center py-12 px-4">
                  <p className="text-slate-400 mb-2">
                    Click &quot;Refresh&quot; to load sample data for this mapping.
                  </p>
                </div>
              )}
            </div>
            
            <div className="dark-banner bg-slate-800 rounded-lg p-4">
              <h3 className="text-md font-medium text-slate-200 mb-4">
                JSON-LD Usage Examples
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-700 rounded-md">
                  <h4 className="text-sm font-medium text-slate-200 mb-2">
                    SPARQL Query Example
                  </h4>
                  <pre className="text-xs text-blue-300 bg-slate-800 p-3 rounded">
{`PREFIX schema: <${selectedMapping.config.context}>

SELECT ?id ?date
WHERE {
  ?vaccine a schema:${selectedMapping.config.type} ;
           schema:administrationDate ?date .
  OPTIONAL { ?vaccine schema:identifier ?id }
}`}
                  </pre>
                </div>
                
                <div className="p-4 bg-slate-700 rounded-md">
                  <h4 className="text-sm font-medium text-slate-200 mb-2">
                    MongoDB View Creation
                  </h4>
                  <pre className="text-xs text-green-300 bg-slate-800 p-3 rounded">
{`db.createView(
  "${selectedMapping.config.type.toLowerCase()}_view",
  "compositions",
  ${JSON.stringify([
      {
        $match: { "composition_type": selectedMapping.templateName }
      },
      {
        $project: {
          "_id": 1,
          "ehr_id": 1,
          "json_ld": { /* mapping config here */ }
        }
      }
    ], null, 2)}
)`}
                  </pre>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="dark-banner bg-slate-800 rounded-lg p-8 text-center">
            <h3 className="text-lg font-medium text-slate-300 mb-2">No Mapping Selected</h3>
            <p className="text-slate-400 mb-4">
              Please select a mapping from the left panel to explore JSON-LD data.
            </p>
            {filteredMappings.length === 0 && (
              <p className="text-sm text-slate-500">
                No mappings available. Create a mapping in the JSON-LD Mapping tab first.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default JSONLDQueryExplorer;