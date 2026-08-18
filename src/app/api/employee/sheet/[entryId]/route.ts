import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth/guards";
import { parseEntryPayload } from "@/lib/entry-fields";

async function loadOwnedEntry(entryId: string, employeeUserId: string, businessId: string) {
  return prisma.workEntry.findFirst({
    where: { id: entryId, employeeUserId, businessId },
    include: { workDay: true },
  });
}

async function ensureWorkDay({
  businessId,
  employeeUserId,
  date,
  shiftLabel,
}: {
  businessId: string;
  employeeUserId: string;
  date: Date;
  shiftLabel?: string | null;
}) {
  const existing = await prisma.workDay.findFirst({
    where: { businessId, employeeUserId, date },
    include: { entries: { select: { rowOrder: true } } },
  });

  if (existing) {
    if (shiftLabel && !existing.shiftLabel) {
      await prisma.workDay.update({
        where: { id: existing.id },
        data: { shiftLabel },
      });
    }
    const nextRowOrder = existing.entries.length
      ? Math.max(...existing.entries.map((entry) => entry.rowOrder)) + 1
      : 1;
    return { id: existing.id, nextRowOrder };
  }

  const created = await prisma.workDay.create({
    data: {
      businessId,
      employeeUserId,
      date,
      shiftLabel: shiftLabel ?? null,
    },
  });

  return { id: created.id, nextRowOrder: 1 };
}

async function cleanupEmptyWorkDay(workDayId: string) {
  const remaining = await prisma.workEntry.count({ where: { workDayId } });
  if (remaining > 0) return;
  const comments = await prisma.adminComment.count({ where: { workDayId } });
  if (comments > 0) return;
  await prisma.workDay.delete({ where: { id: workDayId } });
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ entryId: string }> },
) {
  const sessionOrRes = await requireEmployee();
  if (sessionOrRes instanceof NextResponse) return sessionOrRes;
  const session = sessionOrRes;

  const { entryId } = await context.params;
  const entry = await loadOwnedEntry(entryId, session.id, session.businessId!);
  if (!entry) {
    return NextResponse.json({ ok: false, error: "Entry not found." }, { status: 404 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const parsed = parseEntryPayload(body);

  const data: Record<string, unknown> = {};
  if (body.orderId !== undefined) data.orderId = parsed.orderId;
  if (body.client !== undefined) data.client = parsed.client;
  if (body.orderValueUsd !== undefined) {
    data.orderValueUsd = parsed.orderValueUsd;
    data.orderValueBdt = parsed.orderValueBdt;
  }
  if (body.newClients !== undefined) data.newClients = parsed.newClients;
  if (body.status !== undefined) data.status = parsed.status;
  if (body.notes !== undefined) data.notes = parsed.notes;
  if (body.extra !== undefined) data.extra = parsed.extra;
  if (body.endDate !== undefined) {
    data.endDate = parsed.endDate ? new Date(`${parsed.endDate}T00:00:00.000Z`) : null;
  }

  let nextWorkDayId = entry.workDayId;
  const previousWorkDayId = entry.workDayId;

  if (parsed.date) {
    const dayDate = new Date(`${parsed.date}T00:00:00.000Z`);
    if (Number.isNaN(dayDate.getTime())) {
      return NextResponse.json({ ok: false, error: "Invalid date." }, { status: 400 });
    }
    const currentDate = entry.workDay.date.toISOString().slice(0, 10);
    if (parsed.date !== currentDate) {
      const nextDay = await ensureWorkDay({
        businessId: session.businessId!,
        employeeUserId: session.id,
        date: dayDate,
        shiftLabel: parsed.shiftLabel,
      });
      nextWorkDayId = nextDay.id;
      data.workDayId = nextDay.id;
      data.rowOrder = nextDay.nextRowOrder;
    }
  }

  if (parsed.shiftLabel !== undefined && body.shiftLabel !== undefined) {
    await prisma.workDay.update({
      where: { id: nextWorkDayId },
      data: { shiftLabel: parsed.shiftLabel },
    });
  }

  await prisma.workEntry.update({
    where: { id: entry.id },
    data,
  });

  if (nextWorkDayId !== previousWorkDayId) {
    await cleanupEmptyWorkDay(previousWorkDayId);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ entryId: string }> },
) {
  const sessionOrRes = await requireEmployee();
  if (sessionOrRes instanceof NextResponse) return sessionOrRes;
  const session = sessionOrRes;

  const { entryId } = await context.params;
  const entry = await loadOwnedEntry(entryId, session.id, session.businessId!);
  if (!entry) {
    return NextResponse.json({ ok: false, error: "Entry not found." }, { status: 404 });
  }

  await prisma.workEntry.delete({ where: { id: entry.id } });
  await cleanupEmptyWorkDay(entry.workDayId);

  return NextResponse.json({ ok: true });
}
