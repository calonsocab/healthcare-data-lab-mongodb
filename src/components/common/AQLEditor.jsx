// src/components/common/AQLEditor.jsx - Improved error handling with ANTLR error suppression
'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Editor from "@monaco-editor/react";
import {
  Copy, 
  Brush, 
  Check, 
  TreePine, 
  ChevronRight,
  AlertTriangle,
  ChevronDown,
  BadgeCheck
} from 'lucide-react';
import { formatAQLQuery } from "@/lib/aqlToMql/formatter/formatter";
import { applyParameterSubstitutions } from "@/lib/aql-parameter-substitution";
import validateAQL from "@/lib/aqlToMql/parser/validateAql";
import { parseAql } from "@/lib/aqlToMql/parser/parseAqlAST.js";
import useMetadataManager from "@/hooks/useMetadata";

// Expected error patterns that can be safely ignored - the custom parser will handle these
const EXPECTED_ERROR_PATTERNS = [
  'no viable alternative at input \'EHR e[',
  'no viable alternative at input \'COMPOSITION c[',
  'no viable alternative at input \'EVALUATION ev[',
  'no viable alternative at input \'CLUSTER',
  'no viable alternative at input \'SECTION[',
  'no viable alternative at input \'ACTION',
  'mismatched input \'CONTAINS\'',
  'mismatched input \'AND\'',
  'extraneous input',
  'CONTAINS'
];

const normalizeValidationResult = (result, isExpectedError) => {
  if (!result) {
    return {
      success: false,
      isValid: false,
      message: 'Unexpected error during validation.',
      errors: [],
    };
  }

  const rawErrors = Array.isArray(result.errors) ? result.errors : [];
  const filteredErrors = rawErrors.filter((error) => !isExpectedError(error));
  const success = filteredErrors.length === 0;

  return {
    ...result,
    success,
    isValid: success,
    message: success ? 'Valid AQL query' : (result.message || 'AQL syntax errors detected.'),
    errors: filteredErrors,
  };
};

const SUBSTITUTION_INPUT_CLASSNAME = "w-full h-8 rounded-md border border-primary/15 bg-[#031512] px-3 py-1.5 font-mono text-[12px] font-medium text-primary outline-none transition-colors duration-150 placeholder:text-primary/35 focus:border-primary/30 focus:bg-[#05211c] focus:ring-0";

const toStringValue = (value) => (value === null || value === undefined ? '' : String(value));

