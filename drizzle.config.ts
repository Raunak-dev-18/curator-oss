import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env.local on its own; load it the same way Next.js does
// so `npm run db:push` targets the configured Neon database instead of the localhost fallback.
loadEnvConfig(process.cwd());

export default defineConfig({
  out: "./drizzle",
  schema: "./src/lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://localhost/cognix",
  },
  strict: true,
  verbose: true,
});

