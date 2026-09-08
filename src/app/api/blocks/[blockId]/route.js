import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { getCoreDb } from '@/lib/db/coreDb';
import { requireAuthenticatedUser, safeErrorResponse } from '@/lib/security/api';

/**
 * GET /api/blocks/[blockId] - Get a specific block
 *
 * Searches in both CORE (sample) and TENANT (customer) databases.
 * Query params:
 * - version: Specific version to fetch (optional, defaults to latest)
 *
 * Returns block with _source and _readOnly metadata.
 */
export async function GET(request, { params }) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { blockId } = await params;
    const { searchParams } = new URL(request.url);
    const version = searchParams.get('version');

    // Build query
    const query = { blockId: decodeURIComponent(blockId) };
    if (version) {
      query.version = version;
    }

    // Try TENANT database first (customer's blocks)
    try {
      const { db } = await getActiveTenantDb(request);
      const tenantCollection = db.collection('co_blocks');

      let block;
      if (version) {
        block = await tenantCollection.findOne(query);
      } else {
        // Get latest version
        block = await tenantCollection
          .find({ blockId: query.blockId })
          .sort({ version: -1 })
          .limit(1)
          .toArray()
          .then(docs => docs[0]);
      }

      if (block) {
        return NextResponse.json({
          ...block,
          _source: 'tenant',
          _readOnly: false
        });
      }
    } catch (tenantError) {
      console.warn('Could not fetch from tenant:', tenantError.message);
    }

    // Fall back to CORE database (sample blocks)
    try {
      const coreDb = await getCoreDb();
      const coreCollection = coreDb.collection('sample_co_blocks');

      let block;
      if (version) {
        block = await coreCollection.findOne(query);
      } else {
        block = await coreCollection
          .find({ blockId: query.blockId })
          .sort({ version: -1 })
          .limit(1)
          .toArray()
          .then(docs => docs[0]);
      }

      if (block) {
        return NextResponse.json({
          ...block,
          _source: 'core',
          _readOnly: true
        });
      }
    } catch (coreError) {
      console.warn('Could not fetch from core:', coreError.message);
    }

    return NextResponse.json(
      { error: `Block not found: ${blockId}${version ? ` version ${version}` : ''}` },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error fetching block:', error);
    return safeErrorResponse(error, 'Failed to fetch block');
  }
}

/**
 * PUT /api/blocks/[blockId] - Update a block
 *
 * Only works for TENANT database blocks (customer's blocks).
 * Core sample blocks are read-only.
 *
 * Query params:
 * - version: Specific version to update (required)
 */
export async function PUT(request, { params }) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { blockId } = await params;
    const { searchParams } = new URL(request.url);
    const version = searchParams.get('version');

    if (!version) {
      return NextResponse.json(
        { error: 'version query parameter is required for updates' },
        { status: 400 }
      );
    }

    const data = await request.json();
    const decodedBlockId = decodeURIComponent(blockId);

    // Validate that blockId and version match the URL
    if (data.blockId && data.blockId !== decodedBlockId) {
      return NextResponse.json(
        { error: 'blockId in body does not match URL' },
        { status: 400 }
      );
    }
    if (data.version && data.version !== version) {
      return NextResponse.json(
        { error: 'version in body does not match URL. To create a new version, use POST.' },
        { status: 400 }
      );
    }

    const { db } = await getActiveTenantDb(request);
    const collection = db.collection('co_blocks');

    // Check if block exists in tenant database
    const existing = await collection.findOne({ blockId: decodedBlockId, version });
    if (!existing) {
      return NextResponse.json(
        { error: `Block not found in tenant database: ${decodedBlockId} version ${version}. Note: Core sample blocks are read-only.` },
        { status: 404 }
      );
    }

    // Sync childrenNodeIds if nodes are provided
    let syncedNodes = existing.nodes;
    if (data.nodes && Array.isArray(data.nodes)) {
      syncedNodes = syncChildrenNodeIds(data.nodes);
    }

    // Update timestamp
    const now = new Date().toISOString();
    const updateData = {
      blockId: decodedBlockId,
      version,
      metadata: {
        ...existing.metadata,
        ...(data?.metadata || {}),
        createdAt: existing.metadata?.createdAt,
        createdBy: existing.metadata?.createdBy,
        updatedAt: now,
        updatedBy: auth.session?.user?.email || existing.metadata?.updatedBy || 'unknown'
      }
    };
    if (data?.name !== undefined) updateData.name = data.name;
    if (data?.description !== undefined) updateData.description = data.description;
    if (data?.nodes !== undefined) updateData.nodes = syncedNodes;

    // Remove _id to avoid immutable field error
    delete updateData._id;

    await collection.updateOne(
      { blockId: decodedBlockId, version },
      { $set: updateData }
    );

    // Fetch and return updated block
    const updated = await collection.findOne({ blockId: decodedBlockId, version });

    return NextResponse.json({
      ...updated,
      _source: 'tenant',
      _readOnly: false
    });
  } catch (error) {
    console.error('Error updating block:', error);
    return safeErrorResponse(error, 'Failed to update block');
  }
}

/**
 * DELETE /api/blocks/[blockId] - Delete a block
 *
 * Only works for TENANT database blocks.
 * Core sample blocks cannot be deleted.
 *
 * Query params:
 * - version: Specific version to delete (optional, deletes all versions if not provided)
 */
export async function DELETE(request, { params }) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const { blockId } = await params;
    const { searchParams } = new URL(request.url);
    const version = searchParams.get('version');

    const decodedBlockId = decodeURIComponent(blockId);

    const { db } = await getActiveTenantDb(request);
    const collection = db.collection('co_blocks');

    // Build delete query
    const query = { blockId: decodedBlockId };
    if (version) {
      query.version = version;
    }

    // Check if block exists
    const existing = await collection.findOne(query);
    if (!existing) {
      return NextResponse.json(
        { error: `Block not found in tenant database: ${decodedBlockId}${version ? ` version ${version}` : ''}. Note: Core sample blocks cannot be deleted.` },
        { status: 404 }
      );
    }

    // Delete
    const result = await collection.deleteMany(query);

    return NextResponse.json({
      deleted: true,
      blockId: decodedBlockId,
      version: version || 'all',
      count: result.deletedCount
    });
  } catch (error) {
    console.error('Error deleting block:', error);
    return safeErrorResponse(error, 'Failed to delete block');
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
