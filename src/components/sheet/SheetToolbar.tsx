"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SHEET_STATUSES } from "@/lib/sheet";
import AddOrderDialog from "@/components/ledger/AddOrderDialog";

export default function SheetToolbar({
  defaultMonth,
  allowAdd = false,
}: {
  defaultMonth: string;
  allowAdd?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const range = searchParams.get("range") ?? "month";
  const month = searchParams.get("month") ?? defaultMonth;
  const pageSize = searchParams.get("pageSize") === "50" ? "50" : "20";

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
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="grid flex-1 grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
        <label className="sr-only" htmlFor="sheet-search">
          Search sheet
        </label>
        <input
          id="sheet-search"
          defaultValue={q}
          key={q}
          placeholder="Search client, order ID, notes"
          className="tl-input col-span-2 h-11 min-w-0 w-full px-3 text-sm sm:h-10 sm:max-w-sm"
          onKeyDown={(event) => {
            if (event.key === "Enter") commit({ q: event.currentTarget.value.trim() });
          }}
          onBlur={(event) => commit({ q: event.currentTarget.value.trim() })}
        />

        <label className="sr-only" htmlFor="sheet-status">
          Status
        </label>
        <select
          id="sheet-status"
          value={status}
          onChange={(event) => commit({ status: event.target.value })}
          className="tl-input h-11 min-w-0 w-full px-3 text-sm sm:h-10 sm:w-auto"
        >
          <option value="">All statuses</option>
          {SHEET_STATUSES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>

        <label className="sr-only" htmlFor="sheet-range">
          Time
        </label>
        <select
          id="sheet-range"
          value={range === "all" ? "all" : "month"}
          onChange={(event) => commit({ range: event.target.value === "month" ? "" : event.target.value })}
          className="tl-input h-11 min-w-0 w-full px-3 text-sm sm:h-10 sm:w-auto"
        >
          <option value="month">Month</option>
          <option value="all">All time</option>
        </select>

        {range !== "all" ? (
          <input
            type="month"
            value={month}
            onChange={(event) => commit({ range: "", month: event.target.value })}
            className="tl-input col-span-2 h-11 min-w-0 w-full px-3 text-sm sm:col-span-1 sm:h-10 sm:w-auto"
            aria-label="Month"
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="sheet-pagesize">
          Rows
        </label>
        <select
          id="sheet-pagesize"
          value={pageSize}
          onChange={(event) => commit({ pageSize: event.target.value })}
          className="tl-input h-11 min-w-0 px-3 text-sm sm:h-10"
        >
          <option value="20">20</option>
          <option value="50">50</option>
        </select>
        {allowAdd ? <AddOrderDialog /> : null}
      </div>
    </div>
  );
}
