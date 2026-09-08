#!/usr/bin/env node

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isLikelyPlaceholder(value) {
  const v = String(value || '').toLowerCase().trim();
  if (!v) return true;
  return (
    v.includes('your-') ||
    v.includes('change-me') ||
    v.includes('replace-me') ||
    v.includes('example') ||
    v.includes('username:password')
  );
}

function isHttpsUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateSecurityBaseline(env) {
  const errors = [];

  const accessMode = String(env.ACCESS_MODE || '').toLowerCase().trim();
  if (accessMode !== 'external') {
    errors.push('ACCESS_MODE must be "external" in production.');
  }

  const trustedOrigins = parseCsv(env.CSRF_TRUSTED_ORIGINS);
  if (!trustedOrigins.length) {
    errors.push('CSRF_TRUSTED_ORIGINS must be explicitly set (comma-separated origins).');
  } else {
    for (const origin of trustedOrigins) {
      if (!isHttpsUrl(origin)) {
        errors.push(`CSRF_TRUSTED_ORIGINS contains non-HTTPS or invalid origin: ${origin}`);
      }
    }
  }

  const proxyPrefixes = parseCsv(env.INTERNAL_PROXY_ALLOWED_PREFIXES);
  if (!proxyPrefixes.length) {
    errors.push('INTERNAL_PROXY_ALLOWED_PREFIXES must be explicitly set.');
  } else if (proxyPrefixes.includes('*')) {
    errors.push('INTERNAL_PROXY_ALLOWED_PREFIXES cannot include "*". Use explicit prefixes.');
  }

  const nextAuthSecret = String(env.NEXTAUTH_SECRET || '');
  if (nextAuthSecret.length < 32 || isLikelyPlaceholder(nextAuthSecret)) {
    errors.push('NEXTAUTH_SECRET must be set to a strong non-placeholder secret (>= 32 chars).');
  }

  const dbUrl = String(env.CORE_MONGODB_URL || env.MONGODB_URI || '').trim();
  if (!dbUrl || isLikelyPlaceholder(dbUrl)) {
    errors.push('CORE_MONGODB_URL (or MONGODB_URI) must be set to a real non-placeholder DB URI.');
  }

  if (!isHttpsUrl(env.NEXTAUTH_URL)) {
    errors.push('NEXTAUTH_URL must be HTTPS in production.');
  }
  if (env.APP_BASE_URL && !isHttpsUrl(env.APP_BASE_URL)) {
    errors.push('APP_BASE_URL must be HTTPS in production.');
  }

  return errors;
}

function main() {
  const modeArg = String(process.argv[2] || '').trim().toLowerCase();
  const isProductionTarget =
    modeArg === '--production' ||
    modeArg === 'production' ||
    String(process.env.NODE_ENV || '').toLowerCase() === 'production';

  if (!isProductionTarget) {
    console.log('security:check skipped (target is not production).');
    process.exit(0);
  }

  const errors = validateSecurityBaseline(process.env);
  if (!errors.length) {
    console.log('security:check passed for production baseline.');
    process.exit(0);
  }

  console.error('security:check failed:');
  for (const message of errors) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

main();

