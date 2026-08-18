import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type RemoteWorkspace = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  tagline: string | null;
};

function adminClient() {
  return createAdminClient();
}

export async function remoteBusinessIdForUser(supabaseUserId: string) {
  const admin = adminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("business_id")
    .eq("id", supabaseUserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.business_id ? String(data.business_id) : null;
}

export async function fetchRemoteWorkspace(
  supabaseUserId: string,
): Promise<RemoteWorkspace | null> {
  const businessId = await remoteBusinessIdForUser(supabaseUserId);
  if (!businessId) return null;

  const admin = adminClient();
  const { data, error } = await admin
    .from("businesses")
    .select("id, name, slug, logo_url, tagline")
    .eq("id", businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: String(data.id),
    name: String(data.name ?? "Workspace"),
    slug: String(data.slug ?? "workspace"),
    logoUrl: data.logo_url ? String(data.logo_url) : null,
    tagline: data.tagline ? String(data.tagline) : null,
  };
}

export async function fetchRemoteDisplayName(supabaseUserId: string) {
  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", supabaseUserId)
    .maybeSingle();
  if (profile?.display_name) return String(profile.display_name);

  const { data: employee } = await admin
    .from("employee_profiles")
    .select("display_name")
    .eq("user_id", supabaseUserId)
    .maybeSingle();
  return employee?.display_name ? String(employee.display_name) : null;
}

export async function persistRemoteWorkspace(
  supabaseUserId: string,
  data: {
    name?: string;
    tagline?: string | null;
    logoUrl?: string | null;
  },
) {
  const businessId = await remoteBusinessIdForUser(supabaseUserId);
  if (!businessId) {
    throw new Error("This account is not linked to a Supabase workspace yet.");
  }

  const payload: Record<string, string | null> = {};
  if (data.name !== undefined) payload.name = data.name;
  if (data.tagline !== undefined) payload.tagline = data.tagline;
  if (data.logoUrl !== undefined) payload.logo_url = data.logoUrl;
  if (Object.keys(payload).length === 0) return businessId;

  const admin = adminClient();
  const { data: updated, error } = await admin
    .from("businesses")
    .update(payload)
    .eq("id", businessId)
    .select("id");
  if (error) throw new Error(error.message);
  if (!updated?.length) {
    throw new Error("Workspace row was not updated in Supabase.");
  }
  return businessId;
}

export function revalidateBrandPages() {
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/settings");
  revalidatePath("/employee", "layout");
  revalidatePath("/employee/sheet");
}

export async function persistRemoteDisplayName(
  supabaseUserId: string,
  displayName: string | null,
) {
  const admin = adminClient();
  const { error: profileError } = await admin
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", supabaseUserId);
  if (profileError) {
    const missingColumn = /display_name|schema cache|could not find/i.test(
      profileError.message,
    );
    throw new Error(
      missingColumn
        ? "Run this SQL in Supabase, then save again: alter table public.profiles add column if not exists display_name text;"
        : profileError.message,
    );
  }

  const businessId = await remoteBusinessIdForUser(supabaseUserId);
  if (!businessId) return;

  const { error: employeeError } = await admin.from("employee_profiles").upsert(
    {
      business_id: businessId,
      user_id: supabaseUserId,
      display_name: displayName,
    },
    { onConflict: "user_id" },
  );
  if (employeeError) throw new Error(employeeError.message);
}

export async function persistRemoteLogoFile(
  supabaseUserId: string,
  buffer: Buffer,
  mime: string,
  extension: string,
) {
  const businessId = await remoteBusinessIdForUser(supabaseUserId);
  if (!businessId) {
    throw new Error("This account is not linked to a Supabase workspace yet.");
  }

  const admin = adminClient();
  const objectPath = `${businessId}/logo${extension}`;
  const { error: uploadError } = await admin.storage.from("brand-logos").upload(objectPath, buffer, {
    upsert: true,
    contentType: mime,
    cacheControl: "3600",
  });

  if (uploadError) {
    if (buffer.length <= 400_000) {
      const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
      await persistRemoteWorkspace(supabaseUserId, { logoUrl: dataUrl });
      return dataUrl;
    }
    throw new Error(
      `${uploadError.message} Create the brand-logos bucket (see supabase/alter_business_logo.sql).`,
    );
  }

  const { data } = admin.storage.from("brand-logos").getPublicUrl(objectPath);
  const logoUrl = `${data.publicUrl}?v=${Date.now()}`;
  await persistRemoteWorkspace(supabaseUserId, { logoUrl });
  return logoUrl;
}

export async function removeRemoteLogo(supabaseUserId: string) {
  const businessId = await remoteBusinessIdForUser(supabaseUserId);
  if (businessId) {
    const admin = adminClient();
    await admin.storage.from("brand-logos").remove([
      `${businessId}/logo.png`,
      `${businessId}/logo.jpg`,
      `${businessId}/logo.webp`,
      `${businessId}/logo.gif`,
    ]);
  }
  await persistRemoteWorkspace(supabaseUserId, { logoUrl: null });
}

/** @deprecated Use persistRemoteWorkspace — kept for call-site compatibility. */
export async function syncRemoteWorkspace(
  supabaseUserId: string | null | undefined,
  data: {
    name?: string;
    tagline?: string | null;
    logoUrl?: string | null;
  },
) {
  if (!supabaseUserId) {
    throw new Error("Missing Supabase user id; cannot save workspace settings.");
  }
  await persistRemoteWorkspace(supabaseUserId, data);
}

/** @deprecated Use persistRemoteDisplayName. */
export async function syncRemoteDisplayName(
  supabaseUserId: string | null | undefined,
  displayName: string | null,
) {
  if (!supabaseUserId) {
    throw new Error("Missing Supabase user id; cannot save display name.");
  }
  await persistRemoteDisplayName(supabaseUserId, displayName);
}
