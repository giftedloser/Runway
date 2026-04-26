import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--pc-text-muted)]">
          {eyebrow}
        </div>
        <h1 className="mt-0.5 max-w-5xl truncate text-[1.45rem] font-semibold leading-tight tracking-tight text-[var(--pc-text)] sm:text-[1.7rem]">
          {title}
        </h1>
        <p className="mt-1 max-w-3xl overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-[var(--pc-text-muted)]">
          {description}
        </p>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
