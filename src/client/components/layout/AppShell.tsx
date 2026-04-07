import { Outlet } from "@tanstack/react-router";

import { CommandPalette } from "../command/CommandPalette.js";
import { KeyboardShortcuts } from "../command/KeyboardShortcuts.js";
import { ToastProvider } from "../shared/toast.js";
import { MockModeBanner } from "./MockModeBanner.js";
import { Sidebar } from "./Sidebar.js";

export function AppShell() {
  // Note: the window is the scroll container (not an inner <main>) so that
  // TanStack Router's built-in scroll restoration works on back/forward nav.
  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col bg-[var(--pc-bg)]">
        <MockModeBanner />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1">
            <div className="mx-auto w-full max-w-[1440px] px-6 py-6 lg:px-10 lg:py-8">
              <Outlet />
            </div>
          </main>
        </div>
        <CommandPalette />
        <KeyboardShortcuts />
      </div>
    </ToastProvider>
  );
}
