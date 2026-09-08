import { requireAuthenticatedUser } from '@/lib/security/api';
// src/app/api/sample-data-models/route.js
/**
 * Sample Data Models API - Unified Multi-domain Sample Library
 *
 * Queries from the unified sample-data-models collection which contains:
 * - OpenEHR templates (domain: 'openehr')
 * - FHIR resources (domain: 'fhir')
 * - Context objects (domain: 'context')
 */

import { NextResponse } from 'next/server';
import { getCoreDb } from '@/lib/db/coreDb';
import { escapeRegex } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const COLLECTION_NAME = 'sample-data-models';
const VALID_DOMAINS = ['openehr', 'fhir', 'context'];

export async function GET(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();
    const collection = coreDb.collection(COLLECTION_NAME);
    const url = new URL(req.url);

    // Query parameters
    const domain = url.searchParams.get('domain'); // 'openehr', 'fhir', 'context', or null for all
    const search = (url.searchParams.get('search') || '').trim();
    const limitParam = parseInt(url.searchParams.get('limit') || '100', 10);
    const limit = Math.min(Math.max(limitParam, 1), 500);
    const sortBy = url.searchParams.get('sortBy') || 'name';
    const sortDir = url.searchParams.get('sortDir') === 'desc' ? -1 : 1;
    const summary = url.searchParams.get('summary') === 'true';

    // Validate domain if provided
    if (domain && !VALID_DOMAINS.includes(domain)) {
      return NextResponse.json(
        { error: `Invalid domain. Must be one of: ${VALID_DOMAINS.join(', ')}` },
        { status: 400 }
      );
    }

    // Build query filter
    const filter = {};

    if (domain) {
      filter.domain = domain;
    }

    if (search) {
      const escapedSearch = escapeRegex(search);
      filter.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
        { 'metadata.templateId': { $regex: escapedSearch, $options: 'i' } },
        { 'metadata.tags': { $regex: escapedSearch, $options: 'i' } },
        { 'domainData.resourceType': { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    // Get counts by domain (always include this)
    const countsByDomain = {};
    for (const d of VALID_DOMAINS) {
      countsByDomain[d] = await collection.countDocuments({ domain: d });
    }

    // If summary only, return just the counts
    if (summary) {
      return NextResponse.json({
        items: [],
        total: 0,
        counts: {
          total: Object.values(countsByDomain).reduce((sum, c) => sum + c, 0),
          byDomain: countsByDomain,
        },
      });
    }

    // Fetch items from database
    const items = await collection
      .find(filter)
      .sort({ [sortBy]: sortDir })
      .limit(limit)
      .toArray();

    // Transform items to ensure consistent format
    const transformedItems = items.map(doc => ({
      _id: doc._id.toString(),
      name: doc.name,
      domain: doc.domain,
      modelType: doc.modelType,
      description: doc.description,
      domainData: doc.domainData,
      metadata: doc.metadata,
      audit: doc.audit,
      source: 'database',
    }));

    return NextResponse.json({
      items: transformedItems,
      total: transformedItems.length,
      counts: {
        total: Object.values(countsByDomain).reduce((sum, c) => sum + c, 0),
        byDomain: countsByDomain,
      },
    });
  } catch (error) {
    console.error('Error fetching sample data models:', error);
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new sample data model
 */
export async function POST(req) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const coreDb = await getCoreDb();
    const collection = coreDb.collection(COLLECTION_NAME);
    const body = await req.json();

    // Validate required fields
    if (!body.name || !body.domain) {
      return NextResponse.json(
        { error: 'name and domain are required fields' },
        { status: 400 }
      );
    }

    if (!VALID_DOMAINS.includes(body.domain)) {
      return NextResponse.json(
        { error: `Invalid domain. Must be one of: ${VALID_DOMAINS.join(', ')}` },
        { status: 400 }
      );
    }

    // Check for duplicate
    const existing = await collection.findOne({
      name: body.name,
      domain: body.domain,
    });

    if (existing) {
      return NextResponse.json(
        { error: `A ${body.domain} sample with name "${body.name}" already exists` },
        { status: 409 }
      );
    }

    // Create the document
    const doc = {
      name: body.name,
      domain: body.domain,
      modelType: body.modelType || 'resource',
      description: body.description || '',
      domainData: body.domainData || {},
      metadata: {
        tags: body.metadata?.tags || [body.domain],
        ...body.metadata,
      },
      audit: {
        createdAt: new Date(),
        createdBy: session.user.email || session.user.name || 'unknown',
      },
    };

    const result = await collection.insertOne(doc);

    return NextResponse.json({
      _id: result.insertedId.toString(),
      ...doc,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating sample data model:', error);
    return NextResponse.json(
      { error: error.message || 'Server error' },
      { status: 500 }
    );
  }
}
