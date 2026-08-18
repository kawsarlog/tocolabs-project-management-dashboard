import Link from "next/link";
import { notFound } from "next/navigation";
import MetricCard from "@/components/ledger/MetricCard";
import { getBusinessDashboardStats, getBusinessTeamSummary } from "@/lib/ledger";
import { prisma } from "@/lib/prisma";

export default async function PlatformWorkspacePage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, slug: true },
  });

  if (!business) notFound();

  const stats = await getBusinessDashboardStats(business.id);
  const team = await getBusinessTeamSummary(business.id);

  return (
    <div className="space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              href="/platform/dashboard"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Back to workspaces
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
              {business.name}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Superadmin view of the selected workspace. Open employee sheets from
              here or jump into the main admin dashboard for this business.
            </p>
          </div>
          <Link
            href="/admin/dashboard"
            className="tl-btn-primary px-4 py-2.5 text-sm"
          >
            Open admin cockpit
          </Link>
        </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Employees" value={String(stats.totalEmployees)} />
        <MetricCard label="Rows" value={String(stats.totalOrders)} />
        <MetricCard label="Revenue" value={`$${stats.totalRevenueUsd.toFixed(2)}`} />
        <MetricCard label="Pending" value={String(stats.pendingItems)} />
      </div>

      <div className="tl-card overflow-hidden">
        <div className="tl-table-scroll">
        <table className="min-w-full text-sm">
          <thead className="bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Rows</th>
              <th className="px-4 py-3 font-medium">Revenue</th>
              <th className="px-4 py-3 font-medium">Pending</th>
            </tr>
          </thead>
          <tbody>
            {team.map((member) => (
              <tr
                key={member.id}
                className="border-t border-border"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/team/${member.id}`}
                    className="font-medium text-foreground transition hover:text-primary"
                  >
                    {member.displayName}
                  </Link>
                  <div className="text-xs text-muted-foreground">@{member.username}</div>
                </td>
                <td className="px-4 py-3">{member.metrics.orders}</td>
                <td className="px-4 py-3">${member.metrics.revenueUsd.toFixed(2)}</td>
                <td className="px-4 py-3">{member.metrics.pending}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
