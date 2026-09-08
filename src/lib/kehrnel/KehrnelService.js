// src/lib/kehrnel/KehrnelService.js
/**
 * Unified Kehrnel Service for HDL
 *
 * Provides a single interface for all Kehrnel operations with proper
 * connection resolution, authentication, and error handling.
 *
 * Resolution priority:
 * 1. Explicit connectionId -> kehrnel_instances._id
 * 2. kehrnel_instances.isDefault === true
 * 3. environment.kehrnel.apiUrl (if useDefault is false)
 * 4. KEHRNEL_URL environment variable
 */

import { ObjectId } from 'mongodb';
import { openSecret } from '../crypto/secrets.mjs';

const DEFAULT_TIMEOUT = 30000;
const STRATEGIES_TTL_MS = 60000;
const STRATEGY_MANIFEST_TTL_MS = 60000;
const ENDPOINTS_TTL_MS = 60000;
const ENSURED_ACTIVATION_TTL_MS = 5 * 60 * 1000;
const ENSURED_DICTIONARIES_TTL_MS = 5 * 60 * 1000;

const strategiesCache = new Map(); // key: connectionId|url
const strategyManifestCache = new Map(); // key: strategyId|connectionId|url
const endpointsCache = new Map(); // key: env|domain|conn
const ensuredActivationsCache = new Map(); // key: env|domain|strategy|configSignature
const ensuredDictionariesCache = new Map(); // key: env|domain|strategy|configSignature

/**
 * KehrnelService - Unified service for Kehrnel API operations
 */
export class KehrnelService {
  /**
   * @param {Db} db - MongoDB core database instance
   */
  constructor(db) {
    this.db = db;
  }

  // ═══════════════════════════════════════════════════════════════
  // Connection Resolution
  // ═══════════════════════════════════════════════════════════════

  /**
   * Resolve Kehrnel connection info based on priority
   *
   * @param {object} options
   * @param {string} [options.connectionId] - Explicit kehrnel_instances._id
   * @param {object} [options.envKehrnel] - environment.kehrnel config
   * @returns {Promise<{url: string, name: string, connectionId?: string, apiKey?: string} | null>}
   */
  async resolveConnection(options = {}) {
    const { connectionId, envKehrnel } = options;
    const fallbackApiKey = this._resolveFallbackApiKey(envKehrnel);
    const normalizedEnvApiUrl =
      envKehrnel?.apiUrl && typeof envKehrnel.apiUrl === 'string'
        ? envKehrnel.apiUrl.replace(/\/$/, '')
        : null;

    // 1. By explicit connectionId
    if (connectionId) {
      try {
        const inst = await this.db.collection('kehrnel_instances').findOne({
          _id: new ObjectId(connectionId),
          enabled: { $ne: false }
        });
        if (inst) {
          const resolved = this._buildConnectionInfo(inst);
          return {
            ...resolved,
            apiKey: resolved.apiKey || fallbackApiKey || null
          };
        }
      } catch (err) {
        console.warn('Invalid connectionId:', connectionId, err.message);
      }
    }

    // 2. Environment URL mapped to an instance (preserve env-specific auth)
    if (normalizedEnvApiUrl) {
      const envInst = await this.db.collection('kehrnel_instances').findOne({
        url: normalizedEnvApiUrl,
        enabled: { $ne: false }
      });
      if (envInst) {
        const resolved = this._buildConnectionInfo(envInst);
        return {
          ...resolved,
          apiKey: resolved.apiKey || fallbackApiKey || null
        };
      }
    }

    // 3. Default instance in DB (isDefault: true)
    const defaultInst = await this.db.collection('kehrnel_instances').findOne({
      isDefault: true,
      enabled: { $ne: false }
    });
    if (defaultInst) {
      const resolved = this._buildConnectionInfo(defaultInst);
      return {
        ...resolved,
        apiKey: resolved.apiKey || fallbackApiKey || null
      };
    }

    // 4. First enabled instance if no default set
    const anyInst = await this.db.collection('kehrnel_instances').findOne({
      enabled: { $ne: false }
    });
    if (anyInst) {
      const resolved = this._buildConnectionInfo(anyInst);
      return {
        ...resolved,
        apiKey: resolved.apiKey || fallbackApiKey || null
      };
    }

    // 5. Environment kehrnel.apiUrl (if useDefault is explicitly false)
    if (envKehrnel?.apiUrl && envKehrnel.useDefault === false) {
      return {
        url: envKehrnel.apiUrl.replace(/\/$/, ''),
        name: 'environment-override',
        apiKey: fallbackApiKey || null
      };
    }

    // 6. Environment variable fallback
    const envUrl = process.env.KEHRNEL_URL || process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    if (envUrl) {
      return {
        url: envUrl.replace(/\/$/, ''),
        name: 'env-default',
        apiKey: fallbackApiKey || null
      };
    }

    return null;
  }

  /**
   * Build connection info from a kehrnel_instances document
   * @private
   */
  _buildConnectionInfo(instance) {
    let apiKey = instance.apiKey;

    if (apiKey && typeof apiKey === 'object') {
      // Current secure storage format
      if (apiKey.v) {
        try {
          apiKey = openSecret(apiKey);
        } catch (err) {
          console.error('Failed to unseal API key:', err.message);
          apiKey = null;
        }
      // Backward-compatible plain object formats used by older records
      } else if (typeof apiKey.value === 'string') {
        apiKey = apiKey.value;
      } else if (typeof apiKey.apiKey === 'string') {
        apiKey = apiKey.apiKey;
      } else if (typeof apiKey.key === 'string') {
        apiKey = apiKey.key;
      } else if (typeof apiKey.token === 'string') {
        apiKey = apiKey.token;
      } else {
        apiKey = null;
      }
    }

    if (!apiKey && instance?.auth && typeof instance.auth === 'object') {
      if (typeof instance.auth.apiKey === 'string') {
        apiKey = instance.auth.apiKey;
      } else if (typeof instance.auth.key === 'string') {
        apiKey = instance.auth.key;
      } else if (typeof instance.auth.token === 'string') {
        apiKey = instance.auth.token;
      }
    }

    return {
      url: instance.url?.replace(/\/$/, ''),
      name: instance.name || 'kehrnel',
      connectionId: instance._id?.toString(),
      apiKey: apiKey || null
    };
  }

