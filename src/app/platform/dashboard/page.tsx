import Link from "next/link";
import MetricCard from "@/components/ledger/MetricCard";
import { getPlatformWorkspaceList } from "@/lib/ledger";

export default async function PlatformDashboardPage() {
  const workspaces = await getPlatformWorkspaceList();
  const totalAdmins = workspaces.reduce((sum, workspace) => sum + workspace.admins.length, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-muted-foreground">
          Superadmin control layer
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Workspace management
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          See all business workspaces, review their team-level activity, and
          jump into a selected business for deeper observability.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Workspaces" value={String(workspaces.length)} />
        <MetricCard label="Business admins" value={String(totalAdmins)} />
        <MetricCard
          label="Total visible rows"
          value={String(workspaces.reduce((sum, item) => sum + item.stats.totalOrders, 0))}
        />
      </div>

      <div className="grid gap-4">
        {workspaces.map((workspace) => (
          <Link
            key={workspace.id}
            href={`/platform/workspaces/${workspace.id}`}
            className="tl-card p-5 transition hover:border-primary hover:bg-primary-soft/50"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground">
                  Workspace
                </div>
                <h2 className="mt-1 text-xl font-semibold text-foreground">
                  {workspace.name}
                </h2>
                <div className="mt-2 text-sm text-muted-foreground">
                  Admins:{" "}
                  {workspace.admins.length
                    ? workspace.admins.map((admin) => admin.username).join(", ")
                    : "No business admin yet"}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Employees
                  </div>
                  <div className="font-semibold text-foreground">
                    {workspace.stats.totalEmployees}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Rows
                  </div>
                  <div className="font-semibold text-foreground">
                    {workspace.stats.totalOrders}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Revenue
                  </div>
                  <div className="font-semibold text-foreground">
                    ${workspace.stats.totalRevenueUsd.toFixed(0)}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

