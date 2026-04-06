import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils.js";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--pc-accent)] text-white shadow-sm hover:bg-[var(--pc-accent-hover)]",
        ghost:
          "text-[var(--pc-text-secondary)] hover:bg-white/[0.05] hover:text-[var(--pc-text)]",
        secondary:
          "border border-[var(--pc-border)] bg-[var(--pc-surface-raised)] text-[var(--pc-text)] hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-surface-overlay)]",
        destructive:
          "bg-[var(--pc-critical-muted)] text-[var(--pc-critical)] hover:bg-rose-500/20"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant }), className)} {...props} />;
}
