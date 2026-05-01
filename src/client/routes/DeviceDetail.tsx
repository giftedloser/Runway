import {
  Link,
  useNavigate,
  useParams,
  useSearch,
} from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Fingerprint,
  GitBranch,
  Radio,
  Target,
  Wrench,
} from "lucide-react";

import { ActionHistory } from "../components/devices/ActionHistory.js";
import { ActionsToolbar } from "../components/devices/ActionsToolbar.js";
import { AppStatusPanel } from "../components/devices/AppStatusPanel.js";
import { AssignmentPanel } from "../components/devices/AssignmentPanel.js";
import { BitLockerWidget } from "../components/devices/BitLockerWidget.js";
import { AssignmentPathPanel } from "../components/devices/AssignmentPathPanel.js";
import {
  buildSummaryText,
  CopySummaryButton,
} from "../components/devices/CopySummaryButton.js";
import { CompliancePoliciesPanel } from "../components/devices/CompliancePoliciesPanel.js";
import { ConditionalAccessPanel } from "../components/devices/ConditionalAccessPanel.js";
import { ConfigMgrConnectionPanel } from "../components/devices/ConfigMgrConnectionPanel.js";
import { ConfigProfilesPanel } from "../components/devices/ConfigProfilesPanel.js";
import { DeviceShortcuts } from "../components/devices/DeviceShortcuts.js";
import { DiagnosticPanel } from "../components/devices/DiagnosticPanel.js";
import { GroupMembershipsPanel } from "../components/devices/GroupMembershipsPanel.js";
import { HardwarePanel } from "../components/devices/HardwarePanel.js";
import { HistoryPanel } from "../components/devices/HistoryPanel.js";
import { IdentityPanel } from "../components/devices/IdentityPanel.js";
import { JoinPicturePanel } from "../components/devices/JoinPicturePanel.js";
import { LapsWidget } from "../components/devices/LapsWidget.js";
import { NextBestActionPanel } from "../components/devices/NextBestActionPanel.js";
import { ProvisioningTimeline } from "../components/devices/ProvisioningTimeline.js";
import { RelatedDevicesPanel } from "../components/devices/RelatedDevicesPanel.js";
import { RuleViolationsPanel } from "../components/devices/RuleViolationsPanel.js";
import { SourceJsonPanel } from "../components/devices/SourceJsonPanel.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { useToast } from "../components/shared/toast.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import { useDevice } from "../hooks/useDevices.js";
import { useSettings } from "../hooks/useSettings.js";
import { openExternalUrl } from "../lib/desktop.js";
import {
  autopilotDeviceUrl,
  entraDeviceUrl,
  intuneDeviceUrl,
} from "../lib/deep-links.js";
import type { FlagCode, FlagExplanation, HealthLevel } from "../lib/types.js";
import { cn } from "../lib/utils.js";

type BreakpointKey = "identity" | "targeting" | "enrollment" | "drift";
type TabKey = BreakpointKey | "operate" | "history";
const TAB_ORDER: TabKey[] = [
  "identity",
  "targeting",
  "enrollment",
  "drift",
  "operate",
  "history",
];
const TAB_LABELS: Record<TabKey, { label: string; icon: typeof Fingerprint }> =
  {
    identity: { label: "Identity", icon: Fingerprint },
    targeting: { label: "Targeting", icon: Target },
    enrollment: { label: "Enrollment", icon: Radio },
    drift: { label: "Compliance & Drift", icon: GitBranch },
    operate: { label: "Actions", icon: Wrench },
    history: { label: "History & Raw Data", icon: Clock },
  };

const BREAKPOINT_BUCKETS: Record<BreakpointKey, FlagCode[]> = {
  identity: ["identity_conflict", "missing_ztdid"],
  targeting: [
    "not_in_target_group",
    "tag_mismatch",
    "no_profile_assigned",
    "deployment_mode_mismatch",
  ],
  enrollment: [
    "no_autopilot_record",
    "profile_assignment_failed",
    "profile_assigned_not_enrolled",
    "orphaned_autopilot",
    "provisioning_stalled",
  ],
  drift: ["hybrid_join_risk", "user_mismatch", "compliance_drift"],
};

const BREAKPOINT_META: Record<
  BreakpointKey,
  {
    label: string;
    description: string;
    icon: typeof Fingerprint;
    scrollTo: string;
  }
