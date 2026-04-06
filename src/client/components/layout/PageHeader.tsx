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
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--pc-accent)]">
          {eyebrow}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--pc-text-secondary)]">
          {description}
        </p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
