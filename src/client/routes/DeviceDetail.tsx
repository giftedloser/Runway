import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { AssignmentPanel } from "../components/devices/AssignmentPanel.js";
import { AssignmentPathPanel } from "../components/devices/AssignmentPathPanel.js";
import { DiagnosticPanel } from "../components/devices/DiagnosticPanel.js";
import { IdentityPanel } from "../components/devices/IdentityPanel.js";
import { PageHeader } from "../components/layout/PageHeader.js";
import { useDevice } from "../hooks/useDevices.js";

export function DeviceDetailPage() {
  const { deviceKey } = useParams({ from: "/devices/$deviceKey" });
  const device = useDevice(deviceKey);

  if (device.isLoading || !device.data) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-[var(--pc-text-muted)]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--pc-accent)] border-t-transparent" />
        Loading device&hellip;
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        to="/devices"
        search={{ search: undefined, health: undefined, flag: undefined, property: undefined, profile: undefined, page: 1, pageSize: 25 }}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--pc-text-muted)] transition-colors hover:text-[var(--pc-text)]"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to Devices
      </Link>

      <PageHeader
        eyebrow="Device Detail"
        title={device.data.summary.deviceName ?? device.data.summary.serialNumber ?? deviceKey}
        description={`Serial ${device.data.summary.serialNumber ?? "unavailable"} \u00b7 Identity, assignment path, and diagnostic evidence.`}
      />

      <IdentityPanel device={device.data} />
      <AssignmentPathPanel path={device.data.assignmentPath} />
      <AssignmentPanel device={device.data} />
      <DiagnosticPanel device={device.data} />
    </div>
  );
}
