import fs from "node:fs";
import path from "node:path";
import os from "node:os";

/**
 * First-run / wizard support for editing the PilotCheck `.env` file in
 * place. We *must* preserve any existing keys, comments, and ordering so
 * an operator who hand-edited PORT or DATABASE_PATH does not lose those
 * settings the moment they save Graph credentials through the UI.
 *
 * The write is atomic (tmp file + rename) so a crash mid-write cannot
 * leave a half-rewritten `.env` that fails to parse on next boot.
 */

const KEY_LINE = /^([A-Za-z_][A-Za-z0-9_]*)\s*=/;

export interface EnvWriteResult {
  path: string;
  created: boolean;
  updatedKeys: string[];
  addedKeys: string[];
}

/**
 * Resolve the `.env` path the running server is reading. Mirrors the
 * priority in load-env.ts so the wizard writes to the same file the
 * server will reload on restart.
 */
export function resolveEnvPath(): string {
  if (process.env.PILOTCHECK_ENV_PATH) {
    return path.resolve(process.env.PILOTCHECK_ENV_PATH);
  }
  if (process.env.PILOTCHECK_APP_DATA_DIR) {
    return path.resolve(process.env.PILOTCHECK_APP_DATA_DIR, ".env");
  }
  return path.resolve(process.cwd(), ".env");
}

function escapeValue(value: string): string {
  // Quote if value contains whitespace, '#', or '"'. Escape embedded quotes.
  if (/[\s#"']/.test(value)) {
    return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return value;
}

/**
 * Apply the given key/value updates to the `.env` file at `envPath`,
 * preserving every other line. Keys that do not yet exist are appended
 * in a single block at the end of the file.
 */
export function writeEnvUpdates(
  envPath: string,
  updates: Record<string, string>
): EnvWriteResult {
  const keysToWrite = Object.keys(updates);
  const seen = new Set<string>();

  let existing = "";
  let created = false;
  if (fs.existsSync(envPath)) {
    existing = fs.readFileSync(envPath, "utf8");
  } else {
    created = true;
    fs.mkdirSync(path.dirname(envPath), { recursive: true });
  }

  const eol = existing.includes("\r\n") ? "\r\n" : os.EOL;
  const lines = existing.length === 0 ? [] : existing.split(/\r?\n/);

  const rewritten = lines.map((line) => {
    const match = KEY_LINE.exec(line);
    if (!match) return line;
    const key = match[1];
    if (!Object.prototype.hasOwnProperty.call(updates, key)) return line;
    seen.add(key);
    return `${key}=${escapeValue(updates[key])}`;
  });

  const updatedKeys: string[] = [];
  const addedKeys: string[] = [];
  for (const key of keysToWrite) {
    if (seen.has(key)) updatedKeys.push(key);
    else addedKeys.push(key);
  }

  if (addedKeys.length > 0) {
    // Make sure we are starting on a new line before appending.
    if (rewritten.length > 0 && rewritten[rewritten.length - 1] !== "") {
      rewritten.push("");
    }
    for (const key of addedKeys) {
      rewritten.push(`${key}=${escapeValue(updates[key])}`);
    }
  }

  // Ensure trailing newline.
  if (rewritten.length === 0 || rewritten[rewritten.length - 1] !== "") {
    rewritten.push("");
  }

  const final = rewritten.join(eol);

  // Atomic write: tmp file in same dir, then rename.
  const tmp = `${envPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, final, { encoding: "utf8", mode: 0o600 });
  try {
    fs.renameSync(tmp, envPath);
  } catch (error) {
    // Best-effort cleanup; bubble the error up to the caller.
    try { fs.unlinkSync(tmp); } catch { /* ignore */ }
    throw error;
  }

  // Best-effort permission tightening on POSIX. fs.chmod is a no-op on
  // Windows and we don't want it to fail the write.
  try {
    if (process.platform !== "win32") fs.chmodSync(envPath, 0o600);
  } catch {
    /* ignore */
  }

  return { path: envPath, created, updatedKeys, addedKeys };
}
