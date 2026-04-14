import { AlertTriangle, Loader2, RefreshCw, RotateCcw, X } from "lucide-react";
import { useEffect } from "react";

import type { DeviceListItem, HealthLevel } from "../../lib/types.js";
import { cn } from "../../lib/utils.js";
import { Button } from "../ui/button.js";

const HEALTH_TONE: Record<HealthLevel, string> = {
  unknown: "text-[var(--pc-text-muted)] bg-white/[0.04]",
  healthy: "text-[var(--pc-success)] bg-[color-mix(in_oklab,var(--pc-success)_18%,transparent)]",
  info: "text-[var(--pc-accent)] bg-[var(--pc-accent-muted)]",
  warning: "text-[var(--pc-warning)] bg-[color-mix(in_oklab,var(--pc-warning)_18%,transparent)]",
  critical: "text-[var(--pc-danger)] bg-[color-mix(in_oklab,var(--pc-danger)_18%,transparent)]"
};

interface BulkActionConfirmProps {
  action: "sync" | "reboot";
  selectedKeys: Set<string>;
  visibleDevices: DeviceListItem[];
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function BulkActionConfirm({
  action,
  selectedKeys,
  visibleDevices,
  busy,
  onCancel,
  onConfirm
}: BulkActionConfirmProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onCancel();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [busy, onCancel]);

  const matched = visibleDevices.filter((device) => selectedKeys.has(device.deviceKey));
  const unknownCount = selectedKeys.size - matched.length;

  const healthBuckets = matched.reduce<Record<HealthLevel, number>>(
    (acc, device) => {
      acc[device.health] = (acc[device.health] ?? 0) + 1;
      return acc;
    },
    { unknown: 0, healthy: 0, info: 0, warning: 0, critical: 0 }
  );

  const isReboot = action === "reboot";
  const Icon = isReboot ? RotateCcw : RefreshCw;
  const title = isReboot ? "Reboot selected devices?" : "Sync selected devices?";
  const description = isReboot
    ? "Each device will receive a remote reboot command via Intune. Users may lose unsaved work."
    : "Each device will be asked to check in with Intune immediately. Safe to run during the day.";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <button
        type="button"
        onClick={() => !busy && onCancel()}
        aria-label="Close"
        className="pc-overlay-enter absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div role="dialog" aria-modal="true" aria-label={title} className="pc-drawer-enter relative w-full max-w-[560px] overflow-hidden rounded-xl border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--pc-border)] px-5 py-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md",
                isReboot
                  ? "bg-[color-mix(in_oklab,var(--pc-warning)_20%,transparent)] text-[var(--pc-warning)]"
                  : "bg-[var(--pc-accent-muted)] text-[var(--pc-accent)]"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-white">{title}</h2>
              <p className="mt-0.5 text-[12px] text-[var(--pc-text-secondary)]">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Cancel"
            className="rounded p-1 text-[var(--pc-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] uppercase tracking-wide text-[var(--pc-text-muted)]">
              Targets
            </span>
            <span className="text-[20px] font-semibold tabular-nums text-white">
              {selectedKeys.size}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(["critical", "warning", "info", "healthy", "unknown"] as HealthLevel[]).map((level) => {
              const count = healthBuckets[level];
              if (!count) return null;
              return (
                <span
                  key={level}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    HEALTH_TONE[level]
                  )}
                >
                  {count} {level}
                </span>
              );
            })}
            {unknownCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-[var(--pc-text-muted)]">
                +{unknownCount} off-page
              </span>
            )}
          </div>

          {matched.length > 0 && (
            <div className="max-h-[220px] overflow-y-auto rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface)]">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-[var(--pc-surface-raised)] text-left text-[10px] uppercase tracking-wide text-[var(--pc-text-muted)]">
                  <tr>
                    <th className="px-3 py-1.5 font-medium">Device</th>
                    <th className="px-3 py-1.5 font-medium">Serial</th>
                    <th className="px-3 py-1.5 font-medium">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {matched.slice(0, 50).map((device) => (
                    <tr
                      key={device.deviceKey}
                      className="border-t border-[var(--pc-border)]/60"
                    >
                      <td className="px-3 py-1.5 font-medium text-white">
                        {device.deviceName ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-[var(--pc-text-muted)]">
                        {device.serialNumber ?? "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={cn(
                            "inline-flex rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
                            HEALTH_TONE[device.health]
                          )}
                        >
                          {device.health}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {matched.length > 50 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="border-t border-[var(--pc-border)]/60 px-3 py-2 text-center text-[10px] italic text-[var(--pc-text-muted)]"
                      >
                        +{matched.length - 50} more on this page…
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {isReboot && (
            <div className="flex items-start gap-2 rounded-md border border-[var(--pc-warning)]/30 bg-[color-mix(in_oklab,var(--pc-warning)_8%,transparent)] px-3 py-2 text-[11px] text-[var(--pc-warning)]">
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span>
                Reboots are disruptive. Confirm the device list above matches your
                intended scope before continuing.
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--pc-border)] bg-[var(--pc-surface)] px-5 py-3">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={busy}
            className="h-7 px-3 text-[11px]"
          >
            Cancel
          </Button>
          <Button
            variant={isReboot ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={busy}
            className="h-7 px-3 text-[11px]"
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Icon className="h-3 w-3" />
            )}
            {isReboot ? `Reboot ${selectedKeys.size}` : `Sync ${selectedKeys.size}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
