import {
  ArrowRight,
  Cable,
  CheckCircle2,
  CircleDashed,
  Fingerprint,
  Radio,
  Target,
  TabletSmartphone,
  XCircle
} from "lucide-react";

import { useTimestampFormatter } from "../../hooks/useTimestampFormatter.js";
import type { DeviceDetailResponse } from "../../lib/types.js";
import { getConfigMgrSignal } from "../../lib/config-mgr.js";
import { cn } from "../../lib/utils.js";
import { SourceBadge, type DataSource } from "../shared/SourceBadge.js";
import { Card } from "../ui/card.js";

type StageTone = "ok" | "broken" | "missing" | "warning" | "off";

interface JoinStage {
  label: string;
  source: DataSource;
  value: string;
  detail: string;
  tone: StageTone;
  icon: typeof Fingerprint;
}

function stageToneClass(tone: StageTone) {
  if (tone === "ok") {
    return "border-[var(--pc-healthy)]/35 bg-[var(--pc-healthy-muted)]";
  }
  if (tone === "broken") {
    return "border-[var(--pc-critical)]/45 bg-[var(--pc-critical-muted)]";
  }
  if (tone === "warning") {
    return "border-[var(--pc-warning)]/40 bg-[var(--pc-warning-muted)]";
  }
  if (tone === "off") {
    return "border-[var(--pc-border)] bg-[var(--pc-tint-subtle)] opacity-80";
  }
  return "border-[var(--pc-border)] border-dashed bg-[var(--pc-surface-raised)]";
}

function StageStatusIcon({ tone }: { tone: StageTone }) {
  if (tone === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-[var(--pc-healthy)]" />;
  if (tone === "broken") return <XCircle className="h-3.5 w-3.5 text-[var(--pc-critical)]" />;
  if (tone === "warning") return <XCircle className="h-3.5 w-3.5 text-[var(--pc-warning)]" />;
  return <CircleDashed className="h-3.5 w-3.5 text-[var(--pc-text-muted)]" />;
}

function buildStages(
  device: DeviceDetailResponse,
  showConfigMgrSignal: boolean,
  formatTimestamp: (value: string | null | undefined) => string
): JoinStage[] {
  const path = device.assignmentPath;
  const targetGroup = path.targetingGroups.find((group) => group.membershipState === "member");
  const missingTargetGroup = path.targetingGroups.find(
    (group) => group.membershipState === "missing"
  );
  const configMgrSignal = getConfigMgrSignal(device, showConfigMgrSignal);

  return [
    {
      label: "Autopilot",
      source: "autopilot",
      value: path.autopilotRecord ? "Record found" : "Missing record",
      detail: path.autopilotRecord?.groupTag
        ? `Group tag ${path.autopilotRecord.groupTag}`
        : "Hardware identity",
      tone: path.autopilotRecord ? "ok" : "broken",
      icon: Fingerprint
    },
    {
      label: "Target group",
      source: "entra",
      value: targetGroup
        ? targetGroup.groupName
        : missingTargetGroup
          ? `Missing ${missingTargetGroup.groupName}`
          : "No target group",
      detail: targetGroup
        ? `${targetGroup.membershipType} membership`
        : "Group membership drives profile assignment",
      tone: targetGroup ? "ok" : path.breakPoint === "no_group" ? "broken" : "missing",
      icon: Target
    },
    {
      label: "Profile",
      source: "intune",
      value: path.assignedProfile?.profileName ?? "No profile",
      detail: path.assignedProfile?.assignedViaGroup
        ? `Via ${path.assignedProfile.assignedViaGroup}`
        : "Autopilot deployment profile",
      tone: path.assignedProfile ? "ok" : path.breakPoint === "no_profile" ? "broken" : "missing",
      icon: TabletSmartphone
    },
    {
      label: "Entra",
      source: "entra",
      value: device.identity.entraId ? "Device object found" : "No Entra object",
      detail: device.identity.identityConflict
        ? "Identifier conflict"
        : `Correlation ${device.identity.matchConfidence}`,
      tone: device.identity.identityConflict
        ? "broken"
        : device.identity.entraId
          ? device.identity.matchConfidence === "low"
            ? "warning"
            : "ok"
          : "missing",
      icon: Fingerprint
    },
    {
      label: "Intune",
      source: "intune",
      value: device.identity.intuneId ? "Enrolled" : "Not enrolled",
      detail: device.summary.lastCheckinAt
        ? `Last check-in ${formatTimestamp(device.summary.lastCheckinAt)}`
        : "Managed-device record",
      tone: device.identity.intuneId ? "ok" : "broken",
      icon: Radio
    },
    {
      label: "SCCM",
      source: "sccm",
      value: configMgrSignal.label,
      detail: configMgrSignal.rawValue ?? configMgrSignal.detail,
      tone: configMgrSignal.status === "disabled"
        ? "off"
        : configMgrSignal.status === "no_intune_record" || configMgrSignal.status === "not_reported"
          ? "missing"
          : configMgrSignal.status === "detected"
            ? "ok"
            : "warning",
      icon: Cable
    }
  ];
}

export function JoinPicturePanel({
  device,
  showConfigMgrSignal
}: {
  device: DeviceDetailResponse;
  showConfigMgrSignal: boolean;
}) {
  const formatTimestamp = useTimestampFormatter();
  const stages = buildStages(device, showConfigMgrSignal, formatTimestamp);
  const firstProblem = stages.find((stage) => stage.tone === "broken" || stage.tone === "warning");

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-[var(--pc-accent)]" />
            <span className="text-[13px] font-semibold text-[var(--pc-text)]">Join Picture</span>
          </div>
          <p className="mt-1 text-[12px] text-[var(--pc-text-muted)]">
            The end-to-end path from hardware identity to management state.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium",
            firstProblem
              ? "bg-[var(--pc-warning-muted)] text-[var(--pc-warning)] ring-1 ring-[var(--pc-warning)]/35"
              : "bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)] ring-1 ring-[var(--pc-healthy)]/35"
          )}
        >
          {firstProblem ? `Check ${firstProblem.label}` : "Path looks complete"}
        </span>
      </div>

      <div className="flex flex-col gap-2 overflow-x-auto xl:flex-row xl:items-stretch">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <div key={stage.label} className="flex min-w-[178px] flex-1 items-stretch gap-2">
              <div className={cn("flex flex-1 flex-col rounded-lg border p-3", stageToneClass(stage.tone))}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <StageStatusIcon tone={stage.tone} />
                    <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
                      {stage.label}
                    </span>
                  </div>
                  <SourceBadge source={stage.source} size="xs" />
                </div>
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--pc-text-muted)]" />
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-semibold text-[var(--pc-text)]" title={stage.value}>
                      {stage.value}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-[var(--pc-text-muted)]" title={stage.detail}>
                      {stage.detail}
                    </div>
                  </div>
                </div>
              </div>
              {index < stages.length - 1 ? (
                <div className="hidden items-center text-[var(--pc-text-muted)] xl:flex">
                  <ArrowRight className="h-4 w-4" />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
