import { useQuery } from "@tanstack/react-query";

import type { FirstRunStatus } from "../lib/types.js";
import { apiRequest } from "../lib/api.js";

export function useFirstRunStatus() {
  return useQuery({
    queryKey: ["setup", "first-run-status"],
    queryFn: () => apiRequest<FirstRunStatus>("/api/setup/status"),
    refetchInterval: 30000
  });
}
