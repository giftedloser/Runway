import { useState } from "react";
import { Eye, Plus, ScrollText, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";

import {
  useRuleMutations,
  useRulePreview,
  useRules,
  type RuleInputPayload,
  type RulePreviewResult
} from "../../hooks/useRules.js";
import { useAuthStatus } from "../../hooks/useAuth.js";
import type { RuleDefinition, RuleOp, RuleSeverity } from "../../lib/types.js";
import { ConfirmDialog } from "../shared/ConfirmDialog.js";
import { Button } from "../ui/button.js";
import { Card } from "../ui/card.js";
import { Input } from "../ui/input.js";

type FieldType = "string" | "boolean" | "number" | "timestamp";

interface FieldOption {
  id: string;
  label: string;
  type: FieldType;
}

/**
 * Field registry for the rule authoring form. Each field declares the
 * type of its underlying context value so `buildPayload` can coerce
 * the form input to the right JavaScript primitive. This matters because
 * `evaluateRules.normalize()` preserves boolean and number types — a
 * `hasAutopilotRecord eq "true"` rule (string value against a boolean
 * context field) would silently never match in production.
 */
const FIELD_OPTIONS: FieldOption[] = [
  { id: "deviceName", label: "deviceName", type: "string" },
  { id: "serialNumber", label: "serialNumber", type: "string" },
  { id: "propertyLabel", label: "propertyLabel", type: "string" },
  { id: "groupTag", label: "groupTag", type: "string" },
  { id: "assignedProfileName", label: "assignedProfileName", type: "string" },
  { id: "deploymentMode", label: "deploymentMode", type: "string" },
  { id: "trustType", label: "trustType", type: "string" },
  { id: "complianceState", label: "complianceState", type: "string" },
  { id: "lastCheckinAt", label: "lastCheckinAt", type: "timestamp" },
  { id: "osVersion", label: "osVersion", type: "string" },
  { id: "managementAgent", label: "managementAgent", type: "string" },
  { id: "hasAutopilotRecord", label: "hasAutopilotRecord", type: "boolean" },
  { id: "hasIntuneRecord", label: "hasIntuneRecord", type: "boolean" },
  { id: "hasEntraRecord", label: "hasEntraRecord", type: "boolean" },
  { id: "hasConfigMgrClient", label: "hasConfigMgrClient", type: "boolean" },
  { id: "hybridJoinConfigured", label: "hybridJoinConfigured", type: "boolean" },
  { id: "assignmentChainComplete", label: "assignmentChainComplete", type: "boolean" },
  { id: "flagCount", label: "flagCount", type: "number" }
];

function fieldType(fieldId: string): FieldType {
  return FIELD_OPTIONS.find((f) => f.id === fieldId)?.type ?? "string";
}

const OP_OPTIONS: Array<{ value: RuleOp; label: string; needsValue: boolean }> = [
  { value: "eq", label: "equals", needsValue: true },
  { value: "neq", label: "does not equal", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "not_contains", label: "does not contain", needsValue: true },
  { value: "starts_with", label: "starts with", needsValue: true },
  { value: "ends_with", label: "ends with", needsValue: true },
  { value: "exists", label: "is present", needsValue: false },
  { value: "missing", label: "is missing", needsValue: false },
  { value: "in", label: "is one of (csv)", needsValue: true },
  { value: "not_in", label: "is none of (csv)", needsValue: true },
  { value: "older_than_hours", label: "older than (hours)", needsValue: true },
  { value: "newer_than_hours", label: "newer than (hours)", needsValue: true }
];

const SEVERITY_BADGE: Record<RuleSeverity, string> = {
  critical: "bg-[var(--pc-critical-muted)] text-[var(--pc-critical)] ring-1 ring-[var(--pc-critical)]/40",
  warning: "bg-[var(--pc-warning-muted)] text-[var(--pc-warning)] ring-1 ring-[var(--pc-warning)]/40",
  info: "bg-[var(--pc-info-muted)] text-[var(--pc-info)] ring-1 ring-[var(--pc-info)]/40"
};

interface FormState {
  name: string;
  description: string;
  severity: RuleSeverity;
  field: string;
  op: RuleOp;
  value: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  severity: "warning",
  field: "deploymentMode",
  op: "eq",
  value: ""
};

export function buildPayload(form: FormState): RuleInputPayload {
  const opMeta = OP_OPTIONS.find((o) => o.value === form.op);
  let parsedValue: string | number | boolean | null = form.value;

  if (!opMeta?.needsValue) {
    parsedValue = null;
  } else if (form.op === "older_than_hours" || form.op === "newer_than_hours") {
    // Staleness ops always take a numeric hours value regardless of field.
    parsedValue = Number(form.value);
  } else if (form.op === "in" || form.op === "not_in") {
    // CSV list ops keep the raw string; the engine splits on comma.
    parsedValue = form.value;
  } else {
    // Coerce per the field's declared type so boolean/number context
    // fields compare correctly against the value the operator typed.
    // `evaluateRules.normalize()` preserves primitive types, so
    // `true === "true"` would silently fail otherwise.
    const type = fieldType(form.field);
    if (type === "boolean") {
      parsedValue = form.value === "true";
    } else if (type === "number") {
      const asNumber = Number(form.value);
      parsedValue = Number.isFinite(asNumber) ? asNumber : form.value;
    }
  }

  return {
    name: form.name.trim(),
    description: form.description.trim(),
    severity: form.severity,
    scope: "global",
    scopeValue: null,
    enabled: true,
    predicate: {
      type: "leaf",
      field: form.field,
      op: form.op,
      value: parsedValue
    }
  };
}

function describePredicate(rule: RuleDefinition): string {
  const predicate = rule.predicate;
  if (predicate.type !== "leaf") {
    return "Compound rule";
  }
  const opMeta = OP_OPTIONS.find((o) => o.value === predicate.op);
  const rawValue = predicate.value;
  const printedValue =
    opMeta?.needsValue && rawValue !== null && rawValue !== undefined
      ? ` ${typeof rawValue === "boolean" ? String(rawValue) : String(rawValue)}`
      : "";
  return `${predicate.field} ${opMeta?.label ?? predicate.op}${printedValue}`;
}

export function RulesSection() {
  const rules = useRules();
  const mutations = useRuleMutations();
  const preview = useRulePreview();
  const auth = useAuthStatus();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [previewResult, setPreviewResult] = useState<RulePreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RuleDefinition | null>(null);

  const resetPreview = () => {
    setPreviewResult(null);
    setPreviewError(null);
  };

  const runPreview = () => {
    if (!form.name && form.op !== "exists" && form.op !== "missing" && !form.value) return;
    resetPreview();
    const payload = buildPayload(form);
    preview.mutate(
      {
        predicate: payload.predicate,
        scope: payload.scope,
        scopeValue: payload.scopeValue,
        severity: payload.severity
      },
      {
        onSuccess: (data) => setPreviewResult(data),
        onError: (error) =>
          setPreviewError(error instanceof Error ? error.message : "Preview failed")
      }
    );
  };

  const opMeta = OP_OPTIONS.find((o) => o.value === form.op);
  const isAuthed = auth.data?.authenticated === true;
  const currentFieldType = fieldType(form.field);
  const isHourOp = form.op === "older_than_hours" || form.op === "newer_than_hours";
  const isBooleanValue = currentFieldType === "boolean" && !isHourOp;
  const valuePlaceholder =
    form.op === "in" || form.op === "not_in"
      ? "comma,separated,values"
      : isHourOp
        ? "e.g. 24"
        : currentFieldType === "number"
          ? "numeric"
          : "value";

  return (
    <section id="rules" className="scroll-mt-6 space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--pc-text-secondary)]">
          11. Custom Rules
        </h2>
        <span className="text-[11px] text-[var(--pc-text-muted)]">
          Encode your own join, configuration, and posture expectations
        </span>
      </div>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ScrollText className="h-4 w-4 text-[var(--pc-accent)]" />
            <div className="text-[13px] font-semibold text-[var(--pc-text)]">Rule definitions</div>
          </div>
          <Button
            variant={showForm ? "secondary" : "default"}
            onClick={() => setShowForm((value) => !value)}
          >
            <Plus className="h-3.5 w-3.5" />
            {showForm ? "Cancel" : "New rule"}
          </Button>
        </div>

        {showForm ? (
          <div className="mb-5 grid gap-3 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-4 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium text-[var(--pc-text-muted)]">Name</label>
              <Input
                placeholder="e.g. Win11 23H2 floor…"
                value={form.name}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, name: event.target.value }))
                }
                className="mt-1 w-full"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--pc-text-muted)]">Severity</label>
              <select
                value={form.severity}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    severity: event.target.value as RuleSeverity
                  }))
                }
                className="pc-select mt-1 w-full"
              >
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] font-medium text-[var(--pc-text-muted)]">
                Description
              </label>
              <Input
                placeholder="Why this rule matters and what to do when it fires…"
                value={form.description}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, description: event.target.value }))
                }
                className="mt-1 w-full"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--pc-text-muted)]">Field</label>
              <select
                value={form.field}
                onChange={(event) => {
                  const nextField = event.target.value;
                  const nextType = fieldType(nextField);
                  setForm((previous) => ({
                    ...previous,
                    field: nextField,
                    // Reset the value when switching to a typed field so
                    // a boolean field starts at "true" and a number field
                    // doesn't carry over stale text.
                    value:
                      nextType === "boolean"
                        ? "true"
                        : nextType === "number"
                          ? ""
                          : previous.value
                  }));
                }}
                className="pc-select mt-1 w-full"
              >
                {FIELD_OPTIONS.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.label}
                    {field.type !== "string" ? ` (${field.type})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--pc-text-muted)]">Operator</label>
              <select
                value={form.op}
                onChange={(event) =>
                  setForm((previous) => ({ ...previous, op: event.target.value as RuleOp }))
                }
                className="pc-select mt-1 w-full"
              >
                {OP_OPTIONS.map((op) => (
                  <option key={op.value} value={op.value}>
                    {op.label}
                  </option>
                ))}
              </select>
            </div>
            {opMeta?.needsValue ? (
              <div className="sm:col-span-2">
                <label className="text-[11px] font-medium text-[var(--pc-text-muted)]">Value</label>
                {isBooleanValue ? (
                  <select
                    value={form.value === "true" ? "true" : "false"}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, value: event.target.value }))
                    }
                    className="pc-select mt-1 w-full"
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : (
                  <Input
                    type={
                      isHourOp || currentFieldType === "number" ? "number" : "text"
                    }
                    placeholder={valuePlaceholder}
                    value={form.value}
                    onChange={(event) =>
                      setForm((previous) => ({ ...previous, value: event.target.value }))
                    }
                    className="mt-1 w-full"
                  />
                )}
              </div>
            ) : null}
            <div className="sm:col-span-2 flex items-center justify-between gap-2">
              <div className="text-[11px] text-[var(--pc-text-muted)]">
                {isAuthed
                  ? "Preview is read-only; saving recomputes device state."
                  : "Admin sign-in required to save rules."}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  onClick={runPreview}
                  disabled={preview.isPending}
                  title="Evaluate this predicate against the current device snapshot"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {preview.isPending ? "Previewing…" : "Preview matches"}
                </Button>
                <Button
                  disabled={!isAuthed || !form.name || mutations.create.isPending}
                  title={!isAuthed ? "Sign in as an admin to save rules" : undefined}
                  onClick={() =>
                    mutations.create.mutate(buildPayload(form), {
                      onSuccess: () => {
                        setForm(EMPTY_FORM);
                        setShowForm(false);
                        resetPreview();
                      }
                    })
                  }
                >
                  {mutations.create.isPending ? "Saving…" : "Save rule"}
                </Button>
              </div>
            </div>
            {previewError ? (
              <div className="sm:col-span-2 rounded-md border border-[var(--pc-critical)]/40 bg-[var(--pc-critical-muted)] px-3 py-2 text-[11px] text-[var(--pc-critical)]">
                {previewError}
              </div>
            ) : null}
            {previewResult ? (
              <div className="sm:col-span-2 rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface)] px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-[12px] font-semibold text-[var(--pc-text)]">
                    {previewResult.count === 0
                      ? "No devices match"
                      : previewResult.count === 1
                        ? "1 device would match"
                        : `${previewResult.count} devices would match`}
                  </div>
                  <div className="text-[11px] text-[var(--pc-text-muted)]">
                    of {previewResult.total} in snapshot
                  </div>
                </div>
                {previewResult.sampleDevices.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 text-[11px] text-[var(--pc-text-secondary)]">
                    {previewResult.sampleDevices.map((device) => (
                      <li key={device.deviceKey} className="flex items-center gap-2">
                        <span className="font-mono text-[var(--pc-text-muted)]">
                          {device.serialNumber ?? "—"}
                        </span>
                        <span className="truncate">{device.deviceName ?? "(unnamed)"}</span>
                        {device.assignedProfileName ? (
                          <span className="text-[var(--pc-text-muted)]">
                            · {device.assignedProfileName}
                          </span>
                        ) : null}
                      </li>
                    ))}
                    {previewResult.count > previewResult.sampleDevices.length ? (
                      <li className="pt-1 text-[var(--pc-text-muted)]">
                        …and {previewResult.count - previewResult.sampleDevices.length} more
                      </li>
                    ) : null}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {rules.isLoading ? (
          <div className="text-[12px] text-[var(--pc-text-muted)]">Loading rules…</div>
        ) : rules.isError ? (
          <div className="text-[12px] text-[var(--pc-critical)]">Could not load rules.</div>
        ) : !rules.data || rules.data.length === 0 ? (
          <div className="rounded-md border border-dashed border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-4 py-6 text-center text-[12px] text-[var(--pc-text-muted)]">
            No custom rules yet. Built-in flags still run; rules let you encode
            site-specific expectations on top.
          </div>
        ) : (
          <ul className="divide-y divide-[var(--pc-border)]">
            {rules.data.map((rule) => (
              <li
                key={rule.id}
                className="flex items-start gap-3 rounded-[var(--pc-radius-sm)] px-2 py-3 transition-colors duration-150 hover:bg-[var(--pc-tint-hover)]"
              >
                <button
                  type="button"
                  className="mt-0.5 text-[var(--pc-text-muted)] hover:text-[var(--pc-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
                  title={
                    !isAuthed
                      ? "Sign in as an admin to change rules"
                      : rule.enabled
                        ? "Disable rule"
                        : "Enable rule"
                  }
                  disabled={!isAuthed || mutations.update.isPending}
                  onClick={() =>
                    mutations.update.mutate({
                      id: rule.id,
                      input: { enabled: !rule.enabled }
                    })
                  }
                >
                  {rule.enabled ? (
                    <ToggleRight className="h-5 w-5 text-[var(--pc-healthy)]" />
                  ) : (
                    <ToggleLeft className="h-5 w-5" />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-[13px] font-semibold text-[var(--pc-text)]">{rule.name}</div>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium capitalize ${SEVERITY_BADGE[rule.severity]}`}
                    >
                      {rule.severity}
                    </span>
                    {!rule.enabled ? (
                      <span className="rounded-md bg-[var(--pc-tint-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--pc-text-muted)]">
                        Disabled
                      </span>
                    ) : null}
                  </div>
                  {rule.description ? (
                    <div className="mt-0.5 text-[12px] text-[var(--pc-text-secondary)]">
                      {rule.description}
                    </div>
                  ) : null}
                  <div className="mt-1 font-mono text-[11px] text-[var(--pc-text-muted)]">
                    {describePredicate(rule)}
                  </div>
                </div>
                <Button
                  variant="destructive"
                  className="h-8 px-2.5"
                  disabled={!isAuthed}
                  title={!isAuthed ? "Sign in as an admin to delete rules" : undefined}
                  onClick={() => setDeleteTarget(rule)}
                  aria-label={`Delete ${rule.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete rule"
        description={`Permanently remove the rule "${deleteTarget?.name ?? ""}"? Devices will no longer be evaluated against this rule.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleteTarget) mutations.remove.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </section>
  );
}
