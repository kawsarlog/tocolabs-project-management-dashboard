import { prisma } from "@/lib/prisma";
import { changePct, summarizeEntries, type RevenueTotals } from "@/lib/metrics";
import { isoDay, previousResolved, resolvePeriod, type PeriodInput } from "@/lib/period";
import { useSupabaseLedger } from "@/lib/supabase/ledger-mode";
import {
  countRemoteActiveEmployees,
  loadRemoteEntries,
  loadRemoteTeamEmployee,
  loadRemoteTeamMembers,
  loadRemoteWorkspaceById,
} from "@/lib/supabase/work-store";
import { fetchRemoteWorkspace } from "@/lib/workspace-sync";

export type SheetFilters = PeriodInput & {
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
  employeeUserId?: string;
};

export type WorkspaceBrand = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  tagline: string | null;
};

export async function getWorkspaceBrand(
  businessId: string,
  supabaseUserId?: string | null,
): Promise<WorkspaceBrand> {
  const fallback: WorkspaceBrand = {
    id: businessId,
    name: "Workspace",
    slug: "workspace",
    logoUrl: null,
    tagline: null,
  };

  if (useSupabaseLedger()) {
    try {
      const byId = await loadRemoteWorkspaceById(businessId);
      if (byId) return byId;
    } catch (error) {
      console.error("[brand] supabase workspace-by-id read failed:", error);
    }
  }

  let remoteUserId = supabaseUserId ?? null;
  if (!remoteUserId) {
    try {
      const linked = await prisma.user.findFirst({
        where: { businessId, supabaseUserId: { not: null } },
        select: { supabaseUserId: true },
      });
      remoteUserId = linked?.supabaseUserId ?? null;
    } catch {
      remoteUserId = null;
    }
  }

  if (remoteUserId) {
    try {
      const remote = await fetchRemoteWorkspace(remoteUserId);
      if (remote) return remote;
    } catch (error) {
      console.error("[brand] supabase workspace read failed:", error);
    }
  }

  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, slug: true, logoUrl: true, tagline: true },
    });
    return business ?? fallback;
  } catch {
    // Client/DB may lag schema after brand fields are added; still render the sheet.
    try {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true, name: true, slug: true },
      });
      if (!business) return fallback;
      return { ...business, logoUrl: null, tagline: null };
    } catch {
      return fallback;
    }
  }
}

export async function getTeamEmployee(
  businessId: string,
  employeeId: string,
  options?: { platform?: boolean },
) {
  if (useSupabaseLedger()) {
    return loadRemoteTeamEmployee(businessId, employeeId, options);
  }

  return prisma.user.findFirst({
    where: options?.platform
      ? { id: employeeId, role: "EMPLOYEE" }
      : { id: employeeId, businessId, role: "EMPLOYEE" },
    select: {
      id: true,
      username: true,
      businessId: true,
      employeeProfile: {
        select: {
          displayName: true,
          department: true,
          designation: true,
        },
      },
    },
  });
}

export async function getEmployeeLedger(employeeUserId: string, period?: PeriodInput) {
  const where = buildWorkDayWhere({ employeeUserId, period });

  return prisma.workDay.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      entries: {
        orderBy: { rowOrder: "asc" },
      },
      comments: {
        orderBy: { createdAt: "desc" },
        include: {
          adminUser: {
            select: { id: true, username: true },
          },
        },
      },
    },
  });
}

type SheetRow = {
  id: string;
  workDayId: string;
  rowOrder: number;
  orderId: string | null;
  client: string | null;
  orderValueUsd: number | null;
  newClients: number | null;
  status: string | null;
  notes: string | null;
  extra: string | null;
  endDate: Date | null;
  workDay: {
    date: Date;
    shiftLabel: string | null;
    comments: Array<{
      id: string;
      body: string;
      createdAt: Date;
      adminUser: { username: string };
    }>;
  };
};

