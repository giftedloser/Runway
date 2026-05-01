import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock3, DatabaseZap, RefreshCcw, XCircle } from "lucide-react";

import { useSyncStatus, useTriggerSync } from "../../hooks/useSync.js";
import { useTimestampFormatter } from "../../hooks/useTimestampFormatter.js";
import { Button } from "../ui/button.js";

function minutesAgo(iso: string | null) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return 0;
  return Math.max(0, Math.round(diff / 60000));
}

export function SyncStatusPill() {
  const status = useSyncStatus();
  const trigger = useTriggerSync();
  const formatTimestamp = useTimestampFormatter();
  const [open, setOpen] = useState(false);
  const minuteAge = minutesAgo(status.data?.lastCompletedAt ?? null);

  const state = useMemo(() => {
    if (status.data?.inProgress) {
      return {
        label: "Syncing...",
        icon: <DatabaseZap className="h-3.5 w-3.5 animate-pulse text-[var(--pc-accent)]" />,
        className: "border-[var(--pc-accent)]/40 bg-[var(--pc-accent-muted)] text-[var(--pc-accent-hover)]"
      };
    }
    if (status.data?.lastError) {
      return {
        label: "Sync failed - click for details",
        icon: <XCircle className="h-3.5 w-3.5 text-[var(--pc-critical)]" />,
        className: "border-[var(--pc-critical)]/35 bg-[var(--pc-critical-muted)] text-[var(--pc-critical)]"
      };
    }
    if (minuteAge === null) {
      return {
        label: "Never synced",
        icon: <AlertTriangle className="h-3.5 w-3.5 text-[var(--pc-warning)]" />,
        className: "border-[var(--pc-warning)]/35 bg-[var(--pc-warning-muted)] text-[var(--pc-warning)]"
      };
    }
    return {
      label: `Synced ${minuteAge} min ago`,
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-[var(--pc-healthy)]" />,
      className: "border-[var(--pc-healthy)]/35 bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)]"
    };
  }, [minuteAge, status.data?.inProgress, status.data?.lastError]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-[11.5px] font-medium shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)] ${state.className}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {state.icon}
        {state.label}
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="Sync status details"
          className="absolute right-0 z-40 mt-2 w-[320px] rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface)] p-4 text-[12px] text-[var(--pc-text-secondary)] shadow-[var(--pc-shadow-card)]"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="font-semibold text-[var(--pc-text)]">Sync freshness</div>
            <Link
              to="/sync"
              className="text-[11px] font-medium text-[var(--pc-accent-hover)] hover:underline"
              onClick={() => setOpen(false)}
            >
              Details
            </Link>
          </div>
          <dl className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <dt>Last successful sync</dt>
              <dd className="text-right font-medium text-[var(--pc-text)]">
                {status.data?.lastCompletedAt ? formatTimestamp(status.data.lastCompletedAt) : "Never"}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt>Currently running</dt>
              <dd className="font-medium text-[var(--pc-text)]">{status.data?.inProgress ? "Yes" : "No"}</dd>
            </div>
            {status.data?.lastError ? (
              <div className="rounded-[var(--pc-radius-sm)] border border-[var(--pc-critical)]/25 bg-[var(--pc-critical-muted)] p-2 text-[11px] text-[var(--pc-critical)]">
                {status.data.lastError}
              </div>
            ) : null}
          </dl>
          <div className="mt-3 rounded-[var(--pc-radius-sm)] border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-2.5">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
              <Clock3 className="h-3 w-3" />
              Data Runway syncs
            </div>
            <p className="leading-relaxed">
              Autopilot records, Intune devices, Entra devices and groups, profiles, assignments, compliance, configuration, and app payload data.
            </p>
          </div>
          <div className="mt-3">
            {status.data?.canTriggerManualSync ? (
              <Button
                className="h-8 w-full text-[11.5px]"
                onClick={() => trigger.mutate()}
                disabled={trigger.isPending || status.data.inProgress}
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                {status.data.inProgress ? "Syncing..." : "Run sync"}
              </Button>
            ) : (
              <div className="rounded-[var(--pc-radius-sm)] border border-[var(--pc-warning)]/30 bg-[var(--pc-warning-muted)] px-3 py-2 text-[11.5px] text-[var(--pc-warning)]">
                Manual sync requires delegated admin sign-in.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
