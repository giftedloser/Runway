import { Link, useRouterState, useSearch } from "@tanstack/react-router";
import {
  Building2,
  CircleAlert,
  DatabaseZap,
  GitBranch,
  History,
  LayoutDashboard,
  Monitor,
  Moon,
  Palette,
  Search,
  Settings2,
  ShieldCheck,
  Sun,
  TabletSmartphone,
  Tags,
  UsersRound,
} from "lucide-react";

import { useSetAppSetting, useSettings } from "../../hooks/useSettings.js";
import { useFirstRunStatus } from "../../hooks/useSetup.js";
import {
  appThemeToLocalTheme,
  THEME_LABELS,
  THEMES,
  useTheme,
  type Theme
} from "../../hooks/useTheme.js";
import { cn } from "../../lib/utils.js";
import { requestCommandPaletteOpen } from "../command/events.js";
import { HelpTooltip } from "../shared/HelpTooltip.js";
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
  system: Monitor,
  "canopy-light": Sun,
  oled: Moon,
  slate: Moon,
  studio: Palette
};
interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  help?: {
    id: string;
    text: string;
  };
  firstRunIndicator?: boolean;
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
      {
        to: "/provisioning",
        label: "Provisioning Builder",
        icon: GitBranch,
        help: {
          id: "sidebar-provisioning",
          text: "Provisioning Builder traces one tag through target groups, profile assignment, devices, and build payload readiness."
        }
      },
    ],
  },
  {
    label: "Inventory",
    items: [
      {
        to: "/tags",
        label: "Tags",
        icon: Tags,
        help: {
          id: "sidebar-tags",
          text: "Tags lists Autopilot group tags discovered from synced devices and the local mappings Runway uses for property context."
        }
      },
      {
        to: "/groups",
        label: "Groups",
        icon: UsersRound,
        help: {
          id: "sidebar-groups",
          text: "Group Inspector shows synced Entra groups, membership, assignment rules, and targeted profiles."
        }
      },
      { to: "/profiles", label: "Profiles", icon: ShieldCheck },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/actions", label: "Action Audit", icon: History },
      { to: "/sync", label: "Sync", icon: DatabaseZap },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/setup", label: "Setup", icon: CircleAlert, firstRunIndicator: true },
      {
        to: "/settings",
        label: "Settings",
        icon: Settings2,
        help: {
          id: "sidebar-settings",
          text: "Settings includes local display preferences, setup, sync behavior, rules, and protected security options."
        },
        firstRunIndicator: true
      },
    ],
  },
];

