import { describe, expect, it } from "vitest";

import { buildPayload } from "../../src/client/components/settings/RulesSection.js";

/**
 * Pins the form-to-payload coercion for the rule authoring UI. The
 * engine's `normalize()` preserves boolean and number primitives, so a
 * predicate like `hasAutopilotRecord eq "true"` (string against a
 * boolean context field) silently never matches. These tests make
 * sure the client coerces to the right JavaScript type before sending
 * the payload to the API.
 */
describe("RulesSection.buildPayload", () => {
  it("coerces boolean fields to real booleans", () => {
    const trueCase = buildPayload({
      name: "Must have autopilot",
      description: "",
      severity: "warning",
      field: "hasAutopilotRecord",
      op: "eq",
      value: "true"
    });
    expect(trueCase.predicate).toMatchObject({
      type: "leaf",
      field: "hasAutopilotRecord",
      op: "eq",
      value: true // real boolean, not the string "true"
    });

    const falseCase = buildPayload({
      name: "Chain must be complete",
      description: "",
      severity: "warning",
      field: "assignmentChainComplete",
      op: "eq",
      value: "false"
    });
    expect(falseCase.predicate).toMatchObject({ value: false });
  });

  it("coerces number fields to real numbers", () => {
    const payload = buildPayload({
      name: "Too many flags",
      description: "",
      severity: "critical",
      field: "flagCount",
      op: "eq",
      value: "3"
    });
    expect(payload.predicate).toMatchObject({
      field: "flagCount",
      op: "eq",
      value: 3 // real number, not "3"
    });
  });

  it("keeps string fields as-is", () => {
    const payload = buildPayload({
      name: "Lodge only",
      description: "",
      severity: "info",
      field: "propertyLabel",
      op: "eq",
      value: "Lodge"
    });
    expect(payload.predicate).toMatchObject({ value: "Lodge" });
  });

  it("keeps CSV strings raw for in / not_in so the engine can split", () => {
    const payload = buildPayload({
      name: "Known good profiles",
      description: "",
      severity: "info",
      field: "assignedProfileName",
      op: "in",
      value: "Lodge-UD, Casino-SD, Kiosk"
    });
    expect(payload.predicate).toMatchObject({
      op: "in",
      value: "Lodge-UD, Casino-SD, Kiosk"
    });
  });

  it("parses older_than_hours / newer_than_hours as numbers regardless of field", () => {
    const payload = buildPayload({
      name: "Stale check-in",
      description: "",
      severity: "warning",
      field: "lastCheckinAt",
      op: "older_than_hours",
      value: "48"
    });
    expect(payload.predicate).toMatchObject({
      op: "older_than_hours",
      value: 48
    });
  });

  it("sets value to null for value-less ops (exists / missing)", () => {
    const exists = buildPayload({
      name: "Must have a profile",
      description: "",
      severity: "critical",
      field: "assignedProfileName",
      op: "exists",
      value: ""
    });
    expect(exists.predicate).toMatchObject({ op: "exists", value: null });
  });

  it("trims name and description before sending", () => {
    const payload = buildPayload({
      name: "  leading and trailing  ",
      description: "  matters  ",
      severity: "info",
      field: "deviceName",
      op: "exists",
      value: ""
    });
    expect(payload.name).toBe("leading and trailing");
    expect(payload.description).toBe("matters");
  });
});
