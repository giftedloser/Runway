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

export function HealthSummary({ counts }: { counts: DashboardResponse["counts"] }) {
  const visibleStates = counts.unknown > 0 ? [...order, "unknown" as HealthLevel] : order;
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <Card className="p-5">
      <div className="mb-4 text-[13px] font-semibold text-white">Health Distribution</div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="mb-5 flex h-2 overflow-hidden rounded-full bg-white/[0.04]">
          {visibleStates.map((health) => {
            const pct = (counts[health] / total) * 100;
            if (pct === 0) return null;
            return (
              <div
                key={health}
                className={`${config[health].color} transition-all`}
                style={{ width: `${pct}%` }}
              />
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {visibleStates.map((health) => (
          <div key={health} className="rounded-lg bg-white/[0.03] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${config[health].color}`} />
              <span className="text-[12px] font-medium capitalize text-[var(--pc-text-secondary)]">
                {health}
              </span>
            </div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-white">
              {counts[health]}
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--pc-text-muted)]">
              {config[health].label}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
