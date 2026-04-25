import { requestWithDelegatedToken } from "../auth/delegated-auth.js";
import { graphDirectoryObjectRef, graphPathSegment } from "./graph-url.js";

interface ActionResult {
  success: boolean;
  status: number;
  message: string;
  id?: string;
}

export async function createGroup(
  token: string,
  displayName: string,
  membershipType: "assigned" | "dynamic",
  membershipRule?: string
): Promise<ActionResult> {
  const body: Record<string, unknown> = {
    displayName,
    mailEnabled: false,
    mailNickname: displayName.replace(/[^a-zA-Z0-9]/g, ""),
    securityEnabled: true,
    groupTypes: membershipType === "dynamic" ? ["DynamicMembership"] : []
  };
  if (membershipType === "dynamic" && membershipRule) {
    body.membershipRule = membershipRule;
    body.membershipRuleProcessingState = "On";
  }

  const { status, data } = await requestWithDelegatedToken<{ id: string }>(
    token,
    "/groups",
    { method: "POST", body }
  );

  return {
    success: status === 201,
    status,
    message: status === 201 ? `Group "${displayName}" created.` : `Failed to create group (status ${status}).`,
    id: data?.id
  };
}

export async function updateMembershipRule(
  token: string,
  groupId: string,
  membershipRule: string
): Promise<ActionResult> {
  const { status } = await requestWithDelegatedToken(
    token,
    `/groups/${graphPathSegment(groupId)}`,
    {
      method: "PATCH",
      body: {
        membershipRule,
        membershipRuleProcessingState: "On"
      }
    }
  );

  return {
    success: status === 204,
    status,
    message: status === 204 ? "Membership rule updated." : `Failed to update rule (status ${status}).`
  };
}

export async function addDeviceToGroup(
  token: string,
  groupId: string,
  entraDeviceId: string
): Promise<ActionResult> {
  const { status } = await requestWithDelegatedToken(
    token,
    `/groups/${graphPathSegment(groupId)}/members/$ref`,
    {
      method: "POST",
      body: {
        "@odata.id": graphDirectoryObjectRef(entraDeviceId)
      }
    }
  );

  return {
    success: status === 204,
    status,
    message: status === 204 ? "Device added to group." : `Failed to add device (status ${status}).`
  };
}

export async function removeDeviceFromGroup(
  token: string,
  groupId: string,
  entraDeviceId: string
): Promise<ActionResult> {
  const { status } = await requestWithDelegatedToken(
    token,
    `/groups/${graphPathSegment(groupId)}/members/${graphPathSegment(entraDeviceId)}/$ref`,
    { method: "DELETE" }
  );

  return {
    success: status === 204,
    status,
    message: status === 204 ? "Device removed from group." : `Failed to remove device (status ${status}).`
  };
}
