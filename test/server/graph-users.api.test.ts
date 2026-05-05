import Database from "better-sqlite3";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestWithDelegatedToken = vi.fn();

vi.mock("../../src/server/auth/auth-middleware.js", () => ({
  requireDelegatedAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAppAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
  hasValidDelegatedSession: () => true,
  hasValidAppAccessSession: () => false,
  getDelegatedToken: () => "delegated-token",
  getDelegatedUser: () => "admin@example.test"
}));

vi.mock("../../src/server/auth/delegated-auth.js", () => ({
  requestWithDelegatedToken
}));

const { createApp } = await import("../../src/server/app.js");
const { runMigrations } = await import("../../src/server/db/migrate.js");

let db: Database.Database;

beforeEach(() => {
  db = new Database(":memory:");
  runMigrations(db);
  requestWithDelegatedToken.mockReset();
});

describe("GET /api/graph/users", () => {
  it("returns safe user search results", async () => {
    requestWithDelegatedToken.mockResolvedValueOnce({
      status: 200,
      data: {
        value: [
          {
            id: "user-1",
            displayName: "Alex Rivera",
            userPrincipalName: "alex@example.test",
            mail: "alex.rivera@example.test"
          }
        ]
      }
    });

    const response = await request(createApp(db))
      .get("/api/graph/users?q=alex")
      .expect(200);

    expect(response.body).toEqual([
      {
        id: "user-1",
        displayName: "Alex Rivera",
        userPrincipalName: "alex@example.test",
        mail: "alex.rivera@example.test"
      }
    ]);
    expect(requestWithDelegatedToken).toHaveBeenCalledWith(
      "delegated-token",
      expect.stringContaining("/users?")
    );
    expect(requestWithDelegatedToken.mock.calls[0][1]).toContain("%24top=25");
  });

  it("rejects short queries before Graph is called", async () => {
    const response = await request(createApp(db))
      .get("/api/graph/users?q=a")
      .expect(400);

    expect(response.body.message).toMatch(/2-100/);
    expect(requestWithDelegatedToken).not.toHaveBeenCalled();
  });

  it("surfaces client-safe Graph errors only", async () => {
    requestWithDelegatedToken.mockResolvedValueOnce({
      status: 403,
      data: { error: { message: "full upstream body should not leak" } }
    });

    const response = await request(createApp(db))
      .get("/api/graph/users?q=alex")
      .expect(403);

    expect(response.body.message).toBe(
      "Could not search Microsoft Graph users. Check admin permissions and try again."
    );
    expect(JSON.stringify(response.body)).not.toContain("full upstream body");
  });

  it("caps returned users at 25", async () => {
    requestWithDelegatedToken.mockResolvedValueOnce({
      status: 200,
      data: {
        value: Array.from({ length: 30 }, (_, index) => ({
          id: `user-${index}`,
          displayName: `User ${index}`,
          userPrincipalName: `user${index}@example.test`,
          mail: null
        }))
      }
    });

    const response = await request(createApp(db))
      .get("/api/graph/users?q=user")
      .expect(200);

    expect(response.body).toHaveLength(25);
    expect(response.body[24].id).toBe("user-24");
  });
}
);
