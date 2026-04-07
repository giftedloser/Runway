import { ArrowRight, CheckCircle2, Route, XCircle } from "lucide-react";

import type { AssignmentPath } from "../../lib/types.js";
import { cn } from "../../lib/utils.js";
import { Card } from "../ui/card.js";
import { SourceBadge, type DataSource } from "../shared/SourceBadge.js";

interface PathStageProps {
  title: string;
  source: DataSource;
  body: Array<{ label: string; value: string | null }>;
  state: "ok" | "broken" | "missing";
  emptyText?: string;
}

function PathStage({ title, source, body, state, emptyText }: PathStageProps) {
  const broken = state === "broken";
  const missing = state === "missing";
  return (
    <div
      className={cn(
        "min-w-[200px] flex-1 rounded-lg border p-3.5",
        broken
          ? "border-[var(--pc-critical)]/40 bg-[var(--pc-critical-muted)]"
          : missing
            ? "border-[var(--pc-border)] border-dashed bg-[var(--pc-surface-raised)]"
            : "border-[var(--pc-border)] bg-[var(--pc-surface-raised)]"
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {state === "ok" ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--pc-healthy)]" />
          ) : (
            <XCircle className="h-3.5 w-3.5 text-[var(--pc-critical)]" />
          )}
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
            {title}
          </span>
        </div>
        <SourceBadge source={source} size="xs" />
      </div>
      {missing ? (
        <div className="text-[12px] italic text-[var(--pc-text-muted)]">{emptyText ?? "—"}</div>
      ) : (
        <dl className="space-y-1">
          {body.map((row) => (
            <div key={row.label}>
              <dt className="text-[10px] uppercase tracking-wide text-[var(--pc-text-muted)]">
                {row.label}
              </dt>
              <dd
                className="font-mono text-[11.5px] leading-snug text-[var(--pc-text)] break-all"
                title={row.value ?? undefined}
              >
                {row.value ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export function AssignmentPathPanel({ path }: { path: AssignmentPath }) {
  const recordState: PathStageProps["state"] = path.autopilotRecord ? "ok" : "broken";
  const groupState: PathStageProps["state"] =
    path.targetingGroups.length === 0
      ? path.breakPoint === "no_group"
        ? "broken"
        : "missing"
      : "ok";
  const profileState: PathStageProps["state"] = path.assignedProfile
    ? "ok"
    : path.breakPoint === "no_profile"
      ? "broken"
      : "missing";
  const modeState: PathStageProps["state"] = path.effectiveMode
    ? "ok"
    : path.breakPoint === "no_mode"
      ? "broken"
      : "missing";

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-[var(--pc-accent)]" />
          <span className="text-[13px] font-semibold text-white">Provisioning Chain</span>
          <span className="text-[11.5px] text-[var(--pc-text-muted)]">
            · Where this device gets its expected state
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px]">
          {path.chainComplete ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--pc-healthy-muted)] px-2 py-0.5 text-emerald-200 ring-1 ring-[var(--pc-healthy)]/40">
              <CheckCircle2 className="h-3 w-3" />
              Chain complete
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--pc-critical-muted)] px-2 py-0.5 text-red-200 ring-1 ring-[var(--pc-critical)]/40">
              <XCircle className="h-3 w-3" />
              Chain broken
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 overflow-x-auto lg:flex-row lg:items-stretch">
        <PathStage
          title="Hardware Record"
          source="autopilot"
          state={recordState}
          emptyText="No Autopilot record"
          body={
            path.autopilotRecord
              ? [
                  { label: "Serial", value: path.autopilotRecord.serial },
                  { label: "Group Tag", value: path.autopilotRecord.groupTag },
                  { label: "Assigned User", value: path.autopilotRecord.assignedUser }
                ]
              : []
          }
        />
        <Connector />

        <PathStage
          title="Target Groups"
          source="entra"
          state={groupState}
          emptyText="No targeting groups"
          body={
            path.targetingGroups.length > 0
              ? [
                  {
                    label: `${path.targetingGroups.length} group${path.targetingGroups.length === 1 ? "" : "s"}`,
                    value: path.targetingGroups
                      .slice(0, 3)
                      .map((group) => group.groupName)
                      .join(", ") +
                      (path.targetingGroups.length > 3
                        ? ` +${path.targetingGroups.length - 3} more`
                        : "")
                  },
                  {
                    label: "Membership",
                    value: path.targetingGroups
                      .map((group) => `${group.membershipType} (${group.membershipState})`)
                      .join(", ")
                  }
                ]
              : []
          }
        />
        <Connector />

        <PathStage
          title="Profile"
          source="intune"
          state={profileState}
          emptyText="No effective profile"
          body={
            path.assignedProfile
              ? [
                  { label: "Name", value: path.assignedProfile.profileName },
                  { label: "Mode", value: path.assignedProfile.deploymentMode },
                  { label: "Via Group", value: path.assignedProfile.assignedViaGroup }
                ]
              : []
          }
        />
        <Connector />

        <PathStage
          title="Effective Mode"
          source="derived"
          state={modeState}
          emptyText="No effective mode"
          body={path.effectiveMode ? [{ label: "Resolves to", value: path.effectiveMode }] : []}
        />
      </div>

      {path.targetingGroups.length > 1 ? (
        <div className="mt-4 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] p-3">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
            Targeting groups ({path.targetingGroups.length})
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {path.targetingGroups.map((group) => (
              <li
                key={group.groupId}
                className="flex items-center justify-between gap-2 rounded-md bg-white/[0.03] px-2.5 py-1.5 text-[11.5px]"
              >
                <span className="truncate text-[var(--pc-text)]" title={group.groupName}>
                  {group.groupName}
                </span>
                <span className="flex shrink-0 items-center gap-1.5 text-[10.5px] text-[var(--pc-text-muted)]">
                  <span className="capitalize">{group.membershipType}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5",
                      group.membershipState === "member"
                        ? "bg-[var(--pc-healthy-muted)] text-emerald-200"
                        : "bg-[var(--pc-critical-muted)] text-red-200"
                    )}
                  >
                    {group.membershipState}
                  </span>
                  {group.isProfileSource ? (
                    <span className="rounded bg-[var(--pc-accent-muted)] px-1.5 py-0.5 text-[var(--pc-accent-hover)]">
                      profile source
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function Connector() {
  return (
    <div className="flex items-center justify-center text-[var(--pc-text-muted)] lg:px-1">
      <ArrowRight className="h-4 w-4" />
    </div>
  );
}
