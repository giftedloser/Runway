/**
 * Dev-only scale seed.
 *
 * Generates ~4,500 synthetic devices spread across ~30 properties with a
 * realistic mix of healthy and problem scenarios so the dashboard, device
 * queue, tags inventory, provisioning lookups, and device-detail panels can
 * be eyeballed at fleet scale before tenant testing.
 *
 * Never runs in CI or the normal test suite. Invoke via:
 *   npm run db:seed:scale
 *
 * The script wipes and reseeds whatever DATABASE_PATH points at — do not
 * point it at a database you care about. It also prints rough query
 * timings at the end as a smoke benchmark, not a CI gate.
 */
import { getDb } from "./database.js";
import { runMigrations } from "./migrate.js";
import {
  countDevicesForProvisioningTag,
  devicesForProvisioningTag,
  listProvisioningTags
} from "./queries/provisioning.js";
import {
  getDashboard,
  getDeviceDetail,
  listDeviceStates
} from "./queries/devices.js";
import { computeAllDeviceStates } from "../engine/compute-all-device-states.js";
import { persistSnapshot } from "../sync/persist.js";
import type { SnapshotPayload } from "../sync/types.js";
import type {
  AutopilotRow,
  EntraRow,
  GroupMembershipRow,
  GroupRow,
  IntuneRow,
  ProfileAssignmentRow,
  ProfileRow
} from "./types.js";

const TARGET_DEVICE_COUNT = 4_500;
const PROPERTY_COUNT = 30;
const PROFILES_PER_DEPLOYMENT_MODE = 8;

type ScenarioKind =
  | "healthy"
  | "no_profile"
  | "not_in_target_group"
  | "user_mismatch"
  | "tag_mismatch"
  | "stalled"
  | "compliance_drift"
  | "orphan_autopilot"
  | "no_autopilot"
  | "hybrid_risk";

interface Scenario {
  kind: ScenarioKind;
  weight: number;
}

// ~75% healthy, ~25% spread across problem scenarios — close to a real
// pilot fleet, distinct enough to fill every breakpoint bucket.
const SCENARIOS: Scenario[] = [
  { kind: "healthy", weight: 75 },
  { kind: "no_profile", weight: 4 },
  { kind: "not_in_target_group", weight: 4 },
  { kind: "user_mismatch", weight: 3 },
  { kind: "tag_mismatch", weight: 3 },
  { kind: "stalled", weight: 3 },
  { kind: "compliance_drift", weight: 3 },
  { kind: "orphan_autopilot", weight: 2 },
  { kind: "no_autopilot", weight: 2 },
  { kind: "hybrid_risk", weight: 1 }
];

function pickScenario(rand: () => number): ScenarioKind {
  const total = SCENARIOS.reduce((sum, s) => sum + s.weight, 0);
  let pick = rand() * total;
  for (const scenario of SCENARIOS) {
    pick -= scenario.weight;
    if (pick <= 0) return scenario.kind;
  }
  return "healthy";
}

// Deterministic PRNG so successive runs of the script generate the same
// devices. Easier to compare timing across runs without random variance
// in row counts.
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0xc0ffee);

function isoOffset(hoursAgo: number): string {
  return new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, "0");
}

