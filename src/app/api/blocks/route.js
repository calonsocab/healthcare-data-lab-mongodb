import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { getCoreDb } from '@/lib/db/coreDb';
import { escapeRegex } from '@/lib/utils';
import { clampPositiveInt, requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';

/**
 * GET /api/blocks - List all reusable blocks
 *
 * Merges blocks from:
 * 1. CORE database (sample/shared blocks - read-only reference)
 * 2. TENANT database (customer-specific blocks - mutable)
 *
 * Query params:
 * - search: Filter by name, description, or blockId
 * - source: 'all' | 'core' | 'tenant' (default: 'all')
 * - limit: Max items to return (default: 100)
 * - skip: Offset for pagination
 */
export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const source = searchParams.get('source') || 'all';
    const limit = clampPositiveInt(searchParams.get('limit'), 100, 500);
    const skip = clampPositiveInt(searchParams.get('skip'), 0, 10000);

    // Build query
    const query = {};
    if (search) {
      const escapedSearch = escapeRegex(search);
      query.$or = [
        { name: { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
        { blockId: { $regex: escapedSearch, $options: 'i' } }
      ];
    }

    let coreBlocks = [];
    let tenantBlocks = [];
    let coreTotal = 0;
    let tenantTotal = 0;

    // Fetch from CORE database (sample blocks)
    if (source === 'all' || source === 'core') {
      try {
        const coreDb = await getCoreDb();
        const coreCollection = coreDb.collection('sample_co_blocks');
        coreTotal = await coreCollection.countDocuments(query);
        const coreDocs = await coreCollection
          .find(query)
          .sort({ blockId: 1 })
          .toArray();

        coreBlocks = coreDocs.map(doc => ({
          ...doc,
          _source: 'core',
          _readOnly: true
        }));
      } catch (coreError) {
        console.warn('Could not fetch core blocks:', coreError.message);
      }
    }

    // Fetch from TENANT database (customer blocks)
    if (source === 'all' || source === 'tenant') {
      try {
        const { db } = await getActiveTenantDb(request);
        const tenantCollection = db.collection('co_blocks');
        tenantTotal = await tenantCollection.countDocuments(query);
        const tenantDocs = await tenantCollection
          .find(query)
          .sort({ 'metadata.updatedAt': -1, blockId: 1 })
          .toArray();

        tenantBlocks = tenantDocs.map(doc => ({
          ...doc,
          _source: 'tenant',
          _readOnly: false
        }));
      } catch (tenantError) {
        console.warn('Could not fetch tenant blocks:', tenantError.message);
      }
    }

    // Merge and dedupe (tenant blocks override core blocks with same blockId+version)
    const blockMap = new Map();

    // Add core blocks first
    coreBlocks.forEach(block => {
      const key = `${block.blockId}:${block.version}`;
      blockMap.set(key, block);
    });

    // Tenant blocks override core
    tenantBlocks.forEach(block => {
      const key = `${block.blockId}:${block.version}`;
      blockMap.set(key, block);
    });

    // Convert to array and apply pagination
    const allBlocks = Array.from(blockMap.values());
    const paginatedBlocks = allBlocks.slice(skip, skip + limit);

    return NextResponse.json({
      blocks: paginatedBlocks,
      total: allBlocks.length,
      counts: {
        core: coreTotal,
        tenant: tenantTotal
      },
      limit,
      skip
    });
  } catch (error) {
    console.error('Error fetching blocks:', error);
    return safeErrorResponse(error, 'Failed to fetch blocks');
  }
}

// POST /api/blocks - Create new reusable block
export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const data = await request.json();

    // Validate required fields
    if (!data.blockId) {
      return NextResponse.json(
        { error: 'blockId is required' },
        { status: 400 }
      );
    }

    if (!data.name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    if (!data.version) {
      return NextResponse.json(
        { error: 'version is required' },
        { status: 400 }
      );
    }

    if (!data.nodes || !Array.isArray(data.nodes) || data.nodes.length === 0) {
      return NextResponse.json(
        { error: 'nodes array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate blockId format
    if (!/^block\.[A-Za-z][A-Za-z0-9]*\.v\d+$/.test(data.blockId)) {
      return NextResponse.json(
        { error: 'blockId must follow format "block.Name.v1"' },
        { status: 400 }
      );
    }

    // Validate version format
    if (!/^\d+\.\d+\.\d+$/.test(data.version)) {
      return NextResponse.json(
        { error: 'version must be semver format (e.g., "1.0.0")' },
        { status: 400 }
      );
    }

    // Validate nodes have exactly one root
    const rootNodes = data.nodes.filter(n => n.parentNodeId === null);
    if (rootNodes.length !== 1) {
      return NextResponse.json(
        { error: `Block must have exactly one root node (found ${rootNodes.length})` },
        { status: 400 }
      );
    }

    // Sync childrenNodeIds from parentNodeId references
    const syncedNodes = syncChildrenNodeIds(data.nodes);

    // Set timestamps
    const now = new Date().toISOString();
    const block = {
      blockId: data.blockId,
      version: data.version,
      name: data.name,
      description: data.description || '',
      nodes: syncedNodes,
      metadata: {
        createdAt: now,
        createdBy: auth.session?.user?.email || 'unknown',
        updatedAt: now,
        updatedBy: auth.session?.user?.email || 'unknown',
        ...(data.metadata || {}),
        // Prevent audit field spoofing.
        createdAt: now,
        createdBy: auth.session?.user?.email || 'unknown',
        updatedAt: now,
        updatedBy: auth.session?.user?.email || 'unknown',
      }
    };

    // Save to database
    const { db } = await getActiveTenantDb(request);
    const collection = db.collection('co_blocks');

    // Check for duplicate blockId + version
    const existing = await collection.findOne({
      blockId: block.blockId,
      version: block.version
    });

    if (existing) {
      return NextResponse.json(
        { error: `Block ${block.blockId} version ${block.version} already exists` },
        { status: 409 }
      );
    }

    await collection.insertOne(block);

    // Create indexes if they don't exist
    await ensureBlockIndexes(collection);

    return NextResponse.json(block, { status: 201 });
  } catch (error) {
    console.error('Error creating block:', error);
    return safeErrorResponse(error, 'Failed to create block');
  }
}

/**
 * Rebuild childrenNodeIds from parentNodeId references
 */
function syncChildrenNodeIds(nodes) {
  const childrenMap = new Map();

  // Initialize all nodes with empty children arrays
  nodes.forEach(node => {
    childrenMap.set(node.nodeId, []);
  });

  // Build children arrays from parent references
  nodes.forEach(node => {
    if (node.parentNodeId) {
      const siblings = childrenMap.get(node.parentNodeId);
      if (siblings) {
        siblings.push(node.nodeId);
      }
    }
  });

  // Return nodes with corrected childrenNodeIds
  return nodes.map(node => ({
    ...node,
    childrenNodeIds: childrenMap.get(node.nodeId) || []
  }));
}

/**
 * Ensure indexes exist for the co_blocks collection
 */
async function ensureBlockIndexes(collection) {
  try {
    await collection.createIndex({ blockId: 1, version: 1 }, { unique: true });
    await collection.createIndex({ name: 'text', description: 'text' });
    await collection.createIndex({ 'metadata.updatedAt': -1 });
  } catch (error) {
    // Indexes may already exist
    console.log('Index creation note:', error.message);
  }
}
