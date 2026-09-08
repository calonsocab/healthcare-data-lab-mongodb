// src/lib/kehrnel/version.js

/**
 * Detect kehrnel version installed in the user's Docker instance
 * This is called from the browser, so it needs to go through an API route
 */
export async function getInstalledKehrnelVersion() {
  try {
    const response = await fetch('/api/kehrnel/version');
    if (!response.ok) {
      console.warn('Failed to fetch kehrnel version:', response.statusText);
      return null;
    }

    const data = await response.json();
    return data.version || null;
  } catch (error) {
    console.error('Error fetching kehrnel version:', error);
    return null;
  }
}

/**
 * Check if a strategy is compatible with installed kehrnel
 */
export function isStrategyCompatible(strategy, installedVersion) {
  if (!strategy?.blueprint?.kehrnel_library) {
    return { compatible: true, reason: 'No kehrnel requirement' };
  }

  if (!installedVersion) {
    return { compatible: null, reason: 'Kehrnel version unknown' };
  }

  const required = parseVersionRequirement(strategy.blueprint.kehrnel_library.required_version);
  const installed = parseVersion(installedVersion);

  if (!required || !installed) {
    return { compatible: null, reason: 'Invalid version format' };
  }

  const compatible = compareVersions(installed, required) >= 0;

  return {
    compatible,
    reason: compatible
      ? `Compatible (requires ${required.original})`
      : `Requires kehrnel ${required.original}, you have ${installedVersion}`,
    required: required.original,
    installed: installedVersion
  };
}

/**
 * Parse version requirement (e.g., ">=0.8.0" → {major: 0, minor: 8, patch: 0, original: ">=0.8.0"})
 */
function parseVersionRequirement(versionStr) {
  const match = versionStr?.match(/>=?(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;

  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3]),
    original: versionStr
  };
}

/**
 * Parse semantic version string
 */
function parseVersion(versionStr) {
  const parts = versionStr?.split('.').map(Number);
  if (!parts || parts.length !== 3) return null;

  return {
    major: parts[0],
    minor: parts[1],
    patch: parts[2]
  };
}

/**
 * Compare two parsed versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
function compareVersions(a, b) {
  if (a.major !== b.major) return a.major > b.major ? 1 : -1;
  if (a.minor !== b.minor) return a.minor > b.minor ? 1 : -1;
  if (a.patch !== b.patch) return a.patch > b.patch ? 1 : -1;
  return 0;
}
