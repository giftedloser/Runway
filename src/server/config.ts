import { z } from "zod";

import { loadPilotCheckEnv } from "./load-env.js";

loadPilotCheckEnv();

const envSchema = z.object({
  AZURE_TENANT_ID: z.string().optional(),
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),
  AZURE_REDIRECT_URI: z.string().default("http://localhost:3001/api/auth/callback"),
  HOST: z.string().default("127.0.0.1"),
  SESSION_SECRET: z.string().default("pilotcheck-dev-session-secret"),
  PORT: z.coerce.number().default(3001),
  CLIENT_PORT: z.coerce.number().default(5173),
  DATABASE_PATH: z.string().default("./data/pilotcheck.sqlite"),
  SYNC_INTERVAL_MINUTES: z.coerce.number().default(15),
  PROFILE_ASSIGNED_NOT_ENROLLED_HOURS: z.coerce.number().default(2),
  PROVISIONING_STALLED_HOURS: z.coerce.number().default(8),
  SEED_MODE: z.enum(["mock", "none"]).default("mock")
});

const parsed = envSchema.parse(process.env);

export const config = {
  ...parsed,
  isGraphConfigured:
    Boolean(parsed.AZURE_TENANT_ID) &&
    Boolean(parsed.AZURE_CLIENT_ID) &&
    Boolean(parsed.AZURE_CLIENT_SECRET),
  graphMissing: [
    !parsed.AZURE_TENANT_ID ? "AZURE_TENANT_ID" : null,
    !parsed.AZURE_CLIENT_ID ? "AZURE_CLIENT_ID" : null,
    !parsed.AZURE_CLIENT_SECRET ? "AZURE_CLIENT_SECRET" : null
  ].filter(Boolean) as string[]
};
