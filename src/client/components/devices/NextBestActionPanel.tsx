import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Fingerprint,
  ShieldCheck
} from "lucide-react";

import type { DeviceDetailResponse, FlagCode } from "../../lib/types.js";
import { cn } from "../../lib/utils.js";
import { useToast } from "../shared/toast.js";
import { Card } from "../ui/card.js";
import { buildSummaryText } from "./CopySummaryButton.js";

interface Recommendation {
  title: string;
  action: string;
  verify: string;
  wait: string;
  tone: "critical" | "warning" | "info" | "healthy";
  icon: typeof AlertTriangle;
}

const recommendations: Partial<Record<FlagCode, Recommendation>> = {
  identity_conflict: {
    title: "Verify the device identity before acting",
    action: "Compare serial, Entra object ID, Intune ID, and Autopilot record. Remove stale duplicates before trusting other flags.",
    verify: "Run a fresh sync and confirm correlation confidence is no longer low or conflicted.",
    wait: "Usually immediate after stale records are removed.",
    tone: "critical",
    icon: Fingerprint
  },
  no_autopilot_record: {
    title: "Confirm whether Autopilot is expected",
    action: "This device is managed in Intune but is not registered in Autopilot. No repair is needed unless this device should follow an Autopilot provisioning path.",
    verify: "If Autopilot is expected, import or repair the hardware record and confirm it appears after sync.",
    wait: "Allow 15-30 minutes for Graph and Autopilot propagation.",
    tone: "info",
    icon: Fingerprint
  },
  no_profile_assigned: {
    title: "Fix profile targeting",
    action: "Put the device in the group targeted by the intended Autopilot deployment profile.",
    verify: "The profile stage should show the expected profile name after dynamic group evaluation.",
    wait: "Dynamic groups commonly take up to 30 minutes.",
    tone: "critical",
    icon: ShieldCheck
  },
  not_in_target_group: {
    title: "Correct group membership",
    action: "Check the group tag and the Entra dynamic membership rule, then add or retag the device.",
    verify: "Target group should show member, and the assigned profile should resolve.",
    wait: "Dynamic group evaluation can take up to 30 minutes.",
    tone: "warning",
    icon: ShieldCheck
  },
  tag_mismatch: {
    title: "Align the group tag with the intended profile",
    action: "Update the Autopilot group tag or Runway tag mapping so the expected group/profile matches reality.",
    verify: "Runway should stop showing tag mismatch after the next sync.",
    wait: "Expect group/profile propagation before the flag clears.",
    tone: "warning",
    icon: ShieldCheck
  },
  profile_assignment_failed: {
    title: "Investigate profile assignment failure",
    action: "Check for conflicting deployment profiles and profile assignment status in Intune.",
    verify: "Assignment status should become assigned and the profile stage should turn healthy.",
    wait: "Retry after profile or group changes propagate.",
    tone: "critical",
    icon: AlertTriangle
  },
  profile_assigned_not_enrolled: {
    title: "Validate OOBE and network path",
    action: "Confirm the device is online at OOBE and can reach Microsoft enrollment endpoints.",
    verify: "An Intune managed-device record should appear after enrollment completes.",
    wait: "If already at OOBE, this should move during the next enrollment attempt.",
    tone: "critical",
    icon: Clock
  },
  provisioning_stalled: {
    title: "Check the last Intune check-in and ESP blocker",
    action: "Trigger a sync, then inspect ESP/app install status if the device remains stale.",
    verify: "Last check-in updates and the stalled flag clears.",
    wait: "Give the sync a few minutes; ESP app failures may need manual repair.",
    tone: "critical",
    icon: Clock
  },
  hybrid_join_risk: {
    title: "Verify hybrid join prerequisites",
    action: "Check Intune Connector for AD health, OU permissions, and line-of-sight to a domain controller.",
    verify: "Trust type should match the intended hybrid join path after enrollment.",
    wait: "Connector or OU fixes may require a fresh Autopilot attempt.",
    tone: "critical",
    icon: AlertTriangle
  },
  user_mismatch: {
    title: "Confirm the intended primary user",
    action: "Update Autopilot assigned user, Intune primary user, or clear primary user for shared devices.",
    verify: "Assigned user and primary user should match the device ownership model.",
    wait: "Usually visible after the next sync.",
    tone: "warning",
    icon: ShieldCheck
  },
  compliance_drift: {
    title: "Open the failing compliance policy",
    action: "Check which compliance policy moved the device from compliant to noncompliant.",
    verify: "Compliance state returns to compliant or the failing policy is accepted as expected.",
    wait: "Depends on the policy remediation cycle.",
    tone: "warning",
    icon: AlertTriangle
  },
  orphaned_autopilot: {
    title: "Decide whether this record is staged or stale",
    action: "An Autopilot record exists without a matching Intune enrollment. That can be normal for staged hardware; clean it up only if the device was retired or reimaged.",
    verify: "Either an Intune record appears or the orphaned Autopilot record is removed.",
    wait: "Immediate after cleanup, or after enrollment completes.",
    tone: "info",
    icon: Fingerprint
  },
  missing_ztdid: {
    title: "Check Autopilot coverage only if expected",
    action: "Missing ZTDID is an Autopilot coverage signal, not a device health failure by itself. Investigate when this machine is supposed to provision through Autopilot.",
    verify: "The Entra physical IDs should include a ZTDID marker.",
    wait: "Usually requires re-import/reset if the device bypassed Autopilot.",
    tone: "info",
    icon: Fingerprint
  },
  deployment_mode_mismatch: {
    title: "Remove conflicting deployment intent",
    action: "Review group memberships and make sure only the intended user-driven or self-deploying profile applies.",
    verify: "The effective mode should match the intended profile.",
    wait: "Allow profile targeting to refresh after membership changes.",
    tone: "warning",
    icon: ShieldCheck
  }
};

