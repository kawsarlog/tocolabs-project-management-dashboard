import PeriodFilter from "@/components/admin/PeriodFilter";
import TeamManager from "@/components/admin/TeamManager";
import MetricCard, { PeopleIcon, RevenueIcon } from "@/components/ledger/MetricCard";
import { getSessionUser } from "@/lib/auth/session";
import { getBusinessTeamSummary } from "@/lib/ledger";
import { formatUsd } from "@/lib/money";
import { parseSheetQuery } from "@/lib/sheet";

export default async function AdminTeamPage({
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
  const active = team.filter((member) => member.status === "ACTIVE");
  const top = [...active].sort((a, b) => b.metrics.revenueUsd - a.metrics.revenueUsd)[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">People and access</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Create employees with a unique username and password, reset credentials, and remove
            accounts. Work logs cascade with the user.
          </p>
        </div>
        <PeriodFilter defaultMonth={query.period.month} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Team members"
          value={String(team.length)}
          hint={`${active.length} active`}
          icon={<PeopleIcon />}
          tone="ink"
        />
        <MetricCard label="Period" value={query.period.label} hint="Applies to the totals below" icon={<RevenueIcon />} tone="info" />
        <MetricCard
          label="Top performer"
          value={top?.displayName ?? "—"}
          hint={top ? formatUsd(top.metrics.revenueUsd) : "By booked revenue"}
          icon={<RevenueIcon />}
          tone="teal"
        />
      </div>

      <TeamManager
        members={team.map((member) => ({
          id: member.id,
          username: member.username,
          displayName: member.displayName,
          status: member.status,
          employeeProfile: member.employeeProfile,
          metrics: {
            orders: member.metrics.orders,
            revenueUsd: member.metrics.revenueUsd,
            pending: member.metrics.pending,
            latestDate: member.metrics.latestDate?.toISOString() ?? null,
          },
        }))}
      />
    </div>
  );
}
