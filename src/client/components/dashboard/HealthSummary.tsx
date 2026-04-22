import { useNavigate } from "@tanstack/react-router";

import type { DashboardResponse, HealthLevel } from "../../lib/types.js";
import { Card } from "../ui/card.js";

const order: HealthLevel[] = ["critical", "warning", "info", "healthy"];

const config: Record<HealthLevel, { color: string; label: string }> = {
  critical: { color: "bg-[var(--pc-critical)]", label: "Blocking failures" },
  warning: { color: "bg-[var(--pc-warning)]", label: "Needs review" },
  info: { color: "bg-[var(--pc-info)]", label: "Drift detected" },
  healthy: { color: "bg-[var(--pc-healthy)]", label: "Stable" },
  unknown: { color: "bg-[var(--pc-text-muted)]", label: "No signal" }
};

const FILTERABLE: ReadonlySet<HealthLevel> = new Set(["critical", "warning", "info", "healthy"]);

export function HealthSummary({ counts }: { counts: DashboardResponse["counts"] }) {
  const navigate = useNavigate();
  const visibleStates = counts.unknown > 0 ? [...order, "unknown" as HealthLevel] : order;
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  const handleClick = (health: HealthLevel) => {
    if (!FILTERABLE.has(health)) return;
    navigate({
      to: "/devices",
      search: {
        search: undefined,
        health,
        flag: undefined,
        property: undefined,
        profile: undefined,
        page: 1,
        pageSize: 25
      }
    });
  };

  return (
    <Card className="p-5">
      <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="text-[13px] font-semibold text-[var(--pc-text)]">Health Distribution</div>
        <div className="text-[11px] text-[var(--pc-text-muted)]">Click a tile to filter the queue</div>
      </div>
      <div className="mb-4 text-[11.5px] text-[var(--pc-text-muted)]">
        Aggregated state across correlated Autopilot / Intune / Entra records and ConfigMgr signals
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-5 flex h-2 overflow-hidden rounded-full bg-[var(--pc-tint-subtle)]">
          {visibleStates.map((health) => {
            const pct = (counts[health] / total) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={health}
                className={`${config[health].color} transition-[width] duration-300`}
                style={{ width: `${pct}%` }}
              />
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
        {visibleStates.map((health) => {
          const clickable = FILTERABLE.has(health);
          return (
            <button
              key={health}
              type="button"
              onClick={() => handleClick(health)}
              disabled={!clickable}
              className={
                "rounded-lg bg-[var(--pc-tint-subtle)] px-4 py-3 text-left transition-[background-color,box-shadow,transform] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)] " +
                (clickable
                  ? "cursor-pointer ring-1 ring-transparent hover:bg-[var(--pc-tint-hover)] hover:ring-[var(--pc-border)] hover:-translate-y-0.5 hover:shadow-md"
                  : "cursor-default opacity-80")
              }
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${config[health].color}`} />
                <span className="text-[12px] font-medium capitalize text-[var(--pc-text-secondary)]">
                  {health}
                </span>
              </div>
              <div className="mt-2 text-2xl font-semibold tabular-nums text-[var(--pc-text)]">
                {counts[health]}
              </div>
              <div className="mt-0.5 text-[11px] text-[var(--pc-text-muted)]">
                {config[health].label}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
