import { ClipboardCopy } from "lucide-react";

import type { DeviceDetailResponse } from "../../lib/types.js";
import { humanizeFlag } from "../../lib/flags.js";
import { useToast } from "../shared/toast.js";

interface CopySummaryButtonProps {
  device: DeviceDetailResponse;
}

export function buildSummaryText(d: DeviceDetailResponse): string {
  const lines: string[] = [];
  const s = d.summary;

  lines.push(`Device: ${s.deviceName ?? "—"}`);
  lines.push(`Serial: ${s.serialNumber ?? "—"}`);
  lines.push(`Health: ${s.health}`);
  lines.push(`Correlation: ${d.identity.matchConfidence}${d.identity.nameJoined ? " (name-only join)" : ""}`);
  if (s.propertyLabel) lines.push(`Property: ${s.propertyLabel}`);
  if (s.assignedProfileName) lines.push(`Profile: ${s.assignedProfileName}`);
  if (s.deploymentMode) lines.push(`Deployment Mode: ${s.deploymentMode}`);
  if (s.complianceState) lines.push(`Compliance: ${s.complianceState}`);

  const apUser = s.autopilotAssignedUserUpn;
  const inUser = s.intunePrimaryUserUpn;
  if (apUser) lines.push(`Autopilot User: ${apUser}`);
  if (inUser) lines.push(`Intune User: ${inUser}`);

  lines.push("");
  lines.push(`Diagnosis: ${s.diagnosis}`);

  if (d.diagnostics.length > 0) {
    lines.push("");
    lines.push("Active Issues:");
    for (const diag of d.diagnostics) {
      lines.push(`  [${diag.severity.toUpperCase()}] ${diag.title}`);
      lines.push(`    ${diag.summary}`);
      if (diag.caveat) lines.push(`    ⚠ ${diag.caveat}`);
    }
  }

  if (s.flags.length > 0) {
    lines.push("");
    lines.push(`Flags: ${s.flags.map(humanizeFlag).join(", ")}`);
  }

  const chain = d.assignmentPath;
  lines.push("");
  lines.push(`Provisioning Chain: ${chain.chainComplete ? "Complete" : `Broken at ${chain.breakPoint ?? "unknown"}`}`);

  lines.push("");
  lines.push(`Identity: AP=${d.identity.autopilotId ?? "—"} IN=${d.identity.intuneId ?? "—"} Entra=${d.identity.entraId ?? "—"}`);
  lines.push(`Matched on: ${d.identity.matchedOn}`);

  lines.push("");
  lines.push(`— Copied from PilotCheck`);

  return lines.join("\n");
}

export function CopySummaryButton({ device }: CopySummaryButtonProps) {
  const toast = useToast();

  const onCopy = async () => {
    try {
      const text = buildSummaryText(device);
      await navigator.clipboard.writeText(text);
      toast.push({
        variant: "success",
        title: "Summary copied",
        description: "Device summary copied to clipboard — paste into tickets or chat.",
        durationMs: 2500
      });
    } catch {
      toast.push({
        variant: "error",
        title: "Could not copy",
        description: "Clipboard access denied."
      });
    }
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2.5 py-1.5 text-[11px] text-[var(--pc-text-secondary)] transition-colors hover:bg-white/[0.04] hover:text-white"
      title="Copy a text summary of this device to the clipboard"
    >
      <ClipboardCopy className="h-3 w-3" />
      Copy summary
    </button>
  );
}
