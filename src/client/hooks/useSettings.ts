import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  FeatureFlagMap,
  EffectiveAppSetting,
  SettingsResponse,
  TagConfigPreviewResponse,
  TagConfigRecord
} from "../lib/types.js";
import { apiRequest } from "../lib/api.js";

type FeatureFlagKey = keyof FeatureFlagMap;

export interface GraphCredentialsInput {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}

export interface GraphEnvInfo {
  envPath: string;
  configured: boolean;
  missing: string[];
}

export interface GraphSaveResult {
  message: string;
  envPath: string;
  restartRequired: boolean;
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => apiRequest<SettingsResponse>("/api/settings")
  });
}

export function useGraphEnvInfo() {
  return useQuery({
    queryKey: ["graph-env"],
    queryFn: () => apiRequest<GraphEnvInfo>("/api/settings/graph/env")
  });
}

export function useSaveGraphCredentials() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GraphCredentialsInput) =>
      apiRequest<GraphSaveResult>("/api/settings/graph", {
        method: "POST",
        body: JSON.stringify(input)
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["graph-env"] });
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    }
  });
}

export function useSetFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, enabled }: { key: FeatureFlagKey; enabled: boolean }) =>
      apiRequest<FeatureFlagMap>(`/api/settings/feature-flags/${key}`, {
        method: "PUT",
        body: JSON.stringify({ enabled })
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    }
  });
}

export function useSetAppSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) =>
      apiRequest<EffectiveAppSetting>(`/api/settings/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify({ value })
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<SettingsResponse>(["settings"], (current) =>
        current
          ? {
              ...current,
              appSettings: current.appSettings.map((setting) =>
                setting.key === updated.key ? updated : setting
              )
            }
          : current
      );
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      void queryClient.invalidateQueries({ queryKey: ["sync-status"] });
    }
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

export function usePreviewTagConfig() {
  return useMutation({
    mutationFn: (record: TagConfigRecord) =>
      apiRequest<TagConfigPreviewResponse>("/api/settings/tag-config/preview", {
        method: "POST",
        body: JSON.stringify(record)
      })
  });
}
