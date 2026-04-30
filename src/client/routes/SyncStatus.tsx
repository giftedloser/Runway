import {
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCcw,
  XCircle,
} from "lucide-react";

import { PageHeader } from "../components/layout/PageHeader.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { SourceBadge } from "../components/shared/SourceBadge.js";
import { SyncIndicator } from "../components/shared/SyncIndicator.js";
import { Button } from "../components/ui/button.js";
import { Card } from "../components/ui/card.js";
import { useTimestampFormatter } from "../hooks/useTimestampFormatter.js";
import { useSyncStatus, useTriggerSync } from "../hooks/useSync.js";

export function SyncStatusPage() {
  const status = useSyncStatus();
  const trigger = useTriggerSync();
  const formatTimestamp = useTimestampFormatter();

  if (status.isLoading) return <LoadingState label="Loading sync status…" />;
  if (status.isError || !status.data) {
    return (
      <ErrorState
        title="Could not load sync status"
        error={status.error}
        onRetry={() => status.refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="System"
        title="Data Ingestion"
        description="Run and inspect Microsoft Graph sync jobs."
        actions={
          <>
            <SourceBadge source="graph" />
            <Button
              onClick={() => trigger.mutate()}
              disabled={trigger.isPending || status.data.inProgress}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Run Full Sync
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="px-4 py-3.5">
          <div className="text-[11px] font-medium text-[var(--pc-text-muted)]">
            Status
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            {status.data.inProgress ? (
              <>
                <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--pc-accent)]" />
                <span className="text-[13px] font-medium text-[var(--pc-accent)]">
                  Syncing
                </span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 rounded-full bg-[var(--pc-healthy)]" />
                <span className="text-[13px] font-medium text-[var(--pc-text)]">
                  Idle
                </span>
              </>
            )}
          </div>
        </Card>
        <Card className="px-4 py-3.5">
          <div className="text-[11px] font-medium text-[var(--pc-text-muted)]">
            Graph Connected
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            {status.data.graphConfigured ? (
              <>
                <CheckCircle className="h-3.5 w-3.5 text-[var(--pc-healthy)]" />
                <span className="text-[13px] font-medium text-[var(--pc-text)]">
                  Yes
                </span>
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5 text-[var(--pc-critical)]" />
                <span className="text-[13px] font-medium text-[var(--pc-text)]">
                  No
                </span>
              </>
            )}
          </div>
        </Card>
        <Card className="px-4 py-3.5">
          <div className="text-[11px] font-medium text-[var(--pc-text-muted)]">
            Last Sync Type
          </div>
          <div className="mt-1.5 font-mono text-[13px] text-[var(--pc-text)]">
            {status.data.lastSyncType ?? "\u2014"}
          </div>
        </Card>
        <Card className="px-4 py-3.5">
          <div className="text-[11px] font-medium text-[var(--pc-text-muted)]">
            Last Synced
          </div>
          <div className="mt-1.5">
            <SyncIndicator
              lastSync={status.data.lastCompletedAt}
              inProgress={status.data.inProgress}
              lastError={status.data.lastError}
            />
          </div>
        </Card>
      </div>

      {status.data.lastError && (
        <Card className="border-[var(--pc-critical)]/20 bg-[var(--pc-critical-muted)] px-5 py-4">
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pc-critical)]" />
            <div>
              <div className="text-[13px] font-medium text-[var(--pc-critical)]">
                Last Error
              </div>
              <div className="mt-0.5 font-mono text-[12px] text-[var(--pc-critical)]">
                {status.data.lastError}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Sync log */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--pc-border)] px-5 py-4">
          <div>
            <div className="text-[13px] font-semibold text-[var(--pc-text)]">
              Sync History
            </div>
            <div className="mt-0.5 text-[11px] text-[var(--pc-text-muted)]">
              Most recent {status.data.logs.length} runs.
            </div>
          </div>
          {status.data.logs.length > 0 && (
            <SyncSummary logs={status.data.logs} />
          )}
        </div>
        {status.data.logs.length === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-[var(--pc-text-muted)]">
            No sync history yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--pc-border)] text-[11px] font-medium text-[var(--pc-text-muted)]">
                  <th className="px-5 py-3 text-left">Type</th>
                  <th className="px-5 py-3 text-left">Started</th>
                  <th className="px-5 py-3 text-left">Duration</th>
                  <th className="px-5 py-3 text-left">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--pc-border)]">
                {status.data.logs.map((entry) => {
                  const started = new Date(entry.startedAt);
                  const completed = entry.completedAt
                    ? new Date(entry.completedAt)
                    : null;
                  const durationMs = completed
                    ? completed.getTime() - started.getTime()
                    : null;
                  const hasErrors = entry.errors.length > 0;
                  return (
                    <tr
                      key={entry.id}
                      className="transition-colors hover:bg-[var(--pc-tint-subtle)]"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {hasErrors ? (
                            <AlertTriangle className="h-3 w-3 text-[var(--pc-critical)]" />
                          ) : completed ? (
                            <CheckCircle className="h-3 w-3 text-[var(--pc-healthy)]" />
                          ) : (
                            <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--pc-accent)]" />
                          )}
                          <span className="font-mono text-[var(--pc-text)]">
                            {entry.syncType}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-[var(--pc-text-muted)]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          <span title={started.toLocaleString()}>
                            {formatTimestamp(started)}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 font-mono text-[12px] text-[var(--pc-text-secondary)]">
                        {durationMs !== null ? (
                          formatDuration(durationMs)
                        ) : (
                          <span className="text-[var(--pc-accent)]">
                            running…
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-[var(--pc-text-secondary)]">
                        {hasErrors ? (
                          <details className="group">
                            <summary className="cursor-pointer text-[var(--pc-critical)] hover:text-[var(--pc-critical)]/80">
                              {entry.errors.length} error
                              {entry.errors.length === 1 ? "" : "s"}
                            </summary>
                            <ul className="mt-2 space-y-1 pl-3 text-[11.5px] text-[var(--pc-critical)]">
                              {entry.errors.map((err, idx) => (
                                <li key={idx} className="font-mono">
                                  • {err}
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : completed ? (
                          <span>
                            <span className="font-medium text-[var(--pc-text)]">
                              {entry.devicesSynced}
                            </span>{" "}
                            device{entry.devicesSynced === 1 ? "" : "s"}
                          </span>
                        ) : (
                          <span className="text-[var(--pc-text-muted)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 100) / 10;
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds - minutes * 60);
  return `${minutes}m ${remainder}s`;
}

function SyncSummary({
  logs,
}: {
  logs: NonNullable<ReturnType<typeof useSyncStatus>["data"]>["logs"];
}) {
  const completed = logs.filter((log) => log.completedAt !== null);
  if (completed.length === 0) return null;
  const successes = completed.filter((log) => log.errors.length === 0).length;
  const totalMs = completed.reduce((sum, log) => {
    const start = new Date(log.startedAt).getTime();
    const end = new Date(log.completedAt!).getTime();
    return sum + Math.max(end - start, 0);
  }, 0);
  const avgMs = Math.round(totalMs / completed.length);
  return (
    <div className="flex items-center gap-4 text-[11px]">
      <div>
        <div className="text-[var(--pc-text-muted)]">Success rate</div>
        <div className="font-semibold tabular-nums text-[var(--pc-text)]">
          {Math.round((successes / completed.length) * 100)}%
        </div>
      </div>
      <div className="h-8 w-px bg-[var(--pc-border)]" />
      <div>
        <div className="text-[var(--pc-text-muted)]">Avg duration</div>
        <div className="font-mono font-semibold text-[var(--pc-text)]">
          {formatDuration(avgMs)}
        </div>
      </div>
    </div>
  );
}
