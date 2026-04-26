import type Database from "better-sqlite3";

import { computeAllDeviceStates } from "../engine/compute-all-device-states.js";
import { persistSnapshot } from "../sync/persist.js";
import type { SnapshotPayload } from "../sync/types.js";

function isoOffset(hoursAgo: number) {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
}

// ── Hardware variety ─────────────────────────────────────────────────
const HW = [
  { model: "EliteBook 840 G10", manufacturer: "HP", os: "Windows 11 24H2" },
  { model: "EliteBook 850 G9", manufacturer: "HP", os: "Windows 11 23H2" },
  { model: "EliteDesk 800 G9", manufacturer: "HP", os: "Windows 11 24H2" },
  { model: "Latitude 5540", manufacturer: "Dell", os: "Windows 11 24H2" },
  { model: "Latitude 7440", manufacturer: "Dell", os: "Windows 11 23H2" },
  { model: "OptiPlex 7010", manufacturer: "Dell", os: "Windows 11 24H2" },
  { model: "ThinkPad T14s Gen 4", manufacturer: "Lenovo", os: "Windows 11 24H2" },
  { model: "ThinkCentre M90q Gen 4", manufacturer: "Lenovo", os: "Windows 11 23H2" },
  { model: "Surface Pro 10", manufacturer: "Microsoft", os: "Windows 11 24H2" },
  { model: "Surface Laptop 6", manufacturer: "Microsoft", os: "Windows 11 24H2" }
];

function pickHw(index: number) {
  return HW[index % HW.length];
}

// ── Compliance policies ──────────────────────────────────────────────
const COMPLIANCE_POLICIES = [
  { id: "cp-bitlocker", name: "BitLocker Encryption Required", desc: "Requires BitLocker full-disk encryption on all drives", platform: "windows10" },
  { id: "cp-firewall", name: "Windows Firewall Enabled", desc: "Ensures Windows Defender Firewall is active on all profiles", platform: "windows10" },
  { id: "cp-password", name: "Password Complexity Policy", desc: "Minimum 12 characters, complexity enabled, 90-day expiry", platform: "windows10" },
  { id: "cp-os-version", name: "Minimum OS Version (24H2)", desc: "Device must run Windows 11 build 26100 or later", platform: "windows10" },
  { id: "cp-defender", name: "Defender Antivirus Active", desc: "Windows Defender real-time protection must be enabled", platform: "windows10" },
  { id: "cp-tpm", name: "TPM 2.0 Attestation", desc: "Trusted Platform Module 2.0 must be present and healthy", platform: "windows10" }
];

// ── Config profiles ──────────────────────────────────────────────────
const CONFIG_PROFILES = [
  { id: "cfg-wifi-corp", name: "Corporate Wi-Fi", desc: "802.1X EAP-TLS corporate network", platform: "windows10", type: "wifi" },
  { id: "cfg-vpn-always", name: "Always-On VPN", desc: "IKEv2 tunnel to DC with device cert", platform: "windows10", type: "vpn" },
  { id: "cfg-bitlocker", name: "BitLocker Encryption", desc: "XTS-AES 256 full disk, TPM+PIN", platform: "windows10", type: "endpointProtection" },
  { id: "cfg-windows-update", name: "Windows Update for Business", desc: "Feature deferral 30 days, quality deferral 7 days", platform: "windows10", type: "windowsUpdateForBusiness" },
  { id: "cfg-defender-atp", name: "Defender for Endpoint", desc: "Onboarding config and ASR rules", platform: "windows10", type: "windowsDefenderAdvancedThreatProtection" }
];

