import { createAdminClient } from "@/lib/supabase/admin";
import { usernameToAuthEmail, type AppRole } from "@/lib/auth/identity";

export async function provisionAuthUser(options: {
  username: string;
  password: string;
  role: AppRole;
  businessId?: string | null;
  displayName?: string | null;
  department?: string | null;
  designation?: string | null;
  email?: string | null;
}) {
  const admin = createAdminClient();
  const username = options.username.trim().toLowerCase();
  const email = options.email?.trim().toLowerCase() || usernameToAuthEmail(username);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: options.password,
    email_confirm: true,
    user_metadata: { username },
    app_metadata: { role: options.role },
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Could not create the auth user.");
  }

  await admin
    .from("profiles")
    .update({
      username,
      email,
      role: options.role,
      business_id: options.businessId ?? null,
      status: "ACTIVE",
    })
    .eq("id", data.user.id);

  if ((options.role === "EMPLOYEE" || options.role === "BUSINESS_ADMIN") && options.businessId) {
    await admin.from("employee_profiles").upsert(
      {
        business_id: options.businessId,
        user_id: data.user.id,
        display_name: options.displayName ?? null,
        department: options.department ?? null,
        designation: options.designation ?? null,
      },
      { onConflict: "user_id" },
    );
  }

  return data.user;
}

export async function updateAuthPassword(supabaseUserId: string, password: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(supabaseUserId, { password });
  if (error) throw new Error(error.message);
}

export async function updateAuthStatus(
  supabaseUserId: string,
  status: "ACTIVE" | "INACTIVE",
) {
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ status }).eq("id", supabaseUserId);
  if (error) throw new Error(error.message);
}

export async function deleteAuthUser(supabaseUserId: string) {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(supabaseUserId);
  if (error) throw new Error(error.message);
}

export async function supabaseBusinessIdForAdmin(supabaseUserId: string | null) {
  const admin = createAdminClient();
  if (supabaseUserId) {
    const { data } = await admin
      .from("profiles")
      .select("business_id")
      .eq("id", supabaseUserId)
      .maybeSingle();
    if (data?.business_id) return String(data.business_id);
  }

  const { data: fallback } = await admin
    .from("businesses")
    .select("id")
    .eq("slug", "tocolabs")
    .maybeSingle();

  return fallback?.id ? String(fallback.id) : null;
}
