// Lightweight mock Kehrnel "server" that intercepts fetch without opening sockets.
const DEFAULT_BASE_URL = 'http://kehrnel.mock';

export function createMockKehrnelServer(baseUrl = DEFAULT_BASE_URL, options = {}) {
  const lowerSet = (arr = []) => new Set((arr || []).map((item) => String(item).toLowerCase()));
  const resolveRequestedDomain = (body = {}, pathname = '') => {
    const explicit = typeof body?.domain === 'string' ? body.domain.trim().toLowerCase() : '';
    if (explicit) return explicit;

    const pathMatch = String(pathname || '').match(/^\/api\/domains\/([^/]+)/i);
    if (pathMatch?.[1]) {
      return pathMatch[1].trim().toLowerCase();
    }

    const activeDomains = Object.keys(state.activations || {});
    if (activeDomains.length === 1) return activeDomains[0];

    if (state.requireActivationDomains.size === 1) {
      return Array.from(state.requireActivationDomains)[0];
    }
    if (state.requireUpgradeDomains.size === 1) {
      return Array.from(state.requireUpgradeDomains)[0];
    }

    return '';
  };

  const state = {
    activations: {},
    activationCalls: [],
    strategies: [
      { id: 'openehr.rps', name: 'RPS', domain: 'openEHR', defaults: { a: 1 }, version: '1.0.0' },
      { id: 'fhir.core', name: 'FHIR Core', domain: 'fhir', defaults: { f: true }, version: '2.0.0' }
    ],
    requireUpgradeDomains: lowerSet(options.requireUpgradeDomains || []),
    requireActivationDomains: lowerSet(options.requireActivationDomains || []),
    upgradeCalls: 0
  };

  let originalFetch = null;

  const endpointsFor = (env) => ({
    query: { url: `${baseUrl}/query`, method: 'POST', name: 'query' },
    compile: { url: `${baseUrl}/compile_query`, method: 'POST', name: 'compile_query' },
    ops: { url: `${baseUrl}/extensions/${env}`, method: 'POST', name: 'extensions' },
    activations: { url: `${baseUrl}/environments/${env}/activations`, method: 'GET', name: 'activations' }
  });

  const send = (status, payload) => new Response(
    JSON.stringify(payload),
    { status, headers: { 'Content-Type': 'application/json' } }
  );

  const parseBody = async (input, init) => {
    let bodyRaw = init?.body;
    if (!bodyRaw && input instanceof Request) {
      bodyRaw = await input.text();
    }
    if (!bodyRaw) return {};
    try {
      return typeof bodyRaw === 'string' ? JSON.parse(bodyRaw) : JSON.parse(bodyRaw.toString());
    } catch {
      return {};
    }
  };

  const handler = async (input, init = {}) => {
    const request = input instanceof Request ? input : null;
    const urlStr = request ? request.url : input;
    const urlObj = new URL(urlStr);
    const method = (init.method || request?.method || 'GET').toUpperCase();

    // Let non-mock hosts pass through to the original fetch.
    if (urlObj.origin !== new URL(baseUrl).origin) {
      return originalFetch ? originalFetch(input, init) : fetch(input, init);
    }

    const body = await parseBody(request ?? urlStr, init);
    const pathname = urlObj.pathname;

    if (method === 'GET' && pathname === '/strategies') {
      return send(200, { manifests: state.strategies });
    }

    const strategyMatch = pathname.match(/^\/strategies\/([^/]+)$/);
    if (method === 'GET' && strategyMatch) {
      const strategyId = decodeURIComponent(strategyMatch[1]);
      const manifest = state.strategies.find((item) => item.id === strategyId);
      if (!manifest) {
        return send(404, { error: { code: 'NOT_FOUND', message: 'strategy not found', details: {} } });
      }
      return send(200, manifest);
    }

    const envActivateMatch = pathname.match(/^\/environments\/([^/]+)\/activate$/);
    if (method === 'POST' && envActivateMatch) {
      const environment = decodeURIComponent(envActivateMatch[1]);
      const { strategy_id, domain, force, reason, bindings_ref, allow_plaintext_bindings } = body || {};
      if (!environment || !strategy_id || !domain || !bindings_ref) {
        return send(400, { error: { code: 'MISSING_FIELDS', message: 'strategy_id, domain, bindings_ref required', details: {} } });
      }
      const activation = {
        activationId: `act-${Date.now()}`,
        environment,
        strategyId: strategy_id,
        domain: String(domain).toLowerCase(),
        strategyVersion: '1.2.3',
        configHash: 'sha:config',
        manifestDigest: 'sha:manifest',
        force: !!force,
        reason: reason || null,
        bindingsRef: bindings_ref,
        allowPlaintextBindings: !!allow_plaintext_bindings,
        endpoints: endpointsFor(environment)
      };
      state.activations[String(domain).toLowerCase()] = activation;
      state.activationCalls.push({
        path: pathname,
        body: body || {},
        activation
      });
      return send(200, {
        ok: true,
        activation: {
          ...activation,
          activation_id: activation.activationId,
          strategy_id: activation.strategyId,
          strategy_version: activation.strategyVersion,
          config_hash: activation.configHash,
          manifest_digest: activation.manifestDigest,
          already_active: false,
        },
        initialization: {
          artifacts: {
            ok: true,
            created: ['compositions_rps', 'compositions_search'],
            warnings: [],
            skipped: [],
          },
          dictionaries: {
            ok: true,
            ensured_collections: { codes: 1, shortcuts: 1 },
            seeded: { codes: 1, shortcuts: 1 },
            warnings: [],
          }
        }
      });
    }

    // Legacy fallback path kept for compatibility with older tests/tools
    if (method === 'POST' && pathname === '/strategies/activate') {
      const { environment, strategy_id, domain, force, reason } = body || {};
      if (!environment || !strategy_id || !domain) {
        return send(400, { error: { code: 'MISSING_FIELDS', message: 'environment, strategy_id, domain required', details: {} } });
      }
      const normalizedDomain = String(domain).toLowerCase();
      const activation = {
        activationId: `act-${Date.now()}`,
        environment,
        strategyId: strategy_id,
        domain: normalizedDomain,
        strategyVersion: '1.2.3',
        configHash: 'sha:config',
        manifestDigest: 'sha:manifest',
        force: !!force,
        reason: reason || null,
        endpoints: endpointsFor(environment)
      };
      state.activations[normalizedDomain] = activation;
      return send(200, {
        ok: true,
        activation: {
          ...activation,
          activation_id: activation.activationId,
          strategy_id: activation.strategyId,
          strategy_version: activation.strategyVersion,
          config_hash: activation.configHash,
          manifest_digest: activation.manifestDigest,
        },
        initialization: {
          artifacts: { ok: true, created: ['compositions_rps'], warnings: [], skipped: [] },
          dictionaries: null,
        }
      });
    }

    if (method === 'GET' && pathname.match(/^\/environments\/[^/]+\/endpoints/)) {
      const envId = pathname.split('/')[3];
      const domain = urlObj.searchParams.get('domain');
      const activation = domain ? state.activations[domain] : null;
      return send(200, {
        environment: envId,
        domain: domain || null,
        endpoints: endpointsFor(envId),
        activation
      });
    }

    if (method === 'GET' && pathname.match(/^\/environments\/[^/]+\/activations$/)) {
      return send(200, {
        activations: Object.values(state.activations).map((activation) => ({
          ...activation,
          activation_id: activation.activationId
        }))
      });
    }

    if (method === 'POST' && pathname.includes('/activations/') && pathname.endsWith('/upgrade')) {
      state.upgradeCalls += 1;
      const domain = String(pathname.split('/')[5] || '').toLowerCase();
      if (domain) {
        state.requireUpgradeDomains.delete(domain);
      }
      return send(200, { upgraded: true, activation_id: `act-${Date.now()}` });
    }

    if (method === 'POST' && pathname.includes('/activations/') && pathname.endsWith('/rollback')) {
      return send(200, { rolled_back: true });
    }

    if (method === 'DELETE' && pathname.includes('/activations/')) {
      const domain = pathname.split('/')[5];
      if (domain && state.activations[domain]) {
        delete state.activations[domain];
      }
      return send(200, { deleted: true });
    }

    if (method === 'GET' && pathname === '/api/domains/openehr/ehr') {
      const requestedDomain = resolveRequestedDomain(body, pathname);
      const activeEnv = request?.headers?.get('x-active-env') || '';
      if (state.requireActivationDomains.has(requestedDomain) && !state.activations[requestedDomain]) {
        return send(404, {
          error: {
            code: 'ACTIVATION_NOT_FOUND',
            message: `No activation found for env_id=${activeEnv} and domain=${requestedDomain}.`,
            details: {}
          }
        });
      }
      return send(200, []);
    }

    if (method === 'POST' && pathname === '/compile_query') {
      const requestedDomain = resolveRequestedDomain(body, pathname);
      if (state.requireActivationDomains.has(requestedDomain) && !state.activations[requestedDomain]) {
        return send(404, { error: { code: 'ACTIVATION_NOT_FOUND', message: 'activation missing', details: {} } });
      }
      if (state.requireUpgradeDomains.has(requestedDomain)) {
        return send(409, { error: { code: 'ACTIVATION_STRATEGY_MISMATCH', message: 'needs upgrade', details: {} } });
      }
      if (!requestedDomain) return send(400, { error: { code: 'DOMAIN_REQUIRED', message: 'domain missing', details: {} } });
      return send(200, { pipeline: [{ $match: {} }], domain: requestedDomain });
    }

    if (method === 'POST' && pathname === '/query') {
      const requestedDomain = resolveRequestedDomain(body, pathname);
      if (state.requireActivationDomains.has(requestedDomain) && !state.activations[requestedDomain]) {
        return send(404, { error: { code: 'ACTIVATION_NOT_FOUND', message: 'activation missing', details: {} } });
      }
      if (state.requireUpgradeDomains.has(requestedDomain)) {
        return send(409, { error: { code: 'ACTIVATION_STRATEGY_MISMATCH', message: 'needs upgrade', details: {} } });
      }
      if (!requestedDomain) return send(400, { error: { code: 'DOMAIN_REQUIRED', message: 'domain missing', details: {} } });
      return send(200, { results: [{ ok: true }], domain: requestedDomain });
    }

    if (method === 'POST' && pathname.includes('/extensions/')) {
      const requestedDomain = resolveRequestedDomain(body, pathname);
      if (state.requireActivationDomains.has(requestedDomain) && !state.activations[requestedDomain]) {
        return send(404, { error: { code: 'ACTIVATION_NOT_FOUND', message: 'activation missing', details: {} } });
      }
      if (state.requireUpgradeDomains.has(requestedDomain)) {
        return send(409, { error: { code: 'ACTIVATION_STRATEGY_MISMATCH', message: 'needs upgrade', details: {} } });
      }
      if (!requestedDomain) return send(400, { error: { code: 'DOMAIN_REQUIRED', message: 'domain missing', details: {} } });
      return send(200, { ok: true, op: pathname.split('/').pop() });
    }

    return send(404, { error: { code: 'NOT_FOUND', message: 'not found', details: {} } });
  };

  return {
    async start() {
      if (!originalFetch) {
        originalFetch = globalThis.fetch;
      }
      globalThis.fetch = handler;
      return baseUrl;
    },
    async stop() {
      if (originalFetch) {
        globalThis.fetch = originalFetch;
      }
    },
    state
  };
}
