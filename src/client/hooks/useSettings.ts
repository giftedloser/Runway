import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { SettingsResponse, TagConfigRecord } from "../lib/types.js";
import { apiRequest } from "../lib/api.js";

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => apiRequest<SettingsResponse>("/api/settings")
  });
}

export function useTagConfigMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries();

  return {
    create: useMutation({
      mutationFn: (record: TagConfigRecord) =>
        apiRequest<TagConfigRecord[]>("/api/settings/tag-config", {
          method: "POST",
          body: JSON.stringify(record)
        }),
      onSuccess: invalidate
    }),
    update: useMutation({
      mutationFn: (record: TagConfigRecord) =>
        apiRequest<TagConfigRecord[]>(`/api/settings/tag-config/${record.groupTag}`, {
          method: "PUT",
          body: JSON.stringify(record)
        }),
      onSuccess: invalidate
    }),
    remove: useMutation({
      mutationFn: (groupTag: string) =>
        apiRequest<void>(`/api/settings/tag-config/${groupTag}`, { method: "DELETE" }),
      onSuccess: invalidate
    })
  };
}
