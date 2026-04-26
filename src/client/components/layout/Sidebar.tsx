import { Link, useRouterState, useSearch } from "@tanstack/react-router";
import {
  Building2,
  Command,
  DatabaseZap,
  GitBranch,
  History,
  LayoutDashboard,
  Moon,
  Palette,
  Search,
  Flame,
  Settings2,
  ShieldCheck,
  Sun,
  TabletSmartphone,
  UsersRound,
} from "lucide-react";

import { useSettings } from "../../hooks/useSettings.js";
import { useTheme, type Theme } from "../../hooks/useTheme.js";
import { cn } from "../../lib/utils.js";
import { requestCommandPaletteOpen } from "../command/events.js";
import { AuthIndicator } from "./AuthIndicator.js";

declare const __APP_VERSION__: string;

// When rendered in a Vitest jsdom env the `define` replacement may not fire
// (the top-level define doesn't cascade into `projects`), so fall back to a
// global or a dev placeholder rather than crashing the component tree.
const appVersion =
  typeof __APP_VERSION__ !== "undefined"
    ? __APP_VERSION__
    : ((globalThis as { __APP_VERSION__?: string }).__APP_VERSION__ ?? "dev");

const themeIcons: Record<Theme, typeof Sun> = {
  bone: Sun,
  void: Moon,
  foundry: Flame,
  oxidized: Palette,
};
const themeLabels: Record<Theme, string> = {
  bone: "Bone",
  void: "Void",
  foundry: "Foundry",
  oxidized: "Oxidized",
};

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Triage",
    items: [
      { to: "/", label: "Overview", icon: LayoutDashboard },
      { to: "/devices", label: "Devices", icon: TabletSmartphone },
    ],
  },
  {
    label: "Inspect",
    items: [
      { to: "/profiles", label: "Profiles", icon: ShieldCheck },
      { to: "/groups", label: "Groups", icon: UsersRound },
      { to: "/provisioning", label: "Provisioning", icon: GitBranch },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/sync", label: "Sync", icon: DatabaseZap },
      { to: "/actions", label: "Action Audit", icon: History },
      { to: "/settings", label: "Settings", icon: Settings2 },
    ],
  },
];

