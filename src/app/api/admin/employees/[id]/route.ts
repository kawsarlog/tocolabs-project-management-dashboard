import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAdmin } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import {
  deleteAuthUser,
  updateAuthPassword,
  updateAuthStatus,
} from "@/lib/auth/provision";
import { createAdminClient } from "@/lib/supabase/admin";
import { useSupabaseLedger } from "@/lib/supabase/ledger-mode";
import {
  loadRemoteEmployeeRecord,
  updateRemoteEmployeeRecord,
} from "@/lib/supabase/work-store";

async function loadEmployee(employeeId: string, businessId: string) {
  if (useSupabaseLedger()) {
    const remote = await loadRemoteEmployeeRecord(businessId, employeeId);
    if (!remote) return null;
    return { id: remote.id, supabaseUserId: remote.supabaseUserId };
  }

  return prisma.user.findFirst({
    where: { id: employeeId, businessId, role: "EMPLOYEE" },
    select: { id: true, supabaseUserId: true },
  });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionOrRes = await requireBusinessAdmin();
  if (sessionOrRes instanceof NextResponse) return sessionOrRes;
  const session = sessionOrRes;

  const employeeId = String((await context.params)?.id ?? "");
  const body = await req.json();
  const status = body?.status ? String(body.status) : undefined;
  const displayName =
    body?.displayName !== undefined
      ? String(body.displayName ?? "").trim() || null
      : undefined;
  const department =
    body?.department !== undefined ? (body.department ? String(body.department).trim() : null) : undefined;
  const designation =
    body?.designation !== undefined
      ? body.designation
        ? String(body.designation).trim()
        : null
      : undefined;
  const password = body?.password !== undefined ? String(body.password) : undefined;

  if (status !== undefined && !["ACTIVE", "INACTIVE"].includes(status)) {
    return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 400 });
  }

  if (password !== undefined && password.length < 6) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }

  const employee = await loadEmployee(employeeId, session.businessId!);
  if (!employee) {
    return NextResponse.json({ ok: false, error: "Employee not found." }, { status: 404 });
  }

  if (useSupabaseLedger()) {
    try {
      await updateRemoteEmployeeRecord({
        businessId: session.businessId!,
        employeeId,
        status: status as "ACTIVE" | "INACTIVE" | undefined,
        displayName,
        department,
        designation,
      });
      if (status !== undefined && employee.supabaseUserId) {
        await updateAuthStatus(employee.supabaseUserId, status as "ACTIVE" | "INACTIVE");
      }
      if (password && employee.supabaseUserId) {
        await updateAuthPassword(employee.supabaseUserId, password);
      }
      return NextResponse.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not update employee.";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
  }

  if (status !== undefined) {
    await prisma.user.update({
      where: { id: employeeId },
      data: { status: status as "ACTIVE" | "INACTIVE" },
    });
    if (employee.supabaseUserId) {
      await updateAuthStatus(employee.supabaseUserId, status as "ACTIVE" | "INACTIVE");
    }
  }

  if (displayName !== undefined || department !== undefined || designation !== undefined) {
    await prisma.employeeProfile.upsert({
      where: { userId: employeeId },
      update: {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(department !== undefined ? { department } : {}),
        ...(designation !== undefined ? { designation } : {}),
      },
      create: {
        businessId: session.businessId!,
        userId: employeeId,
        displayName: displayName ?? null,
        department: department ?? null,
        designation: designation ?? null,
      },
    });

    if (employee.supabaseUserId) {
      const admin = createAdminClient();
      await admin
        .from("employee_profiles")
        .update({
          ...(displayName !== undefined ? { display_name: displayName } : {}),
          ...(department !== undefined ? { department } : {}),
          ...(designation !== undefined ? { designation } : {}),
        })
        .eq("user_id", employee.supabaseUserId);
    }
  }

  if (password) {
    const passwordHash = await hashPassword(password);
    await prisma.user.update({
      where: { id: employeeId },
      data: { passwordHash },
    });
    await prisma.session.deleteMany({ where: { userId: employeeId } });
    if (employee.supabaseUserId) {
      await updateAuthPassword(employee.supabaseUserId, password);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const sessionOrRes = await requireBusinessAdmin();
  if (sessionOrRes instanceof NextResponse) return sessionOrRes;
  const session = sessionOrRes;

  const employeeId = String((await context.params)?.id ?? "");
  const employee = await loadEmployee(employeeId, session.businessId!);
  if (!employee) {
    return NextResponse.json({ ok: false, error: "Employee not found." }, { status: 404 });
  }

  if (employee.supabaseUserId) {
    await deleteAuthUser(employee.supabaseUserId);
  }

  if (!useSupabaseLedger()) {
    await prisma.user.delete({ where: { id: employeeId } });
  }
  return NextResponse.json({ ok: true });
}
