import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";

import type { HealthTrendPoint } from "../../lib/types.js";
import { Card } from "../ui/card.js";

interface HealthTrendChartProps {
  data: HealthTrendPoint[];
}

const SEGMENTS: Array<{
  key: keyof Omit<HealthTrendPoint, "date">;
  label: string;
  color: string;
}> = [
  { key: "critical", label: "Critical", color: "var(--pc-critical)" },
  { key: "warning", label: "Warning", color: "var(--pc-warning)" },
  { key: "info", label: "Info", color: "var(--pc-info)" },
  { key: "healthy", label: "Healthy", color: "var(--pc-healthy)" }
];

/**
 * 14-day stacked health distribution. Each column is one UTC day; bars are
 * stacked from critical at the top down to healthy at the bottom so spikes
 * stand out. Hovering a column reveals the per-segment counts in the legend.
 */
export function HealthTrendChart({ data }: HealthTrendChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const maxTotal = useMemo(() => {
    let max = 0;
    for (const point of data) {
      const total = point.critical + point.warning + point.info + point.healthy;
      if (total > max) max = total;
    }
    return Math.max(max, 1);
  }, [data]);

  const focused = hoverIndex !== null ? data[hoverIndex] : data[data.length - 1];
  const focusedTotal = focused
    ? focused.critical + focused.warning + focused.info + focused.healthy
    : 0;

  const hasAnyData = data.some(
    (p) => p.critical + p.warning + p.info + p.healthy > 0
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between border-b border-[var(--pc-border)] px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-[var(--pc-accent)]" />
            <div className="text-[13px] font-semibold text-[var(--pc-text)]">Health Trend</div>
          </div>
          <div className="mt-0.5 text-[12px] text-[var(--pc-text-muted)]">
            Last 14 days · daily snapshot from drift history
          </div>
        </div>
        {focused && (
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--pc-text-muted)]">
              {hoverIndex === null ? "Today" : formatDateShort(focused.date)}
            </div>
            <div className="mt-0.5 text-[18px] font-semibold tabular-nums text-[var(--pc-text)]">
              {focusedTotal}
            </div>
          </div>
        )}
      </div>

      {hasAnyData ? (
        <div className="px-5 pb-5 pt-4">
          <div
            className="flex h-[120px] items-end gap-1"
            onMouseLeave={() => setHoverIndex(null)}
          >
            {data.map((point, index) => {
              const total = point.critical + point.warning + point.info + point.healthy;
              const heightPct = total === 0 ? 0 : (total / maxTotal) * 100;
              const isHover = hoverIndex === index;
              return (
                <button
                  key={point.date}
                  type="button"
                  onMouseEnter={() => setHoverIndex(index)}
                  onFocus={() => setHoverIndex(index)}
                  className="group relative flex h-full flex-1 flex-col justify-end"
                  aria-label={`${point.date}: ${total} devices`}
                >
                  <div
                    className="pc-sparkline-bar relative w-full overflow-hidden rounded-t-sm"
                    style={{
                      height: `${heightPct}%`,
                      minHeight: total > 0 ? "2px" : 0,
                      opacity: isHover || hoverIndex === null ? 1 : 0.55
                    }}
                  >
                    {SEGMENTS.map((seg) => {
                      const value = point[seg.key];
                      if (value === 0) return null;
                      const segPct = (value / total) * 100;
                      return (
                        <div
                          key={seg.key}
                          style={{
                            height: `${segPct}%`,
                            background: seg.color
                          }}
                        />
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between text-[10.5px] text-[var(--pc-text-muted)]">
            <span>{formatDateShort(data[0]?.date ?? "")}</span>
            <span>{formatDateShort(data[data.length - 1]?.date ?? "")}</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px]">
            {SEGMENTS.map((seg) => {
              const value = focused?.[seg.key] ?? 0;
              return (
                <div key={seg.key} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ background: seg.color }}
                    aria-hidden
                  />
                  <span className="text-[var(--pc-text-secondary)]">{seg.label}</span>
                  <span className="font-medium tabular-nums text-[var(--pc-text)]">{value}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="px-5 py-10 text-center text-[12px] text-[var(--pc-text-muted)]">
          No history yet — run a few syncs over the next couple of days and
          Runway will start charting drift here.
        </div>
      )}
    </Card>
  );
}

function formatDateShort(iso: string): string {
  if (!iso) return "";
  const [, month, day] = iso.split("-");
  if (!month || !day) return iso;
  const m = Number(month);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1] ?? month} ${Number(day)}`;
}
