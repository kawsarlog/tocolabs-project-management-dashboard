export const AUTH_EMAIL_DOMAIN = "users.tocolabs.local";

export type AppRole = "PLATFORM_ADMIN" | "BUSINESS_ADMIN" | "EMPLOYEE";

export function usernameToAuthEmail(username: string) {
  return `${username.trim().toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

export function toAuthEmail(usernameOrEmail: string) {
  const value = usernameOrEmail.trim().toLowerCase();
  if (value.includes("@")) return value;
  return usernameToAuthEmail(value);
}

export function usernameFromAuthUser(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}) {
  const meta = user.user_metadata?.username;
  if (typeof meta === "string" && meta.trim()) {
    return meta.trim().toLowerCase();
  }

  const email = user.email ?? "";
  const localPart = email.split("@")[0] ?? "";
  return localPart.toLowerCase();
}

export function redirectToForRole(role: AppRole) {
  if (role === "PLATFORM_ADMIN") return "/platform/dashboard";
  if (role === "BUSINESS_ADMIN") return "/admin/dashboard";
  return "/employee/sheet";
}

export function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "workspace";
}
