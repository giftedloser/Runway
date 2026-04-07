import { useNavigate, useSearch } from "@tanstack/react-router";

import { DeviceFilters } from "../components/devices/DeviceFilters.js";
import { DeviceTable } from "../components/devices/DeviceTable.js";
import { PageHeader } from "../components/layout/PageHeader.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { Pagination } from "../components/shared/Pagination.js";
import { useDevices } from "../hooks/useDevices.js";

export function DeviceListPage() {
  const search = useSearch({ from: "/devices" });
  const navigate = useNavigate({ from: "/devices" });
  const devices = useDevices(search);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Triage"
        title="Device Queue"
        description="Investigate join, enrollment, and assignment problems across the estate. Filter by health, flag, or property to narrow your triage list."
      />
      <DeviceFilters />

      {devices.isLoading ? (
        <LoadingState label="Loading devices…" />
      ) : devices.isError ? (
        <ErrorState
          title="Could not load devices"
          error={devices.error}
          onRetry={() => devices.refetch()}
        />
      ) : devices.data ? (
        <>
          <DeviceTable devices={devices.data.items} />
          <Pagination
            page={devices.data.page}
            pageSize={devices.data.pageSize}
            total={devices.data.total}
            onPageChange={(page) =>
              navigate({ search: (previous) => ({ ...previous, page }) })
            }
            onPageSizeChange={(pageSize) =>
              navigate({ search: (previous) => ({ ...previous, page: 1, pageSize }) })
            }
          />
        </>
      ) : null}
    </div>
  );
}
