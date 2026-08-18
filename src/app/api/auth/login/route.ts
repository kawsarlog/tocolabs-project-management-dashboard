import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toAuthEmail, redirectToForRole, type AppRole } from "@/lib/auth/identity";
import { ensureLocalUserFromAuth } from "@/lib/auth/sync-user";
import { clearSessionCookie } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "");

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: "Username and password are required." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: toAuthEmail(username),
      password,
    });

    if (error || !data.user) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? "Invalid credentials." },
        { status: 400 },
      );
    }

    await clearSessionCookie();
    const local = await ensureLocalUserFromAuth(data.user);
    if (local.status !== "ACTIVE") {
      await supabase.auth.signOut();
      return NextResponse.json(
        { ok: false, error: "This account is inactive." },
        { status: 403 },
      );
    }

    return NextResponse.json({
      ok: true,
      redirectTo: redirectToForRole(local.role as AppRole),
    });
  } catch (error) {
    console.error("[auth/login] failed:", error);
    return NextResponse.json(
      { ok: false, error: "Login failed. Please try again." },
      { status: 500 },
    );
  }
}
