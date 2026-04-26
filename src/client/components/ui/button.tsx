import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils.js";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded-[var(--pc-radius-sm)] px-3 py-1.5 text-[12px] font-medium transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)] disabled:cursor-not-allowed disabled:bg-[var(--pc-surface-raised)] disabled:text-[var(--pc-text-muted)] disabled:shadow-none disabled:hover:translate-y-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--pc-accent)] text-[var(--pc-accent-contrast)] hover:-translate-y-px hover:bg-[var(--pc-accent-hover)]",
        ghost:
          "text-[var(--pc-text-body)] hover:bg-[var(--pc-surface-raised)] hover:text-[var(--pc-text-heading)]",
        secondary:
          "border border-[var(--pc-border)] bg-[var(--pc-surface)] text-[var(--pc-text-body)] hover:-translate-y-px hover:border-[var(--pc-border-hover)] hover:bg-[var(--pc-surface-raised)]",
        destructive:
          "border border-[var(--pc-critical)] bg-[var(--pc-critical-muted)] text-[var(--pc-critical)] hover:-translate-y-px hover:border-[var(--pc-critical)] hover:bg-[var(--pc-surface-raised)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant }), className)} {...props} />
  );
}