function assembleSheet(rows: SheetRow[], statsRows: SheetRow[], page: number, pageSize: number) {
  const grouped = new Map<
    string,
    {
      workDayId: string;
      date: Date;
      shiftLabel: string | null;
      comments: SheetRow["workDay"]["comments"];
      entries: SheetRow[];
    }
  >();

  for (const row of rows) {
    const key = row.workDayId;
    if (!grouped.has(key)) {
      grouped.set(key, {
        workDayId: row.workDayId,
        date: row.workDay.date,
        shiftLabel: row.workDay.shiftLabel,
        comments: row.workDay.comments.map((comment) => ({
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt,
          adminUser: { username: comment.adminUser.username },
        })),
        entries: [],
      });
    }
    grouped.get(key)!.entries.push(row);
  }

  const totals = summarizeEntries(statsRows);
  return {
    page,
    pageSize,
    totalCount: statsRows.length,
    totalPages: Math.max(Math.ceil(statsRows.length / pageSize), 1),
    totals: {
      ...totals,
      revenueUsd: totals.revenueIncludingComplete,
    },
    groups: [...grouped.values()],
  };
}

export async function getEmployeeSheetRows(
  businessId: string,
  employeeUserId: string,
  filters: SheetFilters = {},
) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = filters.pageSize === 50 ? 50 : 20;

  if (useSupabaseLedger()) {
    const all = await loadRemoteEntries({ businessId, employeeUserId, filters });
    const paged = all.slice((page - 1) * pageSize, page * pageSize);
    return assembleSheet(paged, all, page, pageSize);
  }

  const where = buildEntryWhere({ businessId, employeeUserId, filters });
  const [totalCount, rows, statsRows] = await Promise.all([
    prisma.workEntry.count({ where }),
    prisma.workEntry.findMany({
      where,
      include: {
        workDay: {
          include: {
            comments: {
              orderBy: { createdAt: "desc" },
              include: {
                adminUser: {
                  select: { username: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ workDay: { date: "desc" } }, { rowOrder: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.workEntry.findMany({
      where,
      select: { orderValueUsd: true, status: true, newClients: true },
    }),
  ]);

  const sheet = assembleSheet(rows as SheetRow[], rows as SheetRow[], page, pageSize);
  const totals = summarizeEntries(statsRows);
  return {
    ...sheet,
    totalCount,
    totalPages: Math.max(Math.ceil(totalCount / pageSize), 1),
    totals: {
      ...totals,
      revenueUsd: totals.revenueIncludingComplete,
    },
  };
}

export async function getEmployeeDashboard(
  businessId: string,
  employeeUserId: string,
  filters: SheetFilters = {},
) {
  const sheet = await getEmployeeSheetRows(businessId, employeeUserId, filters);

  const chartRows = useSupabaseLedger()
    ? await loadRemoteEntries({ businessId, employeeUserId, filters })
    : await prisma.workEntry.findMany({
        where: buildEntryWhere({ businessId, employeeUserId, filters }),
        select: {
          orderValueUsd: true,
          status: true,
          workDay: { select: { date: true } },
        },
      });

  const dailyMap = new Map<string, { date: string; revenue: number; rows: number }>();
  const statusMap = new Map<string, number>();
  for (const entry of chartRows) {
    const dateKey = entry.workDay.date.toISOString().slice(0, 10);
    if (!dailyMap.has(dateKey)) dailyMap.set(dateKey, { date: dateKey, revenue: 0, rows: 0 });
    const bucket = dailyMap.get(dateKey)!;
    bucket.rows += 1;
    bucket.revenue += entry.orderValueUsd ?? 0;
    const status = (entry.status ?? "Unspecified").trim() || "Unspecified";
    statusMap.set(status, (statusMap.get(status) ?? 0) + 1);
  }

  return {
    ...sheet,
    charts: {
      daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      statuses: [...statusMap.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
    },
  };
}

export async function getBusinessTeamSummary(businessId: string, filters: SheetFilters = {}) {
  const employees = useSupabaseLedger()
    ? await loadRemoteTeamMembers(businessId)
    : await prisma.user.findMany({
        where: { businessId, role: "EMPLOYEE" },
        select: {
          id: true,
          username: true,
          status: true,
          createdAt: true,
          employeeProfile: {
            select: { displayName: true, department: true, designation: true },
          },
        },
        orderBy: { username: "asc" },
      });

  const entries = useSupabaseLedger()
    ? await loadRemoteEntries({
        businessId,
        filters: { ...filters, employeeUserId: undefined },
      })
    : await prisma.workEntry.findMany({
        where: buildBusinessEntryWhere(businessId, {
          ...filters,
          employeeUserId: undefined,
        }),
        select: {
          employeeUserId: true,
          orderValueUsd: true,
          status: true,
          newClients: true,
          workDay: { select: { date: true } },
        },
      });

  const summaryByEmployee = new Map<
    string,
    RevenueTotals & { latestDate: Date | null }
  >();

  for (const employee of employees) {
    summaryByEmployee.set(employee.id, { ...summarizeEntries([]), latestDate: null });
  }

  const grouped = new Map<string, typeof entries>();
  for (const entry of entries) {
    if (!grouped.has(entry.employeeUserId)) grouped.set(entry.employeeUserId, []);
    grouped.get(entry.employeeUserId)!.push(entry);
  }

  for (const [employeeId, list] of grouped) {
    const totals = summarizeEntries(list);
    let latestDate: Date | null = null;
    for (const entry of list) {
      if (!latestDate || entry.workDay.date > latestDate) latestDate = entry.workDay.date;
    }
    summaryByEmployee.set(employeeId, { ...totals, latestDate });
  }

  return employees.map((employee) => {
    const metrics = summaryByEmployee.get(employee.id)!;
    return {
      ...employee,
      displayName: employee.employeeProfile?.displayName || employee.username,
      metrics: {
        ...metrics,
        orders: metrics.orders,
        revenueUsd: metrics.revenueIncludingComplete,
        pending: metrics.pending,
      },
    };
  });
}

export async function getBusinessDashboardStats(businessId: string, period?: PeriodInput) {
  const dashboard = await getBusinessDashboard(businessId, period ?? {});
  return {
    totalEmployees: dashboard.teamSize,
    totalOrders: dashboard.totals.orders,
    totalRevenueUsd: dashboard.totals.revenueIncludingComplete,
    pendingItems: dashboard.totals.pending,
    topPerformers: dashboard.team
      .filter((member) => member.status === "ACTIVE")
      .slice()
      .sort((a, b) => b.metrics.revenueUsd - a.metrics.revenueUsd)
      .slice(0, 5),
    team: dashboard.team,
  };
}

export async function getBusinessCharts(businessId: string, period?: PeriodInput) {
  const dashboard = await getBusinessDashboard(businessId, period ?? {});
  return {
    period: dashboard.period,
    daily: dashboard.charts.daily,
    employees: dashboard.charts.employees,
    statuses: dashboard.charts.statuses,
  };
}

export async function getBusinessDashboard(businessId: string, filters: SheetFilters = {}) {
  const period = resolvePeriod(filters);
  const [team, brand, activeCount] = await Promise.all([
    getBusinessTeamSummary(businessId, filters),
    getWorkspaceBrand(businessId),
    useSupabaseLedger()
      ? countRemoteActiveEmployees(businessId)
      : prisma.user.count({ where: { businessId, role: "EMPLOYEE", status: "ACTIVE" } }),
  ]);

  const entries = useSupabaseLedger()
    ? await loadRemoteEntries({ businessId, filters })
    : await prisma.workEntry.findMany({
        where: buildBusinessEntryWhere(businessId, filters),
        include: {
          workDay: { select: { date: true, shiftLabel: true } },
          employeeUser: {
            select: {
              id: true,
              username: true,
              employeeProfile: { select: { displayName: true } },
            },
          },
        },
        orderBy: [{ workDay: { date: "desc" } }, { rowOrder: "asc" }],
      });

  const totals = summarizeEntries(entries);
  let previous: RevenueTotals | null = null;
  let previousChange: Record<string, number | null> = {};

  if (period.range !== "all") {
    const prev = previousResolved(period);
    const previousEntries = useSupabaseLedger()
      ? await loadRemoteEntries({
          businessId,
          filters: {
            ...filters,
            range: "custom",
            from: isoDay(prev.gte),
            to: isoDay(new Date(prev.lt.getTime() - 1)),
          },
        })
      : await prisma.workEntry.findMany({
          where: buildBusinessEntryWhere(businessId, {
            ...filters,
            range: "custom",
            from: isoDay(prev.gte),
            to: isoDay(new Date(prev.lt.getTime() - 1)),
          }),
          select: { orderValueUsd: true, status: true, newClients: true },
        });
    previous = summarizeEntries(previousEntries);
    previousChange = {
      orders: changePct(totals.orders, previous.orders),
      revenueExcludingComplete: changePct(
        totals.revenueExcludingComplete,
        previous.revenueExcludingComplete,
      ),
      revenueIncludingComplete: changePct(
        totals.revenueIncludingComplete,
        previous.revenueIncludingComplete,
      ),
      pending: changePct(totals.pending, previous.pending),
      delivered: changePct(totals.delivered, previous.delivered),
    };
  }

  const dailyMap = new Map<string, { date: string; revenue: number; rows: number }>();
  const statusMap = new Map<string, number>();
  const spanDays = Math.max((period.lt.getTime() - period.gte.getTime()) / 86400000, 1);
  const bucketByMonth = spanDays > 62;

  for (const entry of entries) {
    const iso = entry.workDay.date.toISOString().slice(0, 10);
    const dateKey = bucketByMonth ? iso.slice(0, 7) : iso;
    if (!dailyMap.has(dateKey)) dailyMap.set(dateKey, { date: dateKey, revenue: 0, rows: 0 });
    const bucket = dailyMap.get(dateKey)!;
    bucket.rows += 1;
    bucket.revenue += entry.orderValueUsd ?? 0;
    const status = (entry.status ?? "Unspecified").trim() || "Unspecified";
    statusMap.set(status, (statusMap.get(status) ?? 0) + 1);
  }

  const recent = entries.slice(0, 12).map((entry) => ({
    id: entry.id,
    date: entry.workDay.date.toISOString(),
    shiftLabel: entry.workDay.shiftLabel,
    orderId: entry.orderId,
    client: entry.client,
    orderValueUsd: entry.orderValueUsd,
    status: entry.status,
    endDate: entry.endDate?.toISOString() ?? null,
    employeeId: entry.employeeUser.id,
    employeeName: entry.employeeUser.employeeProfile?.displayName || entry.employeeUser.username,
  }));

  const visibleTeam = filters.employeeUserId
    ? team.filter((member) => member.id === filters.employeeUserId)
    : team;

  return {
    brand,
    period,
    teamSize: activeCount,
    totals,
    previousChange,
    team: visibleTeam,
    recent,
    charts: {
      daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
      statuses: [...statusMap.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count),
      employees: visibleTeam
        .filter((member) => member.status === "ACTIVE")
        .map((member) => ({
          id: member.id,
          username: member.username,
          displayName: member.displayName,
          revenue: member.metrics.revenueIncludingComplete,
          revenueExcludingComplete: member.metrics.revenueExcludingComplete,
          rows: member.metrics.orders,
          pending: member.metrics.pending,
        }))
        .sort((a, b) => b.revenue - a.revenue),
    },
  };
}

export async function getPlatformWorkspaceList() {
  const businesses = await prisma.business.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      users: {
        where: { role: "BUSINESS_ADMIN", status: "ACTIVE" },
        select: { id: true, username: true },
      },
    },
  });

  const items = [];
  for (const business of businesses) {
    const stats = await getBusinessDashboardStats(business.id);
    items.push({
      id: business.id,
      name: business.name,
      slug: business.slug,
      admins: business.users,
      stats,
    });
  }

  return items;
}

function buildBusinessEntryWhere(businessId: string, filters: SheetFilters) {
  const resolved = resolvePeriod(filters);
  const where: {
    businessId: string;
    employeeUserId?: string;
    status?: string;
    OR?: Array<{
      client?: { contains: string };
      orderId?: { contains: string };
      notes?: { contains: string };
      extra?: { contains: string };
    }>;
    workDay?: { date: { gte: Date; lt: Date } };
  } = { businessId };

  where.workDay = { date: { gte: resolved.gte, lt: resolved.lt } };

  if (filters.employeeUserId) where.employeeUserId = filters.employeeUserId;
  if (filters.status) where.status = filters.status;
  if (filters.q?.trim()) {
    const query = filters.q.trim();
    where.OR = [
      { client: { contains: query } },
      { orderId: { contains: query } },
      { notes: { contains: query } },
      { extra: { contains: query } },
    ];
  }

  return where;
}

function buildWorkDayWhere({
  employeeUserId,
  period,
}: {
  employeeUserId: string;
  period?: PeriodInput;
}) {
  const where: {
    employeeUserId: string;
    date?: { gte: Date; lt: Date };
  } = { employeeUserId };

  if (period) {
    const resolved = resolvePeriod(period);
    where.date = { gte: resolved.gte, lt: resolved.lt };
  }

  return where;
}

function buildEntryWhere({
  businessId,
  employeeUserId,
  filters,
}: {
  businessId: string;
  employeeUserId: string;
  filters: SheetFilters;
}) {
  return buildBusinessEntryWhere(businessId, { ...filters, employeeUserId });
}
