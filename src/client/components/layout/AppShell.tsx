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
      <div className="flex min-h-screen flex-col bg-[var(--pc-bg)]">
        <MockModeBanner />
        <div className="flex flex-1 flex-col lg:flex-row">
          <Sidebar />
          <main id="main-content" className="min-w-0 flex-1">
            <div className="pc-page-enter mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
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
