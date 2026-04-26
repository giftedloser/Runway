import { Outlet } from "@tanstack/react-router";

import { CommandPalette } from "../command/CommandPalette.js";
import { KeyboardShortcuts } from "../command/KeyboardShortcuts.js";
import { ToastProvider } from "../shared/toast.js";
import { MockModeBanner } from "./MockModeBanner.js";
import { Sidebar } from "./Sidebar.js";
import { UnauthenticatedListener } from "./UnauthenticatedListener.js";

export function AppShell() {
  // Note: the window is the scroll container (not an inner <main>) so that
  // TanStack Router's built-in scroll restoration works on back/forward nav.
  return (
    <ToastProvider>
      <UnauthenticatedListener />
      <a href="#main-content" className="pc-skip-link">
        Skip to Main Content
      </a>
      <div className="flex min-h-[calc(100vh-var(--pc-titlebar-height,0px))] flex-col bg-[var(--pc-bg)]">
        <MockModeBanner />
        <div className="flex flex-1 flex-col lg:flex-row lg:items-start">
          <Sidebar />
          <main
            id="main-content"
            className="min-w-0 flex-1 overflow-x-hidden bg-[linear-gradient(180deg,var(--pc-tint-subtle),transparent_24rem)]"
          >
            <div className="pc-page-enter mx-auto w-full max-w-[1680px] px-3 pb-16 pt-4 sm:px-5 lg:px-6 lg:pb-20 lg:pt-6 xl:px-8">
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
