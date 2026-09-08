function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase();
}

export async function loadEnvironmentScope(coreDb, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { mode: 'none', user: null, team: null, environments: [] };
  }

  const user = await coreDb.collection('users').findOne({ email: normalizedEmail });
  if (!user) {
    return { mode: 'none', user: null, team: null, environments: [] };
  }

  if (user.teamId && (user.accountType === 'team' || user.accountType === 'demo')) {
    const team = await coreDb.collection('teams').findOne({ _id: user.teamId });
    return {
      mode: 'team',
      user,
      team,
      environments: team?.environments || []
    };
  }

  return {
    mode: 'individual',
    user,
    team: null,
    environments: user.environments || []
  };
}

export async function findAccessibleEnvironment(coreDb, email, envId) {
  const scope = await loadEnvironmentScope(coreDb, email);
  const environment = envId
    ? (scope.environments || []).find((env) => env.id === envId) || null
    : null;

  return {
    ...scope,
    environment
  };
}
