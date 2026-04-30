import { AlertTriangle, Clock, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { useTimestampFormatter } from "../../hooks/useTimestampFormatter.js";
import { cn } from "../../lib/utils.js";

interface SyncIndicatorProps {
  lastSync: string | null;
  /** Pass true to show a spinning progress indicator. */
  inProgress?: boolean;
  /** Surface the most recent error inline if present. */
  lastError?: string | null;
}

export function SyncIndicator({ lastSync, inProgress, lastError }: SyncIndicatorProps) {
  const formatTimestamp = useTimestampFormatter();
  const staleHours = 6;
  const isStale =
    lastSync !== null &&
    Date.now() - new Date(lastSync).getTime() > staleHours * 60 * 60 * 1000;

  return (
    <Link
      to="/sync"
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors hover:bg-[var(--pc-tint-subtle)]",
        lastError
          ? "border-[var(--pc-critical)]/30 bg-[var(--pc-critical-muted)] text-[var(--pc-critical)]"
          : inProgress
            ? "border-[var(--pc-accent)]/30 bg-[var(--pc-accent-muted)] text-[var(--pc-accent)]"
            : isStale
              ? "border-[var(--pc-warning)]/30 bg-[var(--pc-warning-muted)] text-[var(--pc-warning)]"
              : "border-[var(--pc-border)] bg-[var(--pc-surface-raised)] text-[var(--pc-text-secondary)]"
      )}
      title={
        lastError
          ? `Sync error: ${lastError}`
          : inProgress
            ? "Sync in progress…"
            : lastSync
              ? `Last sync: ${new Date(lastSync).toLocaleString()}`
              : "No sync has been completed yet"
      }
    >
      {lastError ? (
        <AlertTriangle className="h-3 w-3 shrink-0" />
      ) : inProgress ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
      ) : (
        <Clock className="h-3 w-3 shrink-0" />
      )}
      {inProgress
        ? "Syncing…"
        : lastError
          ? "Sync error"
          : lastSync
            ? `Synced ${formatTimestamp(lastSync)}`
            : "Never synced"}
      {isStale && !inProgress && !lastError && (
        <span className="rounded bg-[var(--pc-warning-muted)] px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--pc-warning)]">
          stale
        </span>
      )}
    </Link>
  );
}
