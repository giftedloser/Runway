import { useNavigate, useSearch } from "@tanstack/react-router";
import { Search } from "lucide-react";

import { cn } from "../../lib/utils.js";
import { Input } from "../ui/input.js";

export function DeviceFilters() {
  const navigate = useNavigate({ from: "/devices" });
  const search = useSearch({ from: "/devices" });

  const healthOptions = ["critical", "warning", "healthy"] as const;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative max-w-md flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--pc-text-muted)]" />
        <Input
          className="w-full pl-9"
          placeholder="Search by name, serial, or UPN..."
          value={search.search ?? ""}
          onChange={(event) =>
            navigate({
              search: (previous) => ({ ...previous, search: event.target.value || undefined, page: 1 })
            })
          }
        />
      </div>
      <div className="flex gap-1.5">
        {healthOptions.map((health) => (
          <button
            key={health}
            onClick={() =>
              navigate({
                search: (previous) => ({
                  ...previous,
                  health: previous.health === health ? undefined : health,
                  page: 1
                })
              })
            }
            className={cn(
              "rounded-lg px-3 py-1.5 text-[12px] font-medium capitalize transition-colors",
              search.health === health
                ? "bg-[var(--pc-accent)] text-white"
                : "bg-white/[0.04] text-[var(--pc-text-secondary)] hover:bg-white/[0.07]"
            )}
          >
            {health}
          </button>
        ))}
      </div>
    </div>
  );
}
