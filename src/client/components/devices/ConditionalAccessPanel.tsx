import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

import type { DeviceDetailResponse } from "../../lib/types.js";
import { apiRequest } from "../../lib/api.js";
import { Card } from "../ui/card.js";
import { cn } from "../../lib/utils.js";

interface ConditionalAccessPolicy {
  id: string;
  displayName: string;
  state: string | null;
  conditions: {
    platforms?: {
      includePlatforms?: string[];
      excludePlatforms?: string[];
    };
    [key: string]: unknown;
  } | null;
  grantControls: {
    operator?: string;
    builtInControls?: string[];
    [key: string]: unknown;
  } | null;
  sessionControls: unknown | null;
  lastSyncedAt: string;
}

const STATE_STYLES: Record<string, { label: string; className: string }> = {
  enabled: {
    label: "Enabled",
    className: "bg-[var(--pc-accent-muted)] text-[var(--pc-accent)] ring-1 ring-[var(--pc-accent)]/40"
  },
  disabled: {
    label: "Disabled",
    className: "bg-[var(--pc-tint-subtle)] text-[var(--pc-text-muted)] ring-1 ring-white/10"
  },
  enabledforreportingbutnotenforced: {
    label: "Report-only",
    className: "bg-[var(--pc-warning-muted)] text-[var(--pc-warning)] ring-1 ring-[var(--pc-warning)]/40"
  }
};

function stateInfo(state: string | null) {
  if (!state) return STATE_STYLES.disabled;
  const key = state.toLowerCase().replace(/\s+/g, "");
  return STATE_STYLES[key] ?? STATE_STYLES.disabled;
}

function summarizeGrantControls(grantControls: ConditionalAccessPolicy["grantControls"]): string | null {
  if (!grantControls?.builtInControls?.length) return null;

  const labels: Record<string, string> = {
    mfa: "Require MFA",
    compliantDevice: "Require compliant device",
    domainJoinedDevice: "Require hybrid Azure AD join",
    approvedApplication: "Require approved app",
    compliantApplication: "Require app protection",
    passwordChange: "Require password change",
    block: "Block"
  };

  return grantControls.builtInControls
    .map((c) => labels[c] ?? c)
    .join(", ");
}

function targetsWindows(conditions: ConditionalAccessPolicy["conditions"]): boolean {
  if (!conditions?.platforms) return false;
  const included = conditions.platforms.includePlatforms ?? [];
  return included.includes("all") || included.includes("windows");
}

export function ConditionalAccessPanel({ device }: { device: DeviceDetailResponse }) {
  const [policies, setPolicies] = useState<ConditionalAccessPolicy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiRequest<ConditionalAccessPolicy[]>("/api/conditional-access")
      .then((data: ConditionalAccessPolicy[]) => {
        if (!cancelled) setPolicies(data);
      })
      .catch(() => {
        // silently ignore — panel just won't render
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [device.summary.deviceKey]);

  if (loading || policies.length === 0) return null;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-[var(--pc-accent)]" />
        <span className="text-[13px] font-semibold text-[var(--pc-text)]">
          Conditional Access Policies
        </span>
        <span className="rounded-full bg-[var(--pc-tint-hover)] px-2 py-0.5 text-[10.5px] text-[var(--pc-text-muted)]">
          {policies.length}
        </span>
      </div>

      <div className="space-y-1.5">
        {policies.map((p) => {
          const info = stateInfo(p.state);
          const grantSummary = summarizeGrantControls(p.grantControls);
          const windows = targetsWindows(p.conditions);

          return (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-3.5 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 truncate text-[12.5px] text-[var(--pc-text)]">
                    {p.displayName}
                  </span>
                  {windows && (
                    <span className="shrink-0 rounded-md bg-[var(--pc-accent-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--pc-accent)]">
                      Windows
                    </span>
                  )}
                </div>
                {grantSummary && (
                  <div className="mt-0.5 truncate text-[11px] text-[var(--pc-text-muted)]">
                    {grantSummary}
                  </div>
                )}
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-md px-2 py-0.5 text-[10.5px] font-medium",
                  info.className
                )}
              >
                {info.label}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
