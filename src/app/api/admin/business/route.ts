import { NextResponse } from "next/server";
import { requireBusinessAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/auth/identity";
import { syncRemoteDisplayName, syncRemoteWorkspace } from "@/lib/workspace-sync";

function parseOptionalText(
  value: unknown,
  max: number,
  label: string,
): string | null | undefined | { error: string } {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    return { error: `${label} must be text.` };
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) {
    return { error: `${label} must be ${max} characters or fewer.` };
  }
  return trimmed;
}

function isParseError(value: unknown): value is { error: string } {
  return Boolean(value && typeof value === "object" && "error" in value);
}

export async function PATCH(req: Request) {
  const sessionOrRes = await requireBusinessAdmin();
  if (sessionOrRes instanceof NextResponse) return sessionOrRes;
  const session = sessionOrRes;

  const body = (await req.json()) as {
    name?: unknown;
    tagline?: unknown;
    displayName?: unknown;
  };

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (name !== undefined && (name.length < 2 || name.length > 80)) {
    return NextResponse.json(
      { ok: false, error: "Company name must be between 2 and 80 characters." },
      { status: 400 },
    );
  }

  const tagline = parseOptionalText(body.tagline, 120, "Tagline");
  if (isParseError(tagline)) {
    return NextResponse.json({ ok: false, error: tagline.error }, { status: 400 });
  }

  const displayName = parseOptionalText(body.displayName, 80, "Display name");
  if (isParseError(displayName)) {
    return NextResponse.json({ ok: false, error: displayName.error }, { status: 400 });
  }

  if (name === undefined && tagline === undefined && displayName === undefined) {
    return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  }

  const localUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: { supabaseUserId: true },
  });

  if (name !== undefined || tagline !== undefined) {
    await prisma.business.update({
      where: { id: session.businessId! },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(tagline !== undefined ? { tagline } : {}),
      },
    });

    await syncRemoteWorkspace(localUser?.supabaseUserId, {
      ...(name !== undefined ? { name } : {}),
      ...(tagline !== undefined ? { tagline } : {}),
    });
  }

  if (displayName !== undefined) {
    await prisma.employeeProfile.upsert({
      where: { userId: session.id },
      update: { displayName },
      create: {
        businessId: session.businessId!,
        userId: session.id,
        displayName,
      },
    });
    await syncRemoteDisplayName(localUser?.supabaseUserId, displayName);
  }

  const business = await prisma.business.findUnique({
    where: { id: session.businessId! },
    select: { id: true, name: true, slug: true, logoUrl: true, tagline: true },
  });

  return NextResponse.json({
    ok: true,
    displayName: displayName === undefined ? undefined : displayName,
    business: business ? { ...business, workspaceKey: slugify(business.name) } : null,
  });
}

export async function GET() {
  const sessionOrRes = await requireBusinessAdmin();
  if (sessionOrRes instanceof NextResponse) return sessionOrRes;
  const session = sessionOrRes;

  const business = await prisma.business.findUnique({
    where: { id: session.businessId! },
    select: { id: true, name: true, slug: true, logoUrl: true, tagline: true },
  });

  if (!business) {
    return NextResponse.json({ ok: false, error: "Workspace not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    business: { ...business, workspaceKey: slugify(business.name) },
  });
}
