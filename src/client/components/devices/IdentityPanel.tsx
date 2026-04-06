import { Fingerprint } from "lucide-react";

import type { DeviceDetailResponse } from "../../lib/types.js";
import { DataField } from "../shared/DataField.js";
import { StatusBadge } from "../shared/StatusBadge.js";
import { Card } from "../ui/card.js";

export function IdentityPanel({ device }: { device: DeviceDetailResponse }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-[var(--pc-accent)]" />
          <span className="text-[13px] font-semibold text-white">Identity Correlation</span>
        </div>
        <StatusBadge health={device.summary.health} />
      </div>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <DataField label="Autopilot ID" value={device.identity.autopilotId} />
        <DataField label="Intune ID" value={device.identity.intuneId} />
        <DataField label="Entra ID" value={device.identity.entraId} />
        <DataField label="Trust Type" value={device.identity.trustType} />
        <DataField label="Match Confidence" value={device.identity.matchConfidence} />
        <DataField label="Matched On" value={device.identity.matchedOn} />
      </div>
    </Card>
  );
}