const stripWrappedQuotes = (value) => toStringValue(value).replace(/^['"]|['"]$/g, '');

const getSubstitutionControlType = (type) => {
  switch (type) {
    case 'datetime':
      return 'datetime-local';
    case 'date':
      return 'date';
    case 'time':
      return 'time';
    case 'integer':
    case 'real':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return 'text';
  }
};

const getSubstitutionTypeLabel = (type) => {
  switch (type) {
    case 'datetime':
      return 'DateTime';
    case 'date':
      return 'Date';
    case 'time':
      return 'Time';
    case 'integer':
      return 'Integer';
    case 'real':
      return 'Real';
    case 'boolean':
      return 'Boolean';
    default:
      return toStringValue(type)
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Value';
  }
};

const getSubstitutionControlStyle = (type) => {
  const controlType = getSubstitutionControlType(type);

  if (controlType === 'date' || controlType === 'time' || controlType === 'datetime-local') {
    return { colorScheme: 'dark' };
  }

  return undefined;
};

const getSubstitutionControlValue = (substitution) => {
  const rawValue = stripWrappedQuotes(substitution?.rawValue);
  const controlType = getSubstitutionControlType(substitution?.type);

  if (!rawValue) {
    return '';
  }

  if (controlType === 'date') {
    return rawValue.split('T')[0];
  }

  if (controlType === 'time') {
    const timePart = rawValue.includes('T') ? rawValue.split('T')[1] : rawValue;
    return timePart.replace(/(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/, '').slice(0, 8);
  }

  if (controlType === 'datetime-local') {
    return rawValue
      .replace(/(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/, '')
      .slice(0, 19);
  }

  if (controlType === 'boolean') {
    return rawValue.toLowerCase() === 'true' ? 'true' : 'false';
  }

  return rawValue;
};

const normalizeControlValueForSubstitution = (type, value, previousRawValue = '') => {
  const nextValue = toStringValue(value).trim();
  const previousValue = stripWrappedQuotes(previousRawValue);

  if (!nextValue) {
    return '';
  }

  if (type === 'datetime') {
    const normalized = nextValue.length === 16 ? `${nextValue}:00` : nextValue;
    const hadTimezone = /(?:Z|[+-]\d{2}:\d{2})$/.test(previousValue);
    return hadTimezone ? `${normalized}Z` : normalized;
  }

  if (type === 'time') {
    return nextValue.length === 5 ? `${nextValue}:00` : nextValue;
  }

  if (type === 'boolean') {
    return nextValue === 'true' ? 'true' : 'false';
  }

  return nextValue;
};

const AQLEditor = forwardRef(({
  initialValue = '', 
  onAqlChange, 
  onValidation, 
  showAstPanel = false,
  onToggleAstPanel,
  readOnly = false,
  height = "450px",
  showFormatButton = true,
  wordWrap = 'off',
  fontSize = 12,
  lineHeight = 20,
  hideScrollbars = false,
  externalMarkers = [],
  editorOptions = {},
}, ref) => {
  const [aqlInput, setAqlInput] = useState(initialValue);
  const [errorHighlight, setErrorHighlight] = useState([]);
  const [showErrors, setShowErrors] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [formatMessage, setFormatMessage] = useState('');
  const [astOutput, setAstOutput] = useState(null);
  const [paramSubstitutions, setParamSubstitutions] = useState([]);
  const [parameterizedAql, setParameterizedAql] = useState('');
  const [showSubInfo, setShowSubInfo] = useState(false);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const errorSectionRef = useRef(null);
  const paramSectionRef = useRef(null);
  const editorContainerRef = useRef(null);
  const isProgrammaticEditorUpdateRef = useRef(false);
  const { metadata } = useMetadataManager();

  // Effect to update aqlInput when initialValue changes
  useEffect(() => {
    if (initialValue === aqlInput) {
      return;
    }

    setAqlInput(initialValue);
    setParamSubstitutions([]);
    setParameterizedAql('');
    setShowSubInfo(false);
  }, [aqlInput, initialValue]);

  // Effect to parse AST and validate AQL
  useEffect(() => {
    if (!aqlInput.trim()) {
      setAstOutput(null);
      setErrorHighlight([]);
      return;
    }

    try {
      // Parse the AQL to an AST - this will use the custom parser if ANTLR fails
      const ast = parseAql(aqlInput);
      
      if (ast) {
        const sanitizedAst = sanitizeAST(ast);
        setAstOutput(sanitizedAst);
      } else {
        setAstOutput(null);
      }

      // Validate the AQL
      const result = normalizeValidationResult(validateAQL(aqlInput), isExpectedError);
      
      setErrorHighlight(result.errors || []);

      // Call external validation if provided
      if (onValidation) {
        onValidation(result);
      }
    } catch (error) {
      // Only log unexpected errors
      if (!isExpectedError(error)) {
        console.error("❌ AST Parsing Error:", error);
      }

      const fallbackError = {
        line: 1,
        column: 1,
        message: error?.message || 'Unexpected error while parsing AQL.',
      };

      setErrorHighlight([fallbackError]);
      if (onValidation) {
        onValidation({
          success: false,
          isValid: false,
          message: 'Unexpected error during validation.',
          errors: [fallbackError],
        });
      }
      setAstOutput(null);
    }
  }, [aqlInput, onValidation]);

  useEffect(() => {
    if (errorHighlight.length > 0) {
      setShowErrors(true);
      return;
    }

    setShowErrors(false);
  }, [errorHighlight.length]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel?.();

    if (!editor || !monaco || !model) {
      return;
    }

    const syntaxMarkers = errorHighlight
      .filter((error) => typeof error?.line === 'number')
      .map((error) => {
        const lineNumber = Math.max(1, error.line);
        const startColumn = Math.max(1, (error.column ?? 0) + 1);
        const endColumn = Math.max(startColumn + 1, model.getLineMaxColumn(lineNumber));

        return {
          startLineNumber: lineNumber,
          endLineNumber: lineNumber,
          startColumn,
          endColumn,
          message: error.message || 'AQL syntax error',
          severity: monaco.MarkerSeverity.Error,
        };
      });

    const externalModelMarkers = Array.isArray(externalMarkers)
      ? externalMarkers
        .filter((marker) => marker && (typeof marker.line === 'number' || typeof marker.startLineNumber === 'number'))
        .map((marker) => {
          const lineNumber = Math.max(1, marker.startLineNumber || marker.line || 1);
          const endLineNumber = Math.max(lineNumber, marker.endLineNumber || marker.endLine || lineNumber);
          const startColumn = Math.max(
            1,
            marker.startColumn || marker.column || 1
          );
          const defaultEndColumn = endLineNumber === lineNumber
            ? Math.max(startColumn + 1, model.getLineMaxColumn(lineNumber))
            : model.getLineMaxColumn(endLineNumber);
          const endColumn = Math.max(
            startColumn + 1,
            marker.endColumn || defaultEndColumn
          );

          let severity = monaco.MarkerSeverity.Warning;
          if (marker.severity === 'error') severity = monaco.MarkerSeverity.Error;
          else if (marker.severity === 'info') severity = monaco.MarkerSeverity.Info;
          else if (marker.severity === 'hint') severity = monaco.MarkerSeverity.Hint;

          return {
            startLineNumber: lineNumber,
            endLineNumber,
            startColumn,
            endColumn,
            message: marker.message || 'Query diagnostic',
            severity,
          };
        })
      : [];

    monaco.editor.setModelMarkers(model, 'aql-validation', [...syntaxMarkers, ...externalModelMarkers]);

    return () => {
      monaco.editor.setModelMarkers(model, 'aql-validation', []);
    };
  }, [errorHighlight, externalMarkers]);

  // Check if an error is an expected one that our custom parser can handle
  const isExpectedError = (error) => {
    if (!error) return false;
    
    // Extract error message from different error object formats
    const errorMessage = error.message || error.msg || 
                        (typeof error === 'string' ? error : JSON.stringify(error));
    
    // Check if the error message matches any of our expected patterns
    return EXPECTED_ERROR_PATTERNS.some(pattern => 
      errorMessage.includes(pattern)
    );
  };

  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(aqlInput);
      setCopyMessage('Copied!');
      setTimeout(() => setCopyMessage(''), 2000);
    } catch (error) {
      console.error('Copy failed', error);
    }
  };

  const updateEditorText = (nextText, source = 'aqlUpdate') => {
    const editor = editorRef.current;
    const model = editor?.getModel?.();

    if (!editor || !model) {
      setAqlInput(nextText);
      return;
    }

    if (model.pushUndoStop) {
      model.pushUndoStop();
    }

    isProgrammaticEditorUpdateRef.current = true;
    editor.executeEdits(source, [
      {
        range: model.getFullModelRange(),
        text: nextText,
        forceMoveMarkers: true
      }
    ]);

    if (model.pushUndoStop) {
      model.pushUndoStop();
    }

    editor.setScrollPosition({ scrollTop: 0, scrollLeft: 0 });
    setAqlInput(nextText);
  };

  // Handle AQL formatting and parameter substitution
  const handleFormat = async () => {
    const editor = editorRef.current;
    const model = editor?.getModel?.();

    if (!model) return;

    try {
      // Get templates from metadata
      const templates = metadata?.templates || [];
      
      // Format and optionally substitute parameters
      const {
        formattedQuery,
        parameterizedQuery,
        substitutions,
        hasSubstitutions
      } = await formatAQLQuery(aqlInput, templates);

      updateEditorText(formattedQuery, 'formatAQL');
      
      if (hasSubstitutions && substitutions.length > 0) {
        setParameterizedAql(parameterizedQuery);
        setParamSubstitutions(substitutions);
        setShowSubInfo(true); // Auto-expand parameter info
        setFormatMessage('Formatted!');
      } else {
        setParameterizedAql('');
        setParamSubstitutions([]);
        setShowSubInfo(false);
        setFormatMessage('Formatted!');
      }
      
      setTimeout(() => setFormatMessage(''), 2000);
      return { formattedQuery, substitutions, hasSubstitutions };
    } catch (error) {
      console.error("Formatting error:", error);
      return null;
    }
  };

  useImperativeHandle(ref, () => ({
    formatAql: handleFormat,
    focus: () => editorRef.current?.focus(),
    getValue: () => aqlInput,
  }));

  // Toggle error display
  const toggleErrors = () => {
    setShowErrors(!showErrors);
  };

  // Toggle parameter substitution info panel
  const toggleSubInfo = () => {
    setShowSubInfo(!showSubInfo);
  };

  const handleSubstitutionValueChange = (parameter, nextControlValue) => {
    if (!parameterizedAql) {
      return;
    }

    const updatedSubstitutions = paramSubstitutions.map((substitution) => {
      if (substitution.parameter !== parameter) {
        return substitution;
      }

      return {
        ...substitution,
        rawValue: normalizeControlValueForSubstitution(
          substitution.type,
          nextControlValue,
          substitution.rawValue
        ),
      };
    });

    const { aqlText, substitutions } = applyParameterSubstitutions(
      parameterizedAql,
      updatedSubstitutions
    );

    setParamSubstitutions(substitutions);
    updateEditorText(aqlText, 'parameterSubstitution');
  };

  // Handle AQL input change
  const handleAqlChange = (value) => {
    const nextValue = value ?? '';
    setAqlInput(nextValue);

    if (isProgrammaticEditorUpdateRef.current) {
      isProgrammaticEditorUpdateRef.current = false;
    } else if (paramSubstitutions.length > 0 || parameterizedAql) {
      setParamSubstitutions([]);
      setParameterizedAql('');
      setShowSubInfo(false);
    }
    
    // Call external change handler if provided
    if (onAqlChange) {
      onAqlChange(nextValue);
    }
  };

  // Render parameter substitution info section
  const renderSubstitutionInfo = () => {
    return (
      <div
        ref={paramSectionRef}
        className="rounded-md border-t-2 border-t-[#0d5a43] bg-background/12 px-3 py-2.5 text-theme-primary animate-fadeIn"
      >
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[13px] font-medium text-theme-primary">Parameter values</div>
            <div className="mt-0.5 text-[10px] leading-relaxed text-theme-secondary">
              Editing a value rewrites the substituted AQL in the editor above.
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 self-start rounded-full border border-primary/15 bg-background/16 px-2.5 py-1 text-[10px] font-medium text-primary/90">
            <BadgeCheck size={10} className="text-primary" />
            <span>{paramSubstitutions.length} adjustable value{paramSubstitutions.length > 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="mt-2 hidden px-2 md:grid md:grid-cols-[minmax(0,220px)_92px_minmax(0,1fr)] md:items-center md:gap-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-theme-muted">Parameter</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-theme-muted">Type</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-theme-muted">Value</div>
        </div>

        <div className="mt-1.5 space-y-1.5">
          {paramSubstitutions.map((sub) => {
            const controlType = getSubstitutionControlType(sub.type);

            return (
              <div
                key={sub.parameter}
                className="grid gap-1.5 rounded-md bg-background/18 px-2.5 py-2 md:grid-cols-[minmax(0,220px)_92px_minmax(0,1fr)] md:items-center md:gap-3"
              >
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-theme-muted md:hidden">Parameter</div>
                  <div className="break-all font-mono text-[12px] font-semibold text-primary">
                    {sub.parameter}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-theme-muted md:hidden">Type</div>
                  <div className="inline-flex items-center rounded-full bg-background/32 px-2 py-0.5 text-[10px] font-medium text-theme-secondary">
                    {getSubstitutionTypeLabel(sub.type)}
                  </div>
                </div>

                <div className="min-w-0 md:justify-self-start">
                  <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-theme-muted md:hidden">Value</div>
                  <div className="w-full md:max-w-[420px] lg:max-w-[460px]">
                    {controlType === 'boolean' ? (
                      <select
                        className={`${SUBSTITUTION_INPUT_CLASSNAME} cursor-pointer`}
                        style={getSubstitutionControlStyle(sub.type)}
                        value={getSubstitutionControlValue(sub)}
                        onChange={(event) => handleSubstitutionValueChange(sub.parameter, event.target.value)}
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : (
                      <input
                        type={controlType}
                        step={sub.type === 'datetime' || sub.type === 'time' ? 1 : sub.type === 'real' ? 'any' : undefined}
                        value={getSubstitutionControlValue(sub)}
                        onChange={(event) => handleSubstitutionValueChange(sub.parameter, event.target.value)}
                        className={SUBSTITUTION_INPUT_CLASSNAME}
                        style={getSubstitutionControlStyle(sub.type)}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render error information section
  const renderErrorInfo = () => {
    return (
      <div ref={errorSectionRef} className="p-3 bg-surface rounded-md text-error border border-error/30 animate-fadeIn">
        <ul className="space-y-2">
          {errorHighlight.map((error, index) => (
            <li key={index} className="border-l-2 border-error pl-2 py-1">
              <div className="font-medium text-xs">
                Line {error.line}, Column {typeof error.column === 'number' ? error.column + 1 : error.column}:
              </div>
              <div className="text-xs text-error/80">{error.message}</div>
              {error.expected && (
                <div className="mt-0.5 text-xs text-theme-secondary bg-background/50 p-1.5 rounded">
                  <span className="font-medium">Expected:</span> {error.expected}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="relative w-full flex flex-col" ref={editorContainerRef}>
      {/* Main content area with editor and AST panel side by side */}
      <div className="w-full bg-surface-alt p-4">
        <div className="flex" style={{ height }}>
          {/* AQL Editor side */}
          <div className={`${showAstPanel ? 'w-1/2 pr-2' : 'w-full'} transition-all duration-300`}>
            <Editor
              height="100%"
              theme="vs-dark"
              defaultLanguage="sql"
              value={aqlInput}
              onChange={handleAqlChange}
              onMount={(editor, monaco) => {
                editorRef.current = editor;
                monacoRef.current = monaco;
              }}
              className="rounded-lg"
              options={{
                minimap: { enabled: false },
                wordWrap,
                fontSize,
                lineHeight,
                lineNumbersMinChars: 3,
                padding: { top: 10 },
                stickyScroll: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true,
                scrollbar: {
                  alwaysConsumeMouseWheel: false,
                  useShadows: false,
                  vertical: hideScrollbars ? 'hidden' : 'auto',
                  horizontal: hideScrollbars || wordWrap !== 'off' ? 'hidden' : 'auto',
                  verticalScrollbarSize: hideScrollbars ? 0 : 6,
                  horizontalScrollbarSize: hideScrollbars || wordWrap !== 'off' ? 0 : 6,
                },
                readOnly,
                ...editorOptions,
              }}
            />
          </div>

          {/* AST Panel - shown inline when enabled */}
          {showAstPanel && (
            <div className="w-1/2 pl-2 flex flex-col border-l border-theme">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-theme">
                <h4 className="text-theme-primary font-medium">AST Parsing Tree</h4>
                <button
                  type="button"
                  className="text-theme-secondary hover:text-theme-primary"
                  onClick={onToggleAstPanel}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div className="flex-grow overflow-hidden rounded-lg">
                <Editor
                  height="100%"
                  theme="vs-dark"
                  defaultLanguage="json"
                  value={astOutput ? JSON.stringify(astOutput, null, 2) : "No AST available"}
                  options={{
                    minimap: { enabled: false },
                    readOnly: true,
                    wordWrap: "on",
                    fontSize: 12,
                    lineNumbersMinChars: 3,
                    padding: { top: 10 }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom toolbar with actions and status */}
      <div className="bg-surface-hover px-4 py-3 border-t border-theme">
        <div className="flex items-center justify-between">
          {/* Left: Action buttons */}
            <div className="flex items-center gap-2">
            {!readOnly && showFormatButton && (
              <button
                type="button"
                onClick={handleFormat}
                className="px-3 py-1.5 text-theme-secondary rounded-md hover:bg-surface-hover hover:text-theme-primary transition-colors flex items-center gap-1.5 text-sm"
                title={formatMessage || 'Format Code & Substitute Parameters'}
              >
                {formatMessage ? <Check size={14} /> : <Brush size={14} />}
                <span>{formatMessage || 'Format'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 text-theme-secondary rounded-md hover:bg-surface-hover hover:text-theme-primary transition-colors flex items-center gap-1.5 text-sm"
              title={copyMessage || 'Copy to clipboard'}
            >
              {copyMessage ? <Check size={14} /> : <Copy size={14} />}
              <span>{copyMessage || 'Copy'}</span>
            </button>

            {!readOnly && (
              <button
                type="button"
                className={`px-3 py-1.5 ${showAstPanel ? 'text-primary' : 'text-theme-secondary'} rounded-md hover:bg-surface-hover hover:text-theme-primary transition-colors flex items-center gap-1.5 text-sm`}
                onClick={onToggleAstPanel}
                title="Toggle AST Parsing Panel"
              >
                <TreePine size={14} />
                <span>Parsing</span>
              </button>
            )}
          </div>

          {/* Right: Status indicators */}
          <div className="flex items-center gap-3">
            {errorHighlight.length > 0 && (
              <button
                type="button"
                onClick={toggleErrors}
                className="flex items-center gap-1.5 text-error hover:opacity-80 transition-colors px-2 py-1 bg-error/10 rounded-md text-xs"
              >
                <AlertTriangle size={12} />
                <span>{errorHighlight.length} Error{errorHighlight.length > 1 ? 's' : ''}</span>
                {showErrors ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            )}

            {paramSubstitutions.length > 0 && (
              <button
                type="button"
                onClick={toggleSubInfo}
                className="flex items-center gap-1.5 text-success hover:opacity-80 transition-colors px-2 py-1 bg-success/10 rounded-md text-xs"
              >
                <BadgeCheck size={12} />
                <span>{paramSubstitutions.length} substitution{paramSubstitutions.length > 1 ? 's' : ''}</span>
                {showSubInfo ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </button>
            )}

            <div className="text-xs text-theme-secondary">
              <a
                href="https://github.com/openEHR/openEHR-antlr4"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:opacity-80 transition-colors"
              >
                openEHR-ANTLR4
              </a>
            </div>
          </div>
        </div>

        {/* Expandable error section */}
        {showErrors && errorHighlight.length > 0 && (
          <div className="mt-3">
            {renderErrorInfo()}
          </div>
        )}

        {/* Expandable parameter substitution section */}
        {showSubInfo && paramSubstitutions.length > 0 && (
          <div className="mt-3">
            {renderSubstitutionInfo()}
          </div>
        )}
      </div>
    </div>
  );
});

// Helper function to sanitize AST for display
const sanitizeAST = (node, visited = new WeakSet()) => {
  if (!node || typeof node !== "object") return node;
  if (visited.has(node)) return undefined; // Prevent circular refs

  visited.add(node);

  let cleanNode = {};
  Object.keys(node).forEach(key => {
    if (
      key !== "parentCtx" &&
      key !== "invokingState" &&
      key !== "start" &&
      key !== "stop" &&
      key !== "ruleIndex"
    ) {
      cleanNode[key] = sanitizeAST(node[key], visited);
    }
  });

  return cleanNode;
};

AQLEditor.displayName = 'AQLEditor';

export default AQLEditor;
