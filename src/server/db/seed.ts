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

// ── Conditional Access policies ─────────────────────────────────────
const CONDITIONAL_ACCESS_POLICIES = [
  {
    id: "ca-require-compliant-windows",
    name: "CA - Windows devices require compliance",
    state: "enabled",
    conditions: { platforms: { includePlatforms: ["windows"], excludePlatforms: [] } },
    grantControls: { operator: "AND", builtInControls: ["compliantDevice", "mfa"] },
    sessionControls: null
  },
  {
    id: "ca-report-only-admins",
    name: "CA - Admin portals require phishing-resistant MFA",
    state: "enabledForReportingButNotEnforced",
    conditions: { platforms: { includePlatforms: ["all"], excludePlatforms: [] } },
    grantControls: { operator: "AND", builtInControls: ["mfa"] },
    sessionControls: { signInFrequency: { value: 8, type: "hours", isEnabled: true } }
  },
  {
    id: "ca-block-legacy-auth",
    name: "CA - Block legacy authentication",
    state: "enabled",
    conditions: { platforms: { includePlatforms: ["all"], excludePlatforms: [] } },
    grantControls: { operator: "OR", builtInControls: ["block"] },
    sessionControls: null
  },
  {
    id: "ca-kiosk-report-only",
    name: "CA - Kiosk session controls pilot",
    state: "disabled",
    conditions: { platforms: { includePlatforms: ["windows"], excludePlatforms: [] } },
    grantControls: { operator: "AND", builtInControls: ["compliantDevice"] },
    sessionControls: { persistentBrowser: { mode: "never", isEnabled: true } }
  }
];

