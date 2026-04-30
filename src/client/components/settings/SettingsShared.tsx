import type { ReactNode } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  DatabaseZap,
} from "lucide-react";

import { SourceBadge } from "../shared/SourceBadge.js";
import { Card } from "../ui/card.js";

const SETTINGS_NAV = [
  { href: "#sync-data", label: "Sync" },
  { href: "#rule-thresholds", label: "Thresholds" },
  { href: "#display-behavior", label: "Display" },
  { href: "#graph", label: "Graph" },
  { href: "#access-security", label: "Security" },
  { href: "#signals", label: "Signals" },
  { href: "#about", label: "About" },
  { href: "#sources", label: "Sources" },
  { href: "#tags", label: "Tags" },
  { href: "#health", label: "Health" },
  { href: "#rules", label: "Rules" },
  { href: "#logs", label: "Logs" },
] as const;

export function SettingsJumpNav() {
  return (
    <nav
      aria-label="Settings sections"
      className="sticky top-2 z-10 rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface-glass)] p-1 shadow-[var(--pc-shadow-card)] backdrop-blur supports-[backdrop-filter]:bg-[var(--pc-surface-glass)]"
    >
      <div className="flex gap-1 overflow-x-auto">
        {SETTINGS_NAV.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="whitespace-nowrap rounded-[var(--pc-radius-sm)] px-3 py-1.5 text-[11.5px] font-medium text-[var(--pc-text-muted)] transition-[background-color,color] duration-150 hover:bg-[var(--pc-tint-hover)] hover:text-[var(--pc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function SettingsSectionHeader({
  index,
  title,
  detail,
  actions,
}: {
  index: string;
  title: string;
  detail: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-mono text-[11px] font-semibold text-[var(--pc-accent)]">
            {index.padStart(2, "0")}
          </span>
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--pc-text-secondary)]">
            {title}
          </h2>
        </div>
        <p className="mt-0.5 pc-helper-text">{detail}</p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export function PreviewMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "healthy" | "warning";
}) {
  const toneClass =
    tone === "healthy"
      ? "text-[var(--pc-healthy)]"
      : tone === "warning"
        ? "text-[var(--pc-warning)]"
        : "text-[var(--pc-text)]";

  return (
    <div className="rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-3 py-2.5">
      <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
        {label}
      </div>
      <div
        className={`mt-1 text-[20px] font-semibold tabular-nums ${toneClass}`}
      >
        {value}
      </div>
    </div>
  );
}

export function SettingsReadinessBanner({
  graphConfigured,
  appAccessRequired,
  adminSignedIn,
  sccmDetectionEnabled,
  hasTagMappings,
}: {
  graphConfigured: boolean;
  appAccessRequired: boolean;
  adminSignedIn: boolean;
  sccmDetectionEnabled: boolean;
  hasTagMappings: boolean;
}) {
  const blockers = [
    !graphConfigured ? "Graph credentials missing" : null,
    !hasTagMappings ? "No tag mappings" : null,
    !adminSignedIn ? "Admin sign-in needed for changes/actions" : null,
  ].filter(Boolean);
  const ready = graphConfigured && hasTagMappings;

  const items = [
    {
      label: "Live data",
      value: graphConfigured ? "Ready" : "Mock mode",
      good: graphConfigured,
      detail: graphConfigured
        ? "Graph credentials detected"
        : "Add Graph credentials",
    },
    {
      label: "Technician access",
      value: appAccessRequired ? "Entra gate on" : "Gate off",
      good: appAccessRequired,
      detail: appAccessRequired
        ? "Sign-in required"
        : "Enable after setup",
    },
    {
      label: "Admin session",
      value: adminSignedIn ? "Signed in" : "Not signed in",
      good: adminSignedIn,
      detail: adminSignedIn
        ? "Privileged controls available"
        : "Required for changes",
    },
    {
      label: "SCCM signal",
      value: sccmDetectionEnabled ? "On" : "Off",
      good: sccmDetectionEnabled,
      detail: sccmDetectionEnabled
        ? "ConfigMgr signal visible"
        : "Optional signal disabled",
    },
    {
      label: "Tag mappings",
      value: hasTagMappings ? "Configured" : "Missing",
      good: hasTagMappings,
      detail: hasTagMappings
        ? "Drift detection enabled"
        : "Needed for tag flags",
    },
  ];

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-3 border-b border-[var(--pc-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={
              ready
                ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pc-healthy-muted)]"
                : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pc-warning-muted)]"
            }
          >
            {ready ? (
              <DatabaseZap className="h-4 w-4 text-[var(--pc-healthy)]" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-[var(--pc-warning)]" />
            )}
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[var(--pc-text)]">
              {ready
                ? "Live testing readiness looks good"
                : "Setup still has readiness gaps"}
            </div>
            <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-[var(--pc-text-muted)]">
              {ready
                ? "Graph ingestion and tag interpretation are configured."
                : blockers.join(", ")}
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-px bg-[var(--pc-border)] md:grid-cols-5">
        {items.map((item) => (
          <div
            key={item.label}
            className="bg-[var(--pc-surface)] px-3 py-2.5 transition-colors duration-150 hover:bg-[var(--pc-surface-raised)]"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
                {item.label}
              </div>
              {item.good ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-[var(--pc-healthy)]" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-[var(--pc-warning)]" />
              )}
            </div>
            <div className="mt-1 text-[13px] font-semibold text-[var(--pc-text)]">
              {item.value}
            </div>
            <div className="mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-[var(--pc-text-muted)]">
              {item.detail}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function SourceCard({
  source,
  items,
}: {
  source: "autopilot" | "intune" | "entra" | "sccm";
  items: string[];
}) {
  return (
    <div className="pc-interactive-lift rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-4 hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-surface-overlay)]">
      <div className="flex items-center justify-between">
        <SourceBadge source={source} />
        <Boxes className="h-3.5 w-3.5 text-[var(--pc-text-muted)]" />
      </div>
      <ul className="mt-3 space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-center gap-1.5 text-[11.5px] text-[var(--pc-text-secondary)]"
          >
            <CheckCircle2 className="h-3 w-3 text-[var(--pc-healthy)]" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
