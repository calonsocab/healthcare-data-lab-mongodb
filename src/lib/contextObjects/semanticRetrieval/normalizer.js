const TYPO_DICTIONARY = {
  diastollic: 'diastolic',
  systollic: 'systolic',
  temprature: 'temperature',
  temparature: 'temperature',
  oxigen: 'oxygen',
  saturtion: 'saturation',
  feverr: 'fever',
};

const PHRASE_REPLACEMENTS = [
  { pattern: /\bdrinking alcohol\b/g, replacement: 'alcohol use' },
  { pattern: /\balcohol drinking\b/g, replacement: 'alcohol use' },
  { pattern: /\bmm\s*hg\b/g, replacement: 'mm[Hg]' },
  { pattern: /\bmmhg\b/g, replacement: 'mm[Hg]' },
  { pattern: /°\s*c\b/g, replacement: ' Cel' },
  { pattern: /\bcelsius\b/g, replacement: 'Cel' },
  { pattern: /\bdegrees?\s*c\b/g, replacement: 'Cel' },
  { pattern: /\bdeg\s*c\b/g, replacement: 'Cel' },
  { pattern: /\bat\s+least\b/g, replacement: '>=' },
  { pattern: /\bno\s+less\s+than\b/g, replacement: '>=' },
  { pattern: /\bat\s+most\b/g, replacement: '<=' },
  { pattern: /\bno\s+more\s+than\b/g, replacement: '<=' },
  { pattern: /\bgreater\s+than\b/g, replacement: '>' },
  { pattern: /\bmore\s+than\b/g, replacement: '>' },
  { pattern: /\babove\b/g, replacement: '>' },
  { pattern: /\bover\b/g, replacement: '>' },
  { pattern: /\bless\s+than\b/g, replacement: '<' },
  { pattern: /\bbelow\b/g, replacement: '<' },
  { pattern: /\bunder\b/g, replacement: '<' },
  { pattern: /\bequal\s+to\b/g, replacement: '=' },
  { pattern: /\bwithin\s+the\s+last\b/g, replacement: 'last' },
  { pattern: /\bin\s+the\s+last\b/g, replacement: 'last' },
  { pattern: /\bpast\b/g, replacement: 'last' },
  { pattern: /\btimes?\s+(?:a|per)\s+day\b/g, replacement: ' /d' },
  { pattern: /\btimes?\s+(?:a|per)\s+week\b/g, replacement: ' /wk' },
  { pattern: /\btimes?\s+(?:a|per)\s+month\b/g, replacement: ' /mo' },
  { pattern: /\btimes?\s+(?:a|per)\s+hour\b/g, replacement: ' /h' },
  { pattern: /\bper\s+day\b/g, replacement: ' /d' },
  { pattern: /\bper\s+week\b/g, replacement: ' /wk' },
  { pattern: /\bper\s+month\b/g, replacement: ' /mo' },
  { pattern: /\bper\s+hour\b/g, replacement: ' /h' },
  { pattern: /\bdaily\b/g, replacement: ' /d' },
  { pattern: /\bweekly\b/g, replacement: ' /wk' },
  { pattern: /\bmonthly\b/g, replacement: ' /mo' },
  { pattern: /\bhourly\b/g, replacement: ' /h' },
  { pattern: /\bbp\b/g, replacement: 'blood pressure' },
  { pattern: /\bo2\b/g, replacement: 'oxygen' },
];

const UNIT_ALIASES = {
  cel: 'Cel',
  'mm[hg]': 'mm[Hg]',
  bpm: 'beats/min',
  '/d': '/d',
  '/wk': '/wk',
  '/mo': '/mo',
  '/h': '/h',
  'gm/d': 'gm/d',
  'gm/wk': 'gm/wk',
  '%': '%',
};

const STOP_TERMS = new Set([
  'patients',
  'patient',
  'a',
  'an',
  'as',
  'between',
  'from',
  'to',
  'show',
  'find',
  'list',
  'with',
  'that',
  'have',
  'has',
  'the',
  'and',
  'for',
  'in',
  'of',
  'on',
  'this',
  'current',
  'year',
  'month',
  'months',
  'day',
  'days',
  'week',
  'weeks',
  'hour',
  'hours',
  'today',
  'last',
  'during',
  'measured',
  'measurement',
]);

function stripDiacritics(value) {
  return `${value || ''}`
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeWhitespace(value) {
  return `${value || ''}`
    .replace(/\s+/g, ' ')
    .trim();
}

function fixCommonTypos(text) {
  return text.replace(/\b[a-z]+\b/g, (token) => TYPO_DICTIONARY[token] || token);
}

function normalizeStandaloneCUnits(text) {
  return text.replace(/(\d+(?:\.\d+)?)\s*c\b/g, '$1 Cel');
}

function normalizePunctuation(text) {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—−]/g, '-')
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizePhraseReplacements(text) {
  return PHRASE_REPLACEMENTS.reduce(
    (acc, rule) => acc.replace(rule.pattern, rule.replacement),
    text
  );
}

function extractNumbersAndUnits(text) {
  const matches = [];
  const regex = /(-?\d+(?:\.\d+)?)\s*(mm\[Hg\]|Cel|beats\/min|\/d|\/wk|\/mo|\/h|gm\/d|gm\/wk|kg|g|mg|ml|%)?/gi;
  let match = regex.exec(text);

  while (match) {
    const rawUnit = match[2] ? `${match[2]}`.trim() : '';
    const normalizedUnit = rawUnit ? (UNIT_ALIASES[rawUnit.toLowerCase()] || rawUnit) : '';
    matches.push({
      raw: match[0],
      value: Number(match[1]),
      unit: normalizedUnit,
      index: match.index,
      endIndex: match.index + match[0].length
    });
    match = regex.exec(text);
  }

  return matches.filter((item) => Number.isFinite(item.value));
}

