export function DataField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[11px] font-medium text-[var(--pc-text-muted)]">{label}</div>
      <div className="mt-1 font-mono text-[13px] text-[var(--pc-text)]">
        {value ?? <span className="text-[var(--pc-text-muted)]">&mdash;</span>}
      </div>
    </div>
  );
}
