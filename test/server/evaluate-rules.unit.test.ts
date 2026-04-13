import { describe, expect, it } from "vitest";

import { evaluateRules, type RuleContext } from "../../src/server/engine/evaluate-rules.js";
import type { RuleDefinition, RulePredicate } from "../../src/shared/types.js";

/**
 * The rule DSL is the operator-facing extension point for the state engine,
 * so its behaviour is load-bearing for triage decisions. These tests pin
 * the contract: every operator, scope filter, and short-circuit, plus a
 * few "the rule is malformed, do NOT crash" cases.
 */

let nextId = 0;

function rule(
  predicate: RulePredicate,
  overrides: Partial<RuleDefinition> = {}
): RuleDefinition {
  nextId += 1;
  return {
    id: `rule-${nextId}`,
    name: overrides.name ?? `Rule ${nextId}`,
    description: overrides.description ?? "",
    severity: overrides.severity ?? "warning",
    scope: overrides.scope ?? "global",
    scopeValue: overrides.scopeValue ?? null,
    enabled: overrides.enabled ?? true,
    predicate,
    createdAt: "2026-04-07T00:00:00.000Z",
    updatedAt: "2026-04-07T00:00:00.000Z"
  };
}

const baseContext: RuleContext = {
  deviceName: "POS-001",
  serialNumber: "CZC123",
  propertyLabel: "Lodge",
  groupTag: "Lodge",
  assignedProfileName: "AP-Lodge-UserDriven",
  profileAssignmentStatus: "assigned",
  trustType: "AzureAd",
  hasAutopilotRecord: true,
  hasIntuneRecord: true,
  hasEntraRecord: true,
  hybridJoinConfigured: false,
  assignmentChainComplete: true,
  flagCount: 0,
  osVersion: "10.0.26200.1234"
};

describe("evaluateRules — operators", () => {
  it("eq is case-insensitive on strings", () => {
    const violations = evaluateRules(
      [
        rule({
          type: "leaf",
          field: "propertyLabel",
          op: "eq",
          value: "lodge"
        })
      ],
      baseContext
    );
    expect(violations).toHaveLength(1);
  });

  it("contains / not_contains compare lowercased substrings", () => {
    const r1 = rule(
      { type: "leaf", field: "deviceName", op: "contains", value: "pos" },
      { name: "contains-pos" }
    );
    const r2 = rule(
      { type: "leaf", field: "deviceName", op: "not_contains", value: "kiosk" },
      { name: "not-contains-kiosk" }
    );
    const violations = evaluateRules([r1, r2], baseContext);
    expect(violations.map((v) => v.ruleName)).toEqual([
      "contains-pos",
      "not-contains-kiosk"
    ]);
  });

  it("exists / missing distinguish empty strings, null, and undefined", () => {
    const ctx: RuleContext = { ...baseContext, propertyLabel: "" };
    const exists = evaluateRules(
      [
        rule({
          type: "leaf",
          field: "propertyLabel",
          op: "exists",
          value: null
        })
      ],
      ctx
    );
    const missing = evaluateRules(
      [
        rule({
          type: "leaf",
          field: "propertyLabel",
          op: "missing",
          value: null
        })
      ],
      ctx
    );
    expect(exists).toHaveLength(0);
    expect(missing).toHaveLength(1);
  });

  it("in / not_in split CSV value lists and trim entries", () => {
    const inRule = rule(
      {
        type: "leaf",
        field: "propertyLabel",
        op: "in",
        value: "lodge, bhk, kiosk"
      },
      { name: "in-list" }
    );
    const notInRule = rule(
      {
        type: "leaf",
        field: "propertyLabel",
        op: "not_in",
        value: "kiosk,bhk"
      },
      { name: "not-in-list" }
    );
    const violations = evaluateRules([inRule, notInRule], baseContext);
    expect(violations.map((v) => v.ruleName)).toEqual(["in-list", "not-in-list"]);
  });

  it("older_than_hours and newer_than_hours compare against the current time", () => {
    const stale = new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString();
    const fresh = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

    const staleResult = evaluateRules(
      [
        rule({
          type: "leaf",
          field: "lastCheckinAt",
          op: "older_than_hours",
          value: 24
        })
      ],
      { ...baseContext, lastCheckinAt: stale }
    );
    const freshResult = evaluateRules(
      [
        rule({
          type: "leaf",
          field: "lastCheckinAt",
          op: "newer_than_hours",
          value: 24
        })
      ],
      { ...baseContext, lastCheckinAt: fresh }
    );

    expect(staleResult).toHaveLength(1);
    expect(freshResult).toHaveLength(1);
  });

  it("hour comparisons return false for unparseable timestamps instead of crashing", () => {
    const result = evaluateRules(
      [
        rule({
          type: "leaf",
          field: "lastCheckinAt",
          op: "older_than_hours",
          value: 24
        })
      ],
      { ...baseContext, lastCheckinAt: "not-a-date" }
    );
    expect(result).toHaveLength(0);
  });
});

