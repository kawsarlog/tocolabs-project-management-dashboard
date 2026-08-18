import { redirect } from "next/navigation";
import AppShell from "@/components/nav/AppShell";
import { getSessionUser } from "@/lib/auth/session";
import { getWorkspaceBrand } from "@/lib/ledger";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.role !== "EMPLOYEE") redirect("/login");

  const brand = session.businessId
    ? await getWorkspaceBrand(session.businessId)
    : { name: "TocoLabs" };

  return (
    <AppShell
      username={session.username}
      roleLabel="Team member"
      brandName={brand.name}
      workingUnder
      links={[{ href: "/employee/sheet", label: "My work", icon: "sheet" }]}
    >
      {children}
    </AppShell>
  );
}
