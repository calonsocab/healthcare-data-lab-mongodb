"use client";

import React from 'react';
import PropTypes from 'prop-types';
import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildPortableQueryExport, createQueryExportFileName } from '@/lib/aqlQueries/portableQuery';

function downloadJsonFile(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}

const QueryExportButton = ({
  query,
  folders = [],
  label = null,
  className,
  title = 'Download query JSON',
  iconSize = 16,
}) => {
  const handleExport = (event) => {
    event.stopPropagation();
    const payload = buildPortableQueryExport(query, { folders });
    downloadJsonFile(createQueryExportFileName(query?.name), payload);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      className={cn(
        'flex items-center gap-1 text-theme-secondary hover:text-primary',
        label ? 'px-2 py-1 rounded-md hover:bg-surface-hover' : 'p-1',
        className
      )}
      title={title}
    >
      <Download size={iconSize} />
      {label ? <span>{label}</span> : null}
    </button>
  );
};

QueryExportButton.propTypes = {
  query: PropTypes.object.isRequired,
  folders: PropTypes.array,
  label: PropTypes.string,
  className: PropTypes.string,
  title: PropTypes.string,
  iconSize: PropTypes.number,
};

export default QueryExportButton;

