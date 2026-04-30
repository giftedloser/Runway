import { CheckCircle2, History, XCircle } from "lucide-react";

import { useAuthStatus } from "../../hooks/useAuth.js";
import { useDeviceActionLogs } from "../../hooks/useActions.js";
import { useTimestampFormatter } from "../../hooks/useTimestampFormatter.js";
import type { DeviceDetailResponse } from "../../lib/types.js";
import { Card } from "../ui/card.js";

const ACTION_LABELS: Record<string, string> = {
  sync: "Sync requested",
  reboot: "Reboot",
  rename: "Rename",
  "autopilot-reset": "Autopilot reset",
  retire: "Retire",
  wipe: "Factory wipe",
  "rotate-laps": "LAPS rotation",
  "delete-intune": "Delete from Intune",
  "delete-autopilot": "Delete from Autopilot",
  "autopilot-import": "Autopilot import"
};

function isSuccess(status: number | null): boolean {
  return typeof status === "number" && status >= 200 && status < 300;
}

export function ActionHistory({ device }: { device: DeviceDetailResponse }) {
  const auth = useAuthStatus();
  const formatTimestamp = useTimestampFormatter();
  const isAuthed = auth.data?.authenticated === true;
  const logs = useDeviceActionLogs(isAuthed ? device.summary.deviceKey : undefined, 25);

  if (!isAuthed) return null;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[var(--pc-accent)]" />
          <span className="text-[13px] font-semibold text-[var(--pc-text)]">Action History</span>
        </div>
        <span className="text-[11px] text-[var(--pc-text-muted)]">Last 25 entries</span>
      </div>

      {logs.isLoading ? (
        <div className="text-[12px] text-[var(--pc-text-muted)]">Loading…</div>
      ) : logs.isError ? (
        <div className="text-[12px] text-[var(--pc-critical)]">Could not load action history.</div>
      ) : !logs.data || logs.data.length === 0 ? (
        <div className="rounded-md border border-dashed border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-4 py-3 text-[12px] text-[var(--pc-text-muted)]">
          No remote actions have been issued for this device yet.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--pc-border)]">
          {logs.data.map((entry) => {
            const ok = isSuccess(entry.graphResponseStatus);
            return (
              <li key={entry.id} className="flex items-start gap-3 py-2.5">
                <div
                  className={
                    ok
                      ? "mt-0.5 flex h-6 w-6 items-center justify-center rounded-md bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)]"
                      : "mt-0.5 flex h-6 w-6 items-center justify-center rounded-md bg-[var(--pc-critical-muted)] text-[var(--pc-critical)]"
                  }
                >
                  {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-[13px] font-medium text-[var(--pc-text)]">
                      {ACTION_LABELS[entry.actionType] ?? entry.actionType}
                    </div>
                    <div className="shrink-0 text-[11px] text-[var(--pc-text-muted)]" title={entry.triggeredAt}>
                      {formatTimestamp(entry.triggeredAt)}
                    </div>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-[var(--pc-text-muted)]">
                    <span>by {entry.triggeredBy}</span>
                    {entry.bulkRunId ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono" title={entry.bulkRunId}>
                          Bulk {entry.bulkRunId.slice(0, 8)}
                        </span>
                      </>
                    ) : null}
                    {entry.graphResponseStatus !== null ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">HTTP {entry.graphResponseStatus}</span>
                      </>
                    ) : null}
                  </div>
                  {entry.notes ? (
                    <div className="mt-1 line-clamp-2 text-[11.5px] text-[var(--pc-text-secondary)]">
                      {entry.notes}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
