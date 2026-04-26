import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Command,
  LoaderCircle,
  Search,
  TabletSmartphone
} from "lucide-react";

import { requestCommandPaletteOpen } from "../command/events.js";
import { Input } from "../ui/input.js";
import { apiRequest } from "../../lib/api.js";
import type { DeviceListItem } from "../../lib/types.js";
import { cn } from "../../lib/utils.js";

const DEVICE_QUEUE_SEARCH: {
  search: string | undefined;
  health: string | undefined;
  flag: string | undefined;
  property: string | undefined;
  profile: string | undefined;
  page: number;
  pageSize: number;
} = {
  search: undefined,
  health: undefined,
  flag: undefined,
  property: undefined,
  profile: undefined,
  page: 1,
  pageSize: 25
};

function useDebounced<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}

function HealthPill({ health }: { health: DeviceListItem["health"] }) {
  const tone = {
    critical:
      "bg-[var(--pc-critical-muted)] text-[var(--pc-critical)] ring-[var(--pc-critical)]/35",
    warning:
      "bg-[var(--pc-warning-muted)] text-[var(--pc-warning)] ring-[var(--pc-warning)]/35",
    info: "bg-[var(--pc-info-muted)] text-[var(--pc-info)] ring-[var(--pc-info)]/35",
    healthy:
      "bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)] ring-[var(--pc-healthy)]/35",
    unknown: "bg-[var(--pc-tint-subtle)] text-[var(--pc-text-secondary)] ring-[var(--pc-border)]"
  }[health];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ring-1",
        tone
      )}
    >
      {health}
    </span>
  );
}

