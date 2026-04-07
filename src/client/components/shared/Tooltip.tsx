import type { ReactNode } from "react";

import { cn } from "../../lib/utils.js";

/**
 * Lightweight CSS-only tooltip — avoids bringing in Radix for a simple
 * hover hint. Wrap any element and pass `content`. Tooltip is rendered
 * absolutely positioned above the wrapped child on hover/focus.
 */
export function Tooltip({
  content,
  children,
  className,
  align = "center"
}: {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  align?: "start" | "center" | "end";
}) {
  return (
    <span className={cn("group/tt relative inline-flex", className)} tabIndex={0}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full z-30 mb-1.5 hidden w-max max-w-[260px] rounded-md border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-2.5 py-1.5 text-[11px] leading-snug text-[var(--pc-text-secondary)] shadow-lg group-hover/tt:block group-focus/tt:block",
          align === "start" && "left-0",
          align === "center" && "left-1/2 -translate-x-1/2",
          align === "end" && "right-0"
        )}
      >
        {content}
      </span>
    </span>
  );
}
