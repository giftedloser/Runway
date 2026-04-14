import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AuthStatus } from "../lib/types.js";
import { apiRequest } from "../lib/api.js";

export function useAuthStatus() {
  return useQuery({
    queryKey: ["auth", "status"],
    queryFn: () => apiRequest<AuthStatus>("/api/auth/status"),
    refetchInterval: 60_000,
    staleTime: 30_000
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: async () => {
      const { loginUrl } = await apiRequest<{ loginUrl: string }>("/api/auth/login");
      // Open Microsoft login in default browser
      const popup = window.open(loginUrl, "_blank", "width=600,height=700");
      if (!popup) {
        throw new Error("Browser blocked the login popup. Please allow popups for this site and try again.");
      }
      return loginUrl;
    }
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiRequest<{ authenticated: boolean }>("/api/auth/logout", {
        method: "POST"
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "status"] });
    }
  });
}
