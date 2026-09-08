// src/lib/validation/persistenceStrategy.js

const VISIBILITY_VALUES = ["private", "public"];
const ALLOWED_OWNER_TYPES = ["user", "team", "system"];

/**
 * Normalize and validate a persistence strategy payload.
 * @param {object} payload - Incoming body
 * @param {object} opts - Options
 * @param {boolean} [opts.partial=false] - Allow partial updates
 * @returns {object} sanitized payload
 */
export function validateStrategyPayload(payload = {}, { partial = false } = {}) {
  if (!partial && !payload.name) {
    const err = new Error("Strategy name is required");
    err.status = 400;
    throw err;
  }
  if (!partial && payload.config === undefined) {
    const err = new Error("Strategy config is required");
    err.status = 400;
    throw err;
  }

  const normalized = {};

  if (payload.name !== undefined) {
    if (typeof payload.name !== "string" || !payload.name.trim()) {
      const err = new Error("Strategy name must be a non-empty string");
      err.status = 400;
      throw err;
    }
    normalized.name = payload.name.trim();
  }

  if (payload.description !== undefined) {
    if (payload.description !== null && typeof payload.description !== "string") {
      const err = new Error("Description must be a string");
      err.status = 400;
      throw err;
    }
    normalized.description = payload.description?.trim() || "";
  }

  if (payload.visibility !== undefined) {
    if (!VISIBILITY_VALUES.includes(payload.visibility)) {
      const err = new Error(`Visibility must be one of: ${VISIBILITY_VALUES.join(", ")}`);
      err.status = 400;
      throw err;
    }
    normalized.visibility = payload.visibility;
  }

  if (payload.tags !== undefined) {
    if (!Array.isArray(payload.tags)) {
      const err = new Error("Tags must be an array of strings");
      err.status = 400;
      throw err;
    }
    const tags = payload.tags
      .map(tag => (typeof tag === "string" ? tag.trim() : null))
      .filter(Boolean);
    normalized.tags = tags;
  }

  if (payload.config !== undefined) {
    normalized.config = parseStrategyConfig(payload.config);
  }

  return normalized;
}

export function parseStrategyConfig(raw) {
  if (raw === null || raw === undefined) {
    const err = new Error("Strategy config cannot be empty");
    err.status = 400;
    throw err;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
      const err = new Error("Strategy config JSON must produce an object");
      err.status = 400;
      throw err;
    } catch (error) {
      const err = new Error(`Invalid strategy config JSON: ${error.message}`);
      err.status = 400;
      throw err;
    }
  }

  if (typeof raw === "object") {
    return raw;
  }

  const err = new Error("Strategy config must be an object or JSON string");
  err.status = 400;
  throw err;
}

export function determineOwnerType(preferred, context) {
  if (preferred === "team" && context.teamId) {
    return "team";
  }
  return "user";
}

export function buildAccessFilter(context, { scope } = {}) {
  const ownClauses = [
    { ownerType: "user", ownerId: context.email },
  ];
  if (context.teamId) {
    ownClauses.push({ ownerType: "team", ownerId: context.teamId });
  }

  if (scope === "mine") {
    return { $or: ownClauses };
  }
  if (scope === "team" && context.teamId) {
    return { ownerType: "team", ownerId: context.teamId };
  }
  if (scope === "public") {
    return { visibility: "public" };
  }

  const clauses = [
    ...ownClauses,
    { ownerType: "system" },
    { visibility: "public" },
  ];
  return { $or: clauses };
}

export function canReadStrategy(doc, context) {
  if (!doc) return false;
  if (doc.ownerType === "system") return true;
  if (doc.visibility === "public") return true;
  if (doc.ownerType === "user" && doc.ownerId === context.email) return true;
  if (doc.ownerType === "team" && context.teamId && doc.ownerId === context.teamId) {
    return true;
  }
  return false;
}

export function canModifyStrategy(doc, context) {
  if (!doc) return false;
  if (doc.ownerType === "user" && doc.ownerId === context.email) return true;
  if (doc.ownerType === "team" && context.teamId && doc.ownerId === context.teamId) {
    return true;
  }
  return false;
}

export function strategyToResponse(doc) {
  if (!doc) return null;
  const {
    _id,
    config,
    tags,
    createdAt,
    updatedAt,
    ...rest
  } = doc;

  return {
    _id: _id?.toString() || doc._id || doc.id,
    ...rest,
    config: config ?? {},
    tags: Array.isArray(tags) ? tags : [],
    createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt,
    updatedAt: updatedAt instanceof Date ? updatedAt.toISOString() : updatedAt,
  };
}

export function sanitizeVisibility(value, fallback = "private") {
  if (!value) return fallback;
  return VISIBILITY_VALUES.includes(value) ? value : fallback;
}

export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags
    .map(tag => (typeof tag === "string" ? tag.trim() : null))
    .filter(Boolean);
}

export function isOwnerType(value) {
  return ALLOWED_OWNER_TYPES.includes(value);
}