// ── Apps ─────────────────────────────────────────────────────────────
const APPS = [
  { id: "app-teams", name: "Microsoft Teams", type: "microsoftStoreForBusinessApp", publisher: "Microsoft" },
  { id: "app-chrome", name: "Google Chrome Enterprise", type: "win32LobApp", publisher: "Google" },
  { id: "app-zoom", name: "Zoom Workplace", type: "win32LobApp", publisher: "Zoom Video Communications" },
  { id: "app-7zip", name: "7-Zip", type: "win32LobApp", publisher: "Igor Pavlov" },
  { id: "app-reader", name: "Adobe Acrobat Reader", type: "win32LobApp", publisher: "Adobe" },
  { id: "app-crowdstrike", name: "CrowdStrike Falcon Sensor", type: "win32LobApp", publisher: "CrowdStrike" },
  { id: "app-onedrive", name: "OneDrive", type: "microsoftStoreForBusinessApp", publisher: "Microsoft" }
];

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
      },
      {
        id: "grp-all-autopilot",
        display_name: "All-Autopilot-Devices",
        membership_rule: null,
        membership_rule_processing_state: null,
        membership_type: "Assigned",
        last_synced_at: now,
        raw_json: JSON.stringify({ id: "grp-all-autopilot" })
      },
      {
        id: "grp-vip-devices",
        display_name: "VIP-Executive-Devices",
        membership_rule: null,
        membership_rule_processing_state: null,
        membership_type: "Assigned",
        last_synced_at: now,
        raw_json: JSON.stringify({ id: "grp-vip-devices" })
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
    ],
    // Phase 2-4 data
    compliancePolicies: COMPLIANCE_POLICIES.map((p) => ({
      id: p.id,
      display_name: p.name,
      description: p.desc,
      platform: p.platform,
      last_synced_at: now,
      raw_json: JSON.stringify(p)
    })),
    deviceComplianceStates: [],
    configProfiles: CONFIG_PROFILES.map((p) => ({
      id: p.id,
      display_name: p.name,
      description: p.desc,
      platform: p.platform,
      profile_type: p.type,
      last_synced_at: now,
      raw_json: JSON.stringify(p)
    })),
    deviceConfigStates: [],
    mobileApps: APPS.map((a) => ({
      id: a.id,
      display_name: a.name,
      description: null,
      app_type: a.type,
      publisher: a.publisher,
      last_synced_at: now,
      raw_json: JSON.stringify(a)
    })),
    deviceAppInstallStates: []
  };

  // ── Device scenarios ─────────────────────────────────────────────
  const scenarios = [
    // 18 healthy devices spread across tags with hardware variety
    ...Array.from({ length: 18 }, (_, index) => ({
      kind: "healthy",
      tag: index < 8 ? "Lodge" : index < 14 ? "BHK" : "Kiosk",
      serial: `CZC10${(index + 1).toString().padStart(4, "0")}`,
      hwIndex: index
    })),
    // Problem scenarios
    { kind: "hybrid_risk", tag: "Lodge", serial: "CZC2000001", hwIndex: 0 },
    { kind: "hybrid_risk", tag: "Lodge", serial: "CZC2000002", hwIndex: 1 },
    { kind: "hybrid_risk", tag: "Lodge", serial: "CZC2000003", hwIndex: 6 },
    { kind: "no_profile", tag: "Lodge", serial: "CZC3000001", hwIndex: 2 },
    { kind: "no_profile", tag: "BHK", serial: "CZC3000002", hwIndex: 3 },
    { kind: "group_miss", tag: "Lodge", serial: "CZC4000001", hwIndex: 4 },
    { kind: "group_miss", tag: "BHK", serial: "CZC4000002", hwIndex: 5 },
    { kind: "user_mismatch", tag: "Lodge", serial: "CZC5000001", hwIndex: 8 },
    { kind: "user_mismatch", tag: "BHK", serial: "CZC5000002", hwIndex: 9 },
    { kind: "tag_mismatch", tag: "Lodge", serial: "CZC6000001", hwIndex: 7 },
    { kind: "tag_mismatch", tag: "BHK", serial: "CZC6000002", hwIndex: 3 },
    { kind: "orphaned", tag: "Kiosk", serial: "CZC7000001", hwIndex: 5 },
    { kind: "orphaned", tag: "Lodge", serial: "CZC7000002", hwIndex: 2 },
    { kind: "no_autopilot", tag: "Lodge", serial: "CZC8000001", hwIndex: 4 },
    { kind: "no_autopilot", tag: "BHK", serial: "CZC8000002", hwIndex: 6 },
    { kind: "identity_conflict", tag: "Lodge", serial: "CZC9000001", hwIndex: 0 },
    { kind: "not_enrolled", tag: "BHK", serial: "CZC9000002", hwIndex: 1 },
    { kind: "drift_seed", tag: "Lodge", serial: "CZC9000003", hwIndex: 8 },
    // Additional realistic scenarios
    { kind: "stale_checkin", tag: "Lodge", serial: "CZC9100001", hwIndex: 3 },
    { kind: "stale_checkin", tag: "BHK", serial: "CZC9100002", hwIndex: 7 },
    { kind: "healthy", tag: "Lodge", serial: "CZC9200001", hwIndex: 9 },
    { kind: "healthy", tag: "BHK", serial: "CZC9200002", hwIndex: 8 },
    { kind: "healthy", tag: "Kiosk", serial: "CZC9200003", hwIndex: 5 }
  ];

  // Users per tag to create shared-user scenarios
  const userPool = {
    Lodge: ["mjarvis@bhwk.com", "jsmith@bhwk.com", "kgarcia@bhwk.com", "tchen@bhwk.com"],
    BHK: ["rpatel@bhwk.com", "lnguyen@bhwk.com", "dbrown@bhwk.com"],
    Kiosk: [null] // kiosks have no user
  };

  let complianceSeq = 0;
  let configSeq = 0;
  let appSeq = 0;

  scenarios.forEach((scenario, index) => {
    const seq = index + 1;
    const hw = pickHw(scenario.hwIndex);
    const name = `DESKTOP-${scenario.tag.toUpperCase()}-${seq.toString().padStart(3, "0")}`;
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
    const pool = userPool[scenario.tag as keyof typeof userPool] ?? userPool.Lodge;
    const user = pool[index % pool.length] ?? `user${seq}@bhwk.com`;

    // ── Autopilot record ─────────────────────────────────────────
    if (scenario.kind !== "no_autopilot") {
      payload.autopilotRows.push({
        id: autopilotId,
        serial_number: scenario.serial,
        model: hw.model,
        manufacturer: hw.manufacturer,
        group_tag: scenario.tag,
        assigned_user_upn:
          scenario.tag === "Kiosk" ? null : user,
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
        first_seen_at: isoOffset(48 + index * 2),
        first_profile_assigned_at:
          scenario.kind === "not_enrolled" ? isoOffset(6) : isoOffset(12 + index),
        last_synced_at: now,
        raw_json: JSON.stringify({
          id: autopilotId,
          serialNumber: scenario.serial,
          deviceId,
          model: hw.model,
          manufacturer: hw.manufacturer,
          groupTag: scenario.tag,
          deploymentProfileName: profileName,
          profileAssignmentStatus: scenario.kind === "group_miss" ? "pending" : "assigned"
        })
      });
    }

    // ── Intune record ────────────────────────────────────────────
    const lastSync = scenario.kind === "stale_checkin"
      ? isoOffset(336) // 14 days ago
      : scenario.kind === "group_miss"
        ? isoOffset(10)
        : isoOffset(1 + index * 0.3);

    if (!["orphaned", "not_enrolled"].includes(scenario.kind)) {
      payload.intuneRows.push({
        id: intuneId,
        device_name: name,
        serial_number: scenario.serial,
        entra_device_id: entraId,
        os_version: hw.os,
        compliance_state: scenario.kind === "drift_seed" ? "compliant" : "compliant",
        enrollment_type: scenario.tag === "Kiosk" ? "windowsAzureADJoin" : "windowsBulkUserless",
        managed_device_owner_type: "company",
        last_sync_datetime: lastSync,
        primary_user_upn: scenario.kind === "user_mismatch"
          ? `other${seq}@bhwk.com`
          : scenario.tag === "Kiosk"
            ? null
            : user,
        enrollment_profile_name: profileName,
        autopilot_enrolled: 1,
        // A subset of seeded devices pretend to be ConfigMgr co-managed so
        // the new SCCM-detection tile and rule field have realistic data
        // in the local/mock installation. Pick by id-suffix for stability
        // across runs.
        management_agent:
          Number(seq) % 4 === 0 ? "configurationManagerClientMdm" : "mdm",
        last_synced_at: now,
        raw_json: JSON.stringify({
          id: intuneId,
          deviceName: name,
          deviceId,
          serialNumber: scenario.serial,
          osVersion: hw.os,
          complianceState: "compliant",
          model: hw.model,
          manufacturer: hw.manufacturer,
          enrollmentType: scenario.tag === "Kiosk" ? "windowsAzureADJoin" : "windowsBulkUserless"
        })
      });
    }

    // ── Entra record ─────────────────────────────────────────────
    payload.entraRows.push({
      id: entraId,
      device_id: deviceId,
      display_name: name,
      serial_number: scenario.serial,
      trust_type:
        scenario.kind === "hybrid_risk" ? "AzureAd" : scenario.kind === "orphaned" ? "ServerAd" : scenario.tag === "Kiosk" ? "AzureAd" : "ServerAd",
      is_managed: 1,
      mdm_app_id: "0000000a-0000-0000-c000-000000000000",
      registration_datetime: isoOffset(24 + index * 3),
      device_physical_ids:
        scenario.kind === "identity_conflict"
          ? JSON.stringify(["[OrderID]:Lodge"])
          : JSON.stringify(["[ZTDId]:ABC123", `[OrderID]:${scenario.tag}`]),
      last_synced_at: now,
      raw_json: JSON.stringify({ id: entraId, deviceId, displayName: name, trustType: scenario.kind === "hybrid_risk" ? "AzureAd" : "ServerAd" })
    });

    // ── Group memberships ────────────────────────────────────────
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

    // Also add first 10 devices to the "All-Autopilot-Devices" group
    if (index < 10) {
      payload.membershipRows.push({
        group_id: "grp-all-autopilot",
        member_device_id: entraId,
        last_synced_at: now
      });
    }
    // Add VIP for first 3 Lodge devices
    if (scenario.tag === "Lodge" && index < 3) {
      payload.membershipRows.push({
        group_id: "grp-vip-devices",
        member_device_id: entraId,
        last_synced_at: now
      });
    }

    // ── Per-device compliance states ─────────────────────────────
    if (!["orphaned", "not_enrolled", "no_autopilot"].includes(scenario.kind)) {
      for (const policy of COMPLIANCE_POLICIES) {
        complianceSeq++;
        let state: string;
        if (scenario.kind === "healthy" || scenario.kind === "stale_checkin") {
          // Most healthy devices pass everything; a few have pending OS version
          state = policy.id === "cp-os-version" && hw.os.includes("23H2") ? "nonCompliant" : "compliant";
        } else if (scenario.kind === "drift_seed") {
          state = policy.id === "cp-bitlocker" ? "nonCompliant" : "compliant";
        } else if (scenario.kind === "group_miss" || scenario.kind === "no_profile") {
          state = policy.id === "cp-defender" ? "notApplicable" : "compliant";
        } else {
          // Problem devices: mix of states
          state = complianceSeq % 5 === 0 ? "nonCompliant"
            : complianceSeq % 7 === 0 ? "inGracePeriod"
              : "compliant";
        }

        payload.deviceComplianceStates!.push({
          id: `dcs-${complianceSeq}`,
          device_id: intuneId,
          policy_id: policy.id,
          policy_name: policy.name,
          state,
          last_reported_at: isoOffset(2 + (complianceSeq % 8)),
          last_synced_at: now
        });
      }
    }

    // ── Per-device config profile states ─────────────────────────
    if (!["orphaned", "not_enrolled", "no_autopilot"].includes(scenario.kind)) {
      for (const profile of CONFIG_PROFILES) {
        configSeq++;
        let state: string;
        if (scenario.kind === "healthy") {
          state = "succeeded";
        } else if (scenario.kind === "stale_checkin") {
          state = profile.id === "cfg-windows-update" ? "pending" : "succeeded";
        } else if (scenario.kind === "drift_seed") {
          state = profile.id === "cfg-bitlocker" ? "failed" : "succeeded";
        } else {
          state = configSeq % 6 === 0 ? "failed"
            : configSeq % 9 === 0 ? "conflict"
              : configSeq % 11 === 0 ? "pending"
                : "succeeded";
        }

        payload.deviceConfigStates!.push({
          id: `dcfg-${configSeq}`,
          device_id: intuneId,
          profile_id: profile.id,
          profile_name: profile.name,
          state,
          last_reported_at: isoOffset(1 + (configSeq % 6)),
          last_synced_at: now
        });
      }
    }

    // ── Per-device app install states ────────────────────────────
    if (!["orphaned", "not_enrolled", "no_autopilot"].includes(scenario.kind)) {
      for (const app of APPS) {
        appSeq++;
        let installState: string;
        let errorCode: string | null = null;

        if (scenario.kind === "healthy") {
          installState = "installed";
        } else if (scenario.kind === "stale_checkin") {
          installState = app.id === "app-crowdstrike" ? "pendingInstall" : "installed";
        } else if (scenario.kind === "drift_seed") {
          if (app.id === "app-chrome") {
            installState = "failed";
            errorCode = "0x87D1041C";
          } else {
            installState = "installed";
          }
        } else if (scenario.kind === "no_profile" || scenario.kind === "group_miss") {
          if (app.id === "app-zoom" || app.id === "app-reader") {
            installState = "failed";
            errorCode = app.id === "app-zoom" ? "0x87D300C9" : "0x80070002";
          } else {
            installState = appSeq % 4 === 0 ? "pendingInstall" : "installed";
          }
        } else {
          installState = appSeq % 8 === 0 ? "failed"
            : appSeq % 12 === 0 ? "pendingInstall"
              : "installed";
          if (installState === "failed") errorCode = "0x87D1041C";
        }

        payload.deviceAppInstallStates!.push({
          id: `dai-${appSeq}`,
          device_id: intuneId,
          app_id: app.id,
          app_name: app.name,
          install_state: installState,
          error_code: errorCode,
          last_synced_at: now
        });
      }
    }
  });

  return payload;
}

