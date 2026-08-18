import { NextResponse } from "next/server";
import { requireBusinessAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import {
  MAX_LOGO_BYTES,
  extensionForType,
  removeLogoFiles,
  saveLogoFile,
} from "@/lib/brand-files";
import { persistRemoteLogoFile, removeRemoteLogo, revalidateBrandPages } from "@/lib/workspace-sync";

export const runtime = "nodejs";

async function cacheLocalLogo(businessId: string, logoUrl: string | null) {
  try {
    return await prisma.business.update({
      where: { id: businessId },
      data: { logoUrl },
      select: { id: true, logoUrl: true },
    });
  } catch (error) {
    console.error("[settings] local logo cache update failed:", error);
    return { id: businessId, logoUrl };
  }
}

export async function POST(req: Request) {
  const sessionOrRes = await requireBusinessAdmin();
  if (sessionOrRes instanceof NextResponse) return sessionOrRes;
  const session = sessionOrRes;

  const form = await req.formData();
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "Choose a logo image to upload." }, { status: 400 });
  }
  if (file.size > MAX_LOGO_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Logo must be 2 MB or smaller." },
      { status: 400 },
    );
  }
  const extension = extensionForType(file.type);
  if (!extension) {
    return NextResponse.json(
      { ok: false, error: "Use a PNG, JPG, WEBP, or GIF image." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let logoUrl: string;
  try {
    logoUrl = await persistRemoteLogoFile(
      session.supabaseUserId,
      buffer,
      file.type,
      extension,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload the logo.";
    console.error("[settings] supabase logo persist failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  try {
    await saveLogoFile(session.businessId!, buffer, file.type);
  } catch (error) {
    console.error("[settings] local logo file write failed:", error);
  }

  const updated = await cacheLocalLogo(session.businessId!, logoUrl);
  revalidateBrandPages();
  return NextResponse.json({
    ok: true,
    business: { id: updated.id, logoUrl: updated.logoUrl ?? logoUrl },
  });
}

export async function DELETE() {
  const sessionOrRes = await requireBusinessAdmin();
  if (sessionOrRes instanceof NextResponse) return sessionOrRes;
  const session = sessionOrRes;

  try {
    await removeRemoteLogo(session.supabaseUserId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove the logo.";
    console.error("[settings] supabase logo remove failed:", error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }

  try {
    await removeLogoFiles(session.businessId!);
  } catch (error) {
    console.error("[settings] local logo file remove failed:", error);
  }

  const updated = await cacheLocalLogo(session.businessId!, null);
  revalidateBrandPages();
  return NextResponse.json({
    ok: true,
    business: { id: updated.id, logoUrl: null },
  });
}
