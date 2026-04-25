const GRAPH_V1_ORIGIN = "https://graph.microsoft.com/v1.0";

export function graphPathSegment(value: string) {
  return encodeURIComponent(value);
}

export function escapeODataString(value: string) {
  return value.replace(/'/g, "''");
}

export function graphUserRef(userId: string) {
  return `${GRAPH_V1_ORIGIN}/users/${graphPathSegment(userId)}`;
}

export function graphDirectoryObjectRef(objectId: string) {
  return `${GRAPH_V1_ORIGIN}/directoryObjects/${graphPathSegment(objectId)}`;
}