// ── Seed action log entries for the audit trail ──────────────────────
function seedActionLog(db: Database.Database) {
  const insert = db.prepare(
    `INSERT INTO action_log (device_serial, device_name, intune_id, action_type, triggered_by, triggered_at, graph_response_status, notes, bulk_run_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const sampleBulkRunId = "00000000-0000-4000-8000-000000000001";
  const actions = [
    { serial: "CZC100001", name: "DESKTOP-LODGE-001", intuneId: "int-1", action: "sync", by: "mjarvis@bhwk.com", hoursAgo: 2, status: 204, notes: "Sync initiated successfully." },
    { serial: "CZC100001", name: "DESKTOP-LODGE-001", intuneId: "int-1", action: "sync", by: "mjarvis@bhwk.com", hoursAgo: 26, status: 204, notes: "Sync initiated successfully." },
    { serial: "CZC100002", name: "DESKTOP-LODGE-002", intuneId: "int-2", action: "reboot", by: "mjarvis@bhwk.com", hoursAgo: 4, status: 204, notes: "Reboot command sent." },
    { serial: "CZC100003", name: "DESKTOP-LODGE-003", intuneId: "int-3", action: "rename", by: "jsmith@bhwk.com", hoursAgo: 8, status: 204, notes: "Renamed to DESKTOP-LODGE-EXEC." },
    { serial: "CZC100009", name: "DESKTOP-BHK-009", intuneId: "int-9", action: "sync", by: "rpatel@bhwk.com", hoursAgo: 1, status: 204, notes: "Sync initiated successfully." },
    { serial: "CZC100009", name: "DESKTOP-BHK-009", intuneId: "int-9", action: "rotate-laps", by: "rpatel@bhwk.com", hoursAgo: 12, status: 200, notes: "LAPS password rotated." },
    { serial: "CZC2000001", name: "DESKTOP-LODGE-019", intuneId: "int-19", action: "sync", by: "mjarvis@bhwk.com", hoursAgo: 3, status: 204, notes: "Sync initiated successfully." },
    { serial: "CZC5000001", name: "DESKTOP-LODGE-026", intuneId: "int-26", action: "change-primary-user", by: "mjarvis@bhwk.com", hoursAgo: 6, status: 204, notes: "Primary user changed to jsmith@bhwk.com." },
    { serial: "CZC100015", name: "DESKTOP-KIOSK-015", intuneId: "int-15", action: "autopilot-reset", by: "kgarcia@bhwk.com", hoursAgo: 48, status: 204, notes: "Autopilot reset initiated." },
    { serial: "CZC100015", name: "DESKTOP-KIOSK-015", intuneId: "int-15", action: "wipe", by: "mjarvis@bhwk.com", hoursAgo: 72, status: 204, notes: "Full wipe initiated." },
    { serial: "CZC9100001", name: "DESKTOP-LODGE-037", intuneId: "int-37", action: "sync", by: "mjarvis@bhwk.com", hoursAgo: 0.5, status: 504, notes: "Gateway timeout — device unreachable." },
    { serial: "CZC9100001", name: "DESKTOP-LODGE-037", intuneId: "int-37", action: "reboot", by: "mjarvis@bhwk.com", hoursAgo: 0.3, status: 504, notes: "Gateway timeout — device unreachable." },
    { serial: null, name: null, intuneId: null, action: "create_group", by: "mjarvis@bhwk.com", hoursAgo: 96, status: 201, notes: "VIP-Executive-Devices (Assigned) — Group created." },
    { serial: "CZC100001", name: "DESKTOP-LODGE-001", intuneId: "int-1", action: "add_to_group", by: "mjarvis@bhwk.com", hoursAgo: 95, status: 204, notes: "Group grp-vip-devices — Member added." },
    { serial: "CZC100010", name: "DESKTOP-BHK-010", intuneId: "int-10", action: "sync", by: "lnguyen@bhwk.com", hoursAgo: 5, status: 204, notes: "[bulk] Sync initiated successfully.", bulkRunId: sampleBulkRunId },
    { serial: "CZC100011", name: "DESKTOP-BHK-011", intuneId: "int-11", action: "sync", by: "lnguyen@bhwk.com", hoursAgo: 5, status: 204, notes: "[bulk] Sync initiated successfully.", bulkRunId: sampleBulkRunId }
  ];

  const txn = db.transaction(() => {
    for (const a of actions) {
      insert.run(
        a.serial,
        a.name,
        a.intuneId,
        a.action,
        a.by,
        isoOffset(a.hoursAgo),
        a.status,
        a.notes,
        "bulkRunId" in a ? a.bulkRunId : null
      );
    }
  });
  txn();
}

export async function seedMockData(db: Database.Database) {
  const basePayload = buildMockPayload();
  persistSnapshot(db, basePayload);
  computeAllDeviceStates(db);

  // Seed action log entries so the audit trail is populated
  seedActionLog(db);

  // Second pass: drift a device to noncompliant to generate history
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
