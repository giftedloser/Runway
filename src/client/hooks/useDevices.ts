import { useQuery } from "@tanstack/react-query";

import type { DeviceDetailResponse } from "../lib/types.js";
import { apiRequest } from "../lib/api.js";

export function useDevices(search: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(search).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  });

  return useQuery({
    queryKey: ["devices", search],
    queryFn: () =>
      apiRequest<{
        items: DeviceDetailResponse["summary"][];
        total: number;
        page: number;
        pageSize: number;
      }>(`/api/devices?${params.toString()}`)
  });
}

export function useDevice(deviceKey: string) {
  return useQuery({
    queryKey: ["device", deviceKey],
    queryFn: () => apiRequest<DeviceDetailResponse>(`/api/devices/${deviceKey}`)
  });
}
