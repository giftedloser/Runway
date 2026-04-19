import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const stageRoot = join(projectRoot, ".tauri-runtime", "runtime");
const appRoot = join(stageRoot, "app");
const distClient = join(projectRoot, "dist", "client");
const distServer = join(projectRoot, "dist", "server", "index.js");
const migrationsSource = join(projectRoot, "src", "server", "db", "migrations");
const dependencyStampPath = join(stageRoot, "dependency-stamp.txt");

if (!existsSync(distClient) || !existsSync(distServer)) {
  throw new Error("Desktop runtime staging requires dist/client and dist/server/index.js. Run the app build first.");
}

mkdirSync(stageRoot, { recursive: true });
rmSync(join(appRoot, "dist"), { recursive: true, force: true });
mkdirSync(appRoot, { recursive: true });
mkdirSync(join(appRoot, "dist", "server"), { recursive: true });
mkdirSync(join(appRoot, "dist", "client"), { recursive: true });

const stagedNodePath = join(stageRoot, process.platform === "win32" ? "node.exe" : "node");
if (!existsSync(stagedNodePath)) {
  copyFileSync(process.execPath, stagedNodePath);
}
copyFileSync(distServer, join(appRoot, "dist", "server", "index.js"));
cpSync(migrationsSource, join(appRoot, "dist", "server", "migrations"), { recursive: true });
cpSync(distClient, join(appRoot, "dist", "client"), { recursive: true });

writeFileSync(
  join(appRoot, "package.json"),
  `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`
);

const dependencyStamp = createHash("sha256")
  .update(readFileSync(join(projectRoot, "package.json")))
  .update(readFileSync(join(projectRoot, "package-lock.json")))
  .digest("hex");

const dependencyPaths = execSync("npm ls --omit=dev --parseable --all --silent", {
  cwd: projectRoot,
  encoding: "utf8"
})
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((line) => line.includes(`${sep}node_modules${sep}`))
  .sort((left, right) => left.length - right.length);

const stagedNodeModules = join(appRoot, "node_modules");
const stagedDependencyStamp = existsSync(dependencyStampPath)
  ? readFileSync(dependencyStampPath, "utf8").trim()
  : "";

if (existsSync(stagedNodeModules) && stagedDependencyStamp !== dependencyStamp) {
  try {
    rmSync(stagedNodeModules, { recursive: true, force: true });
  } catch {
    throw new Error(
      "Unable to refresh the staged desktop runtime dependencies. Close any running PilotCheck release build and rebuild."
    );
  }
}

if (!existsSync(stagedNodeModules)) {
  for (const dependencyPath of dependencyPaths) {
    const relativePath = relative(projectRoot, dependencyPath);
    cpSync(dependencyPath, join(appRoot, relativePath), { recursive: true });
  }
}

writeFileSync(dependencyStampPath, `${dependencyStamp}\n`);
