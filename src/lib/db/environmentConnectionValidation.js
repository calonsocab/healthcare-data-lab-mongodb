import { MongoClient } from 'mongodb';

const VALIDATION_OPTIONS = {
  serverSelectionTimeoutMS: 8000,
  connectTimeoutMS: 8000,
  socketTimeoutMS: 8000,
  retryWrites: false,
  appName: 'Healthcare-Data-Lab-Validation',
};

function redactMongoUri(message = '') {
  return String(message || '')
    .replace(/mongodb(\+srv)?:\/\/([^@\s]+)@/gi, 'mongodb$1://<credentials>@')
    .replace(/mongodb(\+srv)?:\/\/[^\s'"]+/gi, 'mongodb$1://<redacted>');
}

export function getEnvironmentSaveErrorMessage(environmentName, reason) {
  const label = environmentName ? `Environment "${environmentName}"` : 'Environment';
  return `${label}: ${reason}`;
}

export function getConnectionValidationMessage(database, error) {
  const base = database
    ? `Could not connect to database "${database}" with the provided connection string`
    : 'Could not connect with the provided connection string';

  const details = redactMongoUri(error?.message || '').trim();
  return details ? `${base}. ${details}` : base;
}

export async function validateMongoEnvironmentConnection({ connectionString, database }) {
  if (!connectionString) throw new Error('Connection string is required');
  if (!database) throw new Error('Database name is required');

  const client = new MongoClient(connectionString, VALIDATION_OPTIONS);
  try {
    await client.connect();
    const db = client.db(database);
    await db.command({ ping: 1 });
    await db.listCollections({}, { nameOnly: true }).toArray();
  } finally {
    await client.close().catch(() => {});
  }
}
