import { useEffect, type ReactNode } from "react";

import { Button } from "../ui/button.js";

export function EmptyState({
  id,
  title,
  description,
  action
}: {
  id: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}) {
  useEffect(() => {
    console.info("[v1.6][empty-state] Empty state shown", { id });
  }, [id]);

  return (
    <div className="px-5 py-8 text-center">
      <div className="text-[13px] font-semibold text-[var(--pc-text)]">{title}</div>
      <div className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-[var(--pc-text-muted)]">
        {description}
      </div>
      {action ? (
        <Button type="button" variant="secondary" className="mt-4 h-8 px-2.5 text-[11.5px]" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

export function EmptyStateBox({ children }: { children: ReactNode }) {
  return <div className="px-5 py-8 text-center text-[12px] text-[var(--pc-text-muted)]">{children}</div>;
}
