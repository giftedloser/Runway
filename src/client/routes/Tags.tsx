import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Search,
  Tags,
} from "lucide-react";
import { useState } from "react";

import { PageHeader } from "../components/layout/PageHeader.js";
import { ErrorState, LoadingState } from "../components/shared/ErrorState.js";
import { SourceBadge } from "../components/shared/SourceBadge.js";
import { Card } from "../components/ui/card.js";
import { Input } from "../components/ui/input.js";
import type { TagInventoryItem } from "../components/provisioning/types.js";
import { useTimestampFormatter } from "../hooks/useTimestampFormatter.js";
import { apiRequest } from "../lib/api.js";
import { cn } from "../lib/utils.js";

export function TagsPage() {
  const [search, setSearch] = useState("");
  const formatTimestamp = useTimestampFormatter();
  const tags = useQuery({
    queryKey: ["provisioning-tags"],
    queryFn: () => apiRequest<TagInventoryItem[]>("/api/provisioning/tags"),
  });

  const normalizedSearch = search.trim().toLowerCase();
  const visibleTags = (tags.data ?? []).filter((tag) => {
    if (!normalizedSearch) return true;
    return `${tag.groupTag} ${tag.propertyLabel ?? ""}`
      .toLowerCase()
      .includes(normalizedSearch);
  });
  const configuredCount = (tags.data ?? []).filter((tag) => tag.configured).length;
  const discoveredOnlyCount = Math.max(0, (tags.data?.length ?? 0) - configuredCount);
  const deviceCount = (tags.data ?? []).reduce(
    (total, tag) => total + tag.deviceCount,
    0,
  );

  if (tags.isLoading) return <LoadingState label="Loading tags..." />;
  if (tags.isError) {
    return (
      <ErrorState
        title="Could not load tags"
        error={tags.error}
        onRetry={() => tags.refetch()}
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Inspect"
        title="Tags"
        description="Browse every Autopilot group tag currently seen on devices."
        actions={
          <>
            <SourceBadge source="autopilot" />
            <SourceBadge source="derived" />
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <TagMetric label="Tags" value={tags.data?.length ?? 0} />
        <TagMetric label="Devices" value={deviceCount} />
        <TagMetric
          label="Discovered-only"
          value={discoveredOnlyCount}
          tone={discoveredOnlyCount > 0 ? "warning" : "neutral"}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--pc-border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Tags className="h-4 w-4 text-[var(--pc-accent)]" />
            <div className="text-[13px] font-semibold text-[var(--pc-text)]">
              Tag Inventory
            </div>
            <span className="text-[11px] text-[var(--pc-text-muted)]">
              ({visibleTags.length})
            </span>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--pc-text-muted)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter tags"
              name="tag-search"
              autoComplete="off"
              spellCheck={false}
              className="h-9 pl-8"
            />
          </div>
        </div>

        {(tags.data?.length ?? 0) === 0 ? (
          <div className="px-5 py-8 text-center text-[12px] text-[var(--pc-text-muted)]">
            No group tags found. Run a sync after Autopilot devices have tags.
          </div>
        ) : visibleTags.length === 0 ? (
          <div className="px-5 py-8 text-center text-[12px] text-[var(--pc-text-muted)]">
            No tags match the current filter.
          </div>
        ) : (
          <div>
            <div className="hidden grid-cols-[minmax(0,1.35fr)_110px_150px_150px_minmax(0,1fr)_24px] border-b border-[var(--pc-border)] bg-[var(--pc-surface)] px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)] sm:grid">
              <div>Tag</div>
              <div>Devices</div>
              <div>Last Seen</div>
              <div>Status</div>
              <div>Property</div>
              <div />
            </div>
            <div className="divide-y divide-[var(--pc-border)]">
              {visibleTags.map((tag) => (
                <Link
                  key={tag.groupTag}
                  to="/provisioning"
                  search={{ groupTag: tag.groupTag }}
                  className="grid gap-2 px-4 py-3 transition-colors hover:bg-[var(--pc-tint-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)] sm:grid-cols-[minmax(0,1.35fr)_110px_150px_150px_minmax(0,1fr)_24px] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-[var(--pc-text)]">
                      {tag.groupTag}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--pc-text-muted)] sm:hidden">
                      {tag.deviceCount.toLocaleString()} devices
                    </div>
                  </div>
                  <div className="hidden text-[12px] font-medium text-[var(--pc-text-secondary)] sm:block">
                    {tag.deviceCount.toLocaleString()}
                  </div>
                  <div className="text-[11.5px] text-[var(--pc-text-muted)]">
                    {tag.lastSeenAt ? formatTimestamp(tag.lastSeenAt) : "No sync"}
                  </div>
                  <div>
                    <ConfigStatus configured={tag.configured} />
                  </div>
                  <div className="truncate text-[11.5px] text-[var(--pc-text-secondary)]">
                    {tag.propertyLabel ?? "Unmapped"}
                  </div>
                  <ArrowRight className="hidden h-3.5 w-3.5 text-[var(--pc-text-muted)] sm:block" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function TagMetric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warning";
}) {
  return (
    <Card className="px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--pc-text-muted)]">
        {label}
      </div>
      <div
        className={cn(
          "mt-2 text-[22px] font-semibold leading-none",
          tone === "warning" ? "text-[var(--pc-warning)]" : "text-[var(--pc-text)]",
        )}
      >
        {value.toLocaleString()}
      </div>
    </Card>
  );
}

function ConfigStatus({ configured }: { configured: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] font-medium",
        configured
          ? "bg-[var(--pc-healthy-muted)] text-[var(--pc-healthy)]"
          : "bg-[var(--pc-warning-muted)] text-[var(--pc-warning)]",
      )}
    >
      {configured ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <CircleDashed className="h-3 w-3" />
      )}
      {configured ? "Configured" : "Discovered-only"}
    </span>
  );
}
