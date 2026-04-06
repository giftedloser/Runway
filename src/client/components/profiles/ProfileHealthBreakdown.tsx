import type { HealthLevel, ProfileAuditSummary } from "../../lib/types.js";
import { Card } from "../ui/card.js";

const dotColors: Record<string, string> = {
  critical: "bg-[var(--pc-critical)]",
  warning: "bg-[var(--pc-warning)]",
  info: "bg-[var(--pc-info)]",
  healthy: "bg-[var(--pc-healthy)]",
  unknown: "bg-[var(--pc-text-muted)]"
};

export function ProfileHealthBreakdown({ profile }: { profile: ProfileAuditSummary }) {
  const entries = Object.entries(profile.counts) as [HealthLevel, number][];

  return (
    <Card className="p-5">
      <div className="mb-3 text-[12px] font-medium text-[var(--pc-text-muted)]">
        Health Breakdown
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded-lg bg-white/[0.03] px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${dotColors[key] ?? "bg-slate-500"}`} />
              <span className="text-[11px] capitalize text-[var(--pc-text-muted)]">{key}</span>
            </div>
            <div className="mt-1 text-[20px] font-semibold tabular-nums text-white">{value}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
