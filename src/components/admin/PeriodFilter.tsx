"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function PeriodFilter({
  defaultMonth,
}: {
  compact?: boolean;
  defaultMonth: string;
  defaultWeek?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const range = searchParams.get("range") === "all" ? "all" : "month";
  const month = searchParams.get("month") ?? defaultMonth;

  function commit(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="period-range">
        Period
      </label>
      <select
        id="period-range"
        value={range}
        onChange={(event) => commit({ range: event.target.value === "month" ? "" : event.target.value })}
        className="tl-input h-11 min-w-0 px-3 text-sm sm:h-10"
      >
        <option value="month">Month</option>
        <option value="all">All time</option>
      </select>
      {range === "month" ? (
        <input
          type="month"
          value={month}
          onChange={(event) => commit({ month: event.target.value, range: "" })}
          className="tl-input h-11 min-w-0 px-3 text-sm sm:h-10"
          aria-label="Month"
        />
      ) : null}
    </div>
  );
}
