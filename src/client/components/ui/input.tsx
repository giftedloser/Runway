import type { InputHTMLAttributes } from "react";

import { cn } from "../../lib/utils.js";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-8 rounded-[var(--pc-radius-sm)] border border-[var(--pc-input-border)] bg-[var(--pc-input-bg)] px-2.5 text-[12px] text-[var(--pc-input-text)] caret-[var(--pc-accent)] outline-none placeholder:text-[var(--pc-placeholder)] transition-[border-color,box-shadow,background-color,color] duration-150 hover:border-[var(--pc-border-hover)] focus:border-[var(--pc-accent)] focus:shadow-[var(--pc-ring)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)] aria-invalid:border-[var(--pc-critical)] aria-invalid:shadow-[var(--pc-ring)]",
        className,
      )}
      {...props}
    />
  );
}
