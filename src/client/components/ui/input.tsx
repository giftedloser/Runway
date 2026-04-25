import type { InputHTMLAttributes } from "react";

import { cn } from "../../lib/utils.js";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 rounded-[var(--pc-radius-sm)] border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] px-3 text-[13px] text-[var(--pc-text)] caret-[var(--pc-accent)] outline-none placeholder:text-[var(--pc-text-muted)] transition-[border-color,box-shadow,background-color,color] duration-150 hover:border-[var(--pc-border-hover)] focus:border-[var(--pc-accent)] focus:shadow-[var(--pc-ring)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)] aria-invalid:border-[var(--pc-critical)] aria-invalid:shadow-[0_0_0_1px_color-mix(in_srgb,var(--pc-critical)_38%,transparent)]",
        className
      )}
      {...props}
    />
  );
}
