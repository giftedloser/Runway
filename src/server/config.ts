import { z } from "zod";

import { loadPilotCheckEnv } from "./load-env.js";

loadPilotCheckEnv();

const DEFAULT_SESSION_SECRET = "pilotcheck-dev-session-secret";

const envSchema = z.object({
  AZURE_TENANT_ID: z.string().optional(),
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),
  AZURE_REDIRECT_URI: z.string().default("http://localhost:3001/api/auth/callback"),
  HOST: z.string().default("127.0.0.1"),
  SESSION_SECRET: z.string().default(DEFAULT_SESSION_SECRET),
  APP_ACCESS_MODE: z.enum(["disabled", "entra"]).default("entra"),
  APP_ACCESS_ALLOWED_USERS: z.string().default(""),
  RUNWAY_DESKTOP_TOKEN: z.string().min(32).optional(),
  PORT: z.coerce.number().default(3001),
  CLIENT_PORT: z.coerce.number().default(5173),
  DATABASE_PATH: z.string().default("./data/pilotcheck.sqlite"),
  SYNC_INTERVAL_MINUTES: z.coerce.number().default(15),
  PROFILE_ASSIGNED_NOT_ENROLLED_HOURS: z.coerce.number().default(2),
  PROVISIONING_STALLED_HOURS: z.coerce.number().default(8),
  SEED_MODE: z.enum(["mock", "none"]).default("mock"),
  // Retention windows for the rolling tables. Set to 0 to disable a
  // particular sweep (we leave history untouched). The scheduler runs
  // every RETENTION_INTERVAL_HOURS and is also exposed as a manual
  // /api/health/retention endpoint for ops to trigger ad-hoc.
  HISTORY_RETENTION_DAYS: z.coerce.number().int().min(0).default(90),
  ACTION_LOG_RETENTION_DAYS: z.coerce.number().int().min(0).default(180),
  SYNC_LOG_RETENTION_DAYS: z.coerce.number().int().min(0).default(30),
  RETENTION_INTERVAL_HOURS: z.coerce.number().min(0.5).default(24)
});

const parsed = envSchema.parse(process.env);
const appAccessAllowedUsers = parsed.APP_ACCESS_ALLOWED_USERS.split(",")
  .map((user) => user.trim().toLowerCase())
  .filter(Boolean);

// Fail fast if running outside dev/test with the built-in default session secret.
// With the default, anyone who knows the string can forge session cookies and
// bypass delegated-auth on every desktop installation.
const nodeEnv = process.env.NODE_ENV;
const npmLifecycleEvent = process.env.npm_lifecycle_event;
const isLocalDevServer = npmLifecycleEvent === "dev:server";
const isDevOrTest = nodeEnv === "development" || nodeEnv === "test" || isLocalDevServer;
if (!isDevOrTest && parsed.SESSION_SECRET === DEFAULT_SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET is set to the built-in development default. " +
      "Set SESSION_SECRET to a long random value in the Runway .env before starting the server. " +
      "(npm run dev handles this automatically; set NODE_ENV=development only for manual local server runs.)"
  );
}

export const config = {
  ...parsed,
  isGraphConfigured:
    Boolean(parsed.AZURE_TENANT_ID) &&
    Boolean(parsed.AZURE_CLIENT_ID) &&
    Boolean(parsed.AZURE_CLIENT_SECRET),
  isAppAccessRequired:
    parsed.APP_ACCESS_MODE === "entra" &&
    Boolean(parsed.AZURE_TENANT_ID) &&
    Boolean(parsed.AZURE_CLIENT_ID) &&
    Boolean(parsed.AZURE_CLIENT_SECRET),
  appAccessAllowedUsers,
  isDevOrTest,
  graphMissing: [
    !parsed.AZURE_TENANT_ID ? "AZURE_TENANT_ID" : null,
    !parsed.AZURE_CLIENT_ID ? "AZURE_CLIENT_ID" : null,
    !parsed.AZURE_CLIENT_SECRET ? "AZURE_CLIENT_SECRET" : null
  ].filter(Boolean) as string[]
};
