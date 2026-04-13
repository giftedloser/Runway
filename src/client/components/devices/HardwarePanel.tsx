import { Monitor } from "lucide-react";

import type { DeviceDetailResponse } from "../../lib/types.js";
import { Card } from "../ui/card.js";

const dash = "\u2014";

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3">
      <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
        {label}
      </div>
      <div className="text-[12.5px] text-[var(--pc-text)]">{value ?? dash}</div>
    </div>
  );
}

export function HardwarePanel({ device }: { device: DeviceDetailResponse }) {
  const { hardware, enrollment } = device;
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Monitor className="h-4 w-4 text-[var(--pc-accent)]" />
        <span className="text-[13px] font-semibold text-white">Hardware &amp; Enrollment</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Model" value={hardware.model} />
        <Field label="Manufacturer" value={hardware.manufacturer} />
        <Field label="OS Version" value={hardware.osVersion} />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Enrollment Type" value={hardware.enrollmentType} />
        <Field label="Ownership" value={hardware.ownershipType} />
        <Field label="Enrollment Profile" value={enrollment.enrollmentProfileName} />
      </div>
    </Card>
  );
}
