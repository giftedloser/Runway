import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Clock, Minus } from "lucide-react";
import { useMemo, useState } from "react";

import { useTimestampFormatter } from "../../hooks/useTimestampFormatter.js";
import type { RecentTransition, TransitionDirection } from "../../lib/types.js";
import { humanizeFlag } from "../../lib/flags.js";
import { cn } from "../../lib/utils.js";
import { Card } from "../ui/card.js";

type DirectionFilter = "all" | "regression" | "recovery";

const DIRECTION_META: Record<
  TransitionDirection,
  { icon: typeof ArrowUpRight; tone: string; label: string }
> = {
  regression: {
    icon: ArrowUpRight,
    tone: "text-[var(--pc-critical)] bg-[var(--pc-critical-muted)]",
    label: "Regressed"
  },
  recovery: {
    icon: ArrowDownRight,
    tone: "text-[var(--pc-healthy)] bg-[var(--pc-healthy-muted)]",
    label: "Recovered"
  },
  lateral: {
    icon: Minus,
    tone: "text-[var(--pc-text-muted)] bg-[var(--pc-tint-hover)]",
    label: "Changed"
  }
};

export function RecentChanges({ transitions }: { transitions: RecentTransition[] }) {
  const [filter, setFilter] = useState<DirectionFilter>("all");
  const formatTimestamp = useTimestampFormatter();

  const counts = useMemo(() => {
    let regression = 0;
    let recovery = 0;
    for (const t of transitions) {
      if (t.direction === "regression") regression += 1;
      else if (t.direction === "recovery") recovery += 1;
    }
    return { regression, recovery, total: transitions.length };
  }, [transitions]);

  const visible = transitions.filter((t) => {
    if (filter === "regression") return t.direction === "regression";
    if (filter === "recovery") return t.direction === "recovery";
    return true;
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--pc-border)] px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-[var(--pc-accent)]" />
          <div className="text-[13px] font-semibold text-[var(--pc-text)]">What changed in 24h</div>
          <div className="text-[11px] text-[var(--pc-text-muted)]">
            ({counts.total} {counts.total === 1 ? "device" : "devices"})
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 sm:ml-auto">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            All <Pill>{counts.total}</Pill>
          </FilterChip>
          <FilterChip
            active={filter === "regression"}
            onClick={() => setFilter("regression")}
            tone="critical"
          >
            Regressions <Pill>{counts.regression}</Pill>
          </FilterChip>
          <FilterChip
            active={filter === "recovery"}
            onClick={() => setFilter("recovery")}
            tone="healthy"
          >
            Recoveries <Pill>{counts.recovery}</Pill>
          </FilterChip>
        </div>
      </div>
      {visible.length === 0 ? (
        <div className="px-5 py-10 text-center text-[12.5px] text-[var(--pc-text-muted)]">
          {transitions.length === 0
            ? "No state transitions in the last 24 hours — quiet shift."
            : "No transitions match the current filter."}
        </div>
      ) : (
        <ol className="max-h-[420px] divide-y divide-[var(--pc-border)] overflow-y-auto">
          {visible.map((t) => {
            const meta = DIRECTION_META[t.direction];
            const Icon = meta.icon;
            const computed = new Date(t.computedAt);
            const flagPreview =
              t.direction === "recovery"
                ? t.removedFlags.slice(0, 2).map(humanizeFlag).join(" • ")
                : t.addedFlags.slice(0, 2).map(humanizeFlag).join(" • ");
            const extraFlagCount =
              t.direction === "recovery"
                ? Math.max(0, t.removedFlags.length - 2)
                : Math.max(0, t.addedFlags.length - 2);
            return (
              <li key={t.deviceKey}>
                <Link
                  to="/devices/$deviceKey"
                  params={{ deviceKey: t.deviceKey }}
                  className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-[var(--pc-tint-subtle)]"
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                      meta.tone
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="truncate text-[13px] font-semibold text-[var(--pc-text)]">
                        {t.deviceName ?? t.serialNumber ?? t.deviceKey}
                      </span>
                      <span className="text-[10.5px] uppercase tracking-wide text-[var(--pc-text-muted)]">
                        {t.fromHealth ?? "new"}
                      </span>
                      <ArrowRight className="h-3 w-3 text-[var(--pc-text-muted)]" />
                      <span
                        className={cn(
                          "text-[10.5px] font-semibold uppercase tracking-wide",
                          t.toHealth === "critical"
                            ? "text-[var(--pc-critical)]"
                            : t.toHealth === "warning"
                              ? "text-[var(--pc-warning)]"
                              : t.toHealth === "info"
                                ? "text-[var(--pc-info)]"
                                : t.toHealth === "healthy"
                                  ? "text-[var(--pc-healthy)]"
                                  : "text-[var(--pc-text-muted)]"
                        )}
                      >
                        {t.toHealth}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--pc-text-muted)]">
                      <span title={computed.toLocaleString()}>
                        {formatTimestamp(t.computedAt)}
                      </span>
                      {t.propertyLabel ? (
                        <>
                          <span>·</span>
                          <span>{t.propertyLabel}</span>
                        </>
                      ) : null}
                    </div>
                    {flagPreview ? (
                      <div className="mt-1 text-[11px] text-[var(--pc-text-secondary)]">
                        <span className="text-[var(--pc-text-muted)]">
                          {t.direction === "recovery" ? "cleared:" : "now:"}
                        </span>{" "}
                        {flagPreview}
                        {extraFlagCount > 0 ? (
                          <span className="text-[var(--pc-text-muted)]"> +{extraFlagCount} more</span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-[var(--pc-tint-hover)] px-1.5 py-0.5 text-[10px] tabular-nums">{children}</span>
  );
}

function FilterChip({
  active,
  onClick,
  tone,
  children
}: {
  active: boolean;
  onClick: () => void;
  tone?: "critical" | "healthy";
  children: React.ReactNode;
}) {
  const activeStyle =
    tone === "critical"
      ? "border-[var(--pc-critical)]/50 bg-[var(--pc-critical-muted)] text-[var(--pc-critical)]"
      : tone === "healthy"
        ? "border-[var(--pc-healthy)]/50 bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)]"
        : "border-[var(--pc-accent)]/60 bg-[var(--pc-accent-muted)] text-[var(--pc-text)]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]",
        active
          ? activeStyle
          : "border-[var(--pc-border)] bg-[var(--pc-surface-raised)] text-[var(--pc-text-secondary)] hover:border-[var(--pc-accent)]/40 hover:text-[var(--pc-text)]"
      )}
    >
      {children}
    </button>
  );
}