  /**
   * Resolve fallback API key from environment-level config.
   * Priority: env override -> standard env var -> admin env var.
   * @private
   */
  _resolveFallbackApiKey(envKehrnel = {}) {
    return (
      envKehrnel?.apiKey ||
      envKehrnel?.auth?.apiKey ||
      process.env.KEHRNEL_API_KEY ||
      process.env.KEHRNEL_ADMIN_API_KEY ||
      null
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // Health Check
  // ═══════════════════════════════════════════════════════════════

  /**
   * Check health of resolved Kehrnel connection
   *
   * @param {object} [options]
   * @param {string} [options.connectionId] - Specific connection to check
   * @returns {Promise<{healthy: boolean, url: string, version?: string, connectionId?: string}>}
   */
  async checkHealth(options = {}) {
    const conn = await this.resolveConnection(options);
    if (!conn) {
      throw new Error('No Kehrnel connection available');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const headers = { 'Accept': 'application/json' };
      if (conn.apiKey) {
        headers['x-api-key'] = conn.apiKey;
      }
      const res = await fetch(`${conn.url}/health`, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`Kehrnel returned ${res.status}`);
      }

      const data = await res.json();
      return {
        healthy: true,
        url: conn.url,
        connectionId: conn.connectionId,
        version: data.version || null,
        status: data.status || 'ok'
      };
    } catch (err) {
      clearTimeout(timeoutId);
      const error = new Error(err.name === 'AbortError' ? 'Connection timeout' : err.message);
      error.url = conn.url;
      error.connectionId = conn.connectionId;
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Strategy Catalog Operations
  // ═══════════════════════════════════════════════════════════════

  /**
   * List all available strategies from Kehrnel
   *
   * @param {object} [options]
   * @param {string} [options.connectionId] - Specific connection to use
   * @param {boolean} [options.forceRefresh] - Bypass cache and fetch fresh data
   * @returns {Promise<{strategies: Array, source: string, connectionId?: string}>}
   */
  async listStrategies(options = {}) {
    const conn = await this.resolveConnection(options);
    if (!conn) {
      throw new Error('No Kehrnel connection available');
    }

    const cacheKey = conn.connectionId || conn.url;

    // Check cache unless forceRefresh is requested
    if (!options.forceRefresh) {
      const cached = this._getCache(strategiesCache, cacheKey);
      if (cached) return cached;
    } else {
      // Clear cache entry when force refreshing
      strategiesCache.delete(cacheKey);
    }

    const res = await this._fetch(`${conn.url}/strategies`, {
      method: 'GET',
      apiKey: conn.apiKey
    });

    // Handle both { manifests: [...] } and { strategies: [...] } responses
    const strategies = Array.isArray(res.manifests)
      ? res.manifests
      : (res.strategies || []);

    const payload = {
      strategies,
      source: conn.name,
      connectionId: conn.connectionId
    };
    this._setCache(strategiesCache, cacheKey, payload, STRATEGIES_TTL_MS);
    return payload;
  }

  /**
   * Get a single strategy by ID
   *
   * @param {string} strategyId - Kehrnel strategy ID (e.g., 'openehr.rps_dual')
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async getStrategy(strategyId, options = {}) {
    const conn = await this.resolveConnection(options);
    if (!conn) {
      throw new Error('No Kehrnel connection available');
    }

    const cacheKey = `${strategyId}|${conn.connectionId || conn.url}`;
    if (!options.forceRefresh) {
      const cached = this._getCache(strategyManifestCache, cacheKey);
      if (cached) {
        return cached;
      }
    }

    const manifest = await this._fetch(`${conn.url}/strategies/${strategyId}`, {
      method: 'GET',
      apiKey: conn.apiKey
    });
    this._setCache(strategyManifestCache, cacheKey, manifest, STRATEGY_MANIFEST_TTL_MS);
    return manifest;
  }

  /**
   * Get the full spec.json for a strategy
   *
   * Returns the complete strategy specification including all configuration
   * options, schema definitions, and operational details.
   *
   * @param {string} strategyId - Kehrnel strategy ID (e.g., 'openehr.rps_dual')
   * @param {object} [options]
   * @returns {Promise<{strategy_id: string, spec: object}>}
   */
  async getStrategySpec(strategyId, options = {}) {
    const conn = await this.resolveConnection(options);
    if (!conn) {
      throw new Error('No Kehrnel connection available');
    }

    return this._fetch(`${conn.url}/strategies/${strategyId}/spec`, {
      method: 'GET',
      apiKey: conn.apiKey
    });
  }

  /**
   * Load a strategy pack from a path on the Kehrnel server
   *
   * Registers the strategy in the Kehrnel catalog.
   *
   * @param {string} path - Absolute path to the strategy pack directory
   * @param {string} [strategyId] - Optional strategy ID to verify against manifest
   * @param {object} [options]
   * @returns {Promise<{ok: boolean, strategy: object}>}
   */
  async loadStrategyPack(path, strategyId = null, options = {}) {
    const conn = await this.resolveConnection(options);
    if (!conn) {
      throw new Error('No Kehrnel connection available');
    }

    const body = { path };
    if (strategyId) {
      body.strategy_id = strategyId;
    }

    const result = await this._fetch(`${conn.url}/strategies/load`, {
      method: 'POST',
      apiKey: conn.apiKey,
      body
    });

    // Invalidate strategies cache after loading a new pack
    strategiesCache.clear();

    return result;
  }

  /**
   * Validate a strategy pack before deploying
   *
   * Checks the manifest structure and returns a preview.
   *
   * @param {string} path - Absolute path to the strategy pack directory
   * @param {object} [options]
   * @returns {Promise<{valid: boolean, manifest: object, files: string[], warnings: string[]}>}
   */
  async validateStrategyPack(path, options = {}) {
    const conn = await this.resolveConnection(options);
    if (!conn) {
      throw new Error('No Kehrnel connection available');
    }

    // Try the validate endpoint first
    try {
      const result = await this._fetch(`${conn.url}/strategies/validate`, {
        method: 'POST',
        apiKey: conn.apiKey,
        body: { path }
      });
      return result;
    } catch (err) {
      // If validate endpoint doesn't exist (404), try loading with dry_run
      if (err.status === 404) {
        const result = await this._fetch(`${conn.url}/strategies/load`, {
          method: 'POST',
          apiKey: conn.apiKey,
          body: { path, dry_run: true }
        });
        return {
          valid: true,
          manifest: result.strategy || result.manifest || result,
          files: result.files || [],
          warnings: result.warnings || []
        };
      }
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Environment Operations (NEW Kehrnel API)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Activate a strategy for an environment
   *
   * Kehrnel API: POST /environments/{envKey}/activate
   * Body: { strategy_id, domain, version, config, bindings_ref }
   *
   * @param {string} environment - Environment identifier (HDL env.id or env.name)
   * @param {string} strategyId - Kehrnel strategy ID (e.g., 'openehr.rps_dual')
   * @param {object} [config] - Merged configuration (defaults + overrides)
   * @param {object} [options]
   * @param {string} [options.tenant] - Optional tenant identifier
   * @returns {Promise<{activationId: string, environment: string, strategyId: string, status: string, endpoints: object, connection: object}>}
   */
  async activateEnvironment(environment, strategyId, config = {}, options = {}) {
    const conn = await this.resolveConnection(options);
    if (!conn) {
      throw new Error('No Kehrnel connection available');
    }
    const normalizedDomain = this._normalizeDomain(options.domain);

    const body = {
      strategy_id: strategyId,
      domain: normalizedDomain,
      version: options.version || 'latest',
      config: config || {},
      bindings_ref: options.bindingsRef || `hdl:env:${environment}`
    };

    if (options.force !== undefined) {
      body.force = !!options.force;
    }
    if (options.reason) {
      body.reason = options.reason;
    }
    if (options.tenant) {
      body.tenant = options.tenant;
    }
    const activateUrl = `${conn.url}/environments/${encodeURIComponent(environment)}/activate`;
    const res = await this._fetch(activateUrl, {
      method: 'POST',
      apiKey: conn.apiKey,
      requestId: options.requestId,
      body
    });
    const activation = (res && typeof res.activation === 'object') ? res.activation : res;

    this._invalidateEndpointCache(environment, normalizedDomain || undefined);

    return {
      activationId: activation?.activation_id || activation?.activationId || res?.activation_id || res?.activationId,
      environment,
      strategyId,
      domain: this._normalizeDomain(activation?.domain || res?.domain || normalizedDomain || null),
      strategyVersion: activation?.strategy_version || activation?.strategyVersion || res?.strategy_version || res?.strategyVersion || null,
      configHash: activation?.config_hash || activation?.configHash || res?.config_hash || res?.configHash || null,
      manifestDigest: activation?.manifest_digest || activation?.manifestDigest || res?.manifest_digest || res?.manifestDigest || null,
      activatedAt: activation?.activated_at || activation?.activatedAt || res?.activated_at || res?.activatedAt || null,
      replaced: !!(activation?.replaced ?? res?.replaced),
      previousActivationId: activation?.previous_activation_id || activation?.previousActivationId || res?.previous_activation_id || res?.previousActivationId || null,
      alreadyActive: !!(activation?.already_active ?? activation?.alreadyActive ?? res?.already_active ?? res?.alreadyActive),
      status: activation?.status || res?.status || 'ok',
      endpoints: activation?.endpoints || res.endpoints || null,
      initialization: res?.initialization || null,
      connection: {
        url: conn.url,
        name: conn.name,
        connectionId: conn.connectionId
      }
    };
  }

  /**
   * Submit a synthetic batch generation job
   *
   * Kehrnel API: POST /environments/{envKey}/synthetic/jobs
   * Body: { domain, op: 'synthetic_generate_batch', payload }
   *
   * @param {string} envKey
   * @param {string} domain
   * @param {object} payload
   * @param {object} [options]
   * @returns {Promise<{job: object, raw: object}>}
   */
  async submitSyntheticJob(envKey, domain, payload = {}, options = {}) {
    const conn = await this.resolveConnection(options);
    if (!conn) {
      throw new Error('No Kehrnel connection available');
    }
    const normalizedDomain = this._normalizeDomain(domain);
    if (!normalizedDomain) {
      throw new Error('domain is required for synthetic jobs');
    }

    const path = `/environments/${encodeURIComponent(envKey)}/synthetic/jobs`;
    const res = await this._fetch(this._buildUrl(conn.url, path), {
      method: 'POST',
      apiKey: conn.apiKey,
      requestId: options.requestId,
      body: {
        domain: normalizedDomain,
        op: options.op || 'synthetic_generate_batch',
        payload: payload || {}
      },
      timeout: options.timeout
    });

    // Extract job from response - Kehrnel may return { job: {...} } or the job directly
    const jobData = res?.job || res;

    return {
      job: this._normalizeSyntheticJob(jobData),
      raw: res
    };
  }

  /**
   * List synthetic jobs for an environment
   *
   * Kehrnel API: GET /environments/{envKey}/synthetic/jobs
   *
   * @param {string} envKey
   * @param {object} [options]
   * @returns {Promise<{items: Array, raw: object}>}
   */
  async listSyntheticJobs(envKey, options = {}) {
    const conn = await this.resolveConnection(options);
    if (!conn) {
      throw new Error('No Kehrnel connection available');
    }

    const query = new URLSearchParams();
    const normalizedDomain = this._normalizeDomain(options.domain);
    if (normalizedDomain) query.set('domain', normalizedDomain);
    if (options.status) query.set('status', options.status);
    if (options.limit) query.set('limit', String(options.limit));
    if (options.cursor) query.set('cursor', String(options.cursor));

    const path = `/environments/${encodeURIComponent(envKey)}/synthetic/jobs${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await this._fetch(this._buildUrl(conn.url, path), {
      method: 'GET',
      apiKey: conn.apiKey,
      requestId: options.requestId,
      timeout: options.timeout
    });

    const rawItems = Array.isArray(res)
      ? res
      : (Array.isArray(res?.items) ? res.items : (Array.isArray(res?.jobs) ? res.jobs : []));

    return {
      items: rawItems.map((item) => this._normalizeSyntheticJob(item)),
      raw: res
    };
  }

  /**
   * Get synthetic job status by ID
   *
   * Kehrnel API: GET /environments/{envKey}/synthetic/jobs/{jobId}
   *
   * @param {string} envKey
   * @param {string} jobId
   * @param {object} [options]
   * @returns {Promise<{job: object, raw: object}>}
   */
  async getSyntheticJob(envKey, jobId, options = {}) {
    if (!jobId) throw new Error('jobId is required');

    const conn = await this.resolveConnection(options);
    if (!conn) {
      throw new Error('No Kehrnel connection available');
    }

    const path = `/environments/${encodeURIComponent(envKey)}/synthetic/jobs/${encodeURIComponent(jobId)}`;
    const res = await this._fetch(this._buildUrl(conn.url, path), {
      method: 'GET',
      apiKey: conn.apiKey,
      requestId: options.requestId,
      timeout: options.timeout
    });

    // Extract job from response - Kehrnel may return { job: {...} } or the job directly
    const jobData = res?.job || res;

    return {
      job: this._normalizeSyntheticJob(jobData),
      raw: res
    };
  }

  /**
   * Cancel synthetic job
   *
   * Kehrnel API: POST /environments/{envKey}/synthetic/jobs/{jobId}/cancel
   *
   * @param {string} envKey
   * @param {string} jobId
   * @param {object} [options]
   * @returns {Promise<{job: object, raw: object}>}
   */
  async cancelSyntheticJob(envKey, jobId, options = {}) {
    if (!jobId) throw new Error('jobId is required');

    const conn = await this.resolveConnection(options);
    if (!conn) {
      throw new Error('No Kehrnel connection available');
    }

    const path = `/environments/${encodeURIComponent(envKey)}/synthetic/jobs/${encodeURIComponent(jobId)}/cancel`;
    const res = await this._fetch(this._buildUrl(conn.url, path), {
      method: 'POST',
      apiKey: conn.apiKey,
      requestId: options.requestId,
      timeout: options.timeout
    });

    return {
      job: this._normalizeSyntheticJob(res),
      raw: res
    };
  }

  /**
   * Compile an AQL query for debugging/preview
   *
   * @param {string} envKey - Environment identifier
   * @param {string} aql - AQL query string
   * @param {object} [options]
   * @param {boolean} [options.debug=true] - Include debug info
   * @returns {Promise<{pipeline: Array, explain?: object}>}
   */
  async compileQuery(envKey, aql, options = {}) {
    if (!options.domain) {
      throw new Error('domain is required for compile');
    }
    const normalizedDomain = this._normalizeDomain(options.domain) || options.domain;
    const attempt = async () => {
      const conn = await this.resolveConnection(options);
      if (!conn) {
        throw new Error('No Kehrnel connection available');
      }

      const endpoints = await this.resolveEndpoints(envKey, { ...options, connectionId: conn.connectionId });
      const compileEp = this._pickEndpoint(endpoints, 'compile');
      if (!compileEp?.url) {
        throw new Error('Compile endpoint not available from Kehrnel');
      }

      let compileUrl = compileEp.url;
      if (options.debug) {
        try {
          const u = new URL(compileUrl);
          u.searchParams.set('debug', 'true');
          compileUrl = u.toString();
        } catch (_) {
          // ignore: URL may not be absolute; debug is best-effort
        }
      }

      const runtimePayload = {
        aql,
        ...(options.queryOptions || {})
      };

      const raw = await this._fetchRuntimePayload(compileUrl, {
        method: compileEp.method || 'POST',
        apiKey: conn.apiKey,
        requestId: options.requestId,
        headers: this._buildRuntimeHeaders(envKey, normalizedDomain),
        body: runtimePayload,
        timeout: options.timeout
      }, {
        envKey,
        domain: normalizedDomain,
        payload: runtimePayload
      });

      const result = raw && raw.ok === true && raw.result ? raw.result : raw;

      const plan = result?.plan || result?.result?.plan || result?.plan?.plan || null;
      const pipeline =
        result?.pipeline ||
        result?.plan?.pipeline ||
        result?.plan?.plan?.pipeline ||
        plan?.pipeline ||
        plan?.plan?.pipeline ||
        null;
      const explain =
        result?.explain ||
        result?.plan?.explain ||
        result?.plan?.plan?.explain ||
        plan?.explain ||
        plan?.plan?.explain ||
        null;

      return {
        engine: result?.engine || result?.plan?.engine || null,
        pipeline,
        explain,
        raw,
        _meta: {
          envKey,
          runtimeUrl: conn.url,
          connectionId: conn.connectionId
        }
      };
    };

    return this._retryWithRecovery(envKey, normalizedDomain, options, attempt);
  }

  /**
   * Execute an AQL query
   *
   * @param {string} envKey - Environment identifier
   * @param {string} aql - AQL query string
   * @param {object} [options]
   * @param {object} [options.queryOptions] - Additional query parameters
   * @returns {Promise<object>}
   */
  async query(envKey, aql, options = {}) {
    if (!options.domain) {
      throw new Error('domain is required for query');
    }
    const normalizedDomain = this._normalizeDomain(options.domain) || options.domain;
    const attempt = async () => {
      const conn = await this.resolveConnection(options);
      if (!conn) {
        throw new Error('No Kehrnel connection available');
      }

      const endpoints = await this.resolveEndpoints(envKey, { ...options, connectionId: conn.connectionId });
      const queryEp = this._pickEndpoint(endpoints, 'query');
      if (!queryEp?.url) {
        throw new Error('Query endpoint not available from Kehrnel');
      }

      const runtimePayload = {
        aql,
        ...(options.queryOptions || {})
      };

      const raw = await this._fetchRuntimePayload(queryEp.url, {
        method: queryEp.method || 'POST',
        apiKey: conn.apiKey,
        requestId: options.requestId,
        headers: this._buildRuntimeHeaders(envKey, normalizedDomain),
        body: runtimePayload,
        timeout: options.timeout
      }, {
        envKey,
        domain: normalizedDomain,
        payload: runtimePayload
      });

      const result = raw && raw.ok === true && raw.result ? raw.result : raw;

      return {
        ...result,
        raw,
        _meta: {
          envKey,
          runtimeUrl: conn.url,
          connectionId: conn.connectionId
        }
      };
    };

    return this._retryWithRecovery(envKey, normalizedDomain, options, attempt);
  }

  /**
   * Fetch published endpoints for an environment
   * @param {string} envKey
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async getEndpoints(envKey, options = {}) {
    const conn = await this.resolveConnection(options);
    if (!conn) {
      throw new Error('No Kehrnel connection available');
    }

    const domain = options.domain;
    const cacheKey = this._endpointCacheKey(envKey, { ...options, connectionId: conn.connectionId, connectionUrl: conn.url });
    const cached = this._getCache(endpointsCache, cacheKey);
    if (cached) {
      return {
        endpoints: cached,
        _meta: {
          envKey,
          domain: domain || null,
          runtimeUrl: conn.url,
          connectionId: conn.connectionId,
          cache: 'hit'
        }
      };
    }

    const url = `${conn.url}/environments/${envKey}/endpoints${domain ? `?domain=${encodeURIComponent(domain)}` : ''}`;
    const result = await this._fetch(url, {
      method: 'GET',
      apiKey: conn.apiKey,
      requestId: options.requestId
    });

    const endpoints = result.endpoints || result;
    this._validateEndpoints(endpoints);
    this._setCache(endpointsCache, cacheKey, endpoints, ENDPOINTS_TTL_MS);

    return {
      endpoints,
      _meta: {
        envKey,
        domain: domain || null,
        runtimeUrl: conn.url,
        connectionId: conn.connectionId
      }
    };
  }

  /**
   * Resolve endpoints (via Kehrnel response) for downstream routing
   */
  async resolveEndpoints(envKey, options = {}) {
    const endpointsResult = await this.getEndpoints(envKey, options);
    const endpoints = endpointsResult.endpoints || endpointsResult;
    this._validateEndpoints(endpoints);
    return endpoints;
  }

  /**
   * Run a strategy-specific operation (op)
   *
   * @param {string} envKey - Environment identifier
   * @param {string} strategyId - Kehrnel strategy ID
   * @param {string} opName - Operation name from manifest.ops
   * @param {object} [payload] - Operation input
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async runOp(envKey, strategyId, opName, payload = {}, options = {}) {
    if (!options.domain) {
      throw new Error('domain is required for ops');
    }
    const normalizedDomain = this._normalizeDomain(options.domain) || options.domain;
    const attempt = async () => this._executeRuntimeOp(
      envKey,
      strategyId,
      opName,
      payload,
      { ...options, domain: normalizedDomain }
    );

    return this._retryWithRecovery(envKey, normalizedDomain, options, attempt);
  }

  /**
   * List activations for an environment
   */
  async listActivations(envKey, options = {}) {
    const conn = await this.resolveConnection(options);
    if (!conn) throw new Error('No Kehrnel connection available');

    const res = await this._fetch(`${conn.url}/environments/${envKey}/activations`, {
      method: 'GET',
      apiKey: conn.apiKey,
      timeout: options.timeout,
      requestId: options.requestId
    });
    return this._normalizeActivationsResponse(res);
  }

  /**
   * Upgrade activation for a domain
   */
  async upgradeActivation(envKey, domain, options = {}) {
    if (!domain) throw new Error('domain is required for upgrade');
    const conn = await this.resolveConnection(options);
    if (!conn) throw new Error('No Kehrnel connection available');

    const res = await this._fetch(`${conn.url}/environments/${envKey}/activations/${domain}/upgrade`, {
      method: 'POST',
      apiKey: conn.apiKey,
      body: { reason: options.reason || undefined },
      timeout: options.timeout,
      requestId: options.requestId
    });
    this._invalidateEndpointCache(envKey, domain);
    return res;
  }

  /**
   * Rollback activation for a domain
   */
  async rollbackActivation(envKey, domain, options = {}) {
    if (!domain) throw new Error('domain is required for rollback');
    const conn = await this.resolveConnection(options);
    if (!conn) throw new Error('No Kehrnel connection available');

    const res = await this._fetch(`${conn.url}/environments/${envKey}/activations/${domain}/rollback`, {
      method: 'POST',
      apiKey: conn.apiKey,
      body: { reason: options.reason || undefined },
      timeout: options.timeout,
      requestId: options.requestId
    });
    this._invalidateEndpointCache(envKey, domain);
    return res;
  }

  /**
   * Delete activation for a domain
   */
  async deleteActivation(envKey, domain, options = {}) {
    if (!domain) throw new Error('domain is required for delete');
    const conn = await this.resolveConnection(options);
    if (!conn) throw new Error('No Kehrnel connection available');

    const res = await this._fetch(`${conn.url}/environments/${envKey}/activations/${domain}`, {
      method: 'DELETE',
      apiKey: conn.apiKey,
      timeout: options.timeout,
      requestId: options.requestId
    });
    this._invalidateEndpointCache(envKey, domain);
    return res;
  }

  /**
   * HDL-KHR-017: Sync all activation metadata from Kehrnel
   * Refreshes the environment's strategyLinks with the latest state from Kehrnel
   *
   * @param {string} envKey - Environment ID
   * @param {object} [options]
   * @returns {Promise<{success: boolean, domainsUpdated: string[], environment: object}>}
   */
  async syncActivations(envKey, options = {}) {
    const conn = await this.resolveConnection(options);
    if (!conn) throw new Error('No Kehrnel connection available');

    // 1. List all activations from Kehrnel
    let kehrnelActivations = [];
    try {
      const activationsRes = await this._fetch(`${conn.url}/environments/${envKey}/activations`, {
        method: 'GET',
        apiKey: conn.apiKey,
        timeout: options.timeout,
        requestId: options.requestId
      });
      const normalized = this._normalizeActivationsResponse(activationsRes);
      kehrnelActivations = normalized.activations || [];
    } catch (err) {
      // Environment may not exist in Kehrnel yet - that's OK
      if (err.status !== 404) {
        console.warn('Failed to fetch activations from Kehrnel:', err.message);
      }
    }

    // 2. Get the environment from DB
    const env = await this.db.collection('environments').findOne({
      $or: [
        { _id: envKey },
        { _id: this._toObjectId(envKey) }
      ]
    });
    if (!env) {
      throw Object.assign(new Error('Environment not found'), { status: 404 });
    }

    // 3. Update strategyLinks with fresh Kehrnel data
    const domainsUpdated = [];
    const updatedLinks = [...(env.strategyLinks || [])];

    for (const activation of kehrnelActivations) {
      const domain = activation.domain;
      if (!domain) continue;

      // Find existing link or create new one
      let linkIndex = updatedLinks.findIndex(l => l.domain === domain);
      if (linkIndex === -1) {
        linkIndex = updatedLinks.length;
        updatedLinks.push({ domain });
      }

      // Fetch endpoints for this domain
      let endpoints = null;
      try {
        const endpointsRes = await this._fetch(`${conn.url}/environments/${envKey}/endpoints?domain=${domain}`, {
          method: 'GET',
          apiKey: conn.apiKey,
          timeout: options.timeout
        });
        endpoints = endpointsRes.endpoints || endpointsRes || null;
        this._invalidateEndpointCache(envKey, domain);
      } catch (err) {
        // OK if endpoints not available
      }

      // Update the link with fresh metadata
      updatedLinks[linkIndex] = {
        ...updatedLinks[linkIndex],
        domain,
        strategyId: activation.strategy_id || activation.strategyId,
        strategyName: activation.strategy_name || activation.name || activation.strategy_id,
        kehrnel: {
          strategyId: activation.strategy_id || activation.strategyId,
          activationId: activation.activation_id || activation.id,
          manifestDigest: activation.manifest_digest || activation.manifestDigest,
          configHash: activation.config_hash || activation.configHash,
          activatedAt: activation.activated_at || activation.activatedAt || new Date().toISOString(),
          endpoints: endpoints,
          syncedAt: new Date().toISOString()
        }
      };
      domainsUpdated.push(domain);
    }

    // 4. Update environment in DB
    await this.db.collection('environments').updateOne(
      { _id: env._id },
      { $set: { strategyLinks: updatedLinks, updatedAt: new Date() } }
    );

    // 5. Return updated environment
    const updatedEnv = await this.db.collection('environments').findOne({ _id: env._id });

    return {
      success: true,
      domainsUpdated,
      environment: updatedEnv
    };
  }

  _toObjectId(id) {
    try {
      return new ObjectId(id);
    } catch {
      return id;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Legacy Transform Operations (preserved for backward compatibility)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Transform a composition using a strategy
   *
   * @param {string} strategyId - Strategy ID
   * @param {object} composition - Composition data
   * @param {object} config - Strategy configuration
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async transform(strategyId, composition, config, options = {}) {
    const conn = await this.resolveConnection(options);
    if (!conn) {
      throw new Error('No Kehrnel connection available');
    }

    return this._fetch(`${conn.url}/strategies/${strategyId}/transform`, {
      method: 'POST',
      apiKey: conn.apiKey,
      body: { composition, config }
    });
  }

  /**
   * Ingest a composition using a strategy
   *
   * @param {string} strategyId - Strategy ID
   * @param {object} composition - Composition data
   * @param {object} config - Strategy configuration
   * @param {object} [options]
   * @returns {Promise<object>}
   */
  async ingest(strategyId, composition, config, options = {}) {
    const conn = await this.resolveConnection(options);
    if (!conn) {
      throw new Error('No Kehrnel connection available');
    }

    return this._fetch(`${conn.url}/strategies/${strategyId}/ingest`, {
      method: 'POST',
      apiKey: conn.apiKey,
      body: { composition, config }
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════════════════════════════

  _normalizeEndpointDescriptor(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') {
      return { url: entry, method: 'POST' };
    }
    if (typeof entry !== 'object') return null;
    const url = entry.url || entry.href || entry.uri;
    if (!url) return null;
    return {
      url,
      method: (entry.method || entry.http_method || entry.httpMethod || 'POST').toUpperCase(),
      name: entry.name || entry.kind || entry.type || entry.key || null,
      params: entry.params || entry.required_params || entry.requiredParams || entry.query || {}
    };
  }

  _pickEndpoint(endpoints, kind) {
    const candidates = [];
    const pushCandidate = (val, keyHint) => {
      const norm = this._normalizeEndpointDescriptor(val);
      if (norm) {
        norm.key = keyHint || norm.name;
        candidates.push(norm);
      }
    };

    if (Array.isArray(endpoints)) {
      endpoints.forEach(ep => pushCandidate(ep, ep?.key || ep?.name || ep?.kind));
    } else if (endpoints && typeof endpoints === 'object') {
      Object.entries(endpoints).forEach(([key, val]) => pushCandidate(val, key));
    }

    const aliases = this._getEndpointAliases();
    const keys = aliases[kind] || [];

    const exact = candidates.find(c => {
      const name = (c.name || c.key || '').toString().toLowerCase();
      return keys.some(k => name === k);
    });
    if (exact) return exact;

    const partial = candidates.find(c => {
      const name = (c.name || c.key || '').toString().toLowerCase();
      return keys.some(k => name.includes(k));
    });

    return partial || candidates[0] || null;
  }

  _getEndpointAliases() {
    return {
      compile: ['compile', 'compile_query', 'compile-query', 'aql_compile'],
      query: ['query', 'aql_query', 'execute'],
      ops: ['ops', 'operations', 'extensions', 'opsbase', 'ops_base'],
      activate: ['activate', 'activation', 'strategies_activate'],
      activations: ['activations', 'activation_list', 'list_activations', 'list-activations']
    };
  }

  _collectEndpointKinds(endpoints) {
    const kinds = new Set();
    const add = (norm) => {
      if (!norm) return;
      const key = (norm.name || norm.key || '').toString().toLowerCase();
      if (key) kinds.add(key);
    };
    if (Array.isArray(endpoints)) {
      endpoints.forEach(ep => add(this._normalizeEndpointDescriptor(ep)));
    } else if (endpoints && typeof endpoints === 'object') {
      Object.entries(endpoints).forEach(([key, val]) => {
        const norm = this._normalizeEndpointDescriptor(val) || {};
        norm.key = norm.key || key;
        add(norm);
      });
    }
    return Array.from(kinds);
  }

  _validateEndpoints(endpoints) {
    const required = ['compile_query', 'query', 'ops', 'activations'];
    const receivedKinds = this._collectEndpointKinds(endpoints);
    const missingKinds = required.filter((kind) => !this._hasEndpointKind(endpoints, kind));
    if (missingKinds.length > 0) {
      const error = new Error('Kehrnel endpoints response missing required descriptors');
      error.code = 'KEHRNEL_ENDPOINTS_INVALID';
      error.details = {
        missingKinds,
        receivedKinds
      };
      throw error;
    }
    return true;
  }

  _hasEndpointKind(endpoints, kind) {
    const aliases = this._getEndpointAliases();
    const keys = aliases[kind] || [kind];
    const matches = (name) => {
      const lower = (name || '').toString().toLowerCase();
      return keys.some(k => lower === k || lower.includes(k));
    };

    if (Array.isArray(endpoints)) {
      return endpoints.some(ep => {
        const norm = this._normalizeEndpointDescriptor(ep);
        if (!norm) return false;
        return matches(norm.name || norm.key);
      });
    }

    if (endpoints && typeof endpoints === 'object') {
      return Object.entries(endpoints).some(([key, val]) => {
        const norm = this._normalizeEndpointDescriptor(val) || {};
        const name = norm.name || norm.key || key;
        return matches(name);
      });
    }

    return false;
  }

  _endpointCacheKey(envKey, options) {
    const domain = options.domain || '*';
    const connKey = options.connectionId || options.connectionUrl || 'default';
    return `${envKey}|${domain}|${connKey}`;
  }

  _getCache(map, key) {
    const entry = map.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      map.delete(key);
      return null;
    }
    return entry.data;
  }

  _setCache(map, key, data, ttlMs) {
    map.set(key, {
      data,
      expiresAt: ttlMs ? Date.now() + ttlMs : null
    });
  }

  _invalidateEndpointCache(envKey, domain) {
    for (const key of Array.from(endpointsCache.keys())) {
      if (key.startsWith(`${envKey}|`)) {
        if (!domain || key.includes(`|${domain}|`) || key.endsWith(`|${domain}`)) {
          endpointsCache.delete(key);
        }
      }
    }
  }

  async ensureRuntimeReady(envKey, options = {}) {
    const normalizedDomain = this._normalizeDomain(options?.domain);
    if (!normalizedDomain) {
      throw new Error('domain is required for runtime preparation');
    }

    const activated = await this._ensureDesiredActivation(envKey, normalizedDomain, options);
    let dictionariesEnsured = false;

    if (!options?.skipDictionaryEnsure) {
      dictionariesEnsured = await this._ensureRequiredDictionaries(envKey, normalizedDomain, options);
    }

    return {
      envKey,
      domain: normalizedDomain,
      activated,
      dictionariesEnsured
    };
  }

  async _retryWithRecovery(envKey, domain, options, operation) {
    await this.ensureRuntimeReady(envKey, { ...options, domain });

    let triedUpgrade = false;
    let triedAutoActivate = false;

    while (true) {
      try {
        return await operation();
      } catch (err) {
        if (!triedAutoActivate && this._isActivationMissingError(err)) {
          triedAutoActivate = true;
          try {
            const activated = await this._autoActivateFromOptions(envKey, domain, options);
            if (activated) {
              try {
                await this.resolveEndpoints(envKey, options);
              } catch (_) {
                // Endpoints cache refresh is best effort; runtime call will retry anyway.
              }
              continue;
            }
          } catch (recoveryError) {
            throw this._buildRecoveryFailureError('autoActivate', err, recoveryError);
          }
        }

        if (!triedUpgrade && err?.status === 409) {
          triedUpgrade = true;
          try {
            await this.upgradeActivation(envKey, domain, { ...options, reason: 'auto-upgrade-on-409' });
            await this.resolveEndpoints(envKey, options);
            continue;
          } catch (recoveryError) {
            throw this._buildRecoveryFailureError('upgradeActivation', err, recoveryError);
          }
        }

        throw err;
      }
    }
  }

  _buildRecoveryFailureError(recoveryStep, originalError, recoveryError) {
    if (!recoveryError) {
      return originalError;
    }

    const error = recoveryError instanceof Error
      ? recoveryError
      : new Error(String(recoveryError || originalError?.message || 'Runtime recovery failed'));

    error.details = {
      ...(error.details && typeof error.details === 'object' ? error.details : {}),
      recoveryStep,
      originalError: {
        code: originalError?.code || null,
        message: originalError?.message || null,
        status: originalError?.status || null,
        details: originalError?.details || null
      }
    };

    if (!error.cause && originalError) {
      error.cause = originalError;
    }

    return error;
  }

  async _executeRuntimeOp(envKey, strategyId, opName, payload = {}, options = {}) {
    if (!options.domain) {
      throw new Error('domain is required for ops');
    }
    const normalizedDomain = this._normalizeDomain(options.domain) || options.domain;
    const conn = await this.resolveConnection(options);
    if (!conn) {
      throw new Error('No Kehrnel connection available');
    }

    const endpoints = await this.resolveEndpoints(envKey, { ...options, connectionId: conn.connectionId });
    const opEp = this._pickEndpoint(endpoints, 'ops');
    if (!opEp?.url) {
      throw new Error('Operations endpoint not available from Kehrnel');
    }

    let baseUrl = String(opEp.url || '').replace(/\/$/, '');
    if (baseUrl.includes('{env_id}')) {
      baseUrl = baseUrl.replace('{env_id}', encodeURIComponent(envKey));
    }
    if (baseUrl.includes('{domain}')) {
      baseUrl = baseUrl.replace('{domain}', encodeURIComponent(normalizedDomain));
    }
    if (baseUrl.includes('{strategy_id}')) {
      baseUrl = baseUrl.replace('{strategy_id}', encodeURIComponent(strategyId));
    }
    const url = baseUrl.includes('{op}')
      ? baseUrl.replace('{op}', encodeURIComponent(opName))
      : `${baseUrl}/${encodeURIComponent(opName)}`;

    const opPayload = payload && typeof payload === 'object' ? payload : {};
    const result = await this._fetchRuntimePayload(url, {
      method: opEp.method || 'POST',
      apiKey: conn.apiKey,
      requestId: options.requestId,
      headers: this._buildRuntimeHeaders(envKey, normalizedDomain),
      body: opPayload,
      timeout: options.timeout
    }, {
      envKey,
      domain: normalizedDomain,
      payload: opPayload
    });

    return {
      ...result,
      _meta: {
        envKey,
        strategyId,
        opName,
        runtimeUrl: conn.url,
        connectionId: conn.connectionId
      }
    };
  }

  async _ensureDesiredActivation(envKey, domain, options = {}) {
    const auto = options?.autoActivate || {};
    const strategyId = auto.strategyId || options?.strategyId || null;
    const normalizedDomain = this._normalizeDomain(domain || auto.domain || options?.domain);
    const expectedConfigHash = auto.configHash || null;
    const expectedManifestDigest = auto.manifestDigest || null;
    const configSignature =
      auto.configSignature ||
      this._stableSerialize(auto.config || options?.config || {});
    const ensuredCacheKey = `${envKey}|${normalizedDomain}|${strategyId}|${expectedConfigHash || '-'}|${expectedManifestDigest || '-'}|${configSignature}`;

    if (!strategyId || !normalizedDomain) {
      return false;
    }

    if (this._getCache(ensuredActivationsCache, ensuredCacheKey)) {
      return false;
    }

    let currentActivation = null;
    try {
      const activationsResult = await this.listActivations(envKey, options);
      const activations = Array.isArray(activationsResult?.activations)
        ? activationsResult.activations
        : (Array.isArray(activationsResult) ? activationsResult : []);

      currentActivation = activations.find(
        (activation) => this._normalizeDomain(activation?.domain) === normalizedDomain
      ) || null;
    } catch (err) {
      if (err?.status === 404 || this._isActivationMissingError(err)) {
        currentActivation = null;
      } else {
        console.warn(
          `Activation preflight check failed for ${envKey}/${normalizedDomain}; continuing with runtime call:`,
          err?.message || err
        );
        return false;
      }
    }

    const activeStrategyId =
      currentActivation?.strategy_id ||
      currentActivation?.strategyId ||
      null;
    const activeConfigHash =
      currentActivation?.config_hash ||
      currentActivation?.configHash ||
      null;
    const activeManifestDigest =
      currentActivation?.manifest_digest ||
      currentActivation?.manifestDigest ||
      null;

    const needsActivation =
      auto.requiresRefresh === true ||
      !currentActivation ||
      activeStrategyId !== strategyId ||
      (!!expectedConfigHash && !!activeConfigHash && activeConfigHash !== expectedConfigHash) ||
      (!!expectedManifestDigest && !!activeManifestDigest && activeManifestDigest !== expectedManifestDigest);

    if (!needsActivation) {
      this._setCache(ensuredActivationsCache, ensuredCacheKey, true, ENSURED_ACTIVATION_TTL_MS);
      return false;
    }

    await this.activateEnvironment(envKey, strategyId, auto.config || options?.config || {}, {
      ...options,
      domain: normalizedDomain,
      reason:
        auto.reason ||
        (!currentActivation
          ? 'auto-activate-before-runtime'
          : activeStrategyId !== strategyId
            ? 'switch-strategy-before-runtime'
            : 'refresh-activation-before-runtime'),
      force: auto.force ?? !!currentActivation
    });

    this._invalidateEndpointCache(envKey, normalizedDomain);
    this._setCache(ensuredActivationsCache, ensuredCacheKey, true, ENSURED_ACTIVATION_TTL_MS);
    return true;
  }

  async _ensureRequiredDictionaries(envKey, domain, options = {}) {
    const auto = options?.autoActivate || {};
    const strategyId = auto.strategyId || options?.strategyId || null;
    const normalizedDomain = this._normalizeDomain(domain || auto.domain || options?.domain);
    const config = auto.config || options?.config || {};

    if (!strategyId || !normalizedDomain || !this._configUsesDictionaries(config)) {
      return false;
    }

    const configSignature =
      auto.configSignature ||
      this._stableSerialize(config);
    const cacheKey = `${envKey}|${normalizedDomain}|${strategyId}|${configSignature}`;
    if (this._getCache(ensuredDictionariesCache, cacheKey)) {
      return false;
    }

    let triedUpgrade = false;
    let triedAutoActivate = false;

    while (true) {
      try {
        await this._executeRuntimeOp(
          envKey,
          strategyId,
          'ensure_dictionaries',
          {},
          { ...options, domain: normalizedDomain }
        );
        this._setCache(ensuredDictionariesCache, cacheKey, true, ENSURED_DICTIONARIES_TTL_MS);
        return true;
      } catch (err) {
        if (this._isMissingOptionalOpError(err, 'ensure_dictionaries')) {
          return false;
        }

        if (!triedAutoActivate && this._isActivationMissingError(err)) {
          triedAutoActivate = true;
          try {
            const activated = await this._autoActivateFromOptions(envKey, normalizedDomain, {
              ...options,
              domain: normalizedDomain
            });
            if (activated) {
              try {
                await this.resolveEndpoints(envKey, { ...options, domain: normalizedDomain });
              } catch (_) {
                // Endpoints cache refresh is best effort; the op will retry anyway.
              }
              continue;
            }
          } catch (recoveryError) {
            throw this._buildRecoveryFailureError('autoActivate', err, recoveryError);
          }
        }

        if (!triedUpgrade && err?.status === 409) {
          triedUpgrade = true;
          try {
            await this.upgradeActivation(envKey, normalizedDomain, {
              ...options,
              domain: normalizedDomain,
              reason: 'auto-upgrade-before-ensure-dictionaries'
            });
            await this.resolveEndpoints(envKey, { ...options, domain: normalizedDomain });
            continue;
          } catch (recoveryError) {
            throw this._buildRecoveryFailureError('upgradeActivation', err, recoveryError);
          }
        }

        throw err;
      }
    }
  }

  _isActivationMissingError(err) {
    const code = (err?.code || '').toString().toUpperCase();
    if (code === 'ACTIVATION_NOT_FOUND') return true;
    if (err?.status === 404 && /activation/i.test(err?.message || '')) return true;
    if (err?.status === 400 && code === 'ACTIVATION_MISSING') return true;
    return false;
  }

  _isMissingOptionalOpError(err, opName) {
    const code = (err?.code || '').toString().toUpperCase();
    if ([
      'OP_NOT_FOUND',
      'OPERATION_NOT_FOUND',
      'ENDPOINT_NOT_FOUND',
      'NOT_FOUND',
      'UNKNOWN_OPERATION',
      'OP_UNSUPPORTED',
      'UNSUPPORTED_OPERATION'
    ].includes(code)) {
      return true;
    }
    if (err?.status === 404) {
      return true;
    }
    if (err?.status === 400 && opName) {
      const message = (err?.message || '').toString().toLowerCase();
      const normalizedOp = opName.toLowerCase();
      if (
        message.includes(normalizedOp) &&
        (
          message.includes('not found') ||
          message.includes('unknown') ||
          message.includes('unsupported') ||
          message.includes('not registered') ||
          message.includes('no such op')
        )
      ) {
        return true;
      }
    }
    return false;
  }

  _shouldRetryWithLegacyRuntimeEnvelope(err) {
    const code = (err?.code || '').toString().toUpperCase();
    if (code === 'DOMAIN_REQUIRED' || code === 'MISSING_FIELDS') {
      return true;
    }

    const message = (err?.message || '').toString().toLowerCase();
    const schemaError = (err?.details?.schema_error || '').toString().toLowerCase();
    const combined = `${message} ${schemaError}`;

    return (
      combined.includes('domain missing') ||
      combined.includes('domain is required') ||
      combined.includes('environment is required') ||
      combined.includes('environment, strategy_id, domain required')
    );
  }

  _withLegacyRuntimeEnvelope(payload = {}, envKey, domain) {
    const safePayload = (payload && typeof payload === 'object') ? payload : {};
    return {
      ...safePayload,
      ...(safePayload.environment === undefined ? { environment: envKey } : {}),
      ...(safePayload.domain === undefined ? { domain } : {})
    };
  }

  async _fetchRuntimePayload(url, requestOptions = {}, runtimeContext = {}) {
    try {
      return await this._fetch(url, requestOptions);
    } catch (err) {
      if (!this._shouldRetryWithLegacyRuntimeEnvelope(err)) {
        throw err;
      }

      return this._fetch(url, {
        ...requestOptions,
        body: this._withLegacyRuntimeEnvelope(
          requestOptions.body,
          runtimeContext.envKey,
          runtimeContext.domain
        )
      });
    }
  }

  _configUsesDictionaries(config = {}) {
    return Boolean(
      config?.coding?.archetype_ids?.enabled ||
      config?.coding?.atcodes?.enabled ||
      config?.dictionaries?.shortcuts?.enabled ||
      config?.dictionaries?.arcodes?.enabled ||
      config?.transform?.coding?.arcodes?.strategy ||
      config?.transform?.coding?.atcodes?.strategy ||
      config?.transform?.apply_shortcuts === true ||
      config?.bootstrap?.dictionariesOnActivate?.codes ||
      config?.bootstrap?.dictionariesOnActivate?.shortcuts ||
      config?.collections?.codes?.name ||
      config?.collections?.shortcuts?.name
    );
  }

  _stableSerialize(value) {
    if (Array.isArray(value)) {
      return `[${value.map((item) => this._stableSerialize(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${this._stableSerialize(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
  }

  async _autoActivateFromOptions(envKey, domain, options) {
    const auto = options?.autoActivate || {};
    const strategyId = auto.strategyId || options?.strategyId || null;
    if (!strategyId) return false;
    const normalizedDomain = this._normalizeDomain(domain || auto.domain || options?.domain);
    if (!normalizedDomain) return false;
    const config = auto.config || options?.config || {};

    await this.activateEnvironment(envKey, strategyId, config, {
      ...options,
      domain: normalizedDomain,
      reason: auto.reason || options?.reason || 'auto-activate-on-missing-activation',
      force: auto.force ?? options?.force ?? false
    });
    return true;
  }

  _normalizeDomain(domain) {
    if (!domain || typeof domain !== 'string') return null;
    return domain.trim().toLowerCase();
  }

  _buildUrl(baseUrl, pathWithLeadingSlash) {
    const normalizedBase = (baseUrl || '').replace(/\/$/, '');
    const normalizedPath = pathWithLeadingSlash.startsWith('/') ? pathWithLeadingSlash : `/${pathWithLeadingSlash}`;
    return `${normalizedBase}${normalizedPath}`;
  }

  _buildRuntimeHeaders(envKey, domain) {
    const headers = {};

    if (envKey) {
      headers['x-active-env'] = String(envKey);
      headers['x-kehrnel-env'] = String(envKey);
    }

    if (domain) {
      headers['x-kehrnel-domain'] = String(domain);
    }

    return headers;
  }

  _extractErrorMessage(error) {
    if (!error) return null;
    if (typeof error === 'string') return error;
    if (typeof error === 'object') {
      return error.message || error.error || error.detail || JSON.stringify(error);
    }
    return String(error);
  }

  _extractErrorCode(error) {
    if (!error) return null;
    if (typeof error === 'object') {
      return error.code || error.errorCode || error.error_code || null;
    }
    return null;
  }

  _extractErrorDetails(error) {
    if (!error || typeof error !== 'object') return null;
    return error.details || error.errorDetails || null;
  }

  _normalizeSyntheticJob(job) {
    if (!job || typeof job !== 'object') {
      return {
        id: null,
        status: 'unknown',
        phase: null,
        progress: 0,
        stats: {}
      };
    }

    const stats = job.stats || {};
    const result = (job.result && typeof job.result === 'object') ? job.result : {};
    const phase = job.phase || job.stage || stats.phase || null;
    const progressCandidate =
      job.progress ??
      stats.progress ??
      job.percent ??
      job.percentage ??
      null;
    const progressNumber = Number(progressCandidate);
    const payload = job.payload || job.request?.payload || {};
    const modelSource =
      job.model_source ||
      job.modelSource ||
      result.model_source ||
      result.modelSource ||
      payload.model_source ||
      payload.modelSource ||
      null;
    const sourceDatabase =
      job.source_database ||
      job.sourceDatabase ||
      result.source_database ||
      result.sourceDatabase ||
      payload.source_database ||
      payload.sourceDatabase ||
      null;
    const sourceCollection =
      job.source_collection ||
      job.sourceCollection ||
      result.source_collection ||
      result.sourceCollection ||
      payload.source_collection ||
      payload.sourceCollection ||
      null;
    const targetDatabase =
      job.target_database ||
      job.targetDatabase ||
      result.target_database ||
      result.targetDatabase ||
      null;
    const targetCollections =
      job.target_collections ||
      job.targetCollections ||
      result.target_collections ||
      result.targetCollections ||
      result.target ||
      null;
    const planOnly =
      job.plan_only ??
      job.planOnly ??
      payload.plan_only ??
      payload.planOnly ??
      false;
    const byModel = job.by_model || job.byModel || stats.by_model || stats.byModel || null;
    const byTemplate = job.by_template || job.byTemplate || stats.by_template || stats.byTemplate || null;
    const linksApplied = job.links_applied ?? job.linksApplied ?? stats.links_applied ?? stats.linksApplied ?? null;
    const generatedDocs = job.generated_docs ?? job.generatedDocs ?? stats.generated_docs ?? stats.generatedDocs ?? null;
    const insertedBase = job.inserted_base ?? job.insertedBase ?? stats.inserted_base ?? stats.insertedBase ?? null;
    const insertedSearch = job.inserted_search ?? job.insertedSearch ?? stats.inserted_search ?? stats.insertedSearch ?? null;
    const rawError = job.error ?? stats.error ?? null;
    const errorCode =
      this._extractErrorCode(rawError) ||
      this._extractErrorCode(job.failure) ||
      this._extractErrorCode(job.last_error) ||
      null;
    const errorDetails = this._extractErrorDetails(rawError) || null;
    const errorMessage = this._extractErrorMessage(rawError);

    return {
      id: job.id || job.job_id || job.jobId || null,
      status: job.status || job.state || 'unknown',
      phase,
      progress: Number.isFinite(progressNumber) ? Math.max(0, Math.min(100, progressNumber)) : 0,
      domain: this._normalizeDomain(job.domain || job.request?.domain || null),
      op: job.op || job.operation || job.request?.op || null,
      createdAt: job.created_at || job.createdAt || null,
      startedAt: job.started_at || job.startedAt || null,
      updatedAt: job.updated_at || job.updatedAt || null,
      finishedAt: job.completed_at || job.completedAt || job.finished_at || job.finishedAt || null,
      error: errorMessage || null,
      errorCode,
      errorDetails,
      sourceDatabase,
      sourceCollection,
      targetDatabase,
      targetCollections,
      modelSource,
      planOnly: !!planOnly,
      byModel,
      byTemplate,
      linksApplied,
      generatedDocs,
      insertedBase,
      insertedSearch,
      stats: {
        patientCount: stats.patient_count ?? stats.patientCount ?? job.patient_count ?? job.patientCount ?? null,
        generatedPatients: stats.generated_patients ?? stats.generatedPatients ?? null,
        generatedDocuments: stats.generated_documents ?? stats.generatedDocuments ?? null,
        modelCount: stats.model_count ?? stats.modelCount ?? null,
        linksApplied: stats.links_applied ?? stats.linksApplied ?? null,
        etaSeconds: stats.eta_seconds ?? stats.etaSeconds ?? null,
        ...stats
      },
      payload: payload || null,
      request: job.request || null,
      result: result || null,
      // Strategy information
      strategy: job.strategy || null,
      strategyId: job.strategyId || job.strategy_id || null,
      strategyConfig: job.strategyConfig || job.strategy_config || null,
      strategyBindingId: job.strategyBindingId || job.strategy_binding_id || null,
      // Environment information
      environmentId: job.environmentId || job.environment_id || null,
      environmentName: job.environmentName || job.environment_name || null,
      environmentDatabase: job.environmentDatabase || job.environment_database || null,
      // Additional timing fields
      startTime: job.startTime || job.start_time || job.createdAt || job.created_at || null,
      completionTime: job.completionTime || job.completion_time || job.finishedAt || job.finished_at || null,
      // Patient count at top level for easier access
      patientCount: job.patientCount || job.patient_count || (stats.patient_count ?? stats.patientCount ?? null),

      templates: job.templates || null
    };
  }

  _normalizeActivationsResponse(raw) {
    if (Array.isArray(raw)) {
      return { activations: raw, activationsByDomain: null, raw };
    }
    if (!raw || typeof raw !== 'object') {
      return { activations: [], activationsByDomain: null, raw };
    }

    const activationsRaw = raw.activations;
    if (Array.isArray(activationsRaw)) {
      return { ...raw, activations: activationsRaw, activationsByDomain: null };
    }
    if (activationsRaw && typeof activationsRaw === 'object') {
      const list = Object.entries(activationsRaw).map(([domainKey, value]) => {
        if (value && typeof value === 'object') {
          return {
            domain: value.domain || domainKey,
            ...value
          };
        }
        return { domain: domainKey };
      });
      return {
        ...raw,
        activations: list,
        activationsByDomain: activationsRaw
      };
    }

    return { ...raw, activations: [], activationsByDomain: null };
  }

  /**
   * Make an authenticated fetch request to Kehrnel
   * @private
   */
  async _fetch(url, { method = 'GET', apiKey, body, timeout = DEFAULT_TIMEOUT, requestId, headers: extraHeaders } = {}) {
    const headers = new Headers(extraHeaders || {});
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (apiKey && !headers.has('x-api-key')) {
      headers.set('x-api-key', apiKey);
    }
    if (requestId) {
      headers.set('x-request-id', requestId);
      headers.set('request-id', requestId);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const text = await res.text().catch(() => '');

      const parseJsonSafe = () => {
        try {
          return text ? JSON.parse(text) : {};
        } catch {
          return {};
        }
      };

      if (!res.ok) {
        const payload = parseJsonSafe();
        const errEnvelope = payload?.error;
        const message = errEnvelope?.message || payload?.message || text || res.statusText;
        const error = new Error(message || `Kehrnel error (${res.status})`);
        error.status = res.status;
        error.code = errEnvelope?.code;
        error.details = errEnvelope?.details || payload?.details;
        if (res.status === 401 && !apiKey) {
          error.details = {
            ...(error.details || {}),
            hint: 'No API key resolved for this Kehrnel request. Configure kehrnel_instances.apiKey or KEHRNEL_API_KEY.'
          };
        }
        error.kehrnelUrl = url;
        error.method = method;
        error.responseBody = text;
        throw error;
      }

      const json = text ? parseJsonSafe() : {};
      return json;
    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        const error = new Error(`Kehrnel request timed out after ${timeout}ms`);
        error.status = 504;
        error.kehrnelUrl = url;
        throw error;
      }

      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // Agentic Configuration
  // ═══════════════════════════════════════════════════════════════

  /**
   * Get agentic configuration for a domain
   *
   * Fetches AI assistant configuration from Kehrnel for use in the
   * ContextObjects builder. Includes hints, preferred blocks, and prompts.
   *
   * @param {string} [domain='X12'] - Domain identifier
   * @param {object} [options]
   * @returns {Promise<object>} Agentic configuration
   */
  async getAgenticConfig(domain = 'X12', options = {}) {
    const conn = await this.resolveConnection(options);
    if (!conn) {
      throw new Error('No Kehrnel connection available');
    }

    try {
      const result = await this._fetch(`${conn.url}/agentic/${encodeURIComponent(domain)}`, {
        method: 'GET',
        apiKey: conn.apiKey,
        timeout: options.timeout || 10000
      });

      return {
        ...result,
        _meta: {
          source: 'kehrnel',
          domain,
          runtimeUrl: conn.url,
          connectionId: conn.connectionId
        }
      };
    } catch (err) {
      // Re-throw with context
      const error = new Error(`Failed to fetch agentic config for domain "${domain}": ${err.message}`);
      error.status = err.status;
      error.domain = domain;
      error.originalError = err;
      throw error;
    }
  }

  /**
   * List available agentic domains
   *
   * @param {object} [options]
   * @returns {Promise<{domains: string[]}>}
   */
  async listAgenticDomains(options = {}) {
    const conn = await this.resolveConnection(options);
    if (!conn) {
      throw new Error('No Kehrnel connection available');
    }

    try {
      return await this._fetch(`${conn.url}/agentic`, {
        method: 'GET',
        apiKey: conn.apiKey,
        timeout: options.timeout || 10000
      });
    } catch (err) {
      // Return empty list on error
      console.warn('Could not list agentic domains:', err.message);
      return { domains: [] };
    }
  }
}

/**
 * Factory function to create a KehrnelService instance
 *
 * @param {Db} db - MongoDB core database instance
 * @returns {KehrnelService}
 */
export function createKehrnelService(db) {
  return new KehrnelService(db);
}

export default KehrnelService;
