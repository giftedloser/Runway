import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiRequest } from "../lib/api.js";

export interface RetentionResult {
  ranAt: string;
  deletedHistoryRows: number;
  deletedActionLogRows: number;
  deletedSyncLogRows: number;
}

export interface SystemHealth {
  ok: boolean;
  dbReady: boolean;
  uptimeSeconds: number;
  graphConfigured: boolean;
  graphMissing: string[];
  lastSyncCompletedAt: string | null;
  syncBacklogMinutes: number | null;
  retention: RetentionResult | null;
}

const HEALTH_KEY = ["system-health"] as const;

export function useSystemHealth() {
  return useQuery({
    queryKey: HEALTH_KEY,
    queryFn: () => apiRequest<SystemHealth>("/api/health"),
    // Refresh on a cadence so the Settings panel reflects new sync /
    // retention activity without the user having to reload. 30s is a
    // comfortable middle ground: fast enough that a manual retention
    // run shows up promptly, slow enough to avoid log spam.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true
  });
}

export function useRunRetention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<RetentionResult>("/api/health/retention/run", { method: "POST" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: HEALTH_KEY });
    }
  });
}
