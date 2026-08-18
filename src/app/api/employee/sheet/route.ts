import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireEmployee } from "@/lib/auth/guards";
import { parseEntryPayload } from "@/lib/entry-fields";

export async function POST(req: Request) {
  const sessionOrRes = await requireEmployee();
  if (sessionOrRes instanceof NextResponse) return sessionOrRes;
  const session = sessionOrRes;

  const body = (await req.json()) as Record<string, unknown>;
  const parsed = parseEntryPayload(body);

  if (!parsed.date) {
    return NextResponse.json({ ok: false, error: "Date is required." }, { status: 400 });
  }

  const dayDate = new Date(`${parsed.date}T00:00:00.000Z`);
  if (Number.isNaN(dayDate.getTime())) {
    return NextResponse.json({ ok: false, error: "Invalid date." }, { status: 400 });
  }

  const existingDay = await prisma.workDay.findFirst({
    where: {
      businessId: session.businessId!,
      employeeUserId: session.id,
      date: dayDate,
    },
    include: { entries: { select: { rowOrder: true } } },
  });

  let workDayId = existingDay?.id;
  let nextRowOrder = existingDay?.entries.length
    ? Math.max(...existingDay.entries.map((entry) => entry.rowOrder)) + 1
    : 1;

  if (!workDayId) {
    const createdDay = await prisma.workDay.create({
      data: {
        businessId: session.businessId!,
        employeeUserId: session.id,
        date: dayDate,
        shiftLabel: parsed.shiftLabel,
      },
    });
    workDayId = createdDay.id;
    nextRowOrder = 1;
  } else if (parsed.shiftLabel && !existingDay?.shiftLabel) {
    await prisma.workDay.update({
      where: { id: workDayId },
      data: { shiftLabel: parsed.shiftLabel },
    });
  }

  const created = await prisma.workEntry.create({
    data: {
      businessId: session.businessId!,
      workDayId,
      employeeUserId: session.id,
      rowOrder: nextRowOrder,
      orderId: parsed.orderId,
      client: parsed.client,
      orderValueUsd: parsed.orderValueUsd,
      orderValueBdt: parsed.orderValueBdt,
      newClients: parsed.newClients,
      status: parsed.status ?? "Assigned",
      notes: parsed.notes,
      extra: parsed.extra,
      endDate: parsed.endDate ? new Date(`${parsed.endDate}T00:00:00.000Z`) : null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id });
}
