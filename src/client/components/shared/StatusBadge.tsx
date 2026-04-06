import type { HealthLevel } from "../../lib/types.js";
import { Badge } from "../ui/badge.js";

const toneMap: Record<HealthLevel, string> = {
  critical: "bg-[var(--pc-critical-muted)] text-[var(--pc-critical)]",
  warning: "bg-[var(--pc-warning-muted)] text-[var(--pc-warning)]",
  info: "bg-[var(--pc-info-muted)] text-[var(--pc-info)]",
  healthy: "bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)]",
  unknown: "bg-white/[0.06] text-[var(--pc-text-muted)]"
};

const dotMap: Record<HealthLevel, string> = {
  critical: "bg-[var(--pc-critical)]",
  warning: "bg-[var(--pc-warning)]",
  info: "bg-[var(--pc-info)]",
  healthy: "bg-[var(--pc-healthy)]",
  unknown: "bg-[var(--pc-text-muted)]"
};

export function StatusBadge({ health }: { health: HealthLevel }) {
  return (
    <Badge className={`gap-1.5 ${toneMap[health]}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotMap[health]}`} />
      {health}
    </Badge>
  );
}
