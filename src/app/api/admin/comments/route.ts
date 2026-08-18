import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAdmin } from "@/lib/auth/guards";
import { useSupabaseLedger } from "@/lib/supabase/ledger-mode";
import { createRemoteAdminComment } from "@/lib/supabase/work-store";

export async function POST(req: Request) {
  const sessionOrRes = await requireBusinessAdmin();
  if (sessionOrRes instanceof NextResponse) return sessionOrRes;
  const session = sessionOrRes;

  const body = await req.json();
  const workDayId = body?.workDayId ? String(body.workDayId) : null;
  const workEntryId = body?.workEntryId ? String(body.workEntryId) : null;
  const message = String(body?.message ?? "").trim();

  if (!message) {
    return NextResponse.json({ ok: false, error: "Comment is required." }, { status: 400 });
  }

  if (!workDayId && !workEntryId) {
    return NextResponse.json(
      { ok: false, error: "A target day or entry is required." },
      { status: 400 },
    );
  }

  if (useSupabaseLedger()) {
    try {
      const result = await createRemoteAdminComment({
        businessId: session.businessId!,
        adminUserId: session.id,
        workDayId,
        workEntryId,
        body: message,
      });
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
      }
      return NextResponse.json({ ok: true });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Could not save the comment.";
      return NextResponse.json({ ok: false, error: messageText }, { status: 500 });
    }
  }

  if (workDayId) {
    const day = await prisma.workDay.findFirst({
      where: { id: workDayId, businessId: session.businessId! },
      select: { id: true },
    });
    if (!day) {
      return NextResponse.json({ ok: false, error: "Work day not found." }, { status: 404 });
    }
  }

  if (workEntryId) {
    const entry = await prisma.workEntry.findFirst({
      where: { id: workEntryId, businessId: session.businessId! },
      select: { id: true },
    });
    if (!entry) {
      return NextResponse.json({ ok: false, error: "Work entry not found." }, { status: 404 });
    }
  }

  await prisma.adminComment.create({
    data: {
      businessId: session.businessId!,
      adminUserId: session.id,
      workDayId,
      workEntryId,
      body: message,
    },
  });

  return NextResponse.json({ ok: true });
}

