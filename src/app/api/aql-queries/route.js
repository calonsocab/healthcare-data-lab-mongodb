import { requireAuthenticatedUser } from '@/lib/security/api';
// app/api/aql-queries/route.js
import { getActiveTenantDb } from '@/lib/db/tenantDb'
import { NextResponse } from 'next/server'
import { ObjectId } from 'mongodb'
import { escapeRegex } from '@/lib/utils'

const AQL_QUERY_MUTABLE_FIELDS = [
  'name',
  'description',
  'uuid',
  'folderId',
  'tags',
  'aqlText',
  'normalizedAQL',
  'affectedTemplates',
  'strategyValidations',
  'conversionStrategy',
  'generatedMql'
]

const AQL_QUERY_OUTPUT_FIELDS = [
  ...AQL_QUERY_MUTABLE_FIELDS,
  'createdBy',
  'createdAt',
  'updatedBy',
  'updatedAt'
]

const VALID_TRANSFORMATION_STATUSES = ['pending', 'needs_improvement', 'done']
const ensuredAqlIndexes = new Set()

function pick(obj, keys) {
  const out = {}
  for (const k of keys) {
    if (obj?.[k] !== undefined) out[k] = obj[k]
  }
  return out
}

function normalizeDate(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return value
}

function toAqlQueryApiDoc(doc) {
  if (!doc) return null
  const out = pick(doc, AQL_QUERY_OUTPUT_FIELDS)
  return {
    ...out,
    _id: doc._id?.toString?.() || String(doc._id),
    createdAt: normalizeDate(out.createdAt),
    updatedAt: normalizeDate(out.updatedAt),
    status: latestStatusFromValidations(doc.strategyValidations) || 'pending',
  }
}

function sanitizeStrategyValidations(input, { nowIso, userEmail } = {}) {
  if (input === undefined) return undefined
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null

  const out = {}
  const now = nowIso || new Date().toISOString()
  for (const [strategyId, validation] of Object.entries(input)) {
    if (!validation || typeof validation !== 'object' || Array.isArray(validation)) continue

    const status = validation.status
    if (status && !VALID_TRANSFORMATION_STATUSES.includes(status)) {
      // keep behavior consistent with previous validation but enforce a clean shape
      throw new Error(`Invalid status '${status}' in strategyValidations. Must be: ${VALID_TRANSFORMATION_STATUSES.join(', ')}`)
    }

    out[strategyId] = {
      ...(validation.strategyName !== undefined ? { strategyName: String(validation.strategyName) } : {}),
      ...(validation.protocol !== undefined ? { protocol: String(validation.protocol) } : {}),
      ...(status ? { status } : {}),
      // non-repudiation: always set server-side metadata (ignore client-provided timestamps)
      updatedAt: now,
      updatedBy: userEmail || 'unknown'
    }
  }
  return out
}

function latestStatusFromValidations(strategyValidations) {
  if (!strategyValidations || typeof strategyValidations !== 'object') return null
  let best = null
  let bestTime = 0
  for (const v of Object.values(strategyValidations)) {
    if (!v || typeof v !== 'object') continue
    const status = v.status
    if (!status || !VALID_TRANSFORMATION_STATUSES.includes(status)) continue
    const t = Date.parse(v.updatedAt || '') || 0
    if (!best || t >= bestTime) {
      best = status
      bestTime = t
    }
  }
  return best
}

// optional: lightweight index to speed up name lookups
async function ensureAqlIndexes(db) {
  const key = `${db.databaseName}:aql-queries:v1`
  if (ensuredAqlIndexes.has(key)) return
  await db.collection('aql-queries').createIndexes([
    { key: { name: 1 }, name: 'name_1' },
    { key: { updatedAt: -1 }, name: 'updatedAt_desc' },
  ])
  ensuredAqlIndexes.add(key)
}

