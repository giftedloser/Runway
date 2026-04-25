import { requestWithDelegatedToken } from "../auth/delegated-auth.js";
import { escapeODataString, graphPathSegment } from "./graph-url.js";

export interface BitLockerKey {
  id: string;
  createdDateTime: string | null;
  volumeType: string | null;
  key: string;
}

interface GraphBitLockerKeyListResponse {
  value: Array<{
    id: string;
    createdDateTime: string | null;
    deviceId: string;
    volumeType: string | null;
  }>;
}

interface GraphBitLockerKeyResponse {
  id: string;
  createdDateTime: string | null;
  volumeType: string | null;
  key: string;
}

export async function getBitLockerKeys(
  token: string,
  entraDeviceId: string
): Promise<{ success: boolean; status: number; keys: BitLockerKey[]; message: string }> {
  // Step 1: List recovery keys for this device
  const listResult = await requestWithDelegatedToken<GraphBitLockerKeyListResponse>(
    token,
    `/informationProtection/bitlocker/recoveryKeys?$filter=deviceId eq '${escapeODataString(entraDeviceId)}'`
  );

  if (listResult.status !== 200 || !listResult.data?.value?.length) {
    return {
      success: false,
      status: listResult.status,
      keys: [],
      message:
        listResult.status === 404 || !listResult.data?.value?.length
          ? "No BitLocker recovery keys found for this device."
          : `Failed to list BitLocker keys (status ${listResult.status}).`
    };
  }

  // Step 2: Fetch actual key value for each recovery key
  const keys: BitLockerKey[] = [];
  for (const entry of listResult.data.value) {
    const keyResult = await requestWithDelegatedToken<GraphBitLockerKeyResponse>(
      token,
      `/informationProtection/bitlocker/recoveryKeys/${graphPathSegment(entry.id)}?$select=key`
    );
    if (keyResult.status === 200 && keyResult.data?.key) {
      keys.push({
        id: entry.id,
        createdDateTime: entry.createdDateTime,
        volumeType: entry.volumeType,
        key: keyResult.data.key
      });
    }
  }

  return {
    success: keys.length > 0,
    status: 200,
    keys,
    message: keys.length > 0
      ? `Retrieved ${keys.length} BitLocker recovery key${keys.length > 1 ? "s" : ""}.`
      : "Keys listed but could not retrieve key values."
  };
}
