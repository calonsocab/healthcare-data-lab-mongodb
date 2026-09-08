#!/usr/bin/env node

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { MongoClient } from 'mongodb';
import validateAQL from '../src/lib/aqlToMql/parser/validateAql.js';
import { openSecret } from '../src/lib/crypto/secrets.mjs';
import { KehrnelService } from '../src/lib/kehrnel/KehrnelService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const TEAM_NAME = 'CatSalut';
const ENV_NAME = 'Informational-DEV';
const QUERY_FOLDER_ID = '69e8a3151a78f483a4aaa90e';
const USER_EMAIL = 'francesc.mateu@mongodb.com';
const QUERY_NAME = 'AiR Adverse Reaction Record - Pharmacovigilance notification query';
const TEMPLATE_NAME = 'air_adverse_reaction_record_v1';

const PV = "c/context/other_context[at0001]/items[openEHR-EHR-CLUSTER.pharmacovigilance_notification_details.v0]";

function resolveCoreUri() {
  let uri = process.env.CORE_MONGODB_URL;
  if (uri?.includes('${MONGODB_URI}')) {
    uri = process.env.MONGODB_URI;
  }
  if (!uri) {
    throw new Error('CORE_MONGODB_URL or MONGODB_URI is required');
  }
  return uri;
}

function buildQueryText() {
  return `SELECT
    c/uid/value AS compositionId,
    ${PV}/items[at0002]/value/id AS NumeroNotificacio,
    ${PV}/items[at0003]/value/value AS DataNotificacio
FROM
    EHR e
        CONTAINS
            COMPOSITION c[openEHR-EHR-COMPOSITION.encounter.v1]
WHERE
    c/archetype_details/template_id/value = '${TEMPLATE_NAME}'
    AND EXISTS ${PV}/items[at0002]/value/id
ORDER BY
    c/context/start_time/value,
    c/uid/value`;
}

function assertValidAql(name, aqlText) {
  const result = validateAQL(aqlText);
  const errors = Array.isArray(result?.errors) ? result.errors.filter(Boolean) : [];
  if (errors.length) {
    throw new Error(`Invalid AQL for "${name}": ${errors.join('; ')}`);
  }
}

async function getTenantContext(coreDb) {
  const team = await coreDb.collection('teams').findOne(
    { name: TEAM_NAME },
    { projection: { _id: 1, name: 1, environments: 1 } }
  );
  if (!team) {
    throw new Error(`Team "${TEAM_NAME}" not found`);
  }

  const env = (team.environments || []).find((item) => item.name === ENV_NAME);
  if (!env) {
    throw new Error(`Environment "${ENV_NAME}" not found on team "${TEAM_NAME}"`);
  }

  const secret = await coreDb.collection('environment_secrets').findOne({
    envId: env.id,
    ownerType: 'team',
    ownerId: String(team._id),
  });
  if (!secret?.sealedUri) {
    throw new Error(`No environment secret found for envId=${env.id}`);
  }

  return {
    team,
    env,
    tenantUri: openSecret(secret.sealedUri),
  };
}

async function upsertQuery(db, templateModel, aqlText) {
  const now = new Date();
  const existing = await db.collection('aql-queries').findOne(
    { name: QUERY_NAME },
    { projection: { _id: 1, createdAt: 1, createdBy: 1 } }
  );

  const payload = {
    name: QUERY_NAME,
    description: 'Returns the pharmacovigilance notification identifier and notification date stored in AiR adverse reaction compositions, together with the composition UID required to replicate the Targeta Groga traceability record.',
    uuid: '',
    folderId: QUERY_FOLDER_ID,
    tags: ['AiR', 'Adverse reactions', 'Pharmacovigilance', 'Targeta groga'],
    aqlText,
    normalizedAQL: '',
    affectedTemplates: [
      {
        id: templateModel._id.toString(),
        name: templateModel.name,
      },
    ],
    strategyValidations: {},
    updatedAt: now,
    updatedBy: USER_EMAIL,
  };

  if (existing) {
    await db.collection('aql-queries').updateOne(
      { _id: existing._id },
      { $set: payload }
    );
    return { action: 'updated', id: existing._id.toString() };
  }

  const result = await db.collection('aql-queries').insertOne({
    ...payload,
    createdAt: now,
    createdBy: USER_EMAIL,
  });
  return { action: 'inserted', id: result.insertedId.toString() };
}

async function executeQuery(coreDb, environment, aqlText) {
  const service = new KehrnelService(coreDb);
  const conn = await service.resolveConnection({ envKehrnel: environment?.kehrnel || {} });
  if (!conn?.url) {
    return {
      executed: false,
      reason: 'No Kehrnel connection could be resolved for this environment',
    };
  }

  const url = new URL('/api/domains/openehr/query/aql?force_search=false', conn.url);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'text/plain',
      'x-active-env': environment.id,
      ...(conn.apiKey ? { 'x-api-key': conn.apiKey } : {}),
    },
    body: aqlText,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new Error(`Runtime execution failed (${response.status}): ${JSON.stringify(data)}`);
  }

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  return {
    executed: true,
    rowCount: rows.length,
    preview: rows.slice(0, 3),
  };
}

async function main() {
  const aqlText = buildQueryText();
  assertValidAql(QUERY_NAME, aqlText);

  const coreClient = new MongoClient(resolveCoreUri());
  await coreClient.connect();

  try {
    const coreDb = coreClient.db(process.env.CORE_DATABASE_NAME || 'openehr_core');
    const { env, tenantUri } = await getTenantContext(coreDb);

    const tenantClient = new MongoClient(tenantUri);
    await tenantClient.connect();

    try {
      const tenantDb = tenantClient.db(env.database);
      const templateModel = await tenantDb.collection('user-data-models').findOne(
        { name: TEMPLATE_NAME },
        { projection: { _id: 1, name: 1 } }
      );
      if (!templateModel) {
        throw new Error(`Template model "${TEMPLATE_NAME}" not found in user-data-models`);
      }

      const queryResult = await upsertQuery(tenantDb, templateModel, aqlText);
      const execution = await executeQuery(coreDb, env, aqlText);

      console.log(JSON.stringify({
        team: TEAM_NAME,
        environment: ENV_NAME,
        envId: env.id,
        database: env.database,
        query: {
          name: QUERY_NAME,
          id: queryResult.id,
          action: queryResult.action,
        },
        execution,
      }, null, 2));
    } finally {
      await tenantClient.close();
    }
  } finally {
    await coreClient.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
