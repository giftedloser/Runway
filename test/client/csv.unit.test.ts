import { describe, expect, it } from "vitest";

import { csvEscape, devicesToCsv } from "../../src/client/lib/csv.js";
import type { DeviceListItem } from "../../src/client/lib/types.js";

describe("csvEscape", () => {
  it("returns empty string for null and undefined", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("passes through plain strings", () => {
    expect(csvEscape("hello")).toBe("hello");
  });

  it("wraps and escapes strings containing commas", () => {
    expect(csvEscape("North, River")).toBe('"North, River"');
  });

  it("wraps and escapes strings containing quotes", () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it("wraps strings containing newlines", () => {
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("converts numbers to string", () => {
    expect(csvEscape(42)).toBe("42");
  });

  it("prefixes spreadsheet formulas", () => {
    expect(csvEscape("=cmd|'/C calc'!A0")).toBe("'=cmd|'/C calc'!A0");
    expect(csvEscape("+SUM(A1:A2)")).toBe("'+SUM(A1:A2)");
    expect(csvEscape("-10+20")).toBe("'-10+20");
    expect(csvEscape("@HYPERLINK(\"https://example.com\")")).toBe(
      "\"'@HYPERLINK(\"\"https://example.com\"\")\""
    );
    expect(csvEscape("  =SUM(A1:A2)")).toBe("'  =SUM(A1:A2)");
  });
});

describe("devicesToCsv", () => {
  const makeDevice = (overrides: Partial<DeviceListItem> = {}): DeviceListItem => ({
    deviceKey: "dk-1",
    deviceName: "DESKTOP-001",
    serialNumber: "CZC123",
    health: "healthy" as const,
    flags: [],
    flagCount: 0,
    diagnosis: "",
    activeRules: [],
    propertyLabel: "North",
    assignedProfileName: "AP-North-UserDriven",
    lastCheckinAt: "2026-04-10T12:00:00.000Z",
    matchConfidence: "high" as const,
    autopilotAssignedUserUpn: null,
    intunePrimaryUserUpn: null,
    complianceState: null,
    deploymentMode: null,
    ...overrides
  });

  it("produces a header row plus one data row", () => {
    const csv = devicesToCsv([makeDevice()]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      "deviceKey,deviceName,serialNumber,health,flags,property,assignedProfile,lastCheckinAt"
    );
  });

  it("joins flags with pipe separator", () => {
    const csv = devicesToCsv([
      makeDevice({ flags: ["identity_conflict", "missing_ztdid"] })
    ]);
    const dataLine = csv.split("\r\n")[1];
    expect(dataLine).toContain("identity_conflict|missing_ztdid");
  });

  it("handles null fields gracefully", () => {
    const csv = devicesToCsv([
      makeDevice({
        deviceName: null,
        serialNumber: null,
        propertyLabel: null,
        assignedProfileName: null,
        lastCheckinAt: null
      })
    ]);
    const dataLine = csv.split("\r\n")[1];
    // Should contain empty fields, not "null"
    expect(dataLine).not.toContain("null");
    expect(dataLine).toBe("dk-1,,,healthy,,,," );
  });

  it("escapes values that contain commas", () => {
    const csv = devicesToCsv([
      makeDevice({ propertyLabel: "North, River" })
    ]);
    expect(csv).toContain('"North, River"');
  });

  it("returns just a header for empty input", () => {
    const csv = devicesToCsv([]);
    expect(csv).toBe(
      "deviceKey,deviceName,serialNumber,health,flags,property,assignedProfile,lastCheckinAt"
    );
  });
});
