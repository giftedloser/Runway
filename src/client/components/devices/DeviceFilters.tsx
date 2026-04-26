import { useNavigate, useSearch } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { FLAG_INFO } from "../../lib/flags.js";
import type { FlagCode, HealthLevel } from "../../lib/types.js";
import { cn } from "../../lib/utils.js";
import { Input } from "../ui/input.js";

// Debounce router writes while typing so every keystroke doesn't push a new
// history entry / retrigger the devices query. Click-driven filters (health
// pills, flag dropdown, clear-filters) stay immediate.
const SEARCH_DEBOUNCE_MS = 250;

const HEALTH_OPTIONS: Array<Exclude<HealthLevel, "unknown">> = [
  "critical",
  "warning",
  "info",
  "healthy",
];

const HEALTH_STYLES: Record<Exclude<HealthLevel, "unknown">, string> = {
  critical:
    "bg-[var(--pc-critical-muted)] text-[var(--pc-critical)] ring-1 ring-[var(--pc-critical)]/40",
  warning:
    "bg-[var(--pc-warning-muted)] text-[var(--pc-warning)] ring-1 ring-[var(--pc-warning)]/40",
  info: "bg-[var(--pc-info-muted)] text-[var(--pc-info)] ring-1 ring-[var(--pc-info)]/40",
  healthy:
    "bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)] ring-1 ring-[var(--pc-healthy)]/40",
};

const FLAG_OPTIONS = (Object.keys(FLAG_INFO) as FlagCode[]).map((code) => ({
  code,
  ...FLAG_INFO[code],
}));

export function DeviceFilters() {
  const navigate = useNavigate({ from: "/devices" });
  const search = useSearch({ from: "/devices" });

  const hasAnyFilter = Boolean(
    search.search ||
    search.health ||
    search.flag ||
    search.property ||
    search.profile,
  );

  const setSearch = (
    updater: (previous: typeof search) => Partial<typeof search>,
  ) =>
    navigate({
      search: (previous) => ({ ...previous, ...updater(previous), page: 1 }),
    });

  // Local mirror of the URL search param so typing stays responsive while the
  // actual router write is debounced. Re-sync whenever the URL param changes
  // externally (clear-filters button, back/forward nav, command-palette jump).
  const [searchInput, setSearchInput] = useState(search.search ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSearchInput(search.search ?? "");
  }, [search.search]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setSearch(() => ({ search: value || undefined }));
    }, SEARCH_DEBOUNCE_MS);
  };

  return (
    <div className="space-y-2.5 rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface)] p-3 shadow-[0_12px_34px_rgba(0,0,0,0.10)]">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--pc-text-secondary)]">
          Filter device queue
        </div>
        <div className="pc-helper-text">
          Search narrows by device name, serial, or user. Health and flag
          filters are best for building a focused fix list.
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-lg">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--pc-text-muted)]" />
          <Input
            className="w-full pl-9"
            placeholder="Search by name, serial, or UPN…"
            name="device-search"
            autoComplete="off"
            spellCheck={false}
            value={searchInput}
            onChange={(event) => handleSearchChange(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-1.5 lg:ml-auto">
          {HEALTH_OPTIONS.map((health) => {
            const active = search.health === health;
            return (
              <button
                key={health}
                type="button"
                onClick={() =>
                  setSearch((previous) => ({
                    health: previous.health === health ? undefined : health,
                  }))
                }
                aria-label={`Filter by ${health} health`}
                aria-pressed={active}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[12px] font-medium capitalize transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]",
                  active
                    ? HEALTH_STYLES[health]
                    : "bg-[var(--pc-tint-subtle)] text-[var(--pc-text-secondary)] hover:bg-[var(--pc-tint-hover)]",
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
          className="h-8 rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2.5 py-1.5 text-[12px] text-[var(--pc-text)] transition-colors focus:border-[var(--pc-accent)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
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
                  pageSize: search.pageSize ?? 25,
                }),
              })
            }
            className="inline-flex items-center gap-1 rounded-md border border-[var(--pc-border)] px-2.5 py-1.5 text-[12px] text-[var(--pc-text-secondary)] transition-colors hover:border-[var(--pc-critical)]/50 hover:text-[var(--pc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
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
  critical:
    "border-[var(--pc-critical)]/30 bg-[var(--pc-critical-muted)] text-[var(--pc-critical)]",
  warning:
    "border-[var(--pc-warning)]/30 bg-[var(--pc-warning-muted)] text-[var(--pc-warning)]",
  info: "border-[var(--pc-info)]/30 bg-[var(--pc-info-muted)] text-[var(--pc-info)]",
  healthy:
    "border-[var(--pc-healthy)]/30 bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)]",
};

function ActiveTag({
  label,
  variant,
  onClear,
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
          : "border-[var(--pc-border)] bg-[var(--pc-tint-subtle)] text-[var(--pc-text-secondary)]",
      )}
    >
      {label}
      <button
        type="button"
        onClick={onClear}
        className="ml-0.5 rounded-full p-0.5 text-current opacity-60 transition-opacity hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        aria-label={`Remove ${label} filter`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