function buildMockPayload(): SnapshotPayload {
  const now = new Date().toISOString();
  const graphAssignment = (
    payload_kind: "app" | "config" | "compliance",
    payload_id: string,
    payload_name: string,
    group_id: string,
    intent: string | null = null
  ) => ({
    payload_kind,
    payload_id,
    payload_name,
    group_id,
    intent,
    target_type: "include" as const,
    raw_json: JSON.stringify({ id: payload_id, groupId: group_id, intent }),
    synced_at: now
  });
  const payload: SnapshotPayload = {
    autopilotRows: [],
    intuneRows: [],
    entraRows: [],
    groupRows: [
      {
        id: "grp-north-devices",
        display_name: "AP-North-Devices",
        membership_rule: '(device.devicePhysicalIds -any (_ -contains "[OrderID]:North"))',
        membership_rule_processing_state: "On",
        membership_type: "DynamicMembership",
        last_synced_at: now,
        raw_json: JSON.stringify({ id: "grp-north-devices" })
      },
      {
        id: "grp-north-hybrid",
        display_name: "AP-North-Hybrid",
        membership_rule: '(device.devicePhysicalIds -any (_ -contains "[OrderID]:North-Hybrid"))',
        membership_rule_processing_state: "On",
        membership_type: "DynamicMembership",
        last_synced_at: now,
        raw_json: JSON.stringify({ id: "grp-north-hybrid" })
      },
      {
        id: "grp-south-devices",
        display_name: "AP-South-Devices",
        membership_rule: '(device.devicePhysicalIds -any (_ -contains "[OrderID]:South"))',
        membership_rule_processing_state: "On",
        membership_type: "DynamicMembership",
        last_synced_at: now,
        raw_json: JSON.stringify({ id: "grp-south-devices" })
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
        id: "prof-north-user",
        display_name: "AP-North-UserDriven",
        deployment_mode: "userDriven",
        out_of_box_experience: JSON.stringify({ privacySettingsHidden: true, userType: "standard" }),
        hybrid_join_config: null,
        assigned_group_ids: JSON.stringify(["grp-north-devices"]),
        last_synced_at: now,
        raw_json: JSON.stringify({ id: "prof-north-user" })
      },
      {
        id: "prof-north-hybrid",
        display_name: "AP-North-Hybrid",
        deployment_mode: "userDriven",
        out_of_box_experience: JSON.stringify({ privacySettingsHidden: true, userType: "standard" }),
        hybrid_join_config: JSON.stringify({
          domain: "example.test",
          ou: "OU=Autopilot,OU=Workstations,DC=example,DC=test"
        }),
        assigned_group_ids: JSON.stringify(["grp-north-hybrid"]),
        last_synced_at: now,
        raw_json: JSON.stringify({ id: "prof-north-hybrid" })
      },
      {
        id: "prof-south-user",
        display_name: "AP-South-UserDriven",
        deployment_mode: "userDriven",
        out_of_box_experience: JSON.stringify({ privacySettingsHidden: true, userType: "standard" }),
        hybrid_join_config: null,
        assigned_group_ids: JSON.stringify(["grp-south-devices"]),
        last_synced_at: now,
        raw_json: JSON.stringify({ id: "prof-south-user" })
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
      { profile_id: "prof-north-user", group_id: "grp-north-devices", last_synced_at: now },
      { profile_id: "prof-north-hybrid", group_id: "grp-north-hybrid", last_synced_at: now },
      { profile_id: "prof-south-user", group_id: "grp-south-devices", last_synced_at: now },
      { profile_id: "prof-kiosk-self", group_id: "grp-kiosk-devices", last_synced_at: now }
    ],
    tagConfigRows: [
      {
        groupTag: "North",
        expectedProfileNames: ["AP-North-UserDriven", "AP-North-Hybrid"],
        expectedGroupNames: ["AP-North-Devices", "AP-North-Hybrid"],
        propertyLabel: "North / River"
      },
      {
        groupTag: "South",
        expectedProfileNames: ["AP-South-UserDriven"],
        expectedGroupNames: ["AP-South-Devices"],
        propertyLabel: "South Campus"
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
    conditionalAccessPolicies: CONDITIONAL_ACCESS_POLICIES.map((policy) => ({
      id: policy.id,
      display_name: policy.name,
      state: policy.state,
      conditions_json: JSON.stringify(policy.conditions),
      grant_controls_json: JSON.stringify(policy.grantControls),
      session_controls_json: policy.sessionControls ? JSON.stringify(policy.sessionControls) : null,
      last_synced_at: now,
      raw_json: JSON.stringify(policy)
    })),
    mobileApps: APPS.map((a) => ({
      id: a.id,
      display_name: a.name,
      description: null,
      app_type: a.type,
      publisher: a.publisher,
      last_synced_at: now,
      raw_json: JSON.stringify(a)
    })),
    graphAssignments: [
      graphAssignment("app", "app-chrome", "Google Chrome Enterprise", "grp-north-devices", "required"),
      graphAssignment("app", "app-reader", "Adobe Acrobat Reader", "grp-north-devices", "required"),
      graphAssignment("app", "app-crowdstrike", "CrowdStrike Falcon Sensor", "grp-north-devices", "required"),
      graphAssignment("config", "cfg-bitlocker", "BitLocker Encryption", "grp-north-devices"),
      graphAssignment("config", "cfg-defender-atp", "Defender for Endpoint", "grp-north-devices"),
      graphAssignment("compliance", "cp-bitlocker", "BitLocker Encryption Required", "grp-north-devices"),
      graphAssignment("compliance", "cp-firewall", "Windows Firewall Enabled", "grp-north-devices"),
      graphAssignment("app", "app-teams", "Microsoft Teams", "grp-south-devices", "required"),
      graphAssignment("app", "app-chrome", "Google Chrome Enterprise", "grp-south-devices", "required"),
      graphAssignment("app", "app-zoom", "Zoom Workplace", "grp-south-devices", "required"),
      graphAssignment("app", "app-crowdstrike", "CrowdStrike Falcon Sensor", "grp-south-devices", "required"),
      graphAssignment("config", "cfg-wifi-corp", "Corporate Wi-Fi", "grp-south-devices"),
      graphAssignment("config", "cfg-windows-update", "Windows Update for Business", "grp-south-devices"),
      graphAssignment("compliance", "cp-password", "Password Complexity Policy", "grp-south-devices"),
      graphAssignment("compliance", "cp-os-version", "Minimum OS Version (24H2)", "grp-south-devices"),
      graphAssignment("app", "app-chrome", "Google Chrome Enterprise", "grp-kiosk-devices", "required"),
      graphAssignment("app", "app-7zip", "7-Zip", "grp-kiosk-devices", "required"),
      graphAssignment("config", "cfg-defender-atp", "Defender for Endpoint", "grp-kiosk-devices"),
      graphAssignment("config", "cfg-windows-update", "Windows Update for Business", "grp-kiosk-devices"),
      graphAssignment("compliance", "cp-defender", "Defender Antivirus Active", "grp-kiosk-devices"),
      graphAssignment("compliance", "cp-tpm", "TPM 2.0 Attestation", "grp-kiosk-devices")
    ],
    deviceAppInstallStates: []
  };

  // ── Device scenarios ─────────────────────────────────────────────
  const scenarios = [
    // Healthy devices should be the dominant state in demo mode. Keep them
    // spread across tags/hardware so fleet filters, profiles, groups, and
    // device-detail panels all have plenty of clean examples.
    ...Array.from({ length: 42 }, (_, index) => ({
      kind: "healthy",
      tag: index < 18 ? "North" : index < 33 ? "South" : "Kiosk",
      serial: `CZC10${(index + 1).toString().padStart(4, "0")}`,
      hwIndex: index
    })),
    // Problem scenarios
    { kind: "hybrid_risk", tag: "North", serial: "CZC2000001", hwIndex: 0 },
    { kind: "hybrid_risk", tag: "North", serial: "CZC2000002", hwIndex: 1 },
    { kind: "hybrid_risk", tag: "North", serial: "CZC2000003", hwIndex: 6 },
    { kind: "no_profile", tag: "North", serial: "CZC3000001", hwIndex: 2 },
    { kind: "no_profile", tag: "South", serial: "CZC3000002", hwIndex: 3 },
    { kind: "assignment_failed", tag: "North", serial: "CZC3100001", hwIndex: 7 },
    { kind: "assignment_failed", tag: "South", serial: "CZC3100002", hwIndex: 8 },
    { kind: "group_miss", tag: "North", serial: "CZC4000001", hwIndex: 4 },
    { kind: "group_miss", tag: "South", serial: "CZC4000002", hwIndex: 5 },
    { kind: "user_mismatch", tag: "North", serial: "CZC5000001", hwIndex: 8 },
    { kind: "user_mismatch", tag: "South", serial: "CZC5000002", hwIndex: 9 },
    { kind: "tag_mismatch", tag: "North", serial: "CZC6000001", hwIndex: 7 },
    { kind: "tag_mismatch", tag: "South", serial: "CZC6000002", hwIndex: 3 },
    { kind: "mode_mismatch", tag: "Kiosk", serial: "CZC6100001", hwIndex: 5 },
    { kind: "mode_conflict", tag: "North", serial: "CZC6100002", hwIndex: 6 },
    { kind: "orphaned", tag: "Kiosk", serial: "CZC7000001", hwIndex: 5 },
    { kind: "orphaned", tag: "North", serial: "CZC7000002", hwIndex: 2 },
    { kind: "no_autopilot", tag: "North", serial: "CZC8000001", hwIndex: 4 },
    { kind: "no_autopilot", tag: "South", serial: "CZC8000002", hwIndex: 6 },
    { kind: "identity_conflict", tag: "North", serial: "CZC9000001", hwIndex: 0 },
    { kind: "missing_ztdid", tag: "South", serial: "CZC9000004", hwIndex: 4 },
    { kind: "name_joined", tag: "North", serial: "CZC9000005", hwIndex: 2 },
    { kind: "not_enrolled", tag: "South", serial: "CZC9000002", hwIndex: 1 },
    { kind: "drift_seed", tag: "North", serial: "CZC9000003", hwIndex: 8 },
    // Additional realistic scenarios
    { kind: "stale_checkin", tag: "North", serial: "CZC9100001", hwIndex: 3 },
    { kind: "stale_checkin", tag: "South", serial: "CZC9100002", hwIndex: 7 },
    { kind: "provisioning_stalled", tag: "North", serial: "CZC9100003", hwIndex: 6 },
    { kind: "provisioning_stalled", tag: "South", serial: "CZC9100004", hwIndex: 1 },
    { kind: "healthy", tag: "North", serial: "CZC9200001", hwIndex: 9 },
    { kind: "healthy", tag: "South", serial: "CZC9200002", hwIndex: 8 },
    { kind: "healthy", tag: "Kiosk", serial: "CZC9200003", hwIndex: 5 }
  ];

  // Users per tag to create shared-user scenarios
  const userPool = {
    North: ["operator.one@example.test", "operator.two@example.test", "operator.three@example.test", "operator.four@example.test"],
    South: ["rpatel@example.test", "lnguyen@example.test", "dbrown@example.test"],
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
      scenario.tag === "North"
        ? "prof-north-user"
        : scenario.tag === "South"
          ? "prof-south-user"
          : "prof-kiosk-self";
    const profileName =
      scenario.tag === "North"
        ? "AP-North-UserDriven"
        : scenario.tag === "South"
          ? "AP-South-UserDriven"
          : "AP-Kiosk-SelfDeploying";
    const groupId =
      scenario.tag === "North"
        ? "grp-north-devices"
        : scenario.tag === "South"
          ? "grp-south-devices"
          : "grp-kiosk-devices";
    const pool = userPool[scenario.tag as keyof typeof userPool] ?? userPool.North;
    const user = pool[index % pool.length] ?? `user${seq}@example.test`;
    const isNameJoined = scenario.kind === "name_joined";
    const assignedUser =
      scenario.kind === "mode_mismatch"
        ? "kiosk.owner@example.test"
        : scenario.tag === "Kiosk"
          ? null
          : user;
    const intuneDeviceId = isNameJoined ? null : deviceId;
    const entraDeviceId = isNameJoined ? `${deviceId}-entra` : deviceId;
    const intuneEntraId = isNameJoined ? null : entraId;
    const intuneSerial = isNameJoined ? null : scenario.serial;
    const entraSerial = isNameJoined ? null : scenario.serial;

    // ── Autopilot record ─────────────────────────────────────────
    if (!["no_autopilot", "name_joined"].includes(scenario.kind)) {
      payload.autopilotRows.push({
        id: autopilotId,
        serial_number: scenario.serial,
        model: hw.model,
        manufacturer: hw.manufacturer,
        group_tag: scenario.tag,
        assigned_user_upn: assignedUser,
        deployment_profile_id:
          scenario.kind === "no_profile" ? null : scenario.kind === "tag_mismatch" && scenario.tag === "North" ? "prof-south-user" : scenario.kind === "hybrid_risk" ? "prof-north-hybrid" : baseProfile,
        deployment_profile_name:
          scenario.kind === "no_profile"
            ? null
            : scenario.kind === "tag_mismatch" && scenario.tag === "North"
              ? "AP-South-UserDriven"
              : scenario.kind === "hybrid_risk"
                ? "AP-North-Hybrid"
                : profileName,
        profile_assignment_status:
          scenario.kind === "assignment_failed"
            ? "assignmentFailed"
            : scenario.kind === "group_miss"
              ? "pending"
              : scenario.kind === "no_profile"
                ? "notAssigned"
                : "assigned",
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
          deploymentProfileName:
            scenario.kind === "no_profile"
              ? null
              : scenario.kind === "tag_mismatch" && scenario.tag === "North"
                ? "AP-South-UserDriven"
                : scenario.kind === "hybrid_risk"
                  ? "AP-North-Hybrid"
                  : profileName,
          profileAssignmentStatus:
            scenario.kind === "assignment_failed"
              ? "assignmentFailed"
              : scenario.kind === "group_miss"
                ? "pending"
                : scenario.kind === "no_profile"
                  ? "notAssigned"
                  : "assigned"
        })
      });
    }

    // ── Intune record ────────────────────────────────────────────
    const lastSync = scenario.kind === "stale_checkin"
      ? isoOffset(336) // 14 days ago
      : scenario.kind === "provisioning_stalled"
        ? isoOffset(72)
      : scenario.kind === "group_miss"
        ? isoOffset(10)
        : isoOffset(1 + index * 0.3);

    if (!["orphaned", "not_enrolled"].includes(scenario.kind)) {
      payload.intuneRows.push({
        id: intuneId,
        device_name: name,
        serial_number: intuneSerial,
        entra_device_id: intuneEntraId,
        os_version: hw.os,
        compliance_state:
          scenario.kind === "provisioning_stalled"
            ? "noncompliant"
            : scenario.kind === "drift_seed"
              ? "compliant"
              : "compliant",
        enrollment_type: scenario.tag === "Kiosk" ? "windowsAzureADJoin" : "windowsBulkUserless",
        managed_device_owner_type: "company",
        last_sync_datetime: lastSync,
        primary_user_upn: scenario.kind === "user_mismatch"
          ? `other${seq}@example.test`
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
          ...(intuneDeviceId ? { deviceId: intuneDeviceId } : {}),
          serialNumber: intuneSerial,
          osVersion: hw.os,
          complianceState: scenario.kind === "provisioning_stalled" ? "noncompliant" : "compliant",
          model: hw.model,
          manufacturer: hw.manufacturer,
          enrollmentType: scenario.tag === "Kiosk" ? "windowsAzureADJoin" : "windowsBulkUserless"
        })
      });
    }

    // ── Entra record ─────────────────────────────────────────────
    payload.entraRows.push({
      id: entraId,
      device_id: entraDeviceId,
      display_name: name,
      serial_number: entraSerial,
      trust_type:
        scenario.kind === "hybrid_risk" ? "AzureAd" : scenario.kind === "orphaned" ? "ServerAd" : scenario.tag === "Kiosk" ? "AzureAd" : "ServerAd",
      is_managed: 1,
      mdm_app_id: "0000000a-0000-0000-c000-000000000000",
      registration_datetime: isoOffset(24 + index * 3),
      device_physical_ids:
        scenario.kind === "identity_conflict" || scenario.kind === "missing_ztdid"
          ? JSON.stringify(["[OrderID]:North"])
          : JSON.stringify(["[ZTDID]:ABC123", `[OrderID]:${scenario.tag}`]),
      last_synced_at: now,
      raw_json: JSON.stringify({ id: entraId, deviceId: entraDeviceId, displayName: name, trustType: scenario.kind === "hybrid_risk" ? "AzureAd" : "ServerAd" })
    });

    // ── Group memberships ────────────────────────────────────────
    const membershipTargets =
      scenario.kind === "group_miss"
        ? []
        : scenario.kind === "no_profile"
          ? ["grp-all-autopilot"]
        : scenario.kind === "tag_mismatch" && scenario.tag === "North"
          ? ["grp-south-devices"]
          : scenario.kind === "mode_conflict"
            ? ["grp-north-devices", "grp-kiosk-devices"]
          : scenario.kind === "hybrid_risk"
            ? ["grp-north-hybrid"]
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
    // Add VIP for first 3 North devices
    if (scenario.tag === "North" && index < 3) {
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
    { serial: "CZC100001", name: "DESKTOP-NORTH-001", intuneId: "int-1", action: "sync", by: "operator.one@example.test", hoursAgo: 2, status: 204, notes: "Sync initiated successfully." },
    { serial: "CZC100001", name: "DESKTOP-NORTH-001", intuneId: "int-1", action: "sync", by: "operator.one@example.test", hoursAgo: 26, status: 204, notes: "Sync initiated successfully." },
    { serial: "CZC100002", name: "DESKTOP-NORTH-002", intuneId: "int-2", action: "reboot", by: "operator.one@example.test", hoursAgo: 4, status: 204, notes: "Reboot command sent." },
    { serial: "CZC100003", name: "DESKTOP-NORTH-003", intuneId: "int-3", action: "rename", by: "operator.two@example.test", hoursAgo: 8, status: 204, notes: "Renamed to DESKTOP-NORTH-EXEC." },
    { serial: "CZC100009", name: "DESKTOP-South-009", intuneId: "int-9", action: "sync", by: "rpatel@example.test", hoursAgo: 1, status: 204, notes: "Sync initiated successfully." },
    { serial: "CZC100009", name: "DESKTOP-South-009", intuneId: "int-9", action: "rotate-laps", by: "rpatel@example.test", hoursAgo: 12, status: 200, notes: "LAPS password rotated." },
    { serial: "CZC2000001", name: "DESKTOP-NORTH-043", intuneId: "int-43", action: "sync", by: "operator.one@example.test", hoursAgo: 3, status: 204, notes: "Sync initiated successfully." },
    { serial: "CZC5000001", name: "DESKTOP-NORTH-052", intuneId: "int-52", action: "change-primary-user", by: "operator.one@example.test", hoursAgo: 6, status: 204, notes: "Primary user changed to operator.two@example.test." },
    { serial: "CZC100015", name: "DESKTOP-KIOSK-015", intuneId: "int-15", action: "autopilot-reset", by: "operator.three@example.test", hoursAgo: 48, status: 204, notes: "Autopilot reset initiated." },
    { serial: "CZC100015", name: "DESKTOP-KIOSK-015", intuneId: "int-15", action: "wipe", by: "operator.one@example.test", hoursAgo: 72, status: 204, notes: "Full wipe initiated." },
    { serial: "CZC9100001", name: "DESKTOP-NORTH-067", intuneId: "int-67", action: "sync", by: "operator.one@example.test", hoursAgo: 0.5, status: 504, notes: "Gateway timeout — device unreachable." },
    { serial: "CZC9100001", name: "DESKTOP-NORTH-067", intuneId: "int-67", action: "reboot", by: "operator.one@example.test", hoursAgo: 0.3, status: 504, notes: "Gateway timeout — device unreachable." },
    { serial: null, name: null, intuneId: null, action: "create_group", by: "operator.one@example.test", hoursAgo: 96, status: 201, notes: "VIP-Executive-Devices (Assigned) — Group created." },
    { serial: "CZC100001", name: "DESKTOP-NORTH-001", intuneId: "int-1", action: "add_to_group", by: "operator.one@example.test", hoursAgo: 95, status: 204, notes: "Group grp-vip-devices — Member added." },
    { serial: "CZC100010", name: "DESKTOP-South-010", intuneId: "int-10", action: "sync", by: "lnguyen@example.test", hoursAgo: 5, status: 204, notes: "[bulk] Sync initiated successfully.", bulkRunId: sampleBulkRunId },
    { serial: "CZC100011", name: "DESKTOP-South-011", intuneId: "int-11", action: "sync", by: "lnguyen@example.test", hoursAgo: 5, status: 204, notes: "[bulk] Sync initiated successfully.", bulkRunId: sampleBulkRunId }
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
  // Clear tag_config first so reseeding can't leave behind hand-typed
  // entries from prior dev sessions (the live persist layer upserts and
  // would otherwise preserve them).
  db.prepare("DELETE FROM tag_config").run();
  // Mock mode is a showcase workspace, so turn on the ConfigMgr/SCCM signal
  // by default. Live installs still default this feature flag to off.
  db.prepare(
    `INSERT INTO feature_flags (key, enabled, updated_at)
     VALUES ('sccm_detection', 1, ?)
     ON CONFLICT(key) DO UPDATE SET
       enabled = excluded.enabled,
       updated_at = excluded.updated_at`
  ).run(new Date().toISOString());

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

  // Reset sync history so a freshly seeded DB shows a healthy "just now"
  // sync, not whatever stale attempts were logged in prior dev sessions.
  seedSyncHistory(db, basePayload.intuneRows.length);
}

function seedSyncHistory(db: Database.Database, devicesSynced: number) {
  db.prepare("DELETE FROM sync_log").run();
  const insert = db.prepare(
    "INSERT INTO sync_log (sync_type, started_at, completed_at, devices_synced, errors) VALUES (?, ?, ?, ?, '[]')"
  );
  // A small history of healthy runs leading up to "just now". Durations are
  // realistic enough to populate the success-rate / avg-duration tiles.
  // Ordered oldest → newest so the latest insert keeps the highest rowid
  // (listSyncLogs reads ORDER BY id DESC).
  const runs = [
    { hoursAgo: 24, durationMs: 2_100, type: "full" as const },
    { hoursAgo: 12, durationMs: 1_180, type: "incremental" as const },
    { hoursAgo: 4, durationMs: 1_320, type: "incremental" as const },
    { hoursAgo: 1.5, durationMs: 1_250, type: "incremental" as const },
    { hoursAgo: 0.05, durationMs: 1_400, type: "manual" as const }
  ];
  for (const run of runs) {
    const startedAt = isoOffset(run.hoursAgo);
    const completedAt = new Date(
      Date.parse(startedAt) + run.durationMs
    ).toISOString();
    insert.run(run.type, startedAt, completedAt, devicesSynced);
  }
}
