// src/components/common/CodeViewer.jsx
'use client';

import React, { useRef, useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import Editor from '@monaco-editor/react';
import { Copy, Check, Download } from 'lucide-react';

// Define as a function declaration so it’s hoisted
function isDarkNow() {
  return true;
}

const CodeViewer = ({
  value = '',
  language = 'json',     // 'json' | 'xml' | 'sql' | 'text'
  height = 400,
  readOnly = true,
  fileName,
  className = '',
}) => {
  const [code, setCode] = useState(value ?? '');
  const [copied, setCopied] = useState(false);
  const editorRef = useRef(null);

  // keep editor theme synced with app theme
  const [isDark, setIsDark] = useState(isDarkNow());
  useEffect(() => {
    const el = document.documentElement;
    const mo = new MutationObserver(() => setIsDark(isDarkNow()));
    mo.observe(el, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    return () => mo.disconnect();
  }, []);

  // keep value in sync if parent updates it
  useEffect(() => {
    setCode(value ?? '');
  }, [value]);

  const doCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const doDownload = () => {
    const mime =
      language === 'xml' ? 'application/xml'
      : language === 'json' ? 'application/json'
      : 'text/plain';
    const suggestedName =
      fileName || (language === 'xml' ? 'template.opt'
      : language === 'json' ? 'webtemplate.json'
      : 'code.txt');

    const blob = new Blob([code], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className={`relative rounded-lg overflow-hidden ${className}`}
      style={{ height }}
    >
      {/* Floating controls */}
      <div className="pointer-events-none absolute top-2 right-2 z-20">
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl px-1.5 py-1
                        bg-white/10 dark:bg-white/12 backdrop-blur-sm shadow-md">
          <button
            onClick={doCopy}
            title={copied ? 'Copied' : 'Copy'}
            aria-label="Copy"
            className="p-1.5 rounded-md hover:bg-white/20 active:bg-white/25 transition
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button
            onClick={doDownload}
            title="Download"
            aria-label="Download"
            className="p-1.5 rounded-md hover:bg-white/20 active:bg-white/25 transition
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      <Editor
        value={code}
        onChange={(v) => setCode(v ?? '')}
        onMount={(editor) => (editorRef.current = editor)}
        theme={isDark ? 'vs-dark' : 'vs'}
        language={language}
        options={{
          readOnly,
          minimap: { enabled: false },
          wordWrap: 'on',
          fontSize: 12,
          lineNumbersMinChars: 3,
          padding: { top: 8 },
          renderWhitespace: 'selection',
          scrollBeyondLastLine: false,
          contextmenu: !readOnly,
          stickyScroll: { enabled: false },
        }}
      />
    </div>
  );
};

CodeViewer.propTypes = {
  value: PropTypes.string,
  language: PropTypes.oneOf(['json', 'xml', 'sql', 'text']),
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  readOnly: PropTypes.bool,
  fileName: PropTypes.string,
  className: PropTypes.string,
};

export default CodeViewer;