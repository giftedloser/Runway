import type { FlagCode, HealthLevel } from "../../lib/types.js";
import { FLAG_INFO, describeFlag, humanizeFlag } from "../../lib/flags.js";
import { cn } from "../../lib/utils.js";
import { Badge } from "../ui/badge.js";
import { Tooltip } from "./Tooltip.js";

const SEVERITY_STYLES: Record<Exclude<HealthLevel, "healthy" | "unknown">, string> = {
  critical: "bg-[var(--pc-critical-muted)] text-red-200 ring-1 ring-[var(--pc-critical)]/30",
  warning: "bg-[var(--pc-warning-muted)] text-amber-200 ring-1 ring-[var(--pc-warning)]/30",
  info: "bg-[var(--pc-info-muted)] text-sky-200 ring-1 ring-[var(--pc-info)]/30"
};

const NEUTRAL = "bg-white/[0.06] text-[var(--pc-text-secondary)] ring-1 ring-white/10";

export function FlagChip({ flag }: { flag: FlagCode }) {
  const info = FLAG_INFO[flag];
  const label = humanizeFlag(flag);
  const description = describeFlag(flag);
  const className = info ? SEVERITY_STYLES[info.severity] : NEUTRAL;

  const chip = <Badge className={cn(className)}>{label}</Badge>;

  if (!description) return chip;

  return (
    <Tooltip
      content={
        <div className="space-y-1">
          <div className="font-semibold text-white">{label}</div>
          <div>{description}</div>
        </div>
      }
    >
      {chip}
    </Tooltip>
  );
}
