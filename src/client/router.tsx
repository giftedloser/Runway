import { Link, createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";
import { FileQuestion } from "lucide-react";

import { ActionAuditPage } from "./routes/ActionAudit.js";
import { AppShell } from "./components/layout/AppShell.js";
import { DashboardPage } from "./routes/Dashboard.js";
import { DeviceDetailPage } from "./routes/DeviceDetail.js";
import { DeviceListPage } from "./routes/DeviceList.js";
import { GroupInspectorPage } from "./routes/GroupInspector.js";
import { ProfileAuditPage } from "./routes/ProfileAudit.js";
import { ProvisioningBuilderPage } from "./routes/ProvisioningBuilder.js";
import { SettingsPage } from "./routes/Settings.js";
import { SetupPage } from "./routes/setup.js";
import { SyncStatusPage } from "./routes/SyncStatus.js";

function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--pc-accent)]/10">
        <FileQuestion className="h-8 w-8 text-[var(--pc-accent)]" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-[var(--pc-text)]">
        Page not found
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-[var(--pc-text-secondary)]">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[var(--pc-accent)] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[var(--pc-accent-hover)] hover:shadow-md"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: AppShell,
  notFoundComponent: NotFoundPage
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage
});

const devicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/devices",
  validateSearch: (search: Record<string, unknown>) => ({
    search: typeof search.search === "string" ? search.search : undefined,
    health: typeof search.health === "string" ? search.health : undefined,
    flag: typeof search.flag === "string" ? search.flag : undefined,
    property: typeof search.property === "string" ? search.property : undefined,
    profile: typeof search.profile === "string" ? search.profile : undefined,
    page:
      typeof search.page === "number"
        ? search.page
        : typeof search.page === "string"
          ? Number(search.page)
          : 1,
    pageSize:
      typeof search.pageSize === "number"
        ? search.pageSize
        : typeof search.pageSize === "string"
          ? Number(search.pageSize)
          : 25
  }),
  component: DeviceListPage
});

const DEVICE_DETAIL_TABS = [
  "identity",
  "targeting",
  "enrollment",
  "drift",
  "operate",
  "history"
] as const;

const deviceDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/devices/$deviceKey",
  validateSearch: (search: Record<string, unknown>) => ({
    tab:
      typeof search.tab === "string" &&
      (DEVICE_DETAIL_TABS as readonly string[]).includes(search.tab)
        ? (search.tab as (typeof DEVICE_DETAIL_TABS)[number])
        : undefined
  }),
  component: DeviceDetailPage
});

const profilesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/profiles",
  component: ProfileAuditPage
});

const groupsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/groups",
  validateSearch: (search: Record<string, unknown>) => ({
    groupId: typeof search.groupId === "string" ? search.groupId : undefined
  }),
  component: GroupInspectorPage
});

const syncRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sync",
  component: SyncStatusPage
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage
});

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/setup",
  component: SetupPage
});

const provisioningRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/provisioning",
  component: ProvisioningBuilderPage
});

const actionAuditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/actions",
  component: ActionAuditPage
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  devicesRoute,
  deviceDetailRoute,
  profilesRoute,
  groupsRoute,
  syncRoute,
  settingsRoute,
  setupRoute,
  provisioningRoute,
  actionAuditRoute
]);

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: {
      queryClient
    },
    scrollRestoration: true,
    defaultPreload: "intent"
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
