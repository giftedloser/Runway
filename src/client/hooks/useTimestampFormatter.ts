import { formatDistanceToNow } from "date-fns";

import { useSettings } from "./useSettings.js";

type DateFormat = "relative" | "absolute";
type TimeFormat = "12h" | "24h";

function settingValue<T>(settings: ReturnType<typeof useSettings>, key: string, fallback: T): T {
  const setting = settings.data?.appSettings.find((item) => item.key === key);
  return (setting?.value as T | undefined) ?? fallback;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function absoluteTimestamp(date: Date, timeFormat: TimeFormat) {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const minutes = pad(date.getMinutes());

  if (timeFormat === "12h") {
    const period = date.getHours() >= 12 ? "PM" : "AM";
    const hour = date.getHours() % 12 || 12;
    return `${year}-${month}-${day} ${hour}:${minutes} ${period}`;
  }

  return `${year}-${month}-${day} ${pad(date.getHours())}:${minutes}`;
}

export function useTimestampFormatter() {
  const settings = useSettings();
  const dateFormat = settingValue<DateFormat>(settings, "display.dateFormat", "relative");
  const timeFormat = settingValue<TimeFormat>(settings, "display.timeFormat", "24h");

  return (value: string | Date | null | undefined) => {
    if (!value) return "never";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    if (dateFormat === "absolute") return absoluteTimestamp(date, timeFormat);
    return formatDistanceToNow(date, { addSuffix: true });
  };
}
