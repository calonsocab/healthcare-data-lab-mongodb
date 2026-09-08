import { requireAuthenticatedUser } from '@/lib/security/api';
// GET /api/definitions/[id]/compile
// Resolve block references in a Context Object definition into an expanded tree.

import { NextResponse } from 'next/server';
import { getActiveTenantDb } from '@/lib/db/tenantDb';
import { getCoreDb } from '@/lib/db/coreDb';

const DEFINITIONS_COLLECTION = 'semantic_objects';
const TENANT_BLOCKS_COLLECTION = 'co_blocks';
const CORE_BLOCKS_COLLECTION = 'sample_co_blocks';

function parseSemver(version) {
  const match = `${version || ''}`.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10)
  };
}

function compareSemverDesc(a, b) {
  const av = parseSemver(a?.version);
  const bv = parseSemver(b?.version);
  if (!av || !bv) return `${b?.version || ''}`.localeCompare(`${a?.version || ''}`);
  if (av.major !== bv.major) return bv.major - av.major;
  if (av.minor !== bv.minor) return bv.minor - av.minor;
  return bv.patch - av.patch;
}

function satisfiesVersionRange(version, range) {
  if (!range) return true;
  const v = parseSemver(version);
  if (!v) return false;

  if (!range.startsWith('^') && !range.startsWith('~')) {
    return version === range;
  }

  const base = parseSemver(range.slice(1));
  if (!base) return false;

  if (range.startsWith('^')) {
    if (v.major !== base.major) return false;
    if (v.minor < base.minor) return false;
    if (v.minor === base.minor && v.patch < base.patch) return false;
    return true;
  }

  if (range.startsWith('~')) {
    if (v.major !== base.major) return false;
    if (v.minor !== base.minor) return false;
    return v.patch >= base.patch;
  }

  return false;
}

function buildChildMap(nodes) {
  const byParent = new Map();
  (nodes || []).forEach((node) => {
    if (!byParent.has(node.parentNodeId)) byParent.set(node.parentNodeId, []);
    byParent.get(node.parentNodeId).push(node);
  });
  return byParent;
}

function findRootNode(nodes) {
  return (nodes || []).find((n) => n.parentNodeId === null) || null;
}

async function resolveBlock(db, coreDb, blockId, versionRange) {
  const tenantBlocks = await db.collection(TENANT_BLOCKS_COLLECTION)
    .find({ blockId })
    .toArray();
  const coreBlocks = await coreDb.collection(CORE_BLOCKS_COLLECTION)
    .find({ blockId })
    .toArray();

  const all = [...tenantBlocks, ...coreBlocks];
  const eligible = all
    .filter((b) => satisfiesVersionRange(b.version, versionRange))
    .sort(compareSemverDesc);

  return eligible[0] || null;
}

async function expandNode({
  node,
  childMap,
  db,
  coreDb,
  visitedBlocks,
  warnings
}) {
  const currentChildren = (childMap.get(node.nodeId) || []);

  if (node.role !== 'block') {
    const children = [];
    for (const child of currentChildren) {
      children.push(await expandNode({
        node: child,
        childMap,
        db,
        coreDb,
        visitedBlocks,
        warnings
      }));
    }
    return { ...node, children };
  }

  const blockId = node.blockId;
  const versionRange = node.versionRange;
  if (!blockId) {
    warnings.push(`Block node "${node.name}" has no blockId`);
    return { ...node, children: [] };
  }

  const cycleKey = `${blockId}@${versionRange || 'latest'}`;
  if (visitedBlocks.has(cycleKey)) {
    warnings.push(`Cycle detected while resolving block ${cycleKey}`);
    return { ...node, children: [] };
  }

  const block = await resolveBlock(db, coreDb, blockId, versionRange);
  if (!block) {
    warnings.push(`Block not found: ${blockId}${versionRange ? ` (${versionRange})` : ''}`);
    return { ...node, children: [] };
  }

  const blockRoot = findRootNode(block.nodes || []);
  if (!blockRoot) {
    warnings.push(`Block ${block.blockId}@${block.version} has no root node`);
    return { ...node, children: [] };
  }

  const blockChildMap = buildChildMap(block.nodes || []);
  visitedBlocks.add(cycleKey);

  const expandedBlockChildren = [];
  const rootChildren = blockChildMap.get(blockRoot.nodeId) || [];
  for (const child of rootChildren) {
    expandedBlockChildren.push(await expandNode({
      node: child,
      childMap: blockChildMap,
      db,
      coreDb,
      visitedBlocks,
      warnings
    }));
  }

  visitedBlocks.delete(cycleKey);

  return {
    ...node,
    _resolvedBlock: {
      blockId: block.blockId,
      version: block.version,
      name: block.name
    },
    children: expandedBlockChildren
  };
}

export async function GET(request, props) {
  const params = await props.params;
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { db } = await getActiveTenantDb(request);
    const coreDb = await getCoreDb();

    const definition = await db.collection(DEFINITIONS_COLLECTION).findOne(
      { id },
      { projection: { _id: 0 } }
    );

    if (!definition) {
      return NextResponse.json({ error: 'Definition not found' }, { status: 404 });
    }

    const root = findRootNode(definition.nodes || []);
    if (!root) {
      return NextResponse.json({
        ...definition,
        compiled: { root: null, warnings: ['Definition has no root node'] }
      });
    }

    const warnings = [];
    const compiledRoot = await expandNode({
      node: root,
      childMap: buildChildMap(definition.nodes || []),
      db,
      coreDb,
      visitedBlocks: new Set(),
      warnings
    });

    return NextResponse.json({
      ...definition,
      compiled: {
        root: compiledRoot,
        warnings
      }
    });
  } catch (error) {
    console.error('Error compiling definition:', error);
    return NextResponse.json(
      { error: 'Failed to compile definition', details: error.message },
      { status: 500 }
    );
  }
}
