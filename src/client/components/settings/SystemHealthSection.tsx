import { Activity, AlertTriangle, CheckCircle2, Clock, Database, PlayCircle, RefreshCw } from "lucide-react";

import { useAuthStatus } from "../../hooks/useAuth.js";
import { useRunRetention, useSystemHealth } from "../../hooks/useSystemHealth.js";
import { Button } from "../ui/button.js";
import { Card } from "../ui/card.js";
import { useToast } from "../shared/toast.js";

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || parts.length === 0) parts.push(`${m}m`);
  return parts.join(" ");
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "unknown";
  if (ms < 60_000) return "just now";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/**
 * Surfaces the server's `/api/health` summary in Settings so admins can
 * see at a glance whether the DB is ready, when the last sync completed,
 * and how much history/action/sync data the retention sweep has pruned.
 * The manual "Run retention now" control requires admin sign-in because
 * it triggers the same DELETEs the scheduler runs on its cadence.
 */
export function SystemHealthSection() {
  const health = useSystemHealth();
  const runRetention = useRunRetention();
  const auth = useAuthStatus();
  const toast = useToast();

  const isAuthed = auth.data?.authenticated === true;
  const data = health.data;

  const onRunRetention = () => {
    runRetention.mutate(undefined, {
      onSuccess: (result) => {
        const total =
          result.deletedHistoryRows +
          result.deletedActionLogRows +
          result.deletedSyncLogRows;
        toast.push({
          variant: "success",
          title: "Retention sweep complete",
          description:
            total === 0
              ? "Nothing to prune — all tables are within their retention windows."
              : `Deleted ${total} expired rows (${result.deletedHistoryRows} history, ${result.deletedActionLogRows} actions, ${result.deletedSyncLogRows} sync).`
        });
      },
      onError: (error) => {
        toast.push({
          variant: "error",
          title: "Retention failed",
          description: error instanceof Error ? error.message : "Unknown error."
        });
      }
    });
  };

  return (
    <section id="health" className="scroll-mt-6 space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--pc-text-secondary)]">
          7. System Health & Retention
        </h2>
        <span className="text-[11px] text-[var(--pc-text-muted)]">
          Process status, sync freshness, and data pruning
        </span>
        <div className="ml-auto">
          <Button
            variant="secondary"
            className="h-8 px-2.5 text-[11.5px]"
            onClick={() => void health.refetch()}
            disabled={health.isFetching}
            title="Refresh health"
          >
            <RefreshCw
              className={
                health.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"
              }
            />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="p-5">
        {health.isLoading ? (
          <div className="text-[12px] text-[var(--pc-text-muted)]">Loading health…</div>
        ) : health.isError || !data ? (
          <div className="flex items-start gap-2 text-[12px] text-[var(--pc-critical)]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div>
              <div className="font-semibold">Could not read /api/health.</div>
              <div className="mt-0.5 text-[var(--pc-text-muted)]">
                {health.error instanceof Error
                  ? health.error.message
                  : "Check that the local runtime is running."}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatusTile
                icon={
                  data.dbReady ? (
                    <CheckCircle2 className="h-4 w-4 text-[var(--pc-healthy)]" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-[var(--pc-critical)]" />
                  )
                }
                label="Database"
                value={data.dbReady ? "Ready" : "Not ready"}
                note={data.dbReady ? "Migrations applied" : "Run migrations to continue"}
              />
              <StatusTile
                icon={<Activity className="h-4 w-4 text-[var(--pc-accent)]" />}
                label="Uptime"
                value={formatUptime(data.uptimeSeconds)}
                note="Since the server process started"
              />
              <StatusTile
                icon={<Clock className="h-4 w-4 text-[var(--pc-text-secondary)]" />}
                label="Last sync"
                value={formatRelative(data.lastSyncCompletedAt)}
                note={
                  data.syncBacklogMinutes != null
                    ? `Backlog: ${data.syncBacklogMinutes} min`
                    : "No sync has run yet"
                }
              />
            </div>

            <div className="mt-5 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Database className="h-4 w-4 text-[var(--pc-accent)]" />
                <div className="text-[13px] font-semibold text-[var(--pc-text)]">
                  Retention sweep
                </div>
                <span className="text-[11px] text-[var(--pc-text-muted)]">
                  {data.retention
                    ? `Last run ${formatRelative(data.retention.ranAt)}`
                    : "Not yet run this session"}
                </span>
                <div className="ml-auto">
                  <Button
                    onClick={onRunRetention}
                    disabled={!isAuthed || runRetention.isPending}
                    title={
                      isAuthed
                        ? "Prune expired rows from device_state_history, action_log, and sync_log"
                        : "Admin sign-in required to trigger a sweep"
                    }
                    className="h-8 px-2.5 text-[11.5px]"
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                    {runRetention.isPending ? "Running…" : "Run retention now"}
                  </Button>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <RetentionStat
                  label="History rows pruned"
                  value={data.retention?.deletedHistoryRows ?? null}
                />
                <RetentionStat
                  label="Action-log rows pruned"
                  value={data.retention?.deletedActionLogRows ?? null}
                />
                <RetentionStat
                  label="Sync-log rows pruned"
                  value={data.retention?.deletedSyncLogRows ?? null}
                />
              </div>

              {!isAuthed ? (
                <div className="mt-3 text-[11px] text-[var(--pc-text-muted)]">
                  Sign in as an admin to trigger an on-demand sweep. The scheduler
                  continues to run on its configured cadence regardless.
                </div>
              ) : null}
            </div>
          </>
        )}
      </Card>
    </section>
  );
}

function StatusTile({
  icon,
  label,
  value,
  note
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="pc-interactive-lift rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3 hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-surface-overlay)]">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
          {label}
        </span>
      </div>
      <div className="mt-1 text-[15px] font-semibold text-[var(--pc-text)]">{value}</div>
      <div className="mt-0.5 text-[11px] text-[var(--pc-text-muted)]">{note}</div>
    </div>
  );
}

function RetentionStat({ label, value }: { label: string; value: number | null }) {
  const display = value == null ? "—" : value.toLocaleString();
  return (
    <div className="rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface)] px-3 py-2">
      <div className="text-[11px] text-[var(--pc-text-muted)]">{label}</div>
      <div className="mt-0.5 font-mono text-[13px] text-[var(--pc-text)]">{display}</div>
    </div>
  );
}
