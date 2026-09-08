// src/lib/kehrnel/endpoints.js
/**
 * Kehrnel Strategy Endpoint Resolver
 *
 * Maps persistence strategies to their Kehrnel Docker instances.
 * Each strategy runs in its own container with its own endpoint.
 *
 * Endpoint sources (in priority order):
 * 1. Database: kehrnel_instances collection
 * 2. Environment variables: KEHRNEL_{STRATEGY}_URL
 * 3. Default fallback: KEHRNEL_URL (single instance mode)
 */

/**
 * Get the Kehrnel endpoint for a specific strategy
 *
 * @param {Db|string} dbOrStrategy - MongoDB database instance (or strategy when called with one arg)
 * @param {string} [maybeStrategy] - Strategy name (e.g., 'rps_dual', 'ccq')
 * @returns {Promise<{url: string, name: string, apiKey?: string} | null>}
 */
export async function getKehrnelEndpoint(dbOrStrategy, maybeStrategy) {
  const db = (dbOrStrategy && typeof dbOrStrategy.collection === 'function')
    ? dbOrStrategy
    : null;
  const strategy = typeof maybeStrategy === 'string'
    ? maybeStrategy
    : (typeof dbOrStrategy === 'string' ? dbOrStrategy : '');

  // 1. Check database for configured instance (when DB is available)
  let instance = null;
  if (db) {
    const filter = {
      enabled: { $ne: false }
    };
    if (strategy) {
      filter.$or = [
        { strategy },
        { strategies: strategy }
      ];
    }
    instance = await db.collection('kehrnel_instances').findOne(filter);
  }

  if (instance) {
    return {
      url: instance.url,
      name: instance.name || strategy,
      apiKey: instance.apiKey
    };
  }

  // 2. Check environment variable for this strategy
  if (strategy) {
    const envKey = `KEHRNEL_${strategy.toUpperCase().replace(/-/g, '_')}_URL`;
    const envUrl = process.env[envKey];
    if (envUrl) {
      return {
        url: envUrl,
        name: `${strategy} (env)`,
        apiKey: process.env[`${envKey}_KEY`]
      };
    }
  }

  // 3. Fallback to default KEHRNEL_URL (single instance mode)
  const defaultUrl = process.env.KEHRNEL_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
  if (defaultUrl) {
    return {
      url: defaultUrl,
      name: 'default',
      apiKey: process.env.KEHRNEL_API_KEY
    };
  }

  return null;
}

/**
 * Get all configured Kehrnel instances
 *
 * @param {Db} db - MongoDB database instance
 * @returns {Promise<Array<{strategy: string, url: string, name: string, status: string}>>}
 */
export async function getAllKehrnelInstances(db) {
  const instances = [];

  // Get from database
  const dbInstances = await db.collection('kehrnel_instances')
    .find({ enabled: { $ne: false } })
    .toArray();

  for (const inst of dbInstances) {
    instances.push({
      strategy: inst.strategy || inst.strategies?.[0] || 'unknown',
      strategies: inst.strategies || [inst.strategy],
      url: inst.url,
      name: inst.name,
      source: 'database',
      status: await checkInstanceHealth(inst.url)
    });
  }

  // Add any env-configured instances not in DB
  const envStrategies = Object.keys(process.env)
    .filter(k => k.startsWith('KEHRNEL_') && k.endsWith('_URL') && k !== 'KEHRNEL_URL')
    .map(k => k.replace('KEHRNEL_', '').replace('_URL', '').toLowerCase().replace(/_/g, '-'));

  for (const strategy of envStrategies) {
    if (!instances.some(i => i.strategy === strategy)) {
      const envKey = `KEHRNEL_${strategy.toUpperCase().replace(/-/g, '_')}_URL`;
      const url = process.env[envKey];
      instances.push({
        strategy,
        strategies: [strategy],
        url,
        name: `${strategy} (env)`,
        source: 'environment',
        status: await checkInstanceHealth(url)
      });
    }
  }

  // Add default instance if configured
  const defaultUrl = process.env.KEHRNEL_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
  if (defaultUrl && !instances.some(i => i.url === defaultUrl)) {
    instances.push({
      strategy: 'default',
      strategies: ['*'],
      url: defaultUrl,
      name: 'Default Instance',
      source: 'environment',
      status: await checkInstanceHealth(defaultUrl)
    });
  }

  return instances;
}

/**
 * Check health of a Kehrnel instance
 *
 * @param {string} url - Kehrnel instance URL
 * @returns {Promise<'healthy' | 'unhealthy' | 'unknown'>}
 */
async function checkInstanceHealth(url) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${url}/health`, {
      method: 'GET',
      signal: controller.signal
    });

    clearTimeout(timeout);
    return response.ok ? 'healthy' : 'unhealthy';
  } catch {
    return 'unknown';
  }
}

/**
 * Register a new Kehrnel instance for a strategy
 *
 * @param {Db} db - MongoDB database instance
 * @param {object} config - Instance configuration
 * @returns {Promise<object>} Created/updated instance
 */
export async function registerKehrnelInstance(db, config) {
  const { strategy, strategies, url, name, apiKey } = config;

  const doc = {
    strategy: strategy || strategies?.[0],
    strategies: strategies || [strategy],
    url,
    name: name || strategy,
    apiKey,
    enabled: true,
    updatedAt: new Date()
  };

  const result = await db.collection('kehrnel_instances').updateOne(
    { strategy: doc.strategy },
    { $set: doc, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );

  return { ...doc, _id: result.upsertedId };
}

export default {
  getKehrnelEndpoint,
  getAllKehrnelInstances,
  registerKehrnelInstance
};
