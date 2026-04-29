import type {
  AutopilotRow,
  CompliancePolicyRow,
  ConditionalAccessPolicyRow,
  ConfigProfileRow,
  DeviceAppInstallStateRow,
  DeviceComplianceStateRow,
  DeviceConfigStateRow,
  GraphAssignmentRow,
  EntraRow,
  GroupMembershipRow,
  GroupRow,
  IntuneRow,
  MobileAppRow,
  ProfileAssignmentRow,
  ProfileRow
} from "../db/types.js";

export interface SnapshotPayload {
  autopilotRows: AutopilotRow[];
  intuneRows: IntuneRow[];
  entraRows: EntraRow[];
  groupRows: GroupRow[];
  membershipRows: GroupMembershipRow[];
  profileRows: ProfileRow[];
  profileAssignmentRows: ProfileAssignmentRow[];
  compliancePolicies?: CompliancePolicyRow[];
  deviceComplianceStates?: DeviceComplianceStateRow[];
  configProfiles?: ConfigProfileRow[];
  deviceConfigStates?: DeviceConfigStateRow[];
  conditionalAccessPolicies?: ConditionalAccessPolicyRow[];
  mobileApps?: MobileAppRow[];
  deviceAppInstallStates?: DeviceAppInstallStateRow[];
  graphAssignments?: GraphAssignmentRow[];
  tagConfigRows?: Array<{
    groupTag: string;
    expectedProfileNames: string[];
    expectedGroupNames: string[];
    propertyLabel: string;
  }>;
}
