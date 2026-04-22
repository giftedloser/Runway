import { Cable, CheckCircle2, HelpCircle, XCircle } from "lucide-react";

import type { DeviceDetailResponse } from "../../lib/types.js";
import { cn } from "../../lib/utils.js";
import { SourceBadge } from "../shared/SourceBadge.js";
import { Card } from "../ui/card.js";

function normalizeAgentLabel(value: string | null) {
  if (!value) return "No management agent reported";
  return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function ConfigMgrConnectionPanel({ device }: { device: DeviceDetailResponse }) {
  const hasIntuneRecord = Boolean(device.identity.intuneId);
  const isConnected = device.enrollment.hasConfigMgrClient;
  const managementAgent = device.enrollment.managementAgent;
  const tone = !hasIntuneRecord
    ? "border-[var(--pc-border)] bg-[var(--pc-surface-raised)] text-[var(--pc-text-muted)]"
    : isConnected
      ? "border-[var(--pc-healthy)]/35 bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)]"
      : "border-[var(--pc-warning)]/35 bg-[var(--pc-warning-muted)] text-[var(--pc-warning)]";
  const Icon = !hasIntuneRecord ? HelpCircle : isConnected ? CheckCircle2 : XCircle;
  const title = !hasIntuneRecord
    ? "No Intune device record"
    : isConnected
      ? "ConfigMgr client detected"
      : "ConfigMgr client not detected";
  const description = !hasIntuneRecord
    ? "Runway needs the Intune managed-device record before it can read the managementAgent signal."
    : isConnected
      ? "Intune reports a Configuration Manager management agent for this device."
      : "Intune does not report a Configuration Manager management agent. If this machine should be attached to SCCM, verify the local ConfigMgr client and co-management/tenant-attach state.";

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Cable className="h-4 w-4 text-[var(--pc-accent)]" />
        <span className="text-[13px] font-semibold text-[var(--pc-text)]">
          SCCM / ConfigMgr Connection
        </span>
        <SourceBadge source="sccm" size="xs" />
      </div>

      <div className={cn("rounded-lg border px-4 py-3", tone)}>
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold">{title}</div>
            <p className="mt-1 text-[12px] leading-relaxed">{description}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3">
          <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
            Intune managementAgent
          </div>
          <div className="font-mono text-[12px] text-[var(--pc-text)]">
            {managementAgent ?? "not reported"}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3">
          <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
            Interpretation
          </div>
          <div className="text-[12.5px] text-[var(--pc-text)]">
            {normalizeAgentLabel(managementAgent)}
          </div>
        </div>
      </div>
    </Card>
  );
}