export function Sidebar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const settings = useSettings();
  const [theme, cycleTheme] = useTheme();

  // Properties pulled from tag_config so each casino's leader can jump
  // straight to "their" devices. Deduped because the same property label
  // may map to multiple group tags.
  const properties = (() => {
    if (!settings.data) return [] as string[];
    const seen = new Set<string>();
    for (const tag of settings.data.tagConfig) {
      if (tag.propertyLabel && !seen.has(tag.propertyLabel)) {
        seen.add(tag.propertyLabel);
      }
    }
    return Array.from(seen).sort();
  })();

  return (
    <aside className="flex h-auto w-full shrink-0 flex-col border-b border-[var(--pc-border)] bg-[var(--pc-surface)] lg:sticky lg:top-0 lg:h-[calc(100vh-var(--pc-titlebar-height,0px))] lg:w-[218px] lg:self-start lg:border-b-0 lg:border-r">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 py-3 lg:px-4 lg:py-4">
        <img
          src="/runway.png"
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 object-contain"
        />
        <div className="min-w-0">
          <div className="font-brand text-[21px] uppercase leading-none tracking-[0.16em] text-[var(--pc-text)]">
            Runway
          </div>
          <div className="truncate pl-[0.08em] text-[10.5px] uppercase tracking-[0.18em] text-[var(--pc-text-muted)]">
            Autopilot · Intune · Entra
          </div>
        </div>
        {(() => {
          const ThemeIcon = themeIcons[theme];
          return (
            <button
              type="button"
              onClick={cycleTheme}
              className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--pc-border)] bg-[var(--pc-surface)] text-[var(--pc-icon-primary)] transition-[border-color,color,background-color,transform] hover:-translate-y-0.5 hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-surface-raised)] hover:text-[var(--pc-text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)] lg:hidden"
              title={`Current: ${themeLabels[theme]}. Click to cycle.`}
              aria-label={`Current theme: ${themeLabels[theme]}. Click to cycle theme.`}
            >
              <ThemeIcon aria-hidden="true" className="h-4 w-4" />
            </button>
          );
        })()}
      </div>

      <div className="hidden px-3 pb-2 lg:block">
        <button
          type="button"
          onClick={requestCommandPaletteOpen}
          className="flex w-full items-center justify-between rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2.5 py-2 text-left transition-[border-color,background-color,color] hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-surface-overlay)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
          aria-label="Open command search"
        >
          <span className="flex items-center gap-2 text-[12px] text-[var(--pc-text-secondary)]">
            <Search className="h-3.5 w-3.5" />
            Search devices
          </span>
          <span className="flex items-center gap-1 text-[10px] text-[var(--pc-text-muted)]">
            <Command className="h-3 w-3" />K
          </span>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 gap-1.5 overflow-x-auto overscroll-x-contain px-3 pb-3 lg:mt-1 lg:flex-col lg:gap-2.5 lg:overflow-y-auto lg:px-3">
        {navGroups.map((group) => (
          <div
            key={group.label}
            className="contents lg:flex lg:shrink-0 lg:flex-col lg:gap-0.5"
          >
            <div className="mb-1 hidden px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--pc-text-muted)] lg:block">
              {group.label}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.to ||
                (item.to !== "/" && pathname.startsWith(item.to));
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "group flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[var(--pc-radius-sm)] border-l-2 px-2.5 py-1.5 text-[12px] font-medium transition-[background-color,border-color,color,transform] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)] lg:gap-2.5 lg:whitespace-normal",
                    active
                      ? "border-[var(--pc-accent)] bg-[var(--pc-surface-raised)] text-[var(--pc-text-heading)]"
                      : "border-transparent text-[var(--pc-text-body)] hover:bg-[var(--pc-surface-raised)] hover:text-[var(--pc-text-heading)] hover:translate-x-0.5",
                  )}
                >
                  <Icon
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110"
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}

        {properties.length > 0 && (
          <PropertiesGroup properties={properties} pathname={pathname} />
        )}
      </nav>

      {/* Footer */}
      <div className="hidden space-y-2.5 border-t border-[var(--pc-border)] px-3 py-3 lg:block">
        <AuthIndicator />
        <div className="flex items-center justify-between px-2 text-[10.5px]">
          <span className="text-[var(--pc-text-muted)]">Engine</span>
          <span className="font-mono text-[var(--pc-text-secondary)]">
            v{appVersion}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 px-2 text-[10.5px] text-[var(--pc-text-muted)]">
          <span>Theme</span>
          {(() => {
            const ThemeIcon = themeIcons[theme];
            return (
              <button
                type="button"
                onClick={cycleTheme}
                className="flex items-center gap-1.5 rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface)] px-2 py-1 text-[10.5px] text-[var(--pc-text-body)] transition-[border-color,color,background-color] hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-surface-raised)] hover:text-[var(--pc-text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
                title={`Current: ${themeLabels[theme]}. Click to cycle.`}
                aria-label={`Current theme: ${themeLabels[theme]}. Click to cycle theme.`}
              >
                <ThemeIcon aria-hidden="true" className="h-3 w-3" />
                {themeLabels[theme]}
              </button>
            );
          })()}
        </div>
        <div className="flex items-center justify-between gap-2 px-2 text-[10.5px] text-[var(--pc-text-muted)]">
          <span>Shortcuts</span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--pc-text-secondary)]">
              ?
            </kbd>
            <span className="text-[var(--pc-text-muted)]">·</span>
            <kbd className="rounded border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--pc-text-secondary)]">
              ⌘K
            </kbd>
          </span>
        </div>
      </div>
    </aside>
  );
}

/**
 * Properties group is rendered as its own component so we can call
 * `useSearch` (which only resolves on the matching route) without
 * unconditionally subscribing the rest of the sidebar to /devices state.
 */
function PropertiesGroup({
  properties,
  pathname,
}: {
  properties: string[];
  pathname: string;
}) {
  // useSearch with `strict: false` returns whatever search the closest
  // matched route has — so we get the active property only when we're on
  // /devices, otherwise an empty object.
  const search = useSearch({ strict: false }) as { property?: string };
  const activeProperty = pathname.startsWith("/devices")
    ? search.property
    : undefined;

  return (
    <div className="hidden flex-col gap-0.5 lg:flex">
      <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--pc-text-muted)]">
        Properties
      </div>
      {properties.map((property) => {
        const active = activeProperty === property;
        return (
          <Link
            key={property}
            to="/devices"
            search={{
              search: undefined,
              health: undefined,
              flag: undefined,
              property,
              profile: undefined,
              page: 1,
              pageSize: 25,
            }}
            className={cn(
              "flex items-center gap-3 rounded-lg border-l-2 px-3 py-1.5 text-[12px] font-medium transition-[background-color,border-color,color,transform] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]",
              active
                ? "border-[var(--pc-accent)] bg-[var(--pc-surface-raised)] text-[var(--pc-text-heading)]"
                : "border-transparent text-[var(--pc-text-body)] hover:bg-[var(--pc-surface-raised)] hover:text-[var(--pc-text-heading)] hover:translate-x-0.5",
            )}
            title={`Filter device queue to ${property}`}
          >
            <Building2
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0 opacity-70"
            />
            <span className="truncate">{property}</span>
          </Link>
        );
      })}
    </div>
  );
}
