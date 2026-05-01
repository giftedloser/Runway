import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdvancedDisclosure } from "../../src/client/components/shared/AdvancedDisclosure.js";

const northTagRows = [
  {
    groupTag: "North",
    deviceCount: 4,
    lastSeenAt: "2026-04-30T12:00:00.000Z",
    configured: true,
    propertyLabel: "North",
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function appSetting(key: string, value: string | number | boolean) {
  return {
    key,
    section: key.startsWith("sync.")
      ? "sync-data"
      : key.startsWith("retention.")
        ? "sync-data"
        : key.startsWith("rules.")
          ? "rules-thresholds"
          : key.startsWith("security.")
            ? "access-security"
            : "display-behavior",
    label:
      key === "display.theme"
        ? "Theme"
        : key
            .split(".")
            .at(-1)!
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (char) => char.toUpperCase()),
    description: `${key} setting`,
    accessTier: key.startsWith("display.") ? "public-local" : key.startsWith("security.") ? "secret-security" : "admin-operational",
    value,
    defaultValue: value,
    valueType: typeof value,
    source: "default",
    envVar: null,
    updatedAt: null,
    restartRequired: false,
  };
}

function buildSettingsPayload() {
  return {
    graph: { configured: true, missing: [] },
    appAccess: {
      mode: "disabled",
      required: false,
      allowedUsersConfigured: false,
      allowedUsersCount: 0,
    },
    appSettings: [
      appSetting("sync.intervalMinutes", 15),
      appSetting("sync.onLaunch", true),
      appSetting("sync.manualOnly", false),
      appSetting("sync.paused", false),
      appSetting("retention.deviceHistoryDays", 90),
      appSetting("retention.actionLogDays", 180),
      appSetting("retention.syncLogDays", 30),
      appSetting("retention.sweepIntervalHours", 24),
      appSetting("rules.profileAssignedNotEnrolledHours", 2),
      appSetting("rules.provisioningStalledHours", 8),
      appSetting("display.theme", "system"),
      appSetting("display.dateFormat", "relative"),
      appSetting("display.timeFormat", "24h"),
      appSetting("display.tablePageSize", 50),
      appSetting("display.defaultLandingScreen", "tags"),
      appSetting("security.sessionTimeoutMinutes", 60),
    ],
    about: {
      appVersion: "1.5.1",
      databaseSchemaVersion: "13",
      lastMigration: "013-graph-assignments.sql",
      logLevel: "info",
    },
    featureFlags: { sccm_detection: true },
    tagConfig: [
      {
        groupTag: "North",
        expectedProfileNames: ["North-UD"],
        expectedGroupNames: ["North-Devices"],
        propertyLabel: "North",
      },
    ],
  };
}

describe("cleanup settings flows", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/tags");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("toggles AdvancedDisclosure with Enter and Space", () => {
    render(
      <AdvancedDisclosure description="Rare operator controls.">
        <div>Advanced body</div>
      </AdvancedDisclosure>,
    );

    const toggle = screen.getByRole("button", { name: /advanced/i });
    expect(screen.getByText("Advanced body")).not.toBeVisible();

    fireEvent.keyDown(toggle, { key: "Enter" });
    expect(screen.getByText("Advanced body")).toBeVisible();

    fireEvent.keyDown(toggle, { key: " " });
    expect(screen.getByText("Advanced body")).not.toBeVisible();
  });

  it("disables tag mapping edits while settings tag_config is loading", async () => {
    const tagRows = [...northTagRows];

    global.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/api/provisioning/tags")) return jsonResponse(tagRows);
      if (url.includes("/api/settings")) return new Promise<Response>(() => {});
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
        return jsonResponse({ authenticated: true, user: "admin@example.test" });
      if (url.includes("/api/sync/status"))
        return jsonResponse({ inProgress: false, lastError: null, lastCompletedAt: null, canTriggerManualSync: true });
      if (url.includes("/api/setup/status"))
        return jsonResponse({ graphCredentialsPresent: true, successfulSyncCompleted: true, deviceRowsPresent: true, complete: true });
      return jsonResponse({ message: "Not found" }, 404);
    }) as typeof fetch;

    await renderApp();

    expect(await screen.findByText("Tag Inventory")).toBeInTheDocument();
    const editButton = screen.getByRole("button", {
      name: /cannot edit mapping for north: tag mappings are still loading/i,
    });
    expect(editButton).toBeDisabled();
    expect(editButton).toHaveAttribute(
      "title",
      expect.stringContaining("full tag_config data"),
    );
    expect(screen.queryByRole("dialog", { name: /tag mapping/i })).not.toBeInTheDocument();
  });

  it("disables tag mapping edits and shows retry when settings tag_config fails", async () => {
    const tagRows = [...northTagRows];

    global.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/api/provisioning/tags")) return jsonResponse(tagRows);
      if (url.includes("/api/settings"))
        return jsonResponse({ message: "Settings unavailable" }, 500);
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
        return jsonResponse({ authenticated: true, user: "admin@example.test" });
      if (url.includes("/api/sync/status"))
        return jsonResponse({ inProgress: false, lastError: null, lastCompletedAt: null, canTriggerManualSync: true });
      if (url.includes("/api/setup/status"))
        return jsonResponse({ graphCredentialsPresent: true, successfulSyncCompleted: true, deviceRowsPresent: true, complete: true });
      return jsonResponse({ message: "Not found" }, 404);
    }) as typeof fetch;

    await renderApp();

    expect(await screen.findByText("Tag mappings could not be loaded.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^retry settings$/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /cannot edit mapping for north: tag mappings could not be loaded/i,
      }),
    ).toBeDisabled();
    expect(screen.queryByRole("dialog", { name: /tag mapping/i })).not.toBeInTheDocument();
  });

  it("edits and saves a tag mapping from the Tags drawer", async () => {
    const settingsPayload = buildSettingsPayload();
    const tagRows = [...northTagRows];

    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/settings/tag-config") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        settingsPayload.tagConfig = [body];
        tagRows[0].propertyLabel = body.propertyLabel;
        return jsonResponse(settingsPayload.tagConfig, 201);
      }
      if (url.includes("/api/provisioning/tags")) return jsonResponse(tagRows);
      if (url.includes("/api/settings")) return jsonResponse(settingsPayload);
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
        return jsonResponse({ authenticated: true, user: "admin@example.test" });
      if (url.includes("/api/sync/status"))
        return jsonResponse({ inProgress: false, lastError: null, lastCompletedAt: null, canTriggerManualSync: true });
      if (url.includes("/api/setup/status"))
        return jsonResponse({ graphCredentialsPresent: true, successfulSyncCompleted: true, deviceRowsPresent: true, complete: true });
      return jsonResponse({ message: "Not found" }, 404);
    }) as typeof fetch;

    await renderApp();

    expect(await screen.findByText("Tag Inventory")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /edit mapping for north/i }));

    expect(await screen.findByRole("dialog", { name: /tag mapping/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/expected groups/i)).not.toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /advanced/i }));
    expect(screen.getByLabelText(/expected groups/i)).toBeVisible();
    expect(screen.getByLabelText(/expected groups/i)).toHaveValue("North-Devices");
    expect(screen.getByLabelText(/expected profiles/i)).toHaveValue("North-UD");

    fireEvent.change(screen.getByLabelText(/property label/i), {
      target: { value: "North Floor" },
    });
    fireEvent.change(screen.getByLabelText(/expected profiles/i), {
      target: { value: "North-UD, North-Kiosk" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save mapping/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/settings/tag-config",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            groupTag: "North",
            propertyLabel: "North Floor",
            expectedGroupNames: ["North-Devices"],
            expectedProfileNames: ["North-UD", "North-Kiosk"],
          }),
        }),
      );
    });
    expect(await screen.findByText("Tag mapping saved")).toBeInTheDocument();
  });

  it("keeps sidebar and Settings theme controls in sync", async () => {
    window.history.pushState({}, "", "/settings");
    const settingsPayload = buildSettingsPayload();

    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/settings/display.theme") && init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        const setting = settingsPayload.appSettings.find(
          (item) => item.key === "display.theme",
        )!;
        setting.value = body.value;
        setting.source = "db";
        return jsonResponse(setting);
      }
      if (url.includes("/api/settings/graph/env"))
        return jsonResponse({ envPath: "C:\\Runway\\.env", configured: true, missing: [] });
      if (url.includes("/api/settings")) return jsonResponse(settingsPayload);
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
        return jsonResponse({ authenticated: true, user: "admin@example.test" });
      if (url.includes("/api/sync/status"))
        return jsonResponse({ inProgress: false, lastError: null, lastCompletedAt: null, canTriggerManualSync: true });
      if (url.includes("/api/setup/status"))
        return jsonResponse({ graphCredentialsPresent: true, successfulSyncCompleted: true, deviceRowsPresent: true, complete: true });
      if (url.includes("/api/health/logs")) return jsonResponse([]);
      if (url.endsWith("/api/health"))
        return jsonResponse({
          ok: true,
          dbReady: true,
          uptimeSeconds: 60,
          graphConfigured: true,
          graphMissing: [],
          lastSyncCompletedAt: null,
          syncBacklogMinutes: null,
          retention: null,
        });
      if (url.includes("/api/rules")) return jsonResponse([]);
      return jsonResponse({ message: "Not found" }, 404);
    }) as typeof fetch;

    await renderApp();

    expect(await screen.findByText("Display & Behavior")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /current theme: system/i })[0]);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Canopy Light")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("Canopy Light"), {
      target: { value: "oled" },
    });

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /current theme: oled/i })).not.toHaveLength(0);
    });
  });

  it("allows changing theme without delegated admin sign-in", async () => {
    window.history.pushState({}, "", "/settings");
    const settingsPayload = buildSettingsPayload();

    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/settings/display.theme") && init?.method === "PUT") {
        const body = JSON.parse(String(init.body));
        const setting = settingsPayload.appSettings.find(
          (item) => item.key === "display.theme",
        )!;
        setting.value = body.value;
        setting.source = "db";
        return jsonResponse(setting);
      }
      if (url.includes("/api/settings/graph/env"))
        return jsonResponse({ envPath: "C:\\Runway\\.env", configured: true, missing: [] });
      if (url.includes("/api/settings")) return jsonResponse(settingsPayload);
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
      if (url.includes("/api/sync/status"))
        return jsonResponse({ inProgress: false, lastError: null, lastCompletedAt: null, canTriggerManualSync: false });
      if (url.includes("/api/setup/status"))
        return jsonResponse({ graphCredentialsPresent: true, successfulSyncCompleted: true, deviceRowsPresent: true, complete: true });
      if (url.includes("/api/health/logs")) return jsonResponse([]);
      if (url.endsWith("/api/health"))
        return jsonResponse({
          ok: true,
          dbReady: true,
          uptimeSeconds: 60,
          graphConfigured: true,
          graphMissing: [],
          lastSyncCompletedAt: null,
          syncBacklogMinutes: null,
          retention: null,
        });
      if (url.includes("/api/rules")) return jsonResponse([]);
      return jsonResponse({ message: "Not found" }, 404);
    }) as typeof fetch;

    await renderApp();

    expect(await screen.findByText("Display & Behavior")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("System"), {
      target: { value: "studio" },
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/settings/display.theme",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ value: "studio" }),
        }),
      );
    });
    expect(await screen.findByText("Setting saved")).toBeInTheDocument();
  });
});

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
