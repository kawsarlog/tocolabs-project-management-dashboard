import { createAdminClient } from "@/lib/supabase/admin";
import { isoDay, resolvePeriod, type PeriodInput } from "@/lib/period";

type AdminClient = ReturnType<typeof createAdminClient>;

type EntryFilters = PeriodInput & {
  status?: string;
  q?: string;
  employeeUserId?: string;
  page?: number;
  pageSize?: number;
};

export type RemoteTeamMember = {
  id: string;
  username: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  employeeProfile: {
    displayName: string | null;
    department: string | null;
    designation: string | null;
  } | null;
};

export type RemoteComment = {
  id: string;
  body: string;
  createdAt: Date;
  adminUser: { username: string };
};

export type RemoteLedgerEntry = {
  id: string;
  workDayId: string;
  employeeUserId: string;
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
    comments: RemoteComment[];
  };
  employeeUser: {
    id: string;
    username: string;
    employeeProfile: { displayName: string | null } | null;
  };
};

type DayRow = {
  id: string;
  work_date: string;
  shift_label: string | null;
  employee_user_id: string;
};

type EntryRow = {
  id: string;
  work_day_id: string;
  employee_user_id: string;
  row_order: number | null;
  order_id: string | null;
  client: string | null;
  order_value_usd: number | string | null;
  new_clients: number | null;
  status: string | null;
  notes: string | null;
  extra: string | null;
  end_date: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

function admin(): AdminClient {
  return createAdminClient();
}

function tryAdmin(): AdminClient | null {
  try {
    return admin();
  } catch (error) {
    logLedgerError("admin client", error);
    return null;
  }
}

function throwError(action: string, message: string): never {
  throw new Error(`[ledger] ${action}: ${message}`);
}

function logLedgerError(action: string, error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  console.error(`[ledger] ${action}:`, message);
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function utcDate(value: string | null | undefined): Date {
  const day = (value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return new Date("1970-01-01T00:00:00.000Z");
  }
  return new Date(`${day}T00:00:00.000Z`);
}

function firstEmbed<T>(value: unknown): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  if (typeof value === "object") return value as T;
  return null;
}

function matchesQuery(entry: EntryRow, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [entry.client, entry.order_id, entry.notes, entry.extra]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle));
}

async function inChunks<T>(
  ids: string[],
  load: (chunk: string[]) => Promise<T[]>,
): Promise<T[]> {
  if (ids.length === 0) return [];
  const size = 80;
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(...(await load(ids.slice(i, i + size))));
  }
  return out;
}

type EmployeeProfileFields = {
  displayName: string | null;
  department: string | null;
  designation: string | null;
};

async function loadEmployeeProfileMap(userIds: string[]) {
  const map = new Map<string, EmployeeProfileFields>();
  const ids = userIds.filter(isUuid);
  if (ids.length === 0) return map;

  const client = tryAdmin();
  if (!client) return map;

  try {
    const rows = await inChunks(ids, async (chunk) => {
      const { data, error } = await client
        .from("employee_profiles")
        .select("user_id, display_name, department, designation")
        .in("user_id", chunk);
      if (error) {
        logLedgerError("employee_profiles", error);
        return [];
      }
      return data ?? [];
    });

    for (const row of rows) {
      const id = row.user_id ? String(row.user_id) : "";
      if (!id) continue;
      map.set(id, {
        displayName: row.display_name ? String(row.display_name) : null,
        department: row.department ? String(row.department) : null,
        designation: row.designation ? String(row.designation) : null,
      });
    }
  } catch (error) {
    logLedgerError("employee_profiles", error);
  }

  return map;
}

function toTeamMember(
  row: {
    id?: unknown;
    username?: unknown;
    status?: unknown;
    created_at?: unknown;
    display_name?: unknown;
  },
  profile: EmployeeProfileFields | null,
): RemoteTeamMember {
  const displayName =
    profile?.displayName || (row.display_name ? String(row.display_name) : null);
  return {
    id: String(row.id ?? ""),
    username: String(row.username ?? ""),
    status: row.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    createdAt: row.created_at ? new Date(String(row.created_at)) : new Date(),
    employeeProfile:
      displayName || profile?.department || profile?.designation
        ? {
            displayName,
            department: profile?.department ?? null,
            designation: profile?.designation ?? null,
          }
        : null,
  };
}

