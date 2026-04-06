import type { FlagCode } from "../../lib/types.js";
import { Badge } from "../ui/badge.js";

export function FlagChip({ flag }: { flag: FlagCode }) {
  return (
    <Badge className="bg-white/[0.06] text-[var(--pc-text-secondary)]">
      {flag.replaceAll("_", " ")}
    </Badge>
  );
}
