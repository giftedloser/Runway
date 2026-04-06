const unusableSerials = new Set(["", "TO BE FILLED BY O.E.M.", "DEFAULT STRING", "UNKNOWN"]);

export function normalizeSerial(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (!normalized || unusableSerials.has(normalized)) {
    return null;
  }

  return normalized;
}

export function normalizeString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.toUpperCase() : null;
}

export function normalizeName(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.toUpperCase() : null;
}

export function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function asArray(value: string | null | undefined) {
  return safeJsonParse<string[]>(value, []);
}

export function extractRawDeviceId(rawJson: string | null | undefined) {
  const raw = safeJsonParse<Record<string, unknown>>(rawJson, {});
  const value = raw.deviceId;
  return typeof value === "string" && value.trim() ? value.trim().toUpperCase() : null;
}
