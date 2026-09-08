'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, Eye, Copy, Check, Download } from 'lucide-react';

const TransformedDocumentsModal = ({
  isOpen,
  onClose,
  groupType,
  group,
  compositions
}) => {
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [displayMode, setDisplayMode] = useState('formatted');
  const [wrapLines, setWrapLines] = useState(true);
  const [copied, setCopied] = useState(false);

  const transformedEntries = useMemo(() => {
    if (!group || !compositions) return [];
    return Object.entries(compositions)
      .filter(([_, data]) => data?.status === 'transformed' && data?.composition)
      .map(([docId, data]) => {
        const originalDoc = group.documents?.find((doc) => doc.id === docId || doc.id === data?.sourceDocId);
        return {
          docId,
          fileName: data?.fileName || originalDoc?.fileName || docId,
          composition: data.composition
        };
      });
  }, [group, compositions]);

  useEffect(() => {
    if (!isOpen) return;
    setSelectedDocId((prev) => {
      if (prev && transformedEntries.some((entry) => entry.docId === prev)) return prev;
      return transformedEntries[0]?.docId || null;
    });
    setDisplayMode('formatted');
    setWrapLines(true);
    setCopied(false);
  }, [isOpen, transformedEntries]);

  const selectedEntry = transformedEntries.find((entry) => entry.docId === selectedDocId) || null;
  const content = selectedEntry?.composition || null;
  const text = content
    ? (displayMode === 'formatted'
      ? JSON.stringify(content, null, 2)
      : JSON.stringify(content))
    : '';

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownloadSelected = () => {
    if (!selectedEntry) return;
    const blob = new Blob([JSON.stringify(selectedEntry.composition, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedEntry.fileName.replace(/\.[^.]+$/, '')}_composition.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative surface rounded-lg shadow-xl max-w-6xl w-full max-h-[88vh] flex flex-col border border-theme">
        <div className="flex items-center justify-between p-4 border-b border-theme">
          <div>
            <h3 className="text-lg font-medium text-theme-primary flex items-center gap-2">
              <Eye size={18} />
              Transformed Compositions
            </h3>
            <p className="text-xs text-theme-secondary mt-0.5">
              {group?.displayName || groupType} • {transformedEntries.length} output{transformedEntries.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-1 surface rounded p-1">
              <button
                onClick={() => setDisplayMode('formatted')}
                className={`px-2 py-1 rounded text-xs ${displayMode === 'formatted' ? 'bg-primary text-primary-text' : 'text-theme-primary hover:surface-hover'}`}
              >
                Formatted
              </button>
              <button
                onClick={() => setDisplayMode('raw')}
                className={`px-2 py-1 rounded text-xs ${displayMode === 'raw' ? 'bg-primary text-primary-text' : 'text-theme-primary hover:surface-hover'}`}
              >
                Raw
              </button>
              <button
                onClick={() => setWrapLines((prev) => !prev)}
                className={`px-2 py-1 rounded text-xs ${wrapLines ? 'bg-primary text-primary-text' : 'text-theme-primary hover:surface-hover'}`}
              >
                Wrap
              </button>
            </div>
            <button
              onClick={handleCopy}
              className="p-2 hover:surface-hover rounded transition-colors"
              title="Copy composition"
              disabled={!selectedEntry}
            >
              {copied ? <Check className="text-success" size={18} /> : <Copy className="text-theme-secondary" size={18} />}
            </button>
            <button
              onClick={handleDownloadSelected}
              className="p-2 hover:surface-hover rounded transition-colors"
              title="Download selected composition"
              disabled={!selectedEntry}
            >
              <Download className="text-theme-secondary" size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:surface-hover rounded transition-colors"
            >
              <X className="text-theme-secondary" size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[280px_1fr]">
          <div className="border-r border-theme p-3 overflow-auto">
            {transformedEntries.length === 0 ? (
              <p className="text-sm text-theme-secondary">No transformed outputs available.</p>
            ) : (
              <div className="space-y-2">
                {transformedEntries.map((entry) => (
                  <button
                    key={entry.docId}
                    type="button"
                    onClick={() => setSelectedDocId(entry.docId)}
                    className={`w-full text-left px-3 py-2 rounded border text-sm truncate ${
                      selectedDocId === entry.docId
                        ? 'border-primary text-primary'
                        : 'border-theme text-theme-primary hover:surface-hover'
                    }`}
                    title={entry.fileName}
                  >
                    {entry.fileName}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 overflow-auto">
            {selectedEntry ? (
              <pre className={`text-sm text-theme-primary font-mono ${wrapLines ? 'whitespace-pre-wrap' : 'whitespace-pre'}`}>
                <code>{text}</code>
              </pre>
            ) : (
              <p className="text-sm text-theme-secondary">Select a transformed document to inspect full output.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransformedDocumentsModal;
