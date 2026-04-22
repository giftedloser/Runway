import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../../lib/utils.js";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pc-accent)] disabled:cursor-not-allowed disabled:opacity-40 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--pc-accent)] text-white shadow-sm hover:bg-[var(--pc-accent-hover)] hover:shadow-md",
        ghost:
          "text-[var(--pc-text-secondary)] hover:bg-[var(--pc-tint-hover)] hover:text-[var(--pc-text)]",
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
