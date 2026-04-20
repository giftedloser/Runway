import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { SavedView, SavedViewInput } from "../lib/types.js";
import { apiRequest } from "../lib/api.js";

export function useUserViews() {
  return useQuery({
    queryKey: ["user-views"],
    queryFn: () => apiRequest<SavedView[]>("/api/user-views"),
    staleTime: 60_000
  });
}

export function useUserViewMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["user-views"] });
  };

  return {
    create: useMutation({
      mutationFn: (input: SavedViewInput) =>
        apiRequest<SavedView>("/api/user-views", {
          method: "POST",
          body: JSON.stringify(input)
        }),
      onSuccess: invalidate
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: Partial<SavedViewInput> }) =>
        apiRequest<SavedView>(`/api/user-views/${id}`, {
          method: "PUT",
          body: JSON.stringify(input)
        }),
      onSuccess: invalidate
    }),
    remove: useMutation({
      mutationFn: (id: string) =>
        apiRequest<void>(`/api/user-views/${id}`, { method: "DELETE" }),
      onSuccess: invalidate
    }),
    reorder: useMutation({
      mutationFn: (ids: string[]) =>
        apiRequest<SavedView[]>("/api/user-views/reorder", {
          method: "PUT",
          body: JSON.stringify({ ids })
        }),
      onSuccess: invalidate
    })
  };
}
