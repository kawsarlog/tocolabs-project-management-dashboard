import type { User as AuthUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import {
  type AppRole,
  usernameFromAuthUser,
} from "@/lib/auth/identity";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProfileRow = {
  username: string;
  email: string | null;
  role: AppRole;
  status: "ACTIVE" | "INACTIVE";
  business_id: string | null;
};

export type LocalAuthUser = {
  id: string;
  username: string;
  email: string | null;
  supabaseUserId: string | null;
  role: AppRole;
  status: "ACTIVE" | "INACTIVE";
  businessId: string | null;
};

const SUPABASE_MANAGED_PASSWORD = "supabase-managed";

function isAppRole(value: unknown): value is AppRole {
  return (
    value === "PLATFORM_ADMIN" ||
    value === "BUSINESS_ADMIN" ||
    value === "EMPLOYEE"
  );
}

function roleFromAuthUser(authUser: AuthUser, profile: ProfileRow | null): AppRole {
  if (profile?.role) return profile.role;
  if (isAppRole(authUser.app_metadata?.role)) return authUser.app_metadata.role;
  return "EMPLOYEE";
}

function profileFromAuthUser(authUser: AuthUser): ProfileRow {
  const username =
    usernameFromAuthUser(authUser) || `user-${authUser.id.slice(0, 8)}`;
  return {
    username,
    email: authUser.email ?? null,
    role: roleFromAuthUser(authUser, null),
    status: "ACTIVE",
    business_id: null,
  };
}

function mapProfile(data: {
  username: unknown;
  email: unknown;
  role: unknown;
  status: unknown;
  business_id: unknown;
}): ProfileRow {
  return {
    username: String(data.username).toLowerCase(),
    email: data.email ? String(data.email) : null,
    role: isAppRole(data.role) ? data.role : "EMPLOYEE",
    status: data.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    business_id: data.business_id ? String(data.business_id) : null,
  };
}

export async function loadProfile(
  userId: string,
): Promise<ProfileRow | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("profiles")
    .select("username, email, role, status, business_id")
    .eq("id", userId)
    .maybeSingle();

  if (!error && data) return mapProfile(data);
  if (error) {
    console.error("[auth] loadProfile (user client) failed:", error.message);
  }

  try {
    const admin = createAdminClient();
    const { data: adminData, error: adminError } = await admin
      .from("profiles")
      .select("username, email, role, status, business_id")
      .eq("id", userId)
      .maybeSingle();
    if (adminError) {
      console.error("[auth] loadProfile (admin) failed:", adminError.message);
      return null;
    }
    return adminData ? mapProfile(adminData) : null;
  } catch (adminCatch) {
    console.error("[auth] loadProfile admin fallback unavailable:", adminCatch);
    return null;
  }
}

export function localUserFromProfile(
  authUser: AuthUser,
  profile: ProfileRow | null,
  roleOverride?: AppRole,
): LocalAuthUser {
  const resolved = profile ?? profileFromAuthUser(authUser);
  return {
    id: authUser.id,
    username: resolved.username,
    email: resolved.email || authUser.email || null,
    supabaseUserId: authUser.id,
    role: roleOverride ?? resolved.role,
    status: resolved.status,
    businessId: resolved.business_id,
  };
}

async function defaultLocalBusinessId() {
  const existing =
    (await prisma.business.findFirst({ where: { slug: "tocolabs" } })) ??
    (await prisma.business.findFirst({ orderBy: { createdAt: "asc" } }));

  if (existing) return existing.id;

  const created = await prisma.business.create({
    data: { name: "TocoLabs", slug: "tocolabs" },
  });
  return created.id;
}

async function ensureEmployeeProfile(
  userId: string,
  businessId: string,
  displayName?: string | null,
) {
  await prisma.employeeProfile.upsert({
    where: { userId },
    update: displayName ? { displayName } : {},
    create: {
      businessId,
      userId,
      displayName: displayName ?? null,
    },
  });
}

