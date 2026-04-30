import { format } from "date-fns";
import { ArrowRight, Clock, Minus, Plus } from "lucide-react";

import { useDeviceHistory } from "../../hooks/useDevices.js";
import { useTimestampFormatter } from "../../hooks/useTimestampFormatter.js";
import { humanizeFlag } from "../../lib/flags.js";
import type { DeviceDetailResponse, HealthLevel } from "../../lib/types.js";
import { cn } from "../../lib/utils.js";
import { Card } from "../ui/card.js";

const HEALTH_DOT: Record<HealthLevel, string> = {
  critical: "bg-[var(--pc-critical)]",
  warning: "bg-[var(--pc-warning)]",
  info: "bg-[var(--pc-info)]",
  healthy: "bg-[var(--pc-healthy)]",
  unknown: "bg-[var(--pc-tint-hover)]"
};

const HEALTH_LABEL: Record<HealthLevel, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
  healthy: "Healthy",
  unknown: "Unknown"
};

export function HistoryPanel({ device }: { device: DeviceDetailResponse }) {
  const history = useDeviceHistory(device.summary.deviceKey);
  const formatTimestamp = useTimestampFormatter();

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-[var(--pc-accent)]" />
          <span className="text-[13px] font-semibold text-[var(--pc-text)]">State Timeline</span>
        </div>
        <span className="text-[11px] text-[var(--pc-text-muted)]">
          Only state transitions are recorded
        </span>
      </div>

      {history.isLoading ? (
        <div className="text-[12px] text-[var(--pc-text-muted)]">Loading…</div>
      ) : history.isError ? (
        <div className="text-[12px] text-[var(--pc-critical)]">Could not load history.</div>
      ) : !history.data || history.data.entries.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-4 py-3 text-[12px] text-[var(--pc-text-muted)]">
          No state transitions recorded for this device yet.
        </div>
      ) : (
        <ol className="relative space-y-4 border-l border-[var(--pc-border)] pl-5">
          {history.data.entries.map((entry, index) => {
            const isFirst = index === 0;
            const healthChanged = entry.previousHealth && entry.previousHealth !== entry.health;
            return (
              <li key={`${entry.computedAt}-${index}`} className="relative">
                <span
                  className={cn(
                    "absolute -left-[26px] top-1 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-[var(--pc-surface)]",
                    HEALTH_DOT[entry.health]
                  )}
                />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-[12.5px] font-medium text-[var(--pc-text)]">
                    {isFirst ? "Current state" : "State changed"}
                    {healthChanged ? (
                      <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-normal text-[var(--pc-text-secondary)]">
                        {HEALTH_LABEL[entry.previousHealth!]}
                        <ArrowRight className="h-3 w-3" />
                        {HEALTH_LABEL[entry.health]}
                      </span>
                    ) : (
                      <span className="ml-2 text-[11px] font-normal text-[var(--pc-text-muted)]">
                        {HEALTH_LABEL[entry.health]}
                      </span>
                    )}
                  </div>
                  <div
                    className="text-[11px] text-[var(--pc-text-muted)]"
                    title={format(new Date(entry.computedAt), "PPpp")}
                  >
                    {formatTimestamp(entry.computedAt)}
                  </div>
                </div>

                {(entry.addedFlags.length > 0 || entry.removedFlags.length > 0) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {entry.addedFlags.map((flag) => (
                      <span
                        key={`+${flag}`}
                        className="inline-flex items-center gap-1 rounded-md bg-[var(--pc-critical-muted)] px-1.5 py-0.5 text-[10.5px] text-[var(--pc-critical)] ring-1 ring-[var(--pc-critical)]/30"
                        title={`Started flagging: ${humanizeFlag(flag)}`}
                      >
                        <Plus className="h-2.5 w-2.5" />
                        {humanizeFlag(flag)}
                      </span>
                    ))}
                    {entry.removedFlags.map((flag) => (
                      <span
                        key={`-${flag}`}
                        className="inline-flex items-center gap-1 rounded-md bg-[var(--pc-healthy-muted)] px-1.5 py-0.5 text-[10.5px] text-[var(--pc-healthy)] ring-1 ring-[var(--pc-healthy)]/30"
                        title={`Cleared: ${humanizeFlag(flag)}`}
                      >
                        <Minus className="h-2.5 w-2.5" />
                        {humanizeFlag(flag)}
                      </span>
                    ))}
                  </div>
                )}

                {isFirst && entry.flags.length > 0 && entry.addedFlags.length === 0 && (
                  <div className="mt-1.5 text-[11px] text-[var(--pc-text-muted)]">
                    {entry.flags.length} active flag{entry.flags.length === 1 ? "" : "s"}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
