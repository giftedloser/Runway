import { Outlet } from "@tanstack/react-router";

import { CommandPalette } from "../command/CommandPalette.js";
import { KeyboardShortcuts } from "../command/KeyboardShortcuts.js";
import { ToastProvider } from "../shared/toast.js";
import { MockModeBanner } from "./MockModeBanner.js";
import { Sidebar } from "./Sidebar.js";
import { UnauthenticatedListener } from "./UnauthenticatedListener.js";

export function AppShell() {
  // In the desktop shell, scroll below the custom title bar so the root
  // scrollbar never reserves a gutter beside the window controls.
  return (
    <ToastProvider>
      <UnauthenticatedListener />
      <a href="#main-content" className="pc-skip-link">
        Skip to Main Content
      </a>
      <div className="mt-[var(--pc-titlebar-height,0px)] flex h-[calc(100vh-var(--pc-titlebar-height,0px))] flex-col overflow-y-auto bg-[var(--pc-bg)]">
        <MockModeBanner />
        <div className="flex flex-1 flex-col lg:flex-row lg:items-start lg:pl-[218px]">
          <Sidebar />
          <main
            id="main-content"
            className="min-w-0 flex-1 overflow-x-hidden bg-[linear-gradient(180deg,var(--pc-tint-subtle),transparent_24rem)]"
          >
            <div className="pc-page-enter mx-auto w-full max-w-[1680px] px-3 pb-12 pt-3 sm:px-5 lg:px-6 lg:pb-16 lg:pt-5 xl:px-7">
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
