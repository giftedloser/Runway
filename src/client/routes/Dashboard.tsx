import { Link } from "@tanstack/react-router";
import {
  ChevronRight,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

import { FailurePatterns } from "../components/dashboard/FailurePatterns.js";
import { HealthSummary } from "../components/dashboard/HealthSummary.js";
import { HealthTrendChart } from "../components/dashboard/HealthTrendChart.js";
import { MasterDeviceSearch } from "../components/dashboard/MasterDeviceSearch.js";
import { RecentChanges } from "../components/dashboard/RecentChanges.js";
import { TriageCommandCenter } from "../components/dashboard/TriageCommandCenter.js";
import { PageHeader } from "../components/layout/PageHeader.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { SyncIndicator } from "../components/shared/SyncIndicator.js";
import { Button } from "../components/ui/button.js";
import { Card } from "../components/ui/card.js";
import { useDashboard } from "../hooks/useDashboard.js";
import { useSyncStatus, useTriggerSync } from "../hooks/useSync.js";

export function DashboardPage() {
  const dashboard = useDashboard();
  const syncStatus = useSyncStatus();
  const sync = useTriggerSync();

  if (dashboard.isLoading) return <LoadingState label="Loading dashboard…" />;
  if (dashboard.isError || !dashboard.data) {
    return (
      <ErrorState
        title="Could not load dashboard"
        error={dashboard.error}
        onRetry={() => dashboard.refetch()}
      />
    );
  }

  const totalDevices = Object.values(dashboard.data.counts).reduce(
    (sum, value) => sum + value,
    0,
  );
  const impactedDevices =
    dashboard.data.counts.critical +
    dashboard.data.counts.warning;
  const coverageDevices = countForFlags([
    "no_autopilot_record",
    "orphaned_autopilot",
    "missing_ztdid",
  ]);
  const stabilityRate =
    totalDevices > 0
      ? Math.round((dashboard.data.counts.healthy / totalDevices) * 100)
      : 0;
  function countForFlags(flags: string[]) {
    return dashboard.data.failurePatterns
      .filter((pattern) => flags.includes(pattern.flag))
      .reduce((sum, pattern) => sum + pattern.count, 0);
  }

  const setupIncomplete = dashboard.data.lastSync === null;

  const attentionMetrics = [
    {
      label: "Needs attention",
      value: impactedDevices,
      detail: "Critical or warning",
    },
    {
      label: "Healthy",
      value: `${stabilityRate}%`,
      detail: `${dashboard.data.counts.healthy} devices clear`,
    },
    {
      label: "Autopilot coverage",
      value: coverageDevices,
      detail: "Info-only adoption gaps",
    },
    {
      label: "Identity review",
      value:
        dashboard.data.correlationQuality.identityConflictCount +
        dashboard.data.correlationQuality.lowConfidenceCount,
      detail: "Verify before action",
    },
  ];

  const topReasons =
    dashboard.data.failurePatterns
      .filter((pattern) => pattern.severity !== "info")
      .slice(0, 5);

  return (
    <div className="space-y-5">
      {setupIncomplete ? (
        <Link
          to="/setup"
          className="flex flex-col gap-3 rounded-xl border border-[var(--pc-accent)]/40 bg-[var(--pc-accent-muted)] px-4 py-3 text-[12.5px] text-[var(--pc-text-secondary)] transition-colors hover:border-[var(--pc-accent)]/60 sm:flex-row sm:items-center"
        >
          <ShieldCheck className="h-4 w-4 text-[var(--pc-accent)]" />
          <span className="flex-1">
            <span className="font-medium text-[var(--pc-text)]">
              Finish first-run setup
            </span>
            <span className="ml-2 text-[var(--pc-text-muted)]">
              Configure Graph credentials and run an initial sync.
            </span>
          </span>
          <ChevronRight className="hidden h-3.5 w-3.5 text-[var(--pc-text-muted)] sm:block" />
        </Link>
      ) : null}

      <PageHeader
        eyebrow="Start"
        title="Operator view"
        description="Find what needs attention, why it matters, and where to go next."
        actions={
          <>
            <SyncIndicator
              lastSync={dashboard.data.lastSync}
              inProgress={syncStatus.data?.inProgress}
              lastError={syncStatus.data?.lastError}
            />
            <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
              <RefreshCcw className="h-3.5 w-3.5" />
              Sync now
            </Button>
          </>
        }
      />

      <MasterDeviceSearch />

      <TriageCommandCenter dashboard={dashboard.data} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--pc-border)] px-5 py-4">
            <div className="text-[13px] font-semibold text-[var(--pc-text)]">
              Fleet summary
            </div>
            <div className="mt-0.5 text-[12px] text-[var(--pc-text-muted)]">
              Health and coverage are separated so adoption gaps do not read as failures.
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-[var(--pc-border)] md:grid-cols-4 md:divide-y-0">
            {attentionMetrics.map((metric) => (
              <div key={metric.label} className="px-5 py-4">
                <div className="text-[11.5px] font-medium text-[var(--pc-text-muted)]">
                  {metric.label}
                </div>
                <div className="mt-1 text-3xl font-semibold tabular-nums text-[var(--pc-text)]">
                  {metric.value}
                </div>
                <div className="mt-1 text-[11px] text-[var(--pc-text-muted)]">
                  {metric.detail}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-[var(--pc-border)] px-5 py-4">
            <div className="text-[13px] font-semibold text-[var(--pc-text)]">
              Sync freshness
            </div>
            <div className="mt-2">
              <SyncIndicator
                lastSync={dashboard.data.lastSync}
                inProgress={syncStatus.data?.inProgress}
                lastError={syncStatus.data?.lastError}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-[var(--pc-border)]">
            <div className="px-5 py-3">
              <div className="text-[11px] text-[var(--pc-text-muted)]">Current cache</div>
              <div className="mt-1 text-[18px] font-semibold tabular-nums text-[var(--pc-text)]">
                {totalDevices}
              </div>
            </div>
            <div className="px-5 py-3">
              <div className="text-[11px] text-[var(--pc-text-muted)]">New in 24h</div>
              <div className="mt-1 text-[18px] font-semibold tabular-nums text-[var(--pc-text)]">
                {dashboard.data.newlyUnhealthy24h}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <FailurePatterns patterns={topReasons} />
        <HealthSummary counts={dashboard.data.counts} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <RecentChanges transitions={dashboard.data.recentTransitions} />
        <HealthTrendChart data={dashboard.data.healthTrend} />
      </div>
    </div>
  );
}
