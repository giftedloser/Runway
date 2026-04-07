import { AlertTriangle, Fingerprint } from "lucide-react";

import type { DeviceDetailResponse, MatchConfidence } from "../../lib/types.js";
import { cn } from "../../lib/utils.js";
import { Card } from "../ui/card.js";
import { SourceBadge } from "../shared/SourceBadge.js";
import { StatusBadge } from "../shared/StatusBadge.js";

const CONFIDENCE_STYLES: Record<MatchConfidence, string> = {
  high: "bg-[var(--pc-healthy-muted)] text-emerald-200 ring-1 ring-[var(--pc-healthy)]/40",
  medium: "bg-[var(--pc-warning-muted)] text-amber-200 ring-1 ring-[var(--pc-warning)]/40",
  low: "bg-[var(--pc-critical-muted)] text-red-200 ring-1 ring-[var(--pc-critical)]/40"
};

const MATCHED_ON_LABELS: Record<DeviceDetailResponse["identity"]["matchedOn"], string> = {
  serial: "serial number",
  entra_device_id: "Entra device ID",
  device_id: "Intune device ID",
  device_name: "device name"
};

function IdField({
  label,
  value,
  source
}: {
  label: string;
  value: string | null | undefined;
  source: "autopilot" | "intune" | "entra";
}) {
  return (
    <div className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
          {label}
        </span>
        <SourceBadge source={source} size="xs" />
      </div>
      <div
        className="font-mono text-[12px] leading-snug text-[var(--pc-text)] break-all"
        title={value ?? undefined}
      >
        {value ?? <span className="text-[var(--pc-text-muted)]">— not present</span>}
      </div>
    </div>
  );
}

export function IdentityPanel({ device }: { device: DeviceDetailResponse }) {
  const { identity } = device;
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-[var(--pc-accent)]" />
          <span className="text-[13px] font-semibold text-white">Identity Correlation</span>
          <span
            className="text-[11.5px] text-[var(--pc-text-muted)]"
            title="Linking the same physical device across Autopilot, Intune, and Entra ID"
          >
            · Autopilot ↔ Intune ↔ Entra ID
          </span>
        </div>
        <StatusBadge health={device.summary.health} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <IdField label="Autopilot ID" value={identity.autopilotId} source="autopilot" />
        <IdField label="Intune Device ID" value={identity.intuneId} source="intune" />
        <IdField label="Entra Object ID" value={identity.entraId} source="entra" />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3">
          <div className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
            Trust Type
          </div>
          <div className="mt-1 text-[12.5px] text-[var(--pc-text)]" title={identity.trustType ?? undefined}>
            {identity.trustType ?? "—"}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3">
          <div className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
            Match Confidence
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium capitalize",
                CONFIDENCE_STYLES[identity.matchConfidence]
              )}
            >
              {identity.matchConfidence}
            </span>
            <span className="text-[11px] text-[var(--pc-text-muted)]">
              via {MATCHED_ON_LABELS[identity.matchedOn]}
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3">
          <div className="text-[10.5px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
            Conflict
          </div>
          <div
            className={cn(
              "mt-1 text-[12.5px]",
              identity.identityConflict ? "text-[var(--pc-critical)]" : "text-[var(--pc-text-secondary)]"
            )}
          >
            {identity.identityConflict ? "Conflicting identifiers" : "No conflict"}
          </div>
        </div>
      </div>

      {identity.identityConflict ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-[var(--pc-critical)]/30 bg-[var(--pc-critical-muted)] px-3.5 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--pc-critical)]" />
          <div className="text-[12px] leading-relaxed text-red-100">
            <span className="font-semibold">Identity conflict detected.</span> Two or more services
            reference this device with different identifiers. Treat the correlation below with caution
            until the duplicate has been retired or the records re-keyed.
          </div>
        </div>
      ) : null}
    </Card>
  );
}
