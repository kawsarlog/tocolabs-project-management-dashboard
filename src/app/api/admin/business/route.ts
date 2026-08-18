import { NextResponse } from "next/server";
import { requireBusinessAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/auth/identity";
import {
  fetchRemoteDisplayName,
  fetchRemoteWorkspace,
  persistRemoteDisplayName,
  persistRemoteWorkspace,
  revalidateBrandPages,
} from "@/lib/workspace-sync";

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

async function cacheLocalBusiness(
  businessId: string,
  data: { name?: string; tagline?: string | null },
) {
  try {
    await prisma.business.update({
      where: { id: businessId },
      data,
    });
  } catch (error) {
    console.error("[settings] local business cache update failed:", error);
  }
}

async function cacheLocalDisplayName(
  userId: string,
  businessId: string,
  displayName: string | null,
) {
  try {
    await prisma.employeeProfile.upsert({
      where: { userId },
      update: { displayName },
      create: {
        businessId,
        userId,
        displayName,
      },
    });
  } catch (error) {
    console.error("[settings] local display-name cache update failed:", error);
  }
}

function publicBusiness(business: {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  logourl?: string | null;
  tagline: string | null;
}) {
  return {
    id: business.id,
    name: business.name,
    slug: business.slug,
    logoUrl: business.logoUrl ?? business.logourl ?? null,
    tagline: business.tagline,
    workspaceKey: slugify(business.name),
  };
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

  try {
    if (name !== undefined || tagline !== undefined) {
      await persistRemoteWorkspace(session.supabaseUserId, {
        ...(name !== undefined ? { name } : {}),
        ...(tagline !== undefined ? { tagline } : {}),
      });
      await cacheLocalBusiness(session.businessId!, {
        ...(name !== undefined ? { name } : {}),
        ...(tagline !== undefined ? { tagline } : {}),
      });
    }

    if (displayName !== undefined) {
      await persistRemoteDisplayName(session.supabaseUserId, displayName);
      await cacheLocalDisplayName(session.id, session.businessId!, displayName);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save settings.";
    console.error("[settings] supabase persist failed:", error);
    return NextResponse.json(
      {
        ok: false,
        error: message.includes("column")
          ? "Supabase is missing a settings column. Run supabase/alter_business_logo.sql in the SQL Editor, then try again."
          : message,
      },
      { status: 500 },
    );
  }

  const remote = await fetchRemoteWorkspace(session.supabaseUserId).catch(() => null);
  const local = await prisma.business
    .findUnique({
      where: { id: session.businessId! },
      select: { id: true, name: true, slug: true, logoUrl: true, tagline: true },
    })
    .catch(() => null);

  const merged = {
    id: remote?.id ?? local?.id ?? session.businessId!,
    name: name ?? remote?.name ?? local?.name ?? "Workspace",
    slug: remote?.slug ?? local?.slug ?? "workspace",
    logoUrl: remote?.logoUrl ?? local?.logoUrl ?? null,
    tagline: tagline !== undefined ? tagline : (remote?.tagline ?? local?.tagline ?? null),
  };

  revalidateBrandPages();

  return NextResponse.json({
    ok: true,
    displayName: displayName === undefined ? undefined : displayName,
    business: publicBusiness(merged),
  });
}

export async function GET() {
  const sessionOrRes = await requireBusinessAdmin();
  if (sessionOrRes instanceof NextResponse) return sessionOrRes;
  const session = sessionOrRes;

  const remote = await fetchRemoteWorkspace(session.supabaseUserId).catch(() => null);
  if (remote) {
    const displayName = await fetchRemoteDisplayName(session.supabaseUserId).catch(() => null);
    return NextResponse.json({
      ok: true,
      displayName,
      business: publicBusiness(remote),
    });
  }

  const business = await prisma.business.findUnique({
    where: { id: session.businessId! },
    select: { id: true, name: true, slug: true, logoUrl: true, tagline: true },
  });

  if (!business) {
    return NextResponse.json({ ok: false, error: "Workspace not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    business: publicBusiness(business),
  });
}
