import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";

import type { HealthLevel, ProfileAuditSummary } from "../../lib/types.js";

const dotColors: Record<string, string> = {
  critical: "bg-[var(--pc-critical)]",
  warning: "bg-[var(--pc-warning)]",
  info: "bg-[var(--pc-info)]",
  healthy: "bg-[var(--pc-healthy)]",
  unknown: "bg-[var(--pc-text-muted)]"
};

const ROUTABLE: Record<HealthLevel, boolean> = {
  critical: true,
  warning: true,
  info: true,
  healthy: true,
  unknown: false
};

export function ProfileHealthBreakdown({ profile }: { profile: ProfileAuditSummary }) {
  const entries = Object.entries(profile.counts) as [HealthLevel, number][];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
          Health Breakdown
        </div>
        <Link
          to="/devices"
          search={{
            search: undefined,
            health: undefined,
            flag: undefined,
            property: undefined,
            profile: profile.profileName,
            page: 1,
            pageSize: 25
          }}
          className="inline-flex items-center gap-1 text-[11px] text-[var(--pc-accent)] hover:text-[var(--pc-accent-hover)]"
          title={`View all ${profile.profileName} devices`}
        >
          View all
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {entries.map(([key, value]) => {
          const tile = (
            <div
              className={`rounded-lg bg-[var(--pc-tint-subtle)] px-2.5 py-2 transition-colors ${
                ROUTABLE[key] && value > 0
                  ? "cursor-pointer hover:bg-[var(--pc-tint-hover)]"
                  : ""
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${dotColors[key] ?? "bg-[var(--pc-text-muted)]"}`} />
                <span className="text-[11px] capitalize text-[var(--pc-text-muted)]">{key}</span>
              </div>
              <div className="mt-0.5 text-[16px] font-semibold tabular-nums text-[var(--pc-text)]">{value}</div>
            </div>
          );

          if (!ROUTABLE[key] || value === 0) {
            return <div key={key}>{tile}</div>;
          }

          return (
            <Link
              key={key}
              to="/devices"
              search={{
                search: undefined,
                health: key as Exclude<HealthLevel, "unknown">,
                flag: undefined,
                property: undefined,
                profile: profile.profileName,
                page: 1,
                pageSize: 25
              }}
              title={`View ${key} devices in ${profile.profileName}`}
            >
              {tile}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