function toDurationIso(value, unit) {
  const count = Number(value);
  if (!Number.isFinite(count) || count <= 0) return '';
  switch (unit) {
    case 'hour':
    case 'hours':
      return `PT${Math.trunc(count)}H`;
    case 'day':
    case 'days':
      return `P${Math.trunc(count)}D`;
    case 'week':
    case 'weeks':
      return `P${Math.trunc(count * 7)}D`;
    default:
      return '';
  }
}

function extractTimeWindows(text) {
  const windows = [];
  const regex = /\blast\s+(\d+)\s+(hour|hours|day|days|week|weeks)\b/gi;
  let match = regex.exec(text);

  while (match) {
    const durationIso = toDurationIso(match[1], match[2]);
    windows.push({
      raw: match[0],
      durationIso,
      value: Number(match[1]),
      unit: match[2],
      index: match.index,
      endIndex: match.index + match[0].length
    });
    match = regex.exec(text);
  }

  return windows;
}

function extractNumericRanges(text) {
  const ranges = [];
  const regex = /\bbetween\s+(-?\d+(?:\.\d+)?)\s*(mm\[Hg\]|Cel|beats\/min|\/d|\/wk|\/mo|\/h|gm\/d|gm\/wk|kg|g|mg|ml|%)?\s+and\s+(-?\d+(?:\.\d+)?)\s*(mm\[Hg\]|Cel|beats\/min|\/d|\/wk|\/mo|\/h|gm\/d|gm\/wk|kg|g|mg|ml|%)?/gi;
  let match = regex.exec(text);

  while (match) {
    const firstUnit = match[2] ? (UNIT_ALIASES[`${match[2]}`.trim().toLowerCase()] || `${match[2]}`.trim()) : '';
    const secondUnit = match[4] ? (UNIT_ALIASES[`${match[4]}`.trim().toLowerCase()] || `${match[4]}`.trim()) : '';
    ranges.push({
      raw: match[0],
      minValue: Number(match[1]),
      maxValue: Number(match[3]),
      unit: secondUnit || firstUnit || '',
      index: match.index,
      endIndex: match.index + match[0].length
    });
    match = regex.exec(text);
  }

  return ranges.filter((item) => Number.isFinite(item.minValue) && Number.isFinite(item.maxValue));
}

function toIsoString(date) {
  return Number.isFinite(date?.getTime?.()) ? date.toISOString() : '';
}

function extractCalendarPeriods(text, now = new Date()) {
  const periods = [];
  const current = new Date(now);

  if (/\bthis year\b|\bcurrent year\b/.test(text)) {
    const from = new Date(Date.UTC(current.getUTCFullYear(), 0, 1, 0, 0, 0, 0));
    periods.push({
      raw: 'this year',
      kind: 'calendar_year',
      from: toIsoString(from),
      to: toIsoString(current)
    });
  }

  if (/\bthis month\b|\bcurrent month\b/.test(text)) {
    const from = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1, 0, 0, 0, 0));
    periods.push({
      raw: 'this month',
      kind: 'calendar_month',
      from: toIsoString(from),
      to: toIsoString(current)
    });
  }

  if (/\btoday\b/.test(text)) {
    const from = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate(), 0, 0, 0, 0));
    periods.push({
      raw: 'today',
      kind: 'calendar_day',
      from: toIsoString(from),
      to: toIsoString(current)
    });
  }

  return periods;
}

function extractOperators(text) {
  const operators = [];
  const regex = /(>=|<=|>|<|=)/g;
  let match = regex.exec(text);

  while (match) {
    operators.push({
      symbol: match[1],
      index: match.index
    });
    match = regex.exec(text);
  }

  return operators;
}

function buildSearchTerms(normalizedText) {
  return Array.from(
    new Set(
      normalizedText
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token && !STOP_TERMS.has(token) && !/^(>=|<=|>|<|=)$/.test(token) && !/^\d/.test(token))
    )
  );
}

export function normalizeSemanticRetrievalQuery(rawText = '', options = {}) {
  const raw = `${rawText || ''}`;
  const stripped = stripDiacritics(raw).toLowerCase();
  const punctuationNormalized = normalizePunctuation(stripped);
  const typoFixed = fixCommonTypos(punctuationNormalized);
  const phraseNormalized = normalizePhraseReplacements(typoFixed);
  const unitNormalized = normalizeStandaloneCUnits(phraseNormalized);
  const normalizedText = normalizeWhitespace(unitNormalized);
  const numbers = extractNumbersAndUnits(normalizedText);
  const timeWindows = extractTimeWindows(normalizedText);
  const calendarPeriods = extractCalendarPeriods(normalizedText, options?.now || new Date());
  const ranges = extractNumericRanges(normalizedText);
  const operators = extractOperators(normalizedText);
  const searchTerms = buildSearchTerms(normalizedText);

  return {
    rawText: raw,
    normalizedText,
    searchTerms,
    numbers,
    units: Array.from(new Set(numbers.map((item) => item.unit).filter(Boolean))),
    operators: operators.map((item) => item.symbol),
    operatorMatches: operators,
    timeWindows,
    calendarPeriods,
    ranges
  };
}
