import { NextResponse } from "next/server";
import { requireBusinessAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { updateAuthPassword } from "@/lib/auth/provision";

export async function POST(req: Request) {
  const sessionOrRes = await requireBusinessAdmin();
  if (sessionOrRes instanceof NextResponse) return sessionOrRes;
  const session = sessionOrRes;

  const body = (await req.json()) as {
    currentPassword?: unknown;
    newPassword?: unknown;
    confirmPassword?: unknown;
  };

  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const confirmPassword = typeof body.confirmPassword === "string" ? body.confirmPassword : "";

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json(
      { ok: false, error: "Enter your current password and the new password twice." },
      { status: 400 },
    );
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { ok: false, error: "New password must be at least 8 characters." },
      { status: 400 },
    );
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json(
      { ok: false, error: "New password and confirmation do not match." },
      { status: 400 },
    );
  }
  if (newPassword === currentPassword) {
    return NextResponse.json(
      { ok: false, error: "Choose a new password that is different from the current one." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: auth, error: userError } = await supabase.auth.getUser();
  if (userError || !auth.user?.email) {
    return NextResponse.json(
      { ok: false, error: "Could not verify this account. Sign in again and retry." },
      { status: 401 },
    );
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: auth.user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return NextResponse.json(
      { ok: false, error: "Current password is incorrect." },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    const local = await prisma.user.findUnique({
      where: { id: session.id },
      select: { supabaseUserId: true },
    });
    if (local?.supabaseUserId) {
      try {
        await updateAuthPassword(local.supabaseUserId, newPassword);
      } catch {
        return NextResponse.json(
          { ok: false, error: "Could not update the password. Try again." },
          { status: 500 },
        );
      }
    } else {
      return NextResponse.json(
        { ok: false, error: "Could not update the password. Try again." },
        { status: 500 },
      );
    }
  }

  await prisma.user.update({
    where: { id: session.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });

  return NextResponse.json({ ok: true });
}
