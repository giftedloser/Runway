import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils.js";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--pc-border)] bg-[var(--pc-surface)] shadow-[0_18px_60px_rgba(0,0,0,0.14)] transition-[background-color,border-color,box-shadow] duration-150",
        className
      )}
      {...props}
    />
  );
}
