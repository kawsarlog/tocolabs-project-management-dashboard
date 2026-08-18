import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAdmin } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import {
  provisionAuthUser,
  supabaseBusinessIdForAdmin,
} from "@/lib/auth/provision";

export async function GET() {
  const sessionOrRes = await requireBusinessAdmin();
  if (sessionOrRes instanceof NextResponse) return sessionOrRes;
  const session = sessionOrRes;

  const employees = await prisma.user.findMany({
    where: {
      businessId: session.businessId!,
      role: "EMPLOYEE",
    },
    select: {
      id: true,
      username: true,
      status: true,
      businessId: true,
      createdAt: true,
      employeeProfile: {
        select: {
          displayName: true,
          department: true,
          designation: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, employees });
}

export async function POST(req: Request) {
  const sessionOrRes = await requireBusinessAdmin();
  if (sessionOrRes instanceof NextResponse) return sessionOrRes;
  const session = sessionOrRes;

  const body = await req.json();
  const username = String(body?.username ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const displayName = String(body?.displayName ?? "").trim() || null;
  const department = body?.department ? String(body.department).trim() : null;
  const designation = body?.designation ? String(body.designation).trim() : null;

  if (!username || !password) {
    return NextResponse.json(
      { ok: false, error: "Username and password are required." },
      { status: 400 },
    );
  }

  if (username.length < 3) {
    return NextResponse.json(
      { ok: false, error: "Username must be at least 3 characters." },
      { status: 400 },
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findFirst({
    where: { username },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.json(
      { ok: false, error: "That username is already taken." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);

  try {
    const current = await prisma.user.findUnique({
      where: { id: session.id },
      select: { supabaseUserId: true },
    });
    const supabaseBusinessId = await supabaseBusinessIdForAdmin(
      current?.supabaseUserId ?? null,
    );
    const authUser = await provisionAuthUser({
      username,
      password,
      role: "EMPLOYEE",
      businessId: supabaseBusinessId,
      displayName,
      department,
      designation,
    });

    const createdUser = await prisma.user.create({
      data: {
        username,
        email: authUser.email,
        supabaseUserId: authUser.id,
        passwordHash,
        role: "EMPLOYEE",
        status: "ACTIVE",
        businessId: session.businessId!,
      },
      select: { id: true, username: true },
    });

    await prisma.employeeProfile.create({
      data: {
        businessId: session.businessId!,
        userId: createdUser.id,
        displayName,
        department,
        designation,
      },
    });

    return NextResponse.json({ ok: true, employee: createdUser });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create employee";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
