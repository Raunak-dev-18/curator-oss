import { isAgentConfigured } from "@/lib/ai/runner";
import { isAuthConfigured } from "@/lib/auth0";
import { isDatabaseConfigured } from "@/lib/db";
import { isDaytonaConfigured } from "@/lib/daytona";
import { isStorageConfigured } from "@/lib/storage";

export async function GET() {
  return Response.json({
    ok: true,
    services: {
      auth0: isAuthConfigured,
      neon: isDatabaseConfigured,
      daytona: isDaytonaConfigured,
      model: isAgentConfigured,
      googleStorage: isStorageConfigured,
    },
  });
}

