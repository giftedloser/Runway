import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DEFAULT_SESSION_SECRET = "pilotcheck-dev-session-secret";

describe("server config session secret guard", () => {
  let envBackup: NodeJS.ProcessEnv;

  beforeEach(() => {
    envBackup = { ...process.env };
    vi.resetModules();
    delete process.env.NODE_ENV;
    delete process.env.npm_lifecycle_event;
    process.env.SESSION_SECRET = DEFAULT_SESSION_SECRET;
  });

  afterEach(() => {
    process.env = envBackup;
    vi.resetModules();
  });

  it("allows the built-in session secret only for the local dev server launcher", async () => {
    process.env.npm_lifecycle_event = "dev:server";

    const { config } = await import("../../src/server/config.js");

    expect(config.SESSION_SECRET).toBe(DEFAULT_SESSION_SECRET);
  });

  it("rejects the built-in session secret outside development and test", async () => {
    await expect(import("../../src/server/config.js")).rejects.toThrow(
      "SESSION_SECRET is set to the built-in development default"
    );
  });
});
