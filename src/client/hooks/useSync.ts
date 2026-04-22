import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../components/shared/toast.js";
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
  const toast = useToast();

  return useMutation({
    mutationFn: () => apiRequest<SyncStatusResponse>("/api/sync", { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries();
      toast.push({
        variant: "success",
        title: "Sync triggered",
        description: "Refreshing Autopilot, Intune, Entra, and ConfigMgr signals."
      });
    },
    onError: (error: unknown) => {
      toast.push({
        variant: "error",
        title: "Sync failed",
        description: error instanceof Error ? error.message : "Unknown error."
      });
    }
  });
}
