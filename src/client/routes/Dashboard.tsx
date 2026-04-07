import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  RefreshCcw,
  ShieldCheck,
  TrendingDown
} from "lucide-react";

import { FailurePatterns } from "../components/dashboard/FailurePatterns.js";
import { HealthSummary } from "../components/dashboard/HealthSummary.js";
import { PageHeader } from "../components/layout/PageHeader.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { SyncIndicator } from "../components/shared/SyncIndicator.js";
import { Button } from "../components/ui/button.js";
import { Card } from "../components/ui/card.js";
import { humanizeFlag } from "../lib/flags.js";
import { useDashboard } from "../hooks/useDashboard.js";
import { useTriggerSync } from "../hooks/useSync.js";

export function DashboardPage() {
  const dashboard = useDashboard();
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

  const totalDevices = Object.values(dashboard.data.counts).reduce((sum, value) => sum + value, 0);
  const impactedDevices =
    dashboard.data.counts.critical +
    dashboard.data.counts.warning +
    dashboard.data.counts.info;
  const stabilityRate =
    totalDevices > 0 ? Math.round((dashboard.data.counts.healthy / totalDevices) * 100) : 0;
  const topPattern = dashboard.data.failurePatterns[0];

  const countForFlags = (flags: string[]) =>
    dashboard.data.failurePatterns
      .filter((pattern) => flags.includes(pattern.flag))
      .reduce((sum, pattern) => sum + pattern.count, 0);

  const breakpointBuckets = [
    {
      label: "Identity & Records",
      count: countForFlags(["identity_conflict", "no_autopilot_record", "missing_ztdid"]),
      icon: ShieldCheck,
      color: "text-[var(--pc-info)]",
      bgColor: "bg-[var(--pc-info-muted)]"
    },
    {
      label: "Targeting & Profile",
      count: countForFlags([
        "no_profile_assigned",
        "profile_assignment_failed",
        "not_in_target_group",
        "tag_mismatch"
      ]),
      icon: AlertTriangle,
      color: "text-[var(--pc-warning)]",
      bgColor: "bg-[var(--pc-warning-muted)]"
    },
    {
      label: "Enrollment & Join",
      count: countForFlags([
        "hybrid_join_risk",
        "profile_assigned_not_enrolled",
        "provisioning_stalled",
        "deployment_mode_mismatch"
      ]),
      icon: AlertTriangle,
      color: "text-[var(--pc-critical)]",
      bgColor: "bg-[var(--pc-critical-muted)]"
    },
    {
      label: "Ownership & Drift",
      count: countForFlags(["user_mismatch", "compliance_drift", "orphaned_autopilot"]),
      icon: TrendingDown,
      color: "text-[var(--pc-warning)]",
      bgColor: "bg-[var(--pc-warning-muted)]"
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Estate Health"
        description="End-to-end visibility across Autopilot, Intune, and Entra ID — surfacing devices whose join, enrollment, configuration, or compliance state is drifting from intent."
        actions={
          <>
            <SyncIndicator lastSync={dashboard.data.lastSync} />
            <Button onClick={() => sync.mutate()} disabled={sync.isPending}>
              <RefreshCcw className="h-3.5 w-3.5" />
              Sync Now
            </Button>
          </>
        }
      />

      {/* Top KPI row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="px-5 py-4">
          <div className="text-[12px] font-medium text-[var(--pc-text-muted)]">Total Devices</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-white">{totalDevices}</div>
          <div className="mt-1 text-[11px] text-[var(--pc-text-muted)]">In current cache</div>
        </Card>
        <Card className="px-5 py-4">
          <div className="text-[12px] font-medium text-[var(--pc-text-muted)]">Impacted</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-white">{impactedDevices}</div>
          <div className="mt-1 text-[11px] text-[var(--pc-text-muted)]">Outside expected state</div>
        </Card>
        <Card className="px-5 py-4">
          <div className="text-[12px] font-medium text-[var(--pc-text-muted)]">Stability</div>
          <div className="mt-1 flex items-end gap-1.5">
            <span className="text-3xl font-semibold tabular-nums text-white">{stabilityRate}</span>
            <span className="mb-1 text-[15px] font-medium text-[var(--pc-text-muted)]">%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-[var(--pc-healthy)] transition-all"
              style={{ width: `${Math.max(stabilityRate, 3)}%` }}
            />
          </div>
        </Card>
        <Card className="px-5 py-4">
          <div className="text-[12px] font-medium text-[var(--pc-text-muted)]">Top Signal</div>
          <div className="mt-1 truncate text-[15px] font-semibold text-white">
            {topPattern ? humanizeFlag(topPattern.flag) : "No Issues"}
          </div>
          <div className="mt-1 text-[11px] text-[var(--pc-text-muted)]">
            {topPattern
              ? `${topPattern.count} devices affected`
              : "Estate looks healthy"}
          </div>
        </Card>
      </div>

      {/* Health distribution */}
      <HealthSummary counts={dashboard.data.counts} />

      {/* Main content: Failures + Breakpoints */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <FailurePatterns patterns={dashboard.data.failurePatterns} />

        <div className="space-y-4">
          {/* Breakpoint buckets */}
          <Card className="overflow-hidden">
            <div className="border-b border-[var(--pc-border)] px-5 py-4">
              <div className="text-[13px] font-semibold text-white">Breakpoint Areas</div>
              <div className="mt-0.5 text-[12px] text-[var(--pc-text-muted)]">
                Where provisioning chains are failing
              </div>
            </div>
            <div className="divide-y divide-[var(--pc-border)]">
              {breakpointBuckets.map((bucket) => (
                <div key={bucket.label} className="flex items-center gap-3 px-5 py-3.5">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${bucket.bgColor}`}>
                    <bucket.icon className={`h-4 w-4 ${bucket.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-white">{bucket.label}</div>
                  </div>
                  <div className="text-[17px] font-semibold tabular-nums text-white">
                    {bucket.count}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Quick links */}
          <Card className="overflow-hidden">
            <div className="border-b border-[var(--pc-border)] px-5 py-4">
              <div className="text-[13px] font-semibold text-white">Quick Actions</div>
            </div>
            <div className="divide-y divide-[var(--pc-border)]">
              <Link
                to="/devices"
                search={{ search: undefined, health: "critical", flag: undefined, property: undefined, profile: undefined, page: 1, pageSize: 25 }}
                className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--pc-critical-muted)]">
                    <AlertTriangle className="h-3.5 w-3.5 text-[var(--pc-critical)]" />
                  </div>
                  <span className="text-[13px] font-medium text-white">Critical Devices</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold tabular-nums text-[var(--pc-text-secondary)]">
                    {dashboard.data.counts.critical}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-[var(--pc-text-muted)]" />
                </div>
              </Link>
              <Link
                to="/profiles"
                className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--pc-accent-muted)]">
                    <ShieldCheck className="h-3.5 w-3.5 text-[var(--pc-accent)]" />
                  </div>
                  <span className="text-[13px] font-medium text-white">Profile Audit</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--pc-text-muted)]" />
              </Link>
              <Link
                to="/devices"
                search={{ search: undefined, health: undefined, flag: undefined, property: undefined, profile: undefined, page: 1, pageSize: 25 }}
                className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.06]">
                    <ArrowRight className="h-3.5 w-3.5 text-[var(--pc-text-secondary)]" />
                  </div>
                  <span className="text-[13px] font-medium text-white">All Devices</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold tabular-nums text-[var(--pc-text-secondary)]">
                    {totalDevices}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-[var(--pc-text-muted)]" />
                </div>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
