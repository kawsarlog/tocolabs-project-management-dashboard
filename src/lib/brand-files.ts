import fs from "fs/promises";
import path from "path";

export const LOGO_DIR = path.join(process.cwd(), "uploads", "brands");
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const TYPE_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const EXT_TO_TYPE: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export function isSafeBusinessId(value: string) {
  return /^[a-zA-Z0-9_-]+$/.test(value);
}

export function logoPublicPath(businessId: string, version?: string | number) {
  const base = `/api/brand-logo/${encodeURIComponent(businessId)}`;
  return version ? `${base}?v=${version}` : base;
}

export function extensionForType(mime: string) {
  return TYPE_TO_EXT[mime] ?? null;
}

export function typeForExtension(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  return EXT_TO_TYPE[ext] ?? "application/octet-stream";
}

export async function ensureLogoDir() {
  await fs.mkdir(LOGO_DIR, { recursive: true });
}

export async function findLogoFilename(businessId: string) {
  if (!isSafeBusinessId(businessId)) return null;
  try {
    const names = await fs.readdir(LOGO_DIR);
    return names.find((name) => name.startsWith(`${businessId}.`)) ?? null;
  } catch {
    return null;
  }
}

export async function removeLogoFiles(businessId: string) {
  const names = await fs.readdir(LOGO_DIR).catch(() => [] as string[]);
  await Promise.all(
    names
      .filter((name) => name.startsWith(`${businessId}.`))
      .map((name) => fs.unlink(path.join(LOGO_DIR, name))),
  );
}

export async function saveLogoFile(businessId: string, buffer: Buffer, mime: string) {
  const ext = extensionForType(mime);
  if (!ext) throw new Error("Unsupported image type.");
  await ensureLogoDir();
  await removeLogoFiles(businessId);
  const filename = `${businessId}${ext}`;
  await fs.writeFile(path.join(LOGO_DIR, filename), buffer);
  return filename;
}
