import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/client/App.js";

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
    firstProfileAssignedAt: "2026-01-12T00:00:00.000Z"
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
    global.fetch = vi.fn(async (input) => {
      const url = String(input);
      if (url.includes("/api/dashboard")) {
        return new Response(JSON.stringify(dashboardPayload), { status: 200 });
      }
      if (url.includes("/api/settings")) {
        return new Response(JSON.stringify(settingsPayload), { status: 200 });
      }
      if (url.includes("/api/devices/ap:auto-1/history")) {
        return new Response(JSON.stringify({ entries: [] }), { status: 200 });
      }
      if (url.includes("/api/devices/ap:auto-1")) {
        return new Response(JSON.stringify(deviceDetailPayload), { status: 200 });
      }
      if (url.includes("/api/devices")) {
        return new Response(JSON.stringify(deviceListPayload), { status: 200 });
      }
      return new Response(JSON.stringify({ message: "Not found" }), { status: 404 });
    }) as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("navigates from dashboard to devices to a device detail", async () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <App queryClient={queryClient} />
      </QueryClientProvider>
    );

    // Dashboard renders
    expect(await screen.findByText("Windows Fleet Health")).toBeInTheDocument();

    // Drill into the Critical Devices quick-action link → device queue
    fireEvent.click(screen.getByText("Critical Devices"));
    expect(await screen.findByText("Device Queue")).toBeInTheDocument();

    // Click into the seeded device row → device detail
    fireEvent.click(await screen.findByText("DESKTOP-Lodge-001"));
    await waitFor(() =>
      expect(screen.getByText("No Profile Assigned")).toBeInTheDocument()
    );
  });
});
