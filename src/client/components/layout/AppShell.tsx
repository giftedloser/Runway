import { Outlet } from "@tanstack/react-router";

import { Sidebar } from "./Sidebar.js";

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-[var(--pc-bg)]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1440px] px-6 py-6 lg:px-10 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
