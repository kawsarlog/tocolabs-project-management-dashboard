import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL as string,
  }),
});

type SampleEntry = {
  rowOrder: number;
  orderId?: string | null;
  client?: string | null;
  orderValueUsd?: number | null;
  newClients?: number | null;
  status?: string | null;
  notes?: string | null;
  extra?: string | null;
};

type SampleDay = {
  username: string;
  date: string;
  shiftLabel: string;
  entries: SampleEntry[];
};

async function main() {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log("Seed skipped: users already exist.");
    return;
  }

  const business = await prisma.business.create({
    data: {
      name: "TocoLabs",
      slug: "tocolabs",
    },
  });

  const platformPassword = "admin123";
  await prisma.user.create({
    data: {
      username: "superadmin",
      passwordHash: await bcrypt.hash(platformPassword, 12),
      role: "PLATFORM_ADMIN",
      status: "ACTIVE",
      businessId: business.id,
    },
  });

  const businessPassword = "admin123";
  const businessAdminUser = await prisma.user.create({
    data: {
      username: "bizadmin",
      passwordHash: await bcrypt.hash(businessPassword, 12),
      role: "BUSINESS_ADMIN",
      status: "ACTIVE",
      businessId: business.id,
    },
  });

  await prisma.employeeProfile.create({
    data: {
      businessId: business.id,
      userId: businessAdminUser.id,
      department: "Admin",
      designation: "Business Admin",
    },
  });

  const employeePassword = "employee123";

  const employees = [
    { username: "nisa", name: "Nisa", shift: "6PM-2AM", department: "Operations" },
    { username: "ishrat", name: "Ishrat", shift: "9AM-5PM", department: "Operations" },
    { username: "anika", name: "Anika", shift: "4AM-10:30AM", department: "Operations" },
    { username: "sadia", name: "Sadia", shift: "Flexible", department: "Operations" },
    { username: "sumaiya", name: "Sumaiya", shift: "Flexible", department: "Operations" },
  ] as const;

  const employeeUsers: Record<string, string> = {};

  for (const employee of employees) {
    const user = await prisma.user.create({
      data: {
        username: employee.username,
        passwordHash: await bcrypt.hash(employeePassword, 12),
        role: "EMPLOYEE",
        status: "ACTIVE",
        businessId: business.id,
      },
    });

    employeeUsers[employee.username] = user.id;

    await prisma.employeeProfile.create({
      data: {
        businessId: business.id,
        userId: user.id,
        displayName: employee.name,
        department: employee.department,
        designation: "Team Member",
        managerUserId: businessAdminUser.id,
      },
    });
  }

  const sampleDays: SampleDay[] = [
    {
      username: "nisa",
      date: "2026-08-01",
      shiftLabel: "6PM-2AM",
      entries: [
        { rowOrder: 1, orderId: "1049", client: "jwalsworth", orderValueUsd: 75, status: "Assigned" },
        { rowOrder: 2, orderId: "1050", client: "scjorda", orderValueUsd: 75, status: "Complete" },
      ],
    },
    {
      username: "nisa",
      date: "2026-08-02",
      shiftLabel: "6PM-2AM",
      entries: [
        { rowOrder: 1, orderId: "1053", client: "michellestrz", orderValueUsd: 140, status: "Assigned" },
        { rowOrder: 2, orderId: "825", client: "marksasaki (2nd Order)", orderValueUsd: 150, status: "Assigned", extra: "Return order" },
        { rowOrder: 3, orderId: null, client: "komedisgmbh", orderValueUsd: null, status: "Pending", notes: "Waiting for response" },
      ],
    },
    {
      username: "ishrat",
      date: "2026-08-01",
      shiftLabel: "9AM-5PM",
      entries: [
        { rowOrder: 1, orderId: "1052", client: "Nicolasdecrouy", orderValueUsd: 125, status: "Assigned" },
        { rowOrder: 2, orderId: "825", client: "marksasaki", status: "Pending" },
      ],
    },
    {
      username: "ishrat",
      date: "2026-08-06",
      shiftLabel: "10 - 06:40",
      entries: [
        { rowOrder: 1, client: "No Order", status: "No Order", notes: "No confirmed work in this shift" },
      ],
    },
    {
      username: "anika",
      date: "2026-08-06",
      shiftLabel: "4AM - 10:30AM",
      entries: [
        { rowOrder: 1, orderId: "1063", client: "mariaples", orderValueUsd: 85, newClients: 3, status: "Complete" },
      ],
    },
    {
      username: "anika",
      date: "2026-08-08",
      shiftLabel: "4AM - 10:30AM",
      entries: [
        { rowOrder: 1, orderId: "972", client: "finest79", orderValueUsd: 20, newClients: 2, status: "Complete", notes: "Return client, gave changes to previous work" },
        { rowOrder: 2, orderId: "1065", client: "sachiimusic", orderValueUsd: 50, status: "Delivered" },
        { rowOrder: 3, orderId: "1064", client: "norsemedical", orderValueUsd: 150, status: "Complete" },
      ],
    },
    {
      username: "sadia",
      date: "2026-07-23",
      shiftLabel: "Flexible",
      entries: [
        { rowOrder: 1, status: "Important", notes: "Carry forward follow-up items for the next shift" },
      ],
    },
    {
      username: "sumaiya",
      date: "2026-07-23",
      shiftLabel: "Flexible",
      entries: [
        { rowOrder: 1, status: "Important", notes: "Important pending checklist for admin review" },
      ],
    },
  ] as const;

  for (const day of sampleDays) {
    const workDay = await prisma.workDay.create({
      data: {
        businessId: business.id,
        employeeUserId: employeeUsers[day.username],
        date: new Date(`${day.date}T00:00:00.000Z`),
        shiftLabel: day.shiftLabel,
      },
    });

    for (const entry of day.entries) {
      await prisma.workEntry.create({
        data: {
          businessId: business.id,
          workDayId: workDay.id,
          employeeUserId: employeeUsers[day.username],
          rowOrder: entry.rowOrder,
          orderId: entry.orderId ?? null,
          client: entry.client ?? null,
          orderValueUsd: entry.orderValueUsd ?? null,
          orderValueBdt:
            entry.orderValueUsd != null ? Number((entry.orderValueUsd * 122).toFixed(2)) : null,
          newClients: entry.newClients ?? null,
          status: entry.status ?? null,
          notes: entry.notes ?? null,
          extra: entry.extra ?? null,
        },
      });
    }
  }

  const nisaDay = await prisma.workDay.findFirst({
    where: { employeeUserId: employeeUsers["nisa"] },
    orderBy: { date: "asc" },
  });

  if (nisaDay) {
    await prisma.adminComment.create({
      data: {
        businessId: business.id,
        adminUserId: businessAdminUser.id,
        workDayId: nisaDay.id,
        body: "Follow up on pending client rows before shift end.",
      },
    });
  }

  console.log("Seed complete.");
  console.log("Platform admin:", { username: "superadmin", password: platformPassword });
  console.log("Business admin:", { username: "bizadmin", password: businessPassword });
  console.log("Employees:", [
    { username: "nisa", password: employeePassword },
    { username: "ishrat", password: employeePassword },
    { username: "anika", password: employeePassword },
    { username: "sadia", password: employeePassword },
    { username: "sumaiya", password: employeePassword },
  ]);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

