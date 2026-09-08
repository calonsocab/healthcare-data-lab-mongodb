const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isExtendedJsonDate(value) {
  return isPlainObject(value) && typeof value.$date === 'string' && ISO_DATE_RE.test(value.$date);
}

export function isMongoDateLike(value) {
  return (typeof value === 'string' && ISO_DATE_RE.test(value)) || isExtendedJsonDate(value);
}

function stringifyScalar(value) {
  if (isExtendedJsonDate(value)) {
    return `ISODate(${JSON.stringify(value.$date)})`;
  }
  if (typeof value === 'string') {
    if (ISO_DATE_RE.test(value)) {
      return `ISODate(${JSON.stringify(value)})`;
    }
    return JSON.stringify(value);
  }
  if (value === undefined) {
    return 'undefined';
  }
  return JSON.stringify(value);
}

export function stringifyMongoShell(value, indent = 2, level = 0) {
  const pad = ' '.repeat(level * indent);
  const childPad = ' '.repeat((level + 1) * indent);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const items = value.map(item => `${childPad}${stringifyMongoShell(item, indent, level + 1)}`);
    return `[\n${items.join(',\n')}\n${pad}]`;
  }

  if (isPlainObject(value) && !isExtendedJsonDate(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    const lines = entries.map(([key, item]) => (
      `${childPad}${JSON.stringify(key)}: ${stringifyMongoShell(item, indent, level + 1)}`
    ));
    return `{\n${lines.join(',\n')}\n${pad}}`;
  }

  return stringifyScalar(value);
}

