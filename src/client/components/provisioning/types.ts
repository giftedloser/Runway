export interface DiscoverResult {
  groupTag: string;
  deviceCount: number;
  matchingGroups: Array<{
    groupId: string;
    groupName: string;
    membershipRule: string | null;
    membershipType: string;
  }>;
  matchingProfiles: Array<{
    profileId: string;
    profileName: string;
    deploymentMode: string | null;
    viaGroupId: string;
  }>;
  buildPayloadByGroupId: Record<string, BuildPayloadGroup>;
  existingConfig: {
    groupTag: string;
    propertyLabel: string;
    expectedProfileNames: string[];
    expectedGroupNames: string[];
  } | null;
}

export interface TagInventoryItem {
  groupTag: string;
  deviceCount: number;
  lastSeenAt: string | null;
  configured: boolean;
  propertyLabel: string | null;
}

export interface ProvisioningTagDevice {
  deviceKey: string;
  deviceName: string | null;
  serialNumber: string | null;
  lastSyncAt: string | null;
  health: string;
  complianceState: string | null;
}

export interface BuildPayloadItem {
  payloadId: string;
  payloadName: string;
  intent: string | null;
  targetType: "include" | "exclude";
  syncedAt: string;
}

export interface BuildPayloadGroup {
  requiredApps: BuildPayloadItem[];
  configProfiles: BuildPayloadItem[];
  compliancePolicies: BuildPayloadItem[];
  warnings: string[];
  syncedAt: string | null;
}

export interface ValidateResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MatchingGroup {
  groupId: string;
  groupName: string;
  membershipRule: string | null;
  membershipType: string;
}

export interface MatchingProfile {
  profileId: string;
  profileName: string;
  deploymentMode: string | null;
  viaGroupId: string;
}
