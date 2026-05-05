import { describe, expect, it } from "vitest";

import { syncGroups } from "../../src/server/sync/group-sync.js";

describe("syncGroups", () => {
  it("lists all groups but only expands device memberships for relevant groups", async () => {
    const calls: string[] = [];
    const client = {
      async getAllPages<T>(path: string): Promise<T[]> {
        calls.push(path);
        if (path.startsWith("/groups?$select=")) {
          return [
            {
              id: "profile-target",
              displayName: "Finance Devices",
              groupTypes: []
            },
            {
              id: "autopilot-named",
              displayName: "Autopilot Lab",
              groupTypes: []
            },
            {
              id: "dynamic-device",
              displayName: "Windows Dynamic",
              membershipRule: '(device.devicePhysicalIds -any _ -contains "[ZTDId]")',
              groupTypes: ["DynamicMembership"]
            },
            {
              id: "all-users",
              displayName: "All Employees",
              groupTypes: []
            }
          ] as T[];
        }

        if (path.includes("/members/microsoft.graph.device")) {
          return [{ id: `${path.split("/")[2]}-device` }] as T[];
        }

        return [];
      }
    };

    const result = await syncGroups(client as never, { targetGroupIds: ["profile-target"] });

    expect(result.groups.map((group) => group.id)).toEqual([
      "profile-target",
      "autopilot-named",
      "dynamic-device",
      "all-users"
    ]);
    expect(result.memberships.map((membership) => membership.group_id).sort()).toEqual([
      "autopilot-named",
      "dynamic-device",
      "profile-target"
    ]);
    expect(calls).not.toContain("/groups/all-users/members/microsoft.graph.device?$select=id,deviceId");
    expect(calls.filter((path) => path.includes("/members/microsoft.graph.device"))).toHaveLength(3);
  });
});
