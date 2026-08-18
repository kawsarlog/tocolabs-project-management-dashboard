import { createAdminClient } from "@/lib/supabase/admin";

export async function syncRemoteWorkspace(
  supabaseUserId: string | null | undefined,
  data: {
    name?: string;
    tagline?: string | null;
    logoUrl?: string | null;
  },
) {
  if (!supabaseUserId) return;
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("business_id")
      .eq("id", supabaseUserId)
      .maybeSingle();
    const businessId = profile?.business_id ? String(profile.business_id) : null;
    if (!businessId) return;

    const payload: Record<string, string | null> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.tagline !== undefined) payload.tagline = data.tagline;
    if (data.logoUrl !== undefined) payload.logo_url = data.logoUrl;
    if (Object.keys(payload).length === 0) return;

    await admin.from("businesses").update(payload).eq("id", businessId);
  } catch {
    // Remote columns may not exist until supabase/alter_business_logo.sql is run.
  }
}

export async function syncRemoteDisplayName(
  supabaseUserId: string | null | undefined,
  displayName: string | null,
) {
  if (!supabaseUserId) return;
  try {
    const admin = createAdminClient();
    await admin
      .from("employee_profiles")
      .update({ display_name: displayName })
      .eq("user_id", supabaseUserId);
  } catch {
    // Profile row may not exist yet for older admin accounts.
  }
}
