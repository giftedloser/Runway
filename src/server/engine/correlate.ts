import type { MatchConfidence } from "../../shared/types.js";
import type { AutopilotRow, EntraRow, IntuneRow } from "../db/types.js";
import { extractRawDeviceId, normalizeName, normalizeSerial, normalizeString } from "./normalize.js";

export interface CorrelationBundle {
  deviceKey: string;
  serialNumber: string | null;
  autopilotRecord: AutopilotRow | null;
  intuneRecord: IntuneRow | null;
  entraRecord: EntraRow | null;
  matchedOn: "serial" | "entra_device_id" | "device_id" | "device_name";
  matchConfidence: MatchConfidence;
  identityConflict: boolean;
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

    let matchedOn: CorrelationBundle["matchedOn"] = "device_name";
    let matchConfidence: MatchConfidence = "low";

    if (serial) {
      matchedOn = "serial";
      matchConfidence = "high";
    } else if (entraObjectId) {
      matchedOn = "entra_device_id";
      matchConfidence = "medium";
    } else if (deviceId) {
      matchedOn = "device_id";
      matchConfidence = "medium";
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
