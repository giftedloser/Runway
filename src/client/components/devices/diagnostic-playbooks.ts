import type { FlagCode } from "../../lib/types.js";

/**
 * A "playbook step" is a concrete next action a tech can take to resolve a
 * flag. Each step is one of:
 *  - portal: opens a Microsoft admin URL in a new tab
 *  - powershell: a copyable Graph PowerShell command (templated with the
 *    device's serial / intune id)
 *  - graph: a copyable Graph REST URL the tech can paste into Graph
 *    Explorer
 *  - doc: a docs link for background reading
 *
 * Steps are intentionally short and copy-pasteable. Anything that requires
 * judgement is left to the existing `checks` list on the diagnostic so the
 * playbook stays "ready to run" rather than "things to think about".
 */
export type PlaybookStepType = "portal" | "powershell" | "graph" | "doc";

export interface PlaybookStep {
  type: PlaybookStepType;
  label: string;
  /** The URL to open or string to copy. Templated per device. */
  payload: string;
}

export interface PlaybookContext {
  serialNumber: string | null;
  intuneId: string | null;
  autopilotId: string | null;
  entraId: string | null;
  deviceName: string | null;
}

type PlaybookBuilder = (ctx: PlaybookContext) => PlaybookStep[];

function odataString(value: string | null, fallback: string) {
  return (value ?? fallback).replaceAll("'", "''");
}

/**
 * Per-flag playbooks. Only flags with concrete, runnable next steps are
 * listed — the rest fall through to an empty array and the panel just
 * hides the playbook section.
 */
