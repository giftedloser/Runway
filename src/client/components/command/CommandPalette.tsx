import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  DatabaseZap,
  History,
  LayoutDashboard,
  RefreshCcw,
  Search,
  Settings2,
  ShieldCheck,
  TabletSmartphone,
  UsersRound
} from "lucide-react";

import { apiRequest } from "../../lib/api.js";
import type { DeviceListItem } from "../../lib/types.js";
import { cn } from "../../lib/utils.js";
import { COMMAND_PALETTE_OPEN_EVENT } from "./events.js";

interface PageCommand {
  type: "page";
  id: string;
  title: string;
  hint: string;
  icon: typeof LayoutDashboard;
  action: () => void;
}

interface ActionCommand {
  type: "action";
  id: string;
  title: string;
  hint: string;
  icon: typeof RefreshCcw;
  action: () => void;
}

interface DeviceCommand {
  type: "device";
  id: string;
  device: DeviceListItem;
  action: () => void;
}

type Command = PageCommand | ActionCommand | DeviceCommand;

const DEVICE_DEFAULT_SEARCH = {
  search: undefined,
  health: undefined,
  flag: undefined,
  property: undefined,
  profile: undefined,
  page: 1,
  pageSize: 25
} as const;

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(handle);
  }, [value, ms]);
  return debounced;
}

export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounced(query, 150);

  // Global keybind: Cmd/Ctrl+K opens, Esc closes.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(COMMAND_PALETTE_OPEN_EVENT, onOpen);
  }, []);

  // Reset state when the palette is closed/opened.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      // focus after the dialog mounts
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const trimmed = debouncedQuery.trim();

  // Live device search via the existing list endpoint. We deliberately
  // keep this short and let the server cap pageSize.
  const deviceSearch = useQuery({
    queryKey: ["palette-search", trimmed],
    queryFn: () =>
      apiRequest<{ items: DeviceListItem[] }>(
        `/api/devices?search=${encodeURIComponent(trimmed)}&pageSize=8`
      ),
    enabled: open && trimmed.length >= 2,
    staleTime: 30_000
  });

  const close = () => setOpen(false);
  const go = (to: string, search?: Record<string, unknown>) => {
    close();
    void navigate({ to, search } as Parameters<typeof navigate>[0]);
  };
  const goDevice = (deviceKey: string) => {
    close();
    void navigate({ to: "/devices/$deviceKey", params: { deviceKey } });
  };

  const pages: PageCommand[] = useMemo(
    () => [
      {
        type: "page",
        id: "page-overview",
        title: "Start",
        hint: "Operator command center",
        icon: LayoutDashboard,
        action: () => go("/")
      },
      {
        type: "page",
        id: "page-devices",
        title: "Device Queue",
        hint: "Triage queue",
        icon: TabletSmartphone,
        action: () => go("/devices", DEVICE_DEFAULT_SEARCH)
      },
      {
        type: "page",
        id: "page-critical",
        title: "Needs Attention",
        hint: "Devices most likely to need action",
        icon: TabletSmartphone,
        action: () => go("/devices", { ...DEVICE_DEFAULT_SEARCH, health: "critical" })
      },
      {
        type: "page",
        id: "page-profiles",
        title: "Profiles",
        hint: "Profile audit",
        icon: ShieldCheck,
        action: () => go("/profiles")
      },
      {
        type: "page",
        id: "page-groups",
        title: "Groups",
        hint: "Group inspector",
        icon: UsersRound,
        action: () => go("/groups")
      },
      {
        type: "page",
        id: "page-sync",
        title: "Sync",
        hint: "Sync status & logs",
        icon: DatabaseZap,
        action: () => go("/sync")
      },
      {
        type: "page",
        id: "page-actions",
        title: "Action History",
        hint: "Cross-device action timeline",
        icon: History,
        action: () => go("/actions")
      },
      {
        type: "page",
        id: "page-settings",
        title: "Settings",
        hint: "Graph, mappings, rules",
        icon: Settings2,
        action: () => go("/settings")
      },
      {
        type: "page",
        id: "page-setup",
        title: "First-run Setup",
        hint: "Onboarding walkthrough",
        icon: ShieldCheck,
        action: () => go("/setup")
      }
    ],
    [navigate]
  );

  const actions: ActionCommand[] = useMemo(
    () => [
      {
        type: "action",
        id: "action-sync",
        title: "Run Sync Now",
        hint: "Trigger an incremental sync",
        icon: RefreshCcw,
        action: () => {
          close();
          void apiRequest("/api/sync", { method: "POST" });
        }
      }
    ],
    []
  );

  // Score & filter pages/actions client-side; devices come pre-filtered
  // from the server.
  const lower = trimmed.toLowerCase();
  const matchesQuery = (text: string) =>
    !lower ||
    text
      .toLowerCase()
      .split(/\s+/)
      .some((token) => token.startsWith(lower)) ||
    text.toLowerCase().includes(lower);

  const filteredPages = pages.filter((page) =>
    matchesQuery(`${page.title} ${page.hint}`)
  );
  const filteredActions = actions.filter((action) =>
    matchesQuery(`${action.title} ${action.hint}`)
  );

  const deviceCommands: DeviceCommand[] =
    trimmed.length >= 2 && deviceSearch.data
      ? deviceSearch.data.items.map((device) => ({
          type: "device" as const,
          id: `device-${device.deviceKey}`,
          device,
          action: () => goDevice(device.deviceKey)
        }))
      : [];

  const flatCommands: Command[] = [...filteredPages, ...filteredActions, ...deviceCommands];

  // Keep active index in range when results change.
  useEffect(() => {
    if (active >= flatCommands.length) setActive(0);
  }, [flatCommands.length, active]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) => Math.min(value + 1, Math.max(flatCommands.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => Math.max(value - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      flatCommands[active]?.action();
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--pc-border)] bg-[var(--pc-surface)] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--pc-border)] px-4 py-3">
          <Search className="h-4 w-4 text-[var(--pc-text-muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search devices, jump to a page, run an action…"
            name="command-search"
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-[14px] text-[var(--pc-text)] outline-none placeholder:text-[var(--pc-text-muted)]"
          />
          <kbd className="rounded border border-[var(--pc-border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--pc-text-muted)]">
            Esc
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-2">
          {filteredPages.length > 0 && (
            <CommandGroup
              label="Pages"
              startIndex={0}
              activeIndex={active}
              setActive={setActive}
              items={filteredPages.map((page) => ({
                id: page.id,
                title: page.title,
                hint: page.hint,
                icon: page.icon,
                onSelect: page.action
              }))}
            />
          )}
          {filteredActions.length > 0 && (
            <CommandGroup
              label="Actions"
              startIndex={filteredPages.length}
              activeIndex={active}
              setActive={setActive}
              items={filteredActions.map((action) => ({
                id: action.id,
                title: action.title,
                hint: action.hint,
                icon: action.icon,
                onSelect: action.action
              }))}
            />
          )}
          {deviceCommands.length > 0 && (
            <CommandGroup
              label="Devices"
              startIndex={filteredPages.length + filteredActions.length}
              activeIndex={active}
              setActive={setActive}
              items={deviceCommands.map((command) => ({
                id: command.id,
                title:
                  command.device.deviceName ??
                  command.device.serialNumber ??
                  command.device.deviceKey,
                hint:
                  [
                    command.device.serialNumber,
                    command.device.propertyLabel,
                    command.device.assignedProfileName
                  ]
                    .filter(Boolean)
                    .join(" · ") || command.device.health,
                icon: TabletSmartphone,
                onSelect: command.action
              }))}
            />
          )}
          {trimmed.length >= 2 && deviceSearch.isFetching && (
            <div className="px-4 py-3 text-[12px] text-[var(--pc-text-muted)]">
              Searching devices…
            </div>
          )}
          {flatCommands.length === 0 && !deviceSearch.isFetching && (
            <div className="px-4 py-6 text-center text-[12px] text-[var(--pc-text-muted)]">
              No matches
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-4 py-2 text-[10.5px] text-[var(--pc-text-muted)]">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-[var(--pc-border)] px-1 py-px font-mono">↑↓</kbd>{" "}
              navigate
            </span>
            <span>
              <kbd className="rounded border border-[var(--pc-border)] px-1 py-px font-mono">↵</kbd>{" "}
              open
            </span>
            <span>
              <kbd className="rounded border border-[var(--pc-border)] px-1 py-px font-mono">Ctrl+K</kbd>{" "}
              toggle
            </span>
          </div>
          <div>{flatCommands.length} results</div>
        </div>
      </div>
    </div>
  );
}

