import { describe, expect, it, vi } from "vitest";

import { syncAutopilotDevices } from "../../src/server/sync/autopilot-sync.js";

describe("syncAutopilotDevices", () => {
  it("falls back to the base Autopilot query when deploymentProfile expansion is rejected", async () => {
    const getAllPages = vi
      .fn()
      .mockRejectedValueOnce(new Error("Graph request failed: 400 Bad Request"))
      .mockResolvedValueOnce([
        {
          id: "ap-1",
          serialNumber: "SN-1",
          groupTag: "North",
          azureActiveDirectoryDeviceId: "entra-device-1"
        }
      ]);

    const rows = await syncAutopilotDevices({ getAllPages } as never);

    expect(getAllPages).toHaveBeenCalledTimes(2);
    expect(getAllPages.mock.calls[0]?.[0]).toContain("$expand=deploymentProfile");
    expect(getAllPages.mock.calls[1]?.[0]).not.toContain("$expand=deploymentProfile");
    expect(rows).toEqual([
      expect.objectContaining({
        id: "ap-1",
        serial_number: "SN-1",
        group_tag: "North",
        entra_device_id: "entra-device-1"
      })
    ]);
  });
});
