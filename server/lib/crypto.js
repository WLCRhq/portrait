import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey() {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns format: iv_hex:authTag_hex:ciphertext_hex
 */
export function encrypt(plaintext) {
  if (!plaintext) return plaintext;

  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a blob in format iv_hex:authTag_hex:ciphertext_hex.
 * Returns the original plaintext string.
 */
export function decrypt(blob) {
  if (!blob) return blob;

  // If it doesn't look encrypted (no colons), return as-is for backward compat
  if (!blob.includes(':')) return blob;

  const parts = blob.split(':');
  if (parts.length !== 3) return blob;

  const [ivHex, authTagHex, ciphertext] = parts;

  try {
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    // If decryption fails, the value may be plaintext (pre-migration)
    return blob;
  }
}

/**
 * Check if a string looks like it's already encrypted (iv:tag:ciphertext format).
 */
export function isEncrypted(value) {
  if (!value || !value.includes(':')) return false;
  const parts = value.split(':');
  return parts.length === 3 && /^[0-9a-f]+$/.test(parts.join(''));
}
