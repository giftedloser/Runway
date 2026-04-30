import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, SearchX, Inbox } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { useTimestampFormatter } from "../../hooks/useTimestampFormatter.js";
import type { DeviceListItem } from "../../lib/types.js";
import { cn } from "../../lib/utils.js";
import { Card } from "../ui/card.js";
import {
  DEFAULT_VISIBLE_COLUMNS,
  resolveVisibleColumns,
  type DeviceColumnId
} from "./DeviceTableColumns.js";

export type DeviceTableDensity = "comfortable" | "compact";

interface DeviceTableProps {
  devices: DeviceListItem[];
  density?: DeviceTableDensity;
  visibleColumnIds?: DeviceColumnId[];
  selectedKeys?: Set<string>;
  onToggleSelected?: (deviceKey: string) => void;
  onToggleAll?: (deviceKeys: string[], allSelected: boolean) => void;
  /** True when any filter/search is active — changes the empty-state message. */
  hasActiveFilters?: boolean;
  /** Called when the user clicks "Clear filters" in the empty state. */
  onClearFilters?: () => void;
}

export function DeviceTable({
  devices,
  density = "comfortable",
  visibleColumnIds = DEFAULT_VISIBLE_COLUMNS,
  selectedKeys,
  onToggleSelected,
  onToggleAll,
  hasActiveFilters = false,
  onClearFilters
}: DeviceTableProps) {
  const navigate = useNavigate();
  const formatTimestamp = useTimestampFormatter();
  const tableRef = useRef<HTMLTableElement>(null);
  const cellY = density === "compact" ? "py-1.5" : "py-3";
  const cellX = "px-4";
  const cell = cn(cellX, cellY);
  const selectionEnabled = Boolean(selectedKeys && onToggleSelected);
  const columns = useMemo(() => resolveVisibleColumns(visibleColumnIds), [visibleColumnIds]);

  // j/k row navigation, Enter to open. We rely on tabIndex={0} on each row
  // and let the browser track the focused element so it survives re-renders.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Don't hijack typing in inputs/textareas/contenteditables.
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const table = tableRef.current;
      if (!table) return;
      const rows = Array.from(
        table.querySelectorAll<HTMLTableRowElement>("tbody tr[data-row-index]")
      );
      if (rows.length === 0) return;

      const activeIndex = rows.findIndex((row) => row === document.activeElement);

      if (event.key === "j" || event.key === "ArrowDown") {
        if (event.key === "ArrowDown" && activeIndex === -1) return;
        event.preventDefault();
        const next = activeIndex < 0 ? 0 : Math.min(activeIndex + 1, rows.length - 1);
        rows[next]?.focus();
      } else if (event.key === "k" || event.key === "ArrowUp") {
        if (event.key === "ArrowUp" && activeIndex === -1) return;
        event.preventDefault();
        const prev = activeIndex < 0 ? 0 : Math.max(activeIndex - 1, 0);
        rows[prev]?.focus();
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        const deviceKey = rows[activeIndex]?.dataset.deviceKey;
        if (deviceKey) {
          void navigate({ to: "/devices/$deviceKey", params: { deviceKey } });
        }
      } else if (event.key === " " && activeIndex >= 0 && selectionEnabled) {
        event.preventDefault();
        const deviceKey = rows[activeIndex]?.dataset.deviceKey;
        if (deviceKey) onToggleSelected?.(deviceKey);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, onToggleSelected, selectionEnabled]);

  if (devices.length === 0) {
    return (
      <Card className="flex flex-col items-center px-5 py-14 text-center">
        {hasActiveFilters ? (
          <>
            <SearchX className="mb-3 h-8 w-8 text-[var(--pc-text-muted)]/60" />
            <p className="text-[14px] font-medium text-[var(--pc-text-secondary)]">
              No devices match the current filters
            </p>
            <p className="mt-1 max-w-sm text-[12px] text-[var(--pc-text-muted)]">
              Try broadening your search or removing a filter to see more results.
            </p>
            {onClearFilters && (
              <button
                type="button"
                onClick={onClearFilters}
                className="mt-4 rounded-md border border-[var(--pc-border)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--pc-text-secondary)] transition-colors hover:border-[var(--pc-accent)]/50 hover:text-[var(--pc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
              >
                Clear all filters
              </button>
            )}
          </>
        ) : (
          <>
            <Inbox className="mb-3 h-8 w-8 text-[var(--pc-text-muted)]/60" />
            <p className="text-[14px] font-medium text-[var(--pc-text-secondary)]">
              No devices yet
            </p>
            <p className="mt-1 max-w-sm text-[12px] text-[var(--pc-text-muted)]">
              Devices will appear here after the first sync pulls data from Microsoft Graph.
            </p>
          </>
        )}
      </Card>
    );
  }

  const allSelectedOnPage =
    selectionEnabled &&
    devices.length > 0 &&
    devices.every((device) => selectedKeys!.has(device.deviceKey));

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table ref={tableRef} className="min-w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--pc-border)] text-[11px] font-medium text-[var(--pc-text-muted)]">
              {selectionEnabled && (
                <th scope="col" className="w-8 px-3 py-3 text-left">
                  <input
                    type="checkbox"
                    aria-label="Select all on page"
                    checked={allSelectedOnPage}
                    onChange={() =>
                      onToggleAll?.(
                        devices.map((d) => d.deviceKey),
                        allSelectedOnPage
                      )
                    }
                    className="h-3.5 w-3.5 cursor-pointer accent-[var(--pc-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th key={col.id} scope="col" className="px-4 py-3 text-left">
                  {col.label}
                </th>
              ))}
              <th scope="col" className="w-8 px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--pc-border)]">
            {devices.map((device, index) => {
              const isSelected = selectionEnabled && selectedKeys!.has(device.deviceKey);
              const openDevice = () => {
                void navigate({
                  to: "/devices/$deviceKey",
                  params: { deviceKey: device.deviceKey }
                });
              };
              return (
                <tr
                  key={device.deviceKey}
                  data-row-index={index}
                  data-device-key={device.deviceKey}
                  tabIndex={0}
                  onClick={(event) => {
                    const target = event.target as HTMLElement | null;
                    if (
                      target?.closest("a,button,input,label,select,textarea,[data-row-action]")
                    ) {
                      return;
                    }
                    openDevice();
                  }}
                  className={cn(
                    "pc-content-visibility cursor-pointer outline-none transition-colors hover:bg-[var(--pc-tint-subtle)]",
                    "focus-visible:bg-[var(--pc-accent-muted)]/40 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[var(--pc-accent)]/50",
                    isSelected && "bg-[var(--pc-accent-muted)]/30"
                  )}
                >
                  {selectionEnabled && (
                    <td className={cn("px-3", cellY)}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${device.deviceName ?? device.deviceKey}`}
                        checked={isSelected}
                        onChange={() => onToggleSelected?.(device.deviceKey)}
                        onClick={(event) => event.stopPropagation()}
                        className="h-3.5 w-3.5 cursor-pointer accent-[var(--pc-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.id} className={cn(cell, col.cellClassName)}>
                      {col.render(device, density, formatTimestamp)}
                    </td>
                  ))}
                  <td className={cn("px-2", cellY)}>
                    <Link
                      to="/devices/$deviceKey"
                      params={{ deviceKey: device.deviceKey }}
                      className="inline-flex rounded p-1 text-[var(--pc-text-muted)] transition-colors hover:bg-[var(--pc-tint-hover)] hover:text-[var(--pc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
                      aria-label={`Open ${device.deviceName ?? device.deviceKey}`}
                      data-row-action
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