> = {
  identity: {
    label: "Identity",
    description: "Who is this device across systems",
    icon: Fingerprint,
    scrollTo: "section-identity",
  },
  targeting: {
    label: "Targeting",
    description: "Group membership & profile assignment",
    icon: Target,
    scrollTo: "section-targeting",
  },
  enrollment: {
    label: "Enrollment",
    description: "Autopilot record & Intune check-in",
    icon: Radio,
    scrollTo: "section-diagnostics",
  },
  drift: {
    label: "Drift",
    description: "Compliance, hybrid join, primary user",
    icon: GitBranch,
    scrollTo: "section-diagnostics",
  },
};

function bucketDiagnostics(diagnostics: FlagExplanation[]) {
  const buckets: Record<
    BreakpointKey,
    {
      issues: FlagExplanation[];
      severity: Exclude<HealthLevel, "healthy" | "unknown"> | null;
    }
  > = {
    identity: { issues: [], severity: null },
    targeting: { issues: [], severity: null },
    enrollment: { issues: [], severity: null },
    drift: { issues: [], severity: null },
  };
  const severityRank: Record<string, number> = {
    info: 1,
    warning: 2,
    critical: 3,
  };
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
  issues,
  onSelect,
}: {
  bucketKey: BreakpointKey;
  count: number;
  severity: Exclude<HealthLevel, "healthy" | "unknown"> | null;
  issues: FlagExplanation[];
  onSelect: (tab: TabKey) => void;
}) {
  const meta = BREAKPOINT_META[bucketKey];
  const Icon = count === 0 ? CheckCircle2 : meta.icon;
  const tone =
    count === 0
      ? "border-[var(--pc-healthy)]/30 bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)]"
      : severity === "critical"
        ? "border-[var(--pc-critical)]/40 bg-[var(--pc-critical-muted)] text-[var(--pc-critical)]"
        : severity === "warning"
          ? "border-[var(--pc-warning)]/40 bg-[var(--pc-warning-muted)] text-[var(--pc-warning)]"
          : "border-[var(--pc-info)]/40 bg-[var(--pc-info-muted)] text-[var(--pc-info)]";
  const title =
    count === 0
      ? `${meta.label}: clear — ${meta.description}`
      : `${meta.label} (${count}): ${issues.map((i) => i.title).join(" • ")}`;
  return (
    <button
      type="button"
      title={title}
      onClick={() => onSelect(bucketKey)}
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[11.5px] transition-opacity hover:opacity-80",
        tone,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
          {meta.label}
        </div>
        <div className="text-[12px] font-semibold tabular-nums leading-tight">
          {count === 0
            ? "Clear"
            : `${count} ${count === 1 ? "issue" : "issues"}`}
        </div>
      </div>
    </button>
  );
}

function TabButton({
  tab,
  active,
  count,
  onSelect,
}: {
  tab: TabKey;
  active: boolean;
  count?: number;
  onSelect: (tab: TabKey) => void;
}) {
  const meta = TAB_LABELS[tab];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(tab)}
      className={cn(
        "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[12.5px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]",
        active
          ? "border-[var(--pc-accent)] text-[var(--pc-text)]"
          : "border-transparent text-[var(--pc-text-muted)] hover:text-[var(--pc-text-secondary)]",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{meta.label}</span>
      {count !== undefined && count > 0 ? (
        <span className="rounded-full bg-[var(--pc-critical-muted)] px-1.5 py-px text-[10px] font-semibold text-[var(--pc-critical)]">
          {count}
        </span>
      ) : null}
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
  pageSize: 25,
} as const;

function TabHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="text-[12.5px] font-semibold text-[var(--pc-text-secondary)]">
        {title}
      </div>
      <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-[var(--pc-text-muted)]">
        {description}
      </div>
    </div>
  );
}

