function splitByTopLevelTilde(expr) {
  const tokens = [];
  let current = '';
  let quote = null;
  let depth = 0;

  for (let i = 0; i < expr.length; i += 1) {
    const ch = expr[i];
    const prev = i > 0 ? expr[i - 1] : '';

    if (quote) {
      current += ch;
      if (ch === quote && prev !== '\\') quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === '(') {
      depth += 1;
      current += ch;
      continue;
    }

    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      current += ch;
      continue;
    }

    if (ch === '~' && depth === 0) {
      const token = current.trim();
      if (token) tokens.push(token);
      current = '';
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) tokens.push(tail);
  return tokens;
}

function toXPathLiteral(value) {
  const text = String(value ?? '');
  if (!text.includes("'")) return `'${text}'`;
  if (!text.includes('"')) return `"${text}"`;

  const parts = text.split("'");
  const out = [];
  for (let i = 0; i < parts.length; i += 1) {
    if (parts[i]) out.push(`'${parts[i]}'`);
    if (i < parts.length - 1) out.push('"\'"');
  }
  return `concat(${out.join(', ')})`;
}

function parseTemplateToken(token) {
  const text = token.trim();

  const strMatch = /^(["'])([\s\S]*)\1$/.exec(text);
  if (strMatch) {
    return { kind: 'string', value: strMatch[2] };
  }

  const xpathMatch = /^xpath\s*\(\s*([\s\S]+?)\s*\)$/.exec(text);
  if (xpathMatch) {
    const inner = xpathMatch[1].trim();
    const quoted = /^(["'])([\s\S]*)\1$/.exec(inner);
    if (quoted) {
      return { kind: 'xpath', value: quoted[2] };
    }
    return { kind: 'xpath_raw', value: inner };
  }

  return null;
}

function convertTemplateExpression(expr) {
  const tokens = splitByTopLevelTilde(expr);
  if (!tokens.length) return null;

  const parsed = tokens.map(parseTemplateToken);
  if (parsed.some((part) => !part)) return null;

  if (parsed.length === 1) {
    if (parsed[0].kind === 'xpath' || parsed[0].kind === 'xpath_raw') {
      return {
        key: 'xpath',
        value: parsed[0].value
      };
    }
    return null;
  }

  const parts = parsed.map((part) => {
    if (part.kind === 'string') return toXPathLiteral(part.value);
    if (part.kind === 'xpath' || part.kind === 'xpath_raw') return part.value;
    return null;
  });

  if (parts.some((part) => part == null)) return null;
  return {
    key: 'xpath',
    value: `concat(${parts.join(', ')})`
  };
}

function toYamlDoubleQuoted(value) {
  const text = String(value ?? '');
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function rewriteTemplateSyntax(yamlText) {
  const lines = String(yamlText || '').split(/\r?\n/);
  let convertedCount = 0;
  const unresolved = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const match = /^(\s*)template\s*:\s*(["'])\s*\{\{\s*([\s\S]*?)\s*\}\}\s*\2\s*(#.*)?$/.exec(line);
    if (!match) continue;

    const indent = match[1] || '';
    const expr = (match[3] || '').trim();
    const trailingComment = (match[4] || '').trim();
    const converted = convertTemplateExpression(expr);

    if (!converted) {
      unresolved.push({ line: i + 1, text: line.trim() });
      continue;
    }

    lines[i] = `${indent}${converted.key}: ${toYamlDoubleQuoted(converted.value)}${trailingComment ? ` ${trailingComment}` : ''}`;
    convertedCount += 1;
  }

  return {
    yaml: lines.join('\n'),
    convertedCount,
    unresolvedCount: unresolved.length,
    unresolved
  };
}
