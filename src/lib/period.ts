export type PeriodRange = "week" | "month" | "custom" | "all";

export type PeriodInput = {
  range?: PeriodRange | string | null;
  month?: string | null;
  week?: string | null;
  from?: string | null;
  to?: string | null;
};

export type ResolvedPeriod = {
  range: PeriodRange;
  month: string;
  week: string;
  from: string;
  to: string;
  gte: Date;
  lt: Date;
  label: string;
};

export function currentMonth(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function currentISOWeek(date = new Date()) {
  return dateToISOWeek(date);
}

export function dateToISOWeek(date: Date) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function parseISOWeek(week: string) {
  const match = week.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const weekNum = Number(match[2]);
  if (!Number.isFinite(year) || weekNum < 1 || weekNum > 53) return null;

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const start = startOfISOWeek(jan4);
  start.setUTCDate(start.getUTCDate() + (weekNum - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  return { gte: start, lt: end };
}

export function startOfISOWeek(date: Date) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  if (day !== 1) utc.setUTCDate(utc.getUTCDate() - (day - 1));
  return utc;
}

export function parseMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const start = new Date(`${month}-01T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { gte: start, lt: end };
}

export function parseDay(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatShort(date: Date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function resolvePeriod(input: PeriodInput = {}): ResolvedPeriod {
  const month = input.month && /^\d{4}-\d{2}$/.test(input.month) ? input.month : currentMonth();
  const week = input.week && /^\d{4}-W\d{2}$/.test(input.week) ? input.week : currentISOWeek();

  let range: PeriodRange = "month";
  if (input.range === "week" || input.range === "custom" || input.range === "all" || input.range === "month") {
    range = input.range;
  } else if (parseDay(input.from) && parseDay(input.to)) {
    range = "custom";
  }

  if (range === "all") {
    return {
      range,
      month,
      week,
      from: "",
      to: "",
      gte: new Date("1970-01-01T00:00:00.000Z"),
      lt: new Date("2999-01-01T00:00:00.000Z"),
      label: "All time",
    };
  }

  if (range === "custom") {
    const monthBounds = parseMonth(month) ?? parseMonth(currentMonth())!;
    const gte = parseDay(input.from) ?? monthBounds.gte;
    const toDate = parseDay(input.to);
    const lt = toDate
      ? new Date(Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate() + 1))
      : monthBounds.lt;
    const from = isoDay(gte);
    const to = isoDay(new Date(lt.getTime() - 1));
    return {
      range,
      month,
      week,
      from,
      to,
      gte,
      lt,
      label: from === to ? formatShort(gte) : `${formatShort(gte)} – ${formatShort(new Date(lt.getTime() - 1))}`,
    };
  }

  if (range === "week") {
    const parsed = parseISOWeek(week) ?? parseISOWeek(currentISOWeek())!;
    return {
      range,
      month,
      week,
      from: isoDay(parsed.gte),
      to: isoDay(new Date(parsed.lt.getTime() - 1)),
      gte: parsed.gte,
      lt: parsed.lt,
      label: `Week of ${formatShort(parsed.gte)}`,
    };
  }

  const parsed = parseMonth(month) ?? parseMonth(currentMonth())!;
  const [year, monthNum] = month.split("-");
  const monthLabel = new Date(Date.UTC(Number(year), Number(monthNum) - 1, 1)).toLocaleDateString(
    "en-GB",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );

  return {
    range,
    month,
    week,
    from: isoDay(parsed.gte),
    to: isoDay(new Date(parsed.lt.getTime() - 1)),
    gte: parsed.gte,
    lt: parsed.lt,
    label: monthLabel,
  };
}

export function previousResolved(period: ResolvedPeriod) {
  const span = period.lt.getTime() - period.gte.getTime();
  return {
    gte: new Date(period.gte.getTime() - span),
    lt: period.gte,
  };
}

export function periodQuery(period: Pick<ResolvedPeriod, "range" | "month" | "week" | "from" | "to">) {
  return {
    range: period.range === "month" ? undefined : period.range,
    month: period.month,
    week: period.week,
    from: period.range === "custom" ? period.from : undefined,
    to: period.range === "custom" ? period.to : undefined,
  };
}
