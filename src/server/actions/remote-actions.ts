import { requestWithDelegatedToken } from "../auth/delegated-auth.js";
import { graphPathSegment, graphUserRef } from "./graph-url.js";

export type RemoteActionType =
  | "sync_device"
  | "reboot"
  | "rename"
  | "autopilot_reset"
  | "retire"
  | "wipe"
  | "rotate_laps"
  | "delete_intune"
  | "delete_autopilot";

interface ActionResult {
  success: boolean;
  status: number;
  message: string;
}

export async function syncDevice(
  token: string,
  intuneId: string
): Promise<ActionResult> {
  const { status } = await requestWithDelegatedToken(
    token,
    `/deviceManagement/managedDevices/${graphPathSegment(intuneId)}/syncDevice`,
    { method: "POST" }
  );
  return {
    success: status === 204,
    status,
    message: status === 204 ? "Sync initiated. Device will check in within ~5 minutes." : `Sync failed with status ${status}.`
  };
}

export async function rebootDevice(
  token: string,
  intuneId: string
): Promise<ActionResult> {
  const { status } = await requestWithDelegatedToken(
    token,
    `/deviceManagement/managedDevices/${graphPathSegment(intuneId)}/rebootNow`,
    { method: "POST" }
  );
  return {
    success: status === 204,
    status,
    message: status === 204 ? "Reboot command sent. May take 5-30 minutes." : `Reboot failed with status ${status}.`
  };
}

export async function renameDevice(
  token: string,
  intuneId: string,
  newName: string
): Promise<ActionResult> {
  const { status } = await requestWithDelegatedToken(
    token,
    `/deviceManagement/managedDevices/${graphPathSegment(intuneId)}/setDeviceName`,
    { method: "POST", body: { deviceName: newName } }
  );
  return {
    success: status === 204,
    status,
    message: status === 204 ? `Rename to "${newName}" queued. Takes effect after next sync.` : `Rename failed with status ${status}.`
  };
}

export async function autopilotReset(
  token: string,
  intuneId: string
): Promise<ActionResult> {
  const { status } = await requestWithDelegatedToken(
    token,
    `/deviceManagement/managedDevices/${graphPathSegment(intuneId)}/wipe`,
    { method: "POST", body: { keepEnrollmentData: true, keepUserData: false } }
  );
  return {
    success: status === 204,
    status,
    message: status === 204 ? "Autopilot reset initiated. Device will re-provision." : `Autopilot reset failed with status ${status}.`
  };
}

export async function retireDevice(
  token: string,
  intuneId: string
): Promise<ActionResult> {
  const { status } = await requestWithDelegatedToken(
    token,
    `/deviceManagement/managedDevices/${graphPathSegment(intuneId)}/retire`,
    { method: "POST" }
  );
  return {
    success: status === 204,
    status,
    message: status === 204 ? "Retire command sent. Corporate data will be removed." : `Retire failed with status ${status}.`
  };
}

export async function wipeDevice(
  token: string,
  intuneId: string
): Promise<ActionResult> {
  const { status } = await requestWithDelegatedToken(
    token,
    `/deviceManagement/managedDevices/${graphPathSegment(intuneId)}/wipe`,
    { method: "POST", body: { keepEnrollmentData: false, keepUserData: false } }
  );
  return {
    success: status === 204,
    status,
    message: status === 204 ? "Full wipe initiated. Device will factory reset." : `Wipe failed with status ${status}.`
  };
}

export async function rotateLapsPassword(
  token: string,
  intuneId: string
): Promise<ActionResult> {
  const { status } = await requestWithDelegatedToken(
    token,
    `/deviceManagement/managedDevices/${graphPathSegment(intuneId)}/rotateLocalAdminPassword`,
    { method: "POST" }
  );
  return {
    success: status === 204,
    status,
    message: status === 204 ? "LAPS rotation initiated. New password after next check-in." : `LAPS rotation failed with status ${status}.`
  };
}

export async function deleteIntuneDevice(
  token: string,
  intuneId: string
): Promise<ActionResult> {
  const { status } = await requestWithDelegatedToken(
    token,
    `/deviceManagement/managedDevices/${graphPathSegment(intuneId)}`,
    { method: "DELETE" }
  );
  return {
    success: status === 204,
    status,
    message: status === 204 ? "Intune device record deleted." : `Delete from Intune failed with status ${status}.`
  };
}

export async function deleteAutopilotDevice(
  token: string,
  autopilotId: string
): Promise<ActionResult> {
  const { status } = await requestWithDelegatedToken(
    token,
    `/deviceManagement/windowsAutopilotDeviceIdentities/${graphPathSegment(autopilotId)}`,
    { method: "DELETE" }
  );
  return {
    success: status === 204 || status === 200,
    status,
    message: (status === 204 || status === 200) ? "Autopilot device record deleted." : `Delete from Autopilot failed with status ${status}.`
  };
}

export async function changePrimaryUser(
  token: string,
  intuneId: string,
  userId: string
): Promise<ActionResult> {
  // Step 1: Remove existing primary user reference
  const deleteResult = await requestWithDelegatedToken(
    token,
    `/deviceManagement/managedDevices/${graphPathSegment(intuneId)}/users/$ref`,
    { method: "DELETE" }
  );
  // 204 = removed, 404 = no user was assigned — both are acceptable before re-assigning
  if (deleteResult.status !== 204 && deleteResult.status !== 404) {
    return {
      success: false,
      status: deleteResult.status,
      message: `Failed to clear existing primary user (status ${deleteResult.status}).`
    };
  }

  // Step 2: Assign the new primary user
  const { status } = await requestWithDelegatedToken(
    token,
    `/deviceManagement/managedDevices/${graphPathSegment(intuneId)}/users/$ref`,
    {
      method: "POST",
      body: {
        "@odata.id": graphUserRef(userId)
      }
    }
  );
  return {
    success: status === 204,
    status,
    message: status === 204
      ? "Primary user updated. Change takes effect after next sync."
      : `Failed to assign primary user (status ${status}).`
  };
}
