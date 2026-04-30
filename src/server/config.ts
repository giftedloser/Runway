import { z } from "zod";

import { loadPilotCheckEnv } from "./load-env.js";

loadPilotCheckEnv();

const DEFAULT_SESSION_SECRET = "pilotcheck-dev-session-secret";

const envSchema = z.object({
  AZURE_TENANT_ID: z.string().optional(),
  AZURE_CLIENT_ID: z.string().optional(),
  AZURE_CLIENT_SECRET: z.string().optional(),
  // Optional certificate auth alternative to AZURE_CLIENT_SECRET.
  // AZURE_CLIENT_CERT_PATH points at a PEM file containing the private
  // key (and optionally the cert); AZURE_CLIENT_CERT_THUMBPRINT is the
  // SHA-1 thumbprint of the cert as registered on the Entra app.
  // When both secret and cert are configured, the cert wins.
  AZURE_CLIENT_CERT_PATH: z.string().optional(),
  AZURE_CLIENT_CERT_THUMBPRINT: z.string().optional(),
  AZURE_REDIRECT_URI: z.string().default("http://localhost:3001/api/auth/callback"),
  HOST: z.string().default("127.0.0.1"),
  SESSION_SECRET: z.string().default(DEFAULT_SESSION_SECRET),
  APP_ACCESS_MODE: z.enum(["disabled", "entra"]).default("entra"),
  APP_ACCESS_ALLOWED_USERS: z.string().default(""),
  RUNWAY_DESKTOP_TOKEN: z.string().min(32).optional(),
  PORT: z.coerce.number().default(3001),
  CLIENT_PORT: z.coerce.number().default(5173),
  DATABASE_PATH: z.string().default("./data/pilotcheck.sqlite")
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

const hasCert =
  Boolean(parsed.AZURE_CLIENT_CERT_PATH) && Boolean(parsed.AZURE_CLIENT_CERT_THUMBPRINT);
const hasSecret = Boolean(parsed.AZURE_CLIENT_SECRET);
const hasCredentials = hasCert || hasSecret;
const isGraphConfigured =
  Boolean(parsed.AZURE_TENANT_ID) && Boolean(parsed.AZURE_CLIENT_ID) && hasCredentials;

export const config = {
  ...parsed,
  isGraphConfigured,
  graphAuthMode: hasCert ? ("certificate" as const) : hasSecret ? ("secret" as const) : ("none" as const),
  isAppAccessRequired: isGraphConfigured && parsed.APP_ACCESS_MODE === "entra",
  appAccessAllowedUsers,
  isDevOrTest,
  graphMissing: [
    !parsed.AZURE_TENANT_ID ? "AZURE_TENANT_ID" : null,
    !parsed.AZURE_CLIENT_ID ? "AZURE_CLIENT_ID" : null,
    !hasCredentials ? "AZURE_CLIENT_SECRET (or AZURE_CLIENT_CERT_PATH + AZURE_CLIENT_CERT_THUMBPRINT)" : null
  ].filter(Boolean) as string[]
};
