import type { MatchConfidence } from "../../shared/types.js";
import type { AutopilotRow, EntraRow, IntuneRow } from "../db/types.js";
import { extractRawDeviceId, normalizeName, normalizeSerial, normalizeString } from "./normalize.js";

export type MatchedOnKey = "serial" | "entra_device_id" | "device_id" | "device_name";

export interface CorrelationBundle {
  deviceKey: string;
  serialNumber: string | null;
  autopilotRecord: AutopilotRow | null;
  intuneRecord: IntuneRow | null;
  entraRecord: EntraRow | null;
  /**
   * The weakest joining key actually shared between joined records in this
   * bundle. For single-record bundles, the strongest identifier the lone
   * record carries (no cross-system claim is being made).
   */
  matchedOn: MatchedOnKey;
  /**
   * Honest confidence in the cross-system correlation. Computed as the
   * weakest pair: a three-way bundle whose AP↔IN link is by serial but
   * whose IN↔Entra link is name-only is reported as `low`, never `high`.
   * Single-record bundles are `high` because there is no claim to weaken.
   */
  matchConfidence: MatchConfidence;
  identityConflict: boolean;
}

interface JoinKeys {
  serial: string | null;
  entra_device_id: string | null;
  device_id: string | null;
  /** Null for Autopilot rows — AP has no real display name field. */
  device_name: string | null;
}

const KEY_ORDER: Array<{
  field: keyof JoinKeys;
  matchedOn: MatchedOnKey;
  confidence: MatchConfidence;
}> = [
  { field: "serial", matchedOn: "serial", confidence: "high" },
  { field: "entra_device_id", matchedOn: "entra_device_id", confidence: "medium" },
  { field: "device_id", matchedOn: "device_id", confidence: "medium" },
  { field: "device_name", matchedOn: "device_name", confidence: "low" }
];

const CONFIDENCE_RANK: Record<MatchConfidence, number> = { high: 3, medium: 2, low: 1 };

function autopilotKeys(row: AutopilotRow | null): JoinKeys | null {
  if (!row) return null;
  return {
    serial: normalizeSerial(row.serial_number),
    entra_device_id: normalizeString(row.entra_device_id),
    device_id: extractRawDeviceId(row.raw_json),
    device_name: null
  };
}

function intuneKeys(row: IntuneRow | null): JoinKeys | null {
  if (!row) return null;
  return {
    serial: normalizeSerial(row.serial_number),
    entra_device_id: normalizeString(row.entra_device_id),
    device_id: extractRawDeviceId(row.raw_json),
    device_name: normalizeName(row.device_name)
  };
}

function entraKeys(row: EntraRow | null): JoinKeys | null {
  if (!row) return null;
  return {
    serial: normalizeSerial(row.serial_number),
    entra_device_id: normalizeString(row.id),
    device_id: normalizeString(row.device_id),
    device_name: normalizeName(row.display_name)
  };
}

function strongestSharedKey(
  a: JoinKeys | null,
  b: JoinKeys | null
): { matchedOn: MatchedOnKey; confidence: MatchConfidence } | null {
  if (!a || !b) return null;
  for (const { field, matchedOn, confidence } of KEY_ORDER) {
    if (a[field] && b[field] && a[field] === b[field]) {
      return { matchedOn, confidence };
    }
  }
  // The records ended up in the same bundle but share no key — this is the
  // weakest possible signal and should never be hidden behind a stronger one
  // contributed by a different record.
  return { matchedOn: "device_name", confidence: "low" };
}

function strongestSoloKey(
  keys: JoinKeys
): { matchedOn: MatchedOnKey; confidence: MatchConfidence } {
  for (const { field, matchedOn } of KEY_ORDER) {
    if (keys[field]) {
      // Solo records make no cross-system claim — surface the strongest
      // identifier the record carries and call it "high" because there is
      // nothing to weaken.
      return { matchedOn, confidence: "high" };
    }
  }
  return { matchedOn: "device_name", confidence: "high" };
}

function newest<T extends { last_synced_at: string }>(rows: T[]) {
  return [...rows].sort((a, b) => b.last_synced_at.localeCompare(a.last_synced_at))[0] ?? null;
}

function buildDeviceKey(bundle: {
  autopilotRecord: AutopilotRow | null;
  intuneRecord: IntuneRow | null;
  entraRecord: EntraRow | null;
  serialNumber: string | null;
}) {
  if (bundle.autopilotRecord) {
    return `ap:${bundle.autopilotRecord.id}`;
  }
  if (bundle.intuneRecord) {
    return `int:${bundle.intuneRecord.id}`;
  }
  if (bundle.entraRecord) {
    return `ent:${bundle.entraRecord.id}`;
  }
  return `serial:${bundle.serialNumber ?? crypto.randomUUID()}`;
}

