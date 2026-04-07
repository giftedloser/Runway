import { useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import type { DashboardResponse } from "../../lib/types.js";
import { describeFlag, humanizeFlag } from "../../lib/flags.js";
import { StatusBadge } from "../shared/StatusBadge.js";
import { Card } from "../ui/card.js";

export function FailurePatterns({
  patterns
}: {
  patterns: DashboardResponse["failurePatterns"];
}) {
  const navigate = useNavigate();

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--pc-border)] px-5 py-4">
        <div className="text-[13px] font-semibold text-white">Failure Patterns</div>
        <div className="mt-0.5 text-[12px] text-[var(--pc-text-muted)]">
          Most common broken states &mdash; click to filter the device queue
        </div>
      </div>

      {patterns.length === 0 ? (
        <div className="px-5 py-8 text-[13px] text-[var(--pc-text-muted)]">
          No active failure patterns detected.
        </div>
      ) : (
        <div className="divide-y divide-[var(--pc-border)]">
          {patterns.map((pattern) => (
            <button
              key={pattern.flag}
              onClick={() =>
                navigate({
                  to: "/devices",
                  search: {
                    search: undefined,
                    health: undefined,
                    flag: pattern.flag,
                    property: undefined,
                    profile: undefined,
                    page: 1,
                    pageSize: 25
                  }
                })
              }
              className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-white">
                  {humanizeFlag(pattern.flag)}
                </div>
                <div className="mt-0.5 line-clamp-1 text-[11.5px] text-[var(--pc-text-muted)]">
                  {describeFlag(pattern.flag) ?? "Click to filter the queue"}
                </div>
              </div>
              <StatusBadge health={pattern.severity} />
              <div className="text-right">
                <div className="text-[15px] font-semibold tabular-nums text-white">
                  {pattern.count}
                </div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--pc-text-muted)]" />
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
