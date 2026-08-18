import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";

export async function requireBusinessAdmin() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (
    (session.role !== "BUSINESS_ADMIN" && session.role !== "PLATFORM_ADMIN") ||
    !session.businessId
  ) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  return session;
}

export async function requireEmployee() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "EMPLOYEE" || !session.businessId) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  return session;
}

export async function requirePlatformAdmin() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  return session;
}