function buildScalePayload(): SnapshotPayload {
  const now = new Date().toISOString();

  // ── Properties / tags / groups ────────────────────────────────────
  const properties: string[] = Array.from(
    { length: PROPERTY_COUNT },
    (_, i) => `Property-${pad(i + 1, 2)}`
  );

  // Each property has a primary tag; a handful of properties have a
  // secondary tag too so the Tags view shows realistic per-tag device
  // counts and a few properties with multiple mappings.
  const tagsByProperty = properties.map((property, index) => {
    const tags = [`PROP-${pad(index + 1, 2)}`];
    if (index % 5 === 0) tags.push(`PROP-${pad(index + 1, 2)}-VIP`);
    return { property, tags };
  });
  const allTags: string[] = tagsByProperty.flatMap((t) => t.tags);

  const groupRows: GroupRow[] = tagsByProperty.flatMap(({ property, tags }) =>
    tags.map((tag) => ({
      id: `grp-${tag.toLowerCase()}`,
      display_name: `${property}-Devices`,
      membership_rule: `(device.devicePhysicalIds -any (_ -contains "[OrderID]:${tag}"))`,
      membership_rule_processing_state: "On",
      membership_type: "DynamicMembership",
      last_synced_at: now,
      raw_json: JSON.stringify({ id: `grp-${tag.toLowerCase()}` })
    }))
  );

  const profileRows: ProfileRow[] = Array.from(
    { length: PROFILES_PER_DEPLOYMENT_MODE * 2 },
    (_, i) => {
      const userDriven = i % 2 === 0;
      return {
        id: `prof-${pad(i + 1, 3)}`,
        display_name: `${userDriven ? "UserDriven" : "SelfDeploy"}-${pad(
          Math.floor(i / 2) + 1,
          2
        )}`,
        deployment_mode: userDriven ? "user" : "self",
        out_of_box_experience: null,
        hybrid_join_config: null,
        assigned_group_ids: null,
        last_synced_at: now,
        raw_json: JSON.stringify({ id: `prof-${pad(i + 1, 3)}` })
      };
    }
  );

  // Bind one profile per tag, round-robin.
  const profileAssignmentRows: ProfileAssignmentRow[] = allTags.map(
    (tag, index) => ({
      profile_id: profileRows[index % profileRows.length].id,
      group_id: `grp-${tag.toLowerCase()}`,
      last_synced_at: now
    })
  );

  // ── Devices ───────────────────────────────────────────────────────
  const autopilotRows: AutopilotRow[] = [];
  const intuneRows: IntuneRow[] = [];
  const entraRows: EntraRow[] = [];
  const membershipRows: GroupMembershipRow[] = [];

  const tagConfigRows = tagsByProperty.flatMap(({ property, tags }) =>
    tags.map((tag, idx) => ({
      groupTag: tag,
      propertyLabel: property,
      // Only configure expectations on the primary tag so the Advanced
      // disclosure realistically gets exercised on some tags but not all.
      expectedGroupNames:
        idx === 0 ? [`${property}-Devices`] : [],
      expectedProfileNames: idx === 0 ? [profileRows[0].display_name] : []
    }))
  );

  for (let i = 0; i < TARGET_DEVICE_COUNT; i += 1) {
    const propertyIdx = i % properties.length;
    const propertyTags = tagsByProperty[propertyIdx].tags;
    const tag = propertyTags[i % propertyTags.length];
    const scenario = pickScenario(rand);
    const serial = `SCALE${pad(i + 1, 6)}`;
    const intuneId = `intune-${pad(i + 1, 6)}`;
    const autopilotId = `ap-${pad(i + 1, 6)}`;
    const entraId = `entra-${pad(i + 1, 6)}`;
    const upn = `tester${pad(i + 1, 4)}@example.com`;
    const lastSync = isoOffset(rand() * 72);

    const includeAutopilot = scenario !== "no_autopilot";
    const includeIntune = scenario !== "orphan_autopilot";
    const includeEntra = scenario !== "orphan_autopilot";
    const stalledHoursAgo =
      scenario === "stalled" ? 72 + rand() * 240 : null;

    if (includeAutopilot) {
      const wrongTag = scenario === "tag_mismatch";
      const profile = profileRows[(i + propertyIdx) % profileRows.length];
      autopilotRows.push({
        id: autopilotId,
        serial_number: serial,
        manufacturer: "Contoso",
        model: "Latitude 5530",
        group_tag: wrongTag ? "UNMAPPED-TAG" : tag,
        assigned_user_upn:
          scenario === "user_mismatch" ? "owner@example.com" : upn,
        deployment_profile_id: scenario === "no_profile" ? null : profile.id,
        deployment_profile_name:
          scenario === "no_profile" ? null : profile.display_name,
        profile_assignment_status: scenario === "no_profile" ? null : "assigned",
        deployment_mode: profile.deployment_mode,
        entra_device_id: includeEntra ? entraId : null,
        first_seen_at: isoOffset(72 + rand() * 720),
        first_profile_assigned_at:
          scenario === "no_profile" ? null : isoOffset(48 + rand() * 240),
        last_synced_at: lastSync,
        raw_json: JSON.stringify({ id: autopilotId, groupTag: tag })
      });
    }

    if (includeIntune) {
      const profile = profileRows[(i + propertyIdx) % profileRows.length];
      const compliance =
        scenario === "compliance_drift" ? "noncompliant" : "compliant";
      intuneRows.push({
        id: intuneId,
        serial_number: serial,
        device_name: `WS-${serial}`,
        entra_device_id: includeEntra ? entraId : null,
        os_version: "10.0.22631.4391",
        compliance_state: compliance,
        enrollment_type: "userEnrollment",
        managed_device_owner_type: "company",
        last_sync_datetime: stalledHoursAgo
          ? isoOffset(stalledHoursAgo)
          : lastSync,
        primary_user_upn: upn,
        enrollment_profile_name:
          scenario === "no_profile" ? null : profile.display_name,
        autopilot_enrolled: includeAutopilot ? 1 : 0,
        management_agent: i % 19 === 0 ? "configurationManager" : "mdm",
        last_synced_at: lastSync,
        raw_json: JSON.stringify({ id: intuneId, complianceState: compliance })
      });
    }

    if (includeEntra) {
      entraRows.push({
        id: entraId,
        device_id: entraId,
        display_name: `WS-${serial}`,
        serial_number: serial,
        trust_type: scenario === "hybrid_risk" ? "ServerAd" : "AzureAd",
        is_managed: 1,
        mdm_app_id: null,
        registration_datetime: isoOffset(96 + rand() * 720),
        device_physical_ids: JSON.stringify([
          `[OrderID]:${tag}`,
          `[ZTDID]:ZTD-${pad(i + 1, 6)}`
        ]),
        last_synced_at: lastSync,
        raw_json: JSON.stringify({ id: entraId })
      });

      const groupId = `grp-${tag.toLowerCase()}`;
      // not_in_target_group keeps the Entra device out of the expected
      // group so the engine can flag it as a targeting break.
      if (scenario !== "not_in_target_group") {
        membershipRows.push({
          group_id: groupId,
          member_device_id: entraId,
          last_synced_at: now
        });
      }
    }
  }

  return {
    autopilotRows,
    intuneRows,
    entraRows,
    groupRows,
    membershipRows,
    profileRows,
    profileAssignmentRows,
    tagConfigRows
  };
}

