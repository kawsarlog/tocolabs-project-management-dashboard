import {
  BrandPreview,
  BrandSettingsForm,
  LogoSettingsForm,
  PasswordSettingsForm,
  ProfileSettingsForm,
} from "@/components/admin/BrandSettingsForm";
import { getSessionUser } from "@/lib/auth/session";
import { getWorkspaceBrand } from "@/lib/ledger";
import { prisma } from "@/lib/prisma";

export default async function AdminSettingsPage() {
  const session = await getSessionUser();
  if (!session?.businessId) return null;
  const [brand, profile] = await Promise.all([
    getWorkspaceBrand(session.businessId),
    prisma.user.findUnique({
      where: { id: session.id },
      select: {
        username: true,
        employeeProfile: { select: { displayName: true } },
      },
    }),
  ]);

  const displayName = profile?.employeeProfile?.displayName || session.username;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          Company identity, brand file, and the password for this owner account. Team members and
          dashboards stay on their own pages.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19.5rem] xl:items-start">
        <div className="order-2 space-y-6 xl:order-1">
          <ProfileSettingsForm username={session.username} initialDisplayName={displayName} />
          <BrandSettingsForm initialName={brand.name} initialTagline={brand.tagline ?? ""} />
          <LogoSettingsForm initialLogoUrl={brand.logoUrl} />
          <PasswordSettingsForm />
        </div>
        <div className="order-1 xl:sticky xl:top-24 xl:order-2">
          <BrandPreview
            name={brand.name}
            tagline={brand.tagline ?? ""}
            logoUrl={brand.logoUrl}
          />
        </div>
      </div>
    </div>
  );
}
