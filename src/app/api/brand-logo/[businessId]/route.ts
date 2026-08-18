import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getSessionUser } from "@/lib/auth/session";
import {
  LOGO_DIR,
  findLogoFilename,
  isSafeBusinessId,
  typeForExtension,
} from "@/lib/brand-files";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ businessId: string }> },
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const businessId = String((await context.params).businessId ?? "");
  if (!isSafeBusinessId(businessId)) {
    return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
  }

  if (session.role !== "PLATFORM_ADMIN" && session.businessId !== businessId) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const filename = await findLogoFilename(businessId);
  if (!filename) {
    return NextResponse.json({ ok: false, error: "No logo uploaded." }, { status: 404 });
  }

  const filePath = path.join(LOGO_DIR, filename);
  const buffer = await fs.readFile(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": typeForExtension(filename),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
