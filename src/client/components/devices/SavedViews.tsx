import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  AlertOctagon,
  Bookmark,
  ListFilter,
  Plus,
  ShieldOff,
  Star,
  Trash2,
  UserX,
  Workflow,
  X
} from "lucide-react";
import { useState } from "react";

import { useToast } from "../shared/toast.js";
import type { FlagCode, HealthLevel, SavedView } from "../../lib/types.js";
import { useUserViewMutations, useUserViews } from "../../hooks/useUserViews.js";
import { cn } from "../../lib/utils.js";

interface PresetView {
  id: string;
  label: string;
  icon: typeof AlertOctagon;
  health?: Exclude<HealthLevel, "unknown">;
  flag?: FlagCode;
}

/**
 * Built-in presets. These are locked — they can't be renamed or deleted,
 * they just write to the same search params user-defined views use, so
 * both kinds of chips round-trip through the URL identically.
 */
const PRESETS: PresetView[] = [
  { id: "all", label: "All", icon: ListFilter },
  { id: "critical", label: "Critical", icon: AlertOctagon, health: "critical" },
  { id: "no-profile", label: "No profile", icon: ShieldOff, flag: "no_profile_assigned" },
  { id: "user-mismatch", label: "User mismatch", icon: UserX, flag: "user_mismatch" },
  { id: "stalled", label: "Provisioning stalled", icon: Workflow, flag: "provisioning_stalled" }
];

