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
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--pc-accent)]">
          {eyebrow}
        </div>
        <h1 className="font-display mt-1 max-w-5xl text-[1.8rem] font-semibold uppercase leading-none tracking-wide text-[var(--pc-text)] sm:text-[2.1rem]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-3xl text-[12.5px] leading-relaxed text-[var(--pc-text-secondary)]">
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
