import type { ReactNode } from "react";

import { cn } from "../../lib/utils.js";

/**
 * Identifies which Microsoft service a piece of data was sourced from.
 * Used throughout the UI so engineers always know whether they are looking
 * at Autopilot, Intune, Entra ID, SCCM/ConfigMgr, or a
 * derived/correlated value.
 */
export type DataSource = "autopilot" | "intune" | "entra" | "sccm" | "graph" | "derived";

const SOURCE_META: Record<
  DataSource,
  { label: string; full: string; ring: string; bg: string; dot: string }
> = {
  autopilot: {
    label: "Autopilot",
    full: "Windows Autopilot deployment service",
    ring: "ring-sky-500/30",
    bg: "bg-sky-500/10 text-[var(--pc-info)]",
    dot: "bg-sky-400"
  },
  intune: {
    label: "Intune",
    full: "Microsoft Intune (managed device record)",
    ring: "ring-violet-500/30",
    bg: "bg-violet-500/15 text-violet-500",
    dot: "bg-violet-500"
  },
  entra: {
    label: "Entra ID",
    full: "Microsoft Entra ID (directory object)",
    ring: "ring-emerald-500/30",
    bg: "bg-emerald-500/10 text-[var(--pc-healthy)]",
    dot: "bg-emerald-400"
  },
  sccm: {
    label: "SCCM",
    full: "Configuration Manager client signal derived from Intune managementAgent",
    ring: "ring-orange-500/30",
    bg: "bg-orange-500/15 text-orange-600",
    dot: "bg-orange-500"
  },
  graph: {
    label: "Graph",
    full: "Microsoft Graph (live API call)",
    ring: "ring-amber-500/30",
    bg: "bg-amber-500/10 text-[var(--pc-warning)]",
    dot: "bg-amber-400"
  },
  derived: {
    label: "Derived",
    full: "Computed by the Runway state engine",
    ring: "ring-white/15",
    bg: "bg-[var(--pc-tint-hover)] text-[var(--pc-text-secondary)]",
    dot: "bg-[var(--pc-text-muted)]"
  }
};

export function SourceBadge({
  source,
  size = "sm",
  className
}: {
  source: DataSource;
  size?: "xs" | "sm";
  className?: string;
}) {
  const meta = SOURCE_META[source];
  return (
    <span
      title={meta.full}
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-medium ring-1",
        meta.bg,
        meta.ring,
        size === "xs" ? "px-1.5 py-0.5 text-[9.5px]" : "px-2 py-0.5 text-[10.5px]",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

/**
 * Section header with a coloured source badge so engineers can immediately
 * orient themselves to which Microsoft service the data below is from.
 */
export function SourceSectionHeader({
  source,
  title,
  description,
  icon,
  right
}: {
  source: DataSource;
  title: string;
  description?: string;
  icon?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--pc-tint-subtle)] text-[var(--pc-accent)]">
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-[var(--pc-text)]">{title}</span>
            <SourceBadge source={source} />
          </div>
          {description ? (
            <div className="mt-0.5 text-[11.5px] leading-snug text-[var(--pc-text-muted)]">
              {description}
            </div>
          ) : null}
        </div>
      </div>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}
