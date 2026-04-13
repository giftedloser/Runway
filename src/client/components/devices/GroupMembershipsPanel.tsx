import { Users } from "lucide-react";
import { Link } from "@tanstack/react-router";

import type { DeviceDetailResponse } from "../../lib/types.js";
import { Card } from "../ui/card.js";

export function GroupMembershipsPanel({ device }: { device: DeviceDetailResponse }) {
  const { groupMemberships } = device;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-4 w-4 text-[var(--pc-accent)]" />
        <span className="text-[13px] font-semibold text-white">Group Memberships</span>
        {groupMemberships.length > 0 && (
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] text-[var(--pc-text-muted)]">
            {groupMemberships.length}
          </span>
        )}
      </div>

      {groupMemberships.length === 0 ? (
        <div className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-4 py-3 text-[12px] text-[var(--pc-text-muted)]">
          No group memberships found for this device.
        </div>
      ) : (
        <div className="space-y-1.5">
          {groupMemberships.map((g) => (
            <Link
              key={g.groupId}
              to="/groups/$groupId"
              params={{ groupId: g.groupId }}
              className="flex items-center justify-between rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-3.5 py-2.5 transition-colors hover:border-[var(--pc-accent)]/40 hover:bg-[var(--pc-surface-raised)]/80"
            >
              <span className="truncate text-[12.5px] text-[var(--pc-text)]">{g.groupName}</span>
              <span className="shrink-0 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium capitalize text-[var(--pc-text-muted)]">
                {g.membershipType}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
