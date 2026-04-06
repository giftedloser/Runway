import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/client/App.js";

const dashboardPayload = {
  lastSync: "2026-04-06T00:00:00.000Z",
  counts: { critical: 2, warning: 1, info: 1, healthy: 10, unknown: 0 },
  failurePatterns: [{ flag: "no_profile_assigned", count: 2, severity: "critical" }],
  driftCount: 1
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
      matchConfidence: "high"
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
    identityConflict: false
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
      if (url.includes("/api/devices?")) {
        return new Response(JSON.stringify(deviceListPayload), { status: 200 });
      }
      if (url.includes("/api/devices/ap:auto-1")) {
        return new Response(JSON.stringify(deviceDetailPayload), { status: 200 });
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

    expect(await screen.findByText("Estate Command Deck")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Critical queue"));
    expect(await screen.findByText("Investigation Queue")).toBeInTheDocument();

    fireEvent.click(await screen.findByText("DESKTOP-Lodge-001"));
    await waitFor(() =>
      expect(screen.getByText("No Profile Assigned")).toBeInTheDocument()
    );
  });
});
