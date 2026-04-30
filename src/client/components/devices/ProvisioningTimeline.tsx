import { Clock } from "lucide-react";

import { useTimestampFormatter } from "../../hooks/useTimestampFormatter.js";
import type { DeviceDetailResponse } from "../../lib/types.js";
import { Card } from "../ui/card.js";
import { cn } from "../../lib/utils.js";

interface Milestone {
  label: string;
  date: string | null;
}

export function ProvisioningTimeline({ device }: { device: DeviceDetailResponse }) {
  const formatTimestamp = useTimestampFormatter();
  const t = device.provisioningTimeline;

  const milestones: Milestone[] = [
    { label: "First Seen", date: t.firstSeenAt },
    { label: "Profile Assigned", date: t.firstProfileAssignedAt },
    { label: "Enrolled", date: t.enrollmentDate },
    { label: "Last Check-in", date: t.lastCheckinAt }
  ];

  const reachedCount = milestones.filter((m) => m.date).length;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Clock className="h-4 w-4 text-[var(--pc-accent)]" />
        <span className="text-[13px] font-semibold text-[var(--pc-text)]">Provisioning Timeline</span>
        <span className="text-[11px] text-[var(--pc-text-muted)]">
          · {reachedCount}/{milestones.length} milestones
        </span>
      </div>

      <div className="relative flex items-start justify-between gap-2">
        {/* Connecting line */}
        <div className="absolute left-0 right-0 top-[10px] h-0.5 bg-[var(--pc-border)]" />

        {milestones.map((m) => {
          const reached = Boolean(m.date);
          const formatted = m.date ? formatTimestamp(m.date) : null;
          return (
            <div key={m.label} className="relative z-10 flex flex-1 flex-col items-center text-center">
              <div
                className={cn(
                  "h-5 w-5 rounded-full border-2 transition-colors",
                  reached
                    ? "border-[var(--pc-accent)] bg-[var(--pc-accent)]"
                    : "border-[var(--pc-border)] bg-[var(--pc-surface)]"
                )}
              >
                {reached && (
                  <svg className="h-full w-full text-[var(--pc-text)]" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <div className="mt-2 text-[10.5px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
                {m.label}
              </div>
              <div
                className={cn(
                  "mt-0.5 text-[11px]",
                  reached ? "text-[var(--pc-text-secondary)]" : "text-[var(--pc-text-muted)]"
                )}
                title={m.date ?? undefined}
              >
                {formatted ?? "—"}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
