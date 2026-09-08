#!/usr/bin/env node

/**
 * Rewrite mapping_definitions YAML from Jinja-style template lines to plain YAML/XPath expressions.
 *
 * Default mode is dry-run:
 *   node scripts/migrate-mapping-jinja-to-yaml.mjs --all-tenants
 *
 * Apply changes:
 *   node scripts/migrate-mapping-jinja-to-yaml.mjs --all-tenants --apply
 *   node scripts/migrate-mapping-jinja-to-yaml.mjs --env-id=<ENV_ID> --apply
 */

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import { openSecret } from '../src/lib/crypto/secrets.mjs';

const DISALLOWED_TEMPLATE_MARKER_RE = /(\\{\\{|\\{%|\\{#)/m;

function findDisallowedTemplateMarker(value) {
  const text = String(value || '');
  const match = text.match(DISALLOWED_TEMPLATE_MARKER_RE);
  if (!match || typeof match.index !== 'number') return null;
  const marker = match[0] || null;
  const before = text.slice(0, match.index);
  const lines = before.split('\\n');
  return {
    marker,
    index: match.index,
    line: lines.length,
    column: (lines[lines.length - 1] || '').length + 1
  };
}

dotenv.config({ path: '.env.local' });
dotenv.config();

function parseArgs(argv) {
  const args = argv.slice(2);
  const has = (flag) => args.includes(flag);
  const get = (name) => {
    const direct = args.find((a) => a.startsWith(`${name}=`));
    if (direct) return direct.slice(name.length + 1);
    const idx = args.indexOf(name);
    if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
    return '';
  };

  return {
    apply: has('--apply'),
    allTenants: has('--all-tenants'),
    envId: get('--env-id').trim(),
    limit: Number.parseInt(get('--limit') || '0', 10) || 0,
    includeNoMarkers: has('--include-no-markers')
  };
}

function resolveCoreUri() {
  let coreUri = String(process.env.CORE_MONGODB_URL || process.env.MONGODB_URI || '').trim();
  if (!coreUri) throw new Error('CORE_MONGODB_URL or MONGODB_URI must be set');
  if (coreUri.includes('${MONGODB_URI}')) {
    coreUri = String(process.env.MONGODB_URI || '').trim();
  }
  if (!coreUri || coreUri.includes('${')) {
    throw new Error('Unable to resolve CORE MongoDB URI');
  }
  return coreUri;
}

function resolveCoreDbName() {
  return String(process.env.CORE_DATABASE_NAME || 'openehr_core').trim();
}

function splitByTopLevelTilde(expr) {
  const tokens = [];
  let current = '';
  let quote = null;
  let depth = 0;

  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    const prev = i > 0 ? expr[i - 1] : '';

    if (quote) {
      current += ch;
      if (ch === quote && prev !== '\\') quote = null;
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }

    if (ch === '(') {
      depth += 1;
      current += ch;
      continue;
    }

    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      current += ch;
      continue;
    }

    if (ch === '~' && depth === 0) {
      const t = current.trim();
      if (t) tokens.push(t);
      current = '';
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) tokens.push(tail);
  return tokens;
}

function toXPathLiteral(value) {
  const text = String(value ?? '');
  if (!text.includes("'")) return `'${text}'`;
  if (!text.includes('"')) return `"${text}"`;

  const parts = text.split("'");
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]) out.push(`'${parts[i]}'`);
    if (i < parts.length - 1) out.push('"\'"');
  }
  return `concat(${out.join(', ')})`;
}

function parseTemplateToken(token) {
  const text = token.trim();

  const strMatch = /^(["'])([\s\S]*)\1$/.exec(text);
  if (strMatch) {
    return { kind: 'string', value: strMatch[2] };
  }

  const xpathMatch = /^xpath\s*\(\s*([\s\S]+?)\s*\)$/.exec(text);
  if (xpathMatch) {
    const inner = xpathMatch[1].trim();
    const innerQuoted = /^(["'])([\s\S]*)\1$/.exec(inner);
    if (innerQuoted) {
      return { kind: 'xpath', value: innerQuoted[2] };
    }
    return { kind: 'xpath_raw', value: inner };
  }

  return null;
}

function convertTemplateExpression(expr) {
  const tokens = splitByTopLevelTilde(expr);
  if (!tokens.length) return null;

  const parsed = tokens.map(parseTemplateToken);
  if (parsed.some((p) => !p)) return null;

  if (parsed.length === 1) {
    if (parsed[0].kind === 'xpath' || parsed[0].kind === 'xpath_raw') {
      return {
        key: 'xpath',
        value: parsed[0].value
      };
    }
    return null;
  }

  const parts = parsed.map((p) => {
    if (p.kind === 'string') return toXPathLiteral(p.value);
    if (p.kind === 'xpath' || p.kind === 'xpath_raw') return p.value;
    return null;
  });

  if (parts.some((p) => p == null)) return null;

  return {
    key: 'xpath',
    value: `concat(${parts.join(', ')})`
  };
}

function toYamlDoubleQuoted(value) {
  const text = String(value ?? '');
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function rewriteYamlTemplates(yamlText) {
  const lines = String(yamlText || '').split(/\r?\n/);
  let replacements = 0;
  const unresolved = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^(\s*)template\s*:\s*(["'])\s*\{\{\s*([\s\S]*?)\s*\}\}\s*\2\s*(#.*)?$/.exec(line);
    if (!m) continue;

    const indent = m[1] || '';
    const expr = (m[3] || '').trim();
    const trailingComment = (m[4] || '').trim();

    const converted = convertTemplateExpression(expr);
    if (!converted) {
      unresolved.push({ line: i + 1, template: line.trim() });
      continue;
    }

    lines[i] = `${indent}${converted.key}: ${toYamlDoubleQuoted(converted.value)}${trailingComment ? ` ${trailingComment}` : ''}`;
    replacements += 1;
  }

  const yaml = lines.join('\n');
  return {
    yaml,
    changed: replacements > 0,
    replacements,
    unresolved
  };
}

async function collectTenantEnvironments(coreDb) {
  const envMap = new Map();

  const registerEnv = (env, ownerLabel) => {
    const id = String(env?.id || env?._id || '').trim();
    const database = String(env?.database || env?.dbName || '').trim();
    if (!id || !database) return;

    if (!envMap.has(id)) {
      envMap.set(id, {
        id,
        name: String(env?.name || id),
        database,
        sealedUri: env?.sealedUri || null,
        dbUri: env?.dbUri || null,
        owners: [ownerLabel]
      });
      return;
    }

    const existing = envMap.get(id);
    existing.owners.push(ownerLabel);
    if (!existing.sealedUri && env?.sealedUri) existing.sealedUri = env.sealedUri;
    if (!existing.dbUri && env?.dbUri) existing.dbUri = env.dbUri;
    if (!existing.database && database) existing.database = database;
  };

  const users = await coreDb.collection('users').find({}, { projection: { email: 1, environments: 1 } }).toArray();
  for (const user of users) {
    const envs = Array.isArray(user?.environments) ? user.environments : [];
    for (const env of envs) registerEnv(env, `user:${user.email || user._id}`);
  }

  const teams = await coreDb.collection('teams').find({}, { projection: { name: 1, environments: 1 } }).toArray();
  for (const team of teams) {
    const envs = Array.isArray(team?.environments) ? team.environments : [];
    for (const env of envs) registerEnv(env, `team:${team.name || team._id}`);
  }

  return Array.from(envMap.values());
}

function getSecretMap(secretDocs = []) {
  const out = new Map();
  for (const doc of secretDocs) {
    const keys = [doc?.envId, doc?.environmentId, doc?._id]
      .map((v) => (v == null ? '' : String(v).trim()))
      .filter(Boolean);
    for (const key of keys) {
      if (!out.has(key)) out.set(key, doc);
    }
  }
  return out;
}

function resolveTenantUri(env, secretMap) {
  if (env?.sealedUri) {
    return openSecret(env.sealedUri);
  }

  const sec = secretMap.get(env.id);
  if (sec?.sealedUri) {
    return openSecret(sec.sealedUri);
  }

  if (env?.dbUri) return String(env.dbUri);
  return '';
}

async function migrateEnvMappings({ env, uri, apply, limit, includeNoMarkers }) {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000,
    socketTimeoutMS: 30000
  });
  await client.connect();

  try {
    const db = client.db(env.database);
    const col = db.collection('mapping_definitions');
    const docs = await col.find({}, { projection: { name: 1, documentType: 1, yaml: 1 } }).toArray();

    const result = {
      envId: env.id,
      envName: env.name,
      database: env.database,
      scanned: docs.length,
      candidates: 0,
      changed: 0,
      updated: 0,
      skipped: 0,
      unresolved: 0,
      failed: 0,
      samples: []
    };

    for (const doc of docs) {
      const yaml = String(doc?.yaml || '');
      const hadMarker = Boolean(findDisallowedTemplateMarker(yaml));
      if (!hadMarker && !includeNoMarkers) continue;

      result.candidates += 1;

      const rewritten = rewriteYamlTemplates(yaml);
      if (!rewritten.changed) {
        result.skipped += 1;
        if (hadMarker) result.unresolved += 1;
        continue;
      }

      const stillBlocked = Boolean(findDisallowedTemplateMarker(rewritten.yaml));
      if (stillBlocked) {
        result.unresolved += 1;
      }

      result.changed += 1;

      if (result.samples.length < 10) {
        result.samples.push({
          id: String(doc._id),
          name: doc?.name || null,
          documentType: doc?.documentType || null,
          replacements: rewritten.replacements,
          unresolvedLines: rewritten.unresolved.map((u) => u.line)
        });
      }

      if (!apply || stillBlocked) continue;

      try {
        await col.updateOne(
          { _id: doc._id },
          {
            $set: {
              yaml: rewritten.yaml,
              updatedAt: new Date(),
              updatedBy: 'migration:jinja-to-yaml'
            }
          }
        );
        result.updated += 1;
      } catch (error) {
        result.failed += 1;
        console.error(`  Update failed for mapping ${doc?._id}: ${error.message}`);
      }

      if (limit > 0 && result.updated >= limit) break;
    }

    return result;
  } finally {
    await client.close();
  }
}

async function main() {
  const options = parseArgs(process.argv);
  const dryRun = !options.apply;

  if (!options.envId && !options.allTenants) {
    console.log('No scope provided, defaulting to --all-tenants in dry-run mode.');
    options.allTenants = true;
  }

  if (options.apply && !options.envId && !options.allTenants) {
    throw new Error('Apply mode requires --env-id or --all-tenants');
  }

  const coreUri = resolveCoreUri();
  const coreDbName = resolveCoreDbName();

  console.log('='.repeat(72));
  console.log('Mapping Jinja-to-YAML Migration');
  console.log('='.repeat(72));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}`);
  console.log(`Scope: ${options.envId ? `env=${options.envId}` : 'all tenants'}`);
  if (options.limit > 0) console.log(`Limit updates per environment: ${options.limit}`);
  console.log('');

  const coreClient = new MongoClient(coreUri);
  await coreClient.connect();

  try {
    const coreDb = coreClient.db(coreDbName);
    const allEnvs = await collectTenantEnvironments(coreDb);
    const secretDocs = await coreDb.collection('environment_secrets').find({}, { projection: { envId: 1, environmentId: 1, sealedUri: 1 } }).toArray();
    const secretMap = getSecretMap(secretDocs);

    const targetEnvs = options.envId
      ? allEnvs.filter((e) => e.id === options.envId)
      : allEnvs;

    if (!targetEnvs.length) {
      throw new Error(options.envId
        ? `Environment not found in users/teams: ${options.envId}`
        : 'No tenant environments found in users/teams');
    }

    const summaries = [];

    for (const env of targetEnvs) {
      let uri = '';
      try {
        uri = resolveTenantUri(env, secretMap);
      } catch (error) {
        console.error(`Skipping ${env.name} (${env.id}) - cannot decrypt tenant URI: ${error.message}`);
        summaries.push({ envId: env.id, envName: env.name, error: error.message });
        continue;
      }

      if (!uri || uri.includes('${')) {
        const msg = 'missing or unresolved tenant URI';
        console.error(`Skipping ${env.name} (${env.id}) - ${msg}`);
        summaries.push({ envId: env.id, envName: env.name, error: msg });
        continue;
      }

      console.log(`Processing ${env.name} (${env.id}) db=${env.database}`);
      try {
        const summary = await migrateEnvMappings({
          env,
          uri,
          apply: options.apply,
          limit: options.limit,
          includeNoMarkers: options.includeNoMarkers
        });

        summaries.push(summary);
        console.log(
          `  scanned=${summary.scanned} candidates=${summary.candidates} changed=${summary.changed} ` +
          `updated=${summary.updated} unresolved=${summary.unresolved} failed=${summary.failed}`
        );
        if (summary.samples.length > 0) {
          summary.samples.forEach((s) => {
            console.log(`    - ${s.name || s.id} replacements=${s.replacements} unresolvedLines=${s.unresolvedLines.join(',') || 'none'}`);
          });
        }
      } catch (error) {
        console.error(`  ERROR: ${error.message}`);
        summaries.push({ envId: env.id, envName: env.name, error: error.message });
      }
    }

    console.log('');
    console.log('='.repeat(72));
    console.log('Summary');
    console.log('='.repeat(72));

    const totals = summaries.reduce((acc, s) => {
      if (s.error) {
        acc.errors += 1;
        return acc;
      }
      acc.scanned += s.scanned;
      acc.candidates += s.candidates;
      acc.changed += s.changed;
      acc.updated += s.updated;
      acc.unresolved += s.unresolved;
      acc.failed += s.failed;
      return acc;
    }, {
      scanned: 0,
      candidates: 0,
      changed: 0,
      updated: 0,
      unresolved: 0,
      failed: 0,
      errors: 0
    });

    summaries.forEach((s) => {
      if (s.error) {
        console.log(`- ${s.envName || s.envId}: ERROR ${s.error}`);
        return;
      }
      console.log(
        `- ${s.envName} (${s.envId}): scanned=${s.scanned}, candidates=${s.candidates}, changed=${s.changed}, ` +
        `updated=${s.updated}, unresolved=${s.unresolved}, failed=${s.failed}`
      );
    });

    console.log('');
    console.log(
      `Totals: scanned=${totals.scanned}, candidates=${totals.candidates}, changed=${totals.changed}, ` +
      `updated=${totals.updated}, unresolved=${totals.unresolved}, failed=${totals.failed}, envErrors=${totals.errors}`
    );

    if (dryRun) {
      console.log('Dry run complete. Re-run with --apply to persist changes.');
    }
  } finally {
    await coreClient.close();
  }
}

main().catch((error) => {
  console.error('Fatal:', error.message);
  process.exit(1);
});
