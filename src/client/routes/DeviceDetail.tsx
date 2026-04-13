import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Fingerprint,
  GitBranch,
  Radio,
  Target
} from "lucide-react";

import { ActionHistory } from "../components/devices/ActionHistory.js";
import { ActionsToolbar } from "../components/devices/ActionsToolbar.js";
import { AssignmentPanel } from "../components/devices/AssignmentPanel.js";
import { AssignmentPathPanel } from "../components/devices/AssignmentPathPanel.js";
import { buildSummaryText, CopySummaryButton } from "../components/devices/CopySummaryButton.js";
import { DeviceShortcuts } from "../components/devices/DeviceShortcuts.js";
import { DiagnosticPanel } from "../components/devices/DiagnosticPanel.js";
import { GroupMembershipsPanel } from "../components/devices/GroupMembershipsPanel.js";
import { HardwarePanel } from "../components/devices/HardwarePanel.js";
import { HistoryPanel } from "../components/devices/HistoryPanel.js";
import { IdentityPanel } from "../components/devices/IdentityPanel.js";
import { LapsWidget } from "../components/devices/LapsWidget.js";
import { ProvisioningTimeline } from "../components/devices/ProvisioningTimeline.js";
import { RuleViolationsPanel } from "../components/devices/RuleViolationsPanel.js";
import { SourceJsonPanel } from "../components/devices/SourceJsonPanel.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { useToast } from "../components/shared/toast.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import { useDevice } from "../hooks/useDevices.js";
import type { FlagCode, FlagExplanation, HealthLevel } from "../lib/types.js";
import { cn } from "../lib/utils.js";

type BreakpointKey = "identity" | "targeting" | "enrollment" | "drift";

const BREAKPOINT_BUCKETS: Record<BreakpointKey, FlagCode[]> = {
  identity: ["identity_conflict", "missing_ztdid"],
  targeting: [
    "not_in_target_group",
    "tag_mismatch",
    "no_profile_assigned",
    "deployment_mode_mismatch"
  ],
  enrollment: [
    "no_autopilot_record",
    "profile_assignment_failed",
    "profile_assigned_not_enrolled",
    "orphaned_autopilot",
    "provisioning_stalled"
  ],
  drift: ["hybrid_join_risk", "user_mismatch", "compliance_drift"]
};

const BREAKPOINT_META: Record<
  BreakpointKey,
  { label: string; description: string; icon: typeof Fingerprint; scrollTo: string }
> = {
  identity: {
    label: "Identity",
    description: "Who is this device across systems",
    icon: Fingerprint,
    scrollTo: "section-identity"
  },
  targeting: {
    label: "Targeting",
    description: "Group membership & profile assignment",
    icon: Target,
    scrollTo: "section-targeting"
  },
  enrollment: {
    label: "Enrollment",
    description: "Autopilot record & Intune check-in",
    icon: Radio,
    scrollTo: "section-diagnostics"
  },
  drift: {
    label: "Drift",
    description: "Compliance, hybrid join, primary user",
    icon: GitBranch,
    scrollTo: "section-diagnostics"
  }
};

function bucketDiagnostics(diagnostics: FlagExplanation[]) {
  const buckets: Record<
    BreakpointKey,
    { issues: FlagExplanation[]; severity: Exclude<HealthLevel, "healthy" | "unknown"> | null }
  > = {
    identity: { issues: [], severity: null },
    targeting: { issues: [], severity: null },
    enrollment: { issues: [], severity: null },
    drift: { issues: [], severity: null }
  };
  const severityRank: Record<string, number> = { info: 1, warning: 2, critical: 3 };
  for (const diag of diagnostics) {
    for (const key of Object.keys(BREAKPOINT_BUCKETS) as BreakpointKey[]) {
      if (BREAKPOINT_BUCKETS[key].includes(diag.code)) {
        buckets[key].issues.push(diag);
        const current = buckets[key].severity;
        if (!current || severityRank[diag.severity] > severityRank[current]) {
          buckets[key].severity = diag.severity;
        }
        break;
      }
    }
  }
  return buckets;
}

