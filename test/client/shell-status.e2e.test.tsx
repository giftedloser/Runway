import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function appSetting(key: string, value: string | number | boolean) {
  return {
    key,
    section: key.startsWith("display.") ? "display-behavior" : "admin-operational",
    label: key.split(".").at(-1) ?? key,
    description: `${key} setting`,
    accessTier: key.startsWith("display.") ? "public-local" : "admin-operational",
    value,
    defaultValue: value,
    valueType: typeof value,
    source: "default",
    envVar: null,
    updatedAt: null,
    restartRequired: false,
  };
}

function settingsPayload(propertyCount = 0) {
  return {
    graph: { configured: true, missing: [] },
    appAccess: {
      mode: "disabled",
      required: false,
      allowedUsersConfigured: false,
      allowedUsersCount: 0,
    },
    appSettings: [
      appSetting("display.theme", "system"),
      appSetting("display.dateFormat", "relative"),
      appSetting("display.timeFormat", "24h"),
      appSetting("display.tablePageSize", 50),
      appSetting("display.defaultLandingScreen", "devices"),
      appSetting("security.sessionTimeoutMinutes", 60),
    ],
    about: {
      appVersion: "1.5.1",
      databaseSchemaVersion: "14",
      lastMigration: "014-app-settings.sql",
      logLevel: "info",
    },
    featureFlags: { sccm_detection: false },
    tagConfig: Array.from({ length: propertyCount }, (_item, index) => ({
      groupTag: `TAG-${index + 1}`,
      propertyLabel: `Property ${index + 1}`,
      expectedProfileNames: [],
      expectedGroupNames: [],
    })),
  };
}

describe("app shell setup and sync status", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/sync");
    window.sessionStorage.clear();
  });

  it("shows the first-run banner while setup is incomplete", async () => {
    mockShellFetch({
      syncStatus: syncStatus({ lastCompletedAt: null }),
      firstRun: {
        graphCredentialsPresent: false,
        successfulSyncCompleted: false,
        deviceRowsPresent: false,
        complete: false,
      },
    });

    await renderApp();

    expect(
      await screen.findByText("Welcome to Runway. Connect your tenant and run an initial sync to get started."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to setup/i })).toBeInTheDocument();
  });

  it("hides the first-run banner once setup is complete", async () => {
    mockShellFetch({
      syncStatus: syncStatus({ lastCompletedAt: "2026-05-01T10:00:00.000Z" }),
      firstRun: {
        graphCredentialsPresent: true,
        successfulSyncCompleted: true,
        deviceRowsPresent: true,
        complete: true,
      },
    });

    await renderApp();

    expect(await screen.findByText("Data Ingestion")).toBeInTheDocument();
    expect(screen.queryByText(/Welcome to Runway/i)).not.toBeInTheDocument();
  });

  it("shows sync pill failure state", async () => {
    mockShellFetch({
      syncStatus: syncStatus({ lastError: "Graph request failed: 503" }),
      firstRun: {
        graphCredentialsPresent: true,
        successfulSyncCompleted: true,
        deviceRowsPresent: true,
        complete: true,
      },
    });

    await renderApp();

    expect(await screen.findByRole("button", { name: /sync failed - click for details/i })).toBeInTheDocument();
  });

  it("keeps 30 property links keyboard accessible while footer remains rendered", async () => {
    mockShellFetch({
      propertyCount: 30,
      syncStatus: syncStatus({ lastCompletedAt: "2026-05-01T10:00:00.000Z" }),
      firstRun: {
        graphCredentialsPresent: true,
        successfulSyncCompleted: true,
        deviceRowsPresent: true,
        complete: true,
      },
    });

    await renderApp();

    expect(await screen.findByRole("link", { name: /property 30/i })).toBeInTheDocument();
    expect(screen.getByText("Engine")).toBeInTheDocument();
  });
});

function syncStatus(overrides: Record<string, unknown>) {
  return {
    inProgress: false,
    currentSyncType: null,
    startedAt: null,
    lastCompletedAt: "2026-05-01T10:00:00.000Z",
    lastSyncType: "manual",
    lastError: null,
    canTriggerManualSync: false,
    graphConfigured: true,
    logs: [],
    ...overrides,
  };
}

function mockShellFetch({
  syncStatus,
  firstRun,
  propertyCount = 0,
}: {
  syncStatus: Record<string, unknown>;
  firstRun: Record<string, unknown>;
  propertyCount?: number;
}) {
  global.fetch = vi.fn(async (input) => {
    const url = String(input);
    if (url.includes("/api/settings")) return jsonResponse(settingsPayload(propertyCount));
    if (url.includes("/api/sync/status")) return jsonResponse(syncStatus);
    if (url.includes("/api/setup/status")) return jsonResponse(firstRun);
    if (url.includes("/api/auth/access-status"))
      return jsonResponse({
        required: false,
        configured: false,
        mode: "disabled",
        authenticated: false,
        user: null,
        name: null,
        expiresAt: null,
        allowedUsersConfigured: false,
        reason: "App access enforcement is disabled.",
      });
    if (url.includes("/api/auth/status"))
      return jsonResponse({ authenticated: false, user: null, name: null, expiresAt: null });
    return jsonResponse({ message: "Not found" }, 404);
  }) as typeof fetch;
}

async function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const { App } = await import("../../src/client/App.js");
  render(
    <QueryClientProvider client={queryClient}>
      <App queryClient={queryClient} />
    </QueryClientProvider>,
  );
  return queryClient;
}