export async function GET(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { db } = await getActiveTenantDb(request, { session })
    await ensureAqlIndexes(db)

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const folder = searchParams.get('folder')
    const templateId = searchParams.get('templateId')
    const summary = searchParams.get('summary')      // e.g. 'usage'
    const templateIdsParam = searchParams.get('templateIds') // comma-separated
    const sortBy = searchParams.get('sort') || 'name' // 'name', 'recent', 'created'
    const limitParam = parseInt(searchParams.get('limit') || '0', 10)

    const col = db.collection('aql-queries')

    // Build filter
    const filter = {}
    if (search) {
      const escapedSearch = escapeRegex(search)
      filter.$or = [
        { name:        { $regex: escapedSearch, $options: 'i' } },
        { description: { $regex: escapedSearch, $options: 'i' } },
        { aqlText:     { $regex: escapedSearch, $options: 'i' } },
        { tags: { $elemMatch: { $regex: escapedSearch, $options: 'i' } } }
      ]
    }
    if (folder) filter.folderId = folder

    if (templateId) {
      filter.$or = [
        { 'affectedTemplates._id': templateId },
        { 'affectedTemplates.id': templateId },
      ]
      if (ObjectId.isValid(templateId)) {
        filter.$or.push({ 'affectedTemplates._id': new ObjectId(templateId) })
      }
    }

    if (summary === 'usage') {
      const onlyIds = (templateIdsParam || '')
        .split(',').map(s => s.trim()).filter(Boolean)

      const pipeline = [
        ...(Object.keys(filter).length ? [{ $match: filter }] : []),
        { $unwind: '$affectedTemplates' },
        { $addFields: { _tplRaw: { $ifNull: ['$affectedTemplates._id', '$affectedTemplates.id'] } } },
        {
          $addFields: {
            tplId: {
              $cond: [
                { $eq: [{ $type: '$_tplRaw' }, 'objectId'] },
                { $toString: '$_tplRaw' },
                '$_tplRaw'
              ]
            }
          }
        },
        ...(onlyIds.length ? [{ $match: { tplId: { $in: onlyIds } } }] : []),
        { $group: { _id: '$tplId', count: { $sum: 1 } } }
      ]

      const rows = await col.aggregate(pipeline).toArray()
      const map = {}
      rows.forEach(r => { if (r._id) map[r._id] = r.count })
      return NextResponse.json(map)
    }

    // Determine sort order
    let sortOrder = { name: 1 }
    if (sortBy === 'recent') {
      sortOrder = { updatedAt: -1, createdAt: -1, name: 1 }
    } else if (sortBy === 'created') {
      sortOrder = { createdAt: -1, name: 1 }
    }

    // Default list with sorting and optional limit
    let cursor = col.find(filter).sort(sortOrder)
    if (limitParam > 0) {
      cursor = cursor.limit(limitParam)
    }
    const docs = await cursor.toArray()
    return NextResponse.json(docs.map(toAqlQueryApiDoc))
  } catch (error) {
    console.error('GET /api/aql-queries error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const raw = await request.json()
    if (!raw.name || !raw.aqlText) {
      return NextResponse.json({ error: 'Name and AQL query are required' }, { status: 400 })
    }

    // Allowlist input fields to prevent parameter pollution.
    const body = pick(raw, AQL_QUERY_MUTABLE_FIELDS)

    // Security: Never accept user-provided _id to prevent DoS via invalid ObjectIds
    // MongoDB will auto-generate a valid ObjectId when _id is omitted
    if (raw.hasOwnProperty('_id')) {
      console.warn('POST /api/aql-queries: Attempt to provide custom _id blocked', {
        providedId: raw._id,
        userId: session.user.email,
        queryName: raw.name
      });
    }

    const { db } = await getActiveTenantDb(request, { session })
    await ensureAqlIndexes(db)

    // defaults & metadata
    body.createdBy = session.user.email
    body.createdAt = new Date()
    body.updatedAt = new Date()
    body.updatedBy = session.user.email

    // Support per-strategy validation status
    // strategyValidations: { [strategyId]: { status: 'pending'|'needs_improvement'|'done', strategyName, protocol, updatedAt } }
    const nowIso = new Date().toISOString()
    try {
      const sv = sanitizeStrategyValidations(body.strategyValidations || {}, { nowIso, userEmail: session.user.email })
      body.strategyValidations = sv || {}
    } catch (e) {
      return NextResponse.json({ error: e.message || 'Invalid strategyValidations' }, { status: 400 })
    }

    const col = db.collection('aql-queries')

    const exists = await col.findOne({ name: body.name })
    if (exists) {
      return NextResponse.json({ error: 'Query with this name already exists.' }, { status: 409 })
    }

    const res = await col.insertOne(body)
    return NextResponse.json({ success: true, ...toAqlQueryApiDoc({ ...body, _id: res.insertedId }) })
  } catch (error) {
    console.error('POST /api/aql-queries error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}

export async function PUT(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const raw = await request.json()
    if (!raw._id || !raw.name || !raw.aqlText) {
      return NextResponse.json({ error: 'ID, name, and AQL query are required' }, { status: 400 })
    }
    if (!ObjectId.isValid(raw._id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 })
    }

    // Security: Prevent parameter pollution - strip immutable fields
    const IMMUTABLE_FIELDS = ['createdBy', 'createdAt'];
    const attemptedImmutable = IMMUTABLE_FIELDS.filter(field => raw.hasOwnProperty(field));
    if (attemptedImmutable.length > 0) {
      console.warn('PUT /api/aql-queries: Attempt to modify immutable fields blocked', {
        fields: attemptedImmutable,
        userId: session.user.email,
        queryId: raw._id
      });
    }

    // Allowlist input fields to prevent parameter pollution.
    const body = pick(raw, AQL_QUERY_MUTABLE_FIELDS)

    const { db } = await getActiveTenantDb(request, { session })
    const col = db.collection('aql-queries')

    const nowIso = new Date().toISOString()
    try {
      const sv = sanitizeStrategyValidations(body.strategyValidations, { nowIso, userEmail: session.user.email })
      if (sv === null) {
        return NextResponse.json({ error: 'strategyValidations must be an object' }, { status: 400 })
      }
      if (sv !== undefined) body.strategyValidations = sv
    } catch (e) {
      return NextResponse.json({ error: e.message || 'Invalid strategyValidations' }, { status: 400 })
    }

    body.updatedAt = new Date()
    body.updatedBy = session.user.email
    const update = pick(body, [...AQL_QUERY_MUTABLE_FIELDS, 'updatedAt', 'updatedBy'])

    const res = await col.updateOne(
      { _id: new ObjectId(raw._id) },
      {
        $set: update
      }
    )
    if (!res.matchedCount) return NextResponse.json({ error: 'Query not found' }, { status: 404 })

    const updated = await col.findOne({ _id: new ObjectId(raw._id) })
    return NextResponse.json({
      success: true,
      ...toAqlQueryApiDoc(updated)
    })
  } catch (error) {
    console.error('PUT /api/aql-queries error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { id } = await request.json()
    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 })
    }

    const { db } = await getActiveTenantDb(request, { session })
    const res = await db.collection('aql-queries').deleteOne({ _id: new ObjectId(id) })
    if (!res.deletedCount) return NextResponse.json({ error: 'Query not found' }, { status: 404 })

    return NextResponse.json({ success: true, deletedCount: res.deletedCount })
  } catch (error) {
    console.error('DELETE /api/aql-queries error:', error)
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 })
  }
}
