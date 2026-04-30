import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  Download,
  Filter,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  Rows2,
  Rows3,
  X,
} from "lucide-react";
import { useState } from "react";

import {
  BulkActionConfirm,
  type BulkActionType,
  type BulkDeviceResult,
} from "../components/devices/BulkActionConfirm.js";
import { ColumnPicker } from "../components/devices/ColumnPicker.js";
import { DeviceFilters } from "../components/devices/DeviceFilters.js";
import {
  DeviceTable,
  type DeviceTableDensity,
} from "../components/devices/DeviceTable.js";
import {
  DEFAULT_VISIBLE_COLUMNS,
  type DeviceColumnId,
} from "../components/devices/DeviceTableColumns.js";
import { SavedViews } from "../components/devices/SavedViews.js";
import { PageHeader } from "../components/layout/PageHeader.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { Pagination } from "../components/shared/Pagination.js";
import { useToast } from "../components/shared/toast.js";
import { Button } from "../components/ui/button.js";
import { useDevices } from "../hooks/useDevices.js";
import { usePreference } from "../hooks/usePreference.js";
import { useSettings } from "../hooks/useSettings.js";
import { apiRequest } from "../lib/api.js";
import { devicesToCsv } from "../lib/csv.js";
import { cn } from "../lib/utils.js";