export async function loadRemoteTeamMembers(businessId: string): Promise<RemoteTeamMember[]> {
  if (!isUuid(businessId)) {
    logLedgerError("team profiles", `skipped non-uuid business id`);
    return [];
  }

  const client = tryAdmin();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from("profiles")
      .select("id, username, status, created_at, display_name")
      .eq("business_id", businessId)
      .eq("role", "EMPLOYEE")
      .order("username", { ascending: true });

    if (error) {
      logLedgerError("team profiles", error);
      return [];
    }

    const rows = data ?? [];
    const profiles = await loadEmployeeProfileMap(rows.map((row) => String(row.id)));
    return rows.map((row) => toTeamMember(row, profiles.get(String(row.id)) ?? null));
  } catch (error) {
    logLedgerError("team profiles", error);
    return [];
  }
}

export async function countRemoteActiveEmployees(businessId: string) {
  if (!isUuid(businessId)) return 0;

  const client = tryAdmin();
  if (!client) return 0;

  try {
    const { count, error } = await client
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("role", "EMPLOYEE")
      .eq("status", "ACTIVE");
    if (error) {
      logLedgerError("active employee count", error);
      return 0;
    }
    return count ?? 0;
  } catch (error) {
    logLedgerError("active employee count", error);
    return 0;
  }
}

export async function loadRemoteTeamEmployee(
  businessId: string | null,
  employeeId: string,
  options?: { platform?: boolean },
) {
  if (!isUuid(employeeId) || (businessId && !isUuid(businessId))) return null;

  const client = tryAdmin();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from("profiles")
      .select("id, username, business_id, role, display_name")
      .eq("id", employeeId)
      .maybeSingle();
    if (error) {
      logLedgerError("employee lookup", error);
      return null;
    }
    if (!data || data.role !== "EMPLOYEE" || !data.business_id) return null;
    if (!options?.platform && String(data.business_id) !== businessId) return null;

    const profiles = await loadEmployeeProfileMap([String(data.id)]);
    const member = toTeamMember(data, profiles.get(String(data.id)) ?? null);
    return {
      id: member.id,
      username: member.username,
      businessId: String(data.business_id),
      employeeProfile: member.employeeProfile,
    };
  } catch (error) {
    logLedgerError("employee lookup", error);
    return null;
  }
}

export async function loadRemoteWorkspaceById(businessId: string) {
  if (!isUuid(businessId)) return null;

  const client = tryAdmin();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from("businesses")
      .select("id, name, slug, logo_url, tagline")
      .eq("id", businessId)
      .maybeSingle();
    if (error) {
      logLedgerError("workspace", error);
      return null;
    }
    if (!data) return null;
    return {
      id: String(data.id),
      name: String(data.name ?? "Workspace"),
      slug: String(data.slug ?? "workspace"),
      logoUrl: data.logo_url ? String(data.logo_url) : null,
      tagline: data.tagline ? String(data.tagline) : null,
    };
  } catch (error) {
    logLedgerError("workspace", error);
    return null;
  }
}

export async function loadRemoteEntries(options: {
  businessId: string;
  employeeUserId?: string;
  filters?: EntryFilters;
}): Promise<RemoteLedgerEntry[]> {
  if (!isUuid(options.businessId)) {
    logLedgerError("work_days", "skipped non-uuid business id");
    return [];
  }
  if (options.employeeUserId && !isUuid(options.employeeUserId)) {
    logLedgerError("work_days", "skipped non-uuid employee id");
    return [];
  }

  const client = tryAdmin();
  if (!client) return [];

  try {
    return await loadRemoteEntriesUnsafe(client, options);
  } catch (error) {
    logLedgerError("work_entries", error);
    return [];
  }
}

