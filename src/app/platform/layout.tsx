import { redirect } from "next/navigation";
import Wordmark from "@/components/brand/Wordmark";
import { getSessionUser } from "@/lib/auth/session";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  if (session.role !== "PLATFORM_ADMIN") redirect("/login");

  return (
    <div className="tl-shell">
      <header className="tl-header">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Wordmark kicker={session.username} />

          <nav className="flex items-center gap-2 text-sm">
            <a
              href="/platform/dashboard"
              className="rounded-md bg-secondary px-3 py-2 text-secondary-foreground"
            >
              Workspaces
            </a>
          </nav>

          <form action="/api/auth/logout" method="post">
            <button type="submit" className="tl-btn-ink px-3 py-2 text-sm">
              Logout
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
