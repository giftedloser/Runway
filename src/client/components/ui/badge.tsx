import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils.js";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium",
        className
      )}
      {...props}
    />
  );
}
