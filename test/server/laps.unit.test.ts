import { beforeEach, describe, expect, it, vi } from "vitest";

// Stub the delegated-auth transport so no network ever happens. Each test
// drives the mock directly to simulate the various Graph response shapes
// that getLapsPassword needs to handle.
const requestWithDelegatedTokenMock = vi.fn();

vi.mock("../../src/server/auth/delegated-auth.js", () => ({
  requestWithDelegatedToken: requestWithDelegatedTokenMock
}));

const { getLapsPassword } = await import("../../src/server/actions/laps.js");

beforeEach(() => {
  requestWithDelegatedTokenMock.mockReset();
});

describe("getLapsPassword — password decryption", () => {
  it("decodes the base64 passwordBase64 field to UTF-8", async () => {
    const plaintext = "xK9!mN2@pQ7#";
    const passwordBase64 = Buffer.from(plaintext, "utf-8").toString("base64");

    requestWithDelegatedTokenMock.mockResolvedValueOnce({
      status: 200,
      data: {
        id: "entra-device-id",
        deviceName: "POS-01",
        credentials: [
          {
            accountName: "LocalAdmin",
            accountSid: "S-1-5-21-...",
            passwordBase64,
            backupDateTime: "2026-04-01T00:00:00Z",
            passwordExpirationDateTime: "2026-05-01T00:00:00Z"
          }
        ]
      }
    });

    const result = await getLapsPassword("fake-token", "entra-device-id");

    expect(result.success).toBe(true);
    expect(result.credential?.password).toBe(plaintext);
    expect(result.credential?.accountName).toBe("LocalAdmin");
  });

  it("decodes UTF-8 passwords with non-ASCII characters correctly", async () => {
    const plaintext = "Pässwörd‼️€";
    const passwordBase64 = Buffer.from(plaintext, "utf-8").toString("base64");

    requestWithDelegatedTokenMock.mockResolvedValueOnce({
      status: 200,
      data: {
        id: "e1",
        deviceName: "POS-02",
        credentials: [
          {
            accountName: "LocalAdmin",
            accountSid: "S-1-5-21-...",
            passwordBase64,
            backupDateTime: "2026-04-01T00:00:00Z",
            passwordExpirationDateTime: null
          }
        ]
      }
    });

    const result = await getLapsPassword("fake-token", "e1");
    expect(result.credential?.password).toBe(plaintext);
    expect(result.credential?.passwordExpirationDateTime).toBeNull();
  });

  it("surfaces both backupDateTime and passwordExpirationDateTime", async () => {
    requestWithDelegatedTokenMock.mockResolvedValueOnce({
      status: 200,
      data: {
        id: "e1",
        deviceName: "POS-03",
        credentials: [
          {
            accountName: "LocalAdmin",
            accountSid: "S-1-5-21-...",
            passwordBase64: Buffer.from("pw", "utf-8").toString("base64"),
            backupDateTime: "2026-04-10T10:00:00Z",
            passwordExpirationDateTime: "2026-05-10T10:00:00Z"
          }
        ]
      }
    });

    const result = await getLapsPassword("fake-token", "e1");
    expect(result.credential?.backupDateTime).toBe("2026-04-10T10:00:00Z");
    expect(result.credential?.passwordExpirationDateTime).toBe("2026-05-10T10:00:00Z");
  });
});

describe("getLapsPassword — delegated token pass-through", () => {
  it("forwards the supplied access token to the delegated Graph call", async () => {
    requestWithDelegatedTokenMock.mockResolvedValueOnce({
      status: 200,
      data: {
        id: "e1",
        deviceName: "POS",
        credentials: [
          {
            accountName: "LocalAdmin",
            accountSid: "S-1",
            passwordBase64: Buffer.from("pw", "utf-8").toString("base64"),
            backupDateTime: "2026-04-01T00:00:00Z",
            passwordExpirationDateTime: null
          }
        ]
      }
    });

    await getLapsPassword("token-abc-123", "entra-device-xyz");

    expect(requestWithDelegatedTokenMock).toHaveBeenCalledTimes(1);
    const [token, path] = requestWithDelegatedTokenMock.mock.calls[0]!;
    expect(token).toBe("token-abc-123");
    expect(path).toContain("/deviceLocalCredentials/entra-device-xyz");
  });

  it("re-issues the Graph call with a fresh token on a subsequent invocation (token refresh)", async () => {
    // First call: original token.
    requestWithDelegatedTokenMock.mockResolvedValueOnce({
      status: 200,
      data: {
        id: "e1",
        deviceName: "POS",
        credentials: [
          {
            accountName: "LocalAdmin",
            accountSid: "S-1",
            passwordBase64: Buffer.from("pw1", "utf-8").toString("base64"),
            backupDateTime: "2026-04-01T00:00:00Z",
            passwordExpirationDateTime: null
          }
        ]
      }
    });
    // Second call: a refreshed token — simulates the session middleware
    // handing getLapsPassword a new access token after a refresh.
    requestWithDelegatedTokenMock.mockResolvedValueOnce({
      status: 200,
      data: {
        id: "e1",
        deviceName: "POS",
        credentials: [
          {
            accountName: "LocalAdmin",
            accountSid: "S-1",
            passwordBase64: Buffer.from("pw2", "utf-8").toString("base64"),
            backupDateTime: "2026-04-02T00:00:00Z",
            passwordExpirationDateTime: null
          }
        ]
      }
    });

    const first = await getLapsPassword("token-v1", "e1");
    const second = await getLapsPassword("token-v2-refreshed", "e1");

    expect(first.credential?.password).toBe("pw1");
    expect(second.credential?.password).toBe("pw2");
    expect(requestWithDelegatedTokenMock.mock.calls[0]![0]).toBe("token-v1");
    expect(requestWithDelegatedTokenMock.mock.calls[1]![0]).toBe("token-v2-refreshed");
  });
});

describe("getLapsPassword — error handling", () => {
  it("returns a 404-flavored failure when Graph responds 404", async () => {
    requestWithDelegatedTokenMock.mockResolvedValueOnce({ status: 404, data: null });

    const result = await getLapsPassword("fake-token", "missing-device");

    expect(result.success).toBe(false);
    expect(result.status).toBe(404);
    expect(result.credential).toBeNull();
    expect(result.message).toContain("No LAPS credential");
  });

  it("returns a generic failure when Graph responds 403", async () => {
    requestWithDelegatedTokenMock.mockResolvedValueOnce({ status: 403, data: null });

    const result = await getLapsPassword("fake-token", "e1");

    expect(result.success).toBe(false);
    expect(result.status).toBe(403);
    expect(result.credential).toBeNull();
    expect(result.message).toContain("403");
  });

  it("returns failure when credentials array is empty even on 200", async () => {
    requestWithDelegatedTokenMock.mockResolvedValueOnce({
      status: 200,
      data: { id: "e1", deviceName: "POS", credentials: [] }
    });

    const result = await getLapsPassword("fake-token", "e1");

    expect(result.success).toBe(false);
    expect(result.credential).toBeNull();
  });

  it("propagates unexpected transport errors", async () => {
    requestWithDelegatedTokenMock.mockRejectedValueOnce(new Error("network down"));

    await expect(getLapsPassword("fake-token", "e1")).rejects.toThrow("network down");
  });
});
