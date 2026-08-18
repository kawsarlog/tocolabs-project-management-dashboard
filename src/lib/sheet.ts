import { currentISOWeek, currentMonth, resolvePeriod, type PeriodRange } from "@/lib/period";

export const SHEET_STATUSES = [
  "Assigned",
  "Pending",
  "Complete",
  "Delivered",
  "Important",
  "No Order",
] as const;

export type SheetStatus = (typeof SHEET_STATUSES)[number];

export type SearchParamRecord = {
  [key: string]: string | string[] | undefined;
};

export function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseRange(value?: string) {
  if (value === "week" || value === "custom" || value === "all" || value === "month") {
    return value;
  }
  return undefined;
}

export function parseSheetQuery(searchParams: SearchParamRecord = {}) {
  const q = firstParam(searchParams.q)?.trim() ?? "";
  const status = firstParam(searchParams.status)?.trim() ?? "";
  const employeeId = firstParam(searchParams.employee)?.trim() ?? "";
  const from = firstParam(searchParams.from)?.trim() ?? "";
  const to = firstParam(searchParams.to)?.trim() ?? "";
  const month = firstParam(searchParams.month) ?? currentMonth();
  const week = firstParam(searchParams.week) ?? currentISOWeek();
  const range: PeriodRange =
    parseRange(firstParam(searchParams.range)) ?? (from && to ? "custom" : "month");
  const page = Math.max(Number(firstParam(searchParams.page) ?? 1) || 1, 1);
  const pageSize = firstParam(searchParams.pageSize) === "50" ? 50 : 20;
  const period = resolvePeriod({ range, month, week, from, to });

  return {
    q,
    status,
    employeeId,
    from,
    to,
    page,
    pageSize,
    period,
  };
}

export function toQueryString(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
}

export function sheetHref(
  basePath: string,
  params: Record<string, string | number | undefined | null>,
) {
  return `${basePath}${toQueryString(params)}`;
}

export function isoDate(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

export function compactDate(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}
