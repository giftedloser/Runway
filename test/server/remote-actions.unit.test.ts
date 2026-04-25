import { beforeEach, describe, expect, it, vi } from "vitest";

// Destructive Graph helpers are simple url+method+body wrappers around
// requestWithDelegatedToken. They must *stay* simple: a wrong URL, method,
// or body shape on wipe/retire/delete-* is how you brick customer devices
// or silently no-op a "delete" action. We pin each one to a concrete call
// signature + success/failure message so regressions surface here.
const requestWithDelegatedTokenMock = vi.fn();

vi.mock("../../src/server/auth/delegated-auth.js", () => ({
  requestWithDelegatedToken: requestWithDelegatedTokenMock
}));

const actions = await import("../../src/server/actions/remote-actions.js");

beforeEach(() => {
  requestWithDelegatedTokenMock.mockReset();
});

describe("remote-actions — request shape", () => {
  it("wipeDevice posts a full-wipe body to the managed device wipe endpoint", async () => {
    requestWithDelegatedTokenMock.mockResolvedValueOnce({ status: 204, data: null });
    const result = await actions.wipeDevice("tok", "intune-123");

    expect(requestWithDelegatedTokenMock).toHaveBeenCalledWith(
      "tok",
      "/deviceManagement/managedDevices/intune-123/wipe",
      { method: "POST", body: { keepEnrollmentData: false, keepUserData: false } }
    );
    expect(result).toEqual({
      success: true,
      status: 204,
      message: "Full wipe initiated. Device will factory reset."
    });
  });

  it("autopilotReset posts a reset-shape body (keepEnrollmentData: true) to /wipe", async () => {
    // Guard: autopilotReset and wipeDevice both hit /wipe. The ONLY difference
    // is the body. If that body ever gets confused, autopilotReset becomes a
    // full wipe in disguise.
    requestWithDelegatedTokenMock.mockResolvedValueOnce({ status: 204, data: null });
    await actions.autopilotReset("tok", "intune-123");

    expect(requestWithDelegatedTokenMock).toHaveBeenCalledWith(
      "tok",
      "/deviceManagement/managedDevices/intune-123/wipe",
      { method: "POST", body: { keepEnrollmentData: true, keepUserData: false } }
    );
  });

  it("retireDevice posts to /retire without a body", async () => {
    requestWithDelegatedTokenMock.mockResolvedValueOnce({ status: 204, data: null });
    await actions.retireDevice("tok", "intune-123");

    expect(requestWithDelegatedTokenMock).toHaveBeenCalledWith(
      "tok",
      "/deviceManagement/managedDevices/intune-123/retire",
      { method: "POST" }
    );
  });

  it("deleteIntuneDevice DELETEs the managed device resource", async () => {
    requestWithDelegatedTokenMock.mockResolvedValueOnce({ status: 204, data: null });
    await actions.deleteIntuneDevice("tok", "intune-123");

    expect(requestWithDelegatedTokenMock).toHaveBeenCalledWith(
      "tok",
      "/deviceManagement/managedDevices/intune-123",
      { method: "DELETE" }
    );
  });

  it("deleteAutopilotDevice DELETEs the windowsAutopilotDeviceIdentities resource and accepts 200 OR 204", async () => {
    requestWithDelegatedTokenMock.mockResolvedValueOnce({ status: 200, data: null });
    const result = await actions.deleteAutopilotDevice("tok", "ap-789");

    expect(requestWithDelegatedTokenMock).toHaveBeenCalledWith(
      "tok",
      "/deviceManagement/windowsAutopilotDeviceIdentities/ap-789",
      { method: "DELETE" }
    );
    // Graph returns 200 sometimes for autopilot deletes; the helper normalizes.
    expect(result.success).toBe(true);
  });

  it("rotateLapsPassword posts to rotateLocalAdminPassword", async () => {
    requestWithDelegatedTokenMock.mockResolvedValueOnce({ status: 204, data: null });
    await actions.rotateLapsPassword("tok", "intune-123");

    expect(requestWithDelegatedTokenMock).toHaveBeenCalledWith(
      "tok",
      "/deviceManagement/managedDevices/intune-123/rotateLocalAdminPassword",
      { method: "POST" }
    );
  });

  it("renameDevice posts the new name as deviceName body", async () => {
    requestWithDelegatedTokenMock.mockResolvedValueOnce({ status: 204, data: null });
    const result = await actions.renameDevice("tok", "intune-123", "DESKTOP-ACME");

    expect(requestWithDelegatedTokenMock).toHaveBeenCalledWith(
      "tok",
      "/deviceManagement/managedDevices/intune-123/setDeviceName",
      { method: "POST", body: { deviceName: "DESKTOP-ACME" } }
    );
    expect(result.message).toContain("DESKTOP-ACME");
  });

  it("encodes path identifiers before sending Graph requests", async () => {
    requestWithDelegatedTokenMock.mockResolvedValueOnce({ status: 204, data: null });
    await actions.syncDevice("tok", "intune/id with space");

    expect(requestWithDelegatedTokenMock).toHaveBeenCalledWith(
      "tok",
      "/deviceManagement/managedDevices/intune%2Fid%20with%20space/syncDevice",
      { method: "POST" }
    );
  });
});