describe("evaluateRules — operator edge cases", () => {
  it("starts_with is case-insensitive", () => {
    const result = evaluateRules(
      [rule({ type: "leaf", field: "serialNumber", op: "starts_with", value: "czc" })],
      baseContext
    );
    expect(result).toHaveLength(1);
  });

  it("ends_with is case-insensitive", () => {
    const result = evaluateRules(
      [rule({ type: "leaf", field: "deviceName", op: "ends_with", value: "001" })],
      baseContext
    );
    expect(result).toHaveLength(1);
  });

  it("neq returns false when values match (case-insensitive)", () => {
    const result = evaluateRules(
      [rule({ type: "leaf", field: "propertyLabel", op: "neq", value: "lodge" })],
      baseContext
    );
    expect(result).toHaveLength(0);
  });

  it("neq returns true when values differ", () => {
    const result = evaluateRules(
      [rule({ type: "leaf", field: "propertyLabel", op: "neq", value: "Kiosk" })],
      baseContext
    );
    expect(result).toHaveLength(1);
  });

  it("in returns false when the field is null", () => {
    const result = evaluateRules(
      [rule({ type: "leaf", field: "propertyLabel", op: "in", value: "lodge,bhk" })],
      { ...baseContext, propertyLabel: null }
    );
    expect(result).toHaveLength(0);
  });

  it("not_in returns true when the field is null (null is not in any list)", () => {
    const result = evaluateRules(
      [rule({ type: "leaf", field: "propertyLabel", op: "not_in", value: "lodge,bhk" })],
      { ...baseContext, propertyLabel: null }
    );
    expect(result).toHaveLength(1);
  });

  it("contains returns false when field is not a string (e.g. boolean)", () => {
    const result = evaluateRules(
      [rule({ type: "leaf", field: "hasAutopilotRecord", op: "contains", value: "true" })],
      baseContext
    );
    expect(result).toHaveLength(0);
  });

  it("not_contains returns true when field is not a string", () => {
    const result = evaluateRules(
      [rule({ type: "leaf", field: "hasAutopilotRecord", op: "not_contains", value: "true" })],
      baseContext
    );
    expect(result).toHaveLength(1);
  });

  it("eq treats null field and null value as equal", () => {
    const result = evaluateRules(
      [rule({ type: "leaf", field: "missingField", op: "eq", value: null })],
      baseContext
    );
    expect(result).toHaveLength(1);
  });

  it("older_than_hours returns false when field is not a string", () => {
    const result = evaluateRules(
      [rule({ type: "leaf", field: "flagCount", op: "older_than_hours", value: 24 })],
      baseContext
    );
    expect(result).toHaveLength(0);
  });
});

