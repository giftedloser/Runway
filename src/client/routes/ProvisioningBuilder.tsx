import { useState } from "react";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  ClipboardCopy,
  Copy,
  FileCheck2,
  GitBranch,
  Loader2,
  Package,
  Rows3,
  Search,
  ShieldCheck,
  Settings2,
  StretchHorizontal,
  Tag,
  TabletSmartphone,
  Users,
} from "lucide-react";

import { PageHeader } from "../components/layout/PageHeader.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { SourceBadge } from "../components/shared/SourceBadge.js";
import { StatusBadge } from "../components/shared/StatusBadge.js";
import { useToast } from "../components/shared/toast.js";
import { Button } from "../components/ui/button.js";
import { Card } from "../components/ui/card.js";
import { Input } from "../components/ui/input.js";
import { apiRequest } from "../lib/api.js";
import type { HealthLevel } from "../lib/types.js";
import { cn } from "../lib/utils.js";
import { HardwareHashImport } from "../components/provisioning/HardwareHashImport.js";
import {
  ChipList,
  CompareRow,
  CountPill,
  EmptyPanel,
  IconButton,
  IssueList,
  MetricCard,
  ResultBanner,
  SelectionBadge,
  SelectionSummary,
  StatusRow,
  SummaryBlock,
  formatDeploymentMode,
  formatMembershipType,
} from "../components/provisioning/helpers.js";
import type {
  BuildPayloadGroup,
  BuildPayloadItem,
  DiscoverResult,
  ProvisioningTagDevice,
  ValidateResult,
} from "../components/provisioning/types.js";