describe("remote-actions — failure handling", () => {
  it("surfaces non-204 Graph status with a helpful failure message", async () => {
    requestWithDelegatedTokenMock.mockResolvedValueOnce({ status: 403, data: null });
    const result = await actions.wipeDevice("tok", "intune-123");
    expect(result.success).toBe(false);
    expect(result.status).toBe(403);
    expect(result.message).toMatch(/Wipe failed with status 403/);
  });

  it("retire failure shows the retire-specific message", async () => {
    requestWithDelegatedTokenMock.mockResolvedValueOnce({ status: 404, data: null });
    const result = await actions.retireDevice("tok", "missing-id");
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Retire failed with status 404/);
  });

  it("deleteAutopilotDevice rejects 400 even though it accepts 200", async () => {
    requestWithDelegatedTokenMock.mockResolvedValueOnce({ status: 400, data: null });
    const result = await actions.deleteAutopilotDevice("tok", "ap-789");
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/status 400/);
  });
});

describe("changePrimaryUser — two-step sequence", () => {
  it("first DELETEs the existing ref, then POSTs the new @odata.id", async () => {
    requestWithDelegatedTokenMock
      .mockResolvedValueOnce({ status: 204, data: null }) // delete existing
      .mockResolvedValueOnce({ status: 204, data: null }); // assign new

    const result = await actions.changePrimaryUser("tok", "intune-123", "user-abc");

    expect(requestWithDelegatedTokenMock).toHaveBeenNthCalledWith(
      1,
      "tok",
      "/deviceManagement/managedDevices/intune-123/users/$ref",
      { method: "DELETE" }
    );
    expect(requestWithDelegatedTokenMock).toHaveBeenNthCalledWith(
      2,
      "tok",
      "/deviceManagement/managedDevices/intune-123/users/$ref",
      {
        method: "POST",
        body: { "@odata.id": "https://graph.microsoft.com/v1.0/users/user-abc" }
      }
    );
    expect(result.success).toBe(true);
  });

  it("encodes UPN primary-user references in @odata.id", async () => {
    requestWithDelegatedTokenMock
      .mockResolvedValueOnce({ status: 204, data: null })
      .mockResolvedValueOnce({ status: 204, data: null });

    await actions.changePrimaryUser("tok", "intune-123", "jane.doe+pilot@example.com");

    expect(requestWithDelegatedTokenMock).toHaveBeenNthCalledWith(
      2,
      "tok",
      "/deviceManagement/managedDevices/intune-123/users/$ref",
      {
        method: "POST",
        body: {
          "@odata.id": "https://graph.microsoft.com/v1.0/users/jane.doe%2Bpilot%40example.com"
        }
      }
    );
  });

  it("tolerates 404 on the DELETE step (no user was assigned) and still assigns", async () => {
    requestWithDelegatedTokenMock
      .mockResolvedValueOnce({ status: 404, data: null })
      .mockResolvedValueOnce({ status: 204, data: null });

    const result = await actions.changePrimaryUser("tok", "intune-123", "user-abc");
    expect(result.success).toBe(true);
    expect(requestWithDelegatedTokenMock).toHaveBeenCalledTimes(2);
  });

  it("bails out before the POST if DELETE returns an unexpected failure", async () => {
    // If the DELETE fails with something like 500 or 403, re-assigning the
    // new user would leave us in a muddled state — the helper short-circuits.
    requestWithDelegatedTokenMock.mockResolvedValueOnce({ status: 500, data: null });

    const result = await actions.changePrimaryUser("tok", "intune-123", "user-abc");
    expect(result.success).toBe(false);
    expect(result.status).toBe(500);
    expect(requestWithDelegatedTokenMock).toHaveBeenCalledTimes(1);
  });
});
