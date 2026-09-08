export async function ensureDomainProxyRuntimeReady(
  service,
  runtime,
  { envId, requestId, domain = 'openehr' } = {}
) {
  const envKey = runtime?.envKey || envId || null;
  const runtimeDomain = runtime?.domain || domain;

  if (!service?.ensureRuntimeReady || !envKey) {
    return { envKey, domain: runtimeDomain };
  }

  await service.ensureRuntimeReady(envKey, {
    strategyId: runtime?.autoActivate?.strategyId || null,
    connectionId: runtime?.connectionId || undefined,
    envKehrnel: runtime?.envKehrnel || {},
    domain: runtimeDomain,
    requestId: requestId || null,
    autoActivate: runtime?.autoActivate || null
  });

  return {
    envKey,
    domain: runtimeDomain
  };
}

export default ensureDomainProxyRuntimeReady;