async function loadRemoteEntriesUnsafe(
  client: AdminClient,
  options: {
    businessId: string;
    employeeUserId?: string;
    filters?: EntryFilters;
  },
): Promise<RemoteLedgerEntry[]> {
  const filters = options.filters ?? {};
  const period = resolvePeriod(filters);
  const from = isoDay(period.gte);
  const to = isoDay(period.lt);

  let daysQuery = client
    .from("work_days")
    .select("id, work_date, shift_label, employee_user_id")
    .eq("business_id", options.businessId)
    .gte("work_date", from)
    .lt("work_date", to);

  if (options.employeeUserId) {
    daysQuery = daysQuery.eq("employee_user_id", options.employeeUserId);
  }

  const { data: dayData, error: dayError } = await daysQuery;
  if (dayError) {
    logLedgerError("work_days", dayError);
    return [];
  }
  const days = (dayData ?? []) as DayRow[];
  if (days.length === 0) return [];

  const dayMap = new Map(days.map((day) => [day.id, day]));
  const dayIds = days.map((day) => day.id);

  const entryRows = await inChunks(dayIds, async (chunk) => {
    let query = client
      .from("work_entries")
      .select(
        "id, work_day_id, employee_user_id, row_order, order_id, client, order_value_usd, new_clients, status, notes, extra, end_date",
      )
      .eq("business_id", options.businessId)
      .in("work_day_id", chunk);

    if (options.employeeUserId) {
      query = query.eq("employee_user_id", options.employeeUserId);
    }
    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    const { data, error } = await query;
    if (error) {
      logLedgerError("work_entries", error);
      return [];
    }
    return (data ?? []) as EntryRow[];
  });

  const q = filters.q?.trim() ?? "";
  const filtered = q ? entryRows.filter((entry) => matchesQuery(entry, q)) : entryRows;

  const comments = await inChunks(dayIds, async (chunk) => {
    const { data, error } = await client
      .from("admin_comments")
      .select("id, body, created_at, work_day_id, admin_user_id")
      .eq("business_id", options.businessId)
      .in("work_day_id", chunk)
      .order("created_at", { ascending: false });
    if (error) {
      logLedgerError("admin_comments", error);
      return [];
    }
    return data ?? [];
  });

  const adminIds = [...new Set(comments.map((comment) => String(comment.admin_user_id)))];
  const employeeIds = [
    ...new Set(filtered.map((entry) => String(entry.employee_user_id))),
  ];
  const profileIds = [...new Set([...adminIds, ...employeeIds])].filter(isUuid);

  const profiles = await inChunks(profileIds, async (chunk) => {
    const { data, error } = await client
      .from("profiles")
      .select("id, username, display_name")
      .in("id", chunk);
    if (error) {
      logLedgerError("profiles", error);
      return [];
    }
    return data ?? [];
  });
  const employeeProfiles = await loadEmployeeProfileMap(employeeIds);

  const usernameById = new Map<string, string>();
  const displayById = new Map<string, string | null>();
  for (const profile of profiles) {
    const id = String(profile.id);
    usernameById.set(id, String(profile.username ?? ""));
    const fromProfile = profile.display_name ? String(profile.display_name) : null;
    displayById.set(id, employeeProfiles.get(id)?.displayName || fromProfile);
  }

  const commentsByDay = new Map<string, RemoteComment[]>();
  for (const comment of comments) {
    const dayId = comment.work_day_id ? String(comment.work_day_id) : "";
    if (!dayId) continue;
    if (!commentsByDay.has(dayId)) commentsByDay.set(dayId, []);
    commentsByDay.get(dayId)!.push({
      id: String(comment.id),
      body: String(comment.body ?? ""),
      createdAt: comment.created_at ? new Date(String(comment.created_at)) : new Date(),
      adminUser: {
        username: usernameById.get(String(comment.admin_user_id)) || "admin",
      },
    });
  }

  const mapped: RemoteLedgerEntry[] = [];
  for (const entry of filtered) {
    const day = dayMap.get(entry.work_day_id);
    if (!day) continue;
    const employeeId = String(entry.employee_user_id);
    mapped.push({
      id: String(entry.id),
      workDayId: String(entry.work_day_id),
      employeeUserId: employeeId,
      rowOrder: Number(entry.row_order ?? 0),
      orderId: entry.order_id ? String(entry.order_id) : null,
      client: entry.client ? String(entry.client) : null,
      orderValueUsd: asNumber(entry.order_value_usd),
      newClients: asNumber(entry.new_clients),
      status: entry.status ? String(entry.status) : null,
      notes: entry.notes ? String(entry.notes) : null,
      extra: entry.extra ? String(entry.extra) : null,
      endDate: entry.end_date ? utcDate(String(entry.end_date)) : null,
      workDay: {
        date: utcDate(day.work_date),
        shiftLabel: day.shift_label ? String(day.shift_label) : null,
        comments: commentsByDay.get(String(entry.work_day_id)) ?? [],
      },
      employeeUser: {
        id: employeeId,
        username: usernameById.get(employeeId) || employeeId.slice(0, 8),
        employeeProfile: {
          displayName: displayById.get(employeeId) ?? null,
        },
      },
    });
  }

  mapped.sort((a, b) => {
    const dateDiff = b.workDay.date.getTime() - a.workDay.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.rowOrder - b.rowOrder;
  });

  return mapped;
}

async function findWorkDay(options: {
  businessId: string;
  employeeUserId: string;
  date: string;
}) {
  const { data, error } = await admin()
    .from("work_days")
    .select("id, shift_label")
    .eq("business_id", options.businessId)
    .eq("employee_user_id", options.employeeUserId)
    .eq("work_date", options.date)
    .maybeSingle();
  if (error) throwError("find work_day", error.message);
  return data;
}

