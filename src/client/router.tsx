import { createRootRouteWithContext, createRoute, createRouter } from "@tanstack/react-router";
import type { QueryClient } from "@tanstack/react-query";

import { ActionAuditPage } from "./routes/ActionAudit.js";
import { AppShell } from "./components/layout/AppShell.js";
import { DashboardPage } from "./routes/Dashboard.js";
import { DeviceDetailPage } from "./routes/DeviceDetail.js";
import { DeviceListPage } from "./routes/DeviceList.js";
import { GroupInspectorPage } from "./routes/GroupInspector.js";
import { ProfileAuditPage } from "./routes/ProfileAudit.js";
import { SettingsPage } from "./routes/Settings.js";
import { SetupPage } from "./routes/Setup.js";
import { SyncStatusPage } from "./routes/SyncStatus.js";

const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: AppShell
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

const deviceDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/devices/$deviceKey",
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
