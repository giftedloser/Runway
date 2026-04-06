import type Database from "better-sqlite3";

import { computeAllDeviceStates } from "../engine/compute-all-device-states.js";
import { persistSnapshot } from "../sync/persist.js";
import type { SnapshotPayload } from "../sync/types.js";

function isoOffset(hoursAgo: number) {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

function buildMockPayload(): SnapshotPayload {
  const now = new Date().toISOString();
  const payload: SnapshotPayload = {
    autopilotRows: [],
    intuneRows: [],
    entraRows: [],
    groupRows: [
      {
        id: "grp-lodge-devices",
        display_name: "AP-Lodge-Devices",
        membership_rule: '(device.devicePhysicalIds -any (_ -contains "[OrderID]:Lodge"))',
        membership_rule_processing_state: "On",
        membership_type: "DynamicMembership",
        last_synced_at: now,
        raw_json: JSON.stringify({ id: "grp-lodge-devices" })
      },
      {
        id: "grp-lodge-hybrid",
        display_name: "AP-Lodge-Hybrid",
        membership_rule: '(device.devicePhysicalIds -any (_ -contains "[OrderID]:Lodge-Hybrid"))',
        membership_rule_processing_state: "On",
        membership_type: "DynamicMembership",
        last_synced_at: now,
        raw_json: JSON.stringify({ id: "grp-lodge-hybrid" })
      },
      {
        id: "grp-bhk-devices",
        display_name: "AP-BHK-Devices",
        membership_rule: '(device.devicePhysicalIds -any (_ -contains "[OrderID]:BHK"))',
        membership_rule_processing_state: "On",
        membership_type: "DynamicMembership",
        last_synced_at: now,
        raw_json: JSON.stringify({ id: "grp-bhk-devices" })
      },
      {
        id: "grp-kiosk-devices",
        display_name: "AP-Kiosk-Devices",
        membership_rule: '(device.devicePhysicalIds -any (_ -contains "[OrderID]:Kiosk"))',
        membership_rule_processing_state: "On",
        membership_type: "DynamicMembership",
        last_synced_at: now,
        raw_json: JSON.stringify({ id: "grp-kiosk-devices" })
      }
    ],
    membershipRows: [],
    profileRows: [
      {
        id: "prof-lodge-user",
        display_name: "AP-Lodge-UserDriven",
        deployment_mode: "userDriven",
        out_of_box_experience: JSON.stringify({ privacySettingsHidden: true, userType: "standard" }),
        hybrid_join_config: null,
        assigned_group_ids: JSON.stringify(["grp-lodge-devices"]),
        last_synced_at: now,
        raw_json: JSON.stringify({ id: "prof-lodge-user" })
      },
      {
        id: "prof-lodge-hybrid",
        display_name: "AP-Lodge-Hybrid",
        deployment_mode: "userDriven",
        out_of_box_experience: JSON.stringify({ privacySettingsHidden: true, userType: "standard" }),
        hybrid_join_config: JSON.stringify({
          domain: "bhwk.com",
          ou: "OU=Autopilot,OU=Workstations,DC=bhwk,DC=com"
        }),
        assigned_group_ids: JSON.stringify(["grp-lodge-hybrid"]),
        last_synced_at: now,
        raw_json: JSON.stringify({ id: "prof-lodge-hybrid" })
      },
      {
        id: "prof-bhk-user",
        display_name: "AP-BHK-UserDriven",
        deployment_mode: "userDriven",
        out_of_box_experience: JSON.stringify({ privacySettingsHidden: true, userType: "standard" }),
        hybrid_join_config: null,
        assigned_group_ids: JSON.stringify(["grp-bhk-devices"]),
        last_synced_at: now,
        raw_json: JSON.stringify({ id: "prof-bhk-user" })
      },
      {
        id: "prof-kiosk-self",
        display_name: "AP-Kiosk-SelfDeploying",
        deployment_mode: "selfDeploying",
        out_of_box_experience: JSON.stringify({ privacySettingsHidden: true, userType: "administrator" }),
        hybrid_join_config: null,
        assigned_group_ids: JSON.stringify(["grp-kiosk-devices"]),
        last_synced_at: now,
        raw_json: JSON.stringify({ id: "prof-kiosk-self" })
      }
    ],
    profileAssignmentRows: [
      { profile_id: "prof-lodge-user", group_id: "grp-lodge-devices", last_synced_at: now },
      { profile_id: "prof-lodge-hybrid", group_id: "grp-lodge-hybrid", last_synced_at: now },
      { profile_id: "prof-bhk-user", group_id: "grp-bhk-devices", last_synced_at: now },
      { profile_id: "prof-kiosk-self", group_id: "grp-kiosk-devices", last_synced_at: now }
    ],
    tagConfigRows: [
      {
        groupTag: "Lodge",
        expectedProfileNames: ["AP-Lodge-UserDriven", "AP-Lodge-Hybrid"],
        expectedGroupNames: ["AP-Lodge-Devices", "AP-Lodge-Hybrid"],
        propertyLabel: "Lodge / Gilpin"
      },
      {
        groupTag: "BHK",
        expectedProfileNames: ["AP-BHK-UserDriven"],
        expectedGroupNames: ["AP-BHK-Devices"],
        propertyLabel: "Black Hawk"
      },
      {
        groupTag: "Kiosk",
        expectedProfileNames: ["AP-Kiosk-SelfDeploying"],
        expectedGroupNames: ["AP-Kiosk-Devices"],
        propertyLabel: "Kiosk"
      }
    ]
  };

  const scenarios = [
    ...Array.from({ length: 18 }, (_, index) => ({
      kind: "healthy",
      tag: index < 8 ? "Lodge" : index < 14 ? "BHK" : "Kiosk",
      serial: `CZC10${(index + 1).toString().padStart(4, "0")}`
    })),
    { kind: "hybrid_risk", tag: "Lodge", serial: "CZC2000001" },
    { kind: "hybrid_risk", tag: "Lodge", serial: "CZC2000002" },
    { kind: "hybrid_risk", tag: "Lodge", serial: "CZC2000003" },
    { kind: "no_profile", tag: "Lodge", serial: "CZC3000001" },
    { kind: "no_profile", tag: "BHK", serial: "CZC3000002" },
    { kind: "group_miss", tag: "Lodge", serial: "CZC4000001" },
    { kind: "group_miss", tag: "BHK", serial: "CZC4000002" },
    { kind: "user_mismatch", tag: "Lodge", serial: "CZC5000001" },
    { kind: "user_mismatch", tag: "BHK", serial: "CZC5000002" },
    { kind: "tag_mismatch", tag: "Lodge", serial: "CZC6000001" },
    { kind: "tag_mismatch", tag: "BHK", serial: "CZC6000002" },
    { kind: "orphaned", tag: "Kiosk", serial: "CZC7000001" },
    { kind: "orphaned", tag: "Lodge", serial: "CZC7000002" },
    { kind: "no_autopilot", tag: "Lodge", serial: "CZC8000001" },
    { kind: "no_autopilot", tag: "BHK", serial: "CZC8000002" },
    { kind: "identity_conflict", tag: "Lodge", serial: "CZC9000001" },
    { kind: "not_enrolled", tag: "BHK", serial: "CZC9000002" },
    { kind: "drift_seed", tag: "Lodge", serial: "CZC9000003" }
  ];

  scenarios.forEach((scenario, index) => {
    const seq = index + 1;
    const name = `DESKTOP-${scenario.tag}-${seq.toString().padStart(3, "0")}`;
    const entraId = `entra-${seq}`;
    const deviceId = `device-${seq}`;
    const autopilotId = `auto-${seq}`;
    const intuneId = `int-${seq}`;
    const baseProfile =
      scenario.tag === "Lodge"
        ? "prof-lodge-user"
        : scenario.tag === "BHK"
          ? "prof-bhk-user"
          : "prof-kiosk-self";
    const profileName =
      scenario.tag === "Lodge"
        ? "AP-Lodge-UserDriven"
        : scenario.tag === "BHK"
          ? "AP-BHK-UserDriven"
          : "AP-Kiosk-SelfDeploying";
    const groupId =
      scenario.tag === "Lodge"
        ? "grp-lodge-devices"
        : scenario.tag === "BHK"
          ? "grp-bhk-devices"
          : "grp-kiosk-devices";
    const user = `user${seq}@bhwk.com`;

    if (scenario.kind !== "no_autopilot") {
      payload.autopilotRows.push({
        id: autopilotId,
        serial_number: scenario.serial,
        model: "EliteBook",
        manufacturer: "HP",
        group_tag: scenario.tag,
        assigned_user_upn:
          scenario.kind === "tag_mismatch" && scenario.tag === "Kiosk" ? null : user,
        deployment_profile_id:
          scenario.kind === "no_profile" ? null : scenario.kind === "tag_mismatch" && scenario.tag === "Lodge" ? "prof-bhk-user" : scenario.kind === "hybrid_risk" ? "prof-lodge-hybrid" : baseProfile,
        deployment_profile_name:
          scenario.kind === "no_profile"
            ? null
            : scenario.kind === "tag_mismatch" && scenario.tag === "Lodge"
              ? "AP-BHK-UserDriven"
              : scenario.kind === "hybrid_risk"
                ? "AP-Lodge-Hybrid"
                : profileName,
        profile_assignment_status:
          scenario.kind === "group_miss" ? "pending" : scenario.kind === "no_profile" ? "notAssigned" : "assigned",
        deployment_mode:
          scenario.tag === "Kiosk" ? "selfDeploying" : "userDriven",
        entra_device_id:
          scenario.kind === "identity_conflict" ? `${entraId}-stale` : entraId,
        first_seen_at: isoOffset(48),
        first_profile_assigned_at:
          scenario.kind === "not_enrolled" ? isoOffset(6) : isoOffset(12),
        last_synced_at: now,
        raw_json: JSON.stringify({ id: autopilotId, serialNumber: scenario.serial, deviceId })
      });
    }

    if (!["orphaned", "not_enrolled"].includes(scenario.kind)) {
      payload.intuneRows.push({
        id: intuneId,
        device_name: name,
        serial_number: scenario.serial,
        entra_device_id: entraId,
        os_version: "Windows 11 24H2",
        compliance_state: scenario.kind === "drift_seed" ? "compliant" : "compliant",
        enrollment_type: "windowsBulkUserless",
        managed_device_owner_type: "company",
        last_sync_datetime: scenario.kind === "group_miss" ? isoOffset(10) : isoOffset(1),
        primary_user_upn: scenario.kind === "user_mismatch" ? `other${seq}@bhwk.com` : user,
        enrollment_profile_name: profileName,
        autopilot_enrolled: 1,
        last_synced_at: now,
        raw_json: JSON.stringify({ id: intuneId, deviceName: name, deviceId })
      });
    }

    payload.entraRows.push({
      id: entraId,
      device_id: deviceId,
      display_name: name,
      serial_number: scenario.serial,
      trust_type:
        scenario.kind === "hybrid_risk" ? "AzureAd" : scenario.kind === "orphaned" ? "ServerAd" : scenario.tag === "Kiosk" ? "AzureAd" : "ServerAd",
      is_managed: 1,
      mdm_app_id: "0000000a-0000-0000-c000-000000000000",
      registration_datetime: isoOffset(24),
      device_physical_ids:
        scenario.kind === "identity_conflict"
          ? JSON.stringify(["[OrderID]:Lodge"])
          : JSON.stringify(["[ZTDId]:ABC123", `[OrderID]:${scenario.tag}`]),
      last_synced_at: now,
      raw_json: JSON.stringify({ id: entraId, deviceId, displayName: name })
    });

    const membershipTargets =
      scenario.kind === "group_miss"
        ? []
        : scenario.kind === "tag_mismatch" && scenario.tag === "Lodge"
          ? ["grp-bhk-devices"]
          : scenario.kind === "hybrid_risk"
            ? ["grp-lodge-hybrid"]
            : [groupId];

    membershipTargets.forEach((membershipGroupId) => {
      payload.membershipRows.push({
        group_id: membershipGroupId,
        member_device_id: entraId,
        last_synced_at: now
      });
    });
  });

  return payload;
}

export async function seedMockData(db: Database.Database) {
  const basePayload = buildMockPayload();
  persistSnapshot(db, basePayload);
  computeAllDeviceStates(db);

  const driftRow = basePayload.intuneRows.find((row) => row.serial_number === "CZC9000003");
  if (driftRow) {
    driftRow.compliance_state = "noncompliant";
    driftRow.last_synced_at = new Date().toISOString();
    driftRow.raw_json = JSON.stringify({
      ...JSON.parse(driftRow.raw_json ?? "{}"),
      complianceState: "noncompliant"
    });
  }

  persistSnapshot(db, basePayload);
  computeAllDeviceStates(db);
}
