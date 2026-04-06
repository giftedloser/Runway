import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils.js";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--pc-border)] bg-[var(--pc-surface)]",
        className
      )}
      {...props}
    />
  );
}
