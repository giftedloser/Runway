import {
  AlertTriangle,
  Check,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  X
} from "lucide-react";
import { useEffect } from "react";

import type { DeviceListItem, HealthLevel } from "../../lib/types.js";
import { cn } from "../../lib/utils.js";
import { Button } from "../ui/button.js";

export type BulkActionType = "sync" | "reboot" | "retire" | "rotate-laps";

export interface BulkDeviceResult {
  deviceKey: string;
  success: boolean;
  status: number;
  message: string;
}

const HEALTH_TONE: Record<HealthLevel, string> = {
  unknown: "text-[var(--pc-text-muted)] bg-[var(--pc-tint-subtle)]",
  healthy: "text-[var(--pc-success)] bg-[color-mix(in_oklab,var(--pc-success)_18%,transparent)]",
  info: "text-[var(--pc-accent)] bg-[var(--pc-accent-muted)]",
  warning: "text-[var(--pc-warning)] bg-[color-mix(in_oklab,var(--pc-warning)_18%,transparent)]",
  critical: "text-[var(--pc-danger)] bg-[color-mix(in_oklab,var(--pc-danger)_18%,transparent)]"
};

const ACTION_META: Record<
  BulkActionType,
  {
    title: string;
    description: string;
    destructive: boolean;
    icon: typeof RefreshCw;
    verb: string;
    warning?: string;
  }
> = {
  sync: {
    title: "Sync selected devices?",
    description:
      "Each device will be asked to check in with Intune immediately. Safe to run during the day.",
    destructive: false,
    icon: RefreshCw,
    verb: "Sync"
  },
  reboot: {
    title: "Reboot selected devices?",
    description:
      "Each device will receive a remote reboot command via Intune. Users may lose unsaved work.",
    destructive: true,
    icon: RotateCcw,
    verb: "Reboot",
    warning:
      "Reboots are disruptive. Confirm the device list above matches your intended scope before continuing."
  },
  retire: {
    title: "Retire selected devices?",
    description:
      "Each device will be retired from Intune — company data is removed, personal data is preserved. The device unenrolls.",
    destructive: true,
    icon: Trash2,
    verb: "Retire",
    warning:
      "Retire is a one-way trip. These devices will unenroll from Intune and stop receiving policies."
  },
  "rotate-laps": {
    title: "Rotate LAPS passwords?",
    description:
      "Each device's local admin password will be rotated. Users keep working; the old password is invalidated.",
    destructive: false,
    icon: KeyRound,
    verb: "Rotate LAPS"
  }
};

type Phase = "confirming" | "running" | "completed";

interface BulkActionConfirmProps {
  action: BulkActionType;
  selectedKeys: Set<string>;
  visibleDevices: DeviceListItem[];
  phase: Phase;
  results: BulkDeviceResult[];
  onCancel: () => void;
  onConfirm: () => void;
}

