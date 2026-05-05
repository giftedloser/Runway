import type { TagInventoryItem } from "../components/provisioning/types.js";

export function safeTagCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function normalizeTagInventory(value: unknown): TagInventoryItem[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value
    .map((item): TagInventoryItem | null => {
      if (!item || typeof item !== "object") return null;

      const row = item as Partial<TagInventoryItem>;
      if (typeof row.groupTag !== "string" || row.groupTag.trim().length === 0) {
        return null;
      }

      const groupTag = row.groupTag.trim();
      const key = groupTag.toLowerCase();
      if (seen.has(key)) return null;
      seen.add(key);

      return {
        groupTag,
        deviceCount: safeTagCount(row.deviceCount),
        lastSeenAt: typeof row.lastSeenAt === "string" ? row.lastSeenAt : null,
        configured: row.configured === true,
        propertyLabel:
          typeof row.propertyLabel === "string" && row.propertyLabel.trim().length > 0
            ? row.propertyLabel.trim()
            : null,
      };
    })
    .filter((item): item is TagInventoryItem => item !== null);
}
