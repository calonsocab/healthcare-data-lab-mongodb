function normalizeOwnerId(value) {
  if (value === null || value === undefined || value === '') return null;
  return String(value);
}

function normalizeEnvId(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

export function buildEnvironmentSecretOwner(scope = {}) {
  if (scope?.mode === 'team') {
    const ownerId = normalizeOwnerId(scope?.team?._id ?? scope?.user?.teamId);
    return ownerId ? { ownerType: 'team', ownerId } : null;
  }

  if (scope?.mode === 'individual') {
    const ownerId = normalizeOwnerId(scope?.user?._id);
    return ownerId ? { ownerType: 'user', ownerId } : null;
  }

  return null;
}

export function buildEnvironmentSecretFilter(scope = {}, envId) {
  const owner = buildEnvironmentSecretOwner(scope);
  const normalizedEnvId = normalizeEnvId(envId);
  if (!owner || !normalizedEnvId) return null;

  return {
    envId: normalizedEnvId,
    ...owner,
  };
}

function buildLegacyEnvironmentSecretFilter(envId) {
  const normalizedEnvId = normalizeEnvId(envId);
  if (!normalizedEnvId) return null;

  return {
    envId: normalizedEnvId,
    ownerType: { $exists: false },
    ownerId: { $exists: false },
  };
}

function buildFindOptions(projection) {
  return projection ? { projection } : undefined;
}

export async function findEnvironmentSecretDoc(coreDb, scope, envId, { projection } = {}) {
  if (!coreDb?.collection) return null;

  const scopedFilter = buildEnvironmentSecretFilter(scope, envId);
  if (!scopedFilter) return null;

  const collection = coreDb.collection('environment_secrets');
  const scopedDoc = await collection.findOne(scopedFilter, buildFindOptions(projection));
  if (scopedDoc) return scopedDoc;

  const legacyFilter = buildLegacyEnvironmentSecretFilter(envId);
  if (!legacyFilter) return null;
  return collection.findOne(legacyFilter, buildFindOptions(projection));
}

export async function listEnvironmentSecretDocs(coreDb, scope, envIds = [], { projection } = {}) {
  if (!coreDb?.collection) return [];

  const owner = buildEnvironmentSecretOwner(scope);
  if (!owner) return [];

  const normalizedEnvIds = Array.from(
    new Set(envIds.map((envId) => normalizeEnvId(envId)).filter(Boolean))
  );
  if (!normalizedEnvIds.length) return [];

  const collection = coreDb.collection('environment_secrets');
  const findOptions = buildFindOptions(projection);
  const scopedDocs = await collection
    .find({ envId: { $in: normalizedEnvIds }, ...owner }, findOptions)
    .toArray();

  const foundEnvIds = new Set(scopedDocs.map((doc) => normalizeEnvId(doc?.envId)).filter(Boolean));
  const missingEnvIds = normalizedEnvIds.filter((envId) => !foundEnvIds.has(envId));
  if (!missingEnvIds.length) return scopedDocs;

  const legacyDocs = await collection
    .find(
      {
        envId: { $in: missingEnvIds },
        ownerType: { $exists: false },
        ownerId: { $exists: false },
      },
      findOptions
    )
    .toArray();

  return scopedDocs.concat(legacyDocs);
}

export async function upsertEnvironmentSecretDoc(coreDb, scope, envId, sealedUri, updatedAt = new Date()) {
  if (!coreDb?.collection || !sealedUri) return;

  const filter = buildEnvironmentSecretFilter(scope, envId);
  if (!filter) return;

  const collection = coreDb.collection('environment_secrets');
  await collection.updateOne(
    filter,
    {
      $set: {
        ...filter,
        sealedUri,
        updatedAt,
      },
      $setOnInsert: {
        createdAt: updatedAt,
      },
    },
    { upsert: true }
  );

  const legacyFilter = buildLegacyEnvironmentSecretFilter(envId);
  if (legacyFilter) {
    await collection.deleteMany(legacyFilter);
  }
}

export async function deleteEnvironmentSecretDoc(coreDb, scope, envId) {
  if (!coreDb?.collection) return;

  const collection = coreDb.collection('environment_secrets');
  const filter = buildEnvironmentSecretFilter(scope, envId);
  if (filter) {
    await collection.deleteOne(filter);
  }

  const legacyFilter = buildLegacyEnvironmentSecretFilter(envId);
  if (legacyFilter) {
    await collection.deleteMany(legacyFilter);
  }
}
