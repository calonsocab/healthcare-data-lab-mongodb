// src/lib/kehrnel/strategies.js
import { createKehrnelService } from './KehrnelService';

function buildHeaders(connection) {
  const headers = { 'Content-Type': 'application/json' };
  if (connection?.apiKey) {
    headers['x-api-key'] = connection.apiKey;
  }
  return headers;
}

/**
 * Fetch strategies from Kehrnel using unified connection resolution
 *
 * Uses KehrnelService.resolveConnection() which checks:
 * 1. kehrnel_instances.isDefault === true
 * 2. First enabled instance in kehrnel_instances
 * 3. KEHRNEL_URL environment variable
 */
export async function fetchKehrnelStrategies(db) {
  const service = createKehrnelService(db);
  const connection = await service.resolveConnection();

  if (!connection?.url) {
    return { strategies: [], source: 'none', error: 'No Kehrnel connection available' };
  }

  const res = await fetch(`${connection.url}/strategies`, {
    method: 'GET',
    headers: buildHeaders(connection),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(`Kehrnel strategies fetch failed (${res.status}): ${txt}`);
  }

  const data = await res.json();
  const manifests = Array.isArray(data.manifests) ? data.manifests : (data.strategies || []);

  return {
    strategies: manifests,
    source: connection.name || 'default',
    connectionId: connection.connectionId,
    url: connection.url,
  };
}

export async function activateKehrnelStrategy(db, strategyId, config) {
  const service = createKehrnelService(db);
  const connection = await service.resolveConnection();

  if (!connection?.url) {
    throw new Error('No Kehrnel connection available (configure kehrnel_instances or set KEHRNEL_URL)');
  }

  const res = await fetch(`${connection.url}/strategies/activate`, {
    method: 'POST',
    headers: buildHeaders(connection),
    body: JSON.stringify({
      strategy_id: strategyId,
      config: config || {},
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(`Kehrnel activation failed (${res.status}): ${txt}`);
  }

  const data = await res.json();
  return {
    activationId: data.activation_id || data.activationId,
    environment: data.environment,
    tenant: data.tenant,
    connection,
  };
}

export default {
  fetchKehrnelStrategies,
  activateKehrnelStrategy,
};