export function correlateDevices(input: {
  autopilotRows: AutopilotRow[];
  intuneRows: IntuneRow[];
  entraRows: EntraRow[];
}): CorrelationBundle[] {
  const usedAutopilot = new Set<string>();
  const usedIntune = new Set<string>();
  const usedEntra = new Set<string>();
  const bundles: CorrelationBundle[] = [];

  const bySerial = {
    autopilot: new Map<string, AutopilotRow[]>(),
    intune: new Map<string, IntuneRow[]>(),
    entra: new Map<string, EntraRow[]>()
  };

  const byEntraObjectId = {
    autopilot: new Map<string, AutopilotRow[]>(),
    intune: new Map<string, IntuneRow[]>(),
    entra: new Map<string, EntraRow[]>()
  };

  const byDeviceId = {
    autopilot: new Map<string, AutopilotRow[]>(),
    intune: new Map<string, IntuneRow[]>(),
    entra: new Map<string, EntraRow[]>()
  };

  const byName = {
    autopilot: new Map<string, AutopilotRow[]>(),
    intune: new Map<string, IntuneRow[]>(),
    entra: new Map<string, EntraRow[]>()
  };

  const push = <T>(map: Map<string, T[]>, key: string | null, row: T) => {
    if (!key) {
      return;
    }
    const current = map.get(key) ?? [];
    current.push(row);
    map.set(key, current);
  };

  for (const row of input.autopilotRows) {
    push(bySerial.autopilot, normalizeSerial(row.serial_number), row);
    push(byEntraObjectId.autopilot, normalizeString(row.entra_device_id), row);
    push(byDeviceId.autopilot, extractRawDeviceId(row.raw_json), row);
    push(byName.autopilot, normalizeName(row.serial_number), row);
  }

  for (const row of input.intuneRows) {
    push(bySerial.intune, normalizeSerial(row.serial_number), row);
    push(byEntraObjectId.intune, normalizeString(row.entra_device_id), row);
    push(byDeviceId.intune, extractRawDeviceId(row.raw_json), row);
    push(byName.intune, normalizeName(row.device_name), row);
  }

  for (const row of input.entraRows) {
    push(bySerial.entra, normalizeSerial(row.serial_number), row);
    push(byEntraObjectId.entra, normalizeString(row.id), row);
    push(byDeviceId.entra, normalizeString(row.device_id), row);
    push(byName.entra, normalizeName(row.display_name), row);
  }

  const buildBundle = (seed: {
    autopilotRecord: AutopilotRow | null;
    intuneRecord: IntuneRow | null;
    entraRecord: EntraRow | null;
  }): CorrelationBundle => {
    const serial =
      normalizeSerial(seed.autopilotRecord?.serial_number) ??
      normalizeSerial(seed.intuneRecord?.serial_number) ??
      normalizeSerial(seed.entraRecord?.serial_number) ??
      null;

    // Per-record join keys, then per-pair confidence. The bundle confidence
    // is the *weakest* pair (chain-is-as-strong-as-its-weakest-link), never
    // the strongest seed identifier. This prevents a serial-keyed AP↔IN
    // link from masking a name-only IN↔Entra link.
    const apKeys = autopilotKeys(seed.autopilotRecord);
    const inKeys = intuneKeys(seed.intuneRecord);
    const enKeys = entraKeys(seed.entraRecord);

    const pairResults = [
      strongestSharedKey(apKeys, inKeys),
      strongestSharedKey(apKeys, enKeys),
      strongestSharedKey(inKeys, enKeys)
    ].filter(
      (result): result is { matchedOn: MatchedOnKey; confidence: MatchConfidence } =>
        result !== null
    );

    let matchedOn: MatchedOnKey;
    let matchConfidence: MatchConfidence;

    if (pairResults.length === 0) {
      // Single-record bundle: no cross-system claim, so report the strongest
      // identifier the lone record carries at high confidence.
      const onlyKeys = apKeys ?? inKeys ?? enKeys;
      const solo = onlyKeys
        ? strongestSoloKey(onlyKeys)
        : { matchedOn: "device_name" as const, confidence: "high" as const };
      matchedOn = solo.matchedOn;
      matchConfidence = solo.confidence;
    } else {
      // Sort ascending by confidence rank — element [0] is the weakest pair.
      pairResults.sort(
        (a, b) => CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence]
      );
      matchedOn = pairResults[0].matchedOn;
      matchConfidence = pairResults[0].confidence;
    }

    const serialMatches = serial
      ? [
          (bySerial.autopilot.get(serial) ?? []).length,
          (bySerial.intune.get(serial) ?? []).length,
          (bySerial.entra.get(serial) ?? []).length
        ].some((count) => count > 1)
      : false;

    const entraMismatch =
      Boolean(seed.autopilotRecord?.entra_device_id) &&
      Boolean(seed.intuneRecord?.entra_device_id) &&
      normalizeString(seed.autopilotRecord?.entra_device_id) !==
        normalizeString(seed.intuneRecord?.entra_device_id);

    const current = {
      autopilotRecord: seed.autopilotRecord,
      intuneRecord: seed.intuneRecord,
      entraRecord: seed.entraRecord,
      serialNumber: serial
    };

    return {
      ...current,
      deviceKey: buildDeviceKey(current),
      matchedOn,
      matchConfidence,
      identityConflict: serialMatches || entraMismatch
    };
  };

  const findMatches = (seed: {
    autopilotRecord: AutopilotRow | null;
    intuneRecord: IntuneRow | null;
    entraRecord: EntraRow | null;
  }) => {
    const serial =
      normalizeSerial(seed.autopilotRecord?.serial_number) ??
      normalizeSerial(seed.intuneRecord?.serial_number) ??
      normalizeSerial(seed.entraRecord?.serial_number) ??
      null;
    const entraObjectId =
      normalizeString(seed.autopilotRecord?.entra_device_id) ??
      normalizeString(seed.intuneRecord?.entra_device_id) ??
      normalizeString(seed.entraRecord?.id) ??
      null;
    const deviceId =
      extractRawDeviceId(seed.autopilotRecord?.raw_json) ??
      extractRawDeviceId(seed.intuneRecord?.raw_json) ??
      normalizeString(seed.entraRecord?.device_id) ??
      null;
    const name =
      normalizeName(seed.intuneRecord?.device_name) ??
      normalizeName(seed.entraRecord?.display_name) ??
      normalizeName(seed.autopilotRecord?.serial_number) ??
      null;

    const autopilotRecord =
      seed.autopilotRecord ??
      newest(
        (serial ? bySerial.autopilot.get(serial) : undefined) ??
          (entraObjectId ? byEntraObjectId.autopilot.get(entraObjectId) : undefined) ??
          (deviceId ? byDeviceId.autopilot.get(deviceId) : undefined) ??
          (name ? byName.autopilot.get(name) : undefined) ??
          []
      );

    const intuneRecord =
      seed.intuneRecord ??
      newest(
        (serial ? bySerial.intune.get(serial) : undefined) ??
          (entraObjectId ? byEntraObjectId.intune.get(entraObjectId) : undefined) ??
          (deviceId ? byDeviceId.intune.get(deviceId) : undefined) ??
          (name ? byName.intune.get(name) : undefined) ??
          []
      );

    const entraRecord =
      seed.entraRecord ??
      newest(
        (serial ? bySerial.entra.get(serial) : undefined) ??
          (entraObjectId ? byEntraObjectId.entra.get(entraObjectId) : undefined) ??
          (deviceId ? byDeviceId.entra.get(deviceId) : undefined) ??
          (name ? byName.entra.get(name) : undefined) ??
          []
      );

    return buildBundle({ autopilotRecord, intuneRecord, entraRecord });
  };

  for (const row of input.autopilotRows) {
    if (usedAutopilot.has(row.id)) {
      continue;
    }
    const bundle = findMatches({ autopilotRecord: row, intuneRecord: null, entraRecord: null });
    if (bundle.autopilotRecord) {
      usedAutopilot.add(bundle.autopilotRecord.id);
    }
    if (bundle.intuneRecord) {
      usedIntune.add(bundle.intuneRecord.id);
    }
    if (bundle.entraRecord) {
      usedEntra.add(bundle.entraRecord.id);
    }
    bundles.push(bundle);
  }

  for (const row of input.intuneRows) {
    if (usedIntune.has(row.id)) {
      continue;
    }
    const bundle = findMatches({ autopilotRecord: null, intuneRecord: row, entraRecord: null });
    if (bundle.autopilotRecord) {
      usedAutopilot.add(bundle.autopilotRecord.id);
    }
    if (bundle.intuneRecord) {
      usedIntune.add(bundle.intuneRecord.id);
    }
    if (bundle.entraRecord) {
      usedEntra.add(bundle.entraRecord.id);
    }
    bundles.push(bundle);
  }

  for (const row of input.entraRows) {
    if (usedEntra.has(row.id)) {
      continue;
    }
    const bundle = findMatches({ autopilotRecord: null, intuneRecord: null, entraRecord: row });
    if (bundle.autopilotRecord) {
      usedAutopilot.add(bundle.autopilotRecord.id);
    }
    if (bundle.intuneRecord) {
      usedIntune.add(bundle.intuneRecord.id);
    }
    if (bundle.entraRecord) {
      usedEntra.add(bundle.entraRecord.id);
    }
    bundles.push(bundle);
  }

  return bundles;
}
