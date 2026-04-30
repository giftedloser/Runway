import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "../../lib/utils.js";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

const PAGE_SIZES = [25, 50, 100, 200];

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(total, safePage * pageSize);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-[12px] text-[var(--pc-text-muted)]">
        {total === 0 ? (
          "No results"
        ) : (
          <>
            Showing <span className="font-medium text-[var(--pc-text-secondary)]">{start.toLocaleString()}</span>
            {"–"}
            <span className="font-medium text-[var(--pc-text-secondary)]">{end.toLocaleString()}</span>{" "}
            of <span className="font-medium text-[var(--pc-text-secondary)]">{total.toLocaleString()}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        {onPageSizeChange ? (
          <label className="flex items-center gap-1.5 text-[12px] text-[var(--pc-text-muted)]">
            Per page
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2 py-1 text-[12px] text-[var(--pc-text)] transition-colors focus:border-[var(--pc-accent)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md border border-[var(--pc-border)] text-[var(--pc-text-secondary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]",
              safePage <= 1
                ? "cursor-not-allowed opacity-40"
                : "hover:border-[var(--pc-accent)] hover:text-[var(--pc-text)]"
            )}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="px-2 text-[12px] tabular-nums text-[var(--pc-text-secondary)]">
            Page <span className="font-medium text-[var(--pc-text)]">{safePage}</span> / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-md border border-[var(--pc-border)] text-[var(--pc-text-secondary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]",
              safePage >= totalPages
                ? "cursor-not-allowed opacity-40"
                : "hover:border-[var(--pc-accent)] hover:text-[var(--pc-text)]"
            )}
            aria-label="Next page"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
