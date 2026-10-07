import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for project secrets at rest.
 * COGNIX_SECRETS_KEY must be 32 random bytes encoded as base64 (e.g. `openssl rand -base64 32`).
 */

export type EncryptedSecret = { ciphertext: string; iv: string; authTag: string };

export function parseSecretsKey(raw: string | undefined): Buffer | null {
  if (!raw) return null;
  const key = Buffer.from(raw.trim(), "base64");
  if (key.length !== 32) {
    throw new Error("COGNIX_SECRETS_KEY must be 32 bytes encoded as base64. Generate one with `openssl rand -base64 32`.");
  }
  return key;
}

export const isSecretsEncryptionConfigured = Boolean(process.env.COGNIX_SECRETS_KEY);

function requireKey(key?: Buffer) {
  const resolved = key ?? parseSecretsKey(process.env.COGNIX_SECRETS_KEY);
  if (!resolved) throw new Error("Add COGNIX_SECRETS_KEY to the server environment to store project secrets.");
  return resolved;
}

export function encryptSecret(plaintext: string, key?: Buffer): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", requireKey(key), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(secret: EncryptedSecret, key?: Buffer): string {
  const decipher = createDecipheriv("aes-256-gcm", requireKey(key), Buffer.from(secret.iv, "base64"));
  decipher.setAuthTag(Buffer.from(secret.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(secret.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
