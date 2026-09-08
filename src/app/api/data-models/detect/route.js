import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/data-models/detect/route.js
/**
 * Domain Detection API
 *
 * Automatically detect the domain of uploaded content without persisting it.
 * Useful for preview and validation before creating a data model.
 */

import { NextResponse } from 'next/server';
import { detectDomain, parseWithAutoDetect, getDomainConfig } from '@/lib/domains';
import { DATA_MODEL_SOURCES } from '@/lib/data-models';

/**
 * POST /api/data-models/detect
 *
 * Detect domain and optionally parse content
 *
 * Body:
 * - content: The content to analyze (JSON object or string)
 * - fileName: (optional) Original file name for detection hints
 * - parse: (optional) If true, also parse the content and return the DataModel preview
 *
 * Response:
 * - domain: Detected domain identifier (or null if unknown)
 * - domainConfig: Domain configuration (name, color, icon, etc.)
 * - confidence: Detection confidence (0-1)
 * - preview: (if parse=true) Preview of the parsed DataModel
 * - error: (if parse=true and parsing failed) Error message
 */
export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const body = await request.json();

    if (!body.content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    const { content, fileName = '', parse = false } = body;

    // Create a mock file object for detection
    const mockFile = fileName ? { name: fileName } : null;

    // Detect domain
    const detection = detectDomain(mockFile, content);

    // Build response
    const response = {
      domain: detection.domain,
      domainConfig: detection.domain ? getDomainConfig(detection.domain) : null,
      confidence: detection.confidence,
      detected: !!detection.domain,
    };

    // If parse requested, also parse the content
    if (parse && detection.domain) {
      try {
        const parseResult = await parseWithAutoDetect(content, {
          file: mockFile,
          fileName,
          source: DATA_MODEL_SOURCES.UPLOAD,
        });

        if (parseResult.success) {
          // Return preview without domainData (can be large)
          const preview = {
            ...parseResult.dataModel,
            domainData: undefined, // Exclude large payload
          };

          // Add summary of domain data
          const domainData = parseResult.dataModel.domainData || {};
          preview.domainDataSummary = {
            hasWebTemplate: !!domainData.webTemplate,
            hasResource: !!domainData.resource,
            hasSemanticObject: !!domainData.semanticObject,
            nodeCount: domainData.nodes?.length || domainData.webTemplate?.children?.length || 0,
          };

          response.preview = preview;
        } else {
          response.parseError = parseResult.error;
        }
      } catch (parseError) {
        response.parseError = parseError.message;
      }
    }

    return NextResponse.json(response);
  } catch (e) {
    console.error('POST /api/data-models/detect error:', e);
    return NextResponse.json(
      { error: e.message || 'Server error' },
      { status: 500 }
    );
  }
}
