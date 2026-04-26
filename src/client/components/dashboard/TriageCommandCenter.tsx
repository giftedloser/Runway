import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Fingerprint,
  Radio,
  ShieldAlert,
  Target
} from "lucide-react";

import type { DashboardResponse, FlagCode, HealthLevel } from "../../lib/types.js";
import { cn } from "../../lib/utils.js";

type QueueSearch = {
  search: string | undefined;
  health: HealthLevel | undefined;
  flag: FlagCode | undefined;
  property: string | undefined;
  profile: string | undefined;
  page: number;
  pageSize: number;
};

const DEVICE_QUEUE_SEARCH: QueueSearch = {
  search: undefined,
  health: undefined,
  flag: undefined,
  property: undefined,
  profile: undefined,
  page: 1,
  pageSize: 25
};

type QueueCard = {
  title: string;
  count: number;
  description: string;
  operatorHint: string;
  search: QueueSearch;
  icon: typeof AlertTriangle;
  tone: "critical" | "warning" | "info" | "neutral";
};

function countForFlags(patterns: DashboardResponse["failurePatterns"], flags: FlagCode[]) {
  const wanted = new Set(flags);
  return patterns.reduce((sum, pattern) => sum + (wanted.has(pattern.flag) ? pattern.count : 0), 0);
}

function toneClasses(tone: QueueCard["tone"]) {
  return {
    critical: {
      ring: "hover:border-[var(--pc-critical)]/55",
      icon: "bg-[var(--pc-critical-muted)] text-[var(--pc-critical)]",
      count: "text-[var(--pc-critical)]"
    },
    warning: {
      ring: "hover:border-[var(--pc-warning)]/55",
      icon: "bg-[var(--pc-warning-muted)] text-[var(--pc-warning)]",
      count: "text-[var(--pc-warning)]"
    },
    info: {
      ring: "hover:border-[var(--pc-info)]/55",
      icon: "bg-[var(--pc-info-muted)] text-[var(--pc-info)]",
      count: "text-[var(--pc-info)]"
    },
    neutral: {
      ring: "hover:border-[var(--pc-border-hover)]",
      icon: "bg-[var(--pc-tint-hover)] text-[var(--pc-text-secondary)]",
      count: "text-[var(--pc-text)]"
    }
  }[tone];
}

export function TriageCommandCenter({ dashboard }: { dashboard: DashboardResponse }) {
  const identityCount =
    dashboard.correlationQuality.identityConflictCount +
    dashboard.correlationQuality.lowConfidenceCount;
  const targetingCount = countForFlags(dashboard.failurePatterns, [
    "not_in_target_group",
    "tag_mismatch",
    "no_profile_assigned",
    "profile_assignment_failed",
    "deployment_mode_mismatch"
  ]);
  const enrollmentCount = countForFlags(dashboard.failurePatterns, [
    "profile_assigned_not_enrolled",
    "provisioning_stalled",
    "no_autopilot_record",
    "orphaned_autopilot"
  ]);

  const queues: QueueCard[] = [
    {
      title: "Critical now",
      count: dashboard.counts.critical,
      description: "Machines most likely to block provisioning or support work.",
      operatorHint: "Open first when a tech asks where to start.",
      search: { ...DEVICE_QUEUE_SEARCH, health: "critical" },
      icon: ShieldAlert,
      tone: "critical"
    },
    {
      title: "Identity trust",
      count: identityCount,
      description: "Devices with weak joins or conflicting source records.",
      operatorHint: "Verify serial, Entra device ID, and Intune object before acting.",
      search: { ...DEVICE_QUEUE_SEARCH, flag: "identity_conflict" },
      icon: Fingerprint,
      tone: identityCount > 0 ? "warning" : "neutral"
    },
    {
      title: "Targeting breaks",
      count: targetingCount,
      description: "Group tag, membership, or Autopilot profile intent is off.",
      operatorHint: "Fix tag mappings, dynamic groups, or profile assignment drift.",
      search: { ...DEVICE_QUEUE_SEARCH, flag: "not_in_target_group" },
      icon: Target,
      tone: targetingCount > 0 ? "warning" : "neutral"
    },
    {
      title: "Enrollment stalls",
      count: enrollmentCount,
      description: "Autopilot and Intune disagree about where the device landed.",
      operatorHint: "Check OOBE timing, check-in age, and whether Intune has a record.",
      search: { ...DEVICE_QUEUE_SEARCH, flag: "provisioning_stalled" },
      icon: Radio,
      tone: enrollmentCount > 0 ? "info" : "neutral"
    }
  ];

  return (
    <section className="rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface)] p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[13px] font-semibold text-[var(--pc-text)]">
            Next Queues
          </div>
        </div>
        <p className="max-w-xl overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-[var(--pc-text-muted)]">
          Start with the highest-risk device queue.
        </p>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {queues.map((queue) => {
          const tone = toneClasses(queue.tone);
          const Icon = queue.icon;
          return (
            <Link
              key={queue.title}
              to="/devices"
              search={queue.search}
              className={cn(
                "group flex min-h-[142px] cursor-pointer flex-col rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3.5 transition-[border-color,background-color] hover:bg-[var(--pc-tint-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]",
                tone.ring
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-[var(--pc-radius-sm)]", tone.icon)}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className={cn("text-[1.7rem] font-semibold tabular-nums leading-none", tone.count)}>
                  {queue.count}
                </div>
              </div>
              <div className="mt-3 text-[13px] font-semibold text-[var(--pc-text)]">
                {queue.title}
              </div>
              <p className="mt-1 line-clamp-1 text-[12px] text-[var(--pc-text-secondary)]">
                {queue.description}
              </p>
              <div className="mt-auto flex items-center gap-2 pt-3 text-[11.5px] font-medium text-[var(--pc-text-muted)]">
                <span className="line-clamp-1">{queue.operatorHint}</span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
