// src/app/api/identify-document/route.js
/**
 * Document identification endpoint
 * Uses locally stored patterns to identify document types
 */
import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';
import { validateFileBasics } from '@/lib/uploads/validation';
import { parseFormDataWithLimit, PayloadTooLargeError } from '@/lib/uploads/bodyLimit';
import { canonicalizeDocumentType } from '@/lib/mappings/documentType';

const PATTERNS_COLLECTION = 'document_patterns';
const MAX_IDENTIFY_DOC_BYTES = (() => {
  const mb = Number.parseInt(process.env.IDENTIFY_DOC_MAX_SIZE_MB || '5', 10);
  const safeMb = Number.isFinite(mb) && mb > 0 ? mb : 5;
  return safeMb * 1024 * 1024;
})();
const MAX_IDENTIFY_BODY_BYTES = MAX_IDENTIFY_DOC_BYTES + (1 * 1024 * 1024);
const IDENTIFY_EXTENSIONS = ['.xml', '.cda', '.csv', '.json', '.txt', '.hl7'];
const IDENTIFY_MIME_TYPES = [
  'application/xml',
  'text/xml',
  'application/json',
  'text/json',
  'text/plain',
  'text/csv',
  'application/csv',
  'application/hl7-v2',
  'application/octet-stream'
];

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
  // Check if first line looks like headers (no numeric values, reasonable length)
  const potentialHeaders = firstLine.split(/[,;\t]/).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

  // Basic heuristic: if all values are short strings without numbers, likely headers
  const looksLikeHeaders = potentialHeaders.every(h =>
    h.length > 0 && h.length < 50 && !/^\d+(\.\d+)?$/.test(h)
  );

  return looksLikeHeaders ? potentialHeaders : [];
}

// Detect file type from content
function detectFileType(content, fileName) {
  const trimmed = content.trim();

  // Check file extension first
  const ext = fileName?.split('.').pop()?.toLowerCase();

  if (ext === 'xml' || trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
    return 'xml';
  }

  if (ext === 'json' || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }

  if (ext === 'csv' || ext === 'tsv') {
    return 'csv';
  }

  // Check for HL7v2 (starts with MSH|)
  if (trimmed.startsWith('MSH|')) {
    return 'hl7v2';
  }

  // Default to csv for text files with delimiters
  if (trimmed.includes(',') || trimmed.includes('\t') || trimmed.includes(';')) {
    return 'csv';
  }

  return 'unknown';
}

// Match document against patterns
function matchPattern(content, fileType, patterns) {
  const relevantPatterns = patterns
    .filter(p => p.handler === fileType)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  for (const pattern of relevantPatterns) {
    let matches = false;

    if (fileType === 'xml') {
      const elements = findXmlElements(content);

      // Check required elements
      if (pattern.required_elements?.length > 0) {
        const hasAllRequired = pattern.required_elements.every(req =>
          elements.has(req)
        );
        if (hasAllRequired) {
          matches = true;
        }
      }

      // Check exclude elements
      if (matches && pattern.exclude_elements?.length > 0) {
        const hasExcluded = pattern.exclude_elements.some(ex =>
          elements.has(ex)
        );
        if (hasExcluded) {
          matches = false;
        }
      }

      // Check XPath patterns (simplified - just check if content contains the text)
      if (!matches && pattern.xpath_patterns?.length > 0) {
        // Very simplified xpath matching - just look for key strings
        const hasXpathMatch = pattern.xpath_patterns.some(xpath => {
          // Extract key identifiers from xpath
          const codeMatch = xpath.match(/code='([^']+)'/);
          const textMatch = xpath.match(/contains\(text\(\),'([^']+)'\)/);

          if (codeMatch && content.includes(codeMatch[1])) return true;
          if (textMatch && content.includes(textMatch[1])) return true;

          return false;
        });

        if (hasXpathMatch) {
          matches = true;
        }
      }
    }

    if (fileType === 'csv') {
      const headers = detectCsvHeaders(content);

      if (pattern.csv_headers?.length > 0 && headers.length > 0) {
        const hasRequiredHeaders = pattern.csv_headers.every(req =>
          headers.includes(req.toLowerCase())
        );
        if (hasRequiredHeaders) {
          matches = true;
        }
      }
    }

    if (fileType === 'json') {
      // For JSON, check if required_elements exist as keys
      if (pattern.required_elements?.length > 0) {
        const hasAllRequired = pattern.required_elements.every(req =>
          content.includes(`"${req}"`)
        );
        if (hasAllRequired) {
          matches = true;
        }
      }
    }

    if (matches) {
      return {
        pattern: pattern.name,
        handler: pattern.handler,
        confidence: 'high',
        priority: pattern.priority
      };
    }
  }

  return null;
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const debug = searchParams.get('debug') === 'true';

    const formData = await parseFormDataWithLimit(request, MAX_IDENTIFY_BODY_BYTES);
    const file = formData.get('document');

    if (!file) {
      return NextResponse.json({ error: 'No document provided' }, { status: 400 });
    }
    const validationError = validateFileBasics(file, {
      allowedExtensions: IDENTIFY_EXTENSIONS,
      allowedMimeTypes: IDENTIFY_MIME_TYPES,
      maxBytes: MAX_IDENTIFY_DOC_BYTES,
      allowMissingType: true,
      requireSafeName: true
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const content = await file.text();
    const fileName = file.name;

    // Detect file type
    const fileType = detectFileType(content, fileName);

    // Fetch patterns from database
    let patterns = [];
    try {
      const { db } = await getActiveTenantDb(request);
      const col = db.collection(PATTERNS_COLLECTION);
      patterns = await col.find({}).sort({ priority: -1 }).toArray();
    } catch (dbError) {
      console.warn('Could not fetch patterns from DB:', dbError.message);
    }

    // Match against patterns
    const match = matchPattern(content, fileType, patterns);

    // Build response
    const rawDocumentType = match?.pattern || `unknown_${fileType}`;
    const normalizedDocumentType = canonicalizeDocumentType(rawDocumentType);

    const result = {
      documentType: normalizedDocumentType,
      handler: match?.handler || fileType,
      confidence: match?.confidence || 'low',
      sampleData: content.substring(0, 1000),
      structure: {
        fileType,
        fileName,
        size: file.size,
        hasPatternMatch: !!match
      }
    };

    // Add debug info if requested
    if (debug) {
      result.debugInfo = {
        patternsChecked: patterns.map(p => canonicalizeDocumentType(p.name)),
        matchedPattern: match ? normalizedDocumentType : null,
        matchedPatternRaw: match?.pattern || null,
        detectedFileType: fileType,
        patternCount: patterns.length
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: 'Upload too large' }, { status: 413 });
    }
    console.error('POST /api/identify-document error:', error);
    return safeErrorResponse(error, 'Failed to identify document');
  }
}
