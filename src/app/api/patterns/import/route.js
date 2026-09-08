import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/patterns/import/route.js
import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import yaml from 'js-yaml';
import { validateFileBasics } from '@/lib/uploads/validation';
import { parseFormDataWithLimit, PayloadTooLargeError } from '@/lib/uploads/bodyLimit';
import { canonicalizeDocumentType, getDocumentTypeVariants } from '@/lib/mappings/documentType';

const COLLECTION = 'document_patterns';
const PATTERN_IMPORT_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const PATTERN_IMPORT_MAX_BODY_BYTES = PATTERN_IMPORT_MAX_BYTES + (1 * 1024 * 1024);
const PATTERN_IMPORT_EXTENSIONS = ['.json', '.yaml', '.yml'];
const PATTERN_IMPORT_MIME_TYPES = [
  'application/json',
  'text/json',
  'text/yaml',
  'application/x-yaml',
  'application/yaml',
  'text/plain'
];

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const formData = await parseFormDataWithLimit(request, PATTERN_IMPORT_MAX_BODY_BYTES);
    const file = formData.get('patterns_file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    const validationError = validateFileBasics(file, {
      allowedExtensions: PATTERN_IMPORT_EXTENSIONS,
      allowedMimeTypes: PATTERN_IMPORT_MIME_TYPES,
      maxBytes: PATTERN_IMPORT_MAX_BYTES,
      allowMissingType: true,
      requireSafeName: true
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const content = await file.text();
    let patterns;

    // Try to parse as YAML first, then JSON
    try {
      patterns = yaml.load(content);
    } catch {
      try {
        patterns = JSON.parse(content);
      } catch {
        return NextResponse.json(
          { error: 'Invalid file format. Must be valid YAML or JSON.' },
          { status: 400 }
        );
      }
    }

    if (!Array.isArray(patterns)) {
      return NextResponse.json(
        { error: 'File must contain an array of patterns' },
        { status: 400 }
      );
    }

    const { db } = await getActiveTenantDb(request);
    const col = db.collection(COLLECTION);

    const now = new Date();
    const results = { imported: 0, errors: [] };

    for (const pattern of patterns) {
      try {
        if (!pattern.name || typeof pattern.name !== 'string') {
          results.errors.push({ pattern: '(unnamed)', error: 'Pattern name is required' });
          continue;
        }

        const normalizedName = canonicalizeDocumentType(pattern.name.trim());
        const nameVariants = getDocumentTypeVariants(normalizedName);

        const patternDoc = {
          name: normalizedName,
          handler: pattern.handler || 'xml',
          priority: Number(pattern.priority) || 50,
          required_elements: Array.isArray(pattern.required_elements)
            ? pattern.required_elements.map(e => String(e).trim()).filter(Boolean)
            : [],
          xpath_patterns: Array.isArray(pattern.xpath_patterns)
            ? pattern.xpath_patterns.map(e => String(e).trim()).filter(Boolean)
            : [],
          namespaces: typeof pattern.namespaces === 'object' && pattern.namespaces !== null
            ? pattern.namespaces
            : {},
          csv_headers: Array.isArray(pattern.csv_headers)
            ? pattern.csv_headers.map(e => String(e).trim().toLowerCase()).filter(Boolean)
            : [],
          exclude_elements: Array.isArray(pattern.exclude_elements)
            ? pattern.exclude_elements.map(e => String(e).trim()).filter(Boolean)
            : [],
          updatedAt: now,
          updatedBy: session.user.email || session.user.name || 'unknown'
        };

        const canonicalExisting = await col.findOne(
          { name: normalizedName },
          { projection: { _id: 1 } }
        );

        await col.updateOne(
          canonicalExisting ? { _id: canonicalExisting._id } : { name: { $in: nameVariants } },
          {
            $set: patternDoc,
            $setOnInsert: {
              createdAt: now,
              createdBy: session.user.email || session.user.name || 'unknown'
            }
          },
          { upsert: true }
        );

        const aliasNames = nameVariants.filter((candidate) => candidate !== normalizedName);
        if (aliasNames.length > 0) {
          await col.deleteMany({ name: { $in: aliasNames } });
        }

        results.imported++;
      } catch (err) {
        results.errors.push({
          pattern: pattern.name || '(unnamed)',
          error: err.message
        });
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: 'Upload too large' }, { status: 413 });
    }
    console.error('POST /api/patterns/import error:', error);
    return NextResponse.json(
      { error: 'Failed to import patterns', details: error.message },
      { status: 500 }
    );
  }
}
