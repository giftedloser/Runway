import { CheckCircle, Clock, RefreshCcw, XCircle } from "lucide-react";

import { PageHeader } from "../components/layout/PageHeader.js";
import { SyncIndicator } from "../components/shared/SyncIndicator.js";
import { Button } from "../components/ui/button.js";
import { Card } from "../components/ui/card.js";
import { useSyncStatus, useTriggerSync } from "../hooks/useSync.js";

export function SyncStatusPage() {
  const status = useSyncStatus();
  const trigger = useTriggerSync();

  if (status.isLoading || !status.data) {
    return (
      <div className="flex items-center gap-2 text-[13px] text-[var(--pc-text-muted)]">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--pc-accent)] border-t-transparent" />
        Loading sync status&hellip;
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sync"
        title="Sync Status"
        description="Microsoft Graph ingestion status, cache freshness, and sync history."
        actions={
          <Button
            onClick={() => trigger.mutate()}
            disabled={trigger.isPending || status.data.inProgress}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Run Full Sync
          </Button>
        }
      />

      {/* Status cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="px-4 py-3.5">
          <div className="text-[11px] font-medium text-[var(--pc-text-muted)]">Status</div>
          <div className="mt-1.5 flex items-center gap-2">
            {status.data.inProgress ? (
              <>
                <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--pc-accent)]" />
                <span className="text-[13px] font-medium text-[var(--pc-accent)]">Syncing</span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 rounded-full bg-[var(--pc-healthy)]" />
                <span className="text-[13px] font-medium text-[var(--pc-text)]">Idle</span>
              </>
            )}
          </div>
        </Card>
        <Card className="px-4 py-3.5">
          <div className="text-[11px] font-medium text-[var(--pc-text-muted)]">Graph Connected</div>
          <div className="mt-1.5 flex items-center gap-2">
            {status.data.graphConfigured ? (
              <>
                <CheckCircle className="h-3.5 w-3.5 text-[var(--pc-healthy)]" />
                <span className="text-[13px] font-medium text-[var(--pc-text)]">Yes</span>
              </>
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5 text-[var(--pc-critical)]" />
                <span className="text-[13px] font-medium text-[var(--pc-text)]">No</span>
              </>
            )}
          </div>
        </Card>
        <Card className="px-4 py-3.5">
          <div className="text-[11px] font-medium text-[var(--pc-text-muted)]">Last Sync Type</div>
          <div className="mt-1.5 font-mono text-[13px] text-[var(--pc-text)]">
            {status.data.lastSyncType ?? "\u2014"}
          </div>
        </Card>
        <Card className="px-4 py-3.5">
          <div className="text-[11px] font-medium text-[var(--pc-text-muted)]">Last Synced</div>
          <div className="mt-1.5">
            <SyncIndicator lastSync={status.data.lastCompletedAt} />
          </div>
        </Card>
      </div>

      {status.data.lastError && (
        <Card className="border-[var(--pc-critical)]/20 bg-[var(--pc-critical-muted)] px-5 py-4">
          <div className="flex items-start gap-2">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pc-critical)]" />
            <div>
              <div className="text-[13px] font-medium text-rose-200">Last Error</div>
              <div className="mt-0.5 font-mono text-[12px] text-rose-300">{status.data.lastError}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Sync log */}
      <Card className="overflow-hidden">
        <div className="border-b border-[var(--pc-border)] px-5 py-4">
          <div className="text-[13px] font-semibold text-white">Sync History</div>
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
                  <th className="px-5 py-3 text-left">Completed</th>
                  <th className="px-5 py-3 text-left">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--pc-border)]">
                {status.data.logs.map((entry) => (
                  <tr key={entry.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-3 font-mono text-white">{entry.syncType}</td>
                    <td className="px-5 py-3 text-[var(--pc-text-muted)]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        {entry.startedAt}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-[var(--pc-text-muted)]">
                      {entry.completedAt ?? (
                        <span className="text-[var(--pc-accent)]">In progress</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-[var(--pc-text-secondary)]">
                      {entry.errors.length > 0 ? (
                        <span className="text-[var(--pc-critical)]">{entry.errors.join(", ")}</span>
                      ) : (
                        `${entry.devicesSynced} devices`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
