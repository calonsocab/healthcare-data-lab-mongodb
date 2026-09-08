import crypto from 'crypto';

function randomChunk(length = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    const index = crypto.randomInt(0, alphabet.length);
    out += alphabet[index];
  }
  return out;
}

export function generateInviteCode() {
  return `HDL-${randomChunk(6)}-${randomChunk(6)}`;
}

export function hashInviteCode(code) {
  return crypto.createHash('sha256').update(String(code || '').trim().toUpperCase()).digest('hex');
}

export function normalizeInviteCode(code) {
  return String(code || '').trim().toUpperCase();
}
