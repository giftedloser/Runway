import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronRight,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
  UsersRound
} from "lucide-react";

import { PageHeader } from "../components/layout/PageHeader.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { SourceBadge } from "../components/shared/SourceBadge.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import { Card } from "../components/ui/card.js";
import { Input } from "../components/ui/input.js";
import type { HealthLevel } from "../lib/types.js";
import { useGroup, useGroups } from "../hooks/useGroups.js";

export function GroupInspectorPage() {
  const groups = useGroups();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const filteredGroups = (groups.data ?? []).filter((g) =>
    search ? g.groupName.toLowerCase().includes(search.toLowerCase()) : true
  );

  const effectiveSelectedId =
    selectedId ?? filteredGroups[0]?.groupId ?? groups.data?.[0]?.groupId;

  const groupDetail = useGroup(effectiveSelectedId);

  if (groups.isLoading) return <LoadingState label="Loading groups…" />;
  if (groups.isError) {
    return (
      <ErrorState
        title="Could not load groups"
        error={groups.error}
        onRetry={() => groups.refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inspect"
        title="Targeting Groups"
        description="Entra ID groups that drive Autopilot and Intune assignment. Inspect membership, dynamic rules, and which profiles each group resolves to."
        actions={<SourceBadge source="entra" />}
      />

      {(groups.data?.length ?? 0) === 0 ? (
        <Card className="p-5 text-[13px] text-[var(--pc-text-muted)]">
          No groups found. Run a sync to pull group membership from Graph.
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
          {/* Left: group list */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--pc-text-muted)]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search groups..."
                className="w-full pl-8"
              />
            </div>
            <Card className="max-h-[calc(100vh-260px)] overflow-auto">
              <div className="divide-y divide-[var(--pc-border)]">
                {filteredGroups.map((group) => {
                  const active = group.groupId === effectiveSelectedId;
                  return (
                    <button
                      key={group.groupId}
                      type="button"
                      onClick={() => setSelectedId(group.groupId)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
                        active
                          ? "bg-[var(--pc-accent-muted)]"
                          : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                          active
                            ? "bg-[var(--pc-accent)]/20 text-[var(--pc-accent-hover)]"
                            : "bg-[var(--pc-surface-raised)] text-[var(--pc-text-muted)]"
                        }`}
                      >
                        {group.membershipType === "dynamic" ? (
                          <Users className="h-3.5 w-3.5" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div
                          className={`truncate text-[12.5px] font-medium ${
                            active ? "text-white" : "text-[var(--pc-text)]"
                          }`}
                        >
                          {group.groupName}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-[var(--pc-text-muted)]">
                          <span>{group.memberCount} members</span>
                          <span>·</span>
                          <span>{group.assignedProfiles.length} profiles</span>
                          <span>·</span>
                          <span className="capitalize">{group.membershipType}</span>
                        </div>
                      </div>
                      <ChevronRight
                        className={`h-3.5 w-3.5 shrink-0 ${
                          active ? "text-[var(--pc-accent-hover)]" : "text-[var(--pc-text-muted)]"
                        }`}
                      />
                    </button>
                  );
                })}
                {filteredGroups.length === 0 ? (
                  <div className="px-4 py-6 text-center text-[12px] text-[var(--pc-text-muted)]">
                    No groups match your search.
                  </div>
                ) : null}
              </div>
            </Card>
          </div>

          {/* Right: group detail */}
          <div className="min-w-0">
            {groupDetail.isLoading || !groupDetail.data ? (
              <Card className="p-5">
                <LoadingState label="Loading group details…" />
              </Card>
            ) : (
              <div className="space-y-5">
                <Card className="p-5">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--pc-accent-muted)] text-[var(--pc-accent-hover)]">
                        <UsersRound className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-[14px] font-semibold text-white">
                          {groupDetail.data.groupName}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[var(--pc-text-muted)]">
                          <span className="rounded bg-[var(--pc-surface-raised)] px-1.5 py-0.5 font-mono">
                            {groupDetail.data.groupId.slice(0, 8)}
                          </span>
                          <span>·</span>
                          <span className="capitalize">{groupDetail.data.membershipType}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[20px] font-semibold text-white">
                        {groupDetail.data.memberCount}
                      </div>
                      <div className="text-[10px] uppercase tracking-wide text-[var(--pc-text-muted)]">
                        Members
                      </div>
                    </div>
                  </div>

                  {groupDetail.data.membershipRule ? (
                    <div className="rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-3 py-2.5">
                      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
                        Membership Rule
                      </div>
                      <pre className="overflow-x-auto font-mono text-[11.5px] leading-relaxed text-[var(--pc-text-secondary)]">
                        {groupDetail.data.membershipRule}
                      </pre>
                    </div>
                  ) : null}
                </Card>

                {/* Assigned profiles */}
                <Card className="p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[var(--pc-accent)]" />
                    <span className="text-[13px] font-semibold text-white">Assigned Profiles</span>
                    <span className="text-[11px] text-[var(--pc-text-muted)]">
                      ({groupDetail.data.assignedProfiles.length})
                    </span>
                  </div>
                  {groupDetail.data.assignedProfiles.length === 0 ? (
                    <div className="text-[12px] text-[var(--pc-text-muted)]">
                      No Autopilot profiles target this group.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {groupDetail.data.assignedProfiles.map((profile) => (
                        <div
                          key={profile.profileId}
                          className="flex items-center justify-between rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <ArrowRight className="h-3 w-3 text-[var(--pc-accent)]" />
                            <span className="text-[12.5px] font-medium text-white">
                              {profile.profileName}
                            </span>
                          </div>
                          {profile.deploymentMode ? (
                            <span className="rounded bg-[var(--pc-accent-muted)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--pc-accent-hover)]">
                              {profile.deploymentMode}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Members */}
                <Card className="overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-[var(--pc-border)] px-5 py-4">
                    <Users className="h-4 w-4 text-[var(--pc-accent)]" />
                    <span className="text-[13px] font-semibold text-white">Members</span>
                    <span className="text-[11px] text-[var(--pc-text-muted)]">
                      ({groupDetail.data.members.length})
                    </span>
                  </div>
                  {groupDetail.data.members.length === 0 ? (
                    <div className="px-5 py-6 text-center text-[12px] text-[var(--pc-text-muted)]">
                      No members in this group.
                    </div>
                  ) : (
                    <div className="max-h-[460px] overflow-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-[var(--pc-surface)]">
                          <tr className="text-[10px] uppercase tracking-wide text-[var(--pc-text-muted)]">
                            <th className="px-5 py-2 text-left font-medium">Device</th>
                            <th className="px-3 py-2 text-left font-medium">Serial</th>
                            <th className="px-3 py-2 text-left font-medium">Group Tag</th>
                            <th className="px-3 py-2 text-left font-medium">Profile</th>
                            <th className="px-3 py-2 text-left font-medium">Health</th>
                            <th className="px-3 py-2 text-right font-medium">Flags</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--pc-border)]">
                          {groupDetail.data.members.map((member) => (
                            <tr
                              key={member.deviceKey}
                              className="transition-colors hover:bg-white/[0.02]"
                            >
                              <td className="px-5 py-2.5 text-[12px]">
                                <Link
                                  to="/devices/$deviceKey"
                                  params={{ deviceKey: member.deviceKey }}
                                  className="font-medium text-white transition-colors hover:text-[var(--pc-accent-hover)]"
                                >
                                  {member.deviceName ?? "—"}
                                </Link>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-[11.5px] text-[var(--pc-text-secondary)]">
                                {member.serialNumber ?? "—"}
                              </td>
                              <td className="px-3 py-2.5 text-[11.5px] text-[var(--pc-text-secondary)]">
                                {member.groupTag ?? "—"}
                              </td>
                              <td className="px-3 py-2.5 text-[11.5px] text-[var(--pc-text-secondary)]">
                                {member.assignedProfileName ?? "—"}
                              </td>
                              <td className="px-3 py-2.5">
                                <StatusBadge health={member.health as HealthLevel} />
                              </td>
                              <td className="px-3 py-2.5 text-right text-[11.5px] font-mono text-[var(--pc-text-secondary)]">
                                {member.flagCount}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
