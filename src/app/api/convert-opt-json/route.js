import { requireAuthenticatedUser } from '@/lib/security/api';
// app/api/convert-opt-json/route.js
import { NextResponse } from 'next/server';
import { writeFile, mkdir, unlink, readFile } from 'fs/promises';
import path from 'path';
import { convertOPTtoWebTemplate } from '@/lib/templates/opt';
import { validateFileBasics } from '@/lib/uploads/validation';
import { parseFormDataWithLimit, parseJsonWithLimit, PayloadTooLargeError } from '@/lib/uploads/bodyLimit';

function sanitizeUploadFileName(fileName = 'upload.opt') {
  const baseName = path.basename(`${fileName}`);
  const normalized = baseName.replace(/[^A-Za-z0-9._-]/g, '_');
  return normalized || 'upload.opt';
}

const MAX_OPT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_OPT_BODY_BYTES = MAX_OPT_SIZE_BYTES + (2 * 1024 * 1024);

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const formData = await parseFormDataWithLimit(request, MAX_OPT_BODY_BYTES);
    const file = formData.get('optFile');
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }
    const validationError = validateFileBasics(file, {
      allowedExtensions: ['.opt', '.xml'],
      allowedMimeTypes: ['application/xml', 'text/xml', 'application/x-xml', 'application/octet-stream'],
      maxBytes: MAX_OPT_SIZE_BYTES,
      allowMissingType: true,
      requireSafeName: true
    });
    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400 }
      );
    }

    // Create temporary directory for uploads if it doesn't exist
    const uploadDir = path.join(process.cwd(), 'tmp', 'uploads');
    await mkdir(uploadDir, { recursive: true });
    
    // Save the file temporarily
    const safeFileName = sanitizeUploadFileName(file.name);
    const filePath = path.join(uploadDir, `${Date.now()}-${safeFileName}`);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    await writeFile(filePath, buffer);
    
    // Read the file content
    const xmlContent = await readFile(filePath, 'utf8');
    
    // Convert OPT to Web Template
    const webTemplate = await convertOPTtoWebTemplate(xmlContent);
    
    // Clean up the temporary file
    await unlink(filePath).catch(err => console.warn('Warning: Failed to delete temporary file:', err));
    
    return NextResponse.json(webTemplate);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: 'Upload too large' }, { status: 413 });
    }
    console.error('Conversion error:', error);
    return NextResponse.json(
      { error: 'Failed to convert file', details: error.message },
      { status: 500 }
    );
  }
}

// For direct content conversion (no file upload)
export async function PUT(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { optContent } = await parseJsonWithLimit(request, MAX_OPT_BODY_BYTES);
    
    if (!optContent) {
      return NextResponse.json(
        { error: 'No OPT content provided' },
        { status: 400 }
      );
    }
    
    // Convert OPT to Web Template
    const webTemplate = await convertOPTtoWebTemplate(optContent);
    
    return NextResponse.json(webTemplate);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: 'Request body too large' }, { status: 413 });
    }
    console.error('Conversion error:', error);
    return NextResponse.json(
      { error: 'Failed to convert content', details: error.message },
      { status: 500 }
    );
  }
}
