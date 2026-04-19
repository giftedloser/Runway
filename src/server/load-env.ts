import path from "node:path";
import fs from "node:fs";

import dotenv from "dotenv";

let loaded = false;

function resolveCandidatePaths() {
  const candidates = new Set<string>();

  if (process.env.PILOTCHECK_ENV_PATH) {
    candidates.add(path.resolve(process.env.PILOTCHECK_ENV_PATH));
  }

  if (process.env.PILOTCHECK_APP_DATA_DIR) {
    candidates.add(path.resolve(process.env.PILOTCHECK_APP_DATA_DIR, ".env"));
  }

  candidates.add(path.resolve(process.cwd(), ".env"));

  return [...candidates];
}

export function loadPilotCheckEnv() {
  if (loaded) return;
  loaded = true;

  for (const envPath of resolveCandidatePaths()) {
    if (!fs.existsSync(envPath)) continue;
    dotenv.config({ path: envPath, override: false });
  }
}
