"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SHEET_STATUSES } from "@/lib/sheet";

export default function DashboardFilters({
  employees,
  defaultMonth,
  defaultWeek,
}: {
  employees: Array<{ id: string; displayName: string }>;
  defaultMonth: string;
  defaultWeek: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const employee = searchParams.get("employee") ?? "";
  const range = searchParams.get("range") ?? "month";
  const month = searchParams.get("month") ?? defaultMonth;
  const week = searchParams.get("week") ?? defaultWeek;
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  function commit(next: Record<string, string>, extrasToDelete: string[] = []) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    for (const key of extrasToDelete) params.delete(key);
    params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <form
      key={searchParams.toString()}
      className="tl-toolbar"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        commit({
          q: String(form.get("q") ?? "").trim(),
          status: String(form.get("status") ?? ""),
          employee: String(form.get("employee") ?? ""),
          range: String(form.get("range") ?? "month"),
          month: String(form.get("month") ?? ""),
          week: String(form.get("week") ?? ""),
          from: String(form.get("from") ?? ""),
          to: String(form.get("to") ?? ""),
        });
      }}
    >
      <label className="sr-only" htmlFor="admin-search">
        Search orders
      </label>
      <input
        id="admin-search"
        name="q"
        defaultValue={q}
        placeholder="Search client, order ID, notes"
        className="tl-toolbar-search tl-input h-11 min-w-0 w-full flex-1 px-3 text-sm sm:h-10 sm:min-w-[12rem]"
      />

      <label className="sr-only" htmlFor="admin-employee">
        Employee
      </label>
      <select id="admin-employee" name="employee" defaultValue={employee} className="tl-input h-11 min-w-0 w-full px-3 text-sm sm:h-10 sm:w-auto">
        <option value="">All employees</option>
        {employees.map((member) => (
          <option key={member.id} value={member.id}>
            {member.displayName}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="admin-status">
        Status
      </label>
      <select id="admin-status" name="status" defaultValue={status} className="tl-input h-11 min-w-0 w-full px-3 text-sm sm:h-10 sm:w-auto">
        <option value="">All statuses</option>
        {SHEET_STATUSES.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="admin-range">
        Period
      </label>
      <select
        id="admin-range"
        name="range"
        defaultValue={range}
        className="tl-input h-11 min-w-0 w-full px-3 text-sm sm:h-10 sm:w-auto"
        onChange={(event) => {
          const next = event.target.value;
          commit(
            { range: next === "month" ? "" : next },
            next === "custom" ? [] : next === "week" ? ["from", "to"] : ["from", "to", "week"],
          );
        }}
      >
        <option value="month">Month</option>
        <option value="custom">Date range</option>
        <option value="week">Week</option>
        <option value="all">All time</option>
      </select>

      {range === "week" ? (
        <input type="week" name="week" defaultValue={week} className="tl-input h-11 min-w-0 w-full px-3 text-sm sm:h-10 sm:w-auto" />
      ) : null}
      {range === "custom" ? (
        <>
          <input type="date" name="from" defaultValue={from} className="tl-input h-11 min-w-0 w-full px-3 text-sm sm:h-10 sm:w-auto" aria-label="From date" />
          <input type="date" name="to" defaultValue={to} className="tl-input h-11 min-w-0 w-full px-3 text-sm sm:h-10 sm:w-auto" aria-label="To date" />
        </>
      ) : null}
      {range === "month" || range === "" ? (
        <input type="month" name="month" defaultValue={month} className="tl-input h-11 min-w-0 w-full px-3 text-sm sm:h-10 sm:w-auto" aria-label="Month" />
      ) : null}

      <button type="submit" className="tl-btn-ink h-11 px-4 text-sm sm:h-10">
        Apply
      </button>
      <button
        type="button"
        className="tl-btn-ghost h-11 px-3 text-sm sm:h-10"
        onClick={() => router.push(pathname)}
      >
        Reset
      </button>
    </form>
  );
}