function BreakpointChip({
  bucketKey,
  count,
  severity,
  issues
}: {
  bucketKey: BreakpointKey;
  count: number;
  severity: Exclude<HealthLevel, "healthy" | "unknown"> | null;
  issues: FlagExplanation[];
}) {
  const meta = BREAKPOINT_META[bucketKey];
  const Icon = count === 0 ? CheckCircle2 : meta.icon;
  const tone =
    count === 0
      ? "border-[var(--pc-healthy)]/30 bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)]"
      : severity === "critical"
        ? "border-[var(--pc-critical)]/40 bg-[var(--pc-critical-muted)] text-rose-100"
        : severity === "warning"
          ? "border-[var(--pc-warning)]/40 bg-[var(--pc-warning-muted)] text-amber-100"
          : "border-[var(--pc-info)]/40 bg-[var(--pc-info-muted)] text-sky-100";
  const title =
    count === 0
      ? `${meta.label}: clear — ${meta.description}`
      : `${meta.label} (${count}): ${issues.map((i) => i.title).join(" • ")}`;
  const scrollTarget = meta.scrollTo;
  return (
    <button
      type="button"
      title={title}
      onClick={() => {
        const el = document.getElementById(scrollTarget);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11.5px] transition-opacity hover:opacity-80",
        tone
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
          {meta.label}
        </div>
        <div className="text-[12px] font-semibold tabular-nums leading-tight">
          {count === 0 ? "Clear" : `${count} ${count === 1 ? "issue" : "issues"}`}
        </div>
      </div>
    </button>
  );
}

const DEVICES_DEFAULT_SEARCH = {
  search: undefined,
  health: undefined,
  flag: undefined,
  property: undefined,
  profile: undefined,
  page: 1,
  pageSize: 25
} as const;

function SectionHeading({
  number,
  title,
  description
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--pc-accent-muted)] text-[10.5px] font-semibold text-[var(--pc-accent-hover)]">
        {number}
      </span>
      <div>
        <div className="text-[12.5px] font-semibold uppercase tracking-wide text-[var(--pc-text-secondary)]">
          {title}
        </div>
        <div className="text-[11.5px] text-[var(--pc-text-muted)]">{description}</div>
      </div>
    </div>
  );
}