export function Sidebar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const settings = useSettings();
  const firstRun = useFirstRunStatus();
  const [, , , setTheme] = useTheme();
  const setAppSetting = useSetAppSetting();
  const theme = appThemeToLocalTheme(
    String(
      settings.data?.appSettings.find((setting) => setting.key === "display.theme")?.value ??
        "system"
    )
  );
  const cycleTheme = () => {
    const nextTheme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    setAppSetting.mutate(
      { key: "display.theme", value: nextTheme },
      {
        onSuccess: (updated) => {
          setTheme(appThemeToLocalTheme(String(updated.value)));
        }
      }
    );
  };

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
    <aside className="flex h-auto w-full shrink-0 flex-col border-b border-[var(--pc-sidebar-border)] bg-[var(--pc-sidebar-bg)] text-[var(--pc-sidebar-text)] lg:fixed lg:left-0 lg:top-[var(--pc-titlebar-height,0px)] lg:h-[calc(100vh-var(--pc-titlebar-height,0px))] lg:w-[218px] lg:border-b-0 lg:border-r">
      {/* Mobile brand; desktop branding lives in the title bar. */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 lg:hidden">
        <img
          src="/runway.png"
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 object-contain"
        />
        <div className="min-w-0">
          <div className="font-brand text-[20px] uppercase leading-none tracking-[0.14em] text-[var(--pc-sidebar-text-active)]">
            Runway
          </div>
        </div>
        {(() => {
          const ThemeIcon = themeIcons[theme];
          return (
            <button
              type="button"
              onClick={cycleTheme}
              className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--pc-sidebar-border)] bg-[var(--pc-sidebar-bg)] text-[var(--pc-sidebar-text)] transition-[border-color,color,background-color,transform] hover:-translate-y-0.5 hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-sidebar-border)] hover:text-[var(--pc-sidebar-text-active)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
              disabled={setAppSetting.isPending}
              title={`Current: ${THEME_LABELS[theme]}. Click to cycle.`}
              aria-label={`Current theme: ${THEME_LABELS[theme]}. Click to cycle theme.`}
            >
              <ThemeIcon aria-hidden="true" className="h-4 w-4" />
            </button>
          );
        })()}
      </div>

      <div className="hidden px-3 pb-2 pt-3 lg:block">
        <button
          type="button"
          onClick={requestCommandPaletteOpen}
          className="flex w-full items-center justify-between rounded-[var(--pc-radius)] border border-[var(--pc-sidebar-border)] bg-[var(--pc-sidebar-bg)] px-2.5 py-2 text-left transition-[border-color,background-color,color] hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-sidebar-border)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
          aria-label="Open command search"
        >
          <span className="flex items-center gap-2 text-[12px] text-[var(--pc-sidebar-text)]">
            <Search className="h-3.5 w-3.5" />
            Search devices
          </span>
          <span className="font-mono text-[10px] text-[var(--pc-sidebar-text)]">
            Ctrl+K
          </span>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 gap-1.5 overflow-x-auto overscroll-x-contain px-3 pb-3 lg:mt-1 lg:min-h-0 lg:flex-col lg:gap-2.5 lg:overflow-x-hidden lg:overflow-y-auto lg:px-3">
        {navGroups.map((group) => (
          <div
            key={group.label}
            className="contents lg:flex lg:shrink-0 lg:flex-col lg:gap-0.5"
          >
            <div className="mb-1 hidden px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--pc-sidebar-text)] lg:block">
              {group.label}
            </div>
            {group.items.map((item) => {
              const Icon = item.icon;
              const showFirstRunIndicator =
                item.firstRunIndicator && firstRun.data && !firstRun.data.complete;
              const active =
                pathname === item.to ||
                (item.to !== "/" && pathname.startsWith(item.to));
              return (
                <div
                  key={item.to}
                  className={cn(
                    "group flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[var(--pc-radius-sm)] border-l-2 transition-[background-color,border-color,color,transform] duration-150 lg:whitespace-normal",
                    active
                      ? "border-[var(--pc-accent)] bg-[var(--pc-sidebar-border)] text-[var(--pc-sidebar-text-active)]"
                      : "border-transparent text-[var(--pc-sidebar-text)] hover:bg-[var(--pc-sidebar-border)] hover:text-[var(--pc-sidebar-text-active)] hover:translate-x-0.5",
                  )}
                >
                  <Link
                    to={item.to}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--pc-radius-sm)] px-2.5 py-1.5 text-[12px] font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)] lg:gap-2.5"
                  >
                    <Icon
                      aria-hidden="true"
                      className="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110"
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {showFirstRunIndicator ? (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--pc-warning)]"
                        aria-label="Setup incomplete"
                      />
                    ) : null}
                  </Link>
                  {item.help ? (
                    <HelpTooltip
                      id={item.help.id}
                      align="end"
                      tone="sidebar"
                      className="mr-1 hidden lg:inline-flex"
                    >
                      {item.help.text}
                    </HelpTooltip>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}

        {properties.length > 0 && (
          <PropertiesGroup properties={properties} pathname={pathname} />
        )}
      </nav>

      {/* Footer */}
      <div className="hidden space-y-2 border-t border-[var(--pc-sidebar-border)] px-3 py-3 lg:block">
        <AuthIndicator />
        <div className="flex items-center justify-between px-2 text-[10.5px]">
          <span className="text-[var(--pc-sidebar-text)]">Engine</span>
          <span className="font-mono text-[var(--pc-sidebar-text)]">
            v{appVersion}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 px-2 text-[10.5px] text-[var(--pc-sidebar-text)]">
          <span>Theme</span>
          {(() => {
            const ThemeIcon = themeIcons[theme];
            return (
              <button
                type="button"
                onClick={cycleTheme}
                className="flex items-center gap-1.5 rounded-md border border-[var(--pc-sidebar-border)] bg-[var(--pc-sidebar-bg)] px-2 py-1 text-[10.5px] text-[var(--pc-sidebar-text)] transition-[border-color,color,background-color] hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-sidebar-border)] hover:text-[var(--pc-sidebar-text-active)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
                disabled={setAppSetting.isPending}
                title={`Current: ${THEME_LABELS[theme]}. Click to cycle.`}
                aria-label={`Current theme: ${THEME_LABELS[theme]}. Click to cycle theme.`}
              >
                <ThemeIcon aria-hidden="true" className="h-3 w-3" />
                {THEME_LABELS[theme]}
              </button>
            );
          })()}
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
      <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--pc-sidebar-text)]">
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
                ? "border-[var(--pc-accent)] bg-[var(--pc-sidebar-border)] text-[var(--pc-sidebar-text-active)]"
                : "border-transparent text-[var(--pc-sidebar-text)] hover:bg-[var(--pc-sidebar-border)] hover:text-[var(--pc-sidebar-text-active)] hover:translate-x-0.5",
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
