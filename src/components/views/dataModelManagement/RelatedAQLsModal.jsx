// src/components/views/dataModelManagement/RelatedAQLsModal.jsx
"use client";

import React from 'react';
import PropTypes from 'prop-types';
import { X, Loader2, AlertCircle, ExternalLink } from 'lucide-react';

const RelatedAQLsModal = ({ templateName, relatedAQLs, loading, onClose, onViewQuery }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="surface rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col border border-theme">
        <div className="p-4 border-b border-theme flex justify-between items-center">
          <h2 className="text-xl font-bold text-theme-primary">
            AQL Queries Using "{templateName}"
          </h2>
          <button 
            onClick={onClose}
            className="text-theme-secondary hover:text-theme-primary"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin text-theme-primary" size={32} />
              <span className="ml-2 text-theme-primary">Loading related AQLs...</span>
            </div>
          ) : relatedAQLs.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle size={48} className="mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-medium text-theme-primary mb-2">No Related AQLs Found</h3>
              <p className="text-theme-secondary">
                There are no AQL queries that use this data model.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {relatedAQLs.map(aql => (
                <div key={aql._id} className="surface rounded-lg p-4 border border-theme">
                  <h3 className="text-lg font-medium text-theme-primary mb-1">{aql.name}</h3>
                  <p className="text-sm text-theme-secondary mb-3 line-clamp-2">
                    {aql.description || "No description available"}
                  </p>
                  
                  <div className="flex justify-end">
                    <button
                      onClick={() => onViewQuery(aql._id)}
                      className="px-3 py-1.5 btn-primary text-sm flex items-center gap-1"
                    >
                      <ExternalLink size={14} />
                      Open in AQL Editor
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-theme flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 btn-secondary"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

RelatedAQLsModal.propTypes = {
  templateName: PropTypes.string.isRequired,
  relatedAQLs: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onViewQuery: PropTypes.func.isRequired
};

export default RelatedAQLsModal;
