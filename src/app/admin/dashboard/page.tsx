import Link from "next/link";
import HorizontalBars, { AreaChart, DonutChart } from "@/components/charts/DashboardCharts";
import DashboardFilters from "@/components/filters/DashboardFilters";
import MetricCard, {
  DeliveredIcon,
  OrdersIcon,
  PendingIcon,
  PeopleIcon,
  RevenueIcon,
} from "@/components/ledger/MetricCard";
import StatusBadge from "@/components/ledger/StatusBadge";
import { getSessionUser } from "@/lib/auth/session";
import { emptyBusinessDashboard, getBusinessDashboard } from "@/lib/ledger";
import { formatUsd, formatUsdPrecise } from "@/lib/money";
import { compactDate, parseSheetQuery } from "@/lib/sheet";

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSessionUser();
  if (!session?.businessId) return null;

  const query = parseSheetQuery((await searchParams) ?? {});
  let dashboard;
  try {
    dashboard = await getBusinessDashboard(session.businessId, {
      range: query.period.range,
      month: query.period.month,
      week: query.period.week,
      from: query.period.from,
      to: query.period.to,
      status: query.status || undefined,
      q: query.q || undefined,
      employeeUserId: query.employeeId || undefined,
    });
  } catch (error) {
    console.error("[admin/dashboard] ledger read failed:", error);
    dashboard = emptyBusinessDashboard(session.businessId, {
      range: query.period.range,
      month: query.period.month,
      week: query.period.week,
      from: query.period.from,
      to: query.period.to,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Operations</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {dashboard.brand.name} · {query.period.label}. Filter by month, date range, person, or
            status — then read the two revenue totals honestly.
          </p>
        </div>
        <Link href="/admin/settings" className="text-sm font-medium text-secondary hover:text-primary">
          Workspace settings
        </Link>
      </div>

      <DashboardFilters
        employees={dashboard.team.map((member) => ({ id: member.id, displayName: member.displayName }))}
        defaultMonth={query.period.month}
        defaultWeek={query.period.week}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard
          label="Team"
          value={String(dashboard.teamSize)}
          hint="Active people"
          icon={<PeopleIcon />}
          tone="ink"
        />
        <MetricCard
          label="Orders"
          value={String(dashboard.totals.orders)}
          hint={query.period.label}
          trend={dashboard.previousChange.orders}
          icon={<OrdersIcon />}
          tone="info"
        />
        <MetricCard
          label="Revenue excluding Complete"
          value={formatUsd(dashboard.totals.revenueExcludingComplete)}
          hint="Open / incomplete work"
          trend={dashboard.previousChange.revenueExcludingComplete}
          icon={<RevenueIcon />}
          tone="warning"
        />
        <MetricCard
          label="Revenue including Complete"
          value={formatUsd(dashboard.totals.revenueIncludingComplete)}
          hint="All booked order value"
          trend={dashboard.previousChange.revenueIncludingComplete}
          icon={<RevenueIcon />}
          tone="teal"
        />
        <MetricCard
          label="Pending"
          value={String(dashboard.totals.pending)}
          hint="Needs attention"
          trend={dashboard.previousChange.pending}
          icon={<PendingIcon />}
          tone="warning"
        />
        <MetricCard
          label="Delivered"
          value={String(dashboard.totals.delivered)}
          hint={`${dashboard.totals.complete} complete`}
          trend={dashboard.previousChange.delivered}
          icon={<DeliveredIcon />}
          tone="success"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="tl-card min-w-0 p-4 sm:p-5">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-foreground">Revenue trend</h2>
            <p className="text-sm text-muted-foreground">Including Complete · {query.period.label}</p>
          </div>
          <AreaChart
            items={dashboard.charts.daily}
            emptyLabel="No order values in this filter. Broaden the date range or pick another person."
          />
        </section>
        <section className="tl-card min-w-0 p-4 sm:p-5">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-foreground">Status mix</h2>
            <p className="text-sm text-muted-foreground">Where work is sitting</p>
          </div>
          <DonutChart
            items={dashboard.charts.statuses}
            emptyLabel="No statuses yet. Rows appear here as the team logs work."
          />
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="tl-card min-w-0 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Revenue by person</h2>
              <p className="text-sm text-muted-foreground">Including Complete, ranked</p>
            </div>
            <Link href="/admin/team" className="text-sm font-medium text-secondary hover:text-primary">
              Manage team
            </Link>
          </div>
          <HorizontalBars
            items={dashboard.charts.employees.map((member) => ({
              id: member.id,
              label: member.displayName,
              value: member.revenue,
              hint: `${member.rows} rows`,
            }))}
            emptyLabel="No people have revenue in this range."
          />
        </section>

        <section className="tl-card overflow-hidden">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">Team breakdown</h2>
            <p className="text-sm text-muted-foreground">Open any sheet for the full ledger</p>
          </div>
          <div className="tl-table-scroll">
            <table className="min-w-full text-sm">
              <thead className="bg-muted text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Person</th>
                  <th className="px-3 py-2.5 font-medium">Rows</th>
                  <th className="px-3 py-2.5 font-medium">Excl. Complete</th>
                  <th className="px-3 py-2.5 font-medium">Incl. Complete</th>
                  <th className="px-5 py-2.5 font-medium">Pending</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.team.length ? (
                  dashboard.team.map((member) => (
                    <tr key={member.id} className="border-t border-border">
                      <td className="px-5 py-3">
                        <Link href={`/admin/team/${member.id}`} className="font-medium text-foreground hover:text-primary">
                          {member.displayName}
                        </Link>
                        <div className="text-xs text-muted-foreground">@{member.username}</div>
                      </td>
                      <td className="px-3 py-3 tabular-nums">{member.metrics.orders}</td>
                      <td className="px-3 py-3 tabular-nums">
                        {formatUsd(member.metrics.revenueExcludingComplete)}
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {formatUsd(member.metrics.revenueIncludingComplete)}
                      </td>
                      <td className="px-5 py-3 tabular-nums">{member.metrics.pending}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                      Add teammates from Team to start tracking.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="tl-card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Recent orders</h2>
          <p className="text-sm text-muted-foreground">Latest matching rows · USD</p>
        </div>
        <div className="tl-table-scroll">
          <table className="min-w-full text-sm">
            <thead className="bg-muted text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">Employee</th>
                <th className="px-3 py-2.5 font-medium">Order</th>
                <th className="px-3 py-2.5 font-medium">Client</th>
                <th className="px-3 py-2.5 font-medium">Value</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-5 py-2.5 font-medium">End date</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.recent.length ? (
                dashboard.recent.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-5 py-3 tabular-nums text-foreground">{compactDate(row.date)}</td>
                    <td className="px-3 py-3">
                      <Link href={`/admin/team/${row.employeeId}`} className="hover:text-primary">
                        {row.employeeName}
                      </Link>
                    </td>
                    <td className="px-3 py-3">{row.orderId || "—"}</td>
                    <td className="px-3 py-3">{row.client || "—"}</td>
                    <td className="px-3 py-3 tabular-nums">
                      {row.orderValueUsd != null ? formatUsdPrecise(row.orderValueUsd) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">
                      {row.endDate ? compactDate(row.endDate) : "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No orders match these filters. Try All time, or another employee.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
