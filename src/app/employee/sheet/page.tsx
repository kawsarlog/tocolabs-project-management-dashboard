import { AreaChart, DonutChart } from "@/components/charts/DashboardCharts";
import AddOrderDialog from "@/components/ledger/AddOrderDialog";
import MetricCard, { OrdersIcon, PendingIcon, RevenueIcon } from "@/components/ledger/MetricCard";
import LedgerSheet from "@/components/sheet/LedgerSheet";
import SheetPagination from "@/components/sheet/SheetPagination";
import SheetToolbar from "@/components/sheet/SheetToolbar";
import WorkspaceMark from "@/components/brand/WorkspaceMark";
import { getSessionUser } from "@/lib/auth/session";
import { getEmployeeDashboard, getWorkspaceBrand } from "@/lib/ledger";
import { formatUsd, formatUsdPrecise } from "@/lib/money";
import { parseSheetQuery, sheetHref } from "@/lib/sheet";

export default async function EmployeeSheetPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSessionUser();
  if (!session?.businessId) return null;

  const query = parseSheetQuery((await searchParams) ?? {});
  const [brand, sheet] = await Promise.all([
    getWorkspaceBrand(session.businessId, session.supabaseUserId).catch((error) => {
      console.error("[employee/sheet] brand read failed:", error);
      return {
        id: session.businessId!,
        name: "Workspace",
        slug: "workspace",
        logoUrl: null as string | null,
        tagline: null as string | null,
      };
    }),
    getEmployeeDashboard(session.businessId, session.id, {
      range: query.period.range === "week" ? "month" : query.period.range,
      month: query.period.month,
      week: query.period.week,
      from: query.period.from,
      to: query.period.to,
      status: query.status || undefined,
      q: query.q || undefined,
      page: query.page,
      pageSize: query.pageSize,
    }).catch((error) => {
      console.error("[employee/sheet] ledger read failed:", error);
      return {
        page: query.page,
        pageSize: query.pageSize,
        totalCount: 0,
        totalPages: 1,
        totals: {
          orders: 0,
          revenueExcludingComplete: 0,
          revenueIncludingComplete: 0,
          pending: 0,
          delivered: 0,
          complete: 0,
          newClients: 0,
          revenueUsd: 0,
        },
        groups: [],
        charts: { daily: [], statuses: [] },
      };
    }),
  ]);

  const hrefForPage = (page: number) =>
    sheetHref("/employee/sheet", {
      q: query.q,
      status: query.status,
      range: query.period.range === "all" ? "all" : undefined,
      month: query.period.month,
      pageSize: query.pageSize,
      page,
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex min-w-0 items-center gap-2.5">
            <WorkspaceMark name={brand.name} logoUrl={brand.logoUrl} size="sm" />
            <p className="min-w-0 truncate text-sm font-medium text-muted-foreground">Working under {brand.name}</p>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {session.username}&apos;s work
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Your personal dashboard for {query.period.label}. Add orders with the form — you do not
            need to click a blank cell first.
          </p>
        </div>
        <AddOrderDialog />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Orders"
          value={String(sheet.totals.orders)}
          hint={query.period.label}
          icon={<OrdersIcon />}
          tone="ink"
        />
        <MetricCard
          label="Revenue excluding Complete"
          value={formatUsdPrecise(sheet.totals.revenueExcludingComplete)}
          hint="Incomplete / not-complete work"
          icon={<RevenueIcon />}
          tone="warning"
        />
        <MetricCard
          label="Revenue including Complete"
          value={formatUsdPrecise(sheet.totals.revenueIncludingComplete)}
          hint="All booked order value"
          icon={<RevenueIcon />}
          tone="teal"
        />
        <MetricCard
          label="Pending"
          value={String(sheet.totals.pending)}
          hint={`${sheet.totals.complete} complete · ${sheet.totals.delivered} delivered`}
          icon={<PendingIcon />}
          tone="info"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="tl-card min-w-0 p-4 sm:p-5">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-foreground">Your revenue</h2>
            <p className="text-sm text-muted-foreground">Including Complete · {query.period.label}</p>
          </div>
          <AreaChart
            items={sheet.charts.daily}
            emptyLabel="No orders in this month yet. Use Add order to log your first row."
          />
        </section>
        <section className="tl-card min-w-0 p-4 sm:p-5">
          <div className="mb-3">
            <h2 className="text-base font-semibold text-foreground">Status mix</h2>
            <p className="text-sm text-muted-foreground">Your current workload shape</p>
          </div>
          <DonutChart
            items={sheet.charts.statuses}
            emptyLabel="Statuses appear after you add orders."
          />
        </section>
      </div>

      <section className="tl-card overflow-hidden">
        <SheetToolbar defaultMonth={query.period.month} allowAdd />
        <LedgerSheet
          editable
          groups={sheet.groups.map((group) => ({
            workDayId: group.workDayId,
            date: group.date.toISOString(),
            shiftLabel: group.shiftLabel,
            entries: group.entries.map((entry) => ({
              id: entry.id,
              rowOrder: entry.rowOrder,
              orderId: entry.orderId,
              client: entry.client,
              orderValueUsd: entry.orderValueUsd,
              newClients: entry.newClients,
              status: entry.status,
              notes: entry.notes,
              extra: entry.extra,
              endDate: entry.endDate?.toISOString() ?? null,
            })),
          }))}
          emptyLabel={`No rows for ${query.period.label}. Use Add order — Date, Shift, Order ID, Client, Order Value ($), New Clients, Status, Notes, and optional End date.`}
        />
        <SheetPagination
          page={sheet.page}
          totalPages={sheet.totalPages}
          totalCount={sheet.totalCount}
          pageSize={sheet.pageSize}
          hrefForPage={hrefForPage}
        />
      </section>
    </div>
  );
}
