import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dashboardPayload = {
  lastSync: "2026-04-06T00:00:00.000Z",
  counts: { critical: 2, warning: 1, info: 1, healthy: 10, unknown: 0 },
  failurePatterns: [{ flag: "no_profile_assigned", count: 2, severity: "critical" }],
  driftCount: 1,
  newlyUnhealthy24h: 0,
  healthTrend: [],
  recentTransitions: [],
  correlationQuality: { nameJoinedCount: 0, identityConflictCount: 0, lowConfidenceCount: 0 }
};

const settingsPayload = {
  graph: { configured: true, missing: [] },
  appAccess: {
    mode: "disabled",
    required: false,
    allowedUsersConfigured: false,
    allowedUsersCount: 0
  },
  appSettings: [
    {
      key: "sync.intervalMinutes",
      section: "sync-data",
      label: "Sync interval",
      description: "How often Runway pulls fresh device and assignment data from Microsoft Graph.",
      value: 15,
      defaultValue: 15,
      valueType: "number",
      source: "default",
      envVar: "SYNC_INTERVAL_MINUTES",
      updatedAt: null,
      restartRequired: false
    },
    {
      key: "sync.onLaunch",
      section: "sync-data",
      label: "Sync on app launch",
      description: "Triggers a sync shortly after Runway starts when Graph is configured.",
      value: true,
      defaultValue: true,
      valueType: "boolean",
      source: "default",
      envVar: null,
      updatedAt: null,
      restartRequired: false
    },
    {
      key: "sync.manualOnly",
      section: "sync-data",
      label: "Manual sync only",
      description: "Disables scheduled background sync while keeping manual sync available.",
      value: false,
      defaultValue: false,
      valueType: "boolean",
      source: "default",
      envVar: null,
      updatedAt: null,
      restartRequired: false
    },
    {
      key: "sync.paused",
      section: "sync-data",
      label: "Pause sync",
      description: "Emergency stop for launch and scheduled background sync until re-enabled.",
      value: false,
      defaultValue: false,
      valueType: "boolean",
      source: "default",
      envVar: null,
      updatedAt: null,
      restartRequired: false
    },
    {
      key: "retention.deviceHistoryDays",
      section: "sync-data",
      label: "Device history retention",
      description: "Days of device health history to keep before retention sweeps prune older rows.",
      value: 90,
      defaultValue: 90,
      valueType: "number",
      source: "default",
      envVar: "HISTORY_RETENTION_DAYS",
      updatedAt: null,
      restartRequired: false
    },
    {
      key: "retention.actionLogDays",
      section: "sync-data",
      label: "Action log retention",
      description: "Days of remote action audit entries to retain.",
      value: 180,
      defaultValue: 180,
      valueType: "number",
      source: "default",
      envVar: "ACTION_LOG_RETENTION_DAYS",
      updatedAt: null,
      restartRequired: false
    },
    {
      key: "retention.syncLogDays",
      section: "sync-data",
      label: "Sync log retention",
      description: "Days of sync run history to retain.",
      value: 30,
      defaultValue: 30,
      valueType: "number",
      source: "default",
      envVar: "SYNC_LOG_RETENTION_DAYS",
      updatedAt: null,
      restartRequired: false
    },
    {
      key: "retention.sweepIntervalHours",
      section: "sync-data",
      label: "Retention sweep interval",
      description: "Hours between background retention sweeps.",
      value: 24,
      defaultValue: 24,
      valueType: "number",
      source: "default",
      envVar: "RETENTION_INTERVAL_HOURS",
      updatedAt: null,
      restartRequired: false
    },
    {
      key: "rules.profileAssignedNotEnrolledHours",
      section: "rules-thresholds",
      label: "Profile assigned but not enrolled",
      description: "Hours before a profile assignment without enrollment is flagged.",
      value: 2,
      defaultValue: 2,
      valueType: "number",
      source: "default",
      envVar: "PROFILE_ASSIGNED_NOT_ENROLLED_HOURS",
      updatedAt: null,
      restartRequired: false
    },
    {
      key: "rules.provisioningStalledHours",
      section: "rules-thresholds",
      label: "Provisioning stalled",
      description: "Hours before an in-progress provisioning state is flagged as stalled.",
      value: 8,
      defaultValue: 8,
      valueType: "number",
      source: "default",
      envVar: "PROVISIONING_STALLED_HOURS",
      updatedAt: null,
      restartRequired: false
    },
    {
      key: "display.theme",
      section: "display-behavior",
      label: "Theme",
      description: "Runway color theme.",
      value: "system",
      defaultValue: "system",
      valueType: "string",
      source: "default",
      envVar: null,
      updatedAt: null,
      restartRequired: false
    },
    {
      key: "display.dateFormat",
      section: "display-behavior",
      label: "Date format",
      description: "Relative or absolute timestamps.",
      value: "relative",
      defaultValue: "relative",
      valueType: "string",
      source: "default",
      envVar: null,
      updatedAt: null,
      restartRequired: false
    },
    {
      key: "display.timeFormat",
      section: "display-behavior",
      label: "Time format",
      description: "12-hour or 24-hour timestamps.",
      value: "24h",
      defaultValue: "24h",
      valueType: "string",
      source: "default",
      envVar: null,
      updatedAt: null,
      restartRequired: false
    },
    {
      key: "display.tablePageSize",
      section: "display-behavior",
      label: "Table page size",
      description: "Default rows per page for paginated tables.",
      value: 50,
      defaultValue: 50,
      valueType: "number",
      source: "default",
      envVar: null,
      updatedAt: null,
      restartRequired: false
    },
    {
      key: "display.defaultLandingScreen",
      section: "display-behavior",
      label: "Default landing screen",
      description: "Route opened at app launch.",
      value: "overview",
      defaultValue: "overview",
      valueType: "string",
      source: "default",
      envVar: null,
      updatedAt: null,
      restartRequired: false
    },
    {
      key: "security.sessionTimeoutMinutes",
      section: "access-security",
      label: "Session timeout",
      description: "Minutes of inactivity before Runway signs out.",
      value: 60,
      defaultValue: 60,
      valueType: "number",
      source: "default",
      envVar: null,
      updatedAt: null,
      restartRequired: false
    }
  ],
  about: {
    appVersion: "1.5.0",
    databaseSchemaVersion: 10,
    lastMigration: "010_app_settings.sql",
    logLevel: "info"
  },
  featureFlags: { sccm_detection: true },
  tagConfig: [
    { groupTag: "North", expectedProfileNames: ["North-UD"], expectedGroupNames: [], propertyLabel: "North" }
  ]
};

