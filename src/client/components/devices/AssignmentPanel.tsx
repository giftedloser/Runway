import { ClipboardList } from "lucide-react";

import type { DeviceDetailResponse } from "../../lib/types.js";
import { Card } from "../ui/card.js";
import { SourceBadge } from "../shared/SourceBadge.js";

function Field({
  label,
  value,
  source
}: {
  label: string;
  value: string | null | undefined;
  source: "autopilot" | "intune";
}) {
  return (
    <div className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
          {label}
        </span>
        <SourceBadge source={source} size="xs" />
      </div>
      <div
        className="text-[12.5px] leading-snug text-[var(--pc-text)] break-words"
        title={value ?? undefined}
      >
        {value ?? <span className="text-[var(--pc-text-muted)]">—</span>}
      </div>
    </div>
  );
}

export function AssignmentPanel({ device }: { device: DeviceDetailResponse }) {
  const userMismatch =
    device.summary.autopilotAssignedUserUpn &&
    device.summary.intunePrimaryUserUpn &&
    device.summary.autopilotAssignedUserUpn.toLowerCase() !==
      device.summary.intunePrimaryUserUpn.toLowerCase();

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-[var(--pc-accent)]" />
        <span className="text-[13px] font-semibold text-white">Provisioning Configuration</span>
        <span className="text-[11.5px] text-[var(--pc-text-muted)]">· What this device is meant to be</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field
          label="Assigned Profile"
          value={device.summary.assignedProfileName}
          source="intune"
        />
        <Field label="Deployment Mode" value={device.summary.deploymentMode} source="intune" />
        <Field
          label="Autopilot User"
          value={device.summary.autopilotAssignedUserUpn}
          source="autopilot"
        />
        <Field
          label="Intune Primary User"
          value={device.summary.intunePrimaryUserUpn}
          source="intune"
        />
      </div>

      {userMismatch ? (
        <div className="mt-3 rounded-lg border border-[var(--pc-warning)]/30 bg-[var(--pc-warning-muted)] px-3.5 py-2 text-[12px] leading-relaxed text-amber-100">
          <span className="font-semibold">User mismatch:</span> the Autopilot assigned user does not
          match the Intune primary user. Often a sign of a re-used or retired device.
        </div>
      ) : null}
    </Card>
  );
}