export function ProvisioningBuilderPage() {
  const toast = useToast();
  const routeSearch = useSearch({ from: "/provisioning" });
  const navigate = useNavigate({ from: "/provisioning" });
  const initialGroupTag = routeSearch.groupTag?.trim() ?? "";
  const [groupTag, setGroupTag] = useState(initialGroupTag);
  const [searchTag, setSearchTag] = useState(initialGroupTag);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
    null,
  );
  const [compact, setCompact] = useState(false);

  const discover = useQuery({
    queryKey: ["provisioning-discover", searchTag],
    queryFn: () =>
      apiRequest<DiscoverResult>(
        `/api/provisioning/discover?groupTag=${encodeURIComponent(searchTag)}`,
      ),
    enabled: searchTag.length > 0,
  });

  const tagDevices = useQuery({
    queryKey: ["provisioning-tag-devices", searchTag],
    queryFn: () =>
      apiRequest<ProvisioningTagDevice[]>(
        `/api/provisioning/tag-devices?groupTag=${encodeURIComponent(searchTag)}`,
      ),
    enabled: searchTag.length > 0,
  });

  const validate = useMutation({
    mutationFn: (payload: {
      groupTag: string;
      groupId: string | null;
      profileId: string | null;
    }) =>
      apiRequest<ValidateResult>("/api/provisioning/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
  });

  const handleDiscover = () => {
    const nextTag = groupTag.trim();
    if (nextTag) {
      void navigate({ search: () => ({ groupTag: nextTag }) });
      setSearchTag(nextTag);
      setSelectedGroupId(null);
      setSelectedProfileId(null);
      validate.reset();
    }
  };

  const handleValidate = () => {
    validate.mutate({
      groupTag: searchTag,
      groupId: selectedGroupId,
      profileId: selectedProfileId,
    });
  };

  const data = discover.data;
  const selectedGroup =
    data?.matchingGroups.find((group) => group.groupId === selectedGroupId) ??
    null;
  const selectedProfile =
    data?.matchingProfiles.find(
      (profile) => profile.profileId === selectedProfileId,
    ) ?? null;
  const selectedProfileViaGroup =
    selectedProfile &&
    data?.matchingGroups.find(
      (group) => group.groupId === selectedProfile.viaGroupId,
    );
  const selectedPayload =
    selectedGroupId && data
      ? (data.buildPayloadByGroupId[selectedGroupId] ?? null)
      : null;
  const expectedGroups = data?.existingConfig?.expectedGroupNames ?? [];
  const expectedProfiles = data?.existingConfig?.expectedProfileNames ?? [];
  const isSelectedGroupExpected = selectedGroup
    ? expectedGroups.includes(selectedGroup.groupName)
    : null;
  const isSelectedProfileExpected = selectedProfile
    ? expectedProfiles.includes(selectedProfile.profileName)
    : null;

  const handleCopy = async (
    label: string,
    value: string | null | undefined,
  ) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      toast.push({
        variant: "success",
        title: `${label} copied`,
        description: `${label} copied to clipboard for ticketing or chat.`,
      });
    } catch {
      toast.push({
        variant: "error",
        title: "Copy failed",
        description: `Could not copy ${label.toLowerCase()} to clipboard.`,
      });
    }
  };

  const handleExportSummary = async () => {
    const lines = [
      `Runway Provisioning Review — ${new Date().toLocaleString()}`,
      `${"â”€".repeat(56)}`,
      `Group Tag:          ${data?.groupTag ?? "Not loaded"}`,
      `Devices with tag:   ${data?.deviceCount ?? "—"}`,
      ``,
      `Selected Group:     ${selectedGroup?.groupName ?? "None"}`,
      `  Membership type:  ${selectedGroup ? formatMembershipType(selectedGroup.membershipType) : "—"}`,
      `  Group ID:         ${selectedGroup?.groupId ?? "—"}`,
      ``,
      `Selected Profile:   ${selectedProfile?.profileName ?? "None"}`,
      `  Deployment mode:  ${selectedProfile ? formatDeploymentMode(selectedProfile.deploymentMode) : "—"}`,
      `  Profile ID:       ${selectedProfile?.profileId ?? "—"}`,
      `  Assigned via:     ${selectedProfileViaGroup?.groupName ?? selectedProfile?.viaGroupId ?? "—"}`,
      ``,
    ];
    if (validate.data) {
      lines.push(
        `Validation:         ${validate.data.valid ? "PASS" : "FAIL"}`,
      );
      for (const e of validate.data.errors) lines.push(`  ERROR: ${e}`);
      for (const w of validate.data.warnings) lines.push(`  WARN:  ${w}`);
    } else {
      lines.push(`Validation:         Not run`);
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.push({
        variant: "success",
        title: "Summary copied",
        description: "Paste into a ticket or change request.",
      });
    } catch {
      toast.push({
        variant: "error",
        title: "Copy failed",
        description: "Could not write to clipboard.",
      });
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inspect"
        title="Provisioning Builder"
        description="Trace a group tag through targeting and profile assignment."
        actions={
          <>
            <SourceBadge source="autopilot" />
            <SourceBadge source="entra" />
            <SourceBadge source="derived" />
            {data ? (
              <button
                type="button"
                onClick={() => setCompact((p) => !p)}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--pc-text-secondary)] transition-colors hover:border-[var(--pc-border-hover)] hover:text-[var(--pc-text)]"
                title={
                  compact
                    ? "Switch to comfortable view"
                    : "Switch to compact view"
                }
              >
                {compact ? (
                  <StretchHorizontal className="h-3 w-3" />
                ) : (
                  <Rows3 className="h-3 w-3" />
                )}
                {compact ? "Comfortable" : "Compact"}
              </button>
            ) : null}
            {data ? (
              <button
                type="button"
                onClick={() => void handleExportSummary()}
                className="inline-flex items-center gap-1.5 rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--pc-text-secondary)] transition-colors hover:border-[var(--pc-border-hover)] hover:text-[var(--pc-text)]"
                title="Copy operator summary to clipboard"
              >
                <ClipboardCopy className="h-3 w-3" />
                Export Summary
              </button>
            ) : null}
          </>
        }
      />

      <div
        className={cn(
          "grid gap-5",
          data ? "2xl:grid-cols-[minmax(0,1.65fr)_360px]" : "",
        )}
      >
        <div className="space-y-5">
          <Card className="overflow-hidden border-[var(--pc-border-hover)]">
            <div className="border-b border-[var(--pc-border)] bg-[var(--pc-surface)] px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Workflow
                  </div>
                  <div className="text-[15px] font-semibold tracking-tight text-[var(--pc-text)]">
                    Discover tag path
                  </div>
                  <div className="mt-1 text-[12px] text-[var(--pc-text-muted)]">
                    Search, select targets, then validate the chain.
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
                  <Tag className="h-3.5 w-3.5" />
                  Tag Search
                </div>
                <div className="mb-2 pc-helper-text">
                  Enter the exact Autopilot group tag from the device record.
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--pc-text-muted)]" />
                    <Input
                      value={groupTag}
                      onChange={(event) => setGroupTag(event.target.value)}
                      onKeyDown={(event) =>
                        event.key === "Enter" && handleDiscover()
                      }
                      placeholder="Enter group tag, for example North, South, or Kiosk"
                      className="h-10 pl-8"
                    />
                  </div>
                  <Button
                    onClick={handleDiscover}
                    disabled={!groupTag.trim() || discover.isFetching}
                    className="h-10 min-w-[132px]"
                  >
                    {discover.isFetching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    Discover
                  </Button>
                </div>
              </div>

              <div className="rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface-raised)]/65 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
                      Search Context
                    </div>
                    <div className="mt-1 text-[16px] font-semibold text-[var(--pc-text)]">
                      {searchTag || "No tag loaded"}
                    </div>
                  </div>
                  {searchTag ? (
                    <IconButton
                      label="Copy tag"
                      onClick={() => void handleCopy("Group tag", searchTag)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </IconButton>
                  ) : null}
                </div>
                <div className="mt-1 text-[12px] text-[var(--pc-text-muted)]">
                  {searchTag
                    ? "Active discovery context."
                    : "Load a tag to populate candidates."}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard
              label="Devices With Tag"
              value={data ? String(data.deviceCount) : "—"}
              tone="neutral"
              hint="Devices carrying the searched tag."
            />
            <MetricCard
              label="Matching Groups"
              value={data ? String(data.matchingGroups.length) : "—"}
              tone={
                data && data.matchingGroups.length > 0 ? "healthy" : "warning"
              }
              hint="Discovered Entra groups referencing the tag."
            />
            <MetricCard
              label="Matching Profiles"
              value={data ? String(data.matchingProfiles.length) : "—"}
              tone={
                data && data.matchingProfiles.length > 0 ? "healthy" : "warning"
              }
              hint="Deployment profiles assigned through those groups."
            />
          </div>

          {data &&
          data.deviceCount === 0 &&
          data.matchingGroups.length === 0 ? (
            <Card className="border-dashed px-5 py-6 text-center">
              <div className="text-[13px] font-semibold text-[var(--pc-text-secondary)]">
                No devices or groups match this tag
              </div>
              <div className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-[var(--pc-text-muted)]">
                Check the tag spelling matches your Autopilot hardware order ID.
                If the tag is new, devices may not have synced yet — run a sync
                from the Sync page and try again.
              </div>
            </Card>
          ) : null}

          {discover.isError ? (
            <ErrorState
              title="Discovery failed"
              error={discover.error}
              onRetry={() => discover.refetch()}
            />
          ) : null}

          {discover.isFetching && !data ? (
            <Card className="p-5">
              <LoadingState label="Discovering provisioning targets…" />
            </Card>
          ) : null}

          {data ? (
            <>
              {data.existingConfig ? (
                <Card className="overflow-hidden">
                  <div className="border-b border-[var(--pc-border)] px-5 py-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[var(--pc-info)]" />
                      <div className="text-[13px] font-semibold text-[var(--pc-text)]">
                        Existing Configuration Reference
                      </div>
                    </div>
                    <div className="mt-1 text-[12px] text-[var(--pc-text-secondary)]">
                      Stored expectations from `tag_config` for this operational
                      tag.
                    </div>
                  </div>
                  <div className="grid gap-4 px-5 py-5 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
                    <SummaryBlock
                      label="Property"
                      value={data.existingConfig.propertyLabel}
                      hint={`Tag ${data.existingConfig.groupTag}`}
                    />
                    <ChipList
                      title="Expected Groups"
                      items={data.existingConfig.expectedGroupNames}
                      emptyLabel="No expected groups configured."
                    />
                    <ChipList
                      title="Expected Profiles"
                      items={data.existingConfig.expectedProfileNames}
                      emptyLabel="No expected profiles configured."
                    />
                  </div>
                </Card>
              ) : null}

              <div className="grid gap-5 2xl:grid-cols-2">
                <Card className="overflow-hidden">
                  <div className="border-b border-[var(--pc-border)] px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-[var(--pc-accent)]" />
                          <div className="text-[13px] font-semibold text-[var(--pc-text)]">
                            Target Groups
                          </div>
                        </div>
                        <div className="mt-1 text-[12px] text-[var(--pc-text-secondary)]">
                          Review the group that should receive devices carrying
                          this tag.
                        </div>
                      </div>
                      <CountPill
                        value={data.matchingGroups.length}
                        label="found"
                      />
                    </div>
                  </div>

                  {data.matchingGroups.length === 0 ? (
                    <EmptyPanel
                      message={`No groups found referencing "${data.groupTag}".`}
                      guidance="Check that an Entra group exists with a dynamic membership rule containing this tag value, or that a group display name includes the tag string."
                    />
                  ) : (
                    <div className="max-h-[520px] space-y-2 overflow-auto px-3 py-3">
                      <div className="sticky top-0 z-10 -mx-3 -mt-3 mb-2 border-b border-[var(--pc-border)] bg-[var(--pc-surface)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
                        {data.matchingGroups.length} group
                        {data.matchingGroups.length !== 1 ? "s" : ""} — click to
                        select
                      </div>
                      {data.matchingGroups.map((group) => (
                        <button
                          key={group.groupId}
                          type="button"
                          onClick={() =>
                            setSelectedGroupId(
                              group.groupId === selectedGroupId
                                ? null
                                : group.groupId,
                            )
                          }
                          className={cn(
                            "w-full rounded-xl border text-left transition-colors",
                            compact ? "px-3 py-2" : "px-4 py-3",
                            selectedGroupId === group.groupId
                              ? "border-[var(--pc-accent)] bg-[var(--pc-accent-muted)]"
                              : "border-[var(--pc-border)] bg-[var(--pc-surface-raised)]/55 hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-surface-raised)]",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div
                                className={cn(
                                  "font-medium text-[var(--pc-text)]",
                                  compact ? "text-[12px]" : "text-[13px]",
                                )}
                              >
                                {group.groupName}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] uppercase tracking-wide text-[var(--pc-text-muted)]">
                                <span>
                                  {formatMembershipType(group.membershipType)}
                                </span>
                                <span>•</span>
                                <span>
                                  {selectedGroupId === group.groupId
                                    ? "Selected"
                                    : "Available"}
                                </span>
                                {expectedGroups.includes(group.groupName) ? (
                                  <>
                                    <span>•</span>
                                    <span className="text-[var(--pc-healthy)]">
                                      Expected
                                    </span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                            <SelectionBadge
                              active={selectedGroupId === group.groupId}
                            />
                          </div>
                          {!compact && (
                            <div className="mt-3 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-3 py-2">
                              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
                                Membership Rule
                              </div>
                              <div className="font-mono text-[11px] leading-relaxed text-[var(--pc-text-secondary)]">
                                {group.membershipRule ??
                                  "No dynamic rule stored for this group."}
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="overflow-hidden">
                  <div className="border-b border-[var(--pc-border)] px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4 text-[var(--pc-accent)]" />
                          <div className="text-[13px] font-semibold text-[var(--pc-text)]">
                            Deployment Profiles
                          </div>
                        </div>
                        <div className="mt-1 text-[12px] text-[var(--pc-text-secondary)]">
                          Confirm which profile is reachable from the discovered
                          group path.
                        </div>
                      </div>
                      <CountPill
                        value={data.matchingProfiles.length}
                        label="found"
                      />
                    </div>
                  </div>

                  {data.matchingProfiles.length === 0 ? (
                    <EmptyPanel
                      message="No deployment profiles are assigned to the discovered groups."
                      guidance={
                        data.matchingGroups.length > 0
                          ? "Groups were found, but none have an Autopilot deployment profile assigned. Assign a profile to one of the discovered groups in the Intune portal."
                          : "Discover matching groups first — profiles are found through group→profile assignments."
                      }
                    />
                  ) : (
                    <div className="max-h-[520px] space-y-2 overflow-auto px-3 py-3">
                      <div className="sticky top-0 z-10 -mx-3 -mt-3 mb-2 border-b border-[var(--pc-border)] bg-[var(--pc-surface)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
                        {data.matchingProfiles.length} profile
                        {data.matchingProfiles.length !== 1 ? "s" : ""} — click
                        to select
                      </div>
                      {data.matchingProfiles.map((profile) => {
                        const viaGroup =
                          data.matchingGroups.find(
                            (group) => group.groupId === profile.viaGroupId,
                          )?.groupName ?? profile.viaGroupId;

                        return (
                          <button
                            key={`${profile.profileId}-${profile.viaGroupId}`}
                            type="button"
                            onClick={() =>
                              setSelectedProfileId(
                                profile.profileId === selectedProfileId
                                  ? null
                                  : profile.profileId,
                              )
                            }
                            className={cn(
                              "w-full rounded-xl border text-left transition-colors",
                              compact ? "px-3 py-2" : "px-4 py-3",
                              selectedProfileId === profile.profileId
                                ? "border-[var(--pc-accent)] bg-[var(--pc-accent-muted)]"
                                : "border-[var(--pc-border)] bg-[var(--pc-surface-raised)]/55 hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-surface-raised)]",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div
                                  className={cn(
                                    "font-medium text-[var(--pc-text)]",
                                    compact ? "text-[12px]" : "text-[13px]",
                                  )}
                                >
                                  {profile.profileName}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[var(--pc-text-secondary)]">
                                  <span>
                                    Assigned via{" "}
                                    <span className="text-[var(--pc-text)]">
                                      {viaGroup}
                                    </span>
                                  </span>
                                  {expectedProfiles.includes(
                                    profile.profileName,
                                  ) ? (
                                    <span className="rounded-full bg-[var(--pc-healthy-muted)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--pc-healthy)]">
                                      Expected
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {profile.deploymentMode ? (
                                  <span className="rounded-md bg-[var(--pc-tint-hover)] px-2 py-1 text-[10.5px] font-medium text-[var(--pc-text-secondary)]">
                                    {formatDeploymentMode(
                                      profile.deploymentMode,
                                    )}
                                  </span>
                                ) : null}
                                <SelectionBadge
                                  active={
                                    selectedProfileId === profile.profileId
                                  }
                                />
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>

              <BuildPayloadPanel
                payload={selectedPayload}
                selectedGroupName={selectedGroup?.groupName ?? null}
              />

              <TagDevicesPanel
                groupTag={data.groupTag}
                devices={tagDevices.data ?? []}
                isLoading={tagDevices.isLoading}
                isError={tagDevices.isError}
                error={tagDevices.error}
                onRetry={() => tagDevices.refetch()}
              />
            </>
          ) : null}
        </div>

        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="border-b border-[var(--pc-border)] px-5 py-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[var(--pc-accent)]" />
                <div className="text-[13px] font-semibold text-[var(--pc-text)]">
                  Operational Readiness
                </div>
              </div>
              <div className="mt-1 text-[12px] text-[var(--pc-text-secondary)]">
                Windows operator checklist for whether this path is ready for
                review.
              </div>
            </div>

            <div className="space-y-4 px-5 py-5">
              <StatusRow
                label="Tag loaded"
                status={Boolean(data)}
                helper={
                  data
                    ? `Working tag: ${data.groupTag}`
                    : "Run discovery to pull the current tag context."
                }
              />
              <StatusRow
                label="Target group selected"
                status={Boolean(selectedGroup)}
                helper={
                  selectedGroup
                    ? selectedGroup.groupName
                    : "Select the Entra group that should receive the tag."
                }
              />
              <StatusRow
                label="Deployment profile selected"
                status={Boolean(selectedProfile)}
                helper={
                  selectedProfile
                    ? selectedProfile.profileName
                    : "Select the Windows Autopilot profile for this path."
                }
              />
              <StatusRow
                label="Required apps found"
                status={Boolean(selectedPayload?.requiredApps.length)}
                helper={
                  selectedPayload
                    ? selectedPayload.requiredApps.length > 0
                      ? `${selectedPayload.requiredApps.length} required app${selectedPayload.requiredApps.length === 1 ? "" : "s"} assigned through the selected group.`
                      : "No required apps were found for the selected group."
                    : "Select a target group to inspect the app payload."
                }
                tone="info"
              />
              <StatusRow
                label="Stored config reference"
                status={Boolean(data?.existingConfig)}
                helper={
                  data?.existingConfig
                    ? data.existingConfig.propertyLabel
                    : "No tag_config reference stored for this tag."
                }
                tone="info"
              />

              <div className="rounded-xl border border-[var(--pc-border)] bg-[var(--pc-surface-raised)]/55 p-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
                  Expected Config Alignment
                </div>
                <CompareRow
                  label="Selected group"
                  state={isSelectedGroupExpected}
                  emptyLabel="Select a group to compare it against tag_config."
                />
                <CompareRow
                  label="Selected profile"
                  state={isSelectedProfileExpected}
                  emptyLabel="Select a profile to compare it against tag_config."
                />
                <div className="mt-3 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-3 py-2 text-[11px] leading-relaxed text-[var(--pc-text-secondary)]">
                  Stored expectations are advisory reference values from
                  `tag_config`. They help Windows admins spot drift before
                  validating the chain.
                </div>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-[var(--pc-border)] px-5 py-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[var(--pc-accent)]" />
                <div className="text-[13px] font-semibold text-[var(--pc-text)]">
                  Current Chain Review
                </div>
              </div>
              <div className="mt-1 text-[12px] text-[var(--pc-text-secondary)]">
                Operator summary of the tag, target group, and selected
                deployment profile.
              </div>
            </div>

            <div className="space-y-4 px-5 py-5">
              <SelectionSummary
                icon={<Tag className="h-3.5 w-3.5" />}
                label="Group Tag"
                value={data?.groupTag ?? "No tag loaded"}
                helper={
                  data
                    ? `${data.deviceCount} device records currently match.`
                    : "Run discovery to load a tag context."
                }
                detailRows={
                  data
                    ? [
                        {
                          label: "Operational use",
                          value: "Windows Autopilot group tag",
                        },
                        { label: "Current value", value: data.groupTag },
                      ]
                    : []
                }
                onCopy={
                  data
                    ? () => void handleCopy("Group tag", data.groupTag)
                    : undefined
                }
              />
              <SelectionSummary
                icon={<Users className="h-3.5 w-3.5" />}
                label="Target Group"
                value={selectedGroup?.groupName ?? "No group selected"}
                helper={
                  selectedGroup
                    ? formatMembershipType(selectedGroup.membershipType)
                    : "Choose the group that should receive this tag."
                }
                detailRows={
                  selectedGroup
                    ? [
                        {
                          label: "Membership type",
                          value: formatMembershipType(
                            selectedGroup.membershipType,
                          ),
                        },
                        { label: "Group ID", value: selectedGroup.groupId },
                        {
                          label: "Expected config",
                          value:
                            isSelectedGroupExpected === null
                              ? "Not checked"
                              : isSelectedGroupExpected
                                ? "Matches stored expected group"
                                : "Not listed in stored expected groups",
                        },
                      ]
                    : []
                }
                onCopy={
                  selectedGroup
                    ? () => void handleCopy("Group ID", selectedGroup.groupId)
                    : undefined
                }
              />
              <SelectionSummary
                icon={<GitBranch className="h-3.5 w-3.5" />}
                label="Deployment Profile"
                value={selectedProfile?.profileName ?? "No profile selected"}
                helper={
                  selectedProfile?.deploymentMode
                    ? formatDeploymentMode(selectedProfile.deploymentMode)
                    : "Choose the profile expected to land on devices in this path."
                }
                detailRows={
                  selectedProfile
                    ? [
                        {
                          label: "Deployment mode",
                          value: formatDeploymentMode(
                            selectedProfile.deploymentMode,
                          ),
                        },
                        {
                          label: "Assigned via",
                          value:
                            selectedProfileViaGroup?.groupName ??
                            selectedProfile.viaGroupId,
                        },
                        {
                          label: "Profile ID",
                          value: selectedProfile.profileId,
                        },
                        {
                          label: "Expected config",
                          value:
                            isSelectedProfileExpected === null
                              ? "Not checked"
                              : isSelectedProfileExpected
                                ? "Matches stored expected profile"
                                : "Not listed in stored expected profiles",
                        },
                      ]
                    : []
                }
                onCopy={
                  selectedProfile
                    ? () =>
                        void handleCopy("Profile ID", selectedProfile.profileId)
                    : undefined
                }
              />

              <div className="rounded-xl border border-[var(--pc-border)] bg-[var(--pc-surface-raised)]/65 p-4">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
                  Validation Action
                </div>
                <Button
                  onClick={handleValidate}
                  disabled={validate.isPending}
                  className="h-10 w-full"
                >
                  {validate.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Validating
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Validate Chain
                    </>
                  )}
                </Button>
                <div className="mt-2 text-[11.5px] leading-relaxed text-[var(--pc-text-muted)]">
                  Uses the current tag, selected group, and selected profile
                  exactly as shown above.
                </div>
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-[var(--pc-border)] px-5 py-4">
              <div className="text-[13px] font-semibold text-[var(--pc-text)]">
                Validation Output
              </div>
              <div className="mt-1 text-[12px] text-[var(--pc-text-secondary)]">
                Review errors and warnings before treating the chain as
                production-ready.
              </div>
            </div>

            <div className="space-y-3 px-5 py-5">
              {!validate.data ? (
                <div className="rounded-xl border border-dashed border-[var(--pc-border)] bg-[var(--pc-surface-raised)]/35 px-4 py-5 text-[12px] leading-relaxed text-[var(--pc-text-muted)]">
                  No validation has been run yet. Execute the chain review once
                  you have loaded a tag and inspected the discovered targets.
                </div>
              ) : (
                <>
                  <ResultBanner valid={validate.data.valid} />
                  {validate.data.errors.length > 0 ? (
                    <IssueList
                      title="Errors"
                      items={validate.data.errors}
                      tone="critical"
                    />
                  ) : null}
                  {validate.data.warnings.length > 0 ? (
                    <IssueList
                      title="Warnings"
                      items={validate.data.warnings}
                      tone="warning"
                    />
                  ) : null}
                  {validate.data.errors.length === 0 &&
                  validate.data.warnings.length === 0 ? (
                    <div className="rounded-xl border border-[var(--pc-border)] bg-[var(--pc-surface-raised)]/55 px-4 py-4 text-[12px] text-[var(--pc-text-secondary)]">
                      No warnings were returned for the current validation
                      response.
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </Card>
        </div>
      </div>

      <HardwareHashImport />
    </div>
  );
}

function BuildPayloadPanel({
  payload,
  selectedGroupName,
}: {
  payload: BuildPayloadGroup | null;
  selectedGroupName: string | null;
}) {
  const totalPayload =
    (payload?.requiredApps.length ?? 0) +
    (payload?.configProfiles.length ?? 0) +
    (payload?.compliancePolicies.length ?? 0);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--pc-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-[var(--pc-accent)]" />
            <div className="text-[13px] font-semibold text-[var(--pc-text)]">
              Build Payload
            </div>
            <CountPill value={totalPayload} label="items" />
          </div>
          <div className="mt-1 text-[12px] text-[var(--pc-text-secondary)]">
            {selectedGroupName ?? "No target group selected"}
          </div>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2.5 py-1.5 text-[11px] text-[var(--pc-text-muted)]">
          <Clock3 className="h-3.5 w-3.5" />
          {formatRelativeTime(payload?.syncedAt ?? null)}
        </div>
      </div>

      {!payload ? (
        <EmptyPanel
          message="No target group selected."
          guidance="Select a target group to preview required apps, configuration profiles, and compliance policies."
        />
      ) : (
        <div className="space-y-4 px-5 py-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <PayloadSection
              title="Required Apps"
              icon={Package}
              items={payload.requiredApps}
              emptyLabel="No required apps assigned."
            />
            <PayloadSection
              title="Configuration"
              icon={Settings2}
              items={payload.configProfiles}
              emptyLabel="No configuration profiles assigned."
            />
            <PayloadSection
              title="Compliance"
              icon={FileCheck2}
              items={payload.compliancePolicies}
              emptyLabel="No compliance policies assigned."
            />
          </div>

          {payload.warnings.length > 0 ? (
            <IssueList
              title="Payload Warnings"
              items={payload.warnings}
              tone="warning"
            />
          ) : null}
        </div>
      )}
    </Card>
  );
}

function PayloadSection({
  title,
  icon: Icon,
  items,
  emptyLabel,
}: {
  title: string;
  icon: typeof Package;
  items: BuildPayloadItem[];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--pc-border)] bg-[var(--pc-surface-raised)]/55">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--pc-border)] px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--pc-accent)]" />
          <div className="truncate text-[12px] font-semibold text-[var(--pc-text)]">
            {title}
          </div>
        </div>
        <span className="rounded-md bg-[var(--pc-tint-hover)] px-2 py-0.5 text-[10px] font-medium text-[var(--pc-text-secondary)]">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="px-3 py-4 text-[11.5px] text-[var(--pc-text-muted)]">
          {emptyLabel}
        </div>
      ) : (
        <div className="divide-y divide-[var(--pc-border)]">
          {items.map((item) => (
            <div key={item.payloadId} className="px-3 py-2.5">
              <div className="truncate text-[12px] font-medium text-[var(--pc-text)]">
                {item.payloadName}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10.5px] uppercase tracking-wide text-[var(--pc-text-muted)]">
                <span>{item.intent ?? item.targetType}</span>
                <span>{formatRelativeTime(item.syncedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TagDevicesPanel({
  groupTag,
  devices,
  isLoading,
  isError,
  error,
  onRetry,
}: {
  groupTag: string;
  devices: ProvisioningTagDevice[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--pc-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TabletSmartphone className="h-4 w-4 text-[var(--pc-accent)]" />
            <div className="text-[13px] font-semibold text-[var(--pc-text)]">
              Devices Carrying Tag
            </div>
            <CountPill value={devices.length} label="devices" />
          </div>
          <div className="mt-1 text-[12px] text-[var(--pc-text-secondary)]">
            {groupTag}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="px-5 py-6">
          <LoadingState label="Loading tagged devices..." />
        </div>
      ) : isError ? (
        <div className="px-5 py-5">
          <ErrorState
            title="Could not load tagged devices"
            error={error}
            onRetry={onRetry}
          />
        </div>
      ) : devices.length === 0 ? (
        <EmptyPanel
          message={`No devices currently carry "${groupTag}".`}
          guidance="Run a sync after tagged devices exist."
        />
      ) : (
        <div>
          <div className="hidden grid-cols-[150px_minmax(0,1fr)_150px_170px_24px] border-b border-[var(--pc-border)] bg-[var(--pc-surface)] px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)] sm:grid">
            <div>Serial</div>
            <div>Hostname</div>
            <div>Last Sync</div>
            <div>Current State</div>
            <div />
          </div>
          <div className="max-h-[430px] divide-y divide-[var(--pc-border)] overflow-auto">
            {devices.map((device) => (
              <Link
                key={device.deviceKey}
                to="/devices/$deviceKey"
                params={{ deviceKey: device.deviceKey }}
                className="grid gap-2 px-4 py-3 transition-colors hover:bg-[var(--pc-tint-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)] sm:grid-cols-[150px_minmax(0,1fr)_150px_170px_24px] sm:items-center"
              >
                <div className="font-mono text-[11.5px] text-[var(--pc-text-secondary)]">
                  {device.serialNumber ?? "Unknown"}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-medium text-[var(--pc-text)]">
                    {device.deviceName ?? "No hostname"}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--pc-text-muted)] sm:hidden">
                    {formatRelativeTime(device.lastSyncAt)}
                  </div>
                </div>
                <div className="hidden text-[11.5px] text-[var(--pc-text-muted)] sm:block">
                  {formatRelativeTime(device.lastSyncAt)}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge health={device.health as HealthLevel} />
                  {device.complianceState ? (
                    <span className="text-[11px] text-[var(--pc-text-muted)]">
                      {device.complianceState}
                    </span>
                  ) : null}
                </div>
                <ArrowRight className="hidden h-3.5 w-3.5 text-[var(--pc-text-muted)] sm:block" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function formatRelativeTime(value: string | null) {
  if (!value) return "No sync";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return formatDistanceToNow(date, { addSuffix: true });
}
