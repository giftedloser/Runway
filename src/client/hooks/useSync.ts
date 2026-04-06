import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { SyncStatusResponse } from "../lib/types.js";
import { apiRequest } from "../lib/api.js";

export function useSyncStatus() {
  return useQuery({
    queryKey: ["sync-status"],
    queryFn: () => apiRequest<SyncStatusResponse>("/api/sync/status"),
    refetchInterval: 15000
  });
}

export function useTriggerSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiRequest<SyncStatusResponse>("/api/sync", { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    }
  });
}
