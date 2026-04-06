import { describe, expect, it } from "vitest";

import { normalizeSerial } from "../../src/server/engine/normalize.js";
import { correlateDevices } from "../../src/server/engine/correlate.js";

describe("state engine normalization", () => {
  it("treats placeholder serials as unusable", () => {
    expect(normalizeSerial("TO BE FILLED BY O.E.M.")).toBeNull();
    expect(normalizeSerial("  czc123 ")).toBe("CZC123");
  });
});

describe("correlation engine", () => {
  it("matches by serial before lower-confidence fallbacks", () => {
    const results = correlateDevices({
      autopilotRows: [
        {
          id: "auto-1",
          serial_number: "CZC123",
          model: null,
          manufacturer: null,
          group_tag: "Lodge",
          assigned_user_upn: null,
          deployment_profile_id: null,
          deployment_profile_name: null,
          profile_assignment_status: null,
          deployment_mode: null,
          entra_device_id: "entra-1",
          first_seen_at: null,
          first_profile_assigned_at: null,
          last_synced_at: "2026-04-06T00:00:00.000Z",
          raw_json: JSON.stringify({ deviceId: "device-1" })
        }
      ],
      intuneRows: [
        {
          id: "int-1",
          device_name: "DESKTOP-01",
          serial_number: "czc123",
          entra_device_id: "entra-1",
          os_version: null,
          compliance_state: null,
          enrollment_type: null,
          managed_device_owner_type: null,
          last_sync_datetime: null,
          primary_user_upn: null,
          enrollment_profile_name: null,
          autopilot_enrolled: 1,
          last_synced_at: "2026-04-06T00:00:00.000Z",
          raw_json: JSON.stringify({ deviceId: "device-1" })
        }
      ],
      entraRows: [
        {
          id: "entra-1",
          device_id: "device-1",
          display_name: "DESKTOP-01",
          serial_number: "CZC123",
          trust_type: "ServerAd",
          is_managed: 1,
          mdm_app_id: null,
          registration_datetime: null,
          device_physical_ids: JSON.stringify(["[ZTDId]:ABC"]),
          last_synced_at: "2026-04-06T00:00:00.000Z",
          raw_json: JSON.stringify({})
        }
      ]
    });

    expect(results).toHaveLength(1);
    expect(results[0].matchedOn).toBe("serial");
    expect(results[0].matchConfidence).toBe("high");
    expect(results[0].identityConflict).toBe(false);
  });
});