export async function ensureLocalUserFromAuth(
  authUser: AuthUser,
  options?: { roleOverride?: AppRole },
): Promise<LocalAuthUser> {
  const profile = await loadProfile(authUser.id);
  const fallback = localUserFromProfile(authUser, profile, options?.roleOverride);

  try {
    const username = fallback.username;
    const email = fallback.email;
    const role = fallback.role;
    const status = fallback.status;

    let local = await prisma.user.findFirst({
      where: {
        OR: [
          { supabaseUserId: authUser.id },
          { username },
          ...(email ? [{ email }] : []),
        ],
      },
    });

    // Local SQLite business rows are not the same IDs as Supabase `businesses`.
    const businessId = local?.businessId ?? (await defaultLocalBusinessId());

    if (local) {
      const alreadyLinked =
        local.supabaseUserId === authUser.id &&
        local.role === role &&
        local.status === status &&
        (email ? local.email === email : true);

      if (!alreadyLinked) {
        local = await prisma.user.update({
          where: { id: local.id },
          data: {
            supabaseUserId: authUser.id,
            email: email ?? local.email,
            role,
            status,
            businessId: local.businessId ?? businessId,
          },
        });
      }
    } else {
      local = await prisma.user.create({
        data: {
          username,
          email,
          supabaseUserId: authUser.id,
          passwordHash: SUPABASE_MANAGED_PASSWORD,
          role,
          status,
          businessId,
        },
      });
    }

    if (role === "EMPLOYEE" || role === "BUSINESS_ADMIN") {
      const resolvedBusinessId = local.businessId ?? businessId;
      if (resolvedBusinessId) {
        const existingProfile = await prisma.employeeProfile.findUnique({
          where: { userId: local.id },
          select: { id: true },
        });
        if (!existingProfile) {
          await ensureEmployeeProfile(local.id, resolvedBusinessId);
        }
      }
    }

    return {
      id: local.id,
      username: local.username,
      email: local.email,
      supabaseUserId: local.supabaseUserId,
      role: local.role as AppRole,
      status: local.status,
      businessId: local.businessId ?? null,
    };
  } catch (error) {
    console.error(
      "[auth] ledger upsert failed; continuing with Supabase profile session:",
      error,
    );
    return fallback;
  }
}

export async function applyRegisterIntent(options: {
  authUserId: string;
  intent: "EMPLOYEE" | "BUSINESS_ADMIN";
  businessName?: string | null;
  displayName?: string | null;
}) {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, business_id, username")
    .eq("id", options.authUserId)
    .maybeSingle();

  if (!profile) return;

  let businessId = profile.business_id as string | null;
  let role = profile.role as AppRole;

  const { count: platformCount } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "PLATFORM_ADMIN");

  if (!platformCount && profile.username === "superadmin") {
    role = "PLATFORM_ADMIN";
  } else if (options.intent === "BUSINESS_ADMIN" && role === "EMPLOYEE") {
    role = "BUSINESS_ADMIN";
  }

  if (!businessId) {
    const { data: defaultBiz } = await admin
      .from("businesses")
      .select("id")
      .eq("slug", "tocolabs")
      .maybeSingle();

    if (options.intent === "BUSINESS_ADMIN") {
      const name = options.businessName?.trim() || "New workspace";
      const baseSlug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "workspace";
      const slug = `${baseSlug}-${options.authUserId.slice(0, 6)}`;
      const { data: created } = await admin
        .from("businesses")
        .insert({ name, slug })
        .select("id")
        .single();
      businessId = created?.id ?? defaultBiz?.id ?? null;
    } else {
      businessId = defaultBiz?.id ?? null;
    }
  }

  await admin
    .from("profiles")
    .update({
      role,
      business_id: businessId,
    })
    .eq("id", options.authUserId);

  if ((role === "EMPLOYEE" || role === "BUSINESS_ADMIN") && businessId) {
    await admin.from("employee_profiles").upsert(
      {
        business_id: businessId,
        user_id: options.authUserId,
        display_name: options.displayName ?? null,
      },
      { onConflict: "user_id" },
    );
  }

  await admin.auth.admin.updateUserById(options.authUserId, {
    app_metadata: { role },
  });
}