async function nextRowOrder(workDayId: string) {
  const { data, error } = await admin()
    .from("work_entries")
    .select("row_order")
    .eq("work_day_id", workDayId)
    .order("row_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throwError("row_order", error.message);
  return Number(data?.row_order ?? 0) + 1;
}

export async function ensureRemoteWorkDay(options: {
  businessId: string;
  employeeUserId: string;
  date: string;
  shiftLabel?: string | null;
}) {
  const existing = await findWorkDay(options);
  if (existing?.id) {
    if (options.shiftLabel && !existing.shift_label) {
      const { error } = await admin()
        .from("work_days")
        .update({ shift_label: options.shiftLabel })
        .eq("id", existing.id);
      if (error) throwError("update work_day", error.message);
    }
    return { id: String(existing.id), nextRowOrder: await nextRowOrder(String(existing.id)) };
  }

  const { data, error } = await admin()
    .from("work_days")
    .insert({
      business_id: options.businessId,
      employee_user_id: options.employeeUserId,
      work_date: options.date,
      shift_label: options.shiftLabel ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throwError("create work_day", error?.message ?? "insert failed");
  return { id: String(data.id), nextRowOrder: 1 };
}

export async function createRemoteWorkEntry(options: {
  businessId: string;
  employeeUserId: string;
  date: string;
  shiftLabel?: string | null;
  orderId: string | null;
  client: string | null;
  orderValueUsd: number | null;
  orderValueBdt: number | null;
  newClients: number | null;
  status: string | null;
  notes: string | null;
  extra: string | null;
  endDate: string | null | undefined;
}) {
  const day = await ensureRemoteWorkDay({
    businessId: options.businessId,
    employeeUserId: options.employeeUserId,
    date: options.date,
    shiftLabel: options.shiftLabel,
  });

  const { data, error } = await admin()
    .from("work_entries")
    .insert({
      business_id: options.businessId,
      work_day_id: day.id,
      employee_user_id: options.employeeUserId,
      row_order: day.nextRowOrder,
      order_id: options.orderId,
      client: options.client,
      order_value_usd: options.orderValueUsd,
      order_value_bdt: options.orderValueBdt,
      new_clients: options.newClients,
      status: options.status ?? "Assigned",
      notes: options.notes,
      extra: options.extra,
      end_date: options.endDate ?? null,
    })
    .select("id")
    .single();
  if (error || !data) throwError("create work_entry", error?.message ?? "insert failed");
  return { id: String(data.id) };
}

export async function loadRemoteOwnedEntry(options: {
  entryId: string;
  employeeUserId: string;
  businessId: string;
}) {
  const { data, error } = await admin()
    .from("work_entries")
    .select("id, work_day_id, employee_user_id, business_id, work_days(work_date, shift_label)")
    .eq("id", options.entryId)
    .eq("employee_user_id", options.employeeUserId)
    .eq("business_id", options.businessId)
    .maybeSingle();
  if (error) throwError("load work_entry", error.message);
  if (!data) return null;
  const day = firstEmbed<{ work_date?: string; shift_label?: string | null }>(data.work_days);
  return {
    id: String(data.id),
    workDayId: String(data.work_day_id),
    date: String(day?.work_date ?? "").slice(0, 10),
    shiftLabel: day?.shift_label ? String(day.shift_label) : null,
  };
}

export async function updateRemoteWorkEntry(options: {
  entryId: string;
  employeeUserId: string;
  businessId: string;
  fields: Record<string, unknown>;
  nextDate?: string;
  shiftLabel?: string | null;
  shiftLabelProvided?: boolean;
}) {
  const existing = await loadRemoteOwnedEntry(options);
  if (!existing) return { ok: false as const, status: 404 as const };

  const payload: Record<string, unknown> = { ...options.fields };
  let nextWorkDayId = existing.workDayId;

  if (options.nextDate && options.nextDate !== existing.date) {
    const nextDay = await ensureRemoteWorkDay({
      businessId: options.businessId,
      employeeUserId: options.employeeUserId,
      date: options.nextDate,
      shiftLabel: options.shiftLabel,
    });
    nextWorkDayId = nextDay.id;
    payload.work_day_id = nextDay.id;
    payload.row_order = nextDay.nextRowOrder;
  }

  if (options.shiftLabelProvided) {
    const { error } = await admin()
      .from("work_days")
      .update({ shift_label: options.shiftLabel ?? null })
      .eq("id", nextWorkDayId);
    if (error) throwError("update shift", error.message);
  }

  if (Object.keys(payload).length > 0) {
    const { error } = await admin().from("work_entries").update(payload).eq("id", existing.id);
    if (error) throwError("update work_entry", error.message);
  }

  if (nextWorkDayId !== existing.workDayId) {
    await cleanupRemoteWorkDay(existing.workDayId);
  }

  return { ok: true as const };
}

export async function deleteRemoteWorkEntry(options: {
  entryId: string;
  employeeUserId: string;
  businessId: string;
}) {
  const existing = await loadRemoteOwnedEntry(options);
  if (!existing) return { ok: false as const, status: 404 as const };

  const { error } = await admin().from("work_entries").delete().eq("id", existing.id);
  if (error) throwError("delete work_entry", error.message);
  await cleanupRemoteWorkDay(existing.workDayId);
  return { ok: true as const };
}

async function cleanupRemoteWorkDay(workDayId: string) {
  const { count: entryCount, error: entryError } = await admin()
    .from("work_entries")
    .select("id", { count: "exact", head: true })
    .eq("work_day_id", workDayId);
  if (entryError) throwError("count work_entries", entryError.message);
  if ((entryCount ?? 0) > 0) return;

  const { count: commentCount, error: commentError } = await admin()
    .from("admin_comments")
    .select("id", { count: "exact", head: true })
    .eq("work_day_id", workDayId);
  if (commentError) throwError("count comments", commentError.message);
  if ((commentCount ?? 0) > 0) return;

  const { error } = await admin().from("work_days").delete().eq("id", workDayId);
  if (error) throwError("delete work_day", error.message);
}

export async function createRemoteAdminComment(options: {
  businessId: string;
  adminUserId: string;
  workDayId: string | null;
  workEntryId: string | null;
  body: string;
}) {
  if (options.workDayId) {
    const { data, error } = await admin()
      .from("work_days")
      .select("id")
      .eq("id", options.workDayId)
      .eq("business_id", options.businessId)
      .maybeSingle();
    if (error) throwError("comment work_day", error.message);
    if (!data) return { ok: false as const, status: 404 as const, error: "Work day not found." };
  }

  if (options.workEntryId) {
    const { data, error } = await admin()
      .from("work_entries")
      .select("id")
      .eq("id", options.workEntryId)
      .eq("business_id", options.businessId)
      .maybeSingle();
    if (error) throwError("comment work_entry", error.message);
    if (!data) return { ok: false as const, status: 404 as const, error: "Work entry not found." };
  }

  const { error } = await admin().from("admin_comments").insert({
    business_id: options.businessId,
    admin_user_id: options.adminUserId,
    work_day_id: options.workDayId,
    work_entry_id: options.workEntryId,
    body: options.body,
  });
  if (error) throwError("create comment", error.message);
  return { ok: true as const };
}

export async function remoteUsernameTaken(username: string) {
  const { data, error } = await admin()
    .from("profiles")
    .select("id")
    .eq("username", username.trim().toLowerCase())
    .maybeSingle();
  if (error) throwError("username check", error.message);
  return Boolean(data?.id);
}

export async function loadRemoteEmployeeRecord(businessId: string, employeeId: string) {
  const { data, error } = await admin()
    .from("profiles")
    .select("id, username, status")
    .eq("id", employeeId)
    .eq("business_id", businessId)
    .eq("role", "EMPLOYEE")
    .maybeSingle();
  if (error) throwError("employee record", error.message);
  if (!data) return null;
  return {
    id: String(data.id),
    supabaseUserId: String(data.id),
    username: String(data.username ?? ""),
    status: data.status === "INACTIVE" ? ("INACTIVE" as const) : ("ACTIVE" as const),
  };
}

export async function updateRemoteEmployeeRecord(options: {
  businessId: string;
  employeeId: string;
  status?: "ACTIVE" | "INACTIVE";
  displayName?: string | null;
  department?: string | null;
  designation?: string | null;
}) {
  if (options.status) {
    const { error } = await admin()
      .from("profiles")
      .update({ status: options.status })
      .eq("id", options.employeeId);
    if (error) throwError("update employee status", error.message);
  }

  if (
    options.displayName !== undefined ||
    options.department !== undefined ||
    options.designation !== undefined
  ) {
    const payload: Record<string, string | null> = {
      business_id: options.businessId,
      user_id: options.employeeId,
    };
    if (options.displayName !== undefined) payload.display_name = options.displayName;
    if (options.department !== undefined) payload.department = options.department;
    if (options.designation !== undefined) payload.designation = options.designation;

    const { error } = await admin()
      .from("employee_profiles")
      .upsert(payload, { onConflict: "user_id" });
    if (error) throwError("update employee_profiles", error.message);

    if (options.displayName !== undefined) {
      await admin()
        .from("profiles")
        .update({ display_name: options.displayName })
        .eq("id", options.employeeId);
    }
  }
}