export function DeviceListPage() {
  const search = useSearch({ from: "/devices" });
  const navigate = useNavigate({ from: "/devices" });
  const settings = useSettings();
  const configuredPageSize =
    settings.data?.appSettings.find((setting) => setting.key === "display.tablePageSize")
      ?.value;
  const defaultPageSize =
    typeof configuredPageSize === "number" ? configuredPageSize : 50;
  const effectiveSearch = {
    ...search,
    pageSize: search.pageSize ?? defaultPageSize,
  };
  const devices = useDevices(effectiveSearch);
  const [density, setDensity] = usePreference<DeviceTableDensity>(
    "device-density",
    "comfortable",
  );
  const [visibleColumnIds, setVisibleColumnIds] = usePreference<
    DeviceColumnId[]
  >("device-columns", DEFAULT_VISIBLE_COLUMNS);

  const toast = useToast();
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<null | BulkActionType>(null);
  const [pendingBulk, setPendingBulk] = useState<null | BulkActionType>(null);
  const [bulkPhase, setBulkPhase] = useState<
    "confirming" | "running" | "completed"
  >("confirming");
  const [bulkResults, setBulkResults] = useState<BulkDeviceResult[]>([]);

  const toggleSelected = (deviceKey: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(deviceKey)) next.delete(deviceKey);
      else next.add(deviceKey);
      return next;
    });
  };
  const toggleAll = (keys: string[], allSelected: boolean) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const key of keys) next.delete(key);
      } else {
        for (const key of keys) next.add(key);
      }
      return next;
    });
  };
  const clearSelection = () => setSelectedKeys(new Set());

  const ACTION_LABELS: Record<BulkActionType, string> = {
    sync: "Sync",
    reboot: "Reboot",
    "rotate-laps": "Rotate LAPS",
  };

  const requestBulk = (action: BulkActionType) => {
    if (selectedKeys.size === 0) return;
    setPendingBulk(action);
    setBulkPhase("confirming");
    setBulkResults([]);
  };

  const closeBulk = () => {
    setPendingBulk(null);
    setBulkPhase("confirming");
    setBulkResults([]);
  };

  const runBulk = async (action: BulkActionType) => {
    if (selectedKeys.size === 0) return;
    setBulkBusy(action);
    setBulkPhase("running");
    const label = ACTION_LABELS[action];
    try {
      const result = await apiRequest<{
        action: string;
        total: number;
        successCount: number;
        failureCount: number;
        results: BulkDeviceResult[];
      }>("/api/actions/bulk", {
        method: "POST",
        body: JSON.stringify({
          action,
          deviceKeys: Array.from(selectedKeys),
        }),
      });
      setBulkResults(result.results);
      setBulkPhase("completed");
      if (result.failureCount === 0) {
        toast.push({
          variant: "success",
          title: `Bulk ${label.toLowerCase()} queued`,
          description: `${result.successCount} of ${result.total} devices accepted. Check Action Audit for the timeline.`,
        });
        clearSelection();
      } else {
        toast.push({
          variant: "warning",
          title: `Bulk ${label.toLowerCase()} partially completed`,
          description: `${result.successCount} succeeded, ${result.failureCount} failed. Check Action Audit for details.`,
          durationMs: 8000,
        });
      }
    } catch (error) {
      setBulkPhase("confirming");
      toast.push({
        variant: "error",
        title: `${label} failed`,
        description:
          error instanceof Error ? error.message : "Bulk action failed.",
      });
    } finally {
      setBulkBusy(null);
    }
  };

  const exportCsv = () => {
    if (!devices.data || devices.data.items.length === 0) return;
    const csv = devicesToCsv(devices.data.items);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `runway-devices-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.push({
      variant: "success",
      title: "CSV exported",
      description: `${devices.data.items.length} devices saved.`,
    });
  };

  const selectedOnPage =
    devices.data?.items.filter((device) => selectedKeys.has(device.deviceKey))
      .length ?? 0;
  const selectedOffPage = Math.max(0, selectedKeys.size - selectedOnPage);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Triage"
        title="Device Queue"
        description="Filter devices by health, flag, property, or profile."
      />
      <SavedViews />
      <DeviceFilters />

      <div className="flex flex-col gap-2.5 rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface)] px-3 py-2.5 text-[11px] text-[var(--pc-text-muted)] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            {Boolean(
              search.search ||
              search.health ||
              search.flag ||
              search.property ||
              search.profile,
            ) && <Filter className="h-3 w-3 text-[var(--pc-accent)]" />}
            {devices.data
              ? `${devices.data.total.toLocaleString()} device${devices.data.total === 1 ? "" : "s"}`
              : ""}
            {devices.data &&
              Boolean(
                search.search ||
                search.health ||
                search.flag ||
                search.property ||
                search.profile,
              ) && <span className="text-[var(--pc-accent)]">filtered</span>}
          </span>
        </div>
        <div className="flex w-full items-center gap-2 overflow-x-auto sm:w-auto sm:justify-end">
          <ColumnPicker
            value={visibleColumnIds}
            onChange={setVisibleColumnIds}
          />
          <button
            type="button"
            onClick={exportCsv}
            disabled={!devices.data || devices.data.items.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2 py-1 text-[11px] text-[var(--pc-text-secondary)] transition-[background-color,border-color,color,opacity] hover:bg-[var(--pc-tint-subtle)] hover:text-[var(--pc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            title="Export current page to CSV"
          >
            <Download className="h-3 w-3" />
            Export CSV
          </button>
          <div
            className="inline-flex items-center gap-0.5 rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-0.5"
            role="group"
            aria-label="Row density"
          >
            <DensityButton
              active={density === "comfortable"}
              onClick={() => setDensity("comfortable")}
              label="Comfortable"
            >
              <Rows2 className="h-3 w-3" />
            </DensityButton>
            <DensityButton
              active={density === "compact"}
              onClick={() => setDensity("compact")}
              label="Compact"
            >
              <Rows3 className="h-3 w-3" />
            </DensityButton>
          </div>
        </div>
      </div>

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
          <DeviceTable
            devices={devices.data.items}
            density={density}
            visibleColumnIds={visibleColumnIds}
            selectedKeys={selectedKeys}
            onToggleSelected={toggleSelected}
            onToggleAll={toggleAll}
            hasActiveFilters={Boolean(
              search.search ||
              search.health ||
              search.flag ||
              search.property ||
              search.profile,
            )}
            onClearFilters={() =>
              navigate({
                search: () => ({
                  search: undefined,
                  health: undefined,
                  flag: undefined,
                  property: undefined,
                  profile: undefined,
                  page: 1,
                  pageSize: search.pageSize ?? defaultPageSize,
                }),
              })
            }
          />
          <Pagination
            page={devices.data.page}
            pageSize={devices.data.pageSize}
            total={devices.data.total}
            onPageChange={(page) =>
              navigate({ search: (previous) => ({ ...previous, page }) })
            }
            onPageSizeChange={(pageSize) =>
              navigate({
                search: (previous) => ({ ...previous, page: 1, pageSize }),
              })
            }
          />
        </>
      ) : null}

      {pendingBulk && (
        <BulkActionConfirm
          action={pendingBulk}
          selectedKeys={selectedKeys}
          visibleDevices={devices.data?.items ?? []}
          phase={bulkPhase}
          results={bulkResults}
          onCancel={closeBulk}
          onConfirm={() => runBulk(pendingBulk)}
        />
      )}

      {/* Floating bulk action bar */}
      {selectedKeys.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-3 overflow-x-auto overscroll-contain rounded-full border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-4 py-2 shadow-2xl">
            <span className="text-[12px] font-medium text-[var(--pc-text)]">
              {selectedKeys.size} selected
            </span>
            {selectedOffPage > 0 ? (
              <span className="rounded-full bg-[var(--pc-tint-subtle)] px-2 py-0.5 text-[11px] text-[var(--pc-text-muted)]">
                {selectedOffPage} off-page
              </span>
            ) : null}
            <span className="h-4 w-px bg-[var(--pc-border)]" />
            <Button
              variant="secondary"
              onClick={() => requestBulk("sync")}
              disabled={bulkBusy !== null}
              title={bulkBusy !== null ? "Another bulk action is running" : "Sync selected devices"}
              className="h-7 px-2.5 text-[11px]"
            >
              {bulkBusy === "sync" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Bulk sync
            </Button>
            <Button
              variant="secondary"
              onClick={() => requestBulk("reboot")}
              disabled={bulkBusy !== null}
              title={bulkBusy !== null ? "Another bulk action is running" : "Reboot selected devices"}
              className="h-7 px-2.5 text-[11px]"
            >
              {bulkBusy === "reboot" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              Bulk reboot
            </Button>
            <Button
              variant="secondary"
              onClick={() => requestBulk("rotate-laps")}
              disabled={bulkBusy !== null}
              title={bulkBusy !== null ? "Another bulk action is running" : "Rotate LAPS passwords"}
              className="h-7 px-2.5 text-[11px]"
            >
              {bulkBusy === "rotate-laps" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <KeyRound className="h-3 w-3" />
              )}
              Rotate LAPS
            </Button>
            <button
              type="button"
              onClick={clearSelection}
              className="rounded p-1 text-[var(--pc-text-muted)] transition-colors hover:bg-[var(--pc-tint-hover)] hover:text-[var(--pc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
              aria-label="Clear selection"
              title="Clear selection"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DensityButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-6 w-7 items-center justify-center rounded transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]",
        active
          ? "bg-[var(--pc-accent-muted)] text-[var(--pc-accent)]"
          : "text-[var(--pc-text-muted)] hover:bg-[var(--pc-tint-subtle)] hover:text-[var(--pc-text)]",
      )}
    >
      {children}
    </button>
  );
}
