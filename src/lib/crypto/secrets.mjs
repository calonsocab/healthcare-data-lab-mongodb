import crypto from 'crypto';

// Lazy key loading - only check when functions are called (not at build time)
function getKey() {
  const KEY_B64 = process.env.ENV_SECRETS_KEY;
  if (!KEY_B64) {
    throw new Error('ENV_SECRETS_KEY (32-byte base64) must be set');
  }
  const raw = Buffer.from(KEY_B64, 'base64');
  if (raw.length !== 32) {
    throw new Error('ENV_SECRETS_KEY must be 32 bytes base64');
  }
  return raw;
}

export function sealSecret(plain) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { v: 1, iv: iv.toString('base64'), ct: ct.toString('base64'), tag: tag.toString('base64') };
}

export function openSecret(blob) {
  if (!blob || typeof blob !== 'object' || !blob.v) {
    throw new Error('Invalid secret blob');
  }
  const key = getKey();
  const iv = Buffer.from(blob.iv, 'base64');
  const ct = Buffer.from(blob.ct, 'base64');
  const tag = Buffer.from(blob.tag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}