describe("evaluateRules — compound predicates", () => {
  it("and short-circuits to false when any child fails", () => {
    const result = evaluateRules(
      [
        rule({
          type: "and",
          children: [
            { type: "leaf", field: "propertyLabel", op: "eq", value: "Lodge" },
            { type: "leaf", field: "propertyLabel", op: "eq", value: "BHK" }
          ]
        })
      ],
      baseContext
    );
    expect(result).toHaveLength(0);
  });

  it("or matches when at least one child matches", () => {
    const result = evaluateRules(
      [
        rule({
          type: "or",
          children: [
            { type: "leaf", field: "propertyLabel", op: "eq", value: "Kiosk" },
            { type: "leaf", field: "propertyLabel", op: "eq", value: "Lodge" }
          ]
        })
      ],
      baseContext
    );
    expect(result).toHaveLength(1);
  });

  it("not inverts the wrapped predicate", () => {
    const result = evaluateRules(
      [
        rule({
          type: "not",
          child: { type: "leaf", field: "hybridJoinConfigured", op: "eq", value: true }
        })
      ],
      baseContext
    );
    expect(result).toHaveLength(1);
  });
});

describe("evaluateRules — scope filtering", () => {
  it("ignores rules whose property scope does not match", () => {
    const result = evaluateRules(
      [
        rule(
          { type: "leaf", field: "deviceName", op: "exists", value: null },
          { scope: "property", scopeValue: "Kiosk" }
        )
      ],
      baseContext
    );
    expect(result).toHaveLength(0);
  });

  it("evaluates rules whose property scope matches", () => {
    const result = evaluateRules(
      [
        rule(
          { type: "leaf", field: "deviceName", op: "exists", value: null },
          { scope: "property", scopeValue: "Lodge" }
        )
      ],
      baseContext
    );
    expect(result).toHaveLength(1);
  });

  it("evaluates rules whose profile scope matches", () => {
    const result = evaluateRules(
      [
        rule(
          { type: "leaf", field: "deviceName", op: "exists", value: null },
          { scope: "profile", scopeValue: "AP-Lodge-UserDriven" }
        )
      ],
      baseContext
    );
    expect(result).toHaveLength(1);
  });

  it("ignores rules whose profile scope does not match", () => {
    const result = evaluateRules(
      [
        rule(
          { type: "leaf", field: "deviceName", op: "exists", value: null },
          { scope: "profile", scopeValue: "AP-Kiosk-SelfDeploying" }
        )
      ],
      baseContext
    );
    expect(result).toHaveLength(0);
  });

  it("treats global scope with no scopeValue as 'always evaluate'", () => {
    const result = evaluateRules(
      [
        rule(
          { type: "leaf", field: "deviceName", op: "exists", value: null },
          { scope: "global", scopeValue: null }
        )
      ],
      baseContext
    );
    expect(result).toHaveLength(1);
  });
});

describe("evaluateRules — safety", () => {
  it("skips disabled rules entirely", () => {
    const result = evaluateRules(
      [
        rule(
          { type: "leaf", field: "deviceName", op: "exists", value: null },
          { enabled: false }
        )
      ],
      baseContext
    );
    expect(result).toHaveLength(0);
  });

  it("treats a thrown predicate as 'did not match' and keeps evaluating other rules", () => {
    // Force an exception by passing a leaf with an invalid op past the type
    // system. The catch in evalPredicate should swallow the throw and we
    // should still see the second, valid rule produce a violation.
    const broken = rule({
      type: "leaf",
      field: "deviceName",
      // @ts-expect-error -- intentionally malformed op
      op: "explode",
      value: "boom"
    });
    const ok = rule(
      { type: "leaf", field: "deviceName", op: "exists", value: null },
      { name: "still-evaluated" }
    );
    const result = evaluateRules([broken, ok], baseContext);
    expect(result.map((v) => v.ruleName)).toContain("still-evaluated");
  });

  it("preserves rule evaluation order in the returned violations", () => {
    const r1 = rule({ type: "leaf", field: "deviceName", op: "exists", value: null }, { name: "first" });
    const r2 = rule({ type: "leaf", field: "deviceName", op: "exists", value: null }, { name: "second" });
    const r3 = rule({ type: "leaf", field: "deviceName", op: "exists", value: null }, { name: "third" });
    const result = evaluateRules([r1, r2, r3], baseContext);
    expect(result.map((v) => v.ruleName)).toEqual(["first", "second", "third"]);
  });
});
