import { Link, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  DatabaseZap,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  TabletSmartphone
} from "lucide-react";

import { cn } from "../../lib/utils.js";

const navItems = [
  {
    to: "/",
    label: "Overview",
    icon: LayoutDashboard
  },
  {
    to: "/devices",
    label: "Devices",
    icon: TabletSmartphone
  },
  {
    to: "/profiles",
    label: "Profiles",
    icon: ShieldCheck
  },
  {
    to: "/sync",
    label: "Sync",
    icon: DatabaseZap
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings2
  }
];

export function Sidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r border-[var(--pc-border)] bg-[var(--pc-surface)]">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--pc-accent)] text-white">
          <Activity className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[15px] font-semibold tracking-tight text-white">PilotCheck</div>
          <div className="text-[11px] text-[var(--pc-text-muted)]">Autopilot Diagnostics</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="mt-1 flex flex-1 flex-col gap-0.5 px-3">
        <div className="mb-2 px-2 text-[11px] font-medium text-[var(--pc-text-muted)]">Navigation</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to));
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                active
                  ? "bg-[var(--pc-accent-muted)] text-[var(--pc-accent-hover)]"
                  : "text-[var(--pc-text-secondary)] hover:bg-white/[0.04] hover:text-[var(--pc-text)]"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--pc-border)] px-5 py-4">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[var(--pc-text-muted)]">Engine</span>
          <span className="font-mono text-[var(--pc-text-secondary)]">v0.1.0</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px]">
          <span className="text-[var(--pc-text-muted)]">Cache</span>
          <span className="font-mono text-[var(--pc-text-secondary)]">SQLite</span>
        </div>
      </div>
    </aside>
  );
}
