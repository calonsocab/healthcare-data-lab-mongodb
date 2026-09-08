// src/components/views/settings/dataOrganization/DataOrganization.jsx
"use client";

import React from 'react';
import { Tag, FolderTree, Plus, Edit2, Trash2, X } from 'lucide-react';
import useMetadataManager from '@/hooks/useMetadata';
import FolderManager from './FolderManager';
import TagManager from './TagManager';

const DataOrganization = ({ team, preferences, onUpdate, isIndividual }) => {
  const { metadata, loading, error, actions } = useMetadataManager();

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-2">Data Organization</h1>
      <p className="text-sm text-slate-400 mb-6">
        Organize your templates and AQL queries with folders and tags for better management
      </p>

      {/* Folders Section */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FolderTree className="text-yellow-500" size={20} />
            <h2 className="text-lg font-semibold text-white">Folders</h2>
            <span className="text-sm text-slate-400">({metadata.folders.length})</span>
          </div>
        </div>
        
        <p className="text-sm text-slate-400 mb-4">
          Create folders to organize your queries and templates hierarchically
        </p>
        
        <FolderManager
          folders={metadata.folders}
          actions={actions}
          loading={loading}
          error={error}
        />
      </div>

      {/* Tags Section */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Tag className="text-blue-500" size={20} />
            <h2 className="text-lg font-semibold text-white">Tags</h2>
            <span className="text-sm text-slate-400">({metadata.tags.length})</span>
          </div>
        </div>
        
        <p className="text-sm text-slate-400 mb-4">
          Use tags to categorize and filter your queries and templates across folders
        </p>
        
        <TagManager
          tags={metadata.tags}
          actions={actions}
          loading={loading}
          error={error}
        />
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-4 flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            <span className="text-white">Updating organization settings...</span>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-4 p-4 bg-red-900/30 border border-red-500 rounded-lg">
          <p className="text-red-300">{error}</p>
        </div>
      )}
    </div>
  );
};

export default DataOrganization;