const deviceListPayload = {
  items: [
    {
      deviceKey: "ap:auto-1",
      deviceName: "DESKTOP-North-001",
      serialNumber: "CZC123",
      propertyLabel: "North / River",
      health: "critical",
      flags: ["no_profile_assigned"],
      flagCount: 1,
      assignedProfileName: null,
      deploymentMode: null,
      lastCheckinAt: null,
      complianceState: null,
      autopilotAssignedUserUpn: "user1@example.test",
      intunePrimaryUserUpn: null,
      diagnosis: "Autopilot identity exists, but no deployment profile is assigned.",
      matchConfidence: "high",
      activeRules: []
    }
  ],
  total: 1,
  page: 1,
  pageSize: 25
};

const deviceDetailPayload = {
  summary: deviceListPayload.items[0],
  identity: {
    autopilotId: "auto-1",
    intuneId: "mdm-1",
    entraId: "entra-1",
    trustType: "ServerAd",
    matchConfidence: "high",
    matchedOn: "serial",
    identityConflict: false,
    nameJoined: false
  },
  assignmentPath: {
    autopilotRecord: {
      id: "auto-1",
      serial: "CZC123",
      groupTag: "North",
      assignedUser: "user1@example.test"
    },
    targetingGroups: [],
    assignedProfile: null,
    effectiveMode: null,
    chainComplete: false,
    breakPoint: "no_profile"
  },
  diagnostics: [
    {
      code: "no_profile_assigned",
      severity: "critical",
      title: "No Profile Assigned",
      summary: "Autopilot identity exists, but no deployment profile is assigned.",
      whyItMatters: "Provisioning cannot continue without a deployment profile.",
      checks: ["Check profile group targeting."],
      rawData: ["groupTag=North"]
    }
  ],
  ruleViolations: [],
  compliancePolicies: [
    { policyId: "cp-1", policyName: "BitLocker Encryption", state: "compliant", lastReportedAt: "2026-04-12T00:00:00Z" },
    { policyId: "cp-2", policyName: "Windows Firewall", state: "noncompliant", lastReportedAt: "2026-04-12T00:00:00Z" }
  ],
  configProfiles: [
    { profileId: "cfg-1", profileName: "Wi-Fi Corporate", state: "succeeded", lastReportedAt: "2026-04-12T00:00:00Z" }
  ],
  appInstallStates: [
    { appId: "app-1", appName: "Microsoft Teams", installState: "installed", errorCode: null }
  ],
  hardware: {
    model: "EliteBook 840 G8",
    manufacturer: "HP",
    osVersion: "Windows 11 24H2",
    enrollmentType: "windowsBulkUserless",
    ownershipType: "corporate"
  },
  enrollment: {
    enrollmentProfileName: "AP-North-UserDriven",
    managedDeviceOwnerType: "company",
    registrationDate: "2026-01-15T00:00:00.000Z",
    firstSeenAt: "2026-01-10T00:00:00.000Z",
    firstProfileAssignedAt: "2026-01-12T00:00:00.000Z",
    managementAgent: null,
    hasConfigMgrClient: false
  },
  groupMemberships: [
    { groupId: "grp-1", groupName: "AP-North-Devices", membershipType: "dynamic" }
  ],
  provisioningTimeline: {
    firstSeenAt: "2026-01-10T00:00:00.000Z",
    firstProfileAssignedAt: "2026-01-12T00:00:00.000Z",
    enrollmentDate: "2026-01-15T00:00:00.000Z",
    lastCheckinAt: "2026-04-12T08:00:00.000Z"
  },
  sourceRefs: {
    autopilotRawJson: "{}",
    intuneRawJson: null,
    entraRawJson: "{}"
  }
};

