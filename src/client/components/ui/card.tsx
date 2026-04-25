import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils.js";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--pc-radius)] border border-[var(--pc-border)] bg-[var(--pc-surface)] shadow-[var(--pc-shadow-card)] transition-[background-color,border-color,box-shadow] duration-150",
        className
      )}
      {...props}
    />
  );
}
