// src/app/api/mappings/[mappingId]/preview/route.js
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import yaml from 'js-yaml';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';
import { buildTemplateSyntaxDisabledError, findDisallowedTemplateMarker } from '@/lib/mappings/security';

function asObjectId(value) {
  if (!ObjectId.isValid(value)) return null;
  return new ObjectId(value);
}

function bufferToString(data) {
  if (!data) return '';
  if (Buffer.isBuffer(data)) return data.toString('utf8');
  if (data.buffer) return Buffer.from(data.buffer).toString('utf8');
  if (Array.isArray(data)) return Buffer.from(data).toString('utf8');
  return String(data);
}

export async function POST(request, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const mappingId = asObjectId(params.mappingId);
    if (!mappingId) {
      return NextResponse.json({ error: 'Invalid mapping id' }, { status: 400 });
    }

    const body = await request.json();
    const sampleId = asObjectId(body.sampleId);
    if (!sampleId) {
      return NextResponse.json({ error: 'Sample id is required' }, { status: 400 });
    }

    const { db } = await getActiveTenantDb(request);
    const mapping = await db.collection('mapping_definitions').findOne({ _id: mappingId });
    if (!mapping) {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }
    const jinjaMarker = findDisallowedTemplateMarker(mapping?.yaml || '');
    if (jinjaMarker) {
      return NextResponse.json(
        buildTemplateSyntaxDisabledError('Mapping YAML', jinjaMarker),
        { status: 400 }
      );
    }

    const sample = await db.collection('mapping_samples').findOne({
      _id: sampleId,
      mappingId
    });

    if (!sample) {
      return NextResponse.json({ error: 'Sample not found' }, { status: 404 });
    }

    let parsedYaml = null;
    let yamlError = null;
    try {
      parsedYaml = yaml.load(mapping.yaml, { json: true }) || {};
    } catch (err) {
      yamlError = err.message;
    }

    const snippet = bufferToString(sample.data).slice(0, 800);
    const outline = parsedYaml
      ? {
          inputKind: parsedYaml?.input?.kind || null,
          columnCount: Array.isArray(parsedYaml?.input?.columns) ? parsedYaml.input.columns.length : 0,
          groupBy: Array.isArray(parsedYaml?.group_by) ? parsedYaml.group_by : [],
          composeBlocks: Array.isArray(parsedYaml?.compose?.content)
            ? parsedYaml.compose.content.length
            : Array.isArray(parsedYaml?.compose)
              ? parsedYaml.compose.length
              : 0
        }
      : null;

    return NextResponse.json({
      yamlError,
      outline,
      sample: {
        id: sample._id.toString(),
        filename: sample.filename,
        size: sample.size,
        mimeType: sample.mimeType,
        preview: snippet,
        createdAt: sample.createdAt
      }
    });
  } catch (error) {
    console.error('POST /api/mappings/[id]/preview error:', error);
    return safeErrorResponse(error, 'Failed to generate preview');
  }
}
