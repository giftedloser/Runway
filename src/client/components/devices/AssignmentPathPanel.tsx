import { ArrowRight, Route } from "lucide-react";

import type { AssignmentPath } from "../../lib/types.js";
import { cn } from "../../lib/utils.js";
import { Card } from "../ui/card.js";

function PathNode({
  title,
  body,
  broken
}: {
  title: string;
  body: string[];
  broken?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-[180px] flex-1 rounded-lg border p-4",
        broken
          ? "border-[var(--pc-critical)]/30 bg-[var(--pc-critical-muted)]"
          : "border-[var(--pc-border)] bg-[var(--pc-surface-raised)]"
      )}
    >
      <div className="text-[11px] font-medium text-[var(--pc-text-muted)]">{title}</div>
      <div className="mt-2 space-y-1">
        {body.map((line) => (
          <div key={line} className="font-mono text-[12px] text-[var(--pc-text)]">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AssignmentPathPanel({ path }: { path: AssignmentPath }) {
  const primaryGroup = path.targetingGroups[0];
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Route className="h-4 w-4 text-[var(--pc-accent)]" />
        <span className="text-[13px] font-semibold text-white">Assignment Path</span>
      </div>
      <div className="flex flex-col gap-2 overflow-x-auto lg:flex-row lg:items-stretch">
        <PathNode
          title="Autopilot Record"
          broken={!path.autopilotRecord}
          body={
            path.autopilotRecord
              ? [
                  `SN: ${path.autopilotRecord.serial ?? "\u2014"}`,
                  `Tag: ${path.autopilotRecord.groupTag ?? "\u2014"}`,
                  `User: ${path.autopilotRecord.assignedUser ?? "\u2014"}`
                ]
              : ["No Autopilot record"]
          }
        />
        <div className="flex items-center justify-center text-[var(--pc-text-muted)] lg:px-1">
          <ArrowRight className="h-4 w-4" />
        </div>
        <PathNode
          title="Target Group"
          broken={path.breakPoint === "no_group"}
          body={
            primaryGroup
              ? [
                  primaryGroup.groupName,
                  primaryGroup.membershipType,
                  primaryGroup.membershipState === "member" ? "Member" : "Missing"
                ]
              : ["No targeting group"]
          }
        />
        <div className="flex items-center justify-center text-[var(--pc-text-muted)] lg:px-1">
          <ArrowRight className="h-4 w-4" />
        </div>
        <PathNode
          title="Profile"
          broken={path.breakPoint === "no_profile"}
          body={
            path.assignedProfile
              ? [
                  path.assignedProfile.profileName,
                  `Mode: ${path.assignedProfile.deploymentMode ?? "\u2014"}`,
                  `Via: ${path.assignedProfile.assignedViaGroup ?? "\u2014"}`
                ]
              : ["No effective profile"]
          }
        />
        <div className="flex items-center justify-center text-[var(--pc-text-muted)] lg:px-1">
          <ArrowRight className="h-4 w-4" />
        </div>
        <PathNode
          title="Effective Mode"
          broken={path.breakPoint === "no_mode"}
          body={[path.effectiveMode ?? "No effective mode"]}
        />
      </div>
    </Card>
  );
}
