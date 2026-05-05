import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Edit3,
  RefreshCcw,
  Save,
  Search,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";

import { PageHeader } from "../components/layout/PageHeader.js";
import { AdvancedDisclosure } from "../components/shared/AdvancedDisclosure.js";
import { ConfirmDialog } from "../components/shared/ConfirmDialog.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { EmptyState } from "../components/shared/EmptyState.js";
import { SourceBadge } from "../components/shared/SourceBadge.js";
import { useToast } from "../components/shared/toast.js";
import { Button } from "../components/ui/button.js";
import { Card } from "../components/ui/card.js";
import { Input } from "../components/ui/input.js";
import type { TagInventoryItem } from "../components/provisioning/types.js";
import { useAuthStatus } from "../hooks/useAuth.js";
import { useSettings, useTagConfigMutations } from "../hooks/useSettings.js";
import { useTimestampFormatter } from "../hooks/useTimestampFormatter.js";
import { apiRequest } from "../lib/api.js";
import type { TagConfigRecord } from "../lib/types.js";
import { cn } from "../lib/utils.js";

interface DrawerState {
  originalGroupTag: string;
  wasConfigured: boolean;
  draft: {
    groupTag: string;
    propertyLabel: string;
    expectedGroupNames: string;
    expectedProfileNames: string;
  };
}

function toCsv(values: string[]) {
  return values.join(", ");
}

function fromCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function TagsPage() {
  const [search, setSearch] = useState("");
  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const formatTimestamp = useTimestampFormatter();
  const navigate = useNavigate({ from: "/tags" });
  const toast = useToast();
  const auth = useAuthStatus();
  const settings = useSettings();
  const mutations = useTagConfigMutations();
  const isAuthed = auth.data?.authenticated === true;
  const tagConfigReady = settings.isSuccess && Boolean(settings.data);
  const editDisabledReason = tagConfigReady
    ? null
    : settings.isError
      ? "Tag mappings could not be loaded. Retry settings before editing mappings."
      : "Tag mappings are still loading. Editing is unavailable until full tag_config data is loaded.";

  const tags = useQuery({
    queryKey: ["provisioning-tags"],
    queryFn: () => apiRequest<TagInventoryItem[]>("/api/provisioning/tags"),
  });

  const fullTagConfig = tagConfigReady ? settings.data?.tagConfig : null;
  const tagConfigByTag = useMemo(
    () =>
      new Map(
        (fullTagConfig ?? []).map((record) => [
          record.groupTag,
          record,
        ]),
      ),
    [fullTagConfig],
  );

  const normalizedSearch = search.trim().toLowerCase();
  const visibleTags = (tags.data ?? []).filter((tag) => {
    if (!normalizedSearch) return true;
    const config = tagConfigByTag.get(tag.groupTag);
    return `${tag.groupTag} ${config?.propertyLabel ?? tag.propertyLabel ?? ""}`
      .toLowerCase()
      .includes(normalizedSearch);
  });
  const configuredCount = (tags.data ?? []).filter((tag) => tag.configured).length;
  const discoveredOnlyCount = Math.max(0, (tags.data?.length ?? 0) - configuredCount);
  const deviceCount = (tags.data ?? []).reduce(
    (total, tag) => total + tag.deviceCount,
    0,
  );

  useEffect(() => {
    if (!drawer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawer(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawer]);

  const openDrawer = (tag: TagInventoryItem) => {
    if (!tagConfigReady || !settings.data) {
      toast.push({
        variant: settings.isError ? "error" : "info",
        title: settings.isError
          ? "Tag mappings could not be loaded"
          : "Tag mappings are still loading",
        description: settings.isError
          ? "Retry settings before editing individual mappings."
          : "Runway is still loading full tag_config data.",
      });
      return;
    }

    const config = settings.data.tagConfig.find(
      (record) => record.groupTag === tag.groupTag,
    );
    setDrawer({
      originalGroupTag: tag.groupTag,
      wasConfigured: Boolean(config),
      draft: {
        groupTag: config?.groupTag ?? tag.groupTag,
        propertyLabel: config?.propertyLabel ?? tag.propertyLabel ?? tag.groupTag,
        expectedGroupNames: toCsv(config?.expectedGroupNames ?? []),
        expectedProfileNames: toCsv(config?.expectedProfileNames ?? []),
      },
    });
  };

  const navigateToBuilder = (groupTag: string) => {
    void navigate({ to: "/provisioning", search: { groupTag } });
  };

  const saveDrawer = async () => {
    if (!drawer) return;
    if (!tagConfigReady || !settings.data) {
      toast.push({
        variant: settings.isError ? "error" : "info",
        title: "Tag mappings unavailable",
        description: "Runway must load full tag_config data before saving mapping edits.",
      });
      return;
    }

    const record: TagConfigRecord = {
      groupTag: drawer.draft.groupTag.trim(),
      propertyLabel: drawer.draft.propertyLabel.trim(),
      expectedGroupNames: fromCsv(drawer.draft.expectedGroupNames),
      expectedProfileNames: fromCsv(drawer.draft.expectedProfileNames),
    };

    if (!record.groupTag || !record.propertyLabel) return;

    try {
      await mutations.create.mutateAsync(record);
      if (drawer.wasConfigured && drawer.originalGroupTag !== record.groupTag) {
        await mutations.remove.mutateAsync(drawer.originalGroupTag);
      }
      toast.push({
        variant: "success",
        title: "Tag mapping saved",
        description: `${record.groupTag} now maps to ${record.propertyLabel}.`,
      });
      setDrawer(null);
    } catch (error) {
      toast.push({
        variant: "error",
        title: "Tag mapping not saved",
        description:
          error instanceof Error ? error.message : "The mapping was rejected.",
      });
    }
  };

  if (tags.isLoading) return <LoadingState label="Loading tags..." />;
  if (tags.isError) {
    return (
      <ErrorState
        title="Could not load tags"
        error={tags.error}
        onRetry={() => tags.refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inspect"
        title="Tags"
        description="Browse every Autopilot group tag currently seen on devices."
        actions={
          <>
            <SourceBadge source="autopilot" />
            <SourceBadge source="derived" />
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <TagMetric label="Tags" value={tags.data?.length ?? 0} />
        <TagMetric label="Devices" value={deviceCount} />
        <TagMetric
          label="Discovered-only"
          value={discoveredOnlyCount}
          tone={discoveredOnlyCount > 0 ? "warning" : "neutral"}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--pc-border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Tags className="h-4 w-4 text-[var(--pc-accent)]" />
            <div className="text-[13px] font-semibold text-[var(--pc-text)]">
              Tag Inventory
            </div>
            <span className="text-[11px] text-[var(--pc-text-muted)]">
              ({visibleTags.length})
            </span>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--pc-text-muted)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter tags"
              name="tag-search"
              autoComplete="off"
              spellCheck={false}
              className="h-9 pl-8"
            />
          </div>
        </div>

        {settings.isError ? (
          <div className="flex flex-col gap-3 border-b border-[var(--pc-border)] bg-[var(--pc-critical-muted)]/45 px-4 py-3 text-[12px] text-[var(--pc-critical)] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">Tag mappings could not be loaded.</div>
                <div className="mt-0.5 text-[11.5px] leading-relaxed opacity-90">
                  Editing is disabled until Runway can load full tag_config data. Row clicks still open Provisioning Path.
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="h-8 shrink-0 px-2.5 text-[11.5px]"
              onClick={() => void settings.refetch()}
              disabled={settings.isFetching}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              {settings.isFetching ? "Retrying..." : "Retry settings"}
            </Button>
          </div>
        ) : null}

        {(tags.data?.length ?? 0) === 0 ? (
          <EmptyState
            id="tags-no-devices-synced"
            title="Run a sync to see tags."
            description="Tags appear after Runway syncs Autopilot device data that includes group tags."
            action={{ label: "Go to Sync", onClick: () => void navigate({ to: "/sync" }) }}
          />
        ) : visibleTags.length === 0 ? (
          <EmptyState
            id="tags-filter-empty"
            title="No tags match the current filter."
            description="Clear or change the filter to return to the full tag inventory."
          />
        ) : (
          <div>
            <div className="hidden grid-cols-[minmax(0,1.35fr)_110px_150px_150px_minmax(0,1fr)_40px] border-b border-[var(--pc-border)] bg-[var(--pc-surface)] px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)] sm:grid">
              <div>Tag</div>
              <div>Devices</div>
              <div>Last Seen</div>
              <div>Status</div>
              <div>Property</div>
              <div />
            </div>
            <div className="divide-y divide-[var(--pc-border)]">
              {visibleTags.map((tag) => {
                const config = tagConfigByTag.get(tag.groupTag);
                const propertyLabel = config?.propertyLabel ?? tag.propertyLabel;
                return (
                  <div
                    key={tag.groupTag}
                    className="grid gap-2 px-4 py-3 transition-colors hover:bg-[var(--pc-tint-subtle)] sm:grid-cols-[minmax(0,1.35fr)_110px_150px_150px_minmax(0,1fr)_40px] sm:items-center"
                  >
                    <button
                      type="button"
                      className="grid min-w-0 cursor-pointer gap-2 rounded-[var(--pc-radius-sm)] text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)] sm:col-span-5 sm:grid-cols-[minmax(0,1.35fr)_110px_150px_150px_minmax(0,1fr)] sm:items-center"
                      onClick={() => navigateToBuilder(tag.groupTag)}
                      aria-label={`Open Provisioning Path for ${tag.groupTag}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-[var(--pc-text)]">
                          {tag.groupTag}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[var(--pc-text-muted)] sm:hidden">
                          {tag.deviceCount.toLocaleString()} devices
                        </div>
                      </div>
                      <div className="hidden text-[12px] font-medium text-[var(--pc-text-secondary)] sm:block">
                        {tag.deviceCount.toLocaleString()}
                      </div>
                      <div className="text-[11.5px] text-[var(--pc-text-muted)]">
                        {tag.lastSeenAt
                          ? formatTimestamp(tag.lastSeenAt)
                          : "No sync"}
                      </div>
                      <div>
                        <ConfigStatus configured={tag.configured} />
                      </div>
                      <div className="truncate text-[11.5px] text-[var(--pc-text-secondary)]">
                        {propertyLabel ?? "Unmapped"}
                      </div>
                    </button>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-8 w-8 px-0"
                        onClick={() => openDrawer(tag)}
                        disabled={editDisabledReason !== null}
                        aria-label={
                          editDisabledReason
                            ? `Cannot edit mapping for ${tag.groupTag}: ${editDisabledReason}`
                            : `Edit mapping for ${tag.groupTag}`
                        }
                        title={editDisabledReason ?? "Edit mapping"}
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </Button>
                      <ArrowRight className="hidden h-3.5 w-3.5 text-[var(--pc-text-muted)] sm:block" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      <TagMappingDrawer
        drawer={drawer}
        adminSignedIn={isAuthed}
        mappingsAvailable={tagConfigReady}
        isSaving={mutations.create.isPending || mutations.remove.isPending}
        onClose={() => setDrawer(null)}
        onChange={(draft) =>
          setDrawer((current) => (current ? { ...current, draft } : current))
        }
        onSave={() => void saveDrawer()}
        onDelete={(groupTag) => setDeleteTarget(groupTag)}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete tag mapping"
        description={`Remove the mapping for group tag "${deleteTarget ?? ""}"? Devices using this tag will keep appearing in Tags, but Runway will treat it as discovered-only.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (deleteTarget) {
            mutations.remove.mutate(deleteTarget, {
              onSuccess: () => {
                toast.push({
                  variant: "success",
                  title: "Tag mapping deleted",
                  description: `${deleteTarget} is now discovered-only.`,
                });
              },
            });
          }
          setDeleteTarget(null);
          setDrawer(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function TagMappingDrawer({
  drawer,
  adminSignedIn,
  mappingsAvailable,
  isSaving,
  onClose,
  onChange,
  onSave,
  onDelete,
}: {
  drawer: DrawerState | null;
  adminSignedIn: boolean;
  mappingsAvailable: boolean;
  isSaving: boolean;
  onClose: () => void;
  onChange: (draft: DrawerState["draft"]) => void;
  onSave: () => void;
  onDelete: (groupTag: string) => void;
}) {
  if (!drawer) return null;

  const { draft } = drawer;
  const canSave =
    adminSignedIn &&
    mappingsAvailable &&
    !isSaving &&
    draft.groupTag.trim().length > 0 &&
    draft.propertyLabel.trim().length > 0;
  const disabled = !adminSignedIn || isSaving || !mappingsAvailable;

  const setDraftValue =
    (key: keyof DrawerState["draft"]) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange({ ...draft, [key]: event.target.value });
    };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-[1px]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
        aria-label="Close tag mapping drawer"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="tag-mapping-drawer-title"
        className="relative flex h-full w-full max-w-xl flex-col border-l border-[var(--pc-border)] bg-[var(--pc-bg)] shadow-2xl"
      >
        <div className="border-b border-[var(--pc-border)] bg-[var(--pc-surface)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div
                id="tag-mapping-drawer-title"
                className="text-[14px] font-semibold text-[var(--pc-text)]"
              >
                Tag mapping
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-[var(--pc-text-muted)]">
                Edit the local Runway mapping for this Autopilot group tag.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-8 w-8 px-0"
              onClick={onClose}
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {!adminSignedIn ? (
            <div className="rounded-[var(--pc-radius)] border border-[var(--pc-warning)]/30 bg-[var(--pc-warning-muted)] px-4 py-3 text-[12px] text-[var(--pc-warning)]">
              Admin sign-in is required to save mapping changes.
            </div>
          ) : null}
          {!mappingsAvailable ? (
            <div className="rounded-[var(--pc-radius)] border border-[var(--pc-critical)]/30 bg-[var(--pc-critical-muted)] px-4 py-3 text-[12px] text-[var(--pc-critical)]">
              Tag mappings are unavailable. Reload tag_config before saving changes.
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
                Group tag
              </span>
              <Input
                value={draft.groupTag}
                onChange={setDraftValue("groupTag")}
                disabled={disabled}
                aria-invalid={!draft.groupTag.trim()}
                autoFocus
              />
            </label>
            <label className="space-y-1.5">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
                Property label
              </span>
              <Input
                value={draft.propertyLabel}
                onChange={setDraftValue("propertyLabel")}
                disabled={disabled}
                aria-invalid={!draft.propertyLabel.trim()}
              />
            </label>
          </div>

          <AdvancedDisclosure
            description="Optional. Most admins don't need this. Use only if you're enforcing a strict expected configuration per tag."
          >
            <div className="space-y-4">
              <label className="space-y-1.5">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
                  Expected groups
                </span>
                <Input
                  value={draft.expectedGroupNames}
                  onChange={setDraftValue("expectedGroupNames")}
                  disabled={disabled}
                  placeholder="Group A, Group B"
                />
              </label>
              <label className="space-y-1.5">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
                  Expected profiles
                </span>
                <Input
                  value={draft.expectedProfileNames}
                  onChange={setDraftValue("expectedProfileNames")}
                  disabled={disabled}
                  placeholder="Profile A, Profile B"
                />
              </label>
            </div>
          </AdvancedDisclosure>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--pc-border)] bg-[var(--pc-surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {drawer.wasConfigured ? (
              <Button
                type="button"
                variant="destructive"
                disabled={disabled}
                onClick={() => onDelete(drawer.originalGroupTag)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete mapping
              </Button>
            ) : (
              <span className="text-[11.5px] text-[var(--pc-text-muted)]">
                Saving creates a mapping for this discovered tag.
              </span>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" disabled={!canSave} onClick={onSave}>
              <Save className="h-3.5 w-3.5" />
              {isSaving ? "Saving..." : "Save mapping"}
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function TagMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning";
}) {
  return (
    <Card className="px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 text-[22px] font-semibold leading-none",
          tone === "warning" ? "text-[var(--pc-warning)]" : "text-[var(--pc-text)]",
        )}
      >
        {value.toLocaleString()}
      </div>
    </Card>
  );
}

function ConfigStatus({ configured }: { configured: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] font-medium",
        configured
          ? "bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)]"
          : "bg-[var(--pc-warning-muted)] text-[var(--pc-warning)]",
      )}
    >
      {configured ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <CircleDashed className="h-3 w-3" />
      )}
      {configured ? "Configured" : "Discovered-only"}
    </span>
  );
}
