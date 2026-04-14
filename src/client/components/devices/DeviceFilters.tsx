import { useNavigate, useSearch } from "@tanstack/react-router";
import { Search, X } from "lucide-react";

import { FLAG_INFO } from "../../lib/flags.js";
import type { FlagCode, HealthLevel } from "../../lib/types.js";
import { cn } from "../../lib/utils.js";
import { Input } from "../ui/input.js";

const HEALTH_OPTIONS: Array<Exclude<HealthLevel, "unknown">> = [
  "critical",
  "warning",
  "info",
  "healthy"
];

const HEALTH_STYLES: Record<Exclude<HealthLevel, "unknown">, string> = {
  critical: "bg-[var(--pc-critical-muted)] text-red-200 ring-1 ring-[var(--pc-critical)]/40",
  warning: "bg-[var(--pc-warning-muted)] text-amber-200 ring-1 ring-[var(--pc-warning)]/40",
  info: "bg-[var(--pc-info-muted)] text-sky-200 ring-1 ring-[var(--pc-info)]/40",
  healthy: "bg-[var(--pc-healthy-muted)] text-emerald-200 ring-1 ring-[var(--pc-healthy)]/40"
};

const FLAG_OPTIONS = (Object.keys(FLAG_INFO) as FlagCode[]).map((code) => ({
  code,
  ...FLAG_INFO[code]
}));

export function DeviceFilters() {
  const navigate = useNavigate({ from: "/devices" });
  const search = useSearch({ from: "/devices" });

  const hasAnyFilter = Boolean(
    search.search || search.health || search.flag || search.property || search.profile
  );

  const setSearch = (updater: (previous: typeof search) => Partial<typeof search>) =>
    navigate({
      search: (previous) => ({ ...previous, ...updater(previous), page: 1 })
    });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--pc-text-muted)]" />
          <Input
            className="w-full pl-9"
            placeholder="Search by name, serial, or UPN..."
            value={search.search ?? ""}
            onChange={(event) =>
              setSearch(() => ({ search: event.target.value || undefined }))
            }
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {HEALTH_OPTIONS.map((health) => {
            const active = search.health === health;
            return (
              <button
                key={health}
                type="button"
                onClick={() =>
                  setSearch((previous) => ({
                    health: previous.health === health ? undefined : health
                  }))
                }
                aria-label={`Filter by ${health} health`}
                aria-pressed={active}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12px] font-medium capitalize transition-colors",
                  active
                    ? HEALTH_STYLES[health]
                    : "bg-white/[0.04] text-[var(--pc-text-secondary)] hover:bg-white/[0.07]"
                )}
              >
                {health}
              </button>
            );
          })}
        </div>

        <select
          value={search.flag ?? ""}
          onChange={(event) =>
            setSearch(() => ({ flag: event.target.value || undefined }))
          }
          aria-label="Filter by flag"
          className="rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2.5 py-1.5 text-[12px] text-[var(--pc-text)] focus:border-[var(--pc-accent)] focus:outline-none"
        >
          <option value="">All flags</option>
          {FLAG_OPTIONS.map((flag) => (
            <option key={flag.code} value={flag.code}>
              {flag.label}
            </option>
          ))}
        </select>

        {hasAnyFilter ? (
          <button
            type="button"
            onClick={() =>
              navigate({
                search: () => ({
                  search: undefined,
                  health: undefined,
                  flag: undefined,
                  property: undefined,
                  profile: undefined,
                  page: 1,
                  pageSize: search.pageSize ?? 25
                })
              })
            }
            className="inline-flex items-center gap-1 rounded-md border border-[var(--pc-border)] px-2.5 py-1.5 text-[12px] text-[var(--pc-text-secondary)] transition-colors hover:border-[var(--pc-critical)]/50 hover:text-white"
          >
            <X className="h-3 w-3" />
            Clear filters
          </button>
        ) : null}
      </div>

      {hasAnyFilter && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--pc-text-muted)]">
            Active
          </span>
          {search.search && (
            <ActiveTag
              label={`Search: "${search.search.length > 24 ? `${search.search.slice(0, 22)}…` : search.search}"`}
              onClear={() => setSearch(() => ({ search: undefined }))}
            />
          )}
          {search.health && (
            <ActiveTag
              label={`Health: ${search.health}`}
              variant={search.health as Exclude<HealthLevel, "unknown">}
              onClear={() => setSearch(() => ({ health: undefined }))}
            />
          )}
          {search.flag && (
            <ActiveTag
              label={`Flag: ${FLAG_INFO[search.flag as FlagCode]?.label ?? search.flag}`}
              onClear={() => setSearch(() => ({ flag: undefined }))}
            />
          )}
          {search.profile && (
            <ActiveTag
              label={`Profile: ${search.profile}`}
              onClear={() => setSearch(() => ({ profile: undefined }))}
            />
          )}
          {search.property && (
            <ActiveTag
              label={`Property: ${search.property}`}
              onClear={() => setSearch(() => ({ property: undefined }))}
            />
          )}
        </div>
      )}
    </div>
  );
}

const CHIP_VARIANT_STYLES: Record<string, string> = {
  critical: "border-[var(--pc-critical)]/30 bg-[var(--pc-critical-muted)] text-red-200",
  warning: "border-[var(--pc-warning)]/30 bg-[var(--pc-warning-muted)] text-amber-200",
  info: "border-[var(--pc-info)]/30 bg-[var(--pc-info-muted)] text-sky-200",
  healthy: "border-[var(--pc-healthy)]/30 bg-[var(--pc-healthy-muted)] text-emerald-200"
};

function ActiveTag({
  label,
  variant,
  onClear
}: {
  label: string;
  variant?: Exclude<HealthLevel, "unknown">;
  onClear: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1",
        variant && CHIP_VARIANT_STYLES[variant]
          ? CHIP_VARIANT_STYLES[variant]
          : "border-[var(--pc-border)] bg-white/[0.04] text-[var(--pc-text-secondary)]"
      )}
    >
      {label}
      <button
        type="button"
        onClick={onClear}
        className="ml-0.5 rounded-full p-0.5 text-current opacity-60 transition-opacity hover:opacity-100"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
