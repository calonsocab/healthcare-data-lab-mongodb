const DISALLOWED_TEMPLATE_MARKER_RE = /(\{\{|\{%|\{#)/m;

function positionFromIndex(text, index) {
  const safeIndex = Math.max(0, Math.min(index, text.length));
  const before = text.slice(0, safeIndex);
  const lines = before.split('\n');
  const line = lines.length;
  const column = (lines[lines.length - 1] || '').length + 1;
  return { line, column };
}

export function findDisallowedTemplateMarker(value) {
  const text = String(value || '');
  const match = text.match(DISALLOWED_TEMPLATE_MARKER_RE);
  if (!match || typeof match.index !== 'number') return null;
  const marker = match[0] || null;
  const { line, column } = positionFromIndex(text, match.index);
  return {
    marker,
    index: match.index,
    line,
    column
  };
}

export function buildTemplateSyntaxDisabledError(field = 'mapping YAML', markerDetails = null) {
  return {
    error: `${field} contains disabled template syntax`,
    code: 'JINJA_TEMPLATE_SYNTAX_DISABLED',
    details: markerDetails
      ? {
          marker: markerDetails.marker,
          line: markerDetails.line,
          column: markerDetails.column
        }
      : null
  };
}

