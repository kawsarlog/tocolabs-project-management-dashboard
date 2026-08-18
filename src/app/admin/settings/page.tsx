import { SettingsWorkspace } from "@/components/admin/BrandSettingsForm";
import { getSessionUser } from "@/lib/auth/session";
import { getWorkspaceBrand } from "@/lib/ledger";
import { prisma } from "@/lib/prisma";
import { fetchRemoteDisplayName } from "@/lib/workspace-sync";

export default async function AdminSettingsPage() {
  const session = await getSessionUser();
  if (!session?.businessId) return null;
  const [brand, remoteDisplayName, profile] = await Promise.all([
    getWorkspaceBrand(session.businessId, session.supabaseUserId),
    fetchRemoteDisplayName(session.supabaseUserId).catch(() => null),
    prisma.user.findUnique({
      where: { id: session.id },
      select: {
        username: true,
        employeeProfile: { select: { displayName: true } },
      },
    }),
  ]);

  const displayName =
    remoteDisplayName || profile?.employeeProfile?.displayName || session.username;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          Company identity, brand file, and the password for this owner account. Team members and
          dashboards stay on their own pages.
        </p>
      </div>

      <SettingsWorkspace
        username={session.username}
        initialDisplayName={displayName}
        initialName={brand.name}
        initialTagline={brand.tagline ?? ""}
        initialLogoUrl={brand.logoUrl}
      />
    </div>
  );
}