function buildRecommendation(device: DeviceDetailResponse): Recommendation {
  if (device.identity.identityConflict || device.identity.matchConfidence === "low") {
    return recommendations.identity_conflict!;
  }

  const firstFlag = device.diagnostics[0]?.code;
  if (firstFlag && recommendations[firstFlag]) {
    return recommendations[firstFlag]!;
  }

  if (device.summary.health === "healthy") {
    return {
      title: "No repair needed",
      action: "Keep monitoring. The join path is complete and no active provisioning flags are present.",
      verify: "Healthy rate should stay stable after the next sync.",
      wait: "No wait required.",
      tone: "healthy",
      icon: CheckCircle2
    };
  }

  return {
    title: "Start with the first critical diagnostic",
    action: "Open the diagnostics below and work from the highest severity item first.",
    verify: "Run a sync after each fix and watch the Device path update.",
    wait: "Depends on the Microsoft service propagation path involved.",
    tone: "info",
    icon: ArrowRight
  };
}

function toneClass(tone: Recommendation["tone"]) {
  if (tone === "critical") {
    return "border-[var(--pc-critical)]/40 bg-[var(--pc-critical-muted)]";
  }
  if (tone === "warning") {
    return "border-[var(--pc-warning)]/40 bg-[var(--pc-warning-muted)]";
  }
  if (tone === "healthy") {
    return "border-[var(--pc-healthy)]/35 bg-[var(--pc-healthy-muted)]";
  }
  return "border-[var(--pc-info)]/35 bg-[var(--pc-info-muted)]";
}

function iconClass(tone: Recommendation["tone"]) {
  if (tone === "critical") return "text-[var(--pc-critical)]";
  if (tone === "warning") return "text-[var(--pc-warning)]";
  if (tone === "healthy") return "text-[var(--pc-healthy)]";
  return "text-[var(--pc-info)]";
}

export function NextBestActionPanel({ device }: { device: DeviceDetailResponse }) {
  const recommendation = buildRecommendation(device);
  const Icon = recommendation.icon;
  const toast = useToast();

  const copyTicketSummary = async () => {
    try {
      await navigator.clipboard.writeText(
        `${buildSummaryText(device)}\n\nNext best action: ${recommendation.title}\n${recommendation.action}\nVerify: ${recommendation.verify}`
      );
      toast.push({
        variant: "success",
        title: "Ticket summary copied",
        description: "Diagnosis, evidence, and next action copied.",
        durationMs: 2200
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
    <Card className={cn("border p-4", toneClass(recommendation.tone))}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--pc-radius-sm)] bg-[var(--pc-surface)]/60">
            <Icon className={cn("h-4 w-4", iconClass(recommendation.tone))} />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
              Next Best Action
            </div>
            <h2 className="mt-0.5 text-[15px] font-semibold text-[var(--pc-text)]">
              {recommendation.title}
            </h2>
            <p className="mt-1 max-w-3xl text-[12.5px] leading-snug text-[var(--pc-text-secondary)]">
              {recommendation.action}
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <div className="rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface)]/45 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
                  Verify
                </div>
                <div className="mt-1 line-clamp-1 text-[12px] text-[var(--pc-text-secondary)]">
                  {recommendation.verify}
                </div>
              </div>
              <div className="rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface)]/45 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
                  Expected wait
                </div>
                <div className="mt-1 line-clamp-1 text-[12px] text-[var(--pc-text-secondary)]">
                  {recommendation.wait}
                </div>
              </div>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={copyTicketSummary}
          className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface)]/70 px-3 py-2 text-[12px] font-semibold text-[var(--pc-text-secondary)] transition-[border-color,background-color,color] hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-surface)] hover:text-[var(--pc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
        >
          <ClipboardCopy className="h-3.5 w-3.5" />
          Copy ticket summary
        </button>
      </div>
    </Card>
  );
}
