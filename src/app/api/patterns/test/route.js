// src/app/api/patterns/test/route.js
/**
 * Test a pattern against a document
 */
import { NextResponse } from 'next/server';
import { requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';
import { validateFileBasics } from '@/lib/uploads/validation';
import { parseFormDataWithLimit, PayloadTooLargeError } from '@/lib/uploads/bodyLimit';

// Simple XML element detection
function findXmlElements(content) {
  const elements = new Set();
  const tagRegex = /<([a-zA-Z_][a-zA-Z0-9_:-]*)[>\s/]/g;
  let match;
  while ((match = tagRegex.exec(content)) !== null) {
    elements.add(match[1]);
  }
  return elements;
}

// Simple CSV header detection
function detectCsvHeaders(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const potentialHeaders = firstLine.split(/[,;\t]/).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

  const looksLikeHeaders = potentialHeaders.every(h =>
    h.length > 0 && h.length < 50 && !/^\d+(\.\d+)?$/.test(h)
  );

  return looksLikeHeaders ? potentialHeaders : [];
}

function testPatternMatch(content, pattern) {
  const handler = pattern.handler || 'xml';
  const details = {
    handler,
    checks: []
  };

  let matches = false;

  if (handler === 'xml') {
    const elements = findXmlElements(content);
    details.foundElements = Array.from(elements).slice(0, 50);

    // Check required elements
    if (pattern.required_elements?.length > 0) {
      const requiredCheck = {
        type: 'required_elements',
        required: pattern.required_elements,
        found: [],
        missing: []
      };

      pattern.required_elements.forEach(req => {
        if (elements.has(req)) {
          requiredCheck.found.push(req);
        } else {
          requiredCheck.missing.push(req);
        }
      });

      requiredCheck.passed = requiredCheck.missing.length === 0;
      details.checks.push(requiredCheck);

      if (requiredCheck.passed) {
        matches = true;
      }
    }

    // Check exclude elements
    if (pattern.exclude_elements?.length > 0) {
      const excludeCheck = {
        type: 'exclude_elements',
        excluded: pattern.exclude_elements,
        found: []
      };

      pattern.exclude_elements.forEach(ex => {
        if (elements.has(ex)) {
          excludeCheck.found.push(ex);
        }
      });

      excludeCheck.passed = excludeCheck.found.length === 0;
      details.checks.push(excludeCheck);

      if (!excludeCheck.passed) {
        matches = false;
      }
    }

    // Check XPath patterns (simplified)
    if (pattern.xpath_patterns?.length > 0) {
      const xpathCheck = {
        type: 'xpath_patterns',
        patterns: pattern.xpath_patterns,
        matched: []
      };

      pattern.xpath_patterns.forEach(xpath => {
        const codeMatch = xpath.match(/code='([^']+)'/);
        const textMatch = xpath.match(/contains\(text\(\),'([^']+)'\)/);

        if (codeMatch && content.includes(codeMatch[1])) {
          xpathCheck.matched.push({ xpath, matchedValue: codeMatch[1] });
        }
        if (textMatch && content.includes(textMatch[1])) {
          xpathCheck.matched.push({ xpath, matchedValue: textMatch[1] });
        }
      });

      xpathCheck.passed = xpathCheck.matched.length > 0;
      details.checks.push(xpathCheck);

      if (xpathCheck.passed && !matches) {
        matches = true;
      }
    }
  }

  if (handler === 'csv') {
    const headers = detectCsvHeaders(content);
    details.foundHeaders = headers;

    if (pattern.csv_headers?.length > 0) {
      const headerCheck = {
        type: 'csv_headers',
        required: pattern.csv_headers,
        found: [],
        missing: []
      };

      pattern.csv_headers.forEach(req => {
        if (headers.includes(req.toLowerCase())) {
          headerCheck.found.push(req);
        } else {
          headerCheck.missing.push(req);
        }
      });

      headerCheck.passed = headerCheck.missing.length === 0;
      details.checks.push(headerCheck);
      matches = headerCheck.passed;
    }
  }

  if (handler === 'json') {
    if (pattern.required_elements?.length > 0) {
      const jsonCheck = {
        type: 'json_keys',
        required: pattern.required_elements,
        found: [],
        missing: []
      };

      pattern.required_elements.forEach(req => {
        if (content.includes(`"${req}"`)) {
          jsonCheck.found.push(req);
        } else {
          jsonCheck.missing.push(req);
        }
      });

      jsonCheck.passed = jsonCheck.missing.length === 0;
      details.checks.push(jsonCheck);
      matches = jsonCheck.passed;
    }
  }

  return { matches, details };
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const maxSizeMb = Number.parseInt(process.env.PATTERN_TEST_MAX_FILE_SIZE_MB || '5', 10);
    const maxBytes = (Number.isFinite(maxSizeMb) && maxSizeMb > 0 ? maxSizeMb : 5) * 1024 * 1024;
    const formData = await parseFormDataWithLimit(request, maxBytes + (1 * 1024 * 1024));
    const file = formData.get('document');
    const patternsJson = formData.get('patterns');

    if (!file) {
      return NextResponse.json({ error: 'No document provided' }, { status: 400 });
    }

    if (!patternsJson) {
      return NextResponse.json({ error: 'No pattern provided' }, { status: 400 });
    }
    const validationError = validateFileBasics(file, {
      allowedExtensions: ['.xml', '.cda', '.csv', '.json', '.txt', '.hl7'],
      allowedMimeTypes: [
        'application/xml',
        'text/xml',
        'application/json',
        'text/json',
        'text/plain',
        'text/csv',
        'application/csv',
        'application/hl7-v2',
        'application/octet-stream'
      ],
      maxBytes,
      allowMissingType: true,
      requireSafeName: true
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    let pattern;
    try {
      pattern = JSON.parse(patternsJson);
    } catch {
      return NextResponse.json({ error: 'Invalid pattern JSON' }, { status: 400 });
    }

    const content = await file.text();
    const result = testPatternMatch(content, pattern);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: 'Upload too large' }, { status: 413 });
    }
    console.error('POST /api/patterns/test error:', error);
    return safeErrorResponse(error, 'Failed to test pattern');
  }
}
