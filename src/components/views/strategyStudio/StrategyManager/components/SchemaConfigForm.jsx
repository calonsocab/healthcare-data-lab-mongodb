"use client";

import React, { useMemo, useState } from "react";
import { RefreshCw, Save, ChevronDown, ChevronRight, Settings } from "lucide-react";

/**
 * T3: JSON Schema-driven form renderer for manifest configs.
 *
 * Parses manifest.config_schema and generates form fields dynamically.
 * Supports:
 * - string (text input)
 * - boolean (toggle/checkbox)
 * - number/integer (number input)
 * - enum (dropdown)
 * - object (nested collapsible group)
 *
 * Shows "Changed" indicator when field differs from default.
 * Only stores overrides in strategyLinks[].configOverrides.
 */
export default function SchemaConfigForm({
  schema,
  defaultConfig = {},
  overrides = {},
  canEdit = false,
  canSave = false,
  onChange,
  onSave,
  saving = false,
  configChanged = false,
}) {
  const merged = useMemo(() => deepMerge(defaultConfig, overrides || {}), [defaultConfig, overrides]);
  const properties = schema?.properties || {};
  const [expandedSections, setExpandedSections] = useState({});

  // If no schema, show placeholder
  if (!schema || Object.keys(properties).length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <Settings className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No configuration schema available</p>
        <p className="text-xs mt-1 text-slate-500">This strategy uses defaults or has no configurable options</p>
      </div>
    );
  }

  const handleFieldChange = (path, value) => {
    if (!onChange) return;
    onChange(path, value);
  };

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Check if a field is overridden (different from default)
  const isOverridden = (path) => {
    return getNestedValue(overrides, path) !== undefined;
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {Object.entries(properties).map(([key, prop]) => {
          const path = key;
          const value = merged?.[key];
          const defaultValue = defaultConfig?.[key];
          const type = Array.isArray(prop.type) ? prop.type[0] : prop.type;
          const hasOverride = isOverridden(path);

          // Handle nested objects (recursive for deep nesting)
          if (type === "object" && prop.properties) {
            const isExpanded = expandedSections[key] !== false; // Default open
            return (
              <NestedObjectSection
                key={key}
                path={path}
                prop={prop}
                value={value}
                defaultValue={defaultValue}
                isExpanded={isExpanded}
                hasOverride={hasOverride}
                canEdit={canEdit}
                onToggle={() => toggleSection(key)}
                onFieldChange={handleFieldChange}
                isOverridden={isOverridden}
                expandedSections={expandedSections}
                toggleSection={toggleSection}
                depth={0}
              />
            );
          }

          return (
            <FieldRow
              key={key}
              label={prop.title || formatLabel(key)}
              description={prop.description}
              type={type}
              value={value}
              defaultValue={defaultValue}
              options={prop.enum}
              disabled={!canEdit}
              hasOverride={hasOverride}
              onChange={(v) => handleFieldChange(path, v)}
            />
          );
        })}
      </div>

      {canEdit && (
        <div className="flex items-center gap-3 pt-4 border-t border-slate-700">
          {canSave ? (
            <>
              <button
                onClick={onSave}
                disabled={saving || !configChanged}
                className="px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-primary-text flex items-center gap-2 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Saving..." : "Save Configuration"}
              </button>
              {!configChanged && <span className="text-xs text-slate-500">No changes</span>}
              {configChanged && (
                <span className="text-xs text-amber-400">You have unsaved changes</span>
              )}
            </>
          ) : (
            <span className="text-xs text-cyan-300/80">
              {configChanged
                ? 'These changes are staged and will be applied when you activate the strategy.'
                : 'Review and adjust the settings before activation.'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * NestedObjectSection - Recursive component for deeply nested object schemas
 * Supports 3+ levels of nesting (e.g., collections.compositions.encodingProfile)
 */
function NestedObjectSection({
  path,
  prop,
  value,
  defaultValue,
  isExpanded,
  hasOverride,
  canEdit,
  onToggle,
  onFieldChange,
  isOverridden,
  expandedSections,
  toggleSection,
  depth = 0
}) {
  const bgColors = ['bg-slate-800/50', 'bg-slate-800/30', 'bg-slate-900/40', 'bg-slate-900/60'];
  const bgColor = bgColors[Math.min(depth, bgColors.length - 1)];
  const contentBg = depth === 0 ? 'bg-slate-900/30' : 'bg-slate-900/50';

  return (
    <div className={`border border-slate-700 rounded-lg overflow-hidden ${depth > 0 ? 'ml-0' : ''}`}>
      <button
        onClick={onToggle}
        className={`w-full px-4 py-3 flex items-center justify-between ${bgColor} hover:bg-slate-800 transition-colors text-left`}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <span className={`font-medium ${depth === 0 ? 'text-slate-200' : 'text-slate-300'}`}>
            {prop.title || formatLabel(path.split('.').pop())}
          </span>
          {hasOverride && (
            <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 rounded">
              Modified
            </span>
          )}
        </div>
        {prop.description && (
          <span className="text-xs text-slate-500 truncate max-w-xs">{prop.description}</span>
        )}
      </button>
      {isExpanded && (
        <div className={`p-4 ${contentBg} space-y-3`}>
          {Object.entries(prop.properties || {}).map(([nestedKey, nestedProp]) => {
            const nestedPath = `${path}.${nestedKey}`;
            const nestedType = Array.isArray(nestedProp.type) ? nestedProp.type[0] : nestedProp.type;
            const nestedValue = value?.[nestedKey];
            const nestedDefaultValue = defaultValue?.[nestedKey];
            const nestedHasOverride = isOverridden(nestedPath);
            const nestedIsExpanded = expandedSections[nestedPath] !== false;

            // Recursive handling for deeper nested objects
            if (nestedType === "object" && nestedProp.properties) {
              return (
                <NestedObjectSection
                  key={nestedKey}
                  path={nestedPath}
                  prop={nestedProp}
                  value={nestedValue}
                  defaultValue={nestedDefaultValue}
                  isExpanded={nestedIsExpanded}
                  hasOverride={nestedHasOverride}
                  canEdit={canEdit}
                  onToggle={() => toggleSection(nestedPath)}
                  onFieldChange={onFieldChange}
                  isOverridden={isOverridden}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                  depth={depth + 1}
                />
              );
            }

            return (
              <FieldRow
                key={nestedKey}
                label={nestedProp.title || formatLabel(nestedKey)}
                description={nestedProp.description}
                type={nestedType}
                value={nestedValue}
                defaultValue={nestedDefaultValue}
                options={nestedProp.enum}
                disabled={!canEdit}
                hasOverride={nestedHasOverride}
                onChange={(v) => onFieldChange(nestedPath, v)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, description, type, value, defaultValue, options, disabled, hasOverride, onChange }) {
  const common = "w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed";
  const hasUnsupportedEnumValue = Array.isArray(options)
    && value !== undefined
    && value !== null
    && !options.includes(value);

  // T3: Label with override indicator
  const LabelWithIndicator = ({ children, inline = false }) => (
    <div className={`flex items-center gap-2 ${inline ? '' : 'mb-1'}`}>
      <span className="text-sm text-slate-200">{children}</span>
      {hasOverride && (
        <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-300 rounded">
          Changed
        </span>
      )}
    </div>
  );

  // T3: Show default value hint
  const DefaultHint = () => (
    defaultValue !== undefined && !hasOverride ? (
      <span className="text-xs text-slate-600 ml-2">Default</span>
    ) : null
  );

  if (type === "boolean") {
    return (
      <div className="flex items-center justify-between bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
        <div>
          <LabelWithIndicator inline>{label}</LabelWithIndicator>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
        <button
          type="button"
          onClick={!disabled ? () => onChange(!value) : undefined}
          disabled={disabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          } ${value ? "bg-emerald-600" : "bg-slate-600"}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              value ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    );
  }

  if (Array.isArray(options)) {
    const resolvedValue = options.includes(value)
      ? value
      : (options.includes(defaultValue) ? defaultValue : options[0]);

    return (
      <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
        <LabelWithIndicator>{label}</LabelWithIndicator>
        <select
          className={common}
          disabled={disabled}
          value={resolvedValue}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
        {hasUnsupportedEnumValue && (
          <p className="text-xs text-amber-400 mt-1">
            Saved value "{String(value)}" is no longer supported by this strategy version. Resave to keep a supported option.
          </p>
        )}
      </div>
    );
  }

  if (type === "number" || type === "integer") {
    return (
      <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
        <LabelWithIndicator>{label}</LabelWithIndicator>
        <input
          type="number"
          className={common}
          disabled={disabled}
          value={value ?? ""}
          placeholder={defaultValue !== undefined ? `Default: ${defaultValue}` : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        />
        {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
      </div>
    );
  }

  // Default: string input
  return (
    <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/50">
      <LabelWithIndicator>{label}</LabelWithIndicator>
      <input
        type="text"
        className={common}
        disabled={disabled}
        value={value ?? ""}
        placeholder={defaultValue !== undefined ? `Default: ${defaultValue}` : ""}
        onChange={(e) => onChange(e.target.value)}
      />
      {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
    </div>
  );
}

function deepMerge(target, source) {
  const result = { ...(target || {}) };
  for (const key of Object.keys(source || {})) {
    if (source[key] !== null && typeof source[key] === "object" && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// T3: Format field key to human-readable label
function formatLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^\w/, c => c.toUpperCase())
    .trim();
}

// T3: Get nested value from object by dot-separated path
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => {
    if (acc && typeof acc === 'object' && key in acc) {
      return acc[key];
    }
    return undefined;
  }, obj);
}