export function BulkActionConfirm({
  action,
  selectedKeys,
  visibleDevices,
  phase,
  results,
  onCancel,
  onConfirm
}: BulkActionConfirmProps) {
  const busy = phase === "running";
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
  const deviceByKey = new Map(visibleDevices.map((d) => [d.deviceKey, d]));

  const healthBuckets = matched.reduce<Record<HealthLevel, number>>(
    (acc, device) => {
      acc[device.health] = (acc[device.health] ?? 0) + 1;
      return acc;
    },
    { unknown: 0, healthy: 0, info: 0, warning: 0, critical: 0 }
  );

  const meta = ACTION_META[action];
  const Icon = meta.icon;
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <button
        type="button"
        onClick={() => !busy && onCancel()}
        aria-label="Close"
        className="pc-overlay-enter absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={meta.title}
        className="pc-drawer-enter relative w-full max-w-[600px] overflow-hidden rounded-xl border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--pc-border)] px-5 py-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md",
                meta.destructive
                  ? "bg-[color-mix(in_oklab,var(--pc-warning)_20%,transparent)] text-[var(--pc-warning)]"
                  : "bg-[var(--pc-accent-muted)] text-[var(--pc-accent)]"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--pc-text)]">
                {phase === "completed"
                  ? `${meta.verb} — results`
                  : phase === "running"
                    ? `${meta.verb}ing ${selectedKeys.size} devices…`
                    : meta.title}
              </h2>
              <p className="mt-0.5 text-[12px] text-[var(--pc-text-secondary)]">
                {phase === "completed"
                  ? `${successCount} succeeded, ${failureCount} failed.`
                  : meta.description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label={phase === "completed" ? "Close" : "Cancel"}
            className="rounded p-1 text-[var(--pc-text-muted)] transition-colors hover:bg-[var(--pc-tint-hover)] hover:text-[var(--pc-text)] disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {phase === "confirming" && (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-wide text-[var(--pc-text-muted)]">
                  Targets
                </span>
                <span className="text-[20px] font-semibold tabular-nums text-[var(--pc-text)]">
                  {selectedKeys.size}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(["critical", "warning", "info", "healthy", "unknown"] as HealthLevel[]).map(
                  (level) => {
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
                  }
                )}
                {unknownCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--pc-tint-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--pc-text-muted)]">
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
                        <tr key={device.deviceKey} className="border-t border-[var(--pc-border)]/60">
                          <td className="px-3 py-1.5 font-medium text-[var(--pc-text)]">
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

              {meta.warning && (
                <div className="flex items-start gap-2 rounded-md border border-[var(--pc-warning)]/30 bg-[color-mix(in_oklab,var(--pc-warning)_8%,transparent)] px-3 py-2 text-[11px] text-[var(--pc-warning)]">
                  <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  <span>{meta.warning}</span>
                </div>
              )}
            </>
          )}

          {phase === "running" && (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-[12px] text-[var(--pc-text-muted)]">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--pc-accent)]" />
              <div>Dispatching {meta.verb.toLowerCase()} to {selectedKeys.size} devices…</div>
              <div className="text-[10.5px] text-[var(--pc-text-muted)]">
                Graph requests run sequentially. Please wait.
              </div>
            </div>
          )}

          {phase === "completed" && (
            <>
              <div className="flex gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--pc-healthy-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--pc-healthy)]">
                  <Check className="h-3 w-3" />
                  {successCount} succeeded
                </span>
                {failureCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--pc-critical-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--pc-critical)]">
                    <X className="h-3 w-3" />
                    {failureCount} failed
                  </span>
                )}
              </div>
              <div className="max-h-[280px] overflow-y-auto rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface)]">
                <table className="w-full text-[11px]">
                  <thead className="sticky top-0 bg-[var(--pc-surface-raised)] text-left text-[10px] uppercase tracking-wide text-[var(--pc-text-muted)]">
                    <tr>
                      <th className="px-3 py-1.5 font-medium w-6" />
                      <th className="px-3 py-1.5 font-medium">Device</th>
                      <th className="px-3 py-1.5 font-medium">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result) => {
                      const device = deviceByKey.get(result.deviceKey);
                      return (
                        <tr
                          key={result.deviceKey}
                          className={cn(
                            "border-t border-[var(--pc-border)]/60",
                            !result.success && "bg-[var(--pc-critical-muted)]/20"
                          )}
                        >
                          <td className="px-3 py-1.5 align-top">
                            {result.success ? (
                              <Check className="h-3 w-3 text-[var(--pc-healthy)]" />
                            ) : (
                              <X className="h-3 w-3 text-[var(--pc-critical)]" />
                            )}
                          </td>
                          <td className="px-3 py-1.5 align-top">
                            <div className="font-medium text-[var(--pc-text)]">
                              {device?.deviceName ?? result.deviceKey}
                            </div>
                            {device?.serialNumber && (
                              <div className="font-mono text-[10px] text-[var(--pc-text-muted)]">
                                {device.serialNumber}
                              </div>
                            )}
                          </td>
                          <td
                            className={cn(
                              "px-3 py-1.5 align-top",
                              result.success
                                ? "text-[var(--pc-text-secondary)]"
                                : "text-[var(--pc-critical)]"
                            )}
                            title={result.message}
                          >
                            {result.status} · {result.message}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--pc-border)] bg-[var(--pc-surface)] px-5 py-3">
          {phase === "completed" ? (
            <Button onClick={onCancel} className="h-7 px-3 text-[11px]">
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={onCancel}
                disabled={busy}
                className="h-7 px-3 text-[11px]"
              >
                Cancel
              </Button>
              <Button
                variant={meta.destructive ? "destructive" : "default"}
                onClick={onConfirm}
                disabled={busy}
                className="h-7 px-3 text-[11px]"
              >
                {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
                {`${meta.verb} ${selectedKeys.size}`}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
