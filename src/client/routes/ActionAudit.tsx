import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Download,
  Eraser,
  History,
  Loader2,
  LogOut,
  Power,
  RefreshCw,
  RotateCcw,
  Shield,
  Trash2,
  Type,
  Upload,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

import { PageHeader } from "../components/layout/PageHeader.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { Button } from "../components/ui/button.js";
import { Card } from "../components/ui/card.js";
import { useActionLogs } from "../hooks/useActions.js";
import { useAuthStatus, useLogin } from "../hooks/useAuth.js";
import { useTimestampFormatter } from "../hooks/useTimestampFormatter.js";
import type { ActionLogEntry } from "../lib/types.js";
import { cn } from "../lib/utils.js";

const ACTION_ICONS: Record<string, typeof RefreshCw> = {
  sync: RefreshCw,
  reboot: Power,
  rename: Type,
  "rotate-laps": RotateCcw,
  "autopilot-reset": Shield,
  retire: LogOut,
  wipe: Eraser,
  "delete-intune": Trash2,
  "delete-autopilot": Trash2,
  "autopilot-import": Upload,
};

const ACTION_LABELS: Record<string, string> = {
  sync: "Sync",
  reboot: "Reboot",
  rename: "Rename",
  "rotate-laps": "Rotate LAPS",
  "autopilot-reset": "Autopilot Reset",
  retire: "Retire",
  wipe: "Factory Wipe",
  "delete-intune": "Delete from Intune",
  "delete-autopilot": "Delete from Autopilot",
  "autopilot-import": "Autopilot Import",
};

type StatusFilter = "all" | "success" | "failed";