function openUrlInBrowser(url: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function DevicePortalLinks({
  intuneId,
  entraId,
  autopilotId,
}: {
  intuneId: string | null;
  entraId: string | null;
  autopilotId: string | null;
}) {
  const toast = useToast();
  const links = [
    intuneId
      ? {
          label: "Open in Intune",
          url: intuneDeviceUrl(intuneId),
        }
      : null,
    entraId
      ? {
          label: "Open in Entra",
          url: entraDeviceUrl(entraId),
        }
      : null,
    autopilotId
      ? {
          label: "Open Autopilot",
          url: autopilotDeviceUrl(autopilotId),
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; url: string }>;

  if (links.length === 0) return null;

  const handleOpen = async (label: string, url: string) => {
    const openedNatively = await openExternalUrl(url);
    if (!openedNatively) {
      try {
        openUrlInBrowser(url);
      } catch {
        toast.push({
          variant: "error",
          title: "Could not open portal",
          description: label,
        });
        return;
      }
    }

    toast.push({
      variant: "info",
      title: "Opening Microsoft portal",
      description: label,
      durationMs: 1500,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {links.map((link) => (
        <button
          key={link.label}
          type="button"
          onClick={() => void handleOpen(link.label, link.url)}
          className="inline-flex items-center gap-1.5 rounded-[var(--pc-radius-sm)] border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--pc-text-secondary)] transition-colors hover:border-[var(--pc-accent)]/40 hover:text-[var(--pc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
          title={link.url}
        >
          <ExternalLink className="h-3.5 w-3.5 text-[var(--pc-accent)]" />
          {link.label}
        </button>
      ))}
    </div>
  );
}

export function DeviceDetailPage() {
  const { deviceKey } = useParams({ from: "/devices/$deviceKey" });
  const search = useSearch({ from: "/devices/$deviceKey" }) as { tab?: TabKey };
  const navigate = useNavigate({ from: "/devices/$deviceKey" });
  const device = useDevice(deviceKey);
  const settings = useSettings();
  const toast = useToast();

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
  const showConfigMgrConnection =
    settings.data?.featureFlags.sccm_detection === true;
  const displayName =
    data.summary.deviceName ?? data.summary.serialNumber ?? deviceKey;
  const breakpoints = bucketDiagnostics(data.diagnostics);

  // Default tab: the highest-severity breakpoint bucket, or "identity" if clear.
  const defaultTab: TabKey =
    (["critical", "warning", "info"] as const).reduce<TabKey | null>(
      (found, level) => {
        if (found) return found;
        for (const key of [
          "identity",
          "targeting",
          "enrollment",
          "drift",
        ] as BreakpointKey[]) {
          const bucket = breakpoints[key];
          if (bucket.issues.length > 0 && bucket.severity === level) return key;
        }
        return null;
      },
      null,
    ) ?? "identity";
  const activeTab: TabKey = search.tab ?? defaultTab;
  const selectTab = (tab: TabKey) => {
    void navigate({
      to: "/devices/$deviceKey",
      params: { deviceKey },
      search: { tab },
    });
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildSummaryText(data));
      toast.push({
        variant: "success",
        title: "Summary copied",
        description: "Device summary copied to clipboard.",
        durationMs: 2000,
      });
    } catch {
      toast.push({
        variant: "error",
        title: "Could not copy",
        description: "Clipboard access denied.",
      });
    }
  };

  return (
    <div className="space-y-5">
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
          <span
            className="truncate text-[var(--pc-text-secondary)]"
            title={displayName}
          >
            {displayName}
          </span>
        </nav>
        <div className="hidden items-center gap-3 sm:flex">
          <CopySummaryButton device={data} />
        </div>
      </div>

      {/* Hero header */}
      <header className="rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface)] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
              Device Diagnostics
            </div>
            <h1
              className="mt-0.5 truncate text-[1.7rem] font-semibold tracking-tight text-[var(--pc-text)]"
              title={displayName}
            >
              {displayName}
            </h1>
            <p className="mt-1 pc-helper-text max-w-3xl">
              Tap a problem-area chip to jump to the failing subsystem.
            </p>
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
                  <span className="text-[var(--pc-text-secondary)]">
                    {data.summary.propertyLabel}
                  </span>
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
                      ? "bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)]"
                      : data.identity.matchConfidence === "medium"
                        ? "bg-[var(--pc-warning-muted)] text-[var(--pc-warning)]"
                        : "bg-[var(--pc-critical-muted)] text-[var(--pc-critical)]",
                  )}
                >
                  {data.identity.matchConfidence}
                </span>
              </span>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <DevicePortalLinks
              intuneId={data.identity.intuneId}
              entraId={data.identity.entraId}
              autopilotId={data.identity.autopilotId}
            />
            <StatusBadge health={data.summary.health} />
            <p
              className="max-w-md text-[12px] leading-snug text-[var(--pc-text-secondary)] lg:text-right"
              title={data.summary.diagnosis}
            >
              {data.summary.diagnosis}
            </p>
          </div>
        </div>

        {/* Name-joined correlation warning */}
        {data.identity.nameJoined && (
          <div className="mt-3 flex items-start gap-2.5 rounded-[var(--pc-radius)] border border-[var(--pc-warning)]/30 bg-[var(--pc-warning-muted)] px-3.5 py-2.5">
            <Fingerprint className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pc-warning)]" />
            <div className="text-[12px] leading-relaxed text-[var(--pc-warning)]">
              <span className="font-semibold">Name-only correlation.</span> This
              device's source records were linked by display name only — the
              weakest join signal. Verify identity before trusting cross-system
              diagnostics.
            </div>
          </div>
        )}

        {/* Breakpoint chips — click to jump to the failing subsystem tab */}
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          {(Object.keys(BREAKPOINT_BUCKETS) as BreakpointKey[]).map((key) => (
            <BreakpointChip
              key={key}
              bucketKey={key}
              count={breakpoints[key].issues.length}
              severity={breakpoints[key].severity}
              issues={breakpoints[key].issues}
              onSelect={selectTab}
            />
          ))}
        </div>
      </header>

      <NextBestActionPanel device={data} />
      <JoinPicturePanel
        device={data}
        showConfigMgrSignal={showConfigMgrConnection}
      />

      {/* Tab navigation */}
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-1 overflow-x-auto border-b border-[var(--pc-border)] bg-[var(--pc-bg)]/95 px-4 pt-1 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10">
        {TAB_ORDER.map((tab) => {
          const count =
            tab === "identity" ||
            tab === "targeting" ||
            tab === "enrollment" ||
            tab === "drift"
              ? breakpoints[tab].issues.length
              : undefined;
          return (
            <TabButton
              key={tab}
              tab={tab}
              active={activeTab === tab}
              count={count}
              onSelect={selectTab}
            />
          );
        })}
      </div>

      {activeTab === "identity" ? (
        <section className="space-y-3">
          <TabHeading
            title="Identity"
            description="Source record matching and join confidence."
          />
          <IdentityPanel
            device={data}
            showConfigMgrSignal={showConfigMgrConnection}
          />
          <HardwarePanel device={data} />
        </section>
      ) : null}

      {activeTab === "targeting" ? (
        <section className="space-y-3">
          <TabHeading
            title="Targeting"
            description="Group membership and deployment profile intent."
          />
          <AssignmentPathPanel path={data.assignmentPath} />
          <AssignmentPanel device={data} />
          <GroupMembershipsPanel device={data} />
          <ConfigProfilesPanel device={data} />
        </section>
      ) : null}

      {activeTab === "enrollment" ? (
        <section className="space-y-3">
          <TabHeading
            title="Enrollment"
            description="OOBE, Autopilot, and Intune enrollment state."
          />
          <ProvisioningTimeline device={data} />
          <ConfigMgrConnectionPanel
            device={data}
            enabled={showConfigMgrConnection}
          />
          <DiagnosticPanel device={data} />
          <AppStatusPanel device={data} />
        </section>
      ) : null}

      {activeTab === "drift" ? (
        <section className="space-y-3">
          <TabHeading
            title="Compliance & Drift"
            description="Policy drift, hybrid join, ownership, and rules."
          />
          <CompliancePoliciesPanel device={data} />
          <ConditionalAccessPanel device={data} />
          <RuleViolationsPanel device={data} />
        </section>
      ) : null}

      {activeTab === "operate" ? (
        <section className="space-y-3">
          <TabHeading
            title="Actions"
            description="Remote actions, secrets, and related devices."
          />
          <ActionsToolbar device={data} />
          <LapsWidget device={data} />
          <BitLockerWidget device={data} />
          <RelatedDevicesPanel device={data} />
          <ActionHistory device={data} />
        </section>
      ) : null}

      {activeTab === "history" ? (
        <section className="space-y-3">
          <TabHeading
            title="History & Raw Data"
            description="State transitions and raw Graph evidence."
          />
          <HistoryPanel device={data} />
          <SourceJsonPanel device={data} />
        </section>
      ) : null}
    </div>
  );
}
