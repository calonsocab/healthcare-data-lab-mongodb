import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/mappings/[mappingId]/samples/route.js
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { getCoreDb } from '@/lib/db/coreDb';
import { enforceNumericLimit, resolvePolicyContext } from '@/lib/security/teamPolicy';
import { validateFileBasics } from '@/lib/uploads/validation';
import { parseFormDataWithLimit } from '@/lib/uploads/bodyLimit';

const SAMPLE_DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10MB
const SAMPLE_EXTENSIONS = ['.xml', '.cda', '.csv', '.json', '.txt', '.hl7'];
const SAMPLE_MIME_TYPES = [
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

function toObjectId(id) {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

export async function GET(request, props) {
  const params = await props.params;
  try {
    const mappingId = toObjectId(params.mappingId);
    if (!mappingId) {
      return NextResponse.json({ error: 'Invalid mapping id' }, { status: 400 });
    }

    const { db } = await getActiveTenantDb(request);
    const samples = await db.collection('mapping_samples')
      .find({ mappingId })
      .sort({ createdAt: -1 })
      .project({ data: 0 })
      .toArray();

    return NextResponse.json(
      samples.map(s => ({ ...s, _id: s._id.toString(), mappingId: s.mappingId.toString() }))
    );
  } catch (error) {
    console.error('GET /api/mappings/[id]/samples error:', error);
    return NextResponse.json(
      { error: 'Failed to load samples', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const mappingId = toObjectId(params.mappingId);
    if (!mappingId) {
      return NextResponse.json({ error: 'Invalid mapping id' }, { status: 400 });
    }

    const coreDb = await getCoreDb();
    const policyContext = await resolvePolicyContext(coreDb, session.user.email);
    const policyMax = policyContext?.policy?.limits?.maxUploadFileBytes;
    const maxBytes = Number.isFinite(policyMax) && policyMax > 0
      ? Math.min(policyMax, SAMPLE_DEFAULT_MAX_BYTES)
      : SAMPLE_DEFAULT_MAX_BYTES;

    const formData = await parseFormDataWithLimit(request, maxBytes + (1 * 1024 * 1024));
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    enforceNumericLimit(
      maxBytes,
      file.size || 0,
      {
        code: 'TEAM_UPLOAD_FILE_TOO_LARGE',
        status: 413,
        message: 'Sample file exceeds upload size policy',
        details: { fileSize: file.size || 0, maxUploadFileBytes: maxBytes }
      }
    );
    const validationError = validateFileBasics(file, {
      allowedExtensions: SAMPLE_EXTENSIONS,
      allowedMimeTypes: SAMPLE_MIME_TYPES,
      maxBytes,
      allowMissingType: true,
      requireSafeName: true
    });
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const doc = {
      mappingId,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      data: buffer,
      createdAt: new Date(),
      createdBy: session.user.email || session.user.name || 'unknown'
    };

    const { db } = await getActiveTenantDb(request);
    const mapping = await db.collection('mapping_definitions').findOne({ _id: mappingId });
    if (!mapping) {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }

    const res = await db.collection('mapping_samples').insertOne(doc);
    return NextResponse.json(
      {
        _id: res.insertedId.toString(),
        mappingId: mappingId.toString(),
        filename: doc.filename,
        mimeType: doc.mimeType,
        size: doc.size,
        createdAt: doc.createdAt,
        createdBy: doc.createdBy
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/mappings/[id]/samples error:', error);
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    return NextResponse.json(
      { error: error?.message || 'Failed to upload sample', details: error?.details || null },
      { status }
    );
  }
}
