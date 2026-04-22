import { describe, expect, it } from "vitest";

import { buildSummaryText } from "../../src/client/components/devices/CopySummaryButton.js";
import type { DeviceDetailResponse } from "../../src/client/lib/types.js";

function makeDetail(overrides: Partial<DeviceDetailResponse> = {}): DeviceDetailResponse {
  return {
    summary: {
      deviceName: "DESKTOP-001",
      serialNumber: "CZC123",
      health: "warning",
      diagnosis: "Profile assigned but not enrolled",
      flags: [],
      propertyLabel: "Lodge / Gilpin",
      assignedProfileName: "AP-Lodge-UserDriven",
      deploymentMode: "userDriven",
      complianceState: "compliant",
      autopilotAssignedUserUpn: "alice@bhwk.com",
      intunePrimaryUserUpn: "alice@bhwk.com",
      ...overrides.summary
    },
    identity: {
      autopilotId: "ap-1",
      intuneId: "in-1",
      entraId: "en-1",
      matchedOn: "serial",
      matchConfidence: "high",
      nameJoined: false,
      identityConflict: false,
      ...overrides.identity
    },
    diagnostics: overrides.diagnostics ?? [],
    assignmentPath: {
      chainComplete: true,
      breakPoint: null,
      steps: [],
      ...overrides.assignmentPath
    },
    ruleViolations: overrides.ruleViolations ?? [],
    sourceRefs: {
      autopilotRawJson: null,
      intuneRawJson: null,
      entraRawJson: null,
      ...overrides.sourceRefs
    }
  } as unknown as DeviceDetailResponse;
}

describe("buildSummaryText", () => {
  it("includes device name, serial, and health", () => {
    const text = buildSummaryText(makeDetail());
    expect(text).toContain("Device: DESKTOP-001");
    expect(text).toContain("Serial: CZC123");
    expect(text).toContain("Health: warning");
  });

  it("includes correlation confidence", () => {
    const text = buildSummaryText(makeDetail());
    expect(text).toContain("Correlation: high");
  });

  it("appends name-only join annotation when nameJoined is true", () => {
    const text = buildSummaryText(
      makeDetail({ identity: { nameJoined: true } as DeviceDetailResponse["identity"] })
    );
    expect(text).toContain("(name-only join)");
  });

  it("includes property, profile, and deployment mode", () => {
    const text = buildSummaryText(makeDetail());
    expect(text).toContain("Property: Lodge / Gilpin");
    expect(text).toContain("Profile: AP-Lodge-UserDriven");
    expect(text).toContain("Deployment Mode: userDriven");
  });

  it("includes diagnosis", () => {
    const text = buildSummaryText(makeDetail());
    expect(text).toContain("Diagnosis: Profile assigned but not enrolled");
  });

  it("lists active issues with severity", () => {
    const text = buildSummaryText(
      makeDetail({
        diagnostics: [
          {
            code: "identity_conflict" as any,
            severity: "critical",
            title: "Identity Conflict",
            summary: "Serials disagree across systems",
            whyItMatters: "",
            checks: [],
            rawData: [],
            caveat: null
          }
        ]
      })
    );
    expect(text).toContain("[CRITICAL] Identity Conflict");
    expect(text).toContain("Serials disagree across systems");
  });

  it("includes caveat when present", () => {
    const text = buildSummaryText(
      makeDetail({
        diagnostics: [
          {
            code: "hybrid_join_risk" as any,
            severity: "warning",
            title: "Hybrid Join Risk",
            summary: "Device is hybrid joined",
            whyItMatters: "",
            checks: [],
            rawData: [],
            caveat: "Correlation is name-only"
          }
        ]
      })
    );
    expect(text).toContain("⚠ Correlation is name-only");
  });

  it("shows broken provisioning chain", () => {
    const text = buildSummaryText(
      makeDetail({
        assignmentPath: {
          chainComplete: false,
          breakPoint: "group_membership" as any,
          steps: []
        } as any
      })
    );
    expect(text).toContain("Broken at group_membership");
  });

  it("ends with Runway attribution", () => {
    const text = buildSummaryText(makeDetail());
    expect(text).toContain("— Copied from Runway");
  });

  it("uses dash for missing device name and serial", () => {
    const text = buildSummaryText(
      makeDetail({
        summary: { deviceName: null, serialNumber: null } as any
      })
    );
    expect(text).toContain("Device: —");
    expect(text).toContain("Serial: —");
  });
});