interface CommandGroupItem {
  id: string;
  title: string;
  hint: string;
  icon: typeof LayoutDashboard;
  onSelect: () => void;
}

function CommandGroup({
  label,
  items,
  startIndex,
  activeIndex,
  setActive
}: {
  label: string;
  items: CommandGroupItem[];
  startIndex: number;
  activeIndex: number;
  setActive: (index: number) => void;
}) {
  return (
    <div className="px-2 pb-2">
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--pc-text-muted)]">
        {label}
      </div>
      <ul>
        {items.map((item, index) => {
          const Icon = item.icon;
          const globalIndex = startIndex + index;
          const isActive = globalIndex === activeIndex;
          return (
            <li key={item.id}>
              <button
                type="button"
                onMouseEnter={() => setActive(globalIndex)}
                onClick={item.onSelect}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-[13px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]",
                  isActive
                    ? "bg-[var(--pc-accent-muted)] text-[var(--pc-text)]"
                    : "text-[var(--pc-text-secondary)] hover:bg-[var(--pc-tint-subtle)]"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-[var(--pc-accent)]" : "text-[var(--pc-text-muted)]"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-[var(--pc-text)]">{item.title}</div>
                  <div className="truncate text-[11px] text-[var(--pc-text-muted)]">
                    {item.hint}
                  </div>
                </div>
                {isActive && <ArrowRight className="h-3 w-3 text-[var(--pc-accent)]" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
