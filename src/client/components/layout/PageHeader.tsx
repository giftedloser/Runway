import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--pc-accent)]">
          {eyebrow}
        </div>
        <h1 className="font-display mt-1 max-w-5xl text-[2.1rem] font-semibold uppercase leading-none tracking-wide text-[var(--pc-text)] sm:text-[2.45rem]">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--pc-text-secondary)]">
          {description}
        </p>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}
