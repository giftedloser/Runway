import { describe, expect, it } from "vitest";

import { hasConfigMgrClient } from "../../src/server/engine/config-mgr.js";
import { normalizeSerial, normalizeString, normalizeName, safeJsonParse, extractRawDeviceId } from "../../src/server/engine/normalize.js";
import { correlateDevices } from "../../src/server/engine/correlate.js";

describe("state engine normalization", () => {
  it("treats placeholder serials as unusable", () => {
    expect(normalizeSerial("TO BE FILLED BY O.E.M.")).toBeNull();
    expect(normalizeSerial("  czc123 ")).toBe("CZC123");
  });

  it("treats null, undefined, empty string as null serial", () => {
    expect(normalizeSerial(null)).toBeNull();
    expect(normalizeSerial(undefined)).toBeNull();
    expect(normalizeSerial("")).toBeNull();
    expect(normalizeSerial("   ")).toBeNull();
  });

  it("rejects DEFAULT STRING and UNKNOWN as placeholder serials", () => {
    expect(normalizeSerial("Default String")).toBeNull();
    expect(normalizeSerial("UNKNOWN")).toBeNull();
  });

  it("normalizeString uppercases and trims", () => {
    expect(normalizeString("  hello world  ")).toBe("HELLO WORLD");
    expect(normalizeString(null)).toBeNull();
    expect(normalizeString("")).toBeNull();
  });

  it("normalizeName uppercases and trims", () => {
    expect(normalizeName("  Desktop-01  ")).toBe("DESKTOP-01");
    expect(normalizeName(null)).toBeNull();
  });

  it("safeJsonParse returns parsed value or fallback", () => {
    expect(safeJsonParse('{"a":1}', {})).toEqual({ a: 1 });
    expect(safeJsonParse("not json", "fallback")).toBe("fallback");
    expect(safeJsonParse(null, [])).toEqual([]);
  });

  it("extractRawDeviceId pulls deviceId from raw JSON", () => {
    expect(extractRawDeviceId('{"deviceId":"abc-123"}')).toBe("ABC-123");
    expect(extractRawDeviceId('{"deviceId":""}')).toBeNull();
    expect(extractRawDeviceId('{"other":"val"}')).toBeNull();
    expect(extractRawDeviceId(null)).toBeNull();
  });
});

describe("ConfigMgr management agent detection", () => {
  it("detects standalone and co-managed Configuration Manager agent values", () => {
    expect(hasConfigMgrClient("configurationManagerClient")).toBe(true);
    expect(hasConfigMgrClient("configurationManagerClientMdm")).toBe(true);
    expect(hasConfigMgrClient("configurationManagerClientMdmEasIntuneClient")).toBe(true);
  });

  it("does not treat native Intune or missing managementAgent as ConfigMgr", () => {
    expect(hasConfigMgrClient("mdm")).toBe(false);
    expect(hasConfigMgrClient("easMdm")).toBe(false);
    expect(hasConfigMgrClient(null)).toBe(false);
    expect(hasConfigMgrClient(undefined)).toBe(false);
  });
});