export function MasterDeviceSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const trimmed = query.trim();
  const debounced = useDebounced(trimmed, 180);

  const searchResults = useQuery({
    queryKey: ["master-device-search", debounced],
    queryFn: () =>
      apiRequest<{ items: DeviceListItem[] }>(
        `/api/devices?search=${encodeURIComponent(debounced)}&pageSize=6`
      ),
    enabled: debounced.length >= 2,
    staleTime: 20_000
  });

  const devices = useMemo(() => searchResults.data?.items ?? [], [searchResults.data]);

  const goToQueue = () => {
    void navigate({
      to: "/devices",
      search: { ...DEVICE_QUEUE_SEARCH, search: trimmed || undefined }
    });
  };

  const openDevice = (deviceKey: string) => {
    void navigate({ to: "/devices/$deviceKey", params: { deviceKey } });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmed) {
      requestCommandPaletteOpen();
      return;
    }
    goToQueue();
  };

  return (
    <section className="overflow-hidden rounded-[22px] border border-[var(--pc-border)] bg-[linear-gradient(160deg,var(--pc-surface),var(--pc-surface-raised))] shadow-[0_24px_80px_rgba(0,0,0,0.14)]">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1.18fr)_minmax(320px,0.82fr)]">
        <div className="border-b border-[var(--pc-border)] px-5 py-5 sm:px-6 xl:border-b-0 xl:border-r xl:py-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--pc-accent)]">
            <Search className="h-3.5 w-3.5" />
            Find a Device
          </div>
          <h2 className="mt-3 max-w-2xl font-display text-[2rem] uppercase leading-none tracking-[0.04em] text-[var(--pc-text)] sm:text-[2.3rem]">
            Open the exact machine without digging
          </h2>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-6 text-[var(--pc-text-secondary)]">
            Search by device name, serial number, primary user, or property label.
            Press Enter to open the filtered queue, or click a result to jump straight into the device.
          </p>

          <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--pc-text-muted)]" />
                <Input
                  name="master-device-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search devices by name, serial, UPN, or property…"
                  className="h-11 rounded-xl border-[var(--pc-border-hover)] bg-[var(--pc-surface-overlay)] pl-10 text-[14px]"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--pc-accent)] px-4 text-[13px] font-semibold text-white transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-[var(--pc-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
              >
                <TabletSmartphone className="h-4 w-4" />
                Search devices
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--pc-text-muted)]">
              <button
                type="button"
                onClick={() => requestCommandPaletteOpen()}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--pc-border)] bg-[var(--pc-tint-subtle)] px-2.5 py-1 text-[var(--pc-text-secondary)] transition-colors hover:border-[var(--pc-border-hover)] hover:text-[var(--pc-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
              >
                <Command className="h-3.5 w-3.5" />
                Open global command search
              </button>
              <span>Tip: search starts returning live devices after 2 characters.</span>
            </div>
          </form>
        </div>

        <div className="px-5 py-5 sm:px-6 xl:py-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[var(--pc-text-muted)]">
                Live Matches
              </div>
              <div className="mt-1 text-[13px] text-[var(--pc-text-secondary)]">
                {trimmed.length < 2
                  ? "Start typing to see matching devices here."
                  : `${devices.length} matching device${devices.length === 1 ? "" : "s"} in cache.`}
              </div>
            </div>
            <Link
              to="/devices"
              search={{ ...DEVICE_QUEUE_SEARCH, search: trimmed || undefined }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--pc-border)] px-2.5 py-1 text-[11.5px] text-[var(--pc-text-secondary)] transition-colors hover:border-[var(--pc-border-hover)] hover:text-[var(--pc-text)]"
            >
              Open queue
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-2.5">
            {trimmed.length < 2 ? (
              <>
                <QuickLink
                  to="/devices"
                  search={{ ...DEVICE_QUEUE_SEARCH, health: "critical" }}
                  title="Critical device queue"
                  detail="Open the highest-risk machines immediately."
                />
                <QuickLink
                  to="/devices"
                  search={{ ...DEVICE_QUEUE_SEARCH, health: "warning" }}
                  title="Warning device queue"
                  detail="Review devices drifting before they tip into critical."
                />
                <QuickLink
                  to="/devices"
                  search={{ ...DEVICE_QUEUE_SEARCH }}
                  title="Full device inventory"
                  detail="Browse every correlated Windows device in Runway."
                />
              </>
            ) : searchResults.isFetching ? (
              <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-[var(--pc-border)] bg-[var(--pc-tint-subtle)] text-[13px] text-[var(--pc-text-muted)]">
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Searching devices…
              </div>
            ) : devices.length > 0 ? (
              devices.map((device) => (
                <button
                  key={device.deviceKey}
                  type="button"
                  onClick={() => openDevice(device.deviceKey)}
                  className="flex w-full cursor-pointer items-start gap-3 rounded-2xl border border-[var(--pc-border)] bg-[var(--pc-tint-subtle)] px-3.5 py-3 text-left transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-tint-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
                >
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--pc-accent-muted)] text-[var(--pc-accent)]">
                    <TabletSmartphone className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-[13.5px] font-semibold text-[var(--pc-text)]">
                        {device.deviceName ?? device.serialNumber ?? device.deviceKey}
                      </div>
                      <HealthPill health={device.health} />
                    </div>
                    <div className="mt-1 truncate text-[12px] text-[var(--pc-text-secondary)]">
                      {[device.serialNumber, device.propertyLabel, device.assignedProfileName]
                        .filter(Boolean)
                        .join(" · ") || device.diagnosis}
                    </div>
                    <div className="mt-2 text-[11px] text-[var(--pc-text-muted)]">
                      {device.flagCount > 0
                        ? `${device.flagCount} active signal${device.flagCount === 1 ? "" : "s"}`
                        : "No active signals"}
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--pc-text-muted)]" />
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--pc-border)] bg-[var(--pc-tint-subtle)] px-4 py-8 text-center">
                <div className="text-[13px] font-medium text-[var(--pc-text)]">No matching devices</div>
                <div className="mt-1 text-[12px] text-[var(--pc-text-muted)]">
                  Try a broader serial fragment, UPN, or device name.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function QuickLink({
  to,
  search,
  title,
  detail
}: {
  to: "/devices";
  search: typeof DEVICE_QUEUE_SEARCH;
  title: string;
  detail: string;
}) {
  return (
    <Link
      to={to}
      search={search}
      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--pc-border)] bg-[var(--pc-tint-subtle)] px-3.5 py-3 transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-tint-hover)]"
    >
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--pc-surface-overlay)] text-[var(--pc-text-secondary)]">
        <ArrowRight className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold text-[var(--pc-text)]">{title}</div>
        <div className="mt-1 text-[12px] leading-5 text-[var(--pc-text-secondary)]">{detail}</div>
      </div>
    </Link>
  );
}
