import { createHash } from "node:crypto";

export function canonicalAccountId(email: string, emailVerified: boolean, providerSubject: string) {
  if (!emailVerified) return providerSubject;
  const normalizedEmail = email.trim().toLowerCase();
  const digest = createHash("sha256").update(normalizedEmail).digest("hex").slice(0, 40);
  return `account|${digest}`;
}
