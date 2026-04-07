import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ActionLogEntry, ActionResult, RemoteActionType } from "../lib/types.js";
import { apiRequest } from "../lib/api.js";

interface ActionPayload {
  deviceKey: string;
  action: RemoteActionType;
  body?: Record<string, unknown>;
}

export function useRemoteAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceKey, action, body }: ActionPayload) =>
      apiRequest<ActionResult>(`/api/actions/${deviceKey}/${action}`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined
      }),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ["device", variables.deviceKey] });
      queryClient.invalidateQueries({ queryKey: ["actions", "logs"] });
    }
  });
}

export function useDeviceActionLogs(deviceKey: string | undefined, limit = 25) {
  return useQuery({
    queryKey: ["actions", "logs", deviceKey, limit],
    enabled: Boolean(deviceKey),
    queryFn: () =>
      apiRequest<ActionLogEntry[]>(
        `/api/actions/logs/${deviceKey}?limit=${limit}`
      )
  });
}

export function useActionLogs(limit = 200) {
  return useQuery({
    queryKey: ["actions", "logs", "all", limit],
    queryFn: () => apiRequest<ActionLogEntry[]>(`/api/actions/logs?limit=${limit}`),
    refetchInterval: 30_000
  });
}
