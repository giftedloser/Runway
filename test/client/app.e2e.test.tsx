import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
  appAccess: { mode: "disabled", required: false, allowedUsersConfigured: false },
  featureFlags: { sccm_detection: true },
  tagConfig: [
    { groupTag: "Lodge", expectedProfileNames: ["Lodge-UD"], expectedGroupNames: [], propertyLabel: "Lodge" }
  ]
};

const deviceListPayload = {
  items: [
    {
      deviceKey: "ap:auto-1",
      deviceName: "DESKTOP-Lodge-001",
      serialNumber: "CZC123",
      propertyLabel: "Lodge / Gilpin",
      health: "critical",
      flags: ["no_profile_assigned"],
      flagCount: 1,
      assignedProfileName: null,
      deploymentMode: null,
      lastCheckinAt: null,
      complianceState: null,
      autopilotAssignedUserUpn: "user1@bhwk.com",
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
    intuneId: null,
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
      groupTag: "Lodge",
      assignedUser: "user1@bhwk.com"
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
      rawData: ["groupTag=Lodge"]
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
    enrollmentProfileName: "AP-Lodge-UserDriven",
    managedDeviceOwnerType: "company",
    registrationDate: "2026-01-15T00:00:00.000Z",
    firstSeenAt: "2026-01-10T00:00:00.000Z",
    firstProfileAssignedAt: "2026-01-12T00:00:00.000Z",
    managementAgent: null,
    hasConfigMgrClient: false
  },
  groupMemberships: [
    { groupId: "grp-1", groupName: "AP-Lodge-Devices", membershipType: "dynamic" }
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
    global.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/api/dashboard")) return jsonResponse(dashboardPayload);
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

  it("navigates from dashboard to devices to a device detail", async () => {
    await renderApp();

    // Dashboard renders
    expect(await screen.findByText("Runway Fleet Health")).toBeInTheDocument();

    // Drill into the Critical Devices quick-action link → device queue
    fireEvent.click((await screen.findAllByText("Critical Devices"))[0]);
    expect(await screen.findByText("Device Queue")).toBeInTheDocument();

    // Click into the seeded device row → device detail
    fireEvent.click(await screen.findByText("DESKTOP-Lodge-001"));

    // Device detail renders; the default tab is severity-driven (targeting),
    // so the device name is shown in the hero header. Switch to the enrollment
    // tab where the diagnostic panel renders each flag title.
    await screen.findAllByText("Device Diagnostics", {}, { timeout: 3000 });
    // Two "Enrollment" buttons exist: the breakpoint chip in the hero and the
    // tab nav button. Either one activates the enrollment tab; grab the tab.
    const enrollmentButtons = screen.getAllByRole("button", { name: /enrollment/i });
    fireEvent.click(enrollmentButtons[enrollmentButtons.length - 1]);
    expect(
      await screen.findByText("No Profile Assigned", {}, { timeout: 3000 })
    ).toBeInTheDocument();
  });

  it("surfaces overview master search results and opens a device", async () => {
    await renderApp();

    expect(await screen.findByText("Runway Fleet Health")).toBeInTheDocument();

    fireEvent.change(screen.getAllByPlaceholderText(/search devices by name/i)[0], {
      target: { value: "Lodge" }
    });

    fireEvent.click(await screen.findByRole("button", { name: /DESKTOP-Lodge-001/i }));

    expect(
      await screen.findByText("Device Diagnostics", {}, { timeout: 3000 })
    ).toBeInTheDocument();
  });

  it("playbook link buttons copy the URL when external open is unavailable", async () => {
    await renderApp();

    fireEvent.click((await screen.findAllByText("Critical Devices"))[0]);
    fireEvent.click(await screen.findByText("DESKTOP-Lodge-001"));
    await screen.findAllByText("Device Diagnostics", {}, { timeout: 3000 });
    const enrollmentButtons = screen.getAllByRole("button", { name: /enrollment/i });
    fireEvent.click(enrollmentButtons[enrollmentButtons.length - 1]);

    const openButtons = await screen.findAllByRole("button", { name: "Open" });
    fireEvent.click(openButtons[0]);

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "https://intune.microsoft.com/#view/Microsoft_Intune_Enrollment/AutopilotProfilesBlade"
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