export function DeviceDetailPage() {
  const { deviceKey } = useParams({ from: "/devices/$deviceKey" });
  const device = useDevice(deviceKey);

  if (device.isLoading) return <LoadingState label="Loading device…" />;
  if (device.isError || !device.data) {
    return (
      <ErrorState
        title="Could not load device"
        error={device.error}
        onRetry={() => device.refetch()}
      />
    );
  }

  const data = device.data;
  const displayName = data.summary.deviceName ?? data.summary.serialNumber ?? deviceKey;
  const breakpoints = bucketDiagnostics(data.diagnostics);
  const toast = useToast();

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildSummaryText(data));
      toast.push({
        variant: "success",
        title: "Summary copied",
        description: "Device summary copied to clipboard.",
        durationMs: 2000
      });
    } catch {
      toast.push({
        variant: "error",
        title: "Could not copy",
        description: "Clipboard access denied."
      });
    }
  };

  return (
    <div className="space-y-6">
      <DeviceShortcuts
        deviceKey={deviceKey}
        deviceLabel={displayName}
        onRefresh={() => device.refetch()}
        onCopy={handleCopySummary}
      />
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="flex items-center gap-1.5 text-[12px] text-[var(--pc-text-muted)]">
          <Link
            to="/devices"
            search={DEVICES_DEFAULT_SEARCH}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--pc-text)]"
          >
            <ArrowLeft className="h-3 w-3" />
            Devices
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="truncate text-[var(--pc-text-secondary)]" title={displayName}>
            {displayName}
          </span>
        </nav>
        <div className="hidden items-center gap-3 sm:flex">
          <CopySummaryButton device={data} />
          <div className="flex items-center gap-2 text-[10.5px] text-[var(--pc-text-muted)]">
            <kbd className="rounded border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-1 py-px font-mono text-[10px]">
              r
            </kbd>
            refresh
            <kbd className="rounded border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-1 py-px font-mono text-[10px]">
              s
            </kbd>
            sync
            <kbd className="rounded border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-1 py-px font-mono text-[10px]">
              c
            </kbd>
            copy
            <kbd className="rounded border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-1 py-px font-mono text-[10px]">
              b
            </kbd>
            back
          </div>
        </div>
      </div>

      {/* Hero header */}
      <header className="rounded-xl border border-[var(--pc-border)] bg-[var(--pc-surface)] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--pc-accent)]">
              Device Diagnostics
            </div>
            <h1
              className="mt-1 truncate text-2xl font-semibold tracking-tight text-white"
              title={displayName}
            >
              {displayName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--pc-text-muted)]">
              <span>
                Serial{" "}
                <span className="font-mono text-[var(--pc-text-secondary)]">
                  {data.summary.serialNumber ?? "—"}
                </span>
              </span>
              {data.summary.propertyLabel ? (
                <span>
                  Property{" "}
                  <span className="text-[var(--pc-text-secondary)]">{data.summary.propertyLabel}</span>
                </span>
              ) : null}
              <span>
                {data.diagnostics.length} active{" "}
                {data.diagnostics.length === 1 ? "issue" : "issues"}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Fingerprint className="h-3 w-3" />
                Correlation{" "}
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10.5px] font-medium capitalize",
                    data.identity.matchConfidence === "high"
                      ? "bg-[var(--pc-healthy-muted)] text-emerald-200"
                      : data.identity.matchConfidence === "medium"
                        ? "bg-[var(--pc-warning-muted)] text-amber-200"
                        : "bg-[var(--pc-critical-muted)] text-red-200"
                  )}
                >
                  {data.identity.matchConfidence}
                </span>
              </span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <StatusBadge health={data.summary.health} />
            <p
              className="max-w-md text-[12.5px] leading-relaxed text-[var(--pc-text-secondary)] lg:text-right"
              title={data.summary.diagnosis}
            >
              {data.summary.diagnosis}
            </p>
          </div>
        </div>

        {/* Name-joined correlation warning */}
        {data.identity.nameJoined && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-[var(--pc-warning)]/30 bg-[var(--pc-warning-muted)] px-3.5 py-2.5">
            <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pc-warning)]" />
            <div className="text-[12px] leading-relaxed text-amber-100">
              <span className="font-semibold">Name-only correlation.</span>{" "}
              This device's source records were linked by display name only — the weakest join signal.
              Verify identity before trusting cross-system diagnostics.
            </div>
          </div>
        )}

        {/* Breakpoint chips — at-a-glance which subsystem is failing */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(BREAKPOINT_BUCKETS) as BreakpointKey[]).map((key) => (
            <BreakpointChip
              key={key}
              bucketKey={key}
              count={breakpoints[key].issues.length}
              severity={breakpoints[key].severity}
              issues={breakpoints[key].issues}
            />
          ))}
        </div>
      </header>

      {/* Section 1: Identity — who is this device, across systems */}
      <section id="section-identity" className="scroll-mt-4 space-y-3">
        <SectionHeading
          number={1}
          title="Identity"
          description="Who this device is across Autopilot, Intune, and Entra ID"
        />
        <IdentityPanel device={data} />
      </section>

      {/* Section 2: Hardware & Enrollment + Group Memberships + Provisioning */}
      <section id="section-hardware" className="scroll-mt-4 space-y-3">
        <SectionHeading
          number={2}
          title="Hardware & Provisioning"
          description="Physical device details, group memberships, and provisioning progress"
        />
        <HardwarePanel device={data} />
        <ProvisioningTimeline device={data} />
        <GroupMembershipsPanel device={data} />
      </section>

      {/* Section 3: Configuration — what it's meant to be */}
      <section id="section-targeting" className="scroll-mt-4 space-y-3">
        <SectionHeading
          number={3}
          title="Expected Configuration"
          description="The provisioning chain that determines this device's intended state"
        />
        <AssignmentPathPanel path={data.assignmentPath} />
        <AssignmentPanel device={data} />
      </section>

      {/* Section 4: Diagnostics — why it's not what it should be */}
      <section id="section-diagnostics" className="scroll-mt-4 space-y-3">
        <SectionHeading
          number={4}
          title="Diagnostics"
          description="What the state engine found and why it matters"
        />
        <DiagnosticPanel device={data} />
        <RuleViolationsPanel device={data} />
      </section>

      {/* Section 5: Operate — admin tools */}
      <section id="section-operate" className="scroll-mt-4 space-y-3">
        <SectionHeading
          number={5}
          title="Operate"
          description="Remote actions, secrets, and audit history (delegated sign-in required)"
        />
        <ActionsToolbar device={data} />
        <LapsWidget device={data} />
        <ActionHistory device={data} />
      </section>

      {/* Section 6: History — when did this device's state actually change */}
      <section id="section-history" className="scroll-mt-4 space-y-3">
        <SectionHeading
          number={6}
          title="History"
          description="State transitions over time — when this device changed and what flipped"
        />
        <HistoryPanel device={data} />
      </section>

      {/* Section 7: Source Data — raw Graph JSON for verification */}
      <section id="section-source" className="scroll-mt-4 space-y-3">
        <SectionHeading
          number={7}
          title="Source Data"
          description="Raw JSON from Microsoft Graph — verify what the engine is working with"
        />
        <SourceJsonPanel device={data} />
      </section>
    </div>
  );
}
