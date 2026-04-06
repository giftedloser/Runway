import { ClipboardList } from "lucide-react";

import type { DeviceDetailResponse } from "../../lib/types.js";
import { DataField } from "../shared/DataField.js";
import { Card } from "../ui/card.js";

export function AssignmentPanel({ device }: { device: DeviceDetailResponse }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-[var(--pc-accent)]" />
        <span className="text-[13px] font-semibold text-white">Assignment Summary</span>
      </div>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <DataField label="Profile" value={device.summary.assignedProfileName} />
        <DataField label="Mode" value={device.summary.deploymentMode} />
        <DataField label="Autopilot User" value={device.summary.autopilotAssignedUserUpn} />
        <DataField label="Primary User" value={device.summary.intunePrimaryUserUpn} />
      </div>
    </Card>
  );
}
