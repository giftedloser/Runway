import { useQuery } from "@tanstack/react-query";

import type { ProfileAuditSummary } from "../lib/types.js";
import { apiRequest } from "../lib/api.js";

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: () => apiRequest<ProfileAuditSummary[]>("/api/profiles")
  });
}