describe("correlation engine", () => {
  it("matches by azureActiveDirectoryDeviceId before serial fallback", () => {
    const results = correlateDevices({
      autopilotRows: [
        {
          id: "auto-1",
          serial_number: null,
          model: null,
          manufacturer: null,
          group_tag: "North",
          assigned_user_upn: null,
          deployment_profile_id: null,
          deployment_profile_name: null,
          profile_assignment_status: null,
          deployment_mode: null,
          entra_device_id: "aad-device-1",
          first_seen_at: null,
          first_profile_assigned_at: null,
          last_synced_at: "2026-04-06T00:00:00.000Z",
          raw_json: JSON.stringify({ deviceId: "aad-device-1" })
        }
      ],
      intuneRows: [
        {
          id: "int-1",
          device_name: "DESKTOP-01",
          serial_number: null,
          entra_device_id: "aad-device-1",
          os_version: null,
          compliance_state: null,
          enrollment_type: null,
          managed_device_owner_type: null,
          last_sync_datetime: null,
          primary_user_upn: null,
          enrollment_profile_name: null,
          autopilot_enrolled: 1,
          management_agent: null,
          last_synced_at: "2026-04-06T00:00:00.000Z",
          raw_json: JSON.stringify({ deviceId: "aad-device-1" })
        }
      ],
      entraRows: [
        {
          id: "entra-1",
          device_id: "aad-device-1",
          display_name: "DESKTOP-01",
          serial_number: null,
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
    expect(results[0].matchedOn).toBe("entra_device_id");
    expect(results[0].matchConfidence).toBe("high");
    expect(results[0].identityConflict).toBe(false);
  });

  // --- Workstream 2: per-pair (weakest-link) confidence ---

  const ap = (overrides: Partial<{ id: string; serial: string | null; entra: string | null; deviceId: string | null }> = {}) => ({
    id: overrides.id ?? "ap-1",
    serial_number: overrides.serial ?? null,
    model: null,
    manufacturer: null,
    group_tag: null,
    assigned_user_upn: null,
    deployment_profile_id: null,
    deployment_profile_name: null,
    profile_assignment_status: null,
    deployment_mode: null,
    entra_device_id: overrides.entra ?? null,
    first_seen_at: null,
    first_profile_assigned_at: null,
    last_synced_at: "2026-04-08T00:00:00.000Z",
    raw_json: overrides.deviceId ? JSON.stringify({ deviceId: overrides.deviceId }) : "{}"
  });

  const intune = (overrides: Partial<{ id: string; name: string | null; serial: string | null; entra: string | null; deviceId: string | null }> = {}) => ({
    id: overrides.id ?? "in-1",
    device_name: overrides.name ?? null,
    serial_number: overrides.serial ?? null,
    entra_device_id: overrides.entra ?? null,
    os_version: null,
    compliance_state: null,
    enrollment_type: null,
    managed_device_owner_type: null,
    last_sync_datetime: null,
    primary_user_upn: null,
    enrollment_profile_name: null,
    autopilot_enrolled: 1,
    management_agent: null,
    last_synced_at: "2026-04-08T00:00:00.000Z",
    raw_json: overrides.deviceId ? JSON.stringify({ deviceId: overrides.deviceId }) : "{}"
  });

  const entra = (overrides: Partial<{ id: string; name: string | null; serial: string | null; deviceId: string | null }> = {}) => ({
    id: overrides.id ?? "en-1",
    device_id: overrides.deviceId ?? null,
    display_name: overrides.name ?? null,
    serial_number: overrides.serial ?? null,
    trust_type: "ServerAd",
    is_managed: 1,
    mdm_app_id: null,
    registration_datetime: null,
    device_physical_ids: JSON.stringify([]),
    last_synced_at: "2026-04-08T00:00:00.000Z",
    raw_json: "{}"
  });

  it("reports weakest pair when AP↔IN match by serial but IN↔Entra only by name", () => {
    // AP and IN share serial. AP and Entra share entra_device_id (so the
    // seed-from-AP traversal can pull in all three records). IN and Entra
    // however share NO key except their display name. Old code would have
    // reported high/serial because some record had a serial; the new code
    // must report low/device_name because the IN↔Entra pair is name-only
    // and that is the weakest link in the chain.
    const results = correlateDevices({
      autopilotRows: [ap({ serial: "CZC500", entra: "aad-device-1" })],
      intuneRows: [intune({ serial: "CZC500", name: "KIOSK-A" })],
      entraRows: [entra({ id: "entra-1", deviceId: "aad-device-1", name: "KIOSK-A" })]
    });

    expect(results).toHaveLength(1);
    expect(results[0].matchConfidence).toBe("low");
    expect(results[0].matchedOn).toBe("device_name");
    expect(results[0].autopilotRecord).not.toBeNull();
    expect(results[0].intuneRecord).not.toBeNull();
    expect(results[0].entraRecord).not.toBeNull();
  });

  it("reports high when the only joining key is azureActiveDirectoryDeviceId", () => {
    // AP and IN share entra_device_id E1 but have different serials. They
    // should join via entra id (medium) rather than overclaim "high via
    // serial" just because one of the records has a serial of its own.
    const results = correlateDevices({
      autopilotRows: [ap({ serial: "CZC111", entra: "entra-E1" })],
      intuneRows: [intune({ serial: "CZC222", entra: "entra-E1", name: "DESKTOP-02" })],
      entraRows: []
    });

    expect(results).toHaveLength(1);
    expect(results[0].matchConfidence).toBe("high");
    expect(results[0].matchedOn).toBe("entra_device_id");
  });

  it("treats single-record bundles as high (no cross-system claim being made)", () => {
    const results = correlateDevices({
      autopilotRows: [ap({ id: "ap-only", serial: "CZC999" })],
      intuneRows: [],
      entraRows: []
    });

    expect(results).toHaveLength(1);
    expect(results[0].matchConfidence).toBe("high");
    expect(results[0].matchedOn).toBe("serial");
    expect(results[0].intuneRecord).toBeNull();
    expect(results[0].entraRecord).toBeNull();
  });

  it("name-only single record is still high (the lone record is honest about itself)", () => {
    const results = correlateDevices({
      autopilotRows: [],
      intuneRows: [intune({ id: "in-only", name: "DESKTOP-03" })],
      entraRows: []
    });

    expect(results).toHaveLength(1);
    // No cross-system pair exists, so confidence is high but matchedOn
    // surfaces the weakest identifier the lone record carries — name.
    expect(results[0].matchConfidence).toBe("high");
    expect(results[0].matchedOn).toBe("device_name");
  });

  // --- Workstream 2 slice 3: generalized identityConflict detection ---

  it("flags identity conflict when AP and IN share entra_device_id but have different serials", () => {
    // Casino re-image collision: same Entra object picked up by a
    // freshly imaged machine whose serial differs from the old record.
    // The old detector only checked AP↔IN entra_device_id disagreement
    // (which this case does NOT have) so it silently passed.
    const results = correlateDevices({
      autopilotRows: [ap({ serial: "CZC111", entra: "entra-shared" })],
      intuneRows: [
        intune({ serial: "CZC222", entra: "entra-shared", name: "DESKTOP-X" })
      ],
      entraRows: []
    });

    expect(results).toHaveLength(1);
    expect(results[0].identityConflict).toBe(true);
  });

  it("flags identity conflict when AP and Entra disagree on serial", () => {
    // AP and Entra both have entra_device_id = "entra-9" (so they bundle
    // together) but their serials contradict. Old detector missed this
    // because it only compared entra_device_id across AP↔IN.
    const results = correlateDevices({
      autopilotRows: [ap({ serial: "CZC900", entra: "aad-device-9" })],
      intuneRows: [],
      entraRows: [entra({ id: "entra-9", deviceId: "aad-device-9", serial: "CZC999", name: "WS-9" })]
    });

    expect(results).toHaveLength(1);
    expect(results[0].identityConflict).toBe(true);
  });

  it("does NOT flag identity conflict when records only disagree on display name", () => {
    // Same physical device showing up with different rendered names
    // (DESKTOP-A vs desktop-a.corp.example) is legitimate, not a conflict.
    const results = correlateDevices({
      autopilotRows: [ap({ serial: "CZC300", entra: "aad-device-3" })],
      intuneRows: [intune({ serial: "CZC300", entra: "aad-device-3", name: "POS-A" })],
      entraRows: [entra({ id: "entra-3", deviceId: "aad-device-3", name: "pos-a.corp.example" })]
    });

    expect(results).toHaveLength(1);
    expect(results[0].identityConflict).toBe(false);
  });

  it("does NOT flag identity conflict when one side of a strong key is simply missing", () => {
    // AP has no entra_device_id and no raw_json deviceId. IN has both.
    // They share serial. No contradiction — AP just didn't record the
    // other identifiers. Must not be flagged as a conflict.
    const results = correlateDevices({
      autopilotRows: [ap({ serial: "CZC400" })],
      intuneRows: [intune({ serial: "CZC400", entra: "entra-4", deviceId: "dev-4", name: "POS-B" })],
      entraRows: []
    });

    expect(results).toHaveLength(1);
    expect(results[0].identityConflict).toBe(false);
  });

  it("two-record bundle (AP+Entra) joined by azureActiveDirectoryDeviceId reports high", () => {
    // Pre-fix bug: AP has a serial, so the old code reported high/serial
    // even though the AP↔Entra pair is actually joined by entra_device_id.
    // The new code must surface high/entra_device_id — the truth.
    const results = correlateDevices({
      autopilotRows: [ap({ serial: "CZC700", entra: "aad-device-7" })],
      intuneRows: [],
      entraRows: [entra({ id: "entra-7", deviceId: "aad-device-7", name: "WS-7" })]
    });

    expect(results).toHaveLength(1);
    expect(results[0].matchConfidence).toBe("high");
    expect(results[0].matchedOn).toBe("entra_device_id");
    expect(results[0].autopilotRecord).not.toBeNull();
    expect(results[0].entraRecord).not.toBeNull();
  });
});
