import BrandSettingsForm from "@/components/admin/BrandSettingsForm";
import { getSessionUser } from "@/lib/auth/session";
import { getWorkspaceBrand } from "@/lib/ledger";

export default async function AdminSettingsPage() {
  const session = await getSessionUser();
  if (!session?.businessId) return null;
  const brand = await getWorkspaceBrand(session.businessId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          Edit the company name your employees see. After you save, their dashboard header shows
          “Working under {brand.name}”.
        </p>
      </div>
      <BrandSettingsForm initialName={brand.name} />
    </div>
  );
}
