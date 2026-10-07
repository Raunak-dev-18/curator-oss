import path from "node:path";

/**
 * Helpers for project secrets that are delivered to a generated app as `.env.local`.
 * Kept free of I/O so they can be unit-tested and reused by tools, routes, and the sandbox sync.
 */

export const SECRET_NAME_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
export const MAX_SECRET_VALUE_LENGTH = 16_000;
export const MAX_SECRETS_PER_PROJECT = 100;

/** Names Cognix sets itself. Users can see them but cannot overwrite or delete them. */
export const RESERVED_SECRET_NAMES = new Set([
  "CI",
  "NODE_ENV",
  "PORT",
  "HOSTNAME",
  "NEXT_TELEMETRY_DISABLED",
  "NODE_OPTIONS",
  "PATH",
  "HOME",
]);

export function validateSecretName(name: string): string | null {
  if (!SECRET_NAME_PATTERN.test(name)) {
    return "Use 1–64 characters: uppercase letters, digits, and underscores, starting with a letter.";
  }
  if (RESERVED_SECRET_NAMES.has(name)) return `${name} is managed by the runtime and cannot be set.`;
  return null;
}

export function validateSecretValue(value: string): string | null {
  if (!value.length) return "Enter a value.";
  if (value.length > MAX_SECRET_VALUE_LENGTH) return `Values can be at most ${MAX_SECRET_VALUE_LENGTH.toLocaleString("en-US")} characters.`;
  if (value.includes("\0")) return "Values cannot contain null bytes.";
  return null;
}

/**
 * True for any dotenv-style file (`.env`, `.env.local`, `.env.production.local`, …) at any depth.
 * Agent file tools, file sync, checkpoints, and exports must refuse these paths.
 */
export function isEnvFilePath(value: string) {
  const normalized = value.replaceAll("\\", "/");
  const base = path.posix.basename(normalized);
  return base === ".env" || base.startsWith(".env.");
}

/** Quote one dotenv value so multi-line keys, `#`, `$`, quotes, and spaces survive Next.js parsing. */
export function quoteEnvValue(value: string) {
  const escaped = value
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"")
    .replaceAll("$", "\\$")
    .replaceAll("\r", "")
    .replaceAll("\n", "\\n");
  return `"${escaped}"`;
}

export function renderEnvFile(values: Record<string, string>) {
  const lines = ["# Managed by Cognix. Edit secrets in the Cognix workspace; local edits are overwritten."];
  for (const name of Object.keys(values).sort()) {
    if (validateSecretName(name)) continue;
    lines.push(`${name}=${quoteEnvValue(values[name])}`);
  }
  return `${lines.join("\n")}\n`;
}
