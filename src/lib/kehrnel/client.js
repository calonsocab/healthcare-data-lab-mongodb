// src/lib/kehrnel/client.js
import { openSecret } from '@/lib/crypto/secrets.mjs';

/**
 * Lightweight HTTP-only Kehrnel client.
 * All interactions happen via remote API; no local Python subprocesses.
 */
class KehrnelClient {
  constructor(config) {
    this.endpoint = (config.endpoint || config.url || '').replace(/\/$/, '');
    this.apiKey = config.apiKey || null;
    this.timeout = config.timeout || 30000;
  }

  async transform(module, operation, strategyConfig, data) {
    if (!this.endpoint) {
      throw new Error('Kehrnel endpoint is required');
    }

    const url = `${this.endpoint}/transform`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {})
        },
        body: JSON.stringify({
          module,
          operation,
          config: strategyConfig,
          data
        })
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Kehrnel responded ${res.status} ${res.statusText}`);
      }

      const result = await res.json().catch(() => ({}));
      if (result.success === false) {
        throw new Error(result.error || 'Kehrnel transform failed');
      }

      return result.data || result;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

export function createKehrnelClient(config) {
  return new KehrnelClient(config);
}

/**
 * Resolve the default Kehrnel instance from the shared collection.
 * Returns null if no instance is registered.
 */
export async function getActiveKehrnelConfig(coreDb) {
  const collection = coreDb.collection('kehrnel_instances');
  const instance =
    (await collection.findOne({ isDefault: true, enabled: { $ne: false } })) ||
    (await collection.findOne({ enabled: { $ne: false } }));

  if (!instance) return null;

  let apiKey = instance.apiKey || null;
  if (apiKey && typeof apiKey === 'object' && apiKey.v) {
    try {
      apiKey = openSecret(apiKey);
    } catch (err) {
      console.error('[Kehrnel] Failed to unseal API key:', err.message);
      apiKey = null;
    }
  }

  return {
    id: instance._id?.toString(),
    name: instance.name || 'Kehrnel',
    type: 'remote',
    endpoint: instance.url,
    apiKey
  };
}

export default KehrnelClient;
