import { useQuery } from "@tanstack/react-query";

import type { DashboardResponse } from "../lib/types.js";
import { apiRequest } from "../lib/api.js";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiRequest<DashboardResponse>("/api/dashboard")
  });
}
