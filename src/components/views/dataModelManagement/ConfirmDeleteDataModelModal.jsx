// src/components/views/dataModelManagement/ConfirmDeleteDataModelModal.jsx
"use client";

import React from 'react';
import PropTypes from 'prop-types';

const ConfirmDeleteDataModelModal = ({ dataModelName, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-lg p-6 max-w-md w-full border border-theme">
        <h3 className="text-lg font-medium text-error mb-2">Confirm Deletion</h3>
        <p className="text-theme-secondary mb-4">
          Are you sure you want to delete the data model "{dataModelName}"? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-surface-hover text-theme-secondary rounded hover:bg-surface border border-theme"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-error text-error-text rounded hover:opacity-90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

ConfirmDeleteDataModelModal.propTypes = {
  dataModelName: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired
};

export default ConfirmDeleteDataModelModal;
