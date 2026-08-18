import { NextResponse } from "next/server";
import { requireBusinessAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import {
  MAX_LOGO_BYTES,
  extensionForType,
  logoPublicPath,
  removeLogoFiles,
  saveLogoFile,
} from "@/lib/brand-files";
import { syncRemoteWorkspace } from "@/lib/workspace-sync";

export const runtime = "nodejs";

async function supabaseIdFor(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { supabaseUserId: true },
  });
  return user?.supabaseUserId ?? null;
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
  if (!extensionForType(file.type)) {
    return NextResponse.json(
      { ok: false, error: "Use a PNG, JPG, WEBP, or GIF image." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await saveLogoFile(session.businessId!, buffer, file.type);
  const logoUrl = logoPublicPath(session.businessId!, Date.now());

  const updated = await prisma.business.update({
    where: { id: session.businessId! },
    data: { logoUrl },
    select: { id: true, logoUrl: true },
  });

  await syncRemoteWorkspace(await supabaseIdFor(session.id), { logoUrl });

  return NextResponse.json({ ok: true, business: updated });
}

export async function DELETE() {
  const sessionOrRes = await requireBusinessAdmin();
  if (sessionOrRes instanceof NextResponse) return sessionOrRes;
  const session = sessionOrRes;

  await removeLogoFiles(session.businessId!);
  const updated = await prisma.business.update({
    where: { id: session.businessId! },
    data: { logoUrl: null },
    select: { id: true, logoUrl: true },
  });
  await syncRemoteWorkspace(await supabaseIdFor(session.id), { logoUrl: null });

  return NextResponse.json({ ok: true, business: updated });
}
