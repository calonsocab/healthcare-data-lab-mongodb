import { deleteEnvironmentSecretDoc, upsertEnvironmentSecretDoc } from './secretScope.js';

export async function syncEnvironmentSecrets(coreDb, ownerScope, nextEnvironments = [], previousEnvironments = []) {
  if (!coreDb?.collection) return;

  const now = new Date();
  const nextIds = new Set();

  for (const env of nextEnvironments) {
    const envId = env?.id;
    if (!envId) continue;
    nextIds.add(envId);
    if (!env?.sealedUri) continue;

    await upsertEnvironmentSecretDoc(coreDb, ownerScope, envId, env.sealedUri, now);
  }

  for (const env of previousEnvironments) {
    const envId = env?.id;
    if (!envId || nextIds.has(envId)) continue;
    await deleteEnvironmentSecretDoc(coreDb, ownerScope, envId);
  }
}
