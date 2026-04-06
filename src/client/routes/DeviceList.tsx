import { useSearch } from "@tanstack/react-router";

import { DeviceFilters } from "../components/devices/DeviceFilters.js";
import { DeviceTable } from "../components/devices/DeviceTable.js";
import { PageHeader } from "../components/layout/PageHeader.js";
import { useDevices } from "../hooks/useDevices.js";

export function DeviceListPage() {
  const search = useSearch({ from: "/devices" });
  const devices = useDevices({
    ...search,
    health: search.health ?? "critical"
  });

  if (devices.isLoading || !devices.data) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-[var(--pc-text-muted)]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--pc-accent)] border-t-transparent" />
        Loading devices&hellip;
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Devices"
        title="Device Queue"
        description="Filter and investigate devices by health state, flags, and provisioning status."
      />
      <DeviceFilters />
      <DeviceTable devices={devices.data.items} />
    </div>
  );
}
