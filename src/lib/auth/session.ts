import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { ensureLocalUserFromAuth } from "@/lib/auth/sync-user";

const SESSION_COOKIE_NAME = "toco_session";

export type SessionUser = {
  id: string;
  username: string;
  role: "PLATFORM_ADMIN" | "BUSINESS_ADMIN" | "EMPLOYEE";
  businessId: string | null;
  supabaseUserId: string;
};

function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function getSessionCookieToken() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;

    const local = await ensureLocalUserFromAuth(data.user);
    if (local.status !== "ACTIVE") return null;

    return {
      id: local.id,
      username: local.username,
      role: local.role,
      businessId: local.businessId ?? null,
      supabaseUserId: data.user.id,
    };
  } catch (error) {
    console.error("[auth] getSessionUser failed:", error);
    return null;
  }
}

/** @deprecated Local cookie sessions are no longer the source of truth. */
export async function createSessionForUser(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

  await prisma.session.create({
    data: {
      userId,
      sessionType: "PASSWORD",
      tokenHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });

  return { token, expiresAt };
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
  });
}
