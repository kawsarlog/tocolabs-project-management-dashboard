import { redirect } from "next/navigation";
import AppShell from "@/components/nav/AppShell";
import { getSessionUser } from "@/lib/auth/session";
import { getWorkspaceBrand } from "@/lib/ledger";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.role !== "BUSINESS_ADMIN" && session.role !== "PLATFORM_ADMIN") {
    redirect("/login");
  }

  const brand = session.businessId
    ? await getWorkspaceBrand(session.businessId)
    : { name: "TocoLabs", logoUrl: null, tagline: null };

  return (
    <AppShell
      username={session.username}
      roleLabel="Business owner"
      brandName={brand.name}
      logoUrl={brand.logoUrl}
      tagline={brand.tagline}
      links={[
        { href: "/admin/dashboard", label: "Dashboard", icon: "home" },
        { href: "/admin/team", label: "Team", icon: "users" },
        { href: "/admin/overview/monthly", label: "Overview", icon: "table" },
        { href: "/admin/settings", label: "Settings", icon: "settings" },
      ]}
    >
      {children}
    </AppShell>
  );
}
