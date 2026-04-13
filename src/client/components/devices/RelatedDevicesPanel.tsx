import { Laptop } from "lucide-react";
import { Link } from "@tanstack/react-router";

import type { DeviceDetailResponse } from "../../lib/types.js";
import { useRelatedDevices } from "../../hooks/useDevices.js";
import { Card } from "../ui/card.js";
import { StatusBadge } from "../shared/StatusBadge.js";

export function RelatedDevicesPanel({ device }: { device: DeviceDetailResponse }) {
  const userUpn = device.summary.intunePrimaryUserUpn ?? device.summary.autopilotAssignedUserUpn;
  const related = useRelatedDevices(device.summary.deviceKey);

  if (!userUpn) return null;

  const devices = related.data ?? [];
  if (related.isLoading) return null;
  if (devices.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Laptop className="h-4 w-4 text-[var(--pc-accent)]" />
        <span className="text-[13px] font-semibold text-white">Related Devices</span>
        <span className="text-[11px] text-[var(--pc-text-muted)]">
          · same user: {userUpn}
        </span>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] text-[var(--pc-text-muted)]">
          {devices.length}
        </span>
      </div>

      <div className="space-y-1.5">
        {devices.map((d) => (
          <Link
            key={d.deviceKey}
            to="/devices/$deviceKey"
            params={{ deviceKey: d.deviceKey }}
            className="flex items-center justify-between rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-3.5 py-2.5 transition-colors hover:border-[var(--pc-accent)]/40"
          >
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-medium text-[var(--pc-text)]">
                {d.deviceName ?? d.serialNumber ?? d.deviceKey}
              </div>
              {d.serialNumber && d.deviceName && (
                <div className="mt-0.5 font-mono text-[10.5px] text-[var(--pc-text-muted)]">
                  {d.serialNumber}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {d.flagCount > 0 && (
                <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-[var(--pc-text-muted)]">
                  {d.flagCount} {d.flagCount === 1 ? "flag" : "flags"}
                </span>
              )}
              <StatusBadge health={d.health as "healthy" | "warning" | "critical" | "info" | "unknown"} />
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
