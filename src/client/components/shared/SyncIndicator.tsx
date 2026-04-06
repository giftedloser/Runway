import { formatDistanceToNow } from "date-fns";
import { Clock } from "lucide-react";

export function SyncIndicator({ lastSync }: { lastSync: string | null }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2.5 py-1.5 text-[12px] text-[var(--pc-text-secondary)]">
      <Clock className="h-3 w-3" />
      {lastSync
        ? `Synced ${formatDistanceToNow(new Date(lastSync), { addSuffix: true })}`
        : "Never synced"}
    </div>
  );
}