const PLAYBOOKS: Partial<Record<FlagCode, PlaybookBuilder>> = {
  no_autopilot_record: (ctx) => [
    {
      type: "portal",
      label: "Open Autopilot devices in MEM",
      payload: "https://intune.microsoft.com/#view/Microsoft_Intune_Enrollment/AutopilotDevicesBlade"
    },
    {
      type: "powershell",
      label: "Look up by serial in Graph PowerShell",
      payload: `Get-MgDeviceManagementWindowsAutopilotDeviceIdentity -Filter "contains(serialNumber,'${ctx.serialNumber ?? "SERIAL"}')"`
    },
    {
      type: "doc",
      label: "Hardware hash registration docs",
      payload: "https://learn.microsoft.com/en-us/autopilot/add-devices"
    }
  ],
  no_profile_assigned: (ctx) => [
    {
      type: "portal",
      label: "Open Autopilot deployment profiles",
      payload: "https://intune.microsoft.com/#view/Microsoft_Intune_Enrollment/AutopilotProfilesBlade"
    },
    {
      type: "graph",
      label: "Inspect this Autopilot identity (Graph)",
      payload: ctx.autopilotId
        ? `https://graph.microsoft.com/beta/deviceManagement/windowsAutopilotDeviceIdentities/${ctx.autopilotId}`
        : "https://graph.microsoft.com/beta/deviceManagement/windowsAutopilotDeviceIdentities"
    }
  ],
  profile_assignment_failed: (ctx) => [
    {
      type: "portal",
      label: "Open the device in MEM",
      payload: ctx.intuneId
        ? `https://intune.microsoft.com/#view/Microsoft_Intune_Devices/DeviceSettingsMenuBlade/~/overview/mdmDeviceId/${ctx.intuneId}`
        : "https://intune.microsoft.com/#view/Microsoft_Intune_Devices/DevicesMenu/~/allDevices"
    },
    {
      type: "powershell",
      label: "Re-trigger profile assignment",
      payload: `Invoke-MgGraphRequest -Method POST -Uri "/beta/deviceManagement/windowsAutopilotDeviceIdentities/${ctx.autopilotId ?? "AUTOPILOT_ID"}/assignResourceAccountToDevice"`
    }
  ],
  profile_assigned_not_enrolled: (ctx) => [
    {
      type: "portal",
      label: "Check enrollment status in MEM",
      payload: "https://intune.microsoft.com/#view/Microsoft_Intune_Enrollment/EnrollmentMenu/~/enrollmentStatus"
    },
    {
      type: "doc",
      label: "Diagnose stuck OOBE",
      payload: "https://learn.microsoft.com/en-us/autopilot/troubleshoot-oobe"
    },
    {
      type: "powershell",
      label: "Pull provisioning log from device (run on the endpoint)",
      payload: `Get-AutopilotDiagnostics -Online | Out-File "$env:TEMP\\${ctx.serialNumber ?? "device"}-autopilot.log"`
    }
  ],
  hybrid_join_risk: () => [
    {
      type: "portal",
      label: "Intune Connector for AD health",
      payload: "https://intune.microsoft.com/#view/Microsoft_Intune_Enrollment/AutopilotIntuneConnectorBlade"
    },
    {
      type: "doc",
      label: "Hybrid join Autopilot prerequisites",
      payload: "https://learn.microsoft.com/en-us/autopilot/windows-autopilot-hybrid"
    }
  ],
  provisioning_stalled: (ctx) => [
    {
      type: "portal",
      label: "Open device in MEM",
      payload: ctx.intuneId
        ? `https://intune.microsoft.com/#view/Microsoft_Intune_Devices/DeviceSettingsMenuBlade/~/overview/mdmDeviceId/${ctx.intuneId}`
        : "https://intune.microsoft.com"
    },
    {
      type: "doc",
      label: "ESP / OOBE diagnostics",
      payload: "https://learn.microsoft.com/en-us/autopilot/troubleshooting"
    }
  ],
  user_mismatch: (ctx) => [
    {
      type: "portal",
      label: "Open device in MEM (change primary user)",
      payload: ctx.intuneId
        ? `https://intune.microsoft.com/#view/Microsoft_Intune_Devices/DeviceSettingsMenuBlade/~/properties/mdmDeviceId/${ctx.intuneId}`
        : "https://intune.microsoft.com"
    }
  ],
  not_in_target_group: (ctx) => [
    {
      type: "portal",
      label: "Inspect dynamic group rules in Entra",
      payload: "https://entra.microsoft.com/#view/Microsoft_AAD_IAM/GroupsManagementMenuBlade/~/AllGroups"
    },
    {
      type: "graph",
      label: "List groups this device belongs to",
      payload: ctx.entraId
        ? `https://graph.microsoft.com/v1.0/devices/${ctx.entraId}/memberOf?$select=id,displayName`
        : `https://graph.microsoft.com/v1.0/devices?$filter=displayName eq '${odataString(ctx.deviceName, "DEVICE_NAME")}'&$select=id,displayName,deviceId`
    },
    {
      type: "doc",
      label: "Dynamic group rule syntax",
      payload: "https://learn.microsoft.com/en-us/entra/identity/users/groups-dynamic-membership"
    }
  ],
  deployment_mode_mismatch: (ctx) => [
    {
      type: "portal",
      label: "Open Autopilot deployment profiles",
      payload: "https://intune.microsoft.com/#view/Microsoft_Intune_Enrollment/AutopilotProfilesBlade"
    },
    {
      type: "graph",
      label: "Inspect device's Autopilot identity",
      payload: ctx.autopilotId
        ? `https://graph.microsoft.com/beta/deviceManagement/windowsAutopilotDeviceIdentities/${ctx.autopilotId}?$select=displayName,deploymentProfileAssignmentStatus,deploymentProfileAssignedDateTime`
        : "https://graph.microsoft.com/beta/deviceManagement/windowsAutopilotDeviceIdentities"
    },
    {
      type: "doc",
      label: "Autopilot deployment modes explained",
      payload: "https://learn.microsoft.com/en-us/autopilot/tutorial/self-deploying/self-deploying-workflow"
    }
  ],
  tag_mismatch: (ctx) => [
    {
      type: "portal",
      label: "Edit device group tag in Autopilot",
      payload: "https://intune.microsoft.com/#view/Microsoft_Intune_Enrollment/AutopilotDevicesBlade"
    },
    {
      type: "powershell",
      label: "Get current group tag via Graph PowerShell",
      payload: `Get-MgDeviceManagementWindowsAutopilotDeviceIdentity -Filter "contains(serialNumber,'${ctx.serialNumber ?? "SERIAL"}')" | Select-Object GroupTag, SerialNumber`
    },
    {
      type: "doc",
      label: "Using group tags to organise Autopilot devices",
      payload: "https://learn.microsoft.com/en-us/autopilot/enrollment-autopilot#create-an-autopilot-device-group-using-a-group-tag"
    }
  ],
  orphaned_autopilot: (ctx) => [
    {
      type: "portal",
      label: "Open Autopilot devices in MEM",
      payload: "https://intune.microsoft.com/#view/Microsoft_Intune_Enrollment/AutopilotDevicesBlade"
    },
    {
      type: "powershell",
      label: "Check Autopilot record status",
      payload: `Get-MgDeviceManagementWindowsAutopilotDeviceIdentity -Filter "contains(serialNumber,'${ctx.serialNumber ?? "SERIAL"}')" | Select-Object Id, SerialNumber, ManagedDeviceId, EnrollmentState`
    },
    {
      type: "doc",
      label: "Deregister / re-import an Autopilot device",
      payload: "https://learn.microsoft.com/en-us/autopilot/registration-overview#deregister-a-device"
    }
  ],
  missing_ztdid: (ctx) => [
    {
      type: "graph",
      label: "Check Entra device physical IDs for ZTDID",
      payload: `https://graph.microsoft.com/v1.0/devices?$filter=displayName eq '${odataString(ctx.deviceName, "DEVICE_NAME")}'&$select=displayName,physicalIds,deviceId`
    },
    {
      type: "powershell",
      label: "Re-register device hardware hash",
      payload: `Get-MgDeviceManagementWindowsAutopilotDeviceIdentity -Filter "contains(serialNumber,'${ctx.serialNumber ?? "SERIAL"}')" | Select-Object Id, SerialNumber, AzureAdDeviceId`
    },
    {
      type: "doc",
      label: "Troubleshoot ZTDID and device matching",
      payload: "https://learn.microsoft.com/en-us/autopilot/troubleshoot-device-enrollment"
    }
  ],
  compliance_drift: (ctx) => [
    {
      type: "portal",
      label: "Open device compliance in MEM",
      payload: ctx.intuneId
        ? `https://intune.microsoft.com/#view/Microsoft_Intune_Devices/DeviceSettingsMenuBlade/~/compliance/mdmDeviceId/${ctx.intuneId}`
        : "https://intune.microsoft.com/#view/Microsoft_Intune_DeviceCompliance/DevicesComplianceBlade"
    },
    {
      type: "graph",
      label: "Get device compliance policy states",
      payload: ctx.intuneId
        ? `https://graph.microsoft.com/v1.0/deviceManagement/managedDevices/${ctx.intuneId}/deviceCompliancePolicyStates`
        : "https://graph.microsoft.com/v1.0/deviceManagement/deviceCompliancePolicies"
    },
    {
      type: "doc",
      label: "Compliance policy troubleshooting",
      payload: "https://learn.microsoft.com/en-us/mem/intune/protect/troubleshoot-policies-in-microsoft-intune"
    }
  ],
  identity_conflict: (ctx) => [
    {
      type: "graph",
      label: "Find duplicate Entra device records by serial",
      payload: `https://graph.microsoft.com/beta/devices?$filter=contains(physicalIds,'${odataString(ctx.serialNumber, "SERIAL")}')`
    },
    {
      type: "doc",
      label: "Reimage / stale device cleanup",
      payload: "https://learn.microsoft.com/en-us/autopilot/registration-overview"
    }
  ]
};

export function getPlaybook(code: FlagCode, context: PlaybookContext): PlaybookStep[] {
  const builder = PLAYBOOKS[code];
  if (!builder) return [];
  return builder(context);
}