interface Timing {
  label: string;
  ms: number;
  detail?: string;
}

function timeIt<T>(label: string, fn: () => T, detail?: (result: T) => string): Timing {
  const start = performance.now();
  const result = fn();
  const ms = performance.now() - start;
  return {
    label,
    ms,
    detail: detail ? detail(result) : undefined
  };
}

async function timeAsync<T>(label: string, fn: () => Promise<T>): Promise<Timing> {
  const start = performance.now();
  await fn();
  const ms = performance.now() - start;
  return { label, ms };
}

function fmt(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${ms.toFixed(1)}ms`;
}

async function main() {
  const db = getDb();
  runMigrations(db);

  // Wipe before reseeding so successive runs aren't cumulative.
  console.log("Wiping device tables…");
  for (const table of [
    "device_state_history",
    "device_state",
    "graph_assignments",
    "device_compliance_states",
    "device_config_states",
    "device_app_install_states",
    "tag_config",
    "group_memberships",
    "autopilot_profile_assignments",
    "autopilot_profiles",
    "groups",
    "entra_devices",
    "intune_devices",
    "autopilot_devices",
    "action_log"
  ]) {
    db.prepare(`DELETE FROM ${table}`).run();
  }

  const buildStart = performance.now();
  const payload = buildScalePayload();
  const buildMs = performance.now() - buildStart;

  const persistStart = performance.now();
  persistSnapshot(db, payload);
  const persistMs = performance.now() - persistStart;

  const computeStart = performance.now();
  computeAllDeviceStates(db);
  const computeMs = performance.now() - computeStart;

  const totalSeedMs = buildMs + persistMs + computeMs;

  console.log(
    `Seeded ${payload.autopilotRows.length} autopilot, ${payload.intuneRows.length} intune, ${payload.entraRows.length} entra rows ` +
      `across ${payload.groupRows.length} groups and ${payload.profileRows.length} profiles.`
  );

  // ── Smoke timings ─────────────────────────────────────────────────
  const timings: Timing[] = [
    {
      label: "build payload",
      ms: buildMs,
      detail: `${payload.autopilotRows.length}+${payload.intuneRows.length}+${payload.entraRows.length} rows`
    },
    { label: "persist snapshot", ms: persistMs },
    { label: "compute all device states", ms: computeMs }
  ];

  timings.push(
    timeIt("dashboard query", () => getDashboard(db), (r) => {
      const total = Object.values(r.counts).reduce((sum, n) => sum + n, 0);
      return `${total} devices, ${r.failurePatterns.length} failure patterns`;
    })
  );

  timings.push(
    timeIt(
      "devices page 1 (25)",
      () =>
        listDeviceStates(db, {
          search: undefined,
          health: undefined,
          flag: undefined,
          property: undefined,
          profile: undefined,
          page: 1,
          pageSize: 25
        }),
      (r) => `page ${r.items.length} of ${r.total}`
    )
  );

  timings.push(
    timeIt("tags inventory", () => listProvisioningTags(db), (r) =>
      `${r.length} tags`
    )
  );

  // Pick the first tag with at least one device for a representative lookup.
  const firstTagWithDevices =
    listProvisioningTags(db).find((t) => t.deviceCount > 0)?.groupTag ?? null;

  if (firstTagWithDevices) {
    timings.push(
      timeIt(
        `provisioning lookup (${firstTagWithDevices})`,
        () => ({
          devices: devicesForProvisioningTag(db, firstTagWithDevices),
          count: countDevicesForProvisioningTag(db, firstTagWithDevices)
        }),
        (r) => `${r.devices.length}/${r.count} devices`
      )
    );
  }

  const firstDevice = listDeviceStates(db, {
    search: undefined,
    health: undefined,
    flag: undefined,
    property: undefined,
    profile: undefined,
    page: 1,
    pageSize: 1
  }).items[0];
  if (firstDevice) {
    timings.push(
      timeIt(
        `device detail (${firstDevice.deviceKey})`,
        () => getDeviceDetail(db, firstDevice.deviceKey),
        () => "1 detail row"
      )
    );
  }

  // Recompute timing on the already-populated DB so we know the second
  // pass cost (transitions only, no fresh inserts).
  timings.push(
    await timeAsync("recompute all device states (second pass)", async () => {
      computeAllDeviceStates(db);
    })
  );

  console.log("");
  console.log(`Seed total: ${fmt(totalSeedMs)}`);
  console.log("Smoke timings (single run, indicative only):");
  for (const timing of timings) {
    const detail = timing.detail ? `  — ${timing.detail}` : "";
    console.log(`  • ${timing.label.padEnd(40)} ${fmt(timing.ms).padStart(8)}${detail}`);
  }
  console.log("");
  console.log(
    "Note: indicative timings, not a CI gate. Run twice and compare to spot regressions."
  );

  db.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