describe("client drilldown", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/");
    vi.spyOn(window, "open").mockReturnValue(null);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn(async () => undefined)
      }
    });
    const jsonResponse = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
      });
    global.fetch = vi.fn(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/dashboard")) return jsonResponse(dashboardPayload);
      if (url.includes("/api/settings/graph/env")) {
        return jsonResponse({ envPath: "C:\\Runway\\.env", configured: true, missing: [] });
      }
      if (url.includes("/api/settings/sync.intervalMinutes") && init?.method === "PUT") {
        return jsonResponse({
          ...settingsPayload.appSettings[0],
          value: 30,
          source: "db",
          updatedAt: "2026-04-29T12:00:00.000Z"
        });
      }
      if (url.includes("/api/settings")) return jsonResponse(settingsPayload);
      if (url.includes("/api/sync/status"))
        return jsonResponse({ inProgress: false, lastError: null });
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
          reason: "App access enforcement is disabled."
        });
      if (url.includes("/api/auth/status"))
        return jsonResponse({ authenticated: true, user: "test@example.com" });
      if (url.includes("/api/graph/users"))
        return jsonResponse([
          {
            id: "graph-user-1",
            displayName: "Alex Rivera",
            userPrincipalName: "alex@example.test",
            mail: "alex.rivera@example.test"
          }
        ]);
      if (url.includes("/api/actions/ap:auto-1/change-primary-user") && init?.method === "POST")
        return jsonResponse({ success: true, status: 204, message: "Primary user updated." });
      if (url.includes("/api/devices/ap:auto-1/related-devices")) return jsonResponse([]);
      if (url.includes("/api/devices/ap:auto-1/history")) return jsonResponse({ entries: [] });
      if (url.includes("/api/devices/ap:auto-1")) return jsonResponse(deviceDetailPayload);
      if (url.includes("/api/devices")) return jsonResponse(deviceListPayload);
      return jsonResponse({ message: "Not found" }, 404);
    }) as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function renderApp() {
    const queryClient = new QueryClient();
    const { App } = await import("../../src/client/App.js");
    render(
      <QueryClientProvider client={queryClient}>
        <App queryClient={queryClient} />
      </QueryClientProvider>
    );
    return queryClient;
  }

  function findDashboardTitle() {
    return screen.findByText("Operator view", {}, { timeout: 5000 });
  }

  async function openStart() {
    if (window.location.pathname !== "/") {
      fireEvent.click(await screen.findByRole("link", { name: "Start" }));
    }
    return findDashboardTitle();
  }

  it("navigates from Start to devices to a device detail", async () => {
    await renderApp();

    // Default landing opens Start.
    expect(await openStart()).toBeInTheDocument();

    // Drill into the Needs attention quick-action link → device queue
    fireEvent.click((await screen.findAllByText("Needs attention"))[0]);
    expect(await screen.findByText("Device Queue")).toBeInTheDocument();

    // Click into the seeded device row → device detail
    fireEvent.click(await screen.findByText("DESKTOP-North-001"));

    // Device detail renders; the default tab is severity-driven (targeting),
    // so the device name is shown in the hero header. Switch to the provisioning
    // tab where the diagnostic panel renders each flag title.
    await screen.findAllByText("Device record", {}, { timeout: 3000 });
    expect(screen.getByRole("button", { name: /open in intune/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open in entra/i })).toBeInTheDocument();
    const enrollmentButtons = screen.getAllByRole("button", { name: /provisioning/i });
    fireEvent.click(enrollmentButtons[enrollmentButtons.length - 1]);
    expect(
      await screen.findByText("No Profile Assigned", {}, { timeout: 3000 })
    ).toBeInTheDocument();
  });

  it("saves sync interval from Settings", async () => {
    await renderApp();
    expect(await screen.findByText("Operator view")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Settings" }));
    expect(await screen.findByText("Sync & Data")).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("15 minutes"), {
      target: { value: "30" }
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/settings/sync.intervalMinutes",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ value: 30 })
        })
      );
    });
    expect(await screen.findByText("Setting saved")).toBeInTheDocument();
  });

  it("surfaces Start master search results and opens a device", async () => {
    await renderApp();

    expect(await openStart()).toBeInTheDocument();

    fireEvent.change(screen.getAllByPlaceholderText(/search devices by name/i)[0], {
      target: { value: "North" }
    });

    fireEvent.click(await screen.findByRole("button", { name: /DESKTOP-North-001/i }));

    expect(
      await screen.findByText("Device record", {}, { timeout: 3000 })
    ).toBeInTheDocument();
  });

  it("playbook link buttons copy the URL when external open is unavailable", async () => {
    // The onOpen handler uses anchor.click() which silently succeeds in jsdom.
    // Force it to throw so the clipboard fallback path is exercised.
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = () => {
      throw new Error("simulated: cannot open external link");
    };

    await renderApp();

    fireEvent.click((await screen.findAllByText("Needs attention"))[0]);
    fireEvent.click(await screen.findByText("DESKTOP-North-001"));
    await screen.findAllByText("Device record", {}, { timeout: 3000 });
    const enrollmentButtons = screen.getAllByRole("button", { name: /provisioning/i });
    fireEvent.click(enrollmentButtons[enrollmentButtons.length - 1]);

    const openButtons = await screen.findAllByRole("button", { name: "Open" });
    fireEvent.click(openButtons[0]);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "https://intune.microsoft.com/#view/Microsoft_Intune_Enrollment/AutopilotProfilesBlade"
      );
    });

    HTMLAnchorElement.prototype.click = originalClick;
  });

  it("shows remote action buttons disabled before admin sign-in", async () => {
    const mockSettings = {
      ...settingsPayload,
      graph: { configured: false, missing: ["AZURE_TENANT_ID"] }
    };
    const jsonResponse = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
      });
    global.fetch = vi.fn(async (input) => {
      const url = String(input);
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
          reason: "App access enforcement is disabled."
        });
      if (url.includes("/api/auth/status"))
        return jsonResponse({ authenticated: false, user: null });
      if (url.includes("/api/settings")) return jsonResponse(mockSettings);
      if (url.includes("/api/sync/status"))
        return jsonResponse({ inProgress: false, lastError: null });
      if (url.includes("/api/devices/ap:auto-1/related-devices")) return jsonResponse([]);
      if (url.includes("/api/devices/ap:auto-1/history")) return jsonResponse({ entries: [] });
      if (url.includes("/api/devices/ap:auto-1")) return jsonResponse(deviceDetailPayload);
      if (url.includes("/api/devices")) return jsonResponse(deviceListPayload);
      if (url.includes("/api/dashboard")) return jsonResponse(dashboardPayload);
      return jsonResponse({ message: "Not found" }, 404);
    }) as typeof fetch;

    await renderApp();

    fireEvent.click((await screen.findAllByText("Needs attention"))[0]);
    fireEvent.click(await screen.findByText("DESKTOP-North-001"));
    await screen.findAllByText("Device record", {}, { timeout: 3000 });
    fireEvent.click(screen.getByRole("button", { name: /^actions$/i }));

    expect(await screen.findByText("Admin sign-in required")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unavailable" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /sync now/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /change primary user/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /factory wipe/i })).toBeDisabled();
  });

  it("changes primary user through the picker flow against mocked Graph", async () => {
    await renderApp();

    fireEvent.click((await screen.findAllByText("Needs attention"))[0]);
    fireEvent.click(await screen.findByText("DESKTOP-North-001"));
    await screen.findAllByText("Device record", {}, { timeout: 3000 });
    const actionTabs = screen.getAllByRole("button", { name: /^actions$/i });
    fireEvent.click(actionTabs[actionTabs.length - 1]);
    expect(await screen.findByText("Remote Actions")).toBeInTheDocument();

    const changeButtons = await screen.findAllByRole("button", { name: /change primary user/i });
    fireEvent.click(changeButtons[0]);
    const picker = await screen.findByPlaceholderText("Search users by name, UPN, or mail");
    fireEvent.change(picker, { target: { value: "alex" } });
    fireEvent.click(await screen.findByText("Alex Rivera"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Confirm assignment to/)).toBeInTheDocument();
    fireEvent.change(picker, { target: { value: "alicia" } });
    expect(within(dialog).getByRole("button", { name: "Change Primary User" })).toBeDisabled();
    expect(within(dialog).queryByText(/Confirm assignment to/)).not.toBeInTheDocument();
    fireEvent.change(picker, { target: { value: "alex" } });
    fireEvent.click(await screen.findByText("Alex Rivera"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Change Primary User" }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/actions/ap:auto-1/change-primary-user",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ userId: "graph-user-1" })
        })
      );
    });
  });

  it("opens the admin sign-in shell before navigating to Microsoft", async () => {
    const popup = {
      closed: false,
      close: vi.fn(),
      focus: vi.fn(),
      location: { href: "" },
      document: {
        title: "",
        body: {
          innerHTML: "",
          style: {}
        }
      }
    } as unknown as Window;

    vi.mocked(window.open).mockReturnValue(popup);

    const jsonResponse = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" }
      });
    global.fetch = vi.fn(async (input) => {
      const url = String(input);
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
          reason: "App access enforcement is disabled."
        });
      if (url.includes("/api/settings")) return jsonResponse(settingsPayload);
      if (url.includes("/api/sync/status"))
        return jsonResponse({ inProgress: false, lastError: null });
      if (url.includes("/api/auth/login"))
        return jsonResponse({ loginUrl: "https://login.example.test/start" });
      if (url.includes("/api/auth/status"))
        return jsonResponse({ authenticated: false, user: null });
      if (url.includes("/api/dashboard")) return jsonResponse(dashboardPayload);
      if (url.includes("/api/devices")) return jsonResponse(deviceListPayload);
      return jsonResponse({ message: "Not found" }, 404);
    }) as typeof fetch;

    await renderApp();

    fireEvent.click(await screen.findByRole("button", { name: /admin sign-in/i }));

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledWith(
        "",
        "runway-admin-signin",
        "popup=yes,width=640,height=760"
      );
    });
    await waitFor(() => {
      expect(popup.focus).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(popup.location.href).toBe("https://login.example.test/start");
    });
  });

  it("shows the Entra app-access gate when enforcement is required", async () => {
    global.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/api/auth/access-status")) {
        return new Response(
          JSON.stringify({
            required: true,
            configured: true,
            mode: "entra",
            authenticated: false,
            user: null,
            name: null,
            expiresAt: null,
            allowedUsersConfigured: true,
            reason: null
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ message: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }) as typeof fetch;

    await renderApp();

    expect(await screen.findByText("Continue with Entra ID")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in with microsoft/i })).toBeInTheDocument();
  });
});