export function SavedViews() {
  const navigate = useNavigate({ from: "/devices" });
  const search = useSearch({ from: "/devices" });
  const userViews = useUserViews();
  const { create, remove } = useUserViewMutations();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");

  const presetMatches = (preset: PresetView) => {
    if (preset.id === "all") {
      return (
        !search.health &&
        !search.flag &&
        !search.search &&
        !search.profile &&
        !search.property
      );
    }
    if (preset.health && search.health !== preset.health) return false;
    if (preset.flag && search.flag !== preset.flag) return false;
    if (!preset.health && search.health) return false;
    if (!preset.flag && search.flag) return false;
    if (search.search || search.profile || search.property) return false;
    return true;
  };

  const userViewMatches = (view: SavedView) =>
    (view.search ?? null) === (search.search ?? null) &&
    (view.health ?? null) === (search.health ?? null) &&
    (view.flag ?? null) === (search.flag ?? null) &&
    (view.property ?? null) === (search.property ?? null) &&
    (view.profile ?? null) === (search.profile ?? null);

  const recall = (next: {
    search?: string;
    health?: string;
    flag?: string;
    property?: string;
    profile?: string;
    pageSize?: number | null;
  }) => {
    navigate({
      search: () => ({
        search: next.search || undefined,
        health: (next.health as HealthLevel | undefined) || undefined,
        flag: (next.flag as FlagCode | undefined) || undefined,
        property: next.property || undefined,
        profile: next.profile || undefined,
        page: 1,
        pageSize: next.pageSize ?? search.pageSize ?? 25
      })
    });
  };

  const hasAnyFilter = Boolean(
    search.search || search.health || search.flag || search.property || search.profile
  );

  const handleSave = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await create.mutateAsync({
        name,
        search: search.search ?? null,
        health: (search.health as HealthLevel | undefined) ?? null,
        flag: (search.flag as FlagCode | undefined) ?? null,
        property: search.property ?? null,
        profile: search.profile ?? null,
        pageSize: search.pageSize ?? null
      });
      setNewName("");
      setSaving(false);
      toast.push({ variant: "success", title: "View saved", description: name });
    } catch (error) {
      toast.push({
        variant: "error",
        title: "Could not save view",
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  };

  const handleDelete = async (view: SavedView) => {
    try {
      await remove.mutateAsync(view.id);
      toast.push({ variant: "info", title: "View removed", description: view.name });
    } catch (error) {
      toast.push({
        variant: "error",
        title: "Could not delete view",
        description: error instanceof Error ? error.message : "Please try again."
      });
    }
  };

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-[var(--pc-border)] bg-[var(--pc-surface)] px-3 py-2">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--pc-text-muted)]">
        Views
      </span>

      {PRESETS.map((preset) => {
        const Icon = preset.icon;
        const active = presetMatches(preset);
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() =>
              recall({
                health: preset.health,
                flag: preset.flag
              })
            }
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
              active
                ? "border-[var(--pc-accent)]/60 bg-[var(--pc-accent-muted)] text-[var(--pc-text)]"
                : "border-[var(--pc-border)] bg-[var(--pc-surface-raised)] text-[var(--pc-text-secondary)] hover:border-[var(--pc-accent)]/40 hover:text-[var(--pc-text)]"
            )}
          >
            <Icon className="h-3 w-3" />
            {preset.label}
          </button>
        );
      })}

      {(userViews.data ?? []).length > 0 && (
        <span className="mx-1 h-3 w-px bg-[var(--pc-border)]" aria-hidden="true" />
      )}

      {(userViews.data ?? []).map((view) => {
        const active = userViewMatches(view);
        return (
          <div key={view.id} className="group relative">
            <button
              type="button"
              onClick={() =>
                recall({
                  search: view.search ?? undefined,
                  health: view.health ?? undefined,
                  flag: view.flag ?? undefined,
                  property: view.property ?? undefined,
                  profile: view.profile ?? undefined,
                  pageSize: view.pageSize ?? undefined
                })
              }
              title={view.name}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-6 text-[11px] font-medium transition-colors",
                active
                  ? "border-[var(--pc-accent)]/60 bg-[var(--pc-accent-muted)] text-[var(--pc-text)]"
                  : "border-[var(--pc-border)] bg-[var(--pc-surface-raised)] text-[var(--pc-text-secondary)] hover:border-[var(--pc-accent)]/40 hover:text-[var(--pc-text)]"
              )}
            >
              <Star className="h-3 w-3" />
              <span className="max-w-[140px] truncate">{view.name}</span>
            </button>
            <button
              type="button"
              onClick={() => handleDelete(view)}
              aria-label={`Delete view ${view.name}`}
              title="Delete view"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[var(--pc-text-muted)] opacity-0 transition-opacity hover:bg-[var(--pc-critical-muted)] hover:text-[var(--pc-critical)] group-hover:opacity-100 focus:opacity-100"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
        );
      })}

      {saving ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--pc-accent)]/60 bg-[var(--pc-surface-raised)] py-0.5 pl-2.5 pr-1 text-[11px]"
        >
          <Bookmark className="h-3 w-3 text-[var(--pc-accent)]" />
          <input
            autoFocus
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setSaving(false);
                setNewName("");
              }
            }}
            maxLength={80}
            placeholder="View name"
            className="w-32 bg-transparent text-[11px] text-[var(--pc-text)] outline-none placeholder:text-[var(--pc-text-muted)]"
          />
          <button
            type="submit"
            disabled={!newName.trim() || create.isPending}
            className="rounded-full bg-[var(--pc-accent)] px-2 py-0.5 text-[10px] font-semibold text-white transition-opacity disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setSaving(false);
              setNewName("");
            }}
            aria-label="Cancel save"
            className="rounded-full p-0.5 text-[var(--pc-text-muted)] hover:bg-[var(--pc-tint-hover)] hover:text-[var(--pc-text)]"
          >
            <X className="h-3 w-3" />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setSaving(true)}
          disabled={!hasAnyFilter}
          title={
            hasAnyFilter
              ? "Save the current filters as a named view"
              : "Apply filters first, then save them as a view"
          }
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-[var(--pc-border)] bg-transparent px-2.5 py-1 text-[11px] font-medium text-[var(--pc-text-muted)] transition-colors hover:border-[var(--pc-accent)]/60 hover:text-[var(--pc-text)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
          Save current
        </button>
      )}
    </div>
  );
}
