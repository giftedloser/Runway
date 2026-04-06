import { Monitor } from "lucide-react";

import type { ProfileAuditSummary } from "../../lib/types.js";
import { Card } from "../ui/card.js";

export function ProfileCard({ profile }: { profile: ProfileAuditSummary }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--pc-accent-muted)]">
            <Monitor className="h-4 w-4 text-[var(--pc-accent)]" />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-white">{profile.profileName}</div>
            <div className="mt-0.5 text-[12px] text-[var(--pc-text-muted)]">
              Mode: {profile.deploymentMode ?? "Unknown"}
            </div>
          </div>
        </div>
        <div className="rounded-md bg-white/[0.05] px-2 py-1 text-[11px] font-medium tabular-nums text-[var(--pc-text-secondary)]">
          {profile.assignedDevices} devices
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
          <div className="text-[11px] text-[var(--pc-text-muted)]">Target Groups</div>
          <div className="mt-1 text-[18px] font-semibold tabular-nums text-white">
            {profile.targetingGroups.length}
          </div>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
          <div className="text-[11px] text-[var(--pc-text-muted)]">Missing Assignment</div>
          <div className="mt-1 text-[18px] font-semibold tabular-nums text-white">
            {profile.missingAssignmentCount}
          </div>
        </div>
        <div className="rounded-lg bg-white/[0.03] px-3 py-2.5">
          <div className="text-[11px] text-[var(--pc-text-muted)]">Tag Mismatch</div>
          <div className="mt-1 text-[18px] font-semibold tabular-nums text-white">
            {profile.tagMismatchCount}
          </div>
        </div>
      </div>
    </Card>
  );
}
