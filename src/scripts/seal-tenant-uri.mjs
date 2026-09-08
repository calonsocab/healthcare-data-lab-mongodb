// src/scripts/seal-tenant-uri.mjs
import { sealSecret } from '../lib/crypto/secrets.mjs';

const uri = process.argv[2];
if (!uri) {
  console.error('Usage: node src/scripts/seal-tenant-uri.mjs "<mongodb-uri>"');
  process.exit(1);
}

const blob = sealSecret(uri);
console.log(JSON.stringify(blob, null, 2));