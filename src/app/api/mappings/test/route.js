import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/mappings/test/route.js
/**
 * Test a mapping configuration against a document
 * Returns a preview of the transformed composition
 */
import { NextResponse } from 'next/server';
import yaml from 'js-yaml';
import { validateFileBasics } from '@/lib/uploads/validation';
import { parseFormDataWithLimit, PayloadTooLargeError } from '@/lib/uploads/bodyLimit';
import { buildTemplateSyntaxDisabledError, findDisallowedTemplateMarker } from '@/lib/mappings/security';

const TEST_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const TEST_MAX_BODY_BYTES = TEST_MAX_BYTES + (2 * 1024 * 1024);
const TEST_EXTENSIONS = ['.xml', '.cda', '.csv', '.json', '.txt', '.hl7'];
const TEST_MIME_TYPES = [
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

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const formData = await parseFormDataWithLimit(request, TEST_MAX_BODY_BYTES);
    const file = formData.get('document');
    const mappingYaml = formData.get('mapping');
    const templateId = formData.get('templateId');

    if (!file) {
      return NextResponse.json({ error: 'No document provided' }, { status: 400 });
    }
    const validationError = validateFileBasics(file, {
      allowedExtensions: TEST_EXTENSIONS,
      allowedMimeTypes: TEST_MIME_TYPES,
      maxBytes: TEST_MAX_BYTES,
      allowMissingType: true,
      requireSafeName: true
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (!mappingYaml) {
      return NextResponse.json({ error: 'No mapping provided' }, { status: 400 });
    }
    const jinjaMarker = findDisallowedTemplateMarker(mappingYaml);
    if (jinjaMarker) {
      return NextResponse.json(
        buildTemplateSyntaxDisabledError('Mapping YAML', jinjaMarker),
        { status: 400 }
      );
    }

    let mapping;
    try {
      mapping = yaml.load(mappingYaml, { json: true });
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Invalid mapping YAML', detail: parseError.message },
        { status: 400 }
      );
    }

    const content = await file.text();
    const startTime = Date.now();

    // For now, return a mock transformation result
    // In a full implementation, this would apply the mapping rules to transform the document
    const result = {
      composition: {
        _type: 'COMPOSITION',
        archetype_node_id: templateId || 'openEHR-EHR-COMPOSITION.encounter.v1',
        name: {
          _type: 'DV_TEXT',
          value: 'Test Composition'
        },
        language: {
          _type: 'CODE_PHRASE',
          terminology_id: { value: 'ISO_639-1' },
          code_string: 'en'
        },
        territory: {
          _type: 'CODE_PHRASE',
          terminology_id: { value: 'ISO_3166-1' },
          code_string: 'US'
        },
        category: {
          _type: 'DV_CODED_TEXT',
          value: 'event',
          defining_code: {
            terminology_id: { value: 'openehr' },
            code_string: '433'
          }
        },
        content: [],
        _mapping_test: true,
        _source_preview: content.substring(0, 500),
        _mapping_rules_count: mapping?.compose?.content?.[0]?.map?.length || 0
      },
      errors: [],
      warnings: [
        'This is a test preview. Full transformation requires the Kehrnel backend.'
      ],
      executionTime: Date.now() - startTime,
      mappingApplied: {
        name: mapping?.name || 'test-mapping',
        rulesCount: mapping?.compose?.content?.[0]?.map?.length || 0,
        templateId
      }
    };

    // Add some validation warnings based on mapping structure
    if (!mapping?.compose?.content?.[0]?.map?.length) {
      result.warnings.push('No field mappings defined');
    }

    if (!templateId) {
      result.warnings.push('No target template specified');
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: 'Upload too large' }, { status: 413 });
    }
    console.error('POST /api/mappings/test error:', error);
    return NextResponse.json(
      { error: 'Failed to test mapping', detail: error.message },
      { status: 500 }
    );
  }
}