export function ActionAuditPage() {
  const auth = useAuthStatus();
  const login = useLogin();
  const logs = useActionLogs(200);
  const formatTimestamp = useTimestampFormatter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");

  const isAuthed = auth.data?.authenticated === true;

  const allActionTypes = useMemo(() => {
    const set = new Set<string>();
    for (const entry of logs.data ?? []) set.add(entry.actionType);
    return Array.from(set).sort();
  }, [logs.data]);

  const filtered = useMemo(() => {
    const items = logs.data ?? [];
    return items.filter((entry) => {
      if (actionFilter !== "all" && entry.actionType !== actionFilter)
        return false;
      const ok = isSuccess(entry);
      if (statusFilter === "success" && !ok) return false;
      if (statusFilter === "failed" && ok) return false;
      return true;
    });
  }, [logs.data, statusFilter, actionFilter]);

  const stats = useMemo(() => {
    const items = logs.data ?? [];
    const success = items.filter(isSuccess).length;
    return {
      total: items.length,
      success,
      failed: items.length - success,
    };
  }, [logs.data]);

  if (!isAuthed) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="System"
          title="Action Audit"
          description="Cross-device timeline of every remote action dispatched from Runway."
        />
        <Card className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pc-warning)]" />
            <div>
              <div className="text-[13px] font-medium text-[var(--pc-text)]">
                Admin sign-in required
              </div>
              <div className="mt-0.5 text-[11.5px] text-[var(--pc-text-muted)]">
                The audit log includes triggered-by identity, so an
                authenticated admin session is required to view it.
              </div>
            </div>
          </div>
          <Button
            onClick={() => login.mutate()}
            disabled={login.isPending || !login.canStart}
            title={login.blockedReason ?? undefined}
          >
            {!login.canStart
              ? "Unavailable"
              : login.isPending
                ? "Opening…"
                : "Sign in"}
          </Button>
        </Card>
      </div>
    );
  }

  if (logs.isLoading) return <LoadingState label="Loading action audit log…" />;
  if (logs.isError) {
    return (
      <ErrorState
        title="Could not load audit log"
        error={logs.error}
        onRetry={() => logs.refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="System"
        title="Action Audit"
        description="Review remote action results and operator identity."
        actions={
          <a
            href="/api/actions/logs/export?format=csv"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface)] px-2.5 py-1 text-[11px] text-[var(--pc-text)] transition-colors hover:bg-[var(--pc-tint-hover)]"
          >
            <Download className="h-3 w-3" />
            Export CSV
          </a>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="px-4 py-3.5">
          <div className="text-[11px] font-medium text-[var(--pc-text-muted)]">
            Recent actions
          </div>
          <div className="mt-1 text-[24px] font-semibold tabular-nums text-[var(--pc-text)]">
            {stats.total}
          </div>
        </Card>
        <Card className="px-4 py-3.5">
          <div className="text-[11px] font-medium text-[var(--pc-text-muted)]">
            Success
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-[24px] font-semibold tabular-nums text-[var(--pc-healthy)]">
              {stats.success}
            </span>
            <span className="text-[11px] text-[var(--pc-text-muted)]">
              {stats.total > 0
                ? `${Math.round((stats.success / stats.total) * 100)}%`
                : ""}
            </span>
          </div>
        </Card>
        <Card className="px-4 py-3.5">
          <div className="text-[11px] font-medium text-[var(--pc-text-muted)]">
            Failed
          </div>
          <div className="mt-1 text-[24px] font-semibold tabular-nums text-[var(--pc-critical)]">
            {stats.failed}
          </div>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          label="All"
          active={statusFilter === "all"}
          onClick={() => setStatusFilter("all")}
          count={stats.total}
        />
        <FilterChip
          label="Success"
          active={statusFilter === "success"}
          onClick={() => setStatusFilter("success")}
          count={stats.success}
          tone="healthy"
        />
        <FilterChip
          label="Failed"
          active={statusFilter === "failed"}
          onClick={() => setStatusFilter("failed")}
          count={stats.failed}
          tone="critical"
        />
        <span className="mx-2 h-4 w-px bg-[var(--pc-border)]" />
        <select
          value={actionFilter}
          onChange={(event) => setActionFilter(event.target.value)}
          aria-label="Filter by action type"
          className="rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2.5 py-1 text-[11.5px] text-[var(--pc-text)] transition-colors focus:border-[var(--pc-accent)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
        >
          <option value="all">All action types</option>
          {allActionTypes.map((action) => (
            <option key={action} value={action}>
              {ACTION_LABELS[action] ?? action}
            </option>
          ))}
        </select>
        {logs.isFetching && (
          <Loader2 className="ml-auto h-3 w-3 animate-spin text-[var(--pc-text-muted)]" />
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[var(--pc-border)] px-5 py-4">
          <History className="h-3.5 w-3.5 text-[var(--pc-accent)]" />
          <div>
            <div className="text-[13px] font-semibold text-[var(--pc-text)]">
              Timeline
            </div>
            <div className="text-[11px] text-[var(--pc-text-muted)]">
              Showing {filtered.length} of {stats.total}.
            </div>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-[12.5px] text-[var(--pc-text-muted)]">
            No actions match the current filters.
          </div>
        ) : (
          <ol className="divide-y divide-[var(--pc-border)]">
            {filtered.map((entry) => {
              const Icon = ACTION_ICONS[entry.actionType] ?? RefreshCw;
              const ok = isSuccess(entry);
              const triggered = new Date(entry.triggeredAt);
              return (
                <li
                  key={entry.id}
                  className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--pc-tint-subtle)]"
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                      ok
                        ? "bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)]"
                        : "bg-[var(--pc-critical-muted)] text-[var(--pc-critical)]",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="text-[13px] font-semibold text-[var(--pc-text)]">
                        {ACTION_LABELS[entry.actionType] ?? entry.actionType}
                      </span>
                      {entry.deviceName || entry.deviceSerial ? (
                        entry.intuneId ? (
                          <Link
                            to="/devices/$deviceKey"
                            params={{ deviceKey: deviceKeyFor(entry) }}
                            className="rounded font-mono text-[11.5px] text-[var(--pc-accent)] hover:text-[var(--pc-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
                          >
                            {entry.deviceName ?? entry.deviceSerial}
                          </Link>
                        ) : (
                          <span className="font-mono text-[11.5px] text-[var(--pc-text-secondary)]">
                            {entry.deviceName ?? entry.deviceSerial}
                          </span>
                        )
                      ) : (
                        <span className="text-[11px] text-[var(--pc-text-muted)]">
                          (unknown device)
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[var(--pc-text-muted)]">
                      <span title={triggered.toLocaleString()}>
                        {formatTimestamp(triggered)}
                      </span>
                      <span>·</span>
                      <span>by {entry.triggeredBy}</span>
                      {entry.bulkRunId && (
                        <>
                          <span>·</span>
                          <span className="font-mono" title={entry.bulkRunId}>
                            Bulk {entry.bulkRunId.slice(0, 8)}
                          </span>
                        </>
                      )}
                      {entry.graphResponseStatus !== null && (
                        <>
                          <span>·</span>
                          <span className="font-mono">
                            HTTP {entry.graphResponseStatus}
                          </span>
                        </>
                      )}
                    </div>
                    {entry.notes && (
                      <div
                        className={cn(
                          "mt-1.5 line-clamp-2 text-[11.5px]",
                          ok
                            ? "text-[var(--pc-text-secondary)]"
                            : "text-[var(--pc-critical)]",
                        )}
                      >
                        {entry.notes}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {ok ? (
                      <CheckCircle className="h-4 w-4 text-[var(--pc-healthy)]" />
                    ) : (
                      <XCircle className="h-4 w-4 text-[var(--pc-critical)]" />
                    )}
                  </div>
                  {entry.intuneId && (
                    <Link
                      to="/devices/$deviceKey"
                      params={{ deviceKey: deviceKeyFor(entry) }}
                      className="shrink-0 rounded p-1 text-[var(--pc-text-muted)] hover:bg-[var(--pc-tint-hover)] hover:text-[var(--pc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
                      aria-label="Open device"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}

function isSuccess(entry: ActionLogEntry): boolean {
  return entry.graphResponseStatus !== null && entry.graphResponseStatus < 300;
}

/**
 * The audit log only stores intuneId/serial, not deviceKey. We use serial as
 * the device key when possible (which is how the device router resolves it
 * in most install profiles); fall back to the intuneId. Worst case the link
 * 404s and the user is bounced back to the queue.
 */
function deviceKeyFor(entry: ActionLogEntry): string {
  return entry.deviceSerial ?? entry.intuneId ?? "";
}

function FilterChip({
  label,
  active,
  onClick,
  count,
  tone,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
  tone?: "healthy" | "critical";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]",
        active
          ? tone === "healthy"
            ? "border-[var(--pc-healthy)]/50 bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)]"
            : tone === "critical"
              ? "border-[var(--pc-critical)]/50 bg-[var(--pc-critical-muted)] text-[var(--pc-critical)]"
              : "border-[var(--pc-accent)]/60 bg-[var(--pc-accent-muted)] text-[var(--pc-text)]"
          : "border-[var(--pc-border)] bg-[var(--pc-surface-raised)] text-[var(--pc-text-secondary)] hover:border-[var(--pc-accent)]/40 hover:text-[var(--pc-text)]",
      )}
    >
      {label}
      <span className="rounded bg-[var(--pc-tint-hover)] px-1.5 py-0.5 text-[10px] tabular-nums">
        {count}
      </span>
    </button>
  );
}
