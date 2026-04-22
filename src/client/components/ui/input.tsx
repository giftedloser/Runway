import type { InputHTMLAttributes } from "react";

import { cn } from "../../lib/utils.js";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 rounded-lg border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-3 text-[13px] text-[var(--pc-text)] outline-none placeholder:text-[var(--pc-text-muted)] transition-[border-color,box-shadow,background-color,color] duration-150 hover:border-[var(--pc-border-hover)] focus:border-[var(--pc-accent)] focus:ring-1 focus:ring-[var(--pc-accent)]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)]",
        className
      )}
      {...props}
    />
  );
}
