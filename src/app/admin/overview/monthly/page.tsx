import PeriodFilter from "@/components/admin/PeriodFilter";
import { getSessionUser } from "@/lib/auth/session";
import { getBusinessTeamSummary } from "@/lib/ledger";
import { formatUsdPrecise } from "@/lib/money";
import { parseSheetQuery } from "@/lib/sheet";

export default async function AdminMonthlyOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getSessionUser();
  if (!session?.businessId) return null;

  const query = parseSheetQuery((await searchParams) ?? {});
  const team = await getBusinessTeamSummary(session.businessId, {
    range: query.period.range,
    month: query.period.month,
    week: query.period.week,
    from: query.period.from,
    to: query.period.to,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Totals for {query.period.label}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Both revenue columns are USD. Excluding Complete is open work; including Complete is all booked value.
          </p>
        </div>
        <PeriodFilter defaultMonth={query.period.month} />
      </div>

      <div className="tl-card overflow-hidden">
        <div className="tl-table-scroll">
        <table className="min-w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Rows</th>
              <th className="px-4 py-3 font-medium">Excl. Complete</th>
              <th className="px-4 py-3 font-medium">Incl. Complete</th>
              <th className="px-4 py-3 font-medium">Pending</th>
            </tr>
          </thead>
          <tbody>
            {team.map((member) => (
              <tr key={member.id} className="border-t border-border">
                <td className="px-4 py-3">
                  <a href={`/admin/team/${member.id}`} className="font-medium text-foreground hover:text-primary">
                    {member.displayName}
                  </a>
                  <div className="text-xs text-muted-foreground">@{member.username}</div>
                </td>
                <td className="px-4 py-3 tabular-nums text-foreground">{member.metrics.orders}</td>
                <td className="px-4 py-3 tabular-nums text-foreground">
                  {formatUsdPrecise(member.metrics.revenueExcludingComplete)}
                </td>
                <td className="px-4 py-3 tabular-nums text-foreground">
                  {formatUsdPrecise(member.metrics.revenueIncludingComplete)}
                </td>
                <td className="px-4 py-3 tabular-nums text-foreground">{member.metrics.pending}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
