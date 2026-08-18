import { notFound } from "next/navigation";
import MetricCard, { OrdersIcon, PendingIcon, RevenueIcon } from "@/components/ledger/MetricCard";
import LedgerSheet from "@/components/sheet/LedgerSheet";
import SheetPagination from "@/components/sheet/SheetPagination";
import SheetToolbar from "@/components/sheet/SheetToolbar";
import { getSessionUser } from "@/lib/auth/session";
import { getEmployeeDashboard, getTeamEmployee } from "@/lib/ledger";
import { formatUsdPrecise } from "@/lib/money";
import { parseSheetQuery, sheetHref } from "@/lib/sheet";

export default async function AdminEmployeeSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSessionUser();
  if (!session) return null;

  const { employeeId } = await params;
  const employee = await getTeamEmployee(session.businessId ?? "", employeeId, {
    platform: session.role === "PLATFORM_ADMIN",
  });

  if (!employee?.businessId) notFound();

  const query = parseSheetQuery((await searchParams) ?? {});
  const sheet = await getEmployeeDashboard(employee.businessId, employee.id, {
    range: query.period.range === "week" ? "month" : query.period.range,
    month: query.period.month,
    week: query.period.week,
    status: query.status || undefined,
    q: query.q || undefined,
    page: query.page,
    pageSize: query.pageSize,
  });

  const displayName = employee.employeeProfile?.displayName || employee.username;
  const hrefForPage = (page: number) =>
    sheetHref(`/admin/team/${employee.id}`, {
      q: query.q,
      status: query.status,
      range: query.period.range === "all" ? "all" : undefined,
      month: query.period.month,
      pageSize: query.pageSize,
      page,
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{displayName}</h1>
          <p className="text-sm text-muted-foreground">
            @{employee.username} · {employee.employeeProfile?.designation ?? "Team Member"} ·{" "}
            {employee.employeeProfile?.department ?? "Operations"}
          </p>
        </div>
        <a href="/admin/team" className="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground hover:text-foreground">
          Back to team
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Orders" value={String(sheet.totals.orders)} hint={query.period.label} icon={<OrdersIcon />} tone="ink" />
        <MetricCard
          label="Revenue excluding Complete"
          value={formatUsdPrecise(sheet.totals.revenueExcludingComplete)}
          hint="Open work"
          icon={<RevenueIcon />}
          tone="warning"
        />
        <MetricCard
          label="Revenue including Complete"
          value={formatUsdPrecise(sheet.totals.revenueIncludingComplete)}
          hint="All booked"
          icon={<RevenueIcon />}
          tone="teal"
        />
        <MetricCard
          label="Pending"
          value={String(sheet.totals.pending)}
          hint={`${sheet.totals.complete} complete`}
          icon={<PendingIcon />}
          tone="info"
        />
      </div>

      <section className="tl-card overflow-hidden">
        <SheetToolbar defaultMonth={query.period.month} />
        <LedgerSheet
          allowComments
          groups={sheet.groups.map((group) => ({
            workDayId: group.workDayId,
            date: group.date.toISOString(),
            shiftLabel: group.shiftLabel,
            comments: group.comments.map((comment) => ({
              id: comment.id,
              body: comment.body,
              createdAt: comment.createdAt.toISOString(),
              adminUser: comment.adminUser,
            })),
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
          emptyLabel={`No rows for ${query.period.label}.`}
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
