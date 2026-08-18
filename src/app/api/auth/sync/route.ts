import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyRegisterIntent, ensureLocalUserFromAuth } from "@/lib/auth/sync-user";
import { redirectToForRole, type AppRole } from "@/lib/auth/identity";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const intent = body?.intent === "EMPLOYEE" ? "EMPLOYEE" : "BUSINESS_ADMIN";
    const businessName =
      typeof body?.businessName === "string" ? body.businessName : null;
    const displayName =
      typeof body?.displayName === "string" ? body.displayName : null;
    const expectedPortal =
      body?.expectedPortal === "employee"
        ? "employee"
        : body?.expectedPortal === "admin"
          ? "admin"
          : null;

    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      return NextResponse.json(
        { ok: false, error: "Not signed in." },
        { status: 401 },
      );
    }

    if (body?.syncRole !== false) {
      await applyRegisterIntent({
        authUserId: data.user.id,
        intent,
        businessName,
        displayName,
      });
    }

    const local = await ensureLocalUserFromAuth(data.user, {
      roleOverride:
        body?.syncRole !== false && intent === "BUSINESS_ADMIN"
          ? "BUSINESS_ADMIN"
          : undefined,
    });
    if (local.status !== "ACTIVE") {
      await supabase.auth.signOut();
      return NextResponse.json(
        { ok: false, error: "This account is inactive." },
        { status: 403 },
      );
    }

    if (expectedPortal === "admin" && local.role === "EMPLOYEE") {
      await supabase.auth.signOut();
      return NextResponse.json(
        {
          ok: false,
          error: "This is a team member account. Switch to Employee / Team member.",
        },
        { status: 403 },
      );
    }

    if (
      expectedPortal === "employee" &&
      (local.role === "BUSINESS_ADMIN" || local.role === "PLATFORM_ADMIN")
    ) {
      await supabase.auth.signOut();
      return NextResponse.json(
        {
          ok: false,
          error: "This is an admin account. Switch to Admin.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({
      ok: true,
      redirectTo: redirectToForRole(local.role as AppRole),
      role: local.role,
    });
  } catch (error) {
    console.error("[auth/sync] failed:", error);
    const detail = error instanceof Error ? error.message : "Could not finish sign-in.";
    return NextResponse.json(
      { ok: false, error: "Could not finish sign-in.", detail },
      { status: 500 },
    );
  }
}